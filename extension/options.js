document.addEventListener('DOMContentLoaded', initializeOptions);

function initializeOptions() {
    restoreOptions();
    document.getElementById('save').addEventListener('click', saveOptions);
    document.getElementById('aiProvider').addEventListener('change', handleProviderChange);
    document.getElementById('processLocally').addEventListener('change', handleProcessLocallyChange);
    // document.getElementById('testSelectors').addEventListener('click', testSelectors);
    
    // Dynamically generate provider settings
    generateProviderSettings();
}

function generateProviderSettings() {
    const aiProviderSelect = document.getElementById('aiProvider');
    const aiProviderSection = document.getElementById('aiProviderSection');

    for (const provider in DEFAULT_PROVIDER_SETTINGS) {
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
    showProviderSettings(this.value);
}

function showProviderSettings(provider) {
    document.querySelectorAll('.provider-settings').forEach(el => el.classList.remove('active'));
    const providerSettings = document.getElementById(`${provider}Settings`);
    if (providerSettings) {
        providerSettings.classList.add('active');
    } else {
        console.error(`Provider settings not found for ${provider}`);
    }
}

function handleProcessLocallyChange() {
    const processLocally = document.getElementById('processLocally').value === 'true';
    const aiProviderSection = document.getElementById('aiProviderSection');
    aiProviderSection.style.display = processLocally ? 'none' : 'block';
}

// Load saved options
chrome.storage.sync.get(['aiProvider', 'providers'], function(items) {
    if (items.aiProvider) {
        document.getElementById('aiProvider').value = items.aiProvider;
        showProviderSettings(items.aiProvider);
    }

    if (items.providers) {
        for (const provider in items.providers) {
            for (const setting in items.providers[provider]) {
                const inputId = `${provider}${capitalizeFirstLetter(setting)}`;
                document.getElementById(inputId).value = items.providers[provider][setting];
            }
        }
    }
});

// Saves options to chrome.storage
function saveOptions() {
    const aiProvider = document.getElementById('aiProvider')?.value;
    const transcriptionMethod = document.getElementById('transcriptionMethod')?.value;
    const processLocally = document.getElementById('processLocally')?.value === 'true';
    const backendUrl = document.getElementById('backendUrl').value;

    if (!aiProvider || !transcriptionMethod) {
        console.error('Required elements not found');
        return;
    }

    const settings = {
        transcriptionMethod: transcriptionMethod,
        processLocally: processLocally,
        backendUrl: backendUrl
    };

    if (!processLocally) {
        settings.aiProvider = aiProvider;
        settings.providers = {};

        for (const provider in DEFAULT_PROVIDER_SETTINGS) {
            settings.providers[provider] = {};
            for (const setting in DEFAULT_PROVIDER_SETTINGS[provider]) {
                const value = document.getElementById(`${provider}${capitalizeFirstLetter(setting)}`)?.value;
                if (value) {
                    settings.providers[provider][setting] = value;
                }
            }
            // Always save confirmButtonSelector, even if it's empty
            const confirmButtonSelector = document.getElementById(`${provider}ConfirmButtonSelector`)?.value;
            settings.providers[provider].confirmButtonSelector = confirmButtonSelector;
        }

        // Save custom provider settings
        settings.providers.custom = {
            url: document.getElementById('customUrl')?.value,
            inputSelector: document.getElementById('customInputSelector')?.value,
            buttonSelector: document.getElementById('customButtonSelector')?.value,
            confirmButtonSelector: document.getElementById('customConfirmButtonSelector')?.value,
            resultSelector: document.getElementById('customResultSelector')?.value
        };
    }

    chrome.storage.sync.set(settings, () => {
        const status = document.getElementById('status');
        if (status) {
            status.textContent = 'Options saved.';
            setTimeout(() => {
                status.textContent = '';
            }, 3000);
        }
    });

    // Remove the automatic testing of selectors
    // testSelectors();
}

// Restores select box state using the preferences stored in chrome.storage.
function restoreOptions() {
    chrome.storage.sync.get({
        aiProvider: DEFAULT_AI_PROVIDER,
        providers: DEFAULT_PROVIDER_SETTINGS,
        transcriptionMethod: DEFAULT_TRANSCRIPTION_METHOD,
        processLocally: DEFAULT_PROCESS_LOCALLY,
        backendUrl: DEFAULT_BACKEND_URL
    }, (items) => {
        if (items.processLocally !== undefined) {
            document.getElementById('processLocally').value = items.processLocally.toString();
            handleProcessLocallyChange();
        } else {
            document.getElementById('processLocally').value = DEFAULT_PROCESS_LOCALLY.toString();
        }

        if (items.aiProvider) {
            document.getElementById('aiProvider').value = items.aiProvider;
            showProviderSettings(items.aiProvider);
        } else {
            showProviderSettings(DEFAULT_AI_PROVIDER);
        }

        const providers = items.providers || DEFAULT_PROVIDER_SETTINGS;
        for (const provider in providers) {
            for (const setting in providers[provider]) {
                const inputId = `${provider}${capitalizeFirstLetter(setting)}`;
                const element = document.getElementById(inputId);
                if (element) {
                    element.value = providers[provider][setting];
                }
            }
            // Always restore confirmButtonSelector, even if it's undefined
            const confirmButtonSelector = providers[provider].confirmButtonSelector;
            document.getElementById(`${provider}ConfirmButtonSelector`).value = confirmButtonSelector || '';
        }

        // Restore custom provider settings if they exist
        if (providers.custom) {
            document.getElementById('customUrl').value = providers.custom.url || '';
            document.getElementById('customInputSelector').value = providers.custom.inputSelector || '';
            document.getElementById('customButtonSelector').value = providers.custom.buttonSelector || '';
            document.getElementById('customConfirmButtonSelector').value = providers.custom.confirmButtonSelector || '';
            document.getElementById('customResultSelector').value = providers.custom.resultSelector || '';
        }

        if (items.transcriptionMethod) {
            document.getElementById('transcriptionMethod').value = items.transcriptionMethod;
        } else {
            document.getElementById('transcriptionMethod').value = DEFAULT_TRANSCRIPTION_METHOD;
        }

        document.getElementById('backendUrl').value = items.backendUrl || DEFAULT_BACKEND_URL;
    });
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function testSelectors() {
    const aiProvider = document.getElementById('aiProvider').value;
    const providerSettings = {};
    
    ['url', 'inputSelector', 'buttonSelector', 'confirmButtonSelector', 'resultSelector'].forEach(setting => {
        const inputId = `${aiProvider}${capitalizeFirstLetter(setting)}`;
        providerSettings[setting] = document.getElementById(inputId).value;
    });

    chrome.tabs.create({ url: providerSettings.url, active: false }, (tab) => {
        // Wait for the page to load before running the test
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: testSelectorsOnPage,
                    args: [providerSettings]
                }, (results) => {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError);
                        updateSelectorStatus('Error testing selectors', true);
                    } else {
                        const result = results[0].result;
                        updateSelectorStatus(result.message, result.hasError);
                    }
                    // Close the tab after 2 seconds
                    setTimeout(() => chrome.tabs.remove(tab.id), 2000);
                });
            }
        });
    });
}

function testSelectorsOnPage(settings) {
    const results = {
        urlValid: false,
        inputSelector: false,
        buttonSelector: false,
        confirmButtonSelector: true, // Assume true initially
        resultSelector: true // Assume true initially
    };

    const messages = [];

    // Validate URL
    const expectedHostname = new URL(settings.url).hostname;
    if (window.location.hostname !== expectedHostname) {
        messages.push(`Unexpected page loaded. Expected ${expectedHostname}, got ${window.location.hostname}`);
    } else {
        results.urlValid = true;
    }

    // Test input selector
    const inputElement = document.querySelector(settings.inputSelector);
    if (inputElement) {
        results.inputSelector = true;
    } else {
        messages.push("Input selector not found");
    }

    // Test button selector
    const buttonElement = document.querySelector(settings.buttonSelector);
    if (buttonElement) {
        results.buttonSelector = true;
    } else {
        messages.push("Button selector not found");
    }

    // For confirm button selector, consider it valid if it's empty or a valid selector
    if (settings.confirmButtonSelector && settings.confirmButtonSelector.trim() !== '') {
        try {
            document.querySelector(settings.confirmButtonSelector);
        } catch (e) {
            results.confirmButtonSelector = false;
            messages.push("Confirm button selector is invalid");
        }
    }

    // Test result selector
    try {
        document.querySelector(settings.resultSelector);
    } catch (e) {
        results.resultSelector = false;
        messages.push("Result selector is invalid");
    }

    if (messages.length === 0) {
        return { 
            message: 'All selectors appear to be valid. Note: Confirm button and result selectors could not be fully tested.',
            hasError: false 
        };
    } else {
        return {
            message: `The following issues were found: ${messages.join(', ')}. Please update the selectors.`,
            hasError: true
        };
    }
}

function updateSelectorStatus(message, isError) {
    const statusElement = document.getElementById('selectorStatus');
    statusElement.textContent = message;
    statusElement.style.color = isError ? 'red' : 'green';
}