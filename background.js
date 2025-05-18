// Background script for YouTube Focus Guard
console.log("Background script loaded. v2"); // Added v2 for reload check

const SERVER_URL = "http://localhost:3000/analyze-video";

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
});

// Listen for tab updates to detect YouTube video pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes("youtube.com/watch?v=") && changeInfo.status === 'complete') {
    console.log("[BG] YouTube video page loaded:", tab.url);

    chrome.storage.sync.get(['extensionPaused', 'warningsEnabled', 'preferredContent', 'nonPreferredContent'], async (settings) => {
      if (settings.extensionPaused) {
        console.log("[BG] Extension is paused. Skipping analysis.");
        return;
      }
      if (!settings.warningsEnabled) {
        console.log("[BG] Warnings are disabled. Skipping analysis.");
        return;
      }
      console.log("[BG] Settings for analysis:", settings);

      chrome.tabs.sendMessage(tabId, { action: "extractVideoDetails" }, async (response) => {
        if (chrome.runtime.lastError) {
          console.error("[BG] Error sending message to content script (extractVideoDetails):", chrome.runtime.lastError.message);
          return;
        }
        if (response && response.videoTitle) { // Description can sometimes be short or missing
          console.log("[BG] Received from content script:", response);
          
          try {
            console.log("[BG] Sending to server:", SERVER_URL, "Payload:", {
              videoTitle: response.videoTitle,
              videoDescription: response.videoDescription,
              preferredContent: settings.preferredContent || [],
              nonPreferredContent: settings.nonPreferredContent || []
            });

            const serverResponse = await fetch(SERVER_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                videoTitle: response.videoTitle,
                videoDescription: response.videoDescription,
                preferredContent: settings.preferredContent || [],
                nonPreferredContent: settings.nonPreferredContent || []
              }),
            });

            const responseText = await serverResponse.text(); // Get text first for better error diagnosis
            if (!serverResponse.ok) {
              console.error("[BG] Error from server:", serverResponse.status, responseText);
              handleAnalysisResponse({ alignsWithFocus: true, error: `Server error: ${serverResponse.status}` }, tabId);
              return;
            }

            const analysisResult = JSON.parse(responseText); // Parse JSON after confirming OK
            console.log("[BG] Received from server:", analysisResult);
            handleAnalysisResponse(analysisResult, tabId);

          } catch (error) {
            console.error("[BG] Failed to send data to server or parse response:", error);
            handleAnalysisResponse({ alignsWithFocus: true, error: 'Network or parsing error' }, tabId);
          }
        } else {
          console.log("[BG] No response or incomplete data from content script (title missing). Response:", response);
        }
      });
    });
  }
});

// Handles the analysis response (from server or simulated)
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

// Listener for messages from content script (e.g., user actions on the warning)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "closeTab" && sender.tab) {
    console.log("[BG] Received 'closeTab' from tab:", sender.tab.id);
    chrome.tabs.remove(sender.tab.id, () => {
      if (chrome.runtime.lastError) {
        console.error("[BG] Error closing tab:", chrome.runtime.lastError.message);
      }
      sendResponse({ status: "Tab closed or closing initiated" });
    });
    return true; 
  }
  console.log("[BG] Received message:", request, "from sender:", sender);
  return true;
}); 