# How Rebound Was Built

This document briefly describes the technologies and architecture used to create the Rebound browser extension.

## Core Technologies

The Rebound extension is built using standard web technologies:

*   **JavaScript:** Powers all the dynamic logic of the extension. This includes:
    *   Managing user preferences (keywords, extension state).
    *   Reading the current YouTube video's title, channel and description, and asking the server for a verdict.
    *   Displaying warning messages.
    *   Handling interactions within the extension's popup and options pages.
*   **HTML:** Provides the structure for the user interface components:
    *   `popup.html`: The small window that appears when you click the extension icon.
    *   `options.html`: The page where users can configure their keyword lists and settings.
*   **CSS:** Styles all the visual elements of the extension to ensure a consistent user experience:
    *   `popup.css`: Styles for the popup.
    *   `options.css`: Styles for the options page.
    *   `warning_style.css`: Styles for the warning modal and error toast (injected on YouTube pages).

## Browser Extension Framework (WebExtensions API - Manifest V3)

Rebound is developed as a browser extension using the WebExtensions API, specifically adhering to Manifest V3 requirements. Key components of this framework utilized in Rebound include:

*   **`manifest.json`:** This is the central configuration file that defines the extension's properties, permissions, and components (like background scripts, content scripts, and UI elements).
*   **Service Worker (`background.js`):** Receives each video's details from the content script, asks the analysis server for a verdict (cached per browser session in `chrome.storage.session`) and replies. It keeps no in-memory state, because Manifest V3 service workers are stopped when idle.
*   **Content Scripts (`content_script.js`, `quotes.js`):** These scripts run directly in the context of YouTube web pages. They are responsible for:
    *   Accessing and analyzing video information on the page.
    *   Detecting YouTube's single-page navigation (`yt-navigate-finish`) and building and showing the warning modal when a video is judged distracting.
*   **Popup (`popup.html`, `popup.js`):** The user interface that appears when the extension's icon is clicked, allowing quick access to basic controls like toggling the extension on/off.
*   **Options Page (`options.html`, `options.js`):** A dedicated page for users to customize their preferred and non-preferred keywords and other settings.
*   **Storage API (`chrome.storage`):** Used to save and retrieve user preferences (like keyword lists and the extension's enabled/disabled state) persistently.
*   **No extra permissions:** only `storage` is requested. "Go back" history is kept per tab in `sessionStorage`, so the `tabs` permission isn't needed.

## Functionality Overview

In simple terms, Rebound works by:
1.  Letting users define "preferred" and "non-preferred" keywords on the Options page, saved with the browser's storage.
2.  Detecting when you open a YouTube video (including navigation inside YouTube's single-page app) and reading its title, channel and description.
3.  Sending those, plus your keyword lists, via the background service worker to the Rebound server, which asks an AI model for a one-word verdict (`ALIGNED` or `DISTRACTION`).
4.  Pausing the video and showing a warning modal with a short cooldown if the verdict is `DISTRACTION` and warnings are enabled.
5.  Providing a popup to turn Rebound or its warnings on and off.

The server holds all API keys; the extension contains none.
