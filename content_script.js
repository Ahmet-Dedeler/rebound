// Content script for YouTube Focus Guard
console.log("[CS] Content script loaded on a YouTube watch page. v2");

let modalInjected = false;
let modalElement = null;

// Function to find the main video player
function getVideoPlayer() {
  return document.querySelector('video.html5-main-video');
}

// Function to pause the video
function pauseVideo() {
  const videoPlayer = getVideoPlayer();
  if (videoPlayer && !videoPlayer.paused) {
    videoPlayer.pause();
    console.log("[CS] Video paused.");
  }
}

// Function to extract video details
function extractVideoDetails() {
  let videoTitle = "";
  let videoDescription = "";

  const titleElement = document.querySelector('h1.style-scope.ytd-watch-metadata .ytd-video-primary-info-renderer, h1.title.ytd-video-primary-info-renderer, #video-title, #title h1 yt-formatted-string, meta[property="og:title"], meta[name="title"]');
  if (titleElement) {
    videoTitle = titleElement.matches('meta') ? titleElement.content : titleElement.innerText.trim();
  }

  const descriptionElement = document.querySelector('#description #content, #description-inline-expander .content, ytd-text-inline-expander.style-scope.ytd-video-secondary-info-renderer, #watch-description-text, meta[property="og:description"], meta[name="description"]');
  if (descriptionElement) {
    videoDescription = descriptionElement.matches('meta') ? descriptionElement.content : descriptionElement.innerText.trim();
  }
  
  console.log("[CS] Extracted Title:", videoTitle);
  console.log("[CS] Extracted Description (preview):"); // Log only preview due to potential length
  console.log(videoDescription.substring(0, 200) + (videoDescription.length > 200 ? "..." : ""));
  return { videoTitle, videoDescription };
}

// Function to inject and show the warning modal
async function showWarningModal() {
  console.log("[CS] showWarningModal called.");
  pauseVideo(); // Pause the video when showing the warning

  if (!modalInjected) {
    console.log("[CS] Modal not injected yet. Fetching and injecting...");
    try {
      const modalUrl = chrome.runtime.getURL('warning_modal.html');
      console.log("[CS] Fetching modal HTML from:", modalUrl);
      const response = await fetch(modalUrl);
      if (!response.ok) {
        console.error("[CS] Failed to fetch warning_modal.html:", response.status, response.statusText);
        return;
      }
      const modalHTML = await response.text();
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = modalHTML;
      modalElement = tempDiv.firstChild;
      if (!modalElement) {
        console.error("[CS] Failed to create modal element from HTML.");
        return;
      }
      document.body.appendChild(modalElement);
      modalInjected = true;
      console.log("[CS] Modal injected.");

      const yesButton = modalElement.querySelector('#focusGuardYes');
      const noButton = modalElement.querySelector('#focusGuardNo');

      if (yesButton) {
        yesButton.addEventListener('click', () => {
          console.log("[CS] 'Yes, Continue' clicked.");
          if (modalElement) modalElement.style.display = 'none';
          // Optionally, resume video here if desired, or let user do it manually
        });
      } else { console.error("[CS] Yes button not found in modal."); }

      if (noButton) {
        noButton.addEventListener('click', () => {
          console.log("[CS] 'No, Close Video' clicked.");
          if (modalElement) modalElement.style.display = 'none';
          chrome.runtime.sendMessage({ action: "closeTab" }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("[CS] Error sending closeTab message:", chrome.runtime.lastError.message);
            }
          });
        });
      } else { console.error("[CS] No button not found in modal."); }

    } catch (error) {
      console.error("[CS] Error injecting modal:", error);
      return;
    }
  }
  if (modalElement) {
    console.log("[CS] Displaying modal.");
    modalElement.style.display = 'flex';
  } else {
    console.error("[CS] Modal element is null, cannot display.");
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[CS] Message received:", request);
  if (request.action === "extractVideoDetails") {
    console.log("[CS] Action: extractVideoDetails");
    const details = extractVideoDetails();
    sendResponse(details);
    return true; // Indicate async response if details extraction were async (though it's sync here)
  }
  if (request.action === "showWarning") {
    console.log("[CS] Action: showWarning");
    showWarningModal();
    sendResponse({ status: "Warning modal process initiated." });
    return true; // Indicate async response as showWarningModal is async
  }
  // Default response for unhandled actions or if not sending async response
  sendResponse({ status: "Request received by content script, no specific action taken or response needed." });
  return false; 
});

console.log("[CS] Event listeners set up.");

// Initial check in case the content script loads after the background script already sent a message
// (less common with manifest v3 but good for robustness with complex pages)
// This isn't strictly necessary for the current flow but can be useful
// chrome.runtime.sendMessage({ action: "contentScriptReady" }); 