# Authors & Intellectual Property Attribution

## Project Creator & Lead Architect

* **Original Creator & System Architect**: Shrishti Singh Thakur ([@shrish3397](https://github.com/shrish3397))
  * **Project**: Episodify Open Cut (`episodify-open-cut`)
  * **Repository**: https://github.com/shrish3397/episodify-open-cut

---

## Original Contributions & Protocol Ownership

The creator listed above authored and established the original prior art, system design, and open standards for **Episodify Open Cut**, including:

1. **The `.eoc.json` Open Specification (v1)**: Designed the standardized schema for mapping narrative boundaries, cliffhanger ratings, break rationales, recaps, and episode title cards.
2. **Zero-DRM Metadata Overlay Architecture**: Designed the client-side metadata protocol for overlaying native streaming video players (Netflix, Hotstar, Prime Video, YouTube) without touching or decrypting copyrighted streams.
3. **`eoc-core` Engine Architecture**: Engineered the core Python CLI suite integrating multimodal Gemini 3.8 Flash, local Ollama, and offline heuristic engines for screenplay beat detection.
4. **Micro-Cut Silence Snapper**: Developed the dialogue guard algorithm enforcing silence lulls ($\ge 3.0\text{s}$) with active subtitle sniffer to prevent mid-sentence audio cuts.
5. **Manifest V3 Browser Extension**: Built the client-side extension and interactive demo player for rendering cinematic overlays over OTT platforms.

---

## Licensing & Copyright Notice

This project is open-source software licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**. 

Any redistribution, derivative work, or commercial hosting of this codebase or schema must maintain original author attribution as specified in the [LICENSE](LICENSE) and this file.
