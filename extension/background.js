// background.js
// Default settings
const DEFAULT_SETTINGS = {
    backendUrl: 'http://localhost:5000',
    aiProvider: 'you',
    transcriptionMethod: 'youtube',
    processLocally: false,
    providers: {
        you: {
            url: 'https://you.com/?chatMode=custom',
            inputSelector: '#search-input-textarea',
            buttonSelector: 'button[type="submit"]',
            confirmButtonSelector: '[data-eventactionname="file_upload_modal_attach"]', 
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

// Timeout for fetch requests
const TIMEOUT = 600000; // 10 minutes, for example

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
            closeNewTab();
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

// Close the new tab
function closeNewTab() {
    if (newTabId !== null) {
        chrome.tabs.remove(newTabId);
        newTabId = null;
    }
}

// Seek to time in YouTube tab
function seekToTimeInYouTubeTab(time) {
    chrome.tabs.query({ url: "https://www.youtube.com/*" }, (tabs) => {
        tabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, { action: 'seekToTimeEx', time: time });
        });
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
                generateSummary(videoUrl);
            } else {
                sendMessageToContent({ action: 'updateSummaryStatus', status: 'Error: Not a valid YouTube video page' }, false, true);
            }
        } else {
            console.error("No active tab found.");
            sendMessageToContent({ action: 'updateSummaryStatus', status: 'Error: No active tab found' }, false, true);
        }
    });
}

// Generate summary
function generateSummary(videoUrl) {
    sendMessageToContent({ action: 'updateSummaryStatus', status: 'Generating transcript...' }, true, false);

    chrome.storage.sync.get(['transcriptionMethod', 'processLocally'], function(items) {
        const transcriptionMethod = items.transcriptionMethod;
        const processLocally = items.processLocally;
        
        const controller = new AbortController();
        const fetchPromise = createFetchPromise(videoUrl, controller, transcriptionMethod, processLocally);
        const timeoutPromise = createTimeoutPromise(controller);

        Promise.race([fetchPromise, timeoutPromise])
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                console.log('Transcription completed successfully');
                if (processLocally) {
                    // If processing locally, send the response directly to the content script
                    const summary = data.response.trim();
                    const videoId = new URL(videoUrl).searchParams.get('v');
                    const anchoredSummary = `[**Video Summary**](https://www.youtube.com/watch?v=${videoId})\n\n${summary}`;
                    sendMessageToContent({ 
                        action: 'updateSummaryContent', 
                        content: anchoredSummary 
                    }, false, false);
                } else {
                    // If not processing locally, open AI provider and paste prompt
                    sendMessageToContent({ action: 'updateSummaryStatus', status: 'Opening AI provider to generate summary...' }, true, false);
                    openAIProviderAndPastePrompt(data.prompt, videoUrl);
                }
            })
            .catch(error => {
                console.error('Error in fetch:', error);
                handleFetchError(error);
            });

        setupKeepAliveInterval(fetchPromise);
    });
}

function createFetchPromise(videoUrl, controller, transcriptionMethod, processLocally) {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['backendUrl'], function(items) {
            const backendUrl = items.backendUrl;
            
            let body = { 
                url: videoUrl, 
                transcriptionMethod: transcriptionMethod,
                processLocally: processLocally
            };
            
            if (transcriptionMethod.startsWith('whisper')) {
                const [method, model] = transcriptionMethod.split(':');
                body = { ...body, transcriptionMethod: method, whisperModel: model };
            }

            fetch(`${backendUrl}/transcribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            }).then(resolve).catch(reject);
        });
    });
}

function createTimeoutPromise(controller) {
    return new Promise((_, reject) => {
        setTimeout(() => {
            controller.abort();
            reject(new Error('Fetch request timed out'));
        }, TIMEOUT);
    });
}

function setupKeepAliveInterval(fetchPromise) {
    const keepAliveInterval = setInterval(() => {
        console.log('Keeping service worker alive');
        chrome.runtime.sendMessage({ action: 'keepAlive' });
    }, 25000);

    fetchPromise.finally(() => {
        clearInterval(keepAliveInterval);
    });
}

// Open AI provider and paste prompt
function openAIProviderAndPastePrompt(prompt, videoUrl) {
    chrome.storage.sync.get(['aiProvider', 'providers'], function(items) {
        const provider = items.aiProvider;
        const providerSettings = items.providers[provider];
        
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

// Handle fetch error
function handleFetchError(error) {
    console.error('Error in fetch:', error);
    if (error.name === 'AbortError' || error.message === 'Fetch request timed out') {
        sendMessageToContent({ action: 'updateSummaryStatus', status: 'Error: Transcribe request timed out' }, false, true);
    } else {
        sendMessageToContent({ action: 'updateSummaryStatus', status: 'Error: Transcribe API call failed' }, false, true);
    }
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
            files: ['constants.js', 'marked.js', 'content.js']
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

