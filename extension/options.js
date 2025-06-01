// Declare variables to hold the settings
let settings;

// Retrieve settings from storage
chrome.storage.sync.get(null, (items) => {
    console.log("Retrieved settings from storage:", items);    // Use the settings from storage
    settings = {
        youtubeApiKey: items.youtubeApiKey || '',
        aiProvider: items.aiProvider || 'you',
        transcriptionMethod: items.transcriptionMethod || 'youtube_captions',
        keepWindowActive: items.keepWindowActive || false,
        providers: items.providers || {
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

    console.log("Initialized settings:", settings);

    // Call initializeOptions after retrieving the settings
    initializeOptions();
});

function initializeOptions() {
    console.log("Initializing options");
    const youtubeApiKeyInput = document.getElementById('youtubeApiKey');
    const aiProviderSelect = document.getElementById('aiProvider');
    const transcriptionMethodSelect = document.getElementById('transcriptionMethod');
    const keepWindowActiveSelect = document.getElementById('keepWindowActive');

    // Check if elements exist before setting values
    if (youtubeApiKeyInput) {
        youtubeApiKeyInput.value = settings.youtubeApiKey || '';
        console.log("Set youtubeApiKey:", youtubeApiKeyInput.value);
    }
    if (aiProviderSelect) {
        aiProviderSelect.value = settings.aiProvider || '';
        console.log("Set aiProvider:", aiProviderSelect.value);
    }
    if (transcriptionMethodSelect) {
        transcriptionMethodSelect.value = settings.transcriptionMethod || 'youtube_captions';
        console.log("Set transcriptionMethod:", transcriptionMethodSelect.value);
    }
    if (keepWindowActiveSelect) {
        keepWindowActiveSelect.value = settings.keepWindowActive.toString();
        console.log("Set keepWindowActive:", keepWindowActiveSelect.value);
    }

    // Generate provider settings
    generateProviderSettings();

    // Add event listeners for form submission and changes
    const saveButton = document.getElementById('saveButton');
    if (saveButton) saveButton.addEventListener('click', saveOptions);
    if (aiProviderSelect) aiProviderSelect.addEventListener('change', handleProviderChange);

    // Initial toggle of provider fields
    handleProviderChange();
}

function generateProviderSettings() {
    const aiProviderSelect = document.getElementById('aiProvider');
    const aiProviderSection = document.getElementById('aiProviderSection');

    // Clear existing options and settings
    aiProviderSelect.innerHTML = '';
    aiProviderSection.innerHTML = '';

    // Add a default option
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Select a provider';
    aiProviderSelect.appendChild(defaultOption);

    for (const provider in settings.providers) {
        // Add option to select
        const option = document.createElement('option');
        option.value = provider;
        option.textContent = provider.charAt(0).toUpperCase() + provider.slice(1);
        aiProviderSelect.appendChild(option);

        // Create settings div
        const settingsDiv = document.createElement('div');
        settingsDiv.id = `${provider}Settings`;
        settingsDiv.className = 'provider-settings';
        
        let settingsHTML = `<h2>${option.textContent} Settings</h2>`;

        // Generate input fields for settings
        const allSettings = ['url', 'inputSelector', 'buttonSelector', 'confirmButtonSelector', 'resultSelector'];
        for (const setting of allSettings) {
            settingsHTML += `
                <div class="input-group">
                    <label for="${provider}${capitalizeFirstLetter(setting)}">${capitalizeFirstLetter(setting)}:</label>
                    <input type="text" id="${provider}${capitalizeFirstLetter(setting)}" name="${provider}${capitalizeFirstLetter(setting)}">
                </div>
            `;
        }

        settingsDiv.innerHTML = settingsHTML;
        aiProviderSection.appendChild(settingsDiv);
    }
}

function handleProviderChange() {
    const aiProvider = document.getElementById('aiProvider').value;
    if (aiProvider) {
        showProviderSettings(aiProvider);
        showSelectorStatus(`${aiProvider} provider selected`, 'success', 2000);
    }
}

function showProviderSettings(provider) {
    document.querySelectorAll('.provider-settings').forEach(el => el.style.display = 'none');
    if (provider) {
        const providerSettings = document.getElementById(`${provider}Settings`);
        if (providerSettings) {
            providerSettings.style.display = 'block';
        } else {
            console.warn(`Provider settings not found for ${provider}`);
        }
    }
}

function restoreOptions() {
    console.log("Restoring options");
    showStatus('Loading settings...', 'loading', 0);
    
    chrome.storage.sync.get(null, function(items) {
        if (chrome.runtime.lastError) {
            showStatus('Error loading settings: ' + chrome.runtime.lastError.message, 'error');
            return;
        }

        console.log("Retrieved items for restoring:", items);
        const aiProviderElement = document.getElementById('aiProvider');
        if (aiProviderElement && items.aiProvider) {
            aiProviderElement.value = items.aiProvider;
            showProviderSettings(items.aiProvider);
            console.log("Restored aiProvider:", items.aiProvider);
        }

        if (items.providers) {
            for (const provider in items.providers) {
                for (const setting in items.providers[provider]) {
                    const inputId = `${provider}${capitalizeFirstLetter(setting)}`;
                    const element = document.getElementById(inputId);
                    if (element) {
                        element.value = items.providers[provider][setting];
                        console.log(`Restored ${provider} ${setting}:`, element.value);
                    }
                }
            }
        }

        // Set values for other fields
        const fields = ['youtubeApiKey']; // Removed 'processLocally' and 'logConversations'
        fields.forEach(field => {
            const element = document.getElementById(field);
            if (element) {
                if (element.tagName === 'SELECT') {
                    element.value = items[field] === true ? 'true' : 'false';
                } else {
                    element.value = items[field] || '';
                }
                console.log(`Restored ${field}:`, element.value);
            }
        });        // Handle transcriptionMethod and keepWindowActive separately
        const transcriptionMethodElement = document.getElementById('transcriptionMethod');
        if (transcriptionMethodElement) {
            transcriptionMethodElement.value = items.transcriptionMethod || 'youtube_captions';
            console.log(`Restored transcriptionMethod:`, transcriptionMethodElement.value);
        }

        const keepWindowActiveElement = document.getElementById('keepWindowActive');
        if (keepWindowActiveElement) {
            keepWindowActiveElement.value = items.keepWindowActive === true ? 'true' : 'false';
            console.log(`Restored keepWindowActive:`, keepWindowActiveElement.value);
        }

        showStatus('Settings loaded successfully!', 'success', 2000);
    });
}

function showStatus(message, type = 'success', duration = 3000) {
    const status = document.getElementById('status');
    if (!status) return;

    // Clear any existing classes and add new ones
    status.className = `${type} show`;
    status.textContent = message;

    // Clear the status message after the specified duration
    if (duration) {
        setTimeout(() => {
            status.className = '';
            status.textContent = '';
        }, duration);
    }
}

function showSelectorStatus(message, type = 'success', duration = 3000) {
    const status = document.getElementById('selectorStatus');
    if (!status) return;

    status.className = `${type} show`;
    status.textContent = message;

    if (duration) {
        setTimeout(() => {
            status.className = '';
            status.textContent = '';
        }, duration);
    }
}

// Saves options to chrome.storage
function saveOptions() {
    showStatus('Saving settings...', 'loading', 0);

    const newSettings = {
        aiProvider: document.getElementById('aiProvider')?.value,
        transcriptionMethod: document.getElementById('transcriptionMethod')?.value,
        youtubeApiKey: document.getElementById('youtubeApiKey')?.value,
        keepWindowActive: document.getElementById('keepWindowActive')?.value === 'true',
        providers: {}
    };

    for (const provider in settings.providers) {
        newSettings.providers[provider] = {};
        for (const setting in settings.providers[provider]) {
            const value = document.getElementById(`${provider}${capitalizeFirstLetter(setting)}`)?.value;
            if (value !== undefined) {
                newSettings.providers[provider][setting] = value;
            }
        }
    }

    chrome.storage.sync.set(newSettings, () => {
        if (chrome.runtime.lastError) {
            showStatus('Error saving options: ' + chrome.runtime.lastError.message, 'error');
        } else {
            showStatus('Settings saved successfully!', 'success');
        }
    });
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Add event listeners when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM content loaded");
    restoreOptions();
    document.getElementById('saveButton')?.addEventListener('click', saveOptions);
});