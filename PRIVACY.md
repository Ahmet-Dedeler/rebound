# Rebound Privacy Policy

_Last updated: 2026-10-16_

Rebound is a Chrome extension that warns you when a YouTube video doesn't fit your focus. This page explains exactly what data it handles.

## What Rebound sends off your device

When you open a YouTube video (`https://www.youtube.com/watch?...`), Rebound sends the following to its analysis server (`ai-youtube-extension-server.vercel.app`):

- the video's **title**, **description snippet** and **channel name** (website content already visible on the page), and
- your two **keyword lists** ("I want to see" / "I don't want to see").

The server passes this to an AI model (through Hack Club AI, with OpenRouter as a fallback) and returns a single verdict: aligned or distracting. That's the only purpose.

## What Rebound does not do

- It does not collect your name, email, account, watch history, search history, cookies, IP-based profile or any browsing data outside the video you just opened.
- It does not run on any site other than `www.youtube.com`.
- It does not sell or share your data, use it for advertising, or use it for anything unrelated to the verdict above.
- It contains no analytics or trackers, and loads no remote code, fonts or scripts.

## What is stored, and where

- **Your keyword lists and on/off settings** are stored with `chrome.storage.sync`, so Chrome may sync them across your signed-in browsers. Rebound's server never receives or stores anything else about you.
- **Verdicts** are cached in `chrome.storage.session` (cleared when you close the browser) so a video you already judged isn't analyzed twice.
- **The server** keeps no database and does not store request content. Its logs record only request sizes and errors. Its host (Vercel) and the AI providers process requests in order to respond, under their own policies. Requests sent through OpenRouter opt out of provider data collection.

## Your control

Turn Rebound off or pause the warnings any time from the toolbar popup, or remove the extension to stop all processing. Your keyword lists can be cleared from the options page.

## Contact

Questions or concerns: open an issue at https://github.com/Ahmet-Dedeler/rebound/issues or visit https://ahmetdedeler.com.
