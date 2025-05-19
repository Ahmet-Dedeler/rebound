// JavaScript for popup.html
// Set to false in production builds
const DEBUG = false;

function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

debugLog("Popup script loaded.");

document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const updatePreferencesButton = document.getElementById('updatePreferences');
  const warningsEnabledCheckbox = document.getElementById('warningsEnabled');
  const preferredKeywordsDiv = document.getElementById('preferredKeywords');
  const nonPreferredKeywordsDiv = document.getElementById('nonPreferredKeywords');
  const darkModeToggle = document.getElementById('darkModeToggle');
  const powerButton = document.getElementById('powerButton');
  const mainContent = document.getElementById('mainContent');
  const offScreen = document.getElementById('offScreen');
  const htmlElement = document.documentElement;

  // Function to format keywords into HTML
  function formatKeywords(keywords) {
    if (!keywords || keywords.length === 0) {
      return '<em>Nothing set yet</em>';
    }
    
    return keywords.map(keyword => {
      return `<span class="keyword-tag">${keyword}</span>`;
    }).join(' ');
  }

  // Function to toggle dark mode
  function toggleDarkMode() {
    const isDarkMode = htmlElement.getAttribute('data-theme') === 'dark';
    const newMode = isDarkMode ? 'light' : 'dark';
    
    htmlElement.setAttribute('data-theme', newMode);
    chrome.storage.sync.set({ darkMode: !isDarkMode });
    debugLog(`Dark mode ${isDarkMode ? 'disabled' : 'enabled'}`);
  }

  // Function to toggle extension on/off
  function toggleExtensionState() {
    const isPaused = mainContent.classList.contains('hidden');
    
    if (isPaused) {
      // Turn on
      mainContent.classList.remove('hidden');
      offScreen.classList.add('hidden');
      chrome.storage.sync.set({ extensionPaused: false });
      debugLog('Extension activated');
    } else {
      // Turn off
      mainContent.classList.add('hidden');
      offScreen.classList.remove('hidden');
      chrome.storage.sync.set({ extensionPaused: true });
      debugLog('Extension paused');
    }
  }

  // Load stored preferences and state
  chrome.storage.sync.get(['preferredContent', 'nonPreferredContent', 'warningsEnabled', 'extensionPaused', 'darkMode'], (data) => {
    // Format and display keywords
    preferredKeywordsDiv.innerHTML = data.preferredContent ? 
      formatKeywords(data.preferredContent) : 
      '<em>Nothing set yet</em>';
    
    nonPreferredKeywordsDiv.innerHTML = data.nonPreferredContent ? 
      formatKeywords(data.nonPreferredContent) : 
      '<em>Nothing set yet</em>';
    
    // Set checkbox states
    warningsEnabledCheckbox.checked = data.warningsEnabled !== undefined ? data.warningsEnabled : true;
    
    // Set dark mode state
    if (data.darkMode) {
      htmlElement.setAttribute('data-theme', 'dark');
    }
    
    // Set extension state (on/off)
    if (data.extensionPaused) {
      mainContent.classList.add('hidden');
      offScreen.classList.remove('hidden');
    } else {
      mainContent.classList.remove('hidden');
      offScreen.classList.add('hidden');
    }
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

  // Event listener for dark mode toggle
  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', toggleDarkMode);
  }

  // Event listener for power button (toggle on/off)
  if (powerButton) {
    powerButton.addEventListener('click', toggleExtensionState);
  }

  // Only the center power icon in offScreen should toggle on
  if (offScreen) {
    const centerPowerIcon = offScreen.querySelector('.power-icon-large');
    if (centerPowerIcon) {
      centerPowerIcon.addEventListener('click', toggleExtensionState);
    }
  }
  
  // Listen for storage changes to sync dark mode with options page
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.darkMode && changes.darkMode.newValue !== undefined) {
      const newDarkMode = changes.darkMode.newValue;
      htmlElement.setAttribute('data-theme', newDarkMode ? 'dark' : 'light');
    }
  });
}); 