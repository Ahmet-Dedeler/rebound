// JavaScript for popup.html
console.log("Popup script loaded.");

document.addEventListener('DOMContentLoaded', () => {
  const updatePreferencesButton = document.getElementById('updatePreferences');
  const warningsEnabledCheckbox = document.getElementById('warningsEnabled');
  const extensionPausedCheckbox = document.getElementById('extensionPaused');
  const preferredKeywordsDiv = document.getElementById('preferredKeywords');
  const nonPreferredKeywordsDiv = document.getElementById('nonPreferredKeywords');

  // Function to format keywords into HTML
  function formatKeywords(keywords) {
    if (!keywords || keywords.length === 0) {
      return '<em>No keywords set</em>';
    }
    
    return keywords.map(keyword => {
      return `<span class="keyword-tag">${keyword}</span>`;
    }).join(' ');
  }

  // Load stored preferences and state
  chrome.storage.sync.get(['preferredContent', 'nonPreferredContent', 'warningsEnabled', 'extensionPaused'], (data) => {
    // Format and display keywords
    preferredKeywordsDiv.innerHTML = data.preferredContent ? 
      formatKeywords(data.preferredContent) : 
      '<em>No focus areas set</em>';
    
    nonPreferredKeywordsDiv.innerHTML = data.nonPreferredContent ? 
      formatKeywords(data.nonPreferredContent) : 
      '<em>No content to avoid set</em>';
    
    // Set checkbox states
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