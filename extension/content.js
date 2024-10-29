// Use an IIFE (Immediately Invoked Function Expression) to create a scope for our code
(function() {
    // Check if the script has already been injected
    if (window.youtubeVpplxInjected) {
        return;
    }
    window.youtubeVpplxInjected = true;

    console.log("Content script loaded");

    let bufferDiv = document.createElement('div');
    let timeoutId;
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
    }

    function setupMessageListener() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log("Message received in content script:", request);
            
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
                    break;
                case 'getContent':
                    const resultElement = document.querySelector(providerSettings[request.provider].resultSelector);
                    const content = resultElement ? resultElement.innerHTML : '';
                    sendResponse({ content: content });
                    break;
                case 'copyContent':
                    const textArea = document.createElement('textarea');
                    textArea.value = request.content;
                    document.body.appendChild(textArea);
                    textArea.select();
                    try {
                        document.execCommand('copy');
                        console.log('Content copied successfully');
                    } catch (err) {
                        console.error('Failed to copy content:', err);
                    }
                    document.body.removeChild(textArea);
                    break;
                case 'closeTab':
                    closeNewTab(request.prompt, request.content);
                    break;
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
        console.log('Click detected');
        const anchorElement = event.target.closest('a');
        if (anchorElement) {
            console.log('Anchor tag found:', anchorElement);
            event.preventDefault();
            
            // Get the href and decode it if needed
            const href = decodeURIComponent(anchorElement.href);
            const youtubeUrlMatch = href.match(/https?:\/\/(?:www\.)?youtube\.com\/watch\?.*?t=(\d+)/);
            
            if (youtubeUrlMatch && youtubeUrlMatch[1]) {
                const timeParam = youtubeUrlMatch[1];
                chrome.runtime.sendMessage({
                    action: 'seekToTimeEx',
                    time: timeParam
                });
            } else {
                console.log('No valid YouTube timestamp found in URL:', href);
            }
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
        let previousDivContent = null;
        let mutationCount = 0;
        let lastMutationTime = Date.now();
        console.log("Setting up observer for", provider);

        const targetNode = document.body;
        const config = { childList: true, subtree: true, characterData: true };

        const observer = new MutationObserver((mutations) => {
            for (let mutation of mutations) {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    const divElement = document.querySelector(selectors.resultSelector);
                    if (divElement) {
                        const divContent = divElement.innerHTML;
                        if (divContent !== previousDivContent) {
                            chrome.runtime.sendMessage({ 
                                action: 'divContent', 
                                content: divContent 
                            });
                            previousDivContent = divContent;
                            mutationCount++;
                            lastMutationTime = Date.now();
                            resetTimer();

                            chrome.runtime.sendMessage({ action: 'contentUpdating' });
                        }
                    } else {
                        console.log("Result selector not found");
                        chrome.runtime.sendMessage({ 
                            action: 'selectorWaiting', 
                            message: `Waiting for result selector "${selectors.resultSelector}" to become active...`,
                            selector: selectors.resultSelector,
                            isResultSelector: true
                        });
                    }
                }
            }
        });

        observer.observe(targetNode, config);
        return observer;
    }

    function resetTimer() {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {

            // Click the copy button if it exists
            // TODO: make this work for other providers via providerSettings
            const copyButton = document.querySelector('[data-testid="copy-button"]');
            if (copyButton) {
                console.log("Copy button found, clicking it");
                copyButton.click();
            } else {
                console.log("Copy button not found");
            }
            sendCloseTabMessage();
            // chrome.runtime.sendMessage({ action: 'closeTab' });
            console.log("closeTab message sent");
            if (currentObserver) {
                currentObserver.disconnect();
            }
        }, 6000); // 6 seconds
    }
    async function sendCloseTabMessage() {
        try {
            const clipboardText = await navigator.clipboard.readText();
            chrome.runtime.sendMessage({ 
                action: 'closeTab', 
                prompt: globalPrompt, 
                clipboard: clipboardText 
            });
            console.log("closeTab message sent");
        } catch (error) {
            console.error("Failed to read clipboard contents:", error);
        }
    }
    function handlePastePrompt(request) {
        const provider = request.provider;
        const selectors = request.selectors;
        console.log("Pasting prompt for provider:", provider);
        console.log("Selectors:", selectors);
        
        waitForInputField(selectors.inputSelector, element => {
            console.log("Input element found");
            
            // 2. Assign request.prompt to the global variable
            globalPrompt = request.prompt;
            
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
    }, 25000);

})();
