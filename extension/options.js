// Declare variables to hold the settings
let settings;

// Retrieve settings from storage
chrome.storage.sync.get(null, (items) => {
    console.log("Retrieved settings from storage:", items);
    // Use the settings from storage
    settings = {
        backendUrl: items.backendUrl || '',
        aiProvider: items.aiProvider || '',
        transcriptionMethod: items.transcriptionMethod || '',
        processLocally: items.processLocally || false,
        logConversations: items.logConversations || false,
        providers: items.providers || {}
    };

    console.log("Initialized settings:", settings);

    // Call initializeOptions after retrieving the settings
    initializeOptions();
});

function initializeOptions() {
    console.log("Initializing options");
    const backendUrlInput = document.getElementById('backendUrl');
    const aiProviderSelect = document.getElementById('aiProvider');
    const transcriptionMethodSelect = document.getElementById('transcriptionMethod');
    const processLocallySelect = document.getElementById('processLocally');
    const logConversationsSelect = document.getElementById('logConversations');

    // Check if elements exist before setting values
    if (backendUrlInput) {
        backendUrlInput.value = settings.backendUrl || '';
        console.log("Set backendUrl:", backendUrlInput.value);
    }
    if (aiProviderSelect) {
        aiProviderSelect.value = settings.aiProvider || '';
        console.log("Set aiProvider:", aiProviderSelect.value);
    }
    if (transcriptionMethodSelect) {
        transcriptionMethodSelect.value = settings.transcriptionMethod || '';
        console.log("Set transcriptionMethod:", transcriptionMethodSelect.value);
    }
    if (processLocallySelect) {
        processLocallySelect.value = settings.processLocally.toString();
        console.log("Set processLocally:", processLocallySelect.value);
    }
    if (logConversationsSelect) {
        logConversationsSelect.value = settings.logConversations.toString();
        console.log("Set logConversations:", logConversationsSelect.value);
    }

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

function restoreOptions() {
    console.log("Restoring options");
    chrome.storage.sync.get(null, function(items) {
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
        const fields = ['backendUrl', 'processLocally', 'logConversations'];
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
        });

        // Handle transcriptionMethod separately
        const transcriptionMethodElement = document.getElementById('transcriptionMethod');
        if (transcriptionMethodElement) {
            transcriptionMethodElement.value = items.transcriptionMethod || '';
            console.log(`Restored transcriptionMethod:`, transcriptionMethodElement.value);
        }
    });
}

// Saves options to chrome.storage
function saveOptions() {
    const newSettings = {
        aiProvider: document.getElementById('aiProvider')?.value,
        transcriptionMethod: document.getElementById('transcriptionMethod')?.value,
        processLocally: document.getElementById('processLocally')?.value === 'true',
        logConversations: document.getElementById('logConversations')?.value === 'true',
        backendUrl: document.getElementById('backendUrl')?.value,
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

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Add event listeners when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM content loaded");
    restoreOptions();
    document.getElementById('saveButton')?.addEventListener('click', saveOptions);
});