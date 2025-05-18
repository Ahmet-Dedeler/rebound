// JavaScript for options.html
console.log("Options script loaded.");

document.addEventListener('DOMContentLoaded', () => {
  const preferredContentTextarea = document.getElementById('preferredContent');
  const nonPreferredContentTextarea = document.getElementById('nonPreferredContent');
  const saveButton = document.getElementById('savePreferences');
  const statusMessageDiv = document.getElementById('statusMessage');

  // Load stored preferences
  chrome.storage.sync.get(['preferredContent', 'nonPreferredContent'], (data) => {
    if (data.preferredContent) {
      preferredContentTextarea.value = data.preferredContent.join(', ');
    }
    if (data.nonPreferredContent) {
      nonPreferredContentTextarea.value = data.nonPreferredContent.join(', ');
    }
  });

  // Save preferences
  if (saveButton) {
    saveButton.addEventListener('click', () => {
      const preferred = preferredContentTextarea.value.split(',').map(s => s.trim()).filter(s => s);
      const nonPreferred = nonPreferredContentTextarea.value.split(',').map(s => s.trim()).filter(s => s);

      chrome.storage.sync.set({
        preferredContent: preferred,
        nonPreferredContent: nonPreferred
      }, () => {
        statusMessageDiv.textContent = 'Preferences saved!';
        setTimeout(() => {
          statusMessageDiv.textContent = '';
        }, 2000);
      });
    });
  }
}); 