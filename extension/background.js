// background.js

// Prompt Template String
const PROMPT_TEMPLATE_STRING = `
Generate a comprehensive summary of the YouTube video with the following details:

Video Title: {{title}}
Channel: {{channel}}
View Count: {{views}}
Likes: {{likes}}

Video Description:
{{description}}

Full Video Transcript:
{{transcript}}

The summary should be well-structured, concise, and capture the key points and main topics discussed in the video. Use Markdown formatting for headings, lists, and emphasis where appropriate.
`;

// Default settings
const DEFAULT_SETTINGS = {
    aiProvider: 'you',
    transcriptionMethod: 'youtube_captions', // Updated default
    providers: {
        you: {
            url: 'https://you.com/?chatMode=custom',
            inputSelector: '#search-input-textarea',
            buttonSelector: 'button[type="submit"]',
            confirmButtonSelector: '[data-eventactionname="save_sources_modal"]', 
            resultSelector: '[data-testid="youchat-answer-turn-0"]'
        },
        perplexity: {
            url: 'https://www.perplexity.ai/',
            inputSelector: '[placeholder="Ask anything..."]',
            buttonSelector: '[aria-label="Submit"]',
            resultSelector: '.prose'
        },
        phind: {
            url: 'https://www.phind.com/',
            inputSelector: 'div:nth-child(1) > textarea',
            buttonSelector: 'button:nth-child(7)',
            resultSelector: '#__next > div > div > div.col-lg-12.sidebar > main > div > div.container-xl > div.row > div.col-12.mt-5 > div:nth-child(1) > div'
        },
        gemini: {
            url: 'https://aistudio.google.com/app/prompts/new_chat',
            inputSelector: 'body > app-root > div > div > div > div > span > ms-prompt-switcher > ms-chunk-editor > section > footer > div.input-wrapper > div.text-wrapper > ms-chunk-input > section > ms-text-chunk > textarea',
            buttonSelector: 'body > app-root > div > div > div > div > span > ms-prompt-switcher > ms-chunk-editor > section > footer > div.input-wrapper > div:nth-child(3) > run-button > button',
            resultSelector: 'ms-chat-turn:nth-child(2) > div > div.prompt-container'
        },
        chatgpt: {
            url: 'https://chatgpt.com',
            inputSelector: '#prompt-textarea',
            buttonSelector: '[data-testid="send-button"]',
            confirmButtonSelector: '',
            resultSelector: '[data-message-author-role="assistant"]'
        },
        custom: {
            url: '',
            inputSelector: '',
            buttonSelector: '',
            confirmButtonSelector: '',
            resultSelector: ''
        }
    }
};

// Set default settings on install 
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS), (items) => {
            const newSettings = { ...DEFAULT_SETTINGS, ...items };

            chrome.storage.sync.set(newSettings, () => {
                console.log('Default settings have been set or updated.');
            });
        });
    }
});

// Keep the service worker alive
chrome.alarms.create("keepAlive", { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "keepAlive") {
        console.log("Alarm triggered to keep the service worker alive");
    }
});

// Track the new tab ID
let newTabId = null;

let waitingTimeout = null;

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    //console.log("Message received in background script:", request);

    switch (request.action) {
        case 'divContent':
            forwardMessageToYouTubeTabs(request);
            break;
        case 'closeTab':
            closeNewTab(); // No longer needs prompt/clipboard
            break;
        case 'seekToTimeEx':
            seekToTimeInYouTubeTab(request.time);
            break;
        case 'generateSummary':
        case 'requestGenerateSummary':
            handleSummaryGeneration();
            break;
        case 'selectorError':
            forwardMessageToYouTubeTabs({ action: 'updateSummaryStatus', status: request.message, isError: true });
            break;
        case 'selectorWaiting':
            handleSelectorWaiting(request);
            break;
        case 'selectorFound':
        case 'contentUpdating':
            if (waitingTimeout) {
                clearTimeout(waitingTimeout);
                waitingTimeout = null;
            }
            break;
        case 'openOptions':
            chrome.runtime.openOptionsPage();
            break;
        case 'closeExtension':
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0] && tabs[0].url && tabs[0].url.includes("youtube.com/watch")) {
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'toggleDockedDiv' });
                }
            });
            break;
    }

    // Send an immediate response for synchronous handling
    sendResponse({ received: true });
    
    // Return false to indicate synchronous handling
    return false;
});

function handleSelectorWaiting(request) {
    let waitingMessage = request.message;
    let timeoutMessage = '';
    
    if (request.isConfirmButton) {
        timeoutMessage = `If it takes too long for the confirm button selector "${request.selector}" to become active, consider it might be wrong/outdated.`;
    } else if (request.isResultSelector) {
        timeoutMessage = `If it takes too long for the result selector "${request.selector}" to become active, consider it might be wrong/outdated.`;
    } else {
        timeoutMessage = `If it takes too long for the selector "${request.selector}" to become active, consider it might be wrong/outdated.`;
    }

    // Clear any existing timeout
    if (waitingTimeout) {
        clearTimeout(waitingTimeout);
    }

    // Send the initial waiting message
    forwardMessageToYouTubeTabs({ 
        action: 'updateSummaryStatus', 
        status: waitingMessage, 
        isLoading: true, 
        isError: false,
        selector: request.selector,
        isConfirmButton: request.isConfirmButton,
        isResultSelector: request.isResultSelector
    });
    
    // Set a new timeout for the additional message
    waitingTimeout = setTimeout(() => {
        forwardMessageToYouTubeTabs({
            action: 'updateSummaryStatus',
            status: timeoutMessage,
            isLoading: false,
            isError: true
        });
    }, 10000); // Display after 10 seconds of waiting
}

// Forward message to YouTube tabs
function forwardMessageToYouTubeTabs(message) {
    chrome.tabs.query({ url: "https://www.youtube.com/*" }, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, message);
        });
    });
}

// Replace the existing closeNewTab function with this improved version
function closeNewTab() { // Removed prompt, content parameters
    if (newTabId !== null) {
        chrome.tabs.remove(newTabId, () => {
            if (chrome.runtime.lastError) {
                console.error('Error closing tab:', chrome.runtime.lastError);
                setTimeout(() => chrome.tabs.remove(newTabId), 500);
            }
            newTabId = null;
        });
    }
}

// Replace the existing seekToTimeInYouTubeTab function
function seekToTimeInYouTubeTab(time) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab && activeTab.url && activeTab.url.includes("youtube.com/watch")) {
            console.log('Seeking to time in active YouTube tab:', time);
            chrome.tabs.sendMessage(activeTab.id, { action: 'seekToTimeEx', time: time });
        } else {
            console.log('Active tab is not a YouTube video page');
        }
    });
}

// Handle summary generation
function handleSummaryGeneration() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            const currentTab = tabs[0];
            const videoUrl = currentTab.url;
            if (videoUrl && videoUrl.startsWith("https://www.youtube.com")) {
                console.log(videoUrl);
                generateSummary(videoUrl); // No await here, generateSummary is async
            } else {
                sendMessageToContent({ action: 'updateSummaryStatus', status: 'Error: Not a valid YouTube video page' }, false, true);
            }
        } else {
            console.error("No active tab found.");
            sendMessageToContent({ action: 'updateSummaryStatus', status: 'Error: No active tab found' }, false, true);
        }
    });
}

// Helper function to extract video ID
function getVideoId(url) {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'www.youtube.com' || urlObj.hostname === 'youtube.com') {
            return urlObj.searchParams.get('v');
        } else if (urlObj.hostname === 'youtu.be') {
            return urlObj.pathname.slice(1);
        }
    } catch (e) {
        console.error("Error parsing URL:", e);
    }
    return null;
}

// Fetch YouTube Transcript
async function fetchYouTubeTranscript(videoId, apiKey) {
    console.log(`Starting to fetch transcript for videoId: ${videoId}`);
    sendMessageToContent({ action: 'updateSummaryStatus', status: 'Fetching YouTube captions list...' }, true, false);

    const listUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;

    try {
        const listResponse = await fetch(listUrl);
        if (!listResponse.ok) {
            const errorText = await listResponse.text();
            console.error('Error fetching caption list:', listResponse.status, errorText);
            return { error: `Failed to list captions: ${listResponse.status}. ${errorText}` };
        }
        const listData = await listResponse.json();
        console.log("Caption list data:", listData);

        if (!listData.items || listData.items.length === 0) {
            console.log('No caption tracks found.');
            return { error: "No caption tracks found for this video." };
        }

        let chosenTrack = null;
        const userLang = chrome.i18n.getUILanguage ? chrome.i18n.getUILanguage().split('-')[0] : 'en';

        // Prioritize user's language
        chosenTrack = listData.items.find(track => track.snippet.language === userLang);
        // Then English
        if (!chosenTrack) {
            chosenTrack = listData.items.find(track => track.snippet.language === 'en');
        }
        // Then any other language
        if (!chosenTrack) {
            chosenTrack = listData.items[0];
        }

        if (!chosenTrack) {
            // This case should ideally not be reached if listData.items is not empty
            console.log('Could not select a suitable caption track.');
            return { error: "No suitable caption track found after filtering." };
        }
        
        console.log(`Selected caption track: ${chosenTrack.id} (${chosenTrack.snippet.language})`);
        sendMessageToContent({ action: 'updateSummaryStatus', status: `Found caption track (${chosenTrack.snippet.language}). Downloading...` }, true, false);

        const downloadUrl = `https://www.googleapis.com/youtube/v3/captions/${chosenTrack.id}?key=${apiKey}&tfmt=srv3`;
        const transcriptResponse = await fetch(downloadUrl);

        if (!transcriptResponse.ok) {
            const errorText = await transcriptResponse.text();
            console.error('Error fetching transcript:', transcriptResponse.status, errorText);
            return { error: `Failed to download caption track: ${transcriptResponse.status}. ${errorText}` };
        }

        const transcriptText = await transcriptResponse.text();
        console.log("Raw transcript (SRV3):", transcriptText.substring(0, 500)); // Log first 500 chars

        // Simple SRV3 parser
        let concatenatedText = "";
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(transcriptText, "text/xml");
            const textElements = xmlDoc.getElementsByTagName("text");
            for (let i = 0; i < textElements.length; i++) {
                concatenatedText += textElements[i].textContent + " ";
            }
            concatenatedText = concatenatedText.trim().replace(/\s+/g, ' '); // Normalize spaces
            console.log("Parsed transcript length:", concatenatedText.length);
             if (concatenatedText.length === 0 && transcriptText.length > 0) {
                console.warn("SRV3 parsing resulted in empty text, but raw transcript was not empty. There might be an issue with the SRV3 format or parser.");
                // Fallback or more robust parsing might be needed here.
                // For now, we'll return what we have, or an error if it's truly empty.
                if (transcriptText.includes("<text")) { // Check if it looks like SRV3
                     return { error: "Failed to parse SRV3 transcript text content." };
                }
            }
        } catch (e) {
            console.error("Error parsing SRV3 XML:", e);
            return { error: "Error parsing SRV3 XML." };
        }
        
        sendMessageToContent({ action: 'updateSummaryStatus', status: 'Transcript processed.' }, false, false);
        return { transcript: concatenatedText };

    } catch (error) {
        console.error('Error in fetchYouTubeTranscript:', error);
        return { error: error.message || "An unknown error occurred while fetching transcript." };
    }
}

// Fetch YouTube Video Details
async function fetchYouTubeVideoDetails(videoId, apiKey) {
    console.log(`Starting to fetch video details for videoId: ${videoId}`);
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${apiKey}`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error fetching video details:', response.status, errorText);
            return { error: `Failed to fetch video details: ${response.status}. ${errorText}` };
        }
        const data = await response.json();
        console.log("Video details data:", data);

        if (data.items && data.items.length > 0) {
            const item = data.items[0];
            const details = {
                title: item.snippet.title,
                description: item.snippet.description,
                channelTitle: item.snippet.channelTitle,
                viewCount: item.statistics.viewCount,
                likeCount: item.statistics.likeCount // Can be undefined if not available
            };
            console.log("Successfully fetched video details:", details);
            return { details };
        } else {
            console.log('No video details found for this videoId.');
            return { error: "No video details found for this video." };
        }
    } catch (error) {
        console.error('Error in fetchYouTubeVideoDetails:', error);
        return { error: error.message || "An unknown error occurred while fetching video details." };
    }
}

// Render Prompt Function
function renderPrompt(templateString, data) {
    let prompt = templateString;
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            prompt = prompt.replace(new RegExp('{{' + key + '}}', 'g'), data[key]);
        }
    }
    return prompt;
}

// Generate summary
async function generateSummary(videoUrl) {
    sendMessageToContent({ action: 'updateSummaryStatus', status: 'Starting summary generation...' }, true, false);

    chrome.storage.sync.get(['youtubeApiKey', 'transcriptionMethod', 'processLocally', 'aiProvider', 'providers', 'keepWindowActive'], async function(items) {
        const { youtubeApiKey, transcriptionMethod, processLocally, aiProvider, providers, keepWindowActive } = items;

        if (!youtubeApiKey) {
            sendMessageToContent({ action: 'updateSummaryStatus', status: 'Error: YouTube Data API Key not set. Please set it in the extension options.' }, false, true);
            return;
        }

        const videoId = getVideoId(videoUrl);
        if (!videoId) {
            sendMessageToContent({ action: 'updateSummaryStatus', status: 'Error: Could not extract video ID from URL.' }, false, true);
            return;
        }
        
        let transcript = "";

        if (transcriptionMethod === 'youtube_captions') {
            sendMessageToContent({ action: 'updateSummaryStatus', status: 'Fetching YouTube captions...' }, true, false);
            const transcriptResponse = await fetchYouTubeTranscript(videoId, youtubeApiKey);

            if (transcriptResponse.error) {
                sendMessageToContent({ action: 'updateSummaryStatus', status: `Error fetching transcript: ${transcriptResponse.error}` }, false, true);
                return;
            }
            transcript = transcriptResponse.transcript;
            // sendMessageToContent({ action: 'updateSummaryStatus', status: `Transcript fetched. Length: ${transcript.length}. Preparing prompt...` }, true, false);
        } else {
            // This part can be used for other transcription methods in the future
            sendMessageToContent({ action: 'updateSummaryStatus', status: `Error: Transcription method "${transcriptionMethod}" is not supported for client-side processing.` }, false, true);
            return;
        }

        if (!transcript || transcript.trim().length === 0) {
             sendMessageToContent({ action: 'updateSummaryStatus', status: 'Error: Transcript is empty, cannot generate summary.' }, false, true);
             return;
        }

        // Fetch video details
        sendMessageToContent({ action: 'updateSummaryStatus', status: 'Fetching video details...' }, true, false);
        const videoDetailsResponse = await fetchYouTubeVideoDetails(videoId, youtubeApiKey);

        if (videoDetailsResponse.error) {
            sendMessageToContent({ action: 'updateSummaryStatus', status: `Error fetching video details: ${videoDetailsResponse.error}` }, false, true);
            return;
        }
        const videoDetails = videoDetailsResponse.details;
        console.log("Fetched video details:", videoDetails);
        sendMessageToContent({ action: 'updateSummaryStatus', status: 'Video details fetched. Preparing prompt...' }, true, false);

        // Prepare data for prompt template
        const promptData = {
            title: videoDetails.title,
            channel: videoDetails.channelTitle,
            views: videoDetails.viewCount,
            likes: videoDetails.likeCount || 'N/A',
            description: videoDetails.description,
            transcript: transcript
        };
        
        // Render the prompt
        const promptForAI = renderPrompt(PROMPT_TEMPLATE_STRING, promptData);
        
        console.log("Prepared prompt for AI:", promptForAI.substring(0, 300) + "..."); // Log beginning of prompt

        // Always open the AI provider with the constructed prompt
        sendMessageToContent({ action: 'updateSummaryStatus', status: 'Opening AI provider to generate summary...' }, true, false);
        openAIProviderAndPastePrompt(promptForAI, videoUrl);
    });
}

// Open AI provider and paste prompt
function openAIProviderAndPastePrompt(prompt, videoUrl) {
    chrome.storage.sync.get(['aiProvider', 'providers', 'keepWindowActive'], function(items) {
        const provider = items.aiProvider;
        const providerSettings = items.providers[provider];
        const keepWindowActive = items.keepWindowActive;
        
        chrome.windows.getCurrent({}, (currentWindow) => {
            const width = 10;
            const height = 10;
            const left = currentWindow.left + currentWindow.width - width - 10;
            const top = currentWindow.top + currentWindow.height - height - 10;

            chrome.windows.create({
                url: providerSettings.url,
                type: 'popup',
                width: width,
                height: height,
                left: Math.max(left, 0),
                top: Math.max(top, 0),
                focused: true
            }, (window) => {
                const tab = window.tabs[0];
                newTabId = tab.id;
                
                // Start monitoring for window close
                startWindowCloseMonitoring(tab.id, provider);

                // Only set up the focus listener if keepWindowActive is true
                if (keepWindowActive) {
                    // Set up a listener for the focus change event
                    const focusListener = (windowId) => {
                        if (windowId !== window.id) {
                            // If the focus changed to a different window, try to focus our window again
                            chrome.windows.update(window.id, {focused: true}, () => {
                                if (chrome.runtime.lastError) {
                                    console.error('Error focusing window:', chrome.runtime.lastError);
                                }
                            });
                        }
                    };

                    chrome.windows.onFocusChanged.addListener(focusListener);

                    // Set up a listener to remove the focus listener when the window is closed
                    chrome.windows.onRemoved.addListener(function windowRemovedListener(removedWindowId) {
                        if (removedWindowId === window.id) {
                            chrome.windows.onFocusChanged.removeListener(focusListener);
                            chrome.windows.onRemoved.removeListener(windowRemovedListener);
                        }
                    });
                }

                // Wait for the tab to finish loading
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (tabId === tab.id && info.status === 'complete') {
                        // Remove the listener to avoid multiple calls
                        chrome.tabs.onUpdated.removeListener(listener);
                        
                        // Wait a bit more to ensure the content script is fully loaded
                        setTimeout(() => {
                            sendMessageToContent({ action: 'updateSummaryStatus', status: `Pasting prompt and generating summary on ${provider}...` }, true, false);
                            chrome.tabs.sendMessage(tab.id, { 
                                action: 'pastePrompt', 
                                prompt: prompt, 
                                videoUrl: videoUrl,
                                provider: provider,
                                selectors: providerSettings
                            }, (response) => {
                                if (chrome.runtime.lastError) {
                                    console.error('Error sending message:', chrome.runtime.lastError);
                                    sendMessageToContent({ action: 'updateSummaryStatus', status: 'Error: Failed to paste prompt' }, false, true);
                                } else if (response && response.success) {
                                    console.log('Prompt pasted successfully');
                                    sendMessageToContent({ action: 'updateSummaryStatus', status: 'Summary generation in progress...' }, true, false);
                                } else {
                                    console.error('Failed to paste prompt');
                                    sendMessageToContent({ action: 'updateSummaryStatus', status: 'Error: Failed to paste prompt' }, false, true);
                                }
                            });
                        }, 1000); // Wait for 1 second after the page is loaded
                    }
                });
            });
        });
    });
}

// Send message to content script
function sendMessageToContent(message, isLoading = false, isError = false) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, { ...message, isLoading, isError });
        }
    });
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    if (tab.url && tab.url.includes("youtube.com/watch")) {
        chrome.tabs.sendMessage(tab.id, { action: 'toggleDockedDiv' });
    } else {
        console.error("Not a YouTube video page.");
    }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    injectContentScriptForCustomProvider(tab);
  }
});

// Handle tab activation
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    injectContentScriptForCustomProvider(tab);
  });
});

// Add this function to the background script
function injectContentScriptForCustomProvider(tab) {
  chrome.storage.sync.get(['aiProvider', 'providers'], function(items) {
    if (items.aiProvider === 'custom' && items.providers && items.providers.custom) {
      try {
        const customUrl = new URL(items.providers.custom.url);
        if (tab.url.includes(customUrl.hostname)) {
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['marked.js', 'content.js']
          }, () => {
            if (chrome.runtime.lastError) {
              console.error('Error injecting content script:', chrome.runtime.lastError);
            } else {
              console.log('Content script injected for custom provider');
            }
          });
        }
      } catch (error) {
        console.error('Invalid custom URL:', error);
      }
    }
  });
}

// Add this function to handle clipboard operations
async function copyToClipboardInBackground(text) {
    // Create a temporary textarea element
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    
    try {
        // Select and copy the text
        textarea.select();
        document.execCommand('copy');
        return true;
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        return false;
    } finally {
        document.body.removeChild(textarea);
    }
}

// Replace the window state tracking object with simpler settings
const WINDOW_SETTINGS = {
    MIN_CONTENT_LENGTH: 3000,
    INITIAL_DELAY: 15000,     // Wait 2s before starting to check content
    CHECK_INTERVAL: 1000,    // Check every 1s
    STABILITY_DELAY: 3000,   // Content must be stable for 3s
    MAX_WAIT_TIME: 180000    // Maximum 60s wait time
};

// Simplified window monitoring function
function startWindowCloseMonitoring(tabId, provider) {
    let lastContent = '';
    let stableStartTime = null;
    let monitoringInterval = null;

    // Set maximum wait time
    const maxWaitTimeout = setTimeout(() => {
        cleanup('Maximum wait time reached');
    }, WINDOW_SETTINGS.MAX_WAIT_TIME);

    // Start checking after initial delay
    setTimeout(() => {
        monitoringInterval = setInterval(() => {
            checkContent();
        }, WINDOW_SETTINGS.CHECK_INTERVAL);
    }, WINDOW_SETTINGS.INITIAL_DELAY);

    // Main content checking function
    function checkContent() {
        chrome.tabs.sendMessage(tabId, { 
            action: 'getContent',
            provider: provider
        }, (response) => {
            if (chrome.runtime.lastError || !response) {
                console.log('Error getting content:', chrome.runtime.lastError);
                return;
            }

            const currentContent = response.content;
            
            // Check if content meets minimum length and hasn't changed
            if (currentContent.length > WINDOW_SETTINGS.MIN_CONTENT_LENGTH) {
                if (currentContent === lastContent) {
                    // Start or continue stability timer
                    if (!stableStartTime) {
                        stableStartTime = Date.now();
                    } else if (Date.now() - stableStartTime >= WINDOW_SETTINGS.STABILITY_DELAY) {
                        cleanup('Content stable', currentContent);
                    }
                } else {
                    // Content changed, reset stability timer
                    stableStartTime = null;
                    lastContent = currentContent;
                }
            }
        });
    }

    // Cleanup function
    function cleanup(reason, content = null) {
        console.log('Closing window:', reason);
        clearInterval(monitoringInterval);
        clearTimeout(maxWaitTimeout);

        if (content) {
            // Forward content to YouTube tabs
            forwardMessageToYouTubeTabs({ 
                action: 'divContent', 
                content: content 
            });
        }

        // Send message to self to close the tab via the message listener
        // This ensures consistent handling through closeNewTab()
        chrome.runtime.sendMessage({ action: 'closeTab' });
    }
}

