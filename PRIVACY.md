# Privacy Policy for Episodify: Open Cut

**Last Updated:** October 2026

Episodify: Open Cut is built on the principle of **Zero-Data Collection** and complete user privacy.

## 1. Zero Data Collection
Episodify does **not** collect, store, transmit, or sell any personal data, browsing history, user identifiers, or analytics.

## 2. Local Browser Storage Only
The extension uses the `chrome.storage.local` API solely to:
- Save custom episode cut preferences (e.g., active recipe for a movie).
- Store cached `.eoc.json` recipes locally in your own browser.
This data never leaves your computer and is never transmitted to any external server.

## 3. Streaming Player Interaction
The extension runs client-side scripts (`content/overlay.js`) on supported streaming domains (Netflix, Hotstar, Prime Video, YouTube) exclusively to:
- Detect the video player's current playback timestamp.
- Pause the video and render the episode break modal and HUD overlay.
Episodify does **not** inspect, record, decrypt, scrape, or transmit any video content or account credentials.

## 4. Open Source & Auditability
Episodify is 100% open-source under the GNU AGPL-3.0 license. The entire codebase is publicly auditable at:  
https://github.com/shrish3397/episodify-open-cut

## 5. Contact
For any questions regarding privacy or the extension:
- **GitHub Issues**: https://github.com/shrish3397/episodify-open-cut/issues
