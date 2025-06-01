// background.js

// Prompt Template String
const PROMPT_TEMPLATE_STRING = `
1. Read the following video transcript carefully, because you'll be asked to perform series of tasks based on them (especially the transcript!):

Channel name: {{channel}}
Video title: {{title}}
View count: {{views}}
Likes count: {{likes}}
Description: {{description}}
Video URL: {{video_url}}
Transcript: 
{{transcript}}

2. The transcript is in the following format: 
[H:MM:SS] transcribed text
where H:MM:SS represents the exact timestamp when the text is spoken in the video (hours:minutes:seconds format).
- Each timestamp shows when that particular segment of speech begins
- Use these timestamps to create precise navigation links in your summary

3. You are an award-winning journalist, you have a reputation for producing informative and unbiased summaries. Your task is to carefully review the video content and extract the crucial facts, presenting them in a clear and organized manner. Prioritize accuracy and objectivity, allowing the information to speak for itself without editorializing. You know many languages and can provide summaries in English (translation from source language is also acceptable).

4. Make a clear distinction between:
a. presented factual and objective data and information
b. personal experience, opinions and subjective information 
c. information presented as a fact, but might need cross-checking
Report all three, but flag them appropriately so the reader knows which is which. If you are unsure or don't have enough information to provide a confident categorization, simply say "I don't know" or "I'm not sure."

5. Use blended summarization technique combining abstractive summarization (70-90%) extractive summarization (10-30%). Adjust this ratio as needed based on the type of content. Endeavor to address the full breadth of the transcript without significant omissions. Make sure the extracted quotes are short, important and impactful to the narrative.

6. Aim for a summary length that is approximately 20% of the full video transcript. For example, if the transcript is 5000 words long, target a summary of roughly 1000 words. Try to cover the video in full without gaps. However, if the transcript is exceptionally long (over 10,000 words):
   a. Focus on providing timestamps that cover the entire content.
   b. Use shorter summaries for each section to maintain a comprehensive overview.
   c. Ensure that the overall structure still captures the main points and flow of the video.

7. Break down the summary into a chain of key sections or topics. Use these to logically structure it, creating an H1 heading for each main point in the chain of reasoning. Follow the natural timeflow of the video.

8. Under each H1 section heading, write 1-3 sentences concisely summarizing the essential information from that section. Aim for an even coverage of the full video.

9. Organize the summary clearly using H2 and H3 subheadings as appropriate to reinforce the logical flow. Utilize bullet points to enhance readability of longer paragraphs or list items. Selectively bold key terms for emphasis. Use blockquotes to highlight longer verbatim quotations.

10. (!IMPORTANT) Generate clickable timestamp links for each mentioned part of the video, key point or quote used. Append them after the relevant text. To calculate the timestamp link follow these steps:

a. Note down the starting point of the relevant part of the video in H:MM:SS format (e.g. 0:14:16) 
b. Convert the timestamp to total seconds: (hours × 3600) + (minutes × 60) + seconds
   Example: 0:14:16 = (0 × 3600) + (14 × 60) + 16 = 0 + 840 + 16 = 856 seconds
c. Append "&t=X" to the video URL, replacing X with the total seconds (e.g. &t=856)
d. Format the full link as: [H:MM:SS]({{video_url}}&t=X) (e.g. [0:14:16]({{video_url}}&t=856))

It is crucial to select precise starting timestamps for the links. For example, consider the following transcript excerpt:

[0:01:10] We train these models to spend more time thinking through problems before they respond, much like a person would.
[0:01:15] Through training, they learn to refine their thinking process, try different strategies and recognize their mistakes.
[0:01:20] In our test, the next model update performs similarly to PhD students on challenging benchmark tasks in physics, chemistry, and biology.
[0:01:29] We also found that it excels in math and coding in a qualifying exam in the International Mathematics Olympiad.

The correct starting timestamp for the quote "In our test, the next model update performs similarly to PhD students" would be [0:01:20], because that is when this text appears in the transcript. Time calculated: (0 × 3600) + (1 × 60) + 20 = 80 seconds, so the link would be [0:01:20]({{video_url}}&t=80)

- If the timestamp you want to highlight is at the middle or the end of the transcript row, you'll have to estimate the time it was spoken:
For example: in the transcript example above to quote "the next model update performs similarly to PhD students on challenging benchmark tasks in physics, chemistry, and biology" the correct starting timestamp would be estimated as [0:01:22], because we add 2 seconds to the start time of the quote to make sure we are not quoting the beginning of the timestamped row.

11. If there are sponsored segments and ADs in the video, note and timestamp them in the summary but don't summarize them.

12. Vary the sentence structures throughout to maintain an engaging narrative flow. Ensure smooth transitions between sentences and sections. Adopt a consistent voice aligned with the original video's tone.

13. Revise the full summary, checking for any unintended bias or editorializing. Aim to neutrally represent the content of the original video. Consider engaging in a feedback loop with a human reviewer to iteratively optimize the summary.

14. Skip any explanations of what you are doing and why, just write the summary. Don't address the receiver of the summary, just write the summary. Don't add notes and explanations in the end.

15. Provide your final video summary, ready for publication. Use all known Markdown operators to present the output.
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

// Also ensure storage is initialized when service worker starts
chrome.storage.sync.get(['providers'], (items) => {
    if (!items.providers || Object.keys(items.providers).length === 0) {
        console.log('Providers not found in storage, initializing with defaults');
        chrome.storage.sync.set({ providers: DEFAULT_SETTINGS.providers }, () => {
            console.log('Default providers initialized');
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

// Fetch YouTube Transcript using DOM extraction
async function fetchYouTubeTranscript(videoId) { 
    sendMessageToContent({ action: 'updateSummaryStatus', status: 'Fetching transcript from YouTube page...' }, true, false);

    try {
        // Get the current YouTube tab
        const tabs = await new Promise(resolve => 
            chrome.tabs.query({ active: true, currentWindow: true }, resolve)
        );
        
        if (!tabs[0] || !tabs[0].url.includes('youtube.com/watch')) {
            return { error: "Not on a YouTube video page." };
        }        // Send message to content script to extract transcript
        const response = await new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'extractTranscript' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Runtime error when extracting transcript:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else if (!response) {
                    console.error('No response received from content script');
                    reject(new Error('No response from content script - make sure you are on a YouTube video page'));
                } else {
                    resolve(response);
                }
            });
        });

        if (response.error) {
            sendMessageToContent({ action: 'updateSummaryStatus', status: response.error }, false, true);
            return { error: response.error };
        }

        if (!response.transcript || response.transcript.trim().length === 0) {
            sendMessageToContent({ action: 'updateSummaryStatus', status: "No transcript found or video has no captions.", isError: true }, false, true);
            return { error: "No transcript found or video has no captions." };
        }

        sendMessageToContent({ action: 'updateSummaryStatus', status: 'Transcript extracted successfully.' }, false, false);
        return { transcript: response.transcript };
    } catch (error) {
        console.error("Error fetching transcript:", error);
        const errorMessage = `Failed to extract transcript: ${error.message || 'Unknown error'}`;
        sendMessageToContent({ action: 'updateSummaryStatus', status: errorMessage }, false, true);
        return { error: errorMessage };
    }
}

// Fetch YouTube Video Details
async function fetchYouTubeVideoDetails(videoId, apiKey) { // apiKey is still needed here
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${apiKey}`;
    console.log(`Fetching video details from: ${apiUrl}`);

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            // Try to get error message from API response if possible
            let apiErrorMsg = `HTTP error ${response.status}`;
            try {
                const errorData = await response.json();
                apiErrorMsg += `: ${errorData.error.message || 'Unknown API error'}`;
            } catch (e) { /* Ignore if error response is not JSON */ }
            console.error(`Error fetching video details: ${apiErrorMsg}`);
            return { error: apiErrorMsg };
        }
        const data = await response.json();
        if (data.items && data.items.length > 0) {
            const snippet = data.items[0].snippet;
            const statistics = data.items[0].statistics;
            const details = {
                title: snippet.title,
                description: snippet.description,
                channelTitle: snippet.channelTitle,
                viewCount: statistics.viewCount,
                likeCount: statistics.likeCount // This can be undefined, handled by consumer
            };
            console.log("Successfully fetched video details:", details);
            return { details };
        } else {
            console.log('No video items found for the given ID.');
            return { error: 'Video not found or no details available.' };
        }
    } catch (error) {
        console.error('Network or unexpected error fetching video details:', error);
        // Differentiate TypeError for specific feedback
        if (error instanceof TypeError && error.message === "Failed to fetch") {
             return { error: "Network error (Failed to fetch). Check connectivity or host permissions." };
        }
        return { error: `Unexpected error fetching details: ${error.message}`.substring(0,150) }; // Keep error concise
    }
}

// Render Prompt Function
function renderPrompt(templateString, data) {
    console.log("renderPrompt called with:", { templateLength: templateString.length, dataKeys: Object.keys(data) });
    
    let prompt = templateString;
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const value = data[key] || 'N/A'; // Ensure we don't replace with undefined/null
            const placeholder = '{{' + key + '}}';
            const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            
            console.log(`Replacing ${placeholder} with: "${value}"`);
            prompt = prompt.replace(regex, value);
        }
    }
    
    // Check if any placeholders remain unreplaced
    const remainingPlaceholders = prompt.match(/\{\{[^}]+\}\}/g);
    if (remainingPlaceholders) {
        console.warn("Unreplaced placeholders found:", remainingPlaceholders);
    }
    
    return prompt;
}

// Generate summary
async function generateSummary(videoUrl) {
    sendMessageToContent({ action: 'updateSummaryStatus', status: 'Starting summary generation...' }, true, false);

    chrome.storage.sync.get(['transcriptionMethod', 'aiProvider', 'providers', 'keepWindowActive'], async function(storageItems) {
        let transcriptionMethod = storageItems.transcriptionMethod; // Store in a mutable variable

        // Check if transcriptionMethod is undefined (primitive) or the literal string "undefined"
        if (typeof transcriptionMethod === 'undefined' || transcriptionMethod === "undefined") {
            console.warn(`Transcription method was '${storageItems.transcriptionMethod}' in storage, defaulting to 'youtube_captions'.`);
            transcriptionMethod = 'youtube_captions'; // Default to the only supported method
        }
        
        const { aiProvider, providers, keepWindowActive } = storageItems;

        // Note: youtubeApiKey is fetched later, conditionally
        // Note: processLocally was removed in a previous step

        const videoId = getVideoId(videoUrl);
        if (!videoId) {
            sendMessageToContent({ action: 'updateSummaryStatus', status: 'Error: Could not extract video ID from URL.' }, false, true);
            return;
        }
        
        let transcript = "";

        // This check should use the potentially corrected 'transcriptionMethod' variable
        if (transcriptionMethod !== 'youtube_captions') {
            sendMessageToContent({ action: 'updateSummaryStatus', status: `Error: Transcription method "${transcriptionMethod}" is not supported for client-side processing.` }, false, true);
            console.error(`Unsupported transcriptionMethod found: ${transcriptionMethod}`);
            return; 
        }

        // Now we are sure transcriptionMethod is 'youtube_captions'
        // sendMessageToContent({ action: 'updateSummaryStatus', status: 'Fetching YouTube captions...' }, true, false); // Message is now inside fetchYouTubeTranscript
        const transcriptResponse = await fetchYouTubeTranscript(videoId); // youtubeApiKey removed

            if (transcriptResponse.error) {
                // Error message is already sent from fetchYouTubeTranscript
                // sendMessageToContent({ action: 'updateSummaryStatus', status: `Error fetching transcript: ${transcriptResponse.error}` }, false, true);
                return;
            }
            transcript = transcriptResponse.transcript;
            // sendMessageToContent({ action: 'updateSummaryStatus', status: `Transcript fetched. Length: ${transcript.length}. Preparing prompt...` }, true, false);
        
        // The else block for unsupported transcriptionMethod is now handled above.

        if (!transcript || transcript.trim().length === 0) {
             sendMessageToContent({ action: 'updateSummaryStatus', status: 'Error: Transcript is empty, cannot generate summary.' }, false, true);
             return;
        }

        // Conditionally Fetch Video Details
        let videoDetails = { title: 'N/A', channelTitle: 'N/A', viewCount: 'N/A', likeCount: 'N/A', description: 'N/A' }; // Default structure
        const apiKeyItems = await new Promise(resolve => chrome.storage.sync.get(['youtubeApiKey'], resolve));
        const youtubeApiKey = apiKeyItems.youtubeApiKey;

        if (youtubeApiKey) {
            sendMessageToContent({ action: 'updateSummaryStatus', status: 'API key found. Fetching video details...' }, true, false);
            const videoDetailsResponse = await fetchYouTubeVideoDetails(videoId, youtubeApiKey);
            if (videoDetailsResponse.details) {
                videoDetails = videoDetailsResponse.details;
                sendMessageToContent({ action: 'updateSummaryStatus', status: 'Video details fetched.' }, false, false);
            } else {
                // Log the error but don't stop the process. Proceed with transcript-only.
                console.warn('Failed to fetch video details with provided API key:', videoDetailsResponse.error);
                sendMessageToContent({ action: 'updateSummaryStatus', status: 'Could not fetch video details. Proceeding with transcript only.' }, false, true);
                // videoDetails remains the default structure
            }
        } else {
            sendMessageToContent({ action: 'updateSummaryStatus', status: 'No API key found. Proceeding with transcript only.' }, false, false);
            // videoDetails remains the default structure
        }
          sendMessageToContent({ action: 'updateSummaryStatus', status: 'Preparing prompt...' }, true, false);
        
        // Debug video details
        console.log("Video details object:", videoDetails);
        console.log("Video details keys:", Object.keys(videoDetails));
        console.log("Title:", videoDetails.title);
        console.log("Channel:", videoDetails.channelTitle);
        
        // Prepare data for prompt template
        const promptData = {
            title: videoDetails.title,
            channel: videoDetails.channelTitle, // Corrected from channel
            views: videoDetails.viewCount,      // Corrected from viewCount
            likes: videoDetails.likeCount || 'N/A',
            description: videoDetails.description,
            video_url: videoUrl,
            transcript: transcript
        };
        
        // Debug prompt data
        console.log("Prompt data object:", promptData);
        console.log("Prompt data keys:", Object.keys(promptData));
        
        // Render the prompt
        const promptForAI = renderPrompt(PROMPT_TEMPLATE_STRING, promptData);
        
        console.log("Prepared prompt for AI:", promptForAI.substring(0, 500) + "..."); // Log beginning of prompt

        // Always open the AI provider with the constructed prompt
        sendMessageToContent({ action: 'updateSummaryStatus', status: 'Opening AI provider to generate summary...' }, true, false);
        openAIProviderAndPastePrompt(promptForAI, videoUrl);
    });
}

// Open AI provider and paste prompt
function openAIProviderAndPastePrompt(prompt, videoUrl) {
    chrome.storage.sync.get(['aiProvider', 'providers', 'keepWindowActive'], function(items) {
        const provider = items.aiProvider;
        
        // Check if providers object exists and initialize if needed
        if (!items.providers) {
            console.warn('Providers not found in storage, using default settings');
            items.providers = DEFAULT_SETTINGS.providers;
        }
        
        // Check if specific provider settings exist
        if (!items.providers[provider]) {
            console.error(`Provider settings not found for '${provider}'. Available providers:`, Object.keys(items.providers));
            sendMessageToContent({ action: 'updateSummaryStatus', status: `Error: Provider '${provider}' is not configured. Please check your extension options.` }, false, true);
            return;
        }
        
        const providerSettings = items.providers[provider];
        const keepWindowActive = items.keepWindowActive;
          chrome.windows.getCurrent({}, (currentWindow) => {
            const width = 80;
            const height = 60;
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
                if (chrome.runtime.lastError) {
                    console.error('Error creating window:', chrome.runtime.lastError);
                    sendMessageToContent({ action: 'updateSummaryStatus', status: 'Error: Failed to create AI provider window' }, false, true);
                    return;
                }
                
                if (!window || !window.tabs || !window.tabs[0]) {
                    console.error('Error: No tabs in created window');
                    sendMessageToContent({ action: 'updateSummaryStatus', status: 'Error: Failed to access AI provider tab' }, false, true);
                    return;
                }
                
                const tab = window.tabs[0];
                newTabId = tab.id;
                
        // Start monitoring for window close
        startWindowCloseMonitoring(tab.id, provider);
        console.log('Started window close monitoring for provider:', provider, 'tabId:', tab.id);

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
                    if (tabId === tab.id && info.status === 'complete') {                        // Remove the listener to avoid multiple calls
                        chrome.tabs.onUpdated.removeListener(listener);
                          // Wait a bit more to ensure the content script is fully loaded
                        setTimeout(() => {
                            // Send status update to the original YouTube tab (not the AI provider tab)
                            sendMessageToContent({ action: 'updateSummaryStatus', status: `Pasting prompt and generating summary on ${provider}...` }, true, false);
                              // Debug: Log what we're about to send
                            console.log("🔍 DEBUG: About to send message to AI provider tab");
                            console.log("🔍 Prompt length:", prompt.length);
                            console.log("🔍 Prompt preview (first 1000 chars):", prompt.substring(0, 1000));
                            console.log("🔍 Video details section in prompt:", prompt.includes('<video_details>') ? 'FOUND' : 'NOT FOUND');
                            console.log("🔍 AI Provider tab ID:", tab.id);
                            console.log("🔍 AI Provider URL:", providerSettings.url);
                            
                            // Check specifically for the populated content
                            const videoDetailsMatch = prompt.match(/<video_details>([\s\S]*?)<\/video_details>/);
                            if (videoDetailsMatch) {
                                console.log("🔍 Video details content length:", videoDetailsMatch[1].length);
                                console.log("🔍 Video details content preview:", videoDetailsMatch[1].substring(0, 500));
                            } else {
                                console.log("🔍 ERROR: No video_details section found in prompt!");
                            }
                            
                            // First, test if content script is available on the AI provider tab
                            chrome.tabs.sendMessage(tab.id, { action: 'test' }, (testResponse) => {
                                if (chrome.runtime.lastError) {
                                    console.error('🔍 Content script not available on AI provider tab:', chrome.runtime.lastError);
                                    
                                    // Try to inject content script manually
                                    chrome.scripting.executeScript({
                                        target: { tabId: tab.id },
                                        files: ['marked.js', 'content.js']
                                    }, () => {
                                        if (chrome.runtime.lastError) {
                                            console.error('🔍 Failed to inject content script:', chrome.runtime.lastError);
                                            sendMessageToContent({ action: 'updateSummaryStatus', status: 'Error: Failed to load content script on AI provider' }, false, true);
                                        } else {
                                            console.log('🔍 Content script injected manually, retrying in 2 seconds...');
                                            setTimeout(() => sendPastePromptMessage(), 2000);
                                        }
                                    });
                                } else {
                                    console.log('🔍 Content script is available on AI provider tab');
                                    sendPastePromptMessage();
                                }
                            });
                              function sendPastePromptMessage() {
                                console.log('🔍 Sending pastePrompt message to AI provider tab:', tab.id);
                                chrome.tabs.sendMessage(tab.id, {
                                action: 'pastePrompt', 
                                prompt: prompt, 
                                videoUrl: videoUrl,
                                provider: provider,
                                selectors: providerSettings
                            }, (response) => {
                                if (chrome.runtime.lastError) {
                                    console.error('🔍 Error sending pastePrompt message:', chrome.runtime.lastError);
                                    sendMessageToContent({ action: 'updateSummaryStatus', status: 'Error: Failed to paste prompt' }, false, true);
                                } else if (response && response.success) {
                                    console.log('🔍 Prompt pasted successfully to AI provider');
                                    sendMessageToContent({ action: 'updateSummaryStatus', status: 'Summary generation in progress...' }, true, false);
                                } else {
                                    console.error('Failed to paste prompt');
                                    sendMessageToContent({ action: 'updateSummaryStatus', status: 'Error: Failed to paste prompt' }, false, true);
                                }
                            });
                            }
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
    MIN_CONTENT_LENGTH: 1500,   // Reduced from 3000 to catch responses sooner
    INITIAL_DELAY: 5000,        // Wait 5s before starting to check content
    CHECK_INTERVAL: 2000,       // Check every 2s to be less aggressive
    STABILITY_DELAY: 6000,      // Content must be stable for 6s
    MAX_WAIT_TIME: 360000       // Maximum 360s wait time
};

// Simplified window monitoring function
function startWindowCloseMonitoring(tabId, provider) {
    let lastContent = '';
    let stableStartTime = null;
    let monitoringInterval = null;
    
    // Get provider settings to pass to content script
    chrome.storage.sync.get(['providers'], (items) => {
        const providerSettings = items.providers && items.providers[provider];
        if (!providerSettings) {
            console.error('Provider settings not found for monitoring:', provider);
            return;
        }        // Set maximum wait time
        const maxWaitTimeout = setTimeout(() => {
            console.log('Maximum wait time reached, forcing cleanup');
            cleanup('Maximum wait time reached');
        }, WINDOW_SETTINGS.MAX_WAIT_TIME);// Start checking after initial delay
        setTimeout(() => {
            console.log('Starting content monitoring after initial delay');
            sendMessageToContent({ 
                action: 'updateSummaryStatus', 
                status: 'Monitoring AI response for completion...' 
            }, true, false);
            
            monitoringInterval = setInterval(() => {
                checkContent();
            }, WINDOW_SETTINGS.CHECK_INTERVAL);
        }, WINDOW_SETTINGS.INITIAL_DELAY);

        // Main content checking function
        function checkContent() {
            chrome.tabs.sendMessage(tabId, { 
                action: 'getContent',
                provider: provider,
                selectors: providerSettings
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('Error getting content:', chrome.runtime.lastError.message);
                    return;
                }
                
                if (!response) {
                    console.log('No response from getContent message');
                    return;
                }
                
                if (response.error) {
                    console.error('Content script error:', response.error);
                    return;
                }

                const currentContent = response.content;
                console.log('Content monitoring - length:', currentContent.length, 'min required:', WINDOW_SETTINGS.MIN_CONTENT_LENGTH);
                  // Check if content meets minimum length and hasn't changed
                if (currentContent.length > WINDOW_SETTINGS.MIN_CONTENT_LENGTH) {
                    if (currentContent === lastContent) {
                        // Start or continue stability timer
                        if (!stableStartTime) {
                            stableStartTime = Date.now();
                            console.log('Content stability timer started');
                            sendMessageToContent({ 
                                action: 'updateSummaryStatus', 
                                status: 'AI response detected, checking for completion...' 
                            }, true, false);                        } else if (Date.now() - stableStartTime >= WINDOW_SETTINGS.STABILITY_DELAY) {
                            console.log('Content stable for required time, closing window');
                            cleanup('Content stable', currentContent);
                        }
                    } else {
                        // Content changed, reset stability timer
                        if (stableStartTime) {
                            console.log('Content changed, resetting stability timer');
                        }
                        stableStartTime = null;
                        lastContent = currentContent;
                    }
                } else {
                    // Content too short, keep waiting
                    if (currentContent.length > 0) {
                        console.log('Content too short, waiting for more...', currentContent.length);
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
                console.log('Forwarding content to YouTube tabs, length:', content.length);
                // Forward content to YouTube tabs
                forwardMessageToYouTubeTabs({ 
                    action: 'divContent', 
                    content: content 
                });
                
                // Add a small delay to ensure content is displayed before closing window
                setTimeout(() => {
                    closeWindow();
                }, 500);
            } else {
                // Close immediately if no content to forward
                closeWindow();
            }
            
            function closeWindow() {
                // Check if tab still exists before trying to close it
                chrome.tabs.get(tabId, (tab) => {
                    if (chrome.runtime.lastError) {
                        console.log('Tab already closed or doesn\'t exist:', tabId);
                    } else {
                        console.log('Closing tab directly:', tabId);
                        // Call closeNewTab directly instead of sending a message
                        closeNewTab();
                    }
                });
            }
        }
    });
}

