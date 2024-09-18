// background.js

// Constants
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
            if (waitingTimeout) {
                clearTimeout(waitingTimeout);
                waitingTimeout = null;
            }
            break;
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
        const transcriptionMethod = items.transcriptionMethod || 'whisper';
        const processLocally = items.processLocally || false;
        
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
    let body = { 
        url: videoUrl, 
        transcriptionMethod: transcriptionMethod,
        processLocally: processLocally
    };
    
    if (transcriptionMethod.startsWith('whisper')) {
        const [method, model] = transcriptionMethod.split(':');
        body = { ...body, transcriptionMethod: method, whisperModel: model };
    }

    return fetch('http://192.168.100.2:5000/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
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
        const provider = items.aiProvider || DEFAULT_AI_PROVIDER;
        const providerSettings = items.providers && items.providers[provider] 
            ? items.providers[provider] 
            : DEFAULT_PROVIDER_SETTINGS[provider];
        
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

