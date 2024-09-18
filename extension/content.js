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

    // Inform the background script that the content script is ready
    chrome.runtime.sendMessage({ action: 'contentScriptReady' });

    // Reset the timer for closing the tab
    function resetTimer() {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            chrome.runtime.sendMessage({ action: 'closeTab' });
            console.log("closeTab message sent");
            observer.disconnect(); // Stop observing once the tab is closed
        }, 6000); // 6 seconds
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

    // Wait for a button to appear and click it
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
                // Continue checking
                setTimeout(checkButton, interval);
            }
        };
        
        checkButton();
    }

    // Wait for the input field to be ready
    function waitForInputField(selector, callback) {
      const element = document.querySelector(selector);
      if (element) {
        callback(element);
      } else {
        setTimeout(() => waitForInputField(selector, callback), 250);
      }
    }

    // Global variables for docked div
    let dockedDiv = null;
    let summaryDiv = null;

    // Create the docked div
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

          // Get a reference to the summary div
          summaryDiv = document.getElementById('summary');
        })
        .catch(error => console.error('Error loading popup.html:', error));
    }

    // Remove the docked div
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

    // Initialize popup functionality
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
          updateSummaryDiv('Initiating summary generation...', true);
          chrome.runtime.sendMessage({ action: 'generateSummary' }, (response) => {
              if (chrome.runtime.lastError) {
                  console.error(chrome.runtime.lastError);
              } else {
                  console.log('Generate summary message sent:', response);
              }
          });
      } else {
          updateSummaryDiv('Please open a YouTube video page to generate a summary.', false, true);
          generateSummaryBtn.style.display = 'block';
      }
    }

    function handleAnchorClick(event) {
      if (event.target.tagName === 'A') {
        event.preventDefault();
        const url = new URL(event.target.href);
        const timeParam = url.searchParams.get('t');
        chrome.runtime.sendMessage({
          action: 'seekToTimeEx',
          time: timeParam
        });
      }
    }

    function updateSummaryDiv(content, isLoading = false, isError = false) {
      const summaryDiv = document.getElementById('summary');
      if (summaryDiv) {
        const iconHTML = isError ? createErrorIcon() : (isLoading ? createSpinner() : '');
        let contentHTML;
        
        if (isLoading || isError) {
          contentHTML = createContentHTML(content);
        } else {
          // Parse markdown when it's not a loading or error state
          contentHTML = marked.parse(content);
          // Enhance the summary content
          contentHTML = enhanceSummaryContent(contentHTML);
        }
        
        const styleHTML = createStyleHTML();

        summaryDiv.innerHTML = styleHTML + iconHTML + contentHTML;
      }
    }

    function enhanceSummaryContent(contentHTML) {
      // Add custom styling to timestamps
      contentHTML = contentHTML.replace(/(\d+:\d+:\d+)/g, '<span class="timestamp">$1</span>');

      // Wrap key points
      contentHTML = contentHTML.replace(/(<p>)(.*?)(<\/p>)/g, '$1<span class="key-point">$2</span>$3');

      // Add anchor links to headings
      contentHTML = contentHTML.replace(/(<h\d>)(.*?)(<\/h\d>)/g, '$1<a href="#" class="heading-anchor">$2</a>$3');

      return contentHTML;
    }

    // Simulate a click on an element
    function simulateClick(element) {
      const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      element.dispatchEvent(event);
    }

    // Click buttons once they become available
    function clickButtonsOnceAvailable(exactClassName, num = 0) {
      const observer = new MutationObserver((mutationsList, observer) => {
        for(let mutation of mutationsList) {
          if(mutation.addedNodes.length) {
            const button = document.getElementsByClassName(exactClassName)[num];
            if(button && !button.disabled) {
              console.log(`Button found`);
              setTimeout(() => {
                simulateClick(button);
              }, 1000);
              observer.disconnect();
            }
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });
    }

    // Message listener
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      //console.log("Message received in content script:", request);
      
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
          const player = document.querySelector('video');
          if (player) {
            const timeInSeconds = parseInt(request.time, 10);
            player.currentTime = timeInSeconds;
            player.play();
          } else {
            console.error('YouTube player not found or seekTo not available.');
          }
          break;
        case 'pastePrompt':
          const provider = request.provider;
          const selectors = request.selectors;
          console.log("Pasting prompt for provider:", provider);
          console.log("Selectors:", selectors);
          
          waitForInputField(selectors.inputSelector, element => {
            console.log("Input element found");
            if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
              element.value = request.prompt;
              element.dispatchEvent(new Event('input', { bubbles: true }));
            } else if (element.isContentEditable) {
              element.textContent = request.prompt;
                    // As a last resort, try to modify innerHTML
              if (element.innerHTML !== undefined) {
                element.innerHTML = request.prompt;
              }
              element.dispatchEvent(new Event('input', { bubbles: true }));
              // Trigger a 'change' event as well, as some applications might listen for this
              element.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
              console.error("Unsupported input element type");
            }
            
            // Handle button clicks for all providers
            if (selectors.confirmButtonSelector) {
              // If there's a confirm button, click the main button first, then the confirm button
              waitForButton(selectors.buttonSelector, () => {
                setTimeout(() => {
                  waitForButton(selectors.confirmButtonSelector, null, 50, 500, true);
                }, 1000);
              });
            } else {
              // For providers without a confirm button, wait for the main button to become clickable
              const checkButtonInterval = setInterval(() => {
                const button = document.querySelector(selectors.buttonSelector);
                if (button && !button.disabled) {
                  clearInterval(checkButtonInterval);
                  button.click();
                  console.log("Button clicked for provider:", provider);
                }
              }, 1000);
            }
          });
          console.log("end of paste prompt");
          sendResponse({ success: true });
          break;
        case 'updateSummaryContent':
          updateSummaryContent(request.content, request.isLoading, request.isError);
          break;
        case 'divContent':
          // Parse markdown for divContent as well
          updateSummaryContent(marked.parse(request.content), request.isLoading, request.isError);
          break;
      }

      // Send an immediate response
      sendResponse({ success: true });

      // Return false to indicate we've handled the message synchronously
      return false;
    });

    // Update the observer for different AI providers
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
                            //console.log("Content changed, sending update");
                            chrome.runtime.sendMessage({ action: 'divContent', content: divContent });
                            previousDivContent = divContent;
                            mutationCount++;
                            lastMutationTime = Date.now();
                            resetTimer();

                            // Notify that content is being updated
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

    // Set up the observer when the content script loads
    let currentObserver = null;

    function setupObserverForCurrentSite() {
        chrome.storage.sync.get(['aiProvider', 'providers'], function(items) {
            const currentHostname = window.location.hostname;
            let provider = null;
            let selectors = null;

            // Check for custom provider first
            if (items.aiProvider === 'custom' && items.providers && items.providers.custom) {
                try {
                    const customUrl = new URL(items.providers.custom.url);
                    if (currentHostname === customUrl.hostname) {
                        provider = 'custom';
                        selectors = items.providers.custom;
                    }
                } catch (error) {
                    console.error('Invalid custom URL:', error);
                }
            }

            // If not custom, check for known providers
            if (!provider) {
                Object.keys(DEFAULT_PROVIDER_SETTINGS).forEach(key => {
                    if (key !== 'custom' && currentHostname.includes(new URL(DEFAULT_PROVIDER_SETTINGS[key].url).hostname)) {
                        provider = key;
                        selectors = items.providers && items.providers[key] ? items.providers[key] : DEFAULT_PROVIDER_SETTINGS[key];
                    }
                });
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
        });
    }

    // Call setupObserverForCurrentSite when the content script loads
    setupObserverForCurrentSite();

    // Listen for messages from the background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        // ... existing message handling code ...

        if (request.action === 'pastePrompt') {
            // After pasting the prompt and clicking the button, set up the observer again
            setTimeout(setupObserverForCurrentSite, 1000); // Wait a bit for the page to update
        }
    });

    // Add this to your content script
    setInterval(() => {
        chrome.runtime.sendMessage({ action: 'contentScriptAlive' });
    }, 25000);

    function isKnownProvider() {
      const knownProviders = Object.keys(DEFAULT_PROVIDER_SETTINGS).filter(key => key !== 'custom');
      return knownProviders.some(provider => {
        try {
          const providerUrl = new URL(DEFAULT_PROVIDER_SETTINGS[provider].url);
          return window.location.hostname.includes(providerUrl.hostname);
        } catch (error) {
          console.error(`Invalid URL for provider ${provider}:`, error);
          return false;
        }
      });
    }

    function isCustomProvider() {
      return new Promise((resolve) => {
        chrome.storage.sync.get(['aiProvider', 'providers'], function(items) {
          if (items.aiProvider === 'custom' && items.providers && items.providers.custom && items.providers.custom.url) {
            try {
              const customUrl = new URL(items.providers.custom.url);
              resolve(window.location.hostname === customUrl.hostname);
            } catch (error) {
              console.error('Invalid custom URL:', error);
              resolve(false);
            }
          } else {
            resolve(false);
          }
        });
      });
    }

    // Wrap the main content script logic in an async function
    async function initializeContentScript() {
      if (await isCustomProvider()) {
        console.log("Content script loaded for custom provider");
        setupObserverForCurrentSite();
      } else if (isKnownProvider()) {
        console.log("Content script loaded for known provider");
        setupObserverForCurrentSite();
      } else if (window.location.hostname.includes('youtube.com')) {
        console.log("Current site is YouTube");
        // Handle YouTube-specific setup here if needed
      } else {
        console.log("Current site does not match any known provider or YouTube");
      }
    }

    // Call the initialization function
    initializeContentScript();
})();
