# Rebound - AI YouTube Video Filter

Rebound is a browser extension that helps you avoid procrastination on YouTube by analyzing video content and warning you about distracting videos.

## Features

- **AI focus check:** When you open a YouTube video, Rebound asks an AI model whether it fits your focus, using the video's title, channel and description plus your keyword lists.
- **Warning with friction:** A distracting video is paused behind a short "are you sure?" screen with a 5-second cooldown before you can continue.
- **Your keywords steer it:** List topics you want to see and topics that tend to distract you.
- **Easy toggle:** Turn Rebound on or off, or just the warnings, from the popup.

## Privacy

- Rebound only runs on `https://www.youtube.com`. It needs just the `storage` permission (to keep your settings).
- For each video you open, the title, description, channel name and your two keyword lists are sent to Rebound's server, which forwards them to an AI model for a one-word verdict. Nothing else is sent: no account, no watch history, no browsing data.
- The server logs only request sizes, never the content. Requests sent through OpenRouter opt out of provider data collection.
- Your settings live in `chrome.storage.sync`. Verdicts are cached in memory for the browser session only.
- No API keys are in this repository or the extension; the server holds them.

## Installation

1. **Download or clone the repository:**
   ```bash
   git clone https://github.com/Ahmet-Dedeler/rebound.git
   ```
   (Or download the ZIP and extract it)
2. **Open Chrome and go to `chrome://extensions`**.
3. **Enable "Developer mode"** using the toggle switch in the top right corner.
4. **Click on "Load unpacked"**.
5. **Select the directory** where you cloned or extracted the extension files.
6. Rebound should now be installed and active!

## Usage

1.  **Accessing the Extension:**
    *   Click on the Rebound icon in your browser's toolbar to open the popup.

2.  **Configuring Preferences:**
    *   In the popup, you can see your current preferred and non-preferred keywords.
    *   To modify these keywords, right-click the Rebound icon and select "Options", or access it through the `chrome://extensions` page by clicking "Details" on the Rebound card and then "Extension options".
    *   On the Options page:
        *   Enter keywords in the "I want to see" section for content you want to focus on.
        *   Enter keywords in the "I don't want to see" section for content you want to avoid.
        *   Press Enter or click the "+" button to add a keyword.
        *   Click on a keyword to remove it.

3.  **Toggling the Extension:**
    *   Use the power button icon in the top right of the popup to turn the extension on or off. When off, Rebound will not analyze or filter any content.

4.  **Warning Messages:**
    *   In the popup, use the "Warning Messages" toggle to enable or disable the warning prompts for non-preferred content.
    *   When enabled, if the AI judges that a video you open doesn't fit your focus, a warning modal appears and the video is paused, giving you a chance to reconsider.

## Contributing

Contributions are welcome! If you have ideas for improvements or find any bugs, please feel free to:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes.
4.  Submit a pull request.

You can find the project on GitHub: [https://github.com/Ahmet-Dedeler/rebound](https://github.com/Ahmet-Dedeler/rebound)

## License

This project is open source and available under the [MIT License](LICENSE.md).
