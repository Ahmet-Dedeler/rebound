// JavaScript for options.html
// Set to false in production builds
const DEBUG = false;

function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

debugLog("Options script loaded.");

document.addEventListener('DOMContentLoaded', () => {
  // UI Elements
  const preferredContentInput = document.getElementById('preferredContentInput');
  const nonPreferredContentInput = document.getElementById('nonPreferredContentInput');
  const preferredTagsContainer = document.getElementById('preferredTags');
  const nonPreferredTagsContainer = document.getElementById('nonPreferredTags');
  const addPreferredButton = document.getElementById('addPreferredButton');
  const addNonPreferredButton = document.getElementById('addNonPreferredButton');
  // No darkModeToggle, no htmlElement
  
  // Same limits the server enforces (MAX_KEYWORDS / MAX_KEYWORD_LENGTH), so tags are never rejected.
  const MAX_TAGS = 50;
  const MAX_TAG_LENGTH = 80;

  // State variables
  let preferredTags = [];
  let nonPreferredTags = [];
  
  // Function to create a tag element
  function createTagElement(text, type) {
    const tag = document.createElement('div');
    tag.className = 'tag';
    const textSpan = document.createElement('span');
    textSpan.className = 'tag-text';
    textSpan.textContent = text;

    const deleteSpan = document.createElement('span');
    deleteSpan.className = 'tag-delete';
    deleteSpan.textContent = '\u00D7';

    tag.appendChild(textSpan);
    tag.appendChild(deleteSpan);
    
    // Add event listener to delete button
    deleteSpan.addEventListener('click', () => {
      removeTag(text, type);
    });
    
    return tag;
  }
  
  // Function to add a tag
  function addTag(text, type) {
    if (!text || text.trim() === '') return;
    
    text = text.trim().slice(0, MAX_TAG_LENGTH);
    const tagsArray = type === 'preferred' ? preferredTags : nonPreferredTags;
    
    // Skip duplicates (case-insensitive) and respect the per-list cap
    if (tagsArray.some(tag => tag.toLowerCase() === text.toLowerCase())) return;
    if (tagsArray.length >= MAX_TAGS) return;
    
    // Add to array
    tagsArray.push(text);
    
    // Update UI
    renderTags(type);
    
    // Clear input
    if (type === 'preferred') {
      preferredContentInput.value = '';
    } else {
      nonPreferredContentInput.value = '';
    }
    
    // Auto-save
    savePreferences();
  }
  
  // Function to remove a tag
  function removeTag(text, type) {
    const tagsArray = type === 'preferred' ? preferredTags : nonPreferredTags;
    const index = tagsArray.indexOf(text);
    
    if (index !== -1) {
      tagsArray.splice(index, 1);
      renderTags(type);
      
      // Auto-save
      savePreferences();
    }
  }
  
  // Function to render tags
  function renderTags(type) {
    const container = type === 'preferred' ? preferredTagsContainer : nonPreferredTagsContainer;
    const tagsArray = type === 'preferred' ? preferredTags : nonPreferredTags;
    
    // Clear container
    container.replaceChildren();
    
    // Add tags if they exist
    if (tagsArray.length > 0) {
      tagsArray.forEach(tag => {
        container.appendChild(createTagElement(tag, type));
      });
    } else {
      // Show empty message
      const emptyElement = document.createElement('div');
      emptyElement.className = 'empty-tags';
      emptyElement.textContent = 'Nothing set yet';
      container.appendChild(emptyElement);
    }
  }
  
  // Function to save preferences
  function savePreferences() {
    chrome.storage.sync.set({
      preferredContent: preferredTags,
      nonPreferredContent: nonPreferredTags
    }, () => {
      debugLog('Preferences auto-saved');
    });
  }
  
  // Load stored preferences
  chrome.storage.sync.get(['preferredContent', 'nonPreferredContent'], (data) => {
    // Load tags
    if (data.preferredContent && Array.isArray(data.preferredContent)) {
      preferredTags = [...data.preferredContent];
    }
    
    if (data.nonPreferredContent && Array.isArray(data.nonPreferredContent)) {
      nonPreferredTags = [...data.nonPreferredContent];
    }
    
    // Render initial tags
    renderTags('preferred');
    renderTags('nonPreferred');
  });
  
  // Event listener for preferred content input
  if (preferredContentInput) {
    preferredContentInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addTag(preferredContentInput.value, 'preferred');
      }
    });
  }
  
  // Event listener for non-preferred content input
  if (nonPreferredContentInput) {
    nonPreferredContentInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addTag(nonPreferredContentInput.value, 'nonPreferred');
      }
    });
  }
  
  // Event listener for add preferred button
  if (addPreferredButton) {
    addPreferredButton.addEventListener('click', () => {
      addTag(preferredContentInput.value, 'preferred');
    });
  }
  
  // Event listener for add non-preferred button
  if (addNonPreferredButton) {
    addNonPreferredButton.addEventListener('click', () => {
      addTag(nonPreferredContentInput.value, 'nonPreferred');
    });
  }
}); 
