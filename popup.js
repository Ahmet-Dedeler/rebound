// JavaScript for popup.html
console.log("Popup script loaded.");

document.addEventListener('DOMContentLoaded', () => {
  const updatePreferencesButton = document.getElementById('updatePreferences');
  const warningsEnabledCheckbox = document.getElementById('warningsEnabled');
  const extensionPausedCheckbox = document.getElementById('extensionPaused');
  const preferredKeywordsDiv = document.getElementById('preferredKeywords');
  const nonPreferredKeywordsDiv = document.getElementById('nonPreferredKeywords');

  // Load stored preferences and state
  chrome.storage.sync.get(['preferredContent', 'nonPreferredContent', 'warningsEnabled', 'extensionPaused'], (data) => {
    preferredKeywordsDiv.textContent = data.preferredContent ? `Preferred: ${data.preferredContent.join(', ')}` : 'Not set';
    nonPreferredKeywordsDiv.textContent = data.nonPreferredContent ? `Non-Preferred: ${data.nonPreferredContent.join(', ')}` : 'Not set';
    warningsEnabledCheckbox.checked = data.warningsEnabled !== undefined ? data.warningsEnabled : true;
    extensionPausedCheckbox.checked = data.extensionPaused || false;
  });

  // Event listener for opening options page
  if (updatePreferencesButton) {
    updatePreferencesButton.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  // Event listener for warning toggle
  if (warningsEnabledCheckbox) {
    warningsEnabledCheckbox.addEventListener('change', (event) => {
      chrome.storage.sync.set({ warningsEnabled: event.target.checked });
    });
  }

  // Event listener for pause toggle
  if (extensionPausedCheckbox) {
    extensionPausedCheckbox.addEventListener('change', (event) => {
      chrome.storage.sync.set({ extensionPaused: event.target.checked });
    });
  }
}); 