// Background script for YouTube Focus Guard
console.log("Background script loaded. v5");

const SERVER_URL = "https://ai-youtube-extension-server.vercel.app/analyze-video";

// Store tab navigation history
const tabHistory = {};

// Store recent video analyses to avoid duplicate requests for the same video
const recentAnalyses = {};

// Listener for first install to open options page
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.runtime.openOptionsPage();
    // Initialize default settings
    chrome.storage.sync.set({
      warningsEnabled: true,
      extensionPaused: false,
      preferredContent: [],
      nonPreferredContent: []
    });
  }
  console.log("[BG] Extension installed/updated");
});

// Track tab navigation to keep history of where users came from
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only process complete page loads with a URL
  if (changeInfo.status === 'complete' && tab.url) {
    console.log(`[BG] Tab ${tabId} updated: ${tab.url}`);
    
    // Track all YouTube navigation to maintain history for going back
    if (tab.url.includes("youtube.com")) {
      // Initialize history array if it doesn't exist
      if (!tabHistory[tabId]) {
        tabHistory[tabId] = { urls: [] };
      }
      
      // Add URL to history if it's new and not a duplicate of the last entry
      const history = tabHistory[tabId];
      if (history.urls.length === 0 || history.urls[history.urls.length - 1] !== tab.url) {
        history.urls.push(tab.url);
        console.log(`[BG] Added ${tab.url} to history for tab ${tabId}. History:`, history.urls);
      }
      
      // On completed navigation to a YouTube video page, try to inject our content script if needed
      // This is a fallback to ensure content script is active in edge cases
      if (tab.url.includes("/watch?v=")) {
        const videoId = getVideoIdFromUrl(tab.url);
        console.log(`[BG] Detected YouTube video page load: ${videoId}`);
      }
    }
  }
});

// Remove history when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabHistory[tabId]) {
    delete tabHistory[tabId];
    console.log(`[BG] Removed history for tab ${tabId} because it was closed`);
  }
});

// Extract video ID from YouTube URL
function getVideoIdFromUrl(url) {
  try {
    const match = url.match(/[?&]v=([^&#]*)/);
    return match ? match[1] : null;
  } catch (e) {
    console.error("[BG] Error extracting video ID:", e);
    return null;
  }
}

// Function to get a non-video YouTube URL from tab history
function getPreviousNonVideoUrl(tabId) {
  if (!tabHistory[tabId] || !tabHistory[tabId].urls || tabHistory[tabId].urls.length <= 1) {
    // No history or only one entry, go to YouTube home
    return "https://www.youtube.com/";
  }
  
  // Get the urls for this tab and find the most recent non-video URL
  const urls = tabHistory[tabId].urls;
  
  // Start from the second-to-last URL (index length-2) since the last one is the current video
  for (let i = urls.length - 2; i >= 0; i--) {
    // If this URL is not a video URL, return it
    if (!urls[i].includes("/watch?v=")) {
      return urls[i];
    }
  }
  
  // If all are video URLs, go to YouTube home
  return "https://www.youtube.com/";
}

// Listen for messages from content script 
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Log all incoming messages with sender information
  console.log("[BG] Received message:", request.action, "from tab:", sender.tab?.id);
  
  // Handle full video details - main entry point for analysis
  if (request.action === "fullVideoDetails" && sender.tab) {
    const tabId = sender.tab.id;
    const url = sender.tab.url;
    
    if (!url || !url.includes("/watch?v=")) {
      console.log("[BG] Message came from non-video page, ignoring");
      sendResponse({ status: "Not a video page" });
      return true;
    }
    
    const videoId = getVideoIdFromUrl(url);
    if (!videoId) {
      console.log("[BG] Could not extract video ID from URL:", url);
      sendResponse({ status: "No video ID found" });
      return true;
    }
    
    console.log("[BG] Processing video details from tab", tabId, "Video ID:", videoId);
    
    // Skip if we've recently analyzed this video (prevent duplicates)
    const videoKey = `${tabId}_${videoId}`;
    const now = Date.now();
    if (recentAnalyses[videoKey] && now - recentAnalyses[videoKey].timestamp < 10000) { // 10 seconds
      console.log("[BG] Skipping duplicate analysis request for recently analyzed video:", videoId);
      sendResponse({ status: "Skipping duplicate analysis request" });
      return true;
    }
    
    // Add URL to history if it's not already tracked
    if (url) {
      if (!tabHistory[tabId]) {
        tabHistory[tabId] = { urls: [url] };
      } else if (tabHistory[tabId].urls.length === 0 || 
                 tabHistory[tabId].urls[tabHistory[tabId].urls.length - 1] !== url) {
        tabHistory[tabId].urls.push(url);
      }
    }
    
    // Update recent analyses timestamp
    recentAnalyses[videoKey] = { timestamp: now };
    
    // Check if extension is paused or warnings disabled
    chrome.storage.sync.get(['extensionPaused', 'warningsEnabled', 'preferredContent', 'nonPreferredContent'], (settings) => {
      if (settings.extensionPaused) {
        console.log("[BG] Extension is paused. Skipping analysis.");
        sendResponse({ status: "Extension is paused" });
        return;
      }
      
      if (!settings.warningsEnabled) {
        console.log("[BG] Warnings are disabled. Skipping analysis.");
        sendResponse({ status: "Warnings are disabled" });
        return;
      }
      
      // Ensure we have the content to analyze
      if (!request.videoTitle) {
        console.log("[BG] No video title provided for analysis");
        sendResponse({ status: "No title provided for analysis" });
        return;
      }
      
      console.log("[BG] Analyzing video:", request.videoTitle);
      
      // Send to server for analysis
      analyzeContent(
        request.videoTitle,
        request.videoDescription || "",
        settings.preferredContent || [],
        settings.nonPreferredContent || [],
        tabId
      );
      
      sendResponse({ status: "Processing video for analysis" });
    });
    
    return true;
  }
  
  // Handle go back request
  if (request.action === "goBack" && sender.tab) {
    const tabId = sender.tab.id;
    console.log("[BG] Received 'goBack' from tab:", tabId);
    
    const previousUrl = getPreviousNonVideoUrl(tabId);
    console.log("[BG] Navigating to previous URL:", previousUrl);
    
    // Navigate to the previous URL
    chrome.tabs.update(tabId, { url: previousUrl }, () => {
      if (chrome.runtime.lastError) {
        console.error("[BG] Error navigating back:", chrome.runtime.lastError.message);
        // Fallback to closing the tab if navigation fails
        chrome.tabs.remove(tabId);
      }
      sendResponse({ status: "Navigation initiated or tab closed" });
    });
    return true;
  }
  
  sendResponse({ status: "Message received" });
  return true;
});

// Function to send content to server for analysis
async function analyzeContent(videoTitle, videoDescription, preferredContent, nonPreferredContent, tabId) {
  try {
    console.log("[BG] Sending to server:", SERVER_URL);
    console.log("[BG] Title:", videoTitle);
    console.log("[BG] Description preview:", videoDescription.substring(0, 50) + "...");
    console.log("[BG] Preferred content:", preferredContent);
    console.log("[BG] Non-preferred content:", nonPreferredContent);

    const serverResponse = await fetch(SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        videoTitle: videoTitle,
        videoDescription: videoDescription,
        preferredContent: preferredContent || [],
        nonPreferredContent: nonPreferredContent || []
      }),
    });

    const responseText = await serverResponse.text(); // Get text first for better error diagnosis
    if (!serverResponse.ok) {
      console.error("[BG] Error from server:", serverResponse.status, responseText);
      return; // Don't proceed if server error
    }

    const analysisResult = JSON.parse(responseText); // Parse JSON after confirming OK
    console.log("[BG] Received from server:", analysisResult);
    handleAnalysisResponse(analysisResult, tabId);

  } catch (error) {
    console.error("[BG] Failed to send data to server or parse response:", error);
  }
}

// Handle the analysis response from the server
function handleAnalysisResponse(analysis, tabId) {
  console.log("[BG] Handling analysis response:", analysis);
  if (analysis && analysis.alignsWithFocus === false) {
    console.log("[BG] Video does NOT align. Sending 'showWarning' to tab:", tabId);
    chrome.tabs.sendMessage(tabId, { action: "showWarning" }, (msgResponse) => {
      if (chrome.runtime.lastError) {
        console.error("[BG] Error sending 'showWarning' message:", chrome.runtime.lastError.message);
      } else {
        console.log("[BG] 'showWarning' message sent, response from content script:", msgResponse);
      }
    });
  } else {
    console.log("[BG] Video aligns with focus or analysis defaulted/failed. No warning needed. Analysis:", analysis);
  }
} 