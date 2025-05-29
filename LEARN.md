# How Rebound Was Built

This document briefly describes the technologies and architecture used to create the Rebound browser extension.

## Core Technologies

The Rebound extension is built using standard web technologies:

*   **JavaScript:** Powers all the dynamic logic of the extension. This includes:
    *   Managing user preferences (keywords, extension state).
    *   Analyzing YouTube video titles and metadata against user-defined keywords.
    *   Displaying warning messages.
    *   Handling interactions within the extension's popup and options pages.
*   **HTML:** Provides the structure for the user interface components:
    *   `popup.html`: The small window that appears when you click the extension icon.
    *   `options.html`: The page where users can configure their keyword lists and settings.
    *   `warning_modal.html`: The alert displayed on YouTube pages for non-preferred content.
*   **CSS:** Styles all the visual elements of the extension to ensure a consistent user experience:
    *   `popup.css`: Styles for the popup.
    *   `options.css`: Styles for the options page.
    *   `warning_style.css`: Styles for the warning modal.

## Browser Extension Framework (WebExtensions API - Manifest V3)

Rebound is developed as a browser extension using the WebExtensions API, specifically adhering to Manifest V3 requirements. Key components of this framework utilized in Rebound include:

*   **`manifest.json`:** This is the central configuration file that defines the extension's properties, permissions, and components (like background scripts, content scripts, and UI elements).
*   **Service Worker (`background.js`):** Handles background tasks such as listening for browser events and managing the overall state of the extension.
*   **Content Scripts (`content_script.js`, `quotes.js`):** These scripts run directly in the context of YouTube web pages. They are responsible for:
    *   Accessing and analyzing video information on the page.
    *   Injecting and displaying the `warning_modal.html` when distracting content is detected.
*   **Popup (`popup.html`, `popup.js`):** The user interface that appears when the extension's icon is clicked, allowing quick access to basic controls like toggling the extension on/off.
*   **Options Page (`options.html`, `options.js`):** A dedicated page for users to customize their preferred and non-preferred keywords and other settings.
*   **Storage API (`chrome.storage`):** Used to save and retrieve user preferences (like keyword lists and the extension's enabled/disabled state) persistently.
*   **Tabs API (`chrome.tabs`):** Potentially used for interacting with YouTube tabs, though specific use cases would be detailed in the code.

## Functionality Overview

In simple terms, Rebound works by:
1.  Allowing users to define lists of "preferred" and "non-preferred" keywords via the Options page. These settings are saved using the browser's storage.
2.  When the user browses YouTube, the extension's content scripts analyze video information (like titles or descriptions provided by YouTube).
3.  If content matching "non-preferred" keywords is detected (and warnings are enabled), the extension displays a modal dialog (`warning_modal.html`) to alert the user, giving them a chance to avoid the video.
4.  The popup provides a quick way to toggle the extension's filtering on or off.

The "AI" in the name "Rebound - AI YouTube Video Filter" refers to the goal of intelligently helping users manage their attention, rather than indicating the use of machine learning models in the current version. The filtering is primarily rule-based, using user-defined keywords.
