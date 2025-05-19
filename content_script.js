// Content script for YouTube Focus Guard v9
// Set to false in production builds
const DEBUG = false;

// Logging function that only logs in debug mode
function debugLog(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

debugLog("[CS] Content script loading with improved SPA support. v9");

// State variables
let isVideoPage = false;
let currentVideoId = null;
let videoDetailsExtracted = false;
let modalInjected = false;
let modalElement = null;
let continueButtonTimer = null;
let countdownValue = 5;
let processingInProgress = false;
let navigationObserverSet = false;
let previousActiveElement = null;

// Initialize when DOM is ready or immediately if already loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Wait for YouTube to be ready (it's a complex SPA)
function initialize() {
  debugLog("[CS] Initializing content script");
  
  // Check current page once on initialization
  checkCurrentPage();
  
  // Set up message listener for background communication
  setupMessageListener();
  
  // Set up navigation detection once the document is ready
  setupNavigationDetection();
  
  // Set up an interval to check the current page regularly as a fallback
  setInterval(checkCurrentPage, 1000);
}

// Set up detection for YouTube SPA navigation
function setupNavigationDetection() {
  if (navigationObserverSet) return;
  
  try {
    // Method 1: Watch for URL changes using history API modification
    const pushState = history.pushState;
    const replaceState = history.replaceState;
    
    history.pushState = function() {
      pushState.apply(history, arguments);
      debugLog("[CS] pushState detected, checking page");
      setTimeout(checkCurrentPage, 500);
    };
    
    history.replaceState = function() {
      replaceState.apply(history, arguments);
      debugLog("[CS] replaceState detected, checking page");
      setTimeout(checkCurrentPage, 500);
    };
    
    // Listen for popstate events (browser back/forward)
    window.addEventListener('popstate', () => {
      debugLog("[CS] popstate detected, checking page");
      setTimeout(checkCurrentPage, 500);
    });
    
    // Method 2: Watch for body mutations as a fallback
    if (document.body) {
      const bodyObserver = new MutationObserver((mutations) => {
        // Only check if something substantial changed
        if (mutations.some(m => m.addedNodes.length > 0 || m.removedNodes.length > 0)) {
          checkCurrentPage();
        }
      });
      
      bodyObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      });
      
      debugLog("[CS] Body mutation observer set up");
    } else {
      // If body isn't ready yet, try again after a delay
      debugLog("[CS] Body not available yet, will retry navigation detection setup");
      setTimeout(setupNavigationDetection, 1000);
      return;
    }
    
    navigationObserverSet = true;
    debugLog("[CS] Navigation detection set up successfully");
  } catch (error) {
    console.error("[CS] Error setting up navigation detection:", error);
  }
}

// Check if we're on a YouTube video page
function checkCurrentPage() {
  try {
    const url = window.location.href;
    const videoId = getVideoIdFromUrl(url);
    
    // Determine if we're on a video page with a valid video ID
    const onVideoPage = videoId && url.includes('youtube.com/watch');
    
    // If not already processing this video
    if (onVideoPage && (!isVideoPage || videoId !== currentVideoId)) {
      debugLog(`[CS] Detected new video: ${url} (ID: ${videoId}, previous: ${currentVideoId})`);
      
      isVideoPage = true;
      currentVideoId = videoId;
      videoDetailsExtracted = false;
      
      // Process the video after a slight delay to let page content load
      setTimeout(processVideoPage, 1000);
    } 
    // If we've navigated away from a video page
    else if (!onVideoPage && isVideoPage) {
      debugLog("[CS] Left video page");
      isVideoPage = false;
      currentVideoId = null;
      videoDetailsExtracted = false;
    }
  } catch (error) {
    console.error("[CS] Error in checkCurrentPage:", error);
  }
}

// Process a video page by extracting details and sending to background
function processVideoPage() {
  if (!isVideoPage || processingInProgress) return;
  
  try {
    processingInProgress = true;
    debugLog("[CS] Processing video page");
    
    // Make sure YouTube page is fully loaded before extraction
    if (document.readyState !== 'complete') {
      debugLog("[CS] Page not fully loaded, delaying extraction");
      setTimeout(() => {
        processingInProgress = false;
        processVideoPage();
      }, 1000);
      return;
    }
    
    // Extract video details
    const details = extractVideoDetails();
    
    // Only send if we have a title
    if (details.videoTitle) {
      debugLog("[CS] Sending video details to background script");
      debugLog("[CS] Title:", details.videoTitle);
      debugLog("[CS] Description:", details.videoDescription || "(No description)");
      
      // Ensure videoDescription is never undefined (server rejects undefined values)
      const videoDescription = details.videoDescription || "";
      
      chrome.runtime.sendMessage({
        action: "fullVideoDetails",
        videoTitle: details.videoTitle,
        videoDescription: videoDescription
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("[CS] Error sending video details:", chrome.runtime.lastError);
        } else {
          debugLog("[CS] Background script response:", response);
        }
        processingInProgress = false;
      });
      
      videoDetailsExtracted = true;
    } else {
      // If extraction failed, retry after a delay
      debugLog("[CS] Video details extraction failed, retrying in 2 seconds");
      setTimeout(() => {
        processingInProgress = false;
        processVideoPage();
      }, 2000);
    }
  } catch (error) {
    console.error("[CS] Error processing video page:", error);
    processingInProgress = false;
  }
}

// Extract video ID from URL
function getVideoIdFromUrl(url) {
  try {
    const match = url.match(/[?&]v=([^&#]*)/);
    return match ? match[1] : null;
  } catch (error) {
    console.error("[CS] Error extracting video ID:", error);
    return null;
  }
}

// Extract video details
function extractVideoDetails() {
  let videoTitle = "";
  let videoDescription = ""; // Initialize with empty string instead of undefined

  try {
    // Try multiple ways to get the title
    // First check document.title directly (most reliable)
    if (document.title && document.title !== "YouTube") {
      videoTitle = document.title.replace(' - YouTube', '').trim();
    }

    // If title is still empty, try various selectors
    if (!videoTitle || videoTitle === '' || videoTitle === 'YouTube') {
      const titleSelectors = [
        'h1.title', 
        'h1.ytd-watch-metadata',
        'ytd-watch-metadata h1.title',
        'h1.title yt-formatted-string',
        '#container h1.title', 
        '#meta h1',
        '#above-the-fold #title h1',
        '#title h1',
        '#title',
        '#info-contents h1',
        '#video-title',
        'meta[property="og:title"]',
        'meta[name="title"]'
      ];

      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.matches('meta') ? element.content : element.textContent;
          if (text && text.trim()) {
            videoTitle = text.trim();
            break;
          }
        }
      }
    }

    debugLog("[CS] Extracted title:", videoTitle);
    
    // Try to get the description - multiple approaches
    const descriptionSelectors = [
      '#description ytd-text-inline-expander',
      '#description #description-text',
      '#description #content',
      '#description',
      '.ytd-text-inline-expander',
      'ytd-expander[expanded] #content',
      'ytd-expander #content',
      '#meta-contents #description',
      'meta[property="og:description"]',
      'meta[name="description"]'
    ];

    for (const selector of descriptionSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.matches('meta') ? 
          element.content : 
          element.textContent || element.innerText;
        
        if (text && text.trim()) {
          videoDescription = text.trim();
          debugLog("[CS] Found description with selector:", selector);
          break;
        }
      }
    }

    // Try to expand the description by clicking "Show more" if available
    if (!videoDescription || videoDescription.length < 50) {
      const showMoreButtons = [
        '#expand',
        '#description tp-yt-paper-button#expand',
        '#description #expand',
        '#more-button',
        '.more-button',
        'ytd-text-inline-expander tp-yt-paper-button',
        'button.ytd-expander',
        'ytd-expander #more'
      ];
      
      for (const buttonSelector of showMoreButtons) {
        const showMoreButton = document.querySelector(buttonSelector);
        if (showMoreButton) {
          try {
            debugLog("[CS] Found Show More button:", buttonSelector);
            showMoreButton.click();
            debugLog("[CS] Clicked 'Show more' button");
            
            // Try again to get the expanded description
            setTimeout(() => {
              for (const selector of descriptionSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                  const text = element.matches('meta') ? 
                    element.content : 
                    element.textContent || element.innerText;
                  
                  if (text && text.trim() && text.length > videoDescription.length) {
                    videoDescription = text.trim();
                  }
                }
              }
            }, 300);
            
            break;
          } catch (e) {
            debugLog("[CS] Error clicking 'Show more' button:", e);
          }
        }
      }
    }

    debugLog("[CS] Extracted description length:", videoDescription?.length || 0);
    
    // Fallback: if we still can't get a description but have a title, create a minimal description
    if ((!videoDescription || videoDescription.length === 0) && videoTitle) {
      videoDescription = `Video: ${videoTitle}`;
      debugLog("[CS] Using fallback description");
    }
    
  } catch (error) {
    console.error("[CS] Error extracting video details:", error);
    // Ensure we still return something
    if (videoTitle && !videoDescription) {
      videoDescription = `Video: ${videoTitle}`;
    }
  }
  
  return { 
    videoTitle: videoTitle || "", 
    videoDescription: videoDescription || "" 
  };
}

// Set up message listener
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    debugLog("[CS] Received message:", request);
    
    if (request.action === "extractVideoDetails") {
      const details = extractVideoDetails();
      sendResponse(details);
    } else if (request.action === "showWarning") {
      showWarningModal();
      sendResponse({ status: "Warning modal process initiated by content script." });
    } else if (request.action === "showError") {
      showErrorMessage(request.errorMessage || "Unable to analyze video content");
      sendResponse({ status: "Error message displayed." });
    } else {
      sendResponse({status: "Message received by content script, no specific action or unhandled."});
    }
    
    return true; // Keep channel open for async
  });
}

// Display error message to the user
function showErrorMessage(message) {
  // Create a temporary error message element
  const errorElement = document.createElement('div');
  errorElement.className = 'focus-guard-error';
  errorElement.style.position = 'fixed';
  errorElement.style.top = '10px';
  errorElement.style.right = '10px';
  errorElement.style.zIndex = '9999';
  errorElement.style.backgroundColor = '#f44336';
  errorElement.style.color = 'white';
  errorElement.style.padding = '12px 20px';
  errorElement.style.borderRadius = '4px';
  errorElement.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  errorElement.style.fontSize = '14px';
  errorElement.style.maxWidth = '400px';
  errorElement.style.animation = 'fadeIn 0.3s ease-out';
  
  errorElement.textContent = `Rebound: ${message}`;
  
  // Add it to the page
  document.body.appendChild(errorElement);
  
  // Remove after 5 seconds
  setTimeout(() => {
    if (errorElement.parentNode === document.body) {
      errorElement.style.animation = 'fadeOut 0.3s ease-out';
      
      // Remove after animation completes
      setTimeout(() => {
        if (errorElement.parentNode === document.body) {
          document.body.removeChild(errorElement);
        }
      }, 300);
    }
  }, 5000);
  
  // Add CSS for animations
  if (!document.querySelector('#focus-guard-error-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'focus-guard-error-styles';
    styleElement.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(-20px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeOut {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-20px); }
      }
    `;
    document.head.appendChild(styleElement);
  }
}

// Get video player
function getVideoPlayer() {
  return document.querySelector('video.html5-main-video');
}

// Pause video
function pauseVideo() {
  const videoPlayer = getVideoPlayer();
  if (videoPlayer && !videoPlayer.paused) {
    videoPlayer.pause();
    debugLog("[CS] Video paused.");
  } else {
    debugLog("[CS] Video player not found or already paused.");
  }
}

// Resume video
function resumeVideo() {
  const videoPlayer = getVideoPlayer();
  if (videoPlayer && videoPlayer.paused) {
    videoPlayer.play()
      .then(() => debugLog("[CS] Video resumed successfully."))
      .catch(error => console.error("[CS] Error resuming video:", error));
  } else {
    debugLog("[CS] Video player not found or already playing.");
  }
}

// Display a random quote
function displayRandomQuote() {
  if (typeof getRandomQuote !== 'function') {
    console.error("[CS] getRandomQuote function not available");
    return;
  }
  
  const quote = getRandomQuote();
  const quoteTextElement = document.getElementById('quoteText');
  const quoteAuthorElement = document.getElementById('quoteAuthor');
  
  if (quoteTextElement && quoteAuthorElement) {
    quoteTextElement.textContent = `"${quote.text}"`;
    quoteAuthorElement.textContent = `— ${quote.author}`;
  }
}

// Start countdown
function startCountdown() {
  const countdownElement = document.getElementById('countdown');
  const continueButton = document.getElementById('focusGuardYes');
  
  if (!countdownElement || !continueButton) {
    console.error("[CS] Countdown element or continue button not found");
    return;
  }
  
  countdownValue = 5;
  countdownElement.textContent = countdownValue;
  
  // Disable the continue button initially
  continueButton.classList.remove('active');
  continueButton.setAttribute('aria-disabled', 'true');
  
  continueButtonTimer = setInterval(() => {
    countdownValue -= 1;
    countdownElement.textContent = countdownValue;
    
    if (countdownValue <= 0) {
      clearInterval(continueButtonTimer);
      continueButton.classList.add('active');
      continueButton.setAttribute('aria-disabled', 'false');
    }
  }, 1000);
}

// Handle keyboard navigation inside modal - trap focus
function handleModalKeydown(event) {
  // If Escape pressed, close the modal
  if (event.key === 'Escape') {
    closeWarningModal();
    event.preventDefault();
    return;
  }
  
  // Only trap focus if Tab key is pressed
  if (event.key !== 'Tab') return;
  
  // Get all focusable elements in the modal
  const focusableElements = modalElement.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  
  if (focusableElements.length === 0) return;
  
  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  
  // If shift+tab pressed and first element is active, move to last element
  if (event.shiftKey && document.activeElement === firstElement) {
    lastElement.focus();
    event.preventDefault();
  } 
  // If tab pressed and last element is active, move to first element
  else if (!event.shiftKey && document.activeElement === lastElement) {
    firstElement.focus();
    event.preventDefault();
  }
}

// Close the warning modal
function closeWarningModal() {
  if (modalElement) {
    modalElement.style.display = 'none';
    
    // Remove the keydown event listener
    modalElement.removeEventListener('keydown', handleModalKeydown);
    
    // Restore focus to previous element
    if (previousActiveElement) {
      previousActiveElement.focus();
    }
  }
  
  if (continueButtonTimer) {
    clearInterval(continueButtonTimer);
  }
}

// Show warning modal
async function showWarningModal() {
  debugLog("[CS] showWarningModal called.");
  pauseVideo();

  // Store the current active element to restore focus later
  previousActiveElement = document.activeElement;

  if (!modalInjected) {
    debugLog("[CS] Modal not injected yet. Fetching and injecting...");
    try {
      const modalUrl = chrome.runtime.getURL('warning_modal.html');
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
      debugLog("[CS] Modal injected.");

      const yesButton = modalElement.querySelector('#focusGuardYes');
      const noButton = modalElement.querySelector('#focusGuardNo');

      if (yesButton) {
        yesButton.addEventListener('click', () => {
          debugLog("[CS] 'Yes, Continue' clicked.");
          closeWarningModal();
          resumeVideo(); // Resume the video when user clicks continue
        });
      } else { console.error("[CS] Yes button not found in modal."); }

      if (noButton) {
        noButton.addEventListener('click', () => {
          debugLog("[CS] 'No, Go Back' clicked.");
          closeWarningModal();
          chrome.runtime.sendMessage({ action: "goBack" }, (res) => {
            if (chrome.runtime.lastError) {
              console.error("[CS] Error sending goBack message:", chrome.runtime.lastError.message);
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
    debugLog("[CS] Displaying modal.");
    modalElement.style.display = 'flex';
    
    // Set up focus trap
    modalElement.addEventListener('keydown', handleModalKeydown);
    
    displayRandomQuote();
    startCountdown();
    
    // Focus on the "No, Go Back" button or the modal itself if button not found
    setTimeout(() => {
      const noButton = modalElement.querySelector('#focusGuardNo');
      if (noButton) {
        noButton.focus();
      } else {
        modalElement.focus();
      }
    }, 50);
  } else {
    console.error("[CS] Modal element is null, cannot display after injection attempt.");
  }
} 