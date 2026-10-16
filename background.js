// Rebound - background service worker (Manifest V3).
//
// The service worker is stopped by Chrome after ~30s of inactivity, so it must never rely on
// in-memory state: anything that has to survive goes in chrome.storage.* instead.
//
// Its only job is to ask our server whether a video fits the user's focus. The fetch has to
// live here (not in the content script) because a content script's requests carry YouTube's
// origin, while the server authenticates the request by the extension's own origin.
//
// No API keys live in the extension. The server holds them and only ever sees the video
// title/description and the user's keyword lists.

const DEBUG = false;
const debugLog = (...args) => DEBUG && console.log("[BG]", ...args);

const SERVER_URL = "https://ai-youtube-extension-server.vercel.app/analyze-video";
const REQUEST_TIMEOUT_MS = 15000;

// Verdict cache (chrome.storage.session: cleared when the browser closes, never synced).
// Re-opening a video you already judged costs no API call.
const CACHE_KEY = "verdictCache";
const CACHE_MAX_ENTRIES = 200;

const DEFAULT_SETTINGS = {
  warningsEnabled: true,
  extensionPaused: false,
  preferredContent: [],
  nonPreferredContent: []
};

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.storage.sync.set(DEFAULT_SETTINGS);
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Only accept messages from our own content script running on a YouTube page.
  if (sender.id !== chrome.runtime.id || !isYouTubeUrl(sender.url)) return false;

  if (request?.action === "analyzeVideo") {
    analyzeVideo(request)
      .then(sendResponse)
      .catch((error) => {
        console.error("[BG] analyzeVideo failed:", error);
        sendResponse({ status: "error", error: "Could not analyze this video. Please try again later." });
      });
    return true; // keep the channel open for the async response
  }

  return false;
});

function isYouTubeUrl(url) {
  try {
    return new URL(url).origin === "https://www.youtube.com";
  } catch {
    return false;
  }
}

/**
 * Decide whether a video aligns with the user's focus.
 * Resolves to { status: "ok", alignsWithFocus } | { status: "skipped", reason } | { status: "error", error }.
 */
async function analyzeVideo({ videoId, videoTitle, videoDescription, channelName }) {
  if (typeof videoId !== "string" || typeof videoTitle !== "string" || !videoTitle.trim()) {
    return { status: "skipped", reason: "No video title" };
  }

  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  if (settings.extensionPaused) return { status: "skipped", reason: "Extension is paused" };
  if (!settings.warningsEnabled) return { status: "skipped", reason: "Warnings are disabled" };

  const preferredContent = settings.preferredContent || [];
  const nonPreferredContent = settings.nonPreferredContent || [];

  // The verdict depends on the video AND the keyword lists, so both go into the key.
  const cacheKey = `${videoId}:${hashString(JSON.stringify([preferredContent, nonPreferredContent]))}`;
  const cached = await readCache(cacheKey);
  if (cached !== undefined) {
    debugLog("Cache hit", cacheKey);
    return { status: "ok", alignsWithFocus: cached };
  }

  const response = await fetch(SERVER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Extension-Id": chrome.runtime.id
    },
    body: JSON.stringify({
      videoTitle,
      videoDescription: videoDescription || "",
      channelName: channelName || "",
      preferredContent,
      nonPreferredContent
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 100);
    console.error(`[BG] Server error ${response.status}: ${detail}`);
    return { status: "error", error: `Analysis server error (${response.status}). Please try again later.` };
  }

  const result = await response.json();
  if (typeof result?.alignsWithFocus !== "boolean") {
    return { status: "error", error: "Received an invalid response from the analysis server." };
  }

  await writeCache(cacheKey, result.alignsWithFocus);
  return { status: "ok", alignsWithFocus: result.alignsWithFocus };
}

// --- verdict cache -------------------------------------------------------------------------

async function readCache(key) {
  const { [CACHE_KEY]: cache = {} } = await chrome.storage.session.get(CACHE_KEY);
  return cache[key];
}

async function writeCache(key, value) {
  const { [CACHE_KEY]: cache = {} } = await chrome.storage.session.get(CACHE_KEY);
  delete cache[key]; // re-insert so the entry becomes the newest
  cache[key] = value;
  // Object keys keep insertion order, so the oldest entries are first: drop them past the cap.
  const keys = Object.keys(cache);
  for (const oldKey of keys.slice(0, Math.max(0, keys.length - CACHE_MAX_ENTRIES))) {
    delete cache[oldKey];
  }
  await chrome.storage.session.set({ [CACHE_KEY]: cache });
}

// Small non-cryptographic hash (djb2) just to keep cache keys short.
function hashString(text) {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}
