// Rebound - content script (runs on https://www.youtube.com/*).
//
// YouTube is a single-page app: moving between videos does not reload the page. We rely on
// YouTube's own `yt-navigate-finish` event to notice navigation, instead of polling the URL
// or patching history methods (a content script lives in an isolated world, so patching
// `history.pushState` here would never see YouTube's calls anyway).
//
// For each watch page we read the title/description/channel, ask the background worker for a
// verdict, and show the warning modal if the video doesn't fit the user's focus.

const DEBUG = false;
const debugLog = (...args) => DEBUG && console.log("[CS]", ...args);

// Server limit is 4000 chars per text field; stay under it.
const MAX_DESCRIPTION_LENGTH = 3500;
// How long we wait for YouTube to render the new video's metadata after a navigation.
const DETAIL_POLL_INTERVAL_MS = 400;
const DETAIL_POLL_MAX_ATTEMPTS = 15;
// Give the description a few attempts to appear, but don't block on it forever.
const DESCRIPTION_GRACE_ATTEMPTS = 4;

const HISTORY_KEY = "rebound:history";
const HISTORY_MAX_ENTRIES = 50;
const COUNTDOWN_SECONDS = 5;

// --- state ----------------------------------------------------------------------------------
let currentVideoId = null; // the video we are currently analyzing / have analyzed
let navigationToken = 0; // bumped on every navigation so stale async work can bail out
let modalElement = null;
let countdownTimer = null;
let previousActiveElement = null;

// --- navigation -----------------------------------------------------------------------------

function onNavigate() {
  if (!isExtensionAlive()) return;

  recordHistory(location.href);

  const videoId = getVideoId();
  if (videoId === currentVideoId) return; // same video (or still not on a video page)

  navigationToken++;
  currentVideoId = videoId;
  closeWarningModal();

  if (videoId) analyzeCurrentVideo(videoId, navigationToken);
}

function getVideoId() {
  if (location.pathname !== "/watch") return null;
  return new URLSearchParams(location.search).get("v");
}

/** After the extension is updated/reloaded, orphaned content scripts lose `chrome.runtime`. */
function isExtensionAlive() {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

// --- analysis -------------------------------------------------------------------------------

async function analyzeCurrentVideo(videoId, token) {
  const details = await waitForVideoDetails(videoId, token);
  if (!details || token !== navigationToken) return;

  let response;
  try {
    response = await chrome.runtime.sendMessage({ action: "analyzeVideo", videoId, ...details });
  } catch (error) {
    debugLog("sendMessage failed:", error);
    return; // extension reloaded or worker unavailable: nothing useful to tell the user
  }

  // The user may have moved on to another video while the server was thinking.
  if (token !== navigationToken) return;

  if (response?.status === "ok" && response.alignsWithFocus === false) {
    showWarningModal();
  } else if (response?.status === "error") {
    showToast(response.error);
  }
}

/** Poll until YouTube has rendered this video's metadata (or give up and return null). */
async function waitForVideoDetails(videoId, token) {
  for (let attempt = 0; attempt < DETAIL_POLL_MAX_ATTEMPTS; attempt++) {
    if (token !== navigationToken) return null;

    const details = extractVideoDetails(videoId);
    if (details && (details.videoDescription || attempt >= DESCRIPTION_GRACE_ATTEMPTS)) {
      return details;
    }
    await new Promise((resolve) => setTimeout(resolve, DETAIL_POLL_INTERVAL_MS));
  }
  return null;
}

/**
 * Read title/description/channel for `videoId` from the page.
 * Returns null while the page still shows a previous video or hasn't rendered yet.
 */
function extractVideoDetails(videoId) {
  // YouTube keeps the previous video's DOM around for a moment after an SPA navigation.
  const watchFlexy = document.querySelector("ytd-watch-flexy");
  if (watchFlexy && watchFlexy.getAttribute("video-id") !== videoId) return null;

  const videoTitle = readTitle();
  if (!videoTitle) return null;

  return {
    videoTitle,
    videoDescription: readDescription(),
    channelName: readText(CHANNEL_SELECTORS, 120)
  };
}

// document.title is the most stable source: "(3) Some title - YouTube" -> "Some title".
function readTitle() {
  const title = document.title
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\s*-\s*YouTube$/, "")
    .trim();
  return title && title !== "YouTube" ? title : "";
}

// Tried in order; YouTube renames these now and then, so keep several candidates.
// The collapsed "snippet" (the first ~200 characters of the description) is clean text that is
// always in the DOM; the full expander also contains chapter lists, cards and button labels.
const DESCRIPTION_SELECTORS = [
  "ytd-watch-metadata #description-inline-expander #attributed-snippet-text",
  "ytd-watch-metadata #description-inline-expander #snippet-text",
  "ytd-watch-metadata #description-inline-expander #expanded",
  "ytd-watch-metadata #description-inline-expander"
];

const CHANNEL_SELECTORS = [
  "ytd-watch-metadata #owner ytd-channel-name a",
  "#owner ytd-channel-name a",
  "ytd-video-owner-renderer ytd-channel-name a"
];

function readDescription() {
  // Reading textContent needs no interaction, so we never click "Show more" and never change
  // the user's page.
  return readText(DESCRIPTION_SELECTORS, MAX_DESCRIPTION_LENGTH).replace(/\s*(?:\.\.\.|…)\s*more$/i, "");
}

function readText(selectors, maxLength) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = element?.textContent?.replace(/\s+/g, " ").trim();
    if (text) return text.slice(0, maxLength);
  }
  return "";
}

// --- "go back" history ----------------------------------------------------------------------
// Kept in sessionStorage (per tab, survives full page loads) so the background worker doesn't
// need the `tabs` permission or any in-memory state.

function readHistory() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(HISTORY_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function recordHistory(url) {
  try {
    const history = readHistory();
    if (history[history.length - 1] === url) return;
    history.push(url);
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-HISTORY_MAX_ENTRIES)));
  } catch {
    // sessionStorage can be unavailable (e.g. blocked storage): going back just defaults to home.
  }
}

/** Most recent YouTube page that isn't a video, or the homepage. */
function getPreviousNonVideoUrl() {
  const history = readHistory();
  for (let i = history.length - 2; i >= 0; i--) {
    try {
      const url = new URL(history[i]);
      if (url.origin === location.origin && url.pathname !== "/watch") return url.href;
    } catch {
      // ignore malformed entries
    }
  }
  return `${location.origin}/`;
}

function goBack() {
  location.assign(getPreviousNonVideoUrl());
}

// --- player ---------------------------------------------------------------------------------

function getVideoPlayer() {
  return document.querySelector("video.html5-main-video");
}

function pauseVideo() {
  const player = getVideoPlayer();
  if (player && !player.paused) player.pause();
}

function resumeVideo() {
  const player = getVideoPlayer();
  if (player?.paused) player.play().catch((error) => debugLog("resume failed:", error));
}

// --- warning modal --------------------------------------------------------------------------

async function showWarningModal() {
  pauseVideo();
  previousActiveElement = document.activeElement;

  if (!modalElement) await injectModal();

  modalElement.style.display = "flex";
  modalElement.addEventListener("keydown", handleModalKeydown);
  displayRandomQuote();
  startCountdown();

  // Safe default focus: "No, Go Back".
  setTimeout(() => (modalElement.querySelector("#focusGuardNo") || modalElement).focus(), 50);
}

/** Build the modal with DOM APIs: no HTML parsing, no web-accessible resource needed. */
async function injectModal() {
  const make = (tag, props = {}, ...children) => {
    const element = document.createElement(tag);
    for (const [name, value] of Object.entries(props)) {
      if (name === "text") element.textContent = value;
      else element.setAttribute(name, value);
    }
    element.append(...children);
    return element;
  };

  const yes = make("button", { id: "focusGuardYes", "aria-disabled": "true" },
    "Yes, Continue (", make("span", { id: "countdown", text: String(COUNTDOWN_SECONDS) }), ")");
  const no = make("button", { id: "focusGuardNo", text: "No, Go Back" });

  modalElement = make("div", {
    id: "focusGuardModal",
    class: "focus-guard-modal",
    role: "dialog",
    "aria-modal": "true",
    "aria-labelledby": "modalTitle",
    "aria-describedby": "warningText"
  },
    make("div", { class: "focus-guard-modal-content" },
      make("div", { class: "modal-header" }, make("h2", { id: "modalTitle", text: "Rebound" })),
      make("div", { class: "quote-container", "aria-live": "polite" },
        make("p", { id: "quoteText" }), make("p", { id: "quoteAuthor" })),
      make("div", { class: "warning-message", id: "warningText" },
        make("p", { text: "This content may not align with your focus areas." }),
        make("p", { text: "Do you still want to continue?" })),
      make("div", { class: "button-container" }, no, yes)));

  yes.addEventListener("click", () => {
    if (yes.getAttribute("aria-disabled") === "true") return;
    closeWarningModal();
    resumeVideo();
  });
  no.addEventListener("click", () => {
    closeWarningModal();
    goBack();
  });

  document.body.appendChild(modalElement);
  return true;
}

function closeWarningModal() {
  clearInterval(countdownTimer);
  if (!modalElement || modalElement.style.display === "none") return;

  modalElement.style.display = "none";
  modalElement.removeEventListener("keydown", handleModalKeydown);
  previousActiveElement?.focus?.();
}

function displayRandomQuote() {
  if (typeof getRandomQuote !== "function") return;
  const quote = getRandomQuote();
  const text = modalElement.querySelector("#quoteText");
  const author = modalElement.querySelector("#quoteAuthor");
  if (text && author) {
    text.textContent = `"${quote.text}"`;
    author.textContent = `— ${quote.author}`;
  }
}

/** "Yes, continue" unlocks after a short cooldown: the friction is the point. */
function startCountdown() {
  const countdown = modalElement.querySelector("#countdown");
  const yes = modalElement.querySelector("#focusGuardYes");
  if (!countdown || !yes) return;

  clearInterval(countdownTimer);
  let remaining = COUNTDOWN_SECONDS;
  countdown.textContent = remaining;
  yes.classList.remove("active");
  yes.setAttribute("aria-disabled", "true");

  countdownTimer = setInterval(() => {
    remaining -= 1;
    countdown.textContent = Math.max(remaining, 0);
    if (remaining <= 0) {
      clearInterval(countdownTimer);
      yes.classList.add("active");
      yes.setAttribute("aria-disabled", "false");
    }
  }, 1000);
}

/** Escape closes the modal; Tab is trapped inside it (dialog accessibility). */
function handleModalKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeWarningModal();
    return;
  }
  if (event.key !== "Tab") return;

  const focusable = modalElement.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
  if (focusable.length === 0) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    last.focus();
    event.preventDefault();
  } else if (!event.shiftKey && document.activeElement === last) {
    first.focus();
    event.preventDefault();
  }
}

// --- error toast ----------------------------------------------------------------------------

function showToast(message) {
  document.querySelector(".focus-guard-error")?.remove(); // never stack toasts

  const toast = document.createElement("div");
  toast.className = "focus-guard-error";
  toast.setAttribute("role", "status");
  toast.textContent = `Rebound: ${message || "Unable to analyze video content"}`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// --- start ----------------------------------------------------------------------------------
// Kept at the bottom on purpose: onNavigate() runs immediately and needs every const above.

// `yt-navigate-finish` fires after each SPA navigation (including back/forward);
// `yt-page-data-updated` is a backup for when a page's data is refreshed in place.
window.addEventListener("yt-navigate-finish", onNavigate);
window.addEventListener("yt-page-data-updated", onNavigate);
// Direct loads (or the extension being enabled mid-session) may never emit those events.
onNavigate();
