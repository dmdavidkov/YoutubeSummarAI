// Declare variables to hold the settings
let settings;

// Retrieve settings from storage
chrome.storage.sync.get(null, (items) => {
    // Use the settings from storage
    settings = {
        backendUrl: items.backendUrl || '',
        aiProvider: items.aiProvider || '',
        transcriptionMethod: items.transcriptionMethod || '',
        processLocally: items.processLocally || false,
        providers: items.providers || {}
    };

    // Call initializeOptions after retrieving the settings
    initializeOptions();
});

function initializeOptions() {
    const backendUrlInput = document.getElementById('backendUrl');
    const aiProviderSelect = document.getElementById('aiProvider');
    const transcriptionMethodSelect = document.getElementById('transcriptionMethod');
    const processLocallySelect = document.getElementById('processLocally');

    // Check if elements exist before setting values
    if (backendUrlInput) backendUrlInput.value = settings.backendUrl || '';
    if (aiProviderSelect) aiProviderSelect.value = settings.aiProvider || '';
    if (transcriptionMethodSelect) transcriptionMethodSelect.value = settings.transcriptionMethod || '';
    if (processLocallySelect) processLocallySelect.value = settings.processLocally.toString();

    // Generate provider settings
    generateProviderSettings();

    // Add event listeners for form submission and changes
    const saveButton = document.getElementById('saveButton');
    if (saveButton) saveButton.addEventListener('click', saveOptions);
    if (aiProviderSelect) aiProviderSelect.addEventListener('change', handleProviderChange);
    if (processLocallySelect) processLocallySelect.addEventListener('change', handleProcessLocallyChange);

    // Initial toggle of provider fields
    handleProviderChange();
    handleProcessLocallyChange();
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
    showProviderSettings(aiProvider);
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

function handleProcessLocallyChange() {
    const processLocally = document.getElementById('processLocally').value === 'true';
    const aiProviderSection = document.getElementById('aiProviderSection');
    aiProviderSection.style.display = processLocally ? 'none' : 'block';
}

// Load saved options
chrome.storage.sync.get(['aiProvider', 'providers'], function(items) {
    const aiProviderElement = document.getElementById('aiProvider');
    if (aiProviderElement && items.aiProvider) {
        aiProviderElement.value = items.aiProvider;
        showProviderSettings(items.aiProvider);
    }

    if (items.providers) {
        for (const provider in items.providers) {
            for (const setting in items.providers[provider]) {
                const inputId = `${provider}${capitalizeFirstLetter(setting)}`;
                const element = document.getElementById(inputId);
                if (element) {
                    element.value = items.providers[provider][setting];
                }
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

    if (!transcriptionMethod) {
        console.error('Required elements not found');
        return;
    }

    const newSettings = {
        aiProvider: aiProvider,
        transcriptionMethod: transcriptionMethod,
        processLocally: processLocally,
        backendUrl: backendUrl,
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
        const status = document.getElementById('status');
        if (status) {
            status.textContent = 'Options saved.';
            setTimeout(() => {
                status.textContent = '';
            }, 3000);
        }
    });
}

// Restores select box state using the preferences stored in chrome.storage.
function restoreOptions() {
    chrome.storage.sync.get(null, (items) => {
        const processLocallyElement = document.getElementById('processLocally');
        if (processLocallyElement) {
            processLocallyElement.value = (items.processLocally || false).toString();
            handleProcessLocallyChange();
        }

        const aiProviderElement = document.getElementById('aiProvider');
        if (aiProviderElement) {
            aiProviderElement.value = items.aiProvider || '';
            handleProviderChange(); // Show the correct provider settings
        }

        const providers = items.providers || {};
        for (const provider in providers) {
            for (const setting in providers[provider]) {
                const inputId = `${provider}${capitalizeFirstLetter(setting)}`;
                const element = document.getElementById(inputId);
                if (element) {
                    element.value = providers[provider][setting] || '';
                }
            }
            // Always restore confirmButtonSelector, even if it's undefined
            const confirmButtonSelector = providers[provider].confirmButtonSelector;
            const confirmButtonElement = document.getElementById(`${provider}ConfirmButtonSelector`);
            if (confirmButtonElement) {
                confirmButtonElement.value = confirmButtonSelector || '';
            }
        }

        const transcriptionMethodElement = document.getElementById('transcriptionMethod');
        if (transcriptionMethodElement) {
            transcriptionMethodElement.value = items.transcriptionMethod || '';
        }

        const backendUrlElement = document.getElementById('backendUrl');
        if (backendUrlElement) {
            backendUrlElement.value = items.backendUrl || '';
        }
    });
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Add event listeners when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get(null, (items) => {
        settings = items;
        restoreOptions();
    });
});