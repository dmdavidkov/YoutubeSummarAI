// Use an IIFE (Immediately Invoked Function Expression) to create a scope for our code
(function() {
    // Check if the script has already been injected
    if (window.youtubeVpplxInjected) {
        return;
    }
    window.youtubeVpplxInjected = true;

    console.log("Content script loaded");

    let bufferDiv = document.createElement('div');
    let providerSettings = {};
    let currentObserver = null;
    let dockedDiv = null;
    let globalPrompt = '';

    // Load settings from storage
    chrome.storage.sync.get(null, function(items) {
        providerSettings = items.providers || {};
        initializeContentScript();
    });

    function initializeContentScript() {
        console.log("Initializing content script");
        setupMessageListener();
        setupObserverForCurrentSite();
    }    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log("Message received in content script:", request);
            console.log("🔍 CONTENT SCRIPT DEBUG: Current URL:", window.location.href);
            console.log("🔍 CONTENT SCRIPT DEBUG: Tab title:", document.title);
            
            // Debug: Log specifically for pastePrompt action
            if (request.action === 'pastePrompt') {
                console.log("🔍 CONTENT: pastePrompt message received!");
                console.log("🔍 CONTENT: Request keys:", Object.keys(request));
                console.log("🔍 CONTENT: Provider:", request.provider);
                console.log("🔍 CONTENT: VideoUrl:", request.videoUrl);
                console.log("🔍 CONTENT: Prompt exists:", !!request.prompt);
                console.log("🔍 CONTENT: Prompt length:", request.prompt ? request.prompt.length : 'undefined');
            }
            
            switch(request.action) {
                case 'toggleDockedDiv':
                    console.log("Toggling docked div");
                    dockedDiv ? removeDockedDiv() : createDockedDiv();
                    break;
                case 'createDockedDiv':
                    if (!dockedDiv) createDockedDiv();
                    break;
                case 'divContent':
                case 'updateSummaryStatus':
                    updateSummaryContent(request.content || request.status, request.isLoading, request.isError);
                    break;
                case 'seekToTimeEx':
                    seekToTime(request.time);
                    break;
                case 'pastePrompt':
                    handlePastePrompt(request);
                    break;
                case 'updateSummaryContent':
                    updateSummaryContent(request.content, request.isLoading, request.isError);
                    break;                case 'getContent':
                    try {
                        // Get the result selector from the request or from providerSettings
                        const resultSelector = request.selectors?.resultSelector || 
                                             (providerSettings && providerSettings[request.provider]?.resultSelector);
                        
                        if (!resultSelector) {
                            console.error('No result selector available for provider:', request.provider);
                            sendResponse({ content: '', error: 'No result selector found' });
                            break;
                        }
                        
                        const resultElement = document.querySelector(resultSelector);
                        const content = resultElement ? resultElement.innerHTML : '';
                        console.log('getContent response - selector:', resultSelector, 'content length:', content.length);
                        sendResponse({ content: content });
                    } catch (error) {
                        console.error('Error in getContent handler:', error);
                        sendResponse({ content: '', error: error.message });
                    }
                    break;
                case 'copyContent':
                    const textArea = document.createElement('textarea');
                    textArea.value = request.content;
                    document.body.appendChild(textArea);
                    textArea.select();
                    try {
                        document.execCommand('copy');                    console.log('Content copied successfully');
                    } catch (err) {
                        console.error('Failed to copy content:', err);
                    }
                    document.body.removeChild(textArea);
                    break;

                case 'extractTranscript':
                    extractYouTubeTranscript().then(result => {
                        sendResponse(result);
                    }).catch(error => {
                        sendResponse({ error: error.message });
                    });
                    return true; // Indicate async response
            }

            // Send an immediate response
            sendResponse({ success: true });

            // Return false to indicate we've handled the message synchronously
            return false;
        });
    }

    function createDockedDiv() {
        if (dockedDiv) return;

        const columnsDiv = document.querySelector('#columns');
        if (!columnsDiv) {
            console.error('Columns div not found on the page.');
            return;
        }

        const primaryDiv = columnsDiv.querySelector('#primary');
        const secondaryDiv = columnsDiv.querySelector('#secondary');

        if (!primaryDiv || !secondaryDiv) {
            console.error('Primary or Secondary div not found within #columns.');
            return;
        }

        // Create a wrapper for the secondary content and our docked div
        const wrapper = document.createElement('div');
        wrapper.id = 'secondary-wrapper';
        wrapper.style.cssText = `
            display: flex;
            flex-direction: column;
            max-width: 35vw;
            height: ${primaryDiv.style.height};
            right: 0;
            top: 0;
        `;

        // Create our docked div
        dockedDiv = document.createElement('div');
        dockedDiv.id = 'myDockedDiv';
        dockedDiv.style.cssText = `
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            margin-bottom: 20px;
            box-sizing: border-box;
            border-radius: 8px;
        `;

        // Load the content from popup.html into the docked div
        fetch(chrome.runtime.getURL("popup.html"))
            .then(response => response.text())
            .then(data => {
                dockedDiv.innerHTML = data;
                
                // Move the secondary content into the wrapper
                secondaryDiv.parentNode.insertBefore(wrapper, secondaryDiv);
                wrapper.appendChild(dockedDiv);
                wrapper.appendChild(secondaryDiv);

                // Initialize popup logic
                initializePopup();
            })
            .catch(error => console.error('Error loading popup.html:', error));
    }

    function removeDockedDiv() {
        if (!dockedDiv) return;
        
        const columnsDiv = document.querySelector('#columns');
        if (!columnsDiv) {
            console.error('Columns div not found on the page.');
            return;
        }

        const primaryDiv = columnsDiv.querySelector('#primary');
        const secondaryDiv = columnsDiv.querySelector('#secondary');
        const wrapper = document.getElementById('secondary-wrapper');

        if (wrapper && primaryDiv && secondaryDiv) {
            // Move the secondary content back to its original position
            wrapper.parentNode.insertBefore(secondaryDiv, wrapper);
            wrapper.remove();

            // Restore original layout
            primaryDiv.style.width = '';
            primaryDiv.style.maxWidth = '';
            secondaryDiv.style.position = '';
            secondaryDiv.style.right = '';
            secondaryDiv.style.top = '';
        }

        dockedDiv = null;
    }

    function initializePopup() {
        console.log('Initializing popup');
        const generateSummaryBtn = document.getElementById('generateSummaryBtn');
        if (generateSummaryBtn) {
            generateSummaryBtn.addEventListener('click', handleGenerateSummaryClick);
            console.log('Generate Summary button found and listener added');
        } else {
            console.error('Generate Summary button not found');
        }
        document.addEventListener('click', handleAnchorClick);
        
        console.log('Popup initialized');
    }

    function handleGenerateSummaryClick() {
        console.log('Generate Summary button clicked');
        const generateSummaryBtn = document.getElementById('generateSummaryBtn');
        if (!generateSummaryBtn) {
            console.error('Generate Summary button not found in click handler');
            return;
        }
        generateSummaryBtn.style.display = 'none';
        console.log('Button hidden');

        // Use the current tab directly since we're in content script
        if (window.location.href.includes('https://www.youtube.com/watch')) {
            updateSummaryContent('Initiating summary generation...', true);
            chrome.runtime.sendMessage({ action: 'generateSummary' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error(chrome.runtime.lastError);
                } else {
                    console.log('Generate summary message sent:', response);
                }
            });
        } else {
            updateSummaryContent('Please open a YouTube video page to generate a summary.', false, true);
            generateSummaryBtn.style.display = 'block';
        }
    }

    function handleAnchorClick(event) {
        const { target } = event;
        console.log('Click detected');
    
        // Handle special button clicks
        const specialButtons = {
            'optionsBtn': 'openOptions',
            'closeBtn': 'closeExtension'
        };
    
        const elementId = target.id || target.parentElement?.id || target.parentElement?.parentElement?.id;

        if (elementId && specialButtons[elementId]) {
            chrome.runtime.sendMessage({ action: specialButtons[elementId] });
            return;
        }
        
        if (elementId === 'copyBtn') {
            const summaryDiv = document.getElementById('summary');
            if (summaryDiv) {
                const textArea = document.createElement('textarea');
                textArea.value = summaryDiv.innerText;
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy');
                    console.log('Content copied successfully');
                } catch (err) {
                    console.error('Failed to copy content:', err);
                }
                document.body.removeChild(textArea);
            }
        }

        // Handle timestamp links
        const anchorElement = target.closest('a');
        if (!anchorElement) return;
    
        event.preventDefault();
        console.log('Anchor tag found:', anchorElement);
    
        try {
            const href = decodeURIComponent(anchorElement.href);
            const timestampRegex = /https?:\/\/(?:www\.)?youtube\.com\/watch\?.*?t=(\d+)/;
            const timeMatch = href.match(timestampRegex);
    
            if (timeMatch?.[1]) {
                chrome.runtime.sendMessage({
                    action: 'seekToTimeEx',
                    time: timeMatch[1]
                }).catch(err => console.error('Failed to send seekToTimeEx message:', err));
            } else {
                console.log('No valid YouTube timestamp found in URL:', href);
            }
        } catch (error) {
            console.error('Error processing anchor click:', error);
        }
    }

    function updateSummaryContent(newContent, isLoading = false, isError = false) {
        const iconHTML = isError ? createErrorIcon() : (isLoading ? createSpinner() : '');
        let contentHTML;
        
        if (isLoading || isError) {
            contentHTML = createContentHTML(newContent);
        } else {
            // Parse markdown when it's not a loading or error state
            contentHTML = marked.parse(newContent);
        }
        
        const styleHTML = createStyleHTML();

        bufferDiv.innerHTML = styleHTML + iconHTML + contentHTML;

        const summaryDiv = document.getElementById('summary');
        if (summaryDiv && summaryDiv.innerHTML !== bufferDiv.innerHTML) {
            summaryDiv.innerHTML = bufferDiv.innerHTML;
        }
    }

    function createSpinner() {
        return `
            <div class="spinner" style="
                border: 4px solid #f3f3f3;
                border-top: 4px solid #3498db;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                animation: spin 1s linear infinite;
                margin: 20px auto;
            "></div>
        `;
    }

    function createErrorIcon() {
        return `
            <div class="error-icon" style="
                color: #e74c3c;
                font-size: 30px;
                text-align: center;
                margin: 20px auto;
            ">&#9888;</div>
        `;
    }

    function createContentHTML(content) {
        return `
            <p style="
                font-size: 16px;
                font-weight: bold;
                text-align: center;
                margin-top: 10px;
            ">${content}</p>
        `;
    }

    function createStyleHTML() {
        return `
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
    }

    function setupObserverForCurrentSite() {
        const currentHostname = window.location.hostname;
        let provider = null;
        let selectors = null;

        // Check for custom provider first
        if (providerSettings.custom && providerSettings.custom.url) {
            try {
                const customUrl = new URL(providerSettings.custom.url);
                if (currentHostname === customUrl.hostname) {
                    provider = 'custom';
                    selectors = providerSettings.custom;
                }
            } catch (error) {
                console.error('Invalid custom URL:', error);
            }
        }

        // If not custom, check for known providers
        if (!provider) {
            for (const key in providerSettings) {
                if (key !== 'custom' && currentHostname.includes(new URL(providerSettings[key].url).hostname)) {
                    provider = key;
                    selectors = providerSettings[key];
                    break;
                }
            }
        }

        if (provider) {
            console.log("Current site matches provider:", provider);
            
            // Disconnect the previous observer if it exists
            if (currentObserver) {
                currentObserver.disconnect();
            }

            // Set up the new observer
            currentObserver = setupObserver(provider, selectors);
        } else {
            console.log("Current site does not match any known provider or YouTube");
        }
    }

    function setupObserver(provider, selectors) {
        let previousContent = null;
        console.log("Setting up observer for", provider);

        const observer = new MutationObserver(() => {
            const resultElement = document.querySelector(selectors.resultSelector);
            
            if (!resultElement) {
                chrome.runtime.sendMessage({ 
                    action: 'selectorWaiting', 
                    message: `Waiting for result selector "${selectors.resultSelector}"...`,
                    selector: selectors.resultSelector,
                    isResultSelector: true
                });
                return;
            }

            const currentContent = resultElement.innerHTML;
            if (currentContent !== previousContent) {
                previousContent = currentContent;
                chrome.runtime.sendMessage({ 
                    action: 'divContent', 
                    content: currentContent 
                });
                chrome.runtime.sendMessage({ action: 'contentUpdating' });
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        return observer;
    }    function handlePastePrompt(request) {
        const provider = request.provider;
        const selectors = request.selectors;
        console.log("Pasting prompt for provider:", provider);
        console.log("Selectors:", selectors);
        
        // Debug: Log what we received
        console.log("🔍 CONTENT: Received prompt length:", request.prompt ? request.prompt.length : 'undefined');
        console.log("🔍 CONTENT: Prompt preview (first 1000 chars):", request.prompt ? request.prompt.substring(0, 1000) : 'undefined');
        console.log("🔍 CONTENT: Video details section in received prompt:", request.prompt && request.prompt.includes('<video_details>') ? 'FOUND' : 'NOT FOUND');
        
        // Check specifically for the populated content in received prompt
        if (request.prompt) {
            const videoDetailsMatch = request.prompt.match(/<video_details>([\s\S]*?)<\/video_details>/);
            if (videoDetailsMatch) {
                console.log("🔍 CONTENT: Video details content length:", videoDetailsMatch[1].length);
                console.log("🔍 CONTENT: Video details content preview:", videoDetailsMatch[1].substring(0, 500));
            } else {
                console.log("🔍 CONTENT: ERROR: No video_details section found in received prompt!");
            }
        }
        
        waitForInputField(selectors.inputSelector, element => {
            console.log("Input element found");
            
            // 2. Assign request.prompt to the global variable
            globalPrompt = request.prompt;
            
            console.log("🔍 CONTENT: About to paste prompt to element. GlobalPrompt length:", globalPrompt ? globalPrompt.length : 'undefined');
            
            if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
                // 3. Use the global variable instead of request.prompt
                element.value = globalPrompt;
                element.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (element.isContentEditable) {
                element.textContent = globalPrompt;
                if (element.innerHTML !== undefined) {
                    element.innerHTML = globalPrompt;
                }
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                console.error("Unsupported input element type");
            }
            
            // Debug: Check what was actually pasted
            console.log("🔍 CONTENT: After pasting - element value length:", element.value ? element.value.length : (element.textContent ? element.textContent.length : 'undefined'));
            
            // Add a 1-second delay before executing handleButtonClicks
            setTimeout(() => {
                handleButtonClicks(selectors);
            }, 1000);        
        });
    }

    function waitForInputField(selector, callback) {
        const element = document.querySelector(selector);
        if (element) {
            callback(element);
        } else {
            setTimeout(() => waitForInputField(selector, callback), 250);
        }
    }

    function handleButtonClicks(selectors) {
        if (selectors.confirmButtonSelector) {
            waitForButton(selectors.buttonSelector, () => {
                setTimeout(() => {
                    waitForButton(selectors.confirmButtonSelector, null, 50, 500, true);
                }, 1000);
            });
        } else {
            const checkButtonInterval = setInterval(() => {
                const button = document.querySelector(selectors.buttonSelector);
                if (button && !button.disabled) {
                    clearInterval(checkButtonInterval);
                    button.click();
                    console.log("Button clicked for provider");
                }
            }, 1000);
        }
    }

    function waitForButton(selector, callback, maxAttempts = 50, interval = 500, isConfirmButton = false) {
        let attempts = 0;
        
        const checkButton = () => {
            const button = document.querySelector(selector);
            if (button && !button.disabled) {
                console.log("Button found:", selector);
                chrome.runtime.sendMessage({ action: 'selectorFound', selectorType: isConfirmButton ? 'Confirm button' : 'Button' });
                button.click();
                if (callback) callback();
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkButton, interval);
            } else {
                console.log(`Button with selector ${selector} not found after ${maxAttempts} attempts`);
                chrome.runtime.sendMessage({ 
                    action: 'selectorWaiting', 
                    message: `Waiting for ${isConfirmButton ? 'confirm ' : ''}button with selector "${selector}" to become active...`,
                    selector: selector,
                    isConfirmButton: isConfirmButton
                });
                setTimeout(checkButton, interval);
            }
        };
        
        checkButton();
    }

    function seekToTime(time) {
        const player = document.querySelector('video');
        if (player) {
            const timeInSeconds = parseInt(time, 10);
            player.currentTime = timeInSeconds;
            player.play();
        } else {
            console.error('YouTube player not found or seekTo not available.');
        }
    }

    // Add this to your content script
    setInterval(() => {
        chrome.runtime.sendMessage({ action: 'contentScriptAlive' });
    }, 25000);    // Helper function to format timestamps
    function formatTimestamp(timestamp) {
        // Handle various timestamp formats and normalize to HH:MM:SS
        if (!timestamp) return '';
        
        // Remove any brackets or extra characters
        timestamp = timestamp.replace(/[\[\]]/g, '').trim();
        
        // Handle formats like "0:0:05", "0:5", "1:23:45"
        const parts = timestamp.split(':');
        
        if (parts.length === 3) {
            // Already HH:MM:SS format, just ensure proper padding
            const hours = parts[0].padStart(1, '0');
            const minutes = parts[1].padStart(2, '0');
            const seconds = parts[2].padStart(2, '0');
            return `${hours}:${minutes}:${seconds}`;
        } else if (parts.length === 2) {
            // MM:SS format, add hours
            const minutes = parts[0].padStart(2, '0');
            const seconds = parts[1].padStart(2, '0');
            return `0:${minutes}:${seconds}`;
        } else if (parts.length === 1 && /^\d+$/.test(parts[0])) {
            // Just seconds
            const totalSeconds = parseInt(parts[0]);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        // If none of the above, return as is
        return timestamp;
    }

    // Extract YouTube transcript from the page
    async function extractYouTubeTranscript() {
        return new Promise((resolve, reject) => {
            try {
                // First, try to find if transcript is already visible
                let transcriptButton = document.querySelector('button[aria-label*="transcript" i], button[aria-label*="Show transcript" i]');
                
                if (!transcriptButton) {
                    // Look for transcript button in the video description area
                    transcriptButton = document.querySelector('ytd-video-description-transcript-section-renderer button');
                }

                if (!transcriptButton) {
                    // Look for more transcript button variations
                    const buttons = document.querySelectorAll('button');
                    for (const button of buttons) {
                        const text = button.textContent.toLowerCase();
                        const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
                        if (text.includes('transcript') || ariaLabel.includes('transcript')) {
                            transcriptButton = button;
                            break;
                        }
                    }
                }

                if (!transcriptButton) {
                    reject(new Error('Transcript button not found. Video may not have captions available.'));
                    return;
                }

                // Click the transcript button to show transcript
                transcriptButton.click();

                // Wait for transcript panel to load
                setTimeout(() => {
                    try {
                        // Look for transcript text elements
                        const transcriptSegments = document.querySelectorAll(
                            'ytd-transcript-segment-renderer, ' +
                            '[data-params*="transcript"] .segment-text, ' +
                            '.ytd-transcript-segment-renderer .segment-text, ' +
                            '.ytd-transcript-segment-list-renderer .segment-text'
                        );

                        if (transcriptSegments.length === 0) {
                            // Try alternative selectors
                            const altSegments = document.querySelectorAll('.cue-group .cue');
                            if (altSegments.length === 0) {
                                reject(new Error('Transcript segments not found after opening transcript panel.'));
                                return;
                            }
                        }                        // Extract text with timestamps from transcript segments
                        const segments = Array.from(transcriptSegments.length > 0 ? transcriptSegments : document.querySelectorAll('.cue-group .cue'));
                        const processedSegments = [];
                        
                        segments.forEach(segment => {
                            try {
                                // Try to find timestamp element within the segment
                                const timestampElement = segment.querySelector('.segment-timestamp, .cue-timestamp, [class*="timestamp"]');
                                let timestamp = '';
                                
                                if (timestampElement) {
                                    timestamp = timestampElement.textContent.trim();
                                } else {
                                    // Try to extract timestamp from data attributes
                                    const startTime = segment.getAttribute('data-start-time') || 
                                                    segment.getAttribute('start') ||
                                                    segment.getAttribute('data-start');
                                    if (startTime) {
                                        // Convert seconds to timestamp format
                                        const totalSeconds = parseFloat(startTime);
                                        const hours = Math.floor(totalSeconds / 3600);
                                        const minutes = Math.floor((totalSeconds % 3600) / 60);
                                        const seconds = Math.floor(totalSeconds % 60);
                                        timestamp = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                                    } else {
                                        // Try to extract from text content
                                        const fullText = segment.textContent.trim();
                                        const timestampMatch = fullText.match(/^(\d+:\d+(?::\d+)?)/);
                                        if (timestampMatch) {
                                            timestamp = timestampMatch[1];
                                        }
                                    }
                                }
                                
                                // Get the text content, removing timestamps if present
                                let text = segment.textContent.trim();
                                text = text.replace(/^\d+:\d+(?::\d+)?\s*/, '').trim();
                                
                                if (text && text.length > 0) {
                                    // Format timestamp properly
                                    const formattedTimestamp = timestamp ? formatTimestamp(timestamp) : '';
                                    processedSegments.push({
                                        timestamp: formattedTimestamp,
                                        text: text
                                    });
                                }
                            } catch (error) {
                                console.warn('Error processing transcript segment:', error);
                                const text = segment.textContent.trim().replace(/^\d+:\d+(?::\d+)?\s*/, '').trim();
                                if (text) {
                                    processedSegments.push({
                                        timestamp: '',
                                        text: text
                                    });
                                }
                            }
                        });

                        // Group segments and format output
                        const transcriptText = processedSegments
                            .map(seg => {
                                if (seg.timestamp) {
                                    return `[${seg.timestamp}] ${seg.text}`;
                                } else {
                                    return seg.text;
                                }
                            })
                            .join(' ');

                        if (!transcriptText || transcriptText.trim().length === 0) {
                            reject(new Error('No transcript text could be extracted.'));
                            return;
                        }

                        resolve({ transcript: transcriptText });
                    } catch (error) {
                        reject(new Error(`Error extracting transcript text: ${error.message}`));
                    }
                }, 2000); // Wait 2 seconds for transcript to load

            } catch (error) {
                reject(new Error(`Error accessing transcript: ${error.message}`));
            }
        });
    }
})();
