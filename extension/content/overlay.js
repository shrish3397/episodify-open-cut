/**
 * Episodify Open Cut - Stealth In-Player Overlay
 * 
 * Engineering Principles:
 * 1. Absolute Style Isolation: Closed/Open Shadow DOM container. Zero CSS leak into/from OTT platforms.
 * 2. Interoperability: Direct standard HTML5 <video> API listeners. Platform-agnostic.
 * 3. 1Hz Throttled Execution: Math.floor(video.currentTime) deduplication prevents 60fps micro-stutters.
 * 4. Classy Stealth UI: Dark glassmorphism, synchronized auto-hide HUD, non-intrusive floating cards.
 */

(function () {
  "use strict";

  // State management
  let activeVideo = null;
  let activeRecipe = null;
  let hostElement = null;
  let shadowRoot = null;
  let cardElement = null;
  let hudElement = null;
  let lastCheckedSec = -1;
  let isBreakActive = false;
  let ignoreCutUntil = 0;
  let triggeredEpisodeBreaks = new Set();
  let hudHideTimer = null;
  let pauseEnforcementInterval = null;

  // Time conversion helpers
  function timestampToSeconds(ts) {
    if (typeof ts === "number") return ts;
    const parts = String(ts).trim().replace(",", ".").split(":");
    if (parts.length === 3) {
      return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(ts) || 0;
  }

  function secondsToTimestamp(sec) {
    if (sec < 0) sec = 0;
    const totalSecs = Math.floor(sec);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // Shadow DOM Styles: 100% isolated glassmorphism
  const SHADOW_STYLES = `
    :host {
      all: initial;
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Inter", Helvetica, Arial, sans-serif;
      box-sizing: border-box;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* Backdrop Dimmer for Episode Break */
    .eoc-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(8, 10, 15, 0.72);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      opacity: 0;
      pointer-events: none;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      z-index: 1000;
    }

    .eoc-backdrop.visible {
      display: flex;
      opacity: 1;
      pointer-events: auto;
    }

    /* Suppress bottom floating HUD pill completely while break card is visible */
    .eoc-backdrop.visible ~ .eoc-hud-pill,
    .eoc-backdrop.visible + .eoc-hud-pill {
      display: none !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }

    /* Classy TV / Menu Option Tab Card */
    .eoc-break-card {
      position: relative;
      max-width: 860px;
      width: 90%;
      background: linear-gradient(145deg, rgba(22, 26, 38, 0.96), rgba(12, 14, 22, 0.98));
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 20px;
      padding: 36px 42px;
      color: #f3f4f6;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15), 0 30px 80px rgba(0, 0, 0, 0.85), 0 0 45px rgba(229, 9, 20, 0.18);
      transform: translateY(20px) scale(0.98);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: auto;
      box-sizing: border-box;
    }

    .eoc-backdrop.visible .eoc-break-card {
      transform: translateY(0) scale(1);
      opacity: 1;
    }

    .eoc-badge-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      gap: 12px;
    }

    .eoc-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .eoc-badge-completed {
      background: rgba(16, 185, 129, 0.18);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.35);
    }

    .eoc-badge-act {
      background: rgba(229, 9, 20, 0.2);
      color: #ff4d58;
      border: 1px solid rgba(229, 9, 20, 0.4);
    }

    .eoc-subhead {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #ff4d58;
      margin-bottom: 6px;
    }

    .eoc-card-title {
      font-size: 30px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #ffffff;
      line-height: 1.22;
      margin-bottom: 8px;
    }

    .eoc-card-meta {
      font-size: 13px;
      color: #9ca3af;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .eoc-meta-dot {
      color: rgba(255, 255, 255, 0.3);
    }

    .eoc-panels {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-bottom: 28px;
    }

    @media (max-width: 640px) {
      .eoc-panels {
        grid-template-columns: 1fr;
      }
    }

    .eoc-panel {
      background: rgba(12, 15, 24, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 18px 20px;
      min-height: 120px;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
    }

    .eoc-panel-next {
      background: linear-gradient(135deg, rgba(229, 9, 20, 0.1), rgba(16, 20, 30, 0.85));
      border: 1px solid rgba(229, 9, 20, 0.35);
      box-shadow: 0 4px 20px rgba(229, 9, 20, 0.12);
    }

    .eoc-panel-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #9ca3af;
      margin-bottom: 8px;
      font-weight: 700;
    }

    .eoc-panel-label-next {
      color: #ff6b75;
    }

    .eoc-panel-text {
      font-size: 14px;
      line-height: 1.6;
      color: #e5e7eb;
      margin: 0;
      flex-grow: 1;
    }

    .eoc-actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 14px;
      flex-wrap: wrap;
    }

    .eoc-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 13px 26px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      font-family: inherit;
    }

    .eoc-btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: #f3f4f6;
      border: 1px solid rgba(255, 255, 255, 0.18);
    }

    .eoc-btn-secondary:hover {
      background: rgba(255, 255, 255, 0.16);
      border-color: rgba(255, 255, 255, 0.3);
      transform: translateY(-1px);
    }

    .eoc-btn-primary {
      background: linear-gradient(135deg, #e50914, #c90812);
      color: #ffffff;
      box-shadow: 0 4px 18px rgba(229, 9, 20, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .eoc-btn-primary:hover {
      background: linear-gradient(135deg, #f40612, #e50914);
      box-shadow: 0 6px 24px rgba(229, 9, 20, 0.65);
      transform: translateY(-1px);
    }

    .eoc-btn:active {
      transform: scale(0.98);
    }

    /* Clean Auto-Vanishing Floating HUD Pill */
    .eoc-hud-pill {
      position: fixed;
      bottom: 76px;
      left: 50%;
      transform: translateX(-50%) translateY(0);
      background: rgba(14, 16, 24, 0.9);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 24px;
      padding: 7px 18px;
      display: flex;
      align-items: center;
      gap: 12px;
      color: #ffffff;
      font-size: 12px;
      font-weight: 500;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
      pointer-events: auto;
      z-index: 500;
      opacity: 1;
      transition: opacity 0.4s ease, transform 0.4s ease;
    }

    .eoc-hud-pill.hidden {
      opacity: 0;
      transform: translateX(-50%) translateY(12px);
      pointer-events: none;
    }

    .eoc-hud-title {
      font-weight: 700;
      color: #ff4d58;
    }

    .eoc-hud-time {
      color: #9ca3af;
    }
  `;

  // Native multi-layer pause (Hotstar / Netflix / Prime / standard HTML5)
  function haltVideoPlayback(targetSec) {
    console.log("[EOC-Shadow] Halting video playback pipeline...");

    const isNetflix = location.hostname.includes("netflix.com");

    // 1. Netflix bridge message
    if (isNetflix) {
      window.postMessage({ source: "EOC_CONTENT", action: "NETFLIX_PAUSE" }, "*");
    }

    const v = activeVideo || document.querySelector("video");

    // 2. Direct HTML5 pause & position lock (Never set currentTime on Netflix directly as it triggers DRM M7375)
    if (v) {
      try {
        v.pause();
        if (typeof targetSec === "number" && !isNetflix && Math.abs(v.currentTime - targetSec) > 1.5) {
          v.currentTime = targetSec;
        }
      } catch (e) {}
    }

    // 3. For non-Netflix OTTs, click native pause button if video did not pause
    if (!isNetflix && v && !v.paused) {
      try {
        const selectors = [
          'button[aria-label*="Pause" i]',
          'button[title*="Pause" i]',
          '[data-testid*="pause" i]',
          'button.play-pause-btn'
        ];
        for (const sel of selectors) {
          const btn = document.querySelector(sel);
          if (btn) {
            btn.click();
            break;
          }
        }
      } catch (e) {}
    }

    // 4. Active enforcement loop during modal display to resist auto-resume
    if (pauseEnforcementInterval) clearInterval(pauseEnforcementInterval);
    pauseEnforcementInterval = setInterval(() => {
      if (!isBreakActive) {
        clearInterval(pauseEnforcementInterval);
        pauseEnforcementInterval = null;
        return;
      }
      if (isNetflix) {
        window.postMessage({ source: "EOC_CONTENT", action: "NETFLIX_PAUSE" }, "*");
      }
      const currentV = activeVideo || document.querySelector("video");
      if (currentV && !currentV.paused) {
        try { currentV.pause(); } catch (e) {}
      }
    }, 200);
  }

  function resumeVideoPlayback() {
    isBreakActive = false;
    if (pauseEnforcementInterval) {
      clearInterval(pauseEnforcementInterval);
      pauseEnforcementInterval = null;
    }

    if (location.hostname.includes("netflix.com")) {
      window.postMessage({ source: "EOC_CONTENT", action: "NETFLIX_PLAY" }, "*");
    }

    const v = activeVideo || document.querySelector("video");
    if (v) {
      // 1. Only click a native play button if it EXPLICITLY is a Play button and NOT a Pause/toggle button
      try {
        const playBtn = document.querySelector(
          'button[aria-label*="Play" i]:not([aria-label*="Pause" i]):not([aria-label*="Playlist" i]), button[title*="Play" i]:not([title*="Pause" i]), [data-testid*="play" i]:not([data-testid*="pause" i])'
        );
        if (playBtn) {
          playBtn.click();
        }
      } catch (e) {}

      // 2. Direct HTML5 video play (if paused)
      if (v.paused) {
        try {
          v.play().catch((err) => {
            console.log("[EOC-Shadow] Video play waiting for buffer:", err);
          });
        } catch (e) {}
      }

      // 3. Fallback verification after 200ms
      setTimeout(() => {
        if (v && v.paused && !isBreakActive) {
          try { v.play().catch(() => {}); } catch (e) {}
        }
      }, 200);
    }

    showHud(7);
  }

  // Seamless seek and playback resume
  function seekAndPlay(targetSec) {
    isBreakActive = false;
    if (pauseEnforcementInterval) {
      clearInterval(pauseEnforcementInterval);
      pauseEnforcementInterval = null;
    }

    const isNetflix = location.hostname.includes("netflix.com");
    if (isNetflix) {
      // Direct exclusively to Netflix main-world API; never mutate video.currentTime directly on Netflix!
      window.postMessage({ source: "EOC_CONTENT", action: "NETFLIX_SEEK", timeMs: Math.round(targetSec * 1000) }, "*");
      window.postMessage({ source: "EOC_CONTENT", action: "NETFLIX_PLAY" }, "*");
      showHud(7);
      return;
    }

    const v = activeVideo || document.querySelector("video");
    if (v) {
      try {
        v.currentTime = targetSec;
      } catch (e) {}

      let resumed = false;
      const doResume = () => {
        if (resumed) return;
        resumed = true;
        try {
          v.removeEventListener("seeked", doResume);
          v.removeEventListener("canplay", doResume);
        } catch (e) {}
        resumeVideoPlayback();
      };

      // Always wait for seeked or canplay event before attempting play
      v.addEventListener("seeked", doResume, { once: true });
      v.addEventListener("canplay", doResume, { once: true });

      // Fallback in case seeked already completed or didn't fire
      setTimeout(doResume, 800);
    } else {
      showHud(7);
    }
  }

  function seekVideoPlayback(targetSec) {
    seekAndPlay(targetSec);
  }

  // Ensure Shadow DOM Host Container is mounted
  function ensureShadowHost() {
    const parentContainer = document.fullscreenElement ||
      document.querySelector(".shaka-video-container, .player-container, [data-testid*='player-container'], .video-player, .webPlayerUIContainer, .rendererContainer, [class*='webPlayer']") ||
      document.body;

    if (!hostElement || !parentContainer.contains(hostElement)) {
      if (hostElement && hostElement.parentNode) {
        hostElement.parentNode.removeChild(hostElement);
      }
      hostElement = document.createElement("div");
      hostElement.id = "eoc-root";

      // Attach Shadow DOM for 100% style isolation
      shadowRoot = hostElement.attachShadow({ mode: "open" });

      const style = document.createElement("style");
      style.textContent = SHADOW_STYLES;
      shadowRoot.appendChild(style);

      // Create Backdrop & Break Card container
      const backdrop = document.createElement("div");
      backdrop.className = "eoc-backdrop";
      backdrop.id = "eoc-backdrop";
      shadowRoot.appendChild(backdrop);
      cardElement = backdrop;

      // Create Floating HUD Pill (auto-vanishes after 6-7 seconds)
      const hud = document.createElement("div");
      hud.className = "eoc-hud-pill hidden";
      hud.id = "eoc-hud";
      shadowRoot.appendChild(hud);
      hudElement = hud;

      parentContainer.appendChild(hostElement);

      setupHudAutohideListeners();
    }
    return shadowRoot;
  }

  // Render episode break modal inside Shadow Root
  function showEpisodeBreakModal(episode, nextEpisode) {
    isBreakActive = true;
    hideHud();
    ensureShadowHost();
    haltVideoPlayback(episode?.end_time ? timestampToSeconds(episode.end_time) : undefined);
    const isFinal = !nextEpisode;

    const rawCurrent = episode.title || "";
    const cleanCurrent = rawCurrent.replace(/^(?:(?:part|episode)\s*\d+[\s:\-–—]+)+/i, "").trim() || rawCurrent;

    const rawNext = nextEpisode?.title || "";
    const cleanNext = rawNext.replace(/^(?:(?:part|episode)\s*\d+[\s:\-–—]+)+/i, "").trim() || rawNext;

    cardElement.innerHTML = `
      <div class="eoc-break-card">
        <div class="eoc-badge-row">
          <span class="eoc-badge eoc-badge-completed">✓ Part ${episode.episode_number} Complete</span>
          ${!isFinal ? `<span class="eoc-badge eoc-badge-act">Part ${nextEpisode.episode_number} Ready</span>` : `<span class="eoc-badge eoc-badge-act">Series Finale</span>`}
        </div>

        ${!isFinal ? `
          <div class="eoc-subhead">UP NEXT</div>
          <h2 class="eoc-card-title">Part ${nextEpisode.episode_number}: ${cleanNext}</h2>
          <div class="eoc-card-meta">
            <span>Starts at <strong>${nextEpisode.start_time}</strong></span>
            <span class="eoc-meta-dot">•</span>
            <span>Finished Part ${episode.episode_number} (${episode.start_time} ➔ ${episode.end_time})</span>
          </div>
        ` : `
          <div class="eoc-subhead">MINISERIES COMPLETED</div>
          <h2 class="eoc-card-title">Part ${episode.episode_number}: ${cleanCurrent}</h2>
          <div class="eoc-card-meta">
            <span>${episode.start_time} ➔ ${episode.end_time}</span>
            <span class="eoc-meta-dot">•</span>
            <span>All episodes completed</span>
          </div>
        `}

        <div class="eoc-panels">
          <div class="eoc-panel">
            <div class="eoc-panel-label">📖 What Just Happened (Part ${episode.episode_number} Recap)</div>
            <p class="eoc-panel-text">${episode.recap_text}</p>
          </div>
          <div class="eoc-panel ${!isFinal ? 'eoc-panel-next' : ''}">
            <div class="eoc-panel-label ${!isFinal ? 'eoc-panel-label-next' : ''}">${isFinal ? "🏆 Series Concluded" : `🎬 Coming Up in Part ${nextEpisode.episode_number}`}</div>
            <p class="eoc-panel-text">${isFinal ? "You have completed the entire miniseries cut!" : nextEpisode.teaser_next}</p>
          </div>
        </div>

        <div class="eoc-actions">
          <button class="eoc-btn eoc-btn-secondary" id="eoc-continue-btn" title="Continue watching the film from this point">
            Continue Watching Film
          </button>
          ${!isFinal ? `
            <button class="eoc-btn eoc-btn-secondary" id="eoc-replay-ep1-btn" title="Restart series from Episode 1">
              ↺ Play Episode 1 Again
            </button>
            <button class="eoc-btn eoc-btn-primary" id="eoc-next-btn" title="Advance to Episode ${nextEpisode.episode_number}">
              ▶ Play Episode ${nextEpisode.episode_number}: ${cleanNext}
            </button>
          ` : `
            <button class="eoc-btn eoc-btn-primary" id="eoc-replay-ep1-btn" title="Replay entire miniseries from Episode 1">
              ↺ Play Episode 1 Again
            </button>
          `}
        </div>
      </div>
    `;

    cardElement.classList.add("visible");

    // Action listeners inside Shadow DOM
    cardElement.querySelector("#eoc-continue-btn")?.addEventListener("click", () => {
      triggeredEpisodeBreaks.add(episode.episode_number);
      hideEpisodeBreakModal();
      const cur = activeVideo?.currentTime || 0;
      ignoreCutUntil = cur + 10;
      resumeVideoPlayback();
    });

    const handleReplayEp1 = () => {
      hideEpisodeBreakModal();
      triggeredEpisodeBreaks.clear();
      ignoreCutUntil = 5.0;
      const ep1Start = activeRecipe?.episodes?.[0]?.start_time
        ? timestampToSeconds(activeRecipe.episodes[0].start_time)
        : 0;
      seekAndPlay(ep1Start);
    };

    cardElement.querySelector("#eoc-replay-ep1-btn")?.addEventListener("click", handleReplayEp1);
    cardElement.querySelector("#eoc-replay-btn")?.addEventListener("click", handleReplayEp1);

    cardElement.querySelector("#eoc-next-btn")?.addEventListener("click", () => {
      triggeredEpisodeBreaks.add(episode.episode_number);
      if (nextEpisode) {
        activeRecipe?.episodes?.forEach((other) => {
          if (other.episode_number <= episode.episode_number) {
            triggeredEpisodeBreaks.add(other.episode_number);
          }
        });
        hideEpisodeBreakModal();
        const targetSec = timestampToSeconds(nextEpisode.start_time);
        ignoreCutUntil = targetSec + 5.0;
        seekAndPlay(targetSec + 0.05);
      }
    });
  }

  function hideEpisodeBreakModal() {
    isBreakActive = false;
    if (pauseEnforcementInterval) {
      clearInterval(pauseEnforcementInterval);
      pauseEnforcementInterval = null;
    }
    if (cardElement) {
      cardElement.classList.remove("visible");
      cardElement.innerHTML = "";
    }
  }

  // Synchronized In-Player Floating HUD (Auto-vanishes after 7 seconds)
  let lastReportedEpisodeNum = null;
  let lastUserActivity = 0;

  function showHud(durationSec = 7) {
    ensureShadowHost();
    if (!hudElement || !activeRecipe || isBreakActive) return;
    updateHudContent();
    hudElement.classList.remove("hidden");
    if (hudHideTimer) clearTimeout(hudHideTimer);
    hudHideTimer = setTimeout(() => {
      if (hudElement) {
        hudElement.classList.add("hidden");
      }
    }, durationSec * 1000);
  }

  function hideHud() {
    if (hudHideTimer) {
      clearTimeout(hudHideTimer);
      hudHideTimer = null;
    }
    if (hudElement) {
      hudElement.classList.add("hidden");
    }
  }

  function updateHudContent() {
    if (!hudElement || !activeRecipe || !activeRecipe.episodes || isBreakActive) {
      return;
    }
    const currentSec = activeVideo ? Math.floor(activeVideo.currentTime) : 0;
    const currentEp = activeRecipe.episodes.find((ep) => {
      const s = timestampToSeconds(ep.start_time);
      const e = timestampToSeconds(ep.end_time);
      return currentSec >= s && currentSec < e;
    });

    if (!currentEp) {
      hideHud();
      return;
    }

    lastReportedEpisodeNum = currentEp.episode_number;

    const endSec = timestampToSeconds(currentEp.end_time);
    const remaining = Math.max(0, endSec - currentSec);
    const remMins = Math.floor(remaining / 60);
    const remSecs = remaining % 60;

    const rawEpTitle = currentEp.title || "";
    const displayTitle = rawEpTitle.toLowerCase().startsWith("part ")
      ? rawEpTitle
      : `Part ${currentEp.episode_number}: ${rawEpTitle}`;

    hudElement.innerHTML = `
      <span class="eoc-hud-title">${displayTitle}</span>
      <span class="eoc-hud-time">⏱️ ${remMins}m ${remSecs}s remaining</span>
    `;
  }

  // 1Hz playback ticker: only updates countdown if already visible. Does NOT unhide or reset vanish timer!
  function updateHud(currentSec) {
    if (!activeRecipe || !activeRecipe.episodes) return;

    // Detect if episode changed during continuous natural playback -> show HUD for 7 seconds
    const currentEp = activeRecipe.episodes.find((ep) => {
      const s = timestampToSeconds(ep.start_time);
      const e = timestampToSeconds(ep.end_time);
      return currentSec >= s && currentSec < e;
    });
    if (currentEp && lastReportedEpisodeNum !== null && lastReportedEpisodeNum !== currentEp.episode_number) {
      lastReportedEpisodeNum = currentEp.episode_number;
      showHud(7);
      return;
    }

    if (!hudElement || hudElement.classList.contains("hidden")) {
      return;
    }

    updateHudContent();
  }

  function setupHudAutohideListeners() {
    const onUserActivity = () => {
      const now = Date.now();
      if (now - lastUserActivity < 1000) return;
      lastUserActivity = now;

      if (activeVideo && !activeVideo.paused && !isBreakActive && activeRecipe) {
        showHud(7);
      }
    };
    window.addEventListener("mousemove", onUserActivity, { passive: true });
    window.addEventListener("keydown", onUserActivity, { passive: true });
  }

  // Check if dialogue or subtitles are currently active on screen across OTT players
  function isSpeechOrSubtitleActive() {
    // 1. Check HTML5 TextTracks
    if (activeVideo && activeVideo.textTracks) {
      for (let i = 0; i < activeVideo.textTracks.length; i++) {
        const t = activeVideo.textTracks[i];
        if (t.mode !== "disabled" && t.activeCues && t.activeCues.length > 0) {
          return true;
        }
      }
    }

    // 2. Check DOM Subtitle / Caption Containers (Hotstar Shaka player, Netflix, Prime, YouTube)
    const subtitleSelectors = [
      ".shaka-text-container",
      "[class*='shaka-text']",
      "[class*='subtitle']",
      "[class*='Subtitle']",
      "[class*='caption']",
      "[class*='Caption']",
      ".player-timedtext",
      ".ytp-caption-segment",
      ".atvwebplayersdk-captions-text",
    ];

    for (const sel of subtitleSelectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const txt = (el.textContent || "").trim();
        if (txt.length > 0) {
          return true;
        }
      }
    }
    return false;
  }

  // Principle 3: Glitch-free 1Hz-throttled evaluation with Active Speech & Scene Silence Guard
  function evaluateCutTimestamp(currentSec) {
    updateHud(currentSec);

    if (!activeRecipe || !activeRecipe.episodes || currentSec < ignoreCutUntil || isBreakActive) return;

    for (let i = 0; i < activeRecipe.episodes.length; i++) {
      const ep = activeRecipe.episodes[i];
      const startSec = timestampToSeconds(ep.start_time);
      const endSec = timestampToSeconds(ep.end_time);

      // Trigger if current natural playback reaches within 0.75s before cut up to 6s after cut.
      // Crucial: Must be within this episode's span, never triggering an earlier episode.
      const isAtCut = currentSec >= (endSec - 0.75) && currentSec <= (endSec + 6.0) && currentSec >= startSec;

      if (isAtCut && !triggeredEpisodeBreaks.has(ep.episode_number)) {
        // Active Dialogue Guard: Wait up to 2.5s past the cut if dialogue/subtitle is on screen
        if (isSpeechOrSubtitleActive() && currentSec < (endSec + 2.5)) {
          console.log(`[EOC-Shadow] Episode ${ep.episode_number} target reached at ${currentSec}s, but dialogue/subtitle is active on screen. Waiting for clean scene silence...`);
          return;
        }

        triggeredEpisodeBreaks.add(ep.episode_number);
        console.log(`[EOC-Shadow] Episode ${ep.episode_number} clean scene break reached at ${currentSec}s (Target: ${endSec}s)! Pausing film.`);
        isBreakActive = true;
        hideHud();
        haltVideoPlayback(currentSec);
        const nextEp = activeRecipe.episodes[i + 1] || null;
        showEpisodeBreakModal(ep, nextEp);
        break;
      }
    }
  }

  // Principle 2: Bind directly to HTML5 video element
  function findBestVideoElement() {
    const videos = Array.from(document.querySelectorAll("video"));
    if (videos.length === 0) return null;
    if (videos.length === 1) return videos[0];

    // Priority 1: Video currently playing with feature length (> 300s)
    const playingFeature = videos.find((v) => !v.paused && v.duration > 300);
    if (playingFeature) return playingFeature;

    // Priority 2: Video currently playing
    const playing = videos.find((v) => !v.paused && v.currentTime > 0);
    if (playing) return playing;

    // Priority 3: Video with substantial duration (> 300s)
    const feature = videos.find((v) => Number.isFinite(v.duration) && v.duration > 300);
    if (feature) return feature;

    // Priority 4: Large visible video element
    const visible = videos.find((v) => v.offsetWidth > 200 && v.offsetHeight > 150);
    if (visible) return visible;

    return activeVideo || videos[0];
  }

  function attachVideoElement(video) {
    if (!video || activeVideo === video) return;
    activeVideo = video;
    console.log("[EOC-Shadow] Attached to standard HTML5 video element:", video);

    // 1Hz throttled timeupdate listener (Principle 3)
    video.addEventListener("timeupdate", () => {
      const currentSec = Math.floor(video.currentTime);
      if (currentSec === lastCheckedSec) return; // Deduplicate: fires at most once per second
      lastCheckedSec = currentSec;
      evaluateCutTimestamp(currentSec);
    });

    video.addEventListener("seeking", () => {
      const cur = Math.floor(video.currentTime);
      if (activeRecipe?.episodes) {
        activeRecipe.episodes.forEach((ep) => {
          const epEnd = timestampToSeconds(ep.end_time);
          if (cur >= epEnd - 1) {
            triggeredEpisodeBreaks.add(ep.episode_number);
          } else if (cur < timestampToSeconds(ep.start_time)) {
            triggeredEpisodeBreaks.delete(ep.episode_number);
          }
        });
      }
    });

    video.addEventListener("play", () => {
      if (!isBreakActive) {
        showHud(7);
      }
    });

    video.addEventListener("pause", () => {
      if (!isBreakActive) {
        showHud(7);
      }
    });
  }

  // Principle 3: Single Page App (SPA) dynamic video mounting observer
  function initEpisodifyOverlay() {
    function checkAndAttachBestVideo() {
      const best = findBestVideoElement();
      if (best && best !== activeVideo) {
        attachVideoElement(best);
        ensureShadowHost();
      }
    }

    checkAndAttachBestVideo();

    const observer = new MutationObserver(() => {
      checkAndAttachBestVideo();
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });

    // Capture play events anywhere in document (e.g. when main feature starts after ad)
    document.addEventListener("play", (e) => {
      if (e.target && e.target.tagName === "VIDEO" && e.target !== activeVideo) {
        attachVideoElement(e.target);
        ensureShadowHost();
      }
    }, true);

    // Fullscreen changes
    document.addEventListener("fullscreenchange", () => {
      ensureShadowHost();
    });
  }

  // Clear active recipe and revert to Standby mode
  function clearRecipe() {
    activeRecipe = null;
    triggeredEpisodeBreaks.clear();
    hideEpisodeBreakModal();
    if (hudElement) {
      hudElement.classList.add("hidden");
      hudElement.innerHTML = "";
    }
    if (pauseEnforcementInterval) {
      clearInterval(pauseEnforcementInterval);
      pauseEnforcementInterval = null;
    }
    isBreakActive = false;
    console.log("[EOC-Shadow] Recipe cleared. Extension in silent Standby mode (native playback untouched).");
  }

  // External / Popup Recipe API
  function setRecipe(recipe) {
    if (!recipe || !recipe.episodes) {
      clearRecipe();
      return;
    }
    activeRecipe = recipe;
    triggeredEpisodeBreaks.clear();
    const cur = activeVideo ? Math.floor(activeVideo.currentTime) : 0;
    activeRecipe.episodes.forEach((ep) => {
      if (cur >= timestampToSeconds(ep.end_time) - 1) {
        triggeredEpisodeBreaks.add(ep.episode_number);
      }
    });
    console.log("[EOC-Shadow] Loaded recipe:", recipe.meta?.title);
    if (activeVideo) {
      showHud(7);
    }
  }

  // Listen for extension messages or window postMessages (standalone demo)
  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.action === "SET_RECIPE") {
        if (msg.recipe) {
          setRecipe(msg.recipe);
          if (msg.assignToUrl) {
            const currentPath = window.location.origin + window.location.pathname;
            chrome.storage?.local?.get(["url_recipe_map"], (res) => {
              const map = res?.url_recipe_map || {};
              map[currentPath] = msg.recipe;
              chrome.storage?.local?.set({ url_recipe_map: map, active_recipe: msg.recipe });
            });
          }
          sendResponse({ status: "ok", title: msg.recipe.meta?.title });
        } else {
          clearRecipe();
          sendResponse({ status: "ok" });
        }
        return true;
      } else if (msg.action === "CLEAR_RECIPE") {
        const currentPath = window.location.origin + window.location.pathname;
        chrome.storage?.local?.get(["url_recipe_map"], (res) => {
          const map = res?.url_recipe_map || {};
          delete map[currentPath];
          chrome.storage?.local?.set({ url_recipe_map: map });
        });
        clearRecipe();
        sendResponse({ status: "ok" });
        return true;
      } else if (msg.action === "JUMP_TO_EPISODE") {
        if (activeRecipe) {
          const ep = activeRecipe.episodes.find((e) => e.episode_number === msg.episode_number);
          if (ep) {
            const sec = timestampToSeconds(ep.start_time);
            // Pre-mark all previous episodes as already triggered so they never falsely pop up
            triggeredEpisodeBreaks.clear();
            activeRecipe.episodes.forEach((other) => {
              if (other.episode_number < ep.episode_number) {
                triggeredEpisodeBreaks.add(other.episode_number);
              }
            });
            hideEpisodeBreakModal();
            ignoreCutUntil = sec + 4;
            seekVideoPlayback(sec + 0.1);
            sendResponse({ status: "ok", time: sec });
          }
        }
      } else if (msg.action === "GET_STATUS") {
        const v = findBestVideoElement();
        const detectedDuration = detectMovieDurationFromPage(v);
        sendResponse({
          hasVideo: !!v,
          currentTime: v ? v.currentTime : 0,
          duration: detectedDuration || (v && Number.isFinite(v.duration) ? v.duration : 0),
          recipeTitle: activeRecipe?.meta?.title || null,
          recipe: activeRecipe,
          episodesCount: activeRecipe?.episodes?.length || 0,
          pageTitle: getRealMovieTitle() || document.title,
          url: window.location.href,
          isStandby: !activeRecipe,
        });
        return true;
      } else if (msg.action === "EXTRACT_SUBTITLES") {
        const v = findBestVideoElement();
        const detectedDuration = detectMovieDurationFromPage(v);
        const cues = [];

        if (v && v.textTracks) {
          for (let i = 0; i < v.textTracks.length; i++) {
            const track = v.textTracks[i];
            if (track.cues && track.cues.length > 0) {
              for (let j = 0; j < track.cues.length; j++) {
                const c = track.cues[j];
                const clean = (c.text || "").replace(/<[^>]+>/g, "").trim();
                if (clean) {
                  cues.push({
                    start: Math.round(c.startTime),
                    end: Math.round(c.endTime),
                    text: clean
                  });
                }
              }
              if (cues.length > 50) break;
            }
          }
        }

        sendResponse({
          hasSubtitles: cues.length > 10,
          cuesCount: cues.length,
          cues: cues.slice(0, 2500),
          duration: detectedDuration || (v && Number.isFinite(v.duration) ? Math.round(v.duration) : 0),
          pageTitle: getRealMovieTitle() || document.title,
          url: window.location.href,
        });
        return true;
      }
    });

    function parseDurationString(text) {
      if (!text) return 0;
      const s = String(text).trim();

      // 1. ISO 8601 duration: PT2H24M, PT144M, PT1H58M12S
      const isoMatch = s.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
      if (isoMatch && (isoMatch[1] || isoMatch[2] || isoMatch[3])) {
        const h = parseInt(isoMatch[1] || "0", 10);
        const m = parseInt(isoMatch[2] || "0", 10);
        const sec = parseInt(isoMatch[3] || "0", 10);
        return h * 3600 + m * 60 + sec;
      }

      // 2. Format: "2 h 24 min", "2 hr 24 m", "2 hours 24 mins", "2h 24m"
      const hrMinMatch = s.match(/(\d+)\s*(?:h|hr|hrs|hours?)\s*(?:(\d+)\s*(?:m|min|mins|minutes?))?/i);
      if (hrMinMatch) {
        const h = parseInt(hrMinMatch[1], 10);
        const m = parseInt(hrMinMatch[2] || "0", 10);
        return h * 3600 + m * 60;
      }

      // 3. Format: "144 min", "144 mins", "144m"
      const minMatch = s.match(/^(\d+)\s*(?:m|min|mins|minutes?)$/i);
      if (minMatch) {
        return parseInt(minMatch[1], 10) * 60;
      }

      // 4. Timestamp format: "02:24:00" or "144:00"
      if (s.includes(":")) {
        const parts = s.split(":").map(Number);
        if (parts.length === 3 && !parts.some(isNaN)) {
          return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2 && !parts.some(isNaN)) {
          return parts[0] * 60 + parts[1];
        }
      }

      return 0;
    }

    function detectMovieDurationFromPage(video) {
      // 1. If video has a valid, finite feature length duration, use it!
      if (video && Number.isFinite(video.duration) && video.duration > 300) {
        return Math.round(video.duration);
      }

      // 2. Prime Video detail page runtime badge: [data-automation-id="runtime-badge"]
      const runtimeBadges = document.querySelectorAll(
        '[data-automation-id="runtime-badge"], [data-automation-id="dp-badges-runtime"], .dv-node-dp-badges span, span[class*="runtime"], span[class*="badge"]'
      );
      for (const badge of runtimeBadges) {
        const parsed = parseDurationString(badge.textContent);
        if (parsed > 300) return parsed;
      }

      // 3. Schema.org metadata (standard on Prime Video, Netflix, IMDb)
      const metaDuration = document.querySelector('meta[itemprop="duration"], meta[property="video:duration"]')?.getAttribute('content');
      if (metaDuration) {
        const parsed = parseDurationString(metaDuration);
        if (parsed > 300) return parsed;
      }

      // 4. JSON-LD scripts
      const jsonLds = document.querySelectorAll('script[type="application/ld+json"]');
      for (const s of jsonLds) {
        try {
          const text = s.textContent || "";
          const m = text.match(/"duration"\s*:\s*"([^"]+)"/);
          if (m && m[1]) {
            const parsed = parseDurationString(m[1]);
            if (parsed > 300) return parsed;
          }
        } catch (e) {}
      }

      // 5. Prime Video player scrubber time indicator
      const playerTimeEl = document.querySelector(
        '.atvwebplayersdk-timeindicator-text, [data-automation-id="total-time"], [class*="timeindicator"], .rendererContainer time'
      );
      if (playerTimeEl) {
        const parsed = parseDurationString(playerTimeEl.textContent);
        if (parsed > 300) return parsed;
      }

      // 6. Netflix duration
      const netflixDur = document.querySelector('span.duration, [data-uia="controls-time-remaining"]')?.textContent;
      if (netflixDur) {
        const parsed = parseDurationString(netflixDur);
        if (parsed > 300) return parsed;
      }

      // 7. Hotstar duration
      const hotstarDur = document.querySelector('span.player-duration, [data-testid="player-duration"]')?.textContent;
      if (hotstarDur) {
        const parsed = parseDurationString(hotstarDur);
        if (parsed > 300) return parsed;
      }

      // If video has any finite duration > 60 (fallback)
      if (video && Number.isFinite(video.duration) && video.duration > 60) {
        return Math.round(video.duration);
      }

      return 0;
    }

    function getRealMovieTitle() {
      // 1. Check exact catalog IDs in pathname or full URL
      const fullUrl = `${window.location.pathname || ""} ${window.location.href || ""}`.toLowerCase();
      if (fullUrl.includes("60021525") || fullUrl.includes("dil chahta") || fullUrl.includes("dil chhata")) return "Dil Chahta Hai";
      if (fullUrl.includes("81760391") || fullUrl.includes("laapataa")) return "Laapataa Ladies";
      if (fullUrl.includes("70270408") || fullUrl.includes("millers")) return "We're the Millers";
      if (fullUrl.includes("0qry75b5jx2obl1p59w9bn0qxn") || fullUrl.includes("queen")) return "Queen";
      if (fullUrl.includes("1271616952") || fullUrl.includes("2 states") || fullUrl.includes("2-states")) return "2 States";
      if (fullUrl.includes("1271525191") || fullUrl.includes("sarvam maya")) return "Sarvam Maya";
      if (fullUrl.includes("1271710275") || fullUrl.includes("bethlehem")) return "Bethlehem Kudumba Unit";

      // 2. Netflix DOM title & OpenGraph tags
      const netflixSelectors = [
        ".video-title h4",
        "[data-uia='video-title']",
        ".watch-video--header-title",
        ".watch-video--header-title-container h4",
        ".watch-video--header-title-container span",
        "[data-uia='watch-video-title']",
        "h4.ellipsize-text",
        ".ellipsize-text",
        ".video-title",
        "[class*='video-title']",
        "[class*='header-title']",
        "h4[class*='title']"
      ];
      for (const sel of netflixSelectors) {
        const el = document.querySelector(sel);
        const txt = (el?.textContent || "").trim();
        if (txt && !["netflix", "watch", "home", "video"].includes(txt.toLowerCase())) {
          return txt;
        }
      }

      // Check Netflix Logo Image alt text
      const netflixLogo = document.querySelector(".title-logo, [data-uia='title-logo'], img[class*='title-logo']");
      if (netflixLogo && netflixLogo.alt && !["netflix", "logo"].includes(netflixLogo.alt.toLowerCase().trim())) {
        return netflixLogo.alt.trim();
      }

      // Check OpenGraph / Meta tags
      const metaTitle = document.querySelector('meta[property="og:title"], meta[name="twitter:title"]')?.getAttribute("content");
      if (metaTitle) {
        let cleanMeta = metaTitle.replace(/^Watch\s+/i, "")
                                 .replace(/\s*\|\s*Netflix.*$/i, "")
                                 .replace(/\s*-\s*Netflix.*$/i, "")
                                 .trim();
        if (cleanMeta && !["netflix", "watch", "home"].includes(cleanMeta.toLowerCase())) {
          return cleanMeta;
        }
      }

      // 3. Prime Video DOM title
      const primeTitle = document.querySelector("[data-automation-id='title'], h1[class*='Title'], h1.dv-node-dp-title")?.textContent?.trim();
      if (primeTitle && !primeTitle.toLowerCase().includes("prime video")) return primeTitle;

      // 4. Hotstar DOM title
      const hotstarTitle = document.querySelector("h1.title, [data-testid='player-title']")?.textContent?.trim();
      if (hotstarTitle) return hotstarTitle;

      // 5. Clean document.title
      let t = (document.title || "").trim();
      t = t.replace(/^Watch\s+/i, "")
           .replace(/\s*\|\s*Netflix.*$/i, "")
           .replace(/\s*-\s*Netflix.*$/i, "")
           .replace(/^Prime Video:\s*/i, "")
           .replace(/\s*\|\s*Prime Video.*$/i, "")
           .replace(/\s*-\s*Prime Video.*$/i, "")
           .replace(/\s*on Disney\+ Hotstar.*$/i, "")
           .replace(/\s*-\s*YouTube.*$/i, "")
           .trim();

      const banned = ["netflix", "prime video", "hotstar", "disney+ hotstar", "youtube", "home", "watch", "video"];
      if (t && !banned.includes(t.toLowerCase())) {
        return t;
      }

      return "";
    }

    const BUILTIN_HOTSTAR_BETHLEHEM_8EP = {
      $schema: "https://episodify.org/schema/v1.json",
      meta: {
        title: "Bethlehem Kudumba Unit (8-Episode Miniseries)",
        year: 2026,
        runtime_seconds: 9313,
        imdb_id: "tt31846512",
        pacing: "comedy",
        generator: "eoc-core"
      },
      total_episodes: 8,
      episodes: [
        { episode_number: 1, title: "Part 1: The Inciting Spark", start_time: "00:00:00", end_time: "00:19:24", cliffhanger_rating: 8.4, break_rationale: "Ashley relocates to Angamaly; her first glimpse of the parish church choir.", recap_text: "Following financial distress, Ashley arrives in Angamaly leaving her old life behind.", teaser_next: "Ashley attends her first Bethlehem Kudumba Unit prayer meeting and meets Justin." },
        { episode_number: 2, title: "Part 2: The Kudumba Unit Spark", start_time: "00:19:24", end_time: "00:38:48", cliffhanger_rating: 8.8, break_rationale: "Ashley joins Justin's choir session; instant chemistry sparks curiosity among unit elders.", recap_text: "Justin introduces Ashley to the parish choir, igniting an immediate musical connection.", teaser_next: "Secret late-night choir rehearsals and scooter rides begin to raise neighborhood eyebrows." },
        { episode_number: 3, title: "Part 3: Rhythms & Rumors", start_time: "00:38:48", end_time: "00:58:12", cliffhanger_rating: 9.1, break_rationale: "Justin and Ashley's secret romance deepens as they narrowly avoid nosy neighbors.", recap_text: "Banter and late-night rehearsals blossom into a secret romance across Angamaly.", teaser_next: "The parish feast arrives as rumors threaten to reach Ashley's conservative family." },
        { episode_number: 4, title: "Part 4: The Parish Feast Confession", start_time: "00:58:12", end_time: "01:17:36", cliffhanger_rating: 9.4, break_rationale: "Justin confesses his feelings before the feast just as family tensions reach a boiling point.", recap_text: "Their performance at the feast captivates the parish, but family scrutiny intensifies.", teaser_next: "An unexpected letter from Dublin arrives, threatening to alter Ashley's future." },
        { episode_number: 5, title: "Part 5: The Ireland Dilemma", start_time: "01:17:36", end_time: "01:37:00", cliffhanger_rating: 9.3, break_rationale: "Ashley receives her student visa for Ireland; family pressure mounts.", recap_text: "With family pressure mounting to secure her future in Dublin, Ashley is torn.", teaser_next: "Justin makes a heartbreaking choice at the midnight tea stall." },
        { episode_number: 6, title: "Part 6: The Airport Farewell", start_time: "01:37:00", end_time: "01:56:24", cliffhanger_rating: 9.7, break_rationale: "Emotional farewell at Cochin airport as Justin selflessly encourages Ashley to board.", recap_text: "Justin chooses Ashley's dreams over his own heartbreak, waving goodbye at gate 4.", teaser_next: "Eighteen months pass in Ireland; a wedding brings Ashley back to Kerala." },
        { episode_number: 7, title: "Part 7: Return to Angamaly", start_time: "01:56:24", end_time: "02:15:48", cliffhanger_rating: 9.2, break_rationale: "Ashley returns from Ireland for the wedding and spots Justin across the church courtyard.", recap_text: "Returning to Kerala after 18 months, Ashley discovers Justin waiting by the parish gate.", teaser_next: "The wedding ceremony begins as Ashley and Justin confront unspoken feelings." },
        { episode_number: 8, title: "Part 8: Harmonies of Bethlehem", start_time: "02:15:48", end_time: "02:35:13", cliffhanger_rating: 8.0, break_rationale: "Grand finale: the full choir harmonizes at the ceremony, reuniting Ashley and Justin in triumph.", recap_text: "Ashley and Justin reunite in a joyful, musical celebration at the parish hall.", teaser_next: "Series finale concludes the 8-episode miniseries cut of Bethlehem Kudumba Unit!" }
      ]
    };

    const BUILTIN_HOTSTAR_SARVAM_MAYA_6EP = {
      $schema: "https://episodify.org/schema/v1.json",
      meta: {
        title: "Sarvam Maya (6-Episode Miniseries)",
        year: 2025,
        runtime_seconds: 8760,
        imdb_id: "tt33096053",
        pacing: "comedy",
        generator: "eoc-core"
      },
      total_episodes: 6,
      episodes: [
        { episode_number: 1, title: "Part 1: The Reluctant Priest", start_time: "00:00:00", end_time: "00:24:20", cliffhanger_rating: 8.6, break_rationale: "Struggling atheist musician Prabhendu is forced to return to his ancestral Palakkad roots and don the sacred thread as a temple priest to settle debts.", recap_text: "In debt and failing as an independent musician, Prabhendu abandons city life and reluctantly accepts his family's traditional priesthood.", teaser_next: "An eerie midnight ritual in the ancestral shrine introduces an impossible visitor." },
        { episode_number: 2, title: "Part 2: The Delulu Phenomenon", start_time: "00:24:20", end_time: "00:48:40", cliffhanger_rating: 9.2, break_rationale: "Prabhendu encounters the eccentric spirit Delulu/Maya, turning his rigid rationalism upside down.", recap_text: "Prabhendu struggles through temple rituals until a young ghost named Maya begins haunting and communicating exclusively with him.", teaser_next: "Maya insists Prabhendu help her fulfill an unfinished earthly longing before she can cross over." },
        { episode_number: 3, title: "Part 3: Spirits & Sacred Threads", start_time: "00:48:40", end_time: "01:13:00", cliffhanger_rating: 8.9, break_rationale: "Comedic chaos erupts as friend Roopesh suspects Prabhendu is losing his sanity while Maya intervenes in temple pujas.", recap_text: "Prabhendu juggles priestly duties with Maya's unpredictable antics, sparking town gossip and suspicion from Roopesh.", teaser_next: "Maya's past life begins to unravel, revealing a poignant connection to Prabhendu's own musical youth." },
        { episode_number: 4, title: "Part 4: The Past Awakes", start_time: "01:13:00", end_time: "01:37:20", cliffhanger_rating: 9.5, break_rationale: "A shocking revelation regarding Maya's sudden demise brings Saadhya and Prabhendu into emotional conflict.", recap_text: "As Prabhendu investigates Maya's history, buried secrets about family expectations and unfulfilled promises come to light.", teaser_next: "A crucial confrontation at the ancestral temple festival forces Prabhendu to take a stand." },
        { episode_number: 5, title: "Part 5: Maya's Truth", start_time: "01:37:20", end_time: "02:01:40", cliffhanger_rating: 9.4, break_rationale: "The truth about Delulu's boundary between life and death is unveiled during an intense spiritual crossroads.", recap_text: "Prabhendu risks his reputation to perform a unique musical ceremony to bring closure to Maya's lingering spirit.", teaser_next: "The final spiritual transition arrives as Prabhendu confronts his own fears and rediscovers his musical soul." },
        { episode_number: 6, title: "Part 6: Beyond the Illusion", start_time: "02:01:40", end_time: "02:26:00", cliffhanger_rating: 8.3, break_rationale: "Triumphant resolution as Prabhendu finds peace, reconciles his faith with his music, and bids a bittersweet farewell to Maya.", recap_text: "In a moving and humorous climax, Prabhendu harmonizes temple tradition with his musical destiny, transformed by Maya's memory.", teaser_next: "Series finale concludes the supernatural fantasy miniseries cut of Sarvam Maya!" }
      ]
    };

    const BUILTIN_NETFLIX_MILLERS_4EP = {
      $schema: "https://episodify.org/schema/v1.json",
      meta: {
        title: "We're the Millers (4-Episode Miniseries)",
        year: 2013,
        runtime_seconds: 6540,
        imdb_id: "tt1723121",
        pacing: "comedy",
        generator: "eoc-core"
      },
      total_episodes: 4,
      episodes: [
        { episode_number: 1, title: "Part 1: The Fake Family Assembles", start_time: "00:00:00", end_time: "00:27:15", cliffhanger_rating: 8.7, break_rationale: "David is robbed and forced into a Mexican drug run, assembling the fake Miller family.", recap_text: "Pot dealer David Clark is forced to clear his debt by smuggling weed from Mexico with a fake family.", teaser_next: "The Millers cross into Mexico, finding the shipment far bigger and more dangerous than promised." },
        { episode_number: 2, title: "Part 2: A Smidge of Trouble", start_time: "00:27:15", end_time: "00:54:30", cliffhanger_rating: 9.2, break_rationale: "The Millers cross the border with two tons of weed, only to be towed by a friendly DEA agent.", recap_text: "David discovers he stole two tons of cartel weed, sweating through border checks and meeting DEA agent Don.", teaser_next: "Cartel henchmen close in as the Millers are cornered at a secluded warehouse." },
        { episode_number: 3, title: "Part 3: Spiders & Stripteases", start_time: "00:54:30", end_time: "01:21:45", cliffhanger_rating: 9.5, break_rationale: "Chacon captures the Millers; Rose's striptease creates an escape while Kenny gets a spider bite.", recap_text: "Rose saves the family with an impromptu warehouse dance, while Kenny suffers a venomous spider bite.", teaser_next: "David faces a choice between running with the money or rescuing his fake family." },
        { episode_number: 4, title: "Part 4: The 4th of July Finale", start_time: "01:21:45", end_time: "01:49:00", cliffhanger_rating: 8.9, break_rationale: "David chooses family over drug money, busting Gurdlinger and entering witness protection together.", recap_text: "Overcoming greed and fireworks showdowns, the Millers bust the kingpin and become a real family.", teaser_next: "Series finale concludes the uproarious comedy miniseries cut of We're the Millers." }
      ]
    };

    const BUILTIN_HOTSTAR_2STATES_4EP = {
      $schema: "https://episodify.org/schema/v1.json",
      meta: {
        title: "2 States (4-Episode Miniseries)",
        year: 2014,
        runtime_seconds: 8940,
        imdb_id: "tt2372678",
        pacing: "romance_drama",
        generator: "eoc-core"
      },
      total_episodes: 4,
      episodes: [
        { episode_number: 1, title: "Part 1: The Ahmedabad Spark", start_time: "00:00:00", end_time: "00:39:20", cliffhanger_rating: 8.8, break_rationale: "The Convocation ceremony concludes at IIM Ahmedabad as caps are tossed in the air; Krish and Ananya vow not to elope, parting ways to Delhi and Chennai to convince their families.", recap_text: "Punjabi Krish and Tamilian Ananya fall deeply in love at IIM Ahmedabad, navigating college life and cultural differences.", teaser_next: "Their families meet at Convocation, unleashing an immediate, hostile clash of cultures." },
        { episode_number: 2, title: "Part 2: Cultural Crossfire", start_time: "00:39:20", end_time: "01:16:30", cliffhanger_rating: 9.4, break_rationale: "Krish transfers to Chennai and wins over the Swaminathan family with his workplace presentation; Ananya's parents agree to the marriage before departing for Delhi.", recap_text: "Attempts to bring both families together collapse into regional prejudices and family drama.", teaser_next: "Krish takes a job transfer to Chennai, embarking on a mission to win over Ananya's strict parents." },
        { episode_number: 3, title: "Part 3: The Chennai Mission", start_time: "01:16:30", end_time: "01:53:40", cliffhanger_rating: 9.3, break_rationale: "The formal engagement dinner in Delhi erupts into a disastrous family confrontation; heartbroken, Krish and Ananya part ways and break the engagement.", recap_text: "In Chennai, Krish wins over Ananya's father, but the formal engagement in Delhi collapses in mutual insults.", teaser_next: "Heartbroken and separated, Krish confronts his estranged father Vikram in Delhi as a final chance to save their love." },
        { episode_number: 4, title: "Part 4: Two States, One Union", start_time: "01:53:40", end_time: "02:29:00", cliffhanger_rating: 8.5, break_rationale: "Krish's estranged father makes an unexpected gesture of reconciliation in Chennai, bringing both families together for a joyous traditional temple wedding.", recap_text: "Seeing his son's agony, Krish's father travels to Chennai to apologize, bringing the families together in heartwarming unity.", teaser_next: "Series finale concludes the beloved romantic comedy-drama miniseries cut of 2 States." }
      ]
    };

    const BUILTIN_PRIME_QUEEN_4EP = {
      $schema: "https://episodify.org/schema/v1.json",
      meta: {
        title: "Queen (4-Episode Miniseries)",
        year: 2014,
        runtime_seconds: 8640,
        imdb_id: "tt3322420",
        pacing: "comedy_drama",
        generator: "eoc-core"
      },
      total_episodes: 4,
      episodes: [
        { episode_number: 1, title: "Part 1: The Solo Honeymoon", start_time: "00:00:00", end_time: "00:36:20", cliffhanger_rating: 8.9, break_rationale: "Crushed by Vijay calling off their wedding at the Delhi cafe, a devastated Rani makes the courageous decision to embark on their pre-booked Paris honeymoon completely alone, stepping out into the bustling European night.", recap_text: "In Rajouri Garden, Delhi, conservative bride Rani's world shatters when fiancé Vijay calls off their wedding one day before the ceremony. Defying family expectations, Rani packs her bags for Paris alone.", teaser_next: "Stranded in Paris with no international travel experience, Rani faces culture shock, lost directions, and a chaotic street confrontation." },
        { episode_number: 2, title: "Part 2: Parisian Freedom", start_time: "00:36:20", end_time: "01:12:45", cliffhanger_rating: 9.3, break_rationale: "After an exhilarating, liberating night across Paris with free-spirited Vijaylaxmi, Rani boards the train to Amsterdam transformed, only to discover her new budget hostel room is shared with three unfamiliar foreign men.", recap_text: "In Paris, vibrant Indo-French hotel worker Vijaylaxmi takes Rani under her wing, helping her overcome heartbreak and taste independence for the first time.", teaser_next: "Rani arrives in free-spirited Amsterdam and must navigate sharing a tiny hostel room with three boisterous male roommates." },
        { episode_number: 3, title: "Part 3: The Amsterdam Awakening", start_time: "01:12:45", end_time: "01:48:30", cliffhanger_rating: 9.5, break_rationale: "Rani triumphs at the Amsterdam street festival cooking Delhi golgappas and winning the crowd, but as she celebrates with her roommates, a guilt-ridden Vijay unexpectedly arrives in Amsterdam begging for her forgiveness.", recap_text: "Overcoming initial awkwardness, Rani forms an unbreakable bond with hostel roommates Taka, Tim, and Oleksandr, discovering her entrepreneurial passion making street snacks.", teaser_next: "Vijay corners Rani in Amsterdam, demanding she return to domestic life just as Rani discovers the power of her own independence." },
        { episode_number: 4, title: "Part 4: The Triumphant Return", start_time: "01:48:30", end_time: "02:24:00", cliffhanger_rating: 8.6, break_rationale: "Rani lovingly bids farewell to her European companions, returns to Delhi, and visits Vijay only to calmly return his engagement ring with a radiant, liberating smile of absolute self-worth.", recap_text: "Rejecting Vijay's regressive demands, Rani chooses herself, turning heartbreak into a triumphant celebration of womanhood and self-realization.", teaser_next: "Series finale concludes the beloved coming-of-age comedy-drama miniseries cut of Queen." }
      ]
    };

    const BUILTIN_NETFLIX_LAAPATAA_4EP = {
      $schema: "https://episodify.org/schema/v1.json",
      meta: {
        title: "Laapataa Ladies (4-Episode Miniseries)",
        year: 2024,
        runtime_seconds: 7455,
        imdb_id: "tt22262440",
        pacing: "comedy_drama",
        generator: "eoc-core"
      },
      total_episodes: 4,
      episodes: [
        { episode_number: 1, title: "Part 1: The Veil of Confusion", start_time: "00:00:00", end_time: "00:31:30", cliffhanger_rating: 8.9, break_rationale: "Deepak disembarks in his village only to uncover the horrifying truth that he brought home the wrong veiled bride; miles away, Phool awakens stranded alone at an unfamiliar railway platform.", recap_text: "In rural 2001 India, newlyweds Deepak and Phool travel home on a packed night train with identical veiled brides. In the nighttime disembarkation chaos, Deepak accidentally leads the wrong bride home.", teaser_next: "Deepak launches a frantic search across the district as Phool struggles to survive stranded at the remote station." },
        { episode_number: 2, title: "Part 2: Stranded in Pateela", start_time: "00:31:30", end_time: "01:01:45", cliffhanger_rating: 9.2, break_rationale: "Cynical Inspector Shyam Manohar suspects foul play when he finds pawned jewelry, realizing the quiet bride in Deepak's home is operating under an alias with a hidden agenda.", recap_text: "At the railway station, kindly tea-stall owner Manju Maai takes Phool under her wing. Meanwhile, Deepak files a missing bride report as suspicion mounts around his veiled houseguest.", teaser_next: "Missing person sketches circulate across the state as Shyam Manohar closes in on Jaya's secret past." },
        { episode_number: 3, title: "Part 3: The Sketch & The Secret", start_time: "01:01:45", end_time: "01:34:00", cliffhanger_rating: 9.5, break_rationale: "Shyam Manohar discovers Jaya's admission letter to Dehradun Agricultural University and prepares to arrest her, just as her abusive husband tracks her down to the police station.", recap_text: "Jaya shares her dream of modern organic farming with Deepak's family. At the station, Phool learns self-reliance making snacks, but Deepak's missing posters struggle to reach her.", teaser_next: "With corrupt forces and a vengeful husband closing in, Jaya faces her final chance to reclaim her freedom and reunite Deepak with Phool." },
        { episode_number: 4, title: "Part 4: The Path to Surajmukhi", start_time: "01:34:00", end_time: "02:04:15", cliffhanger_rating: 8.5, break_rationale: "Shyam Manohar tears up the arrest warrant to set Jaya free; Deepak finally spots Phool at the railway station for a tearful, heartwarming reunion as both brides reclaim their destiny.", recap_text: "Overcoming rural prejudices and mistaken identities, Shyam Manohar protects Jaya, while Deepak and Phool reunite in an emotional station climax.", teaser_next: "Series finale concludes the beloved comedy-drama miniseries cut of Laapataa Ladies." }
      ]
    };

    function doesRecipeMatchPage(recipe) {
      if (!recipe || !recipe.meta) return false;
      const realTitle = (getRealMovieTitle() || "").toLowerCase();
      const pathname = (window.location.pathname || "").toLowerCase();

      // 1. Check IMDb ID if present
      const imdbId = (recipe.meta.imdb_id || "").toLowerCase();
      if (imdbId && (pathname.includes(imdbId) || realTitle.includes(imdbId))) {
        return true;
      }

      // 2. Clean film title (remove parentheticals, episode counts, year)
      const rawTitle = (recipe.meta.title || "").toLowerCase();
      const cleanTitle = rawTitle
        .replace(/\(.*?\)/g, "")
        .replace(/\[.*?\]/g, "")
        .replace(/part \d+/g, "")
        .replace(/miniseries/g, "")
        .replace(/cut/g, "")
        .trim();

      if (!cleanTitle || cleanTitle.length < 3) return false;

      // Block generic platform names
      const genericNames = ["netflix", "prime video", "primevideo", "hotstar", "disney", "youtube", "movie", "video", "home", "feature film"];
      if (genericNames.includes(cleanTitle)) {
        return false;
      }

      // 3. Exact slug check against pathname or realTitle
      const slug = cleanTitle.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      if (slug && (pathname.includes(slug) || realTitle.includes(slug.replace(/-/g, " ")))) {
        return true;
      }

      // 4. Multi-word phrase check
      const words = cleanTitle.split(/\s+/).filter((w) => w.length >= 2);
      if (words.length >= 2) {
        const phrase = words.join(" ");
        if (realTitle.includes(phrase)) return true;
        const hyphenPhrase = words.join("-");
        if (pathname.includes(hyphenPhrase)) return true;
        return false;
      } else if (words.length === 1 && words[0].length >= 3) {
        return new RegExp(`\\b${words[0]}\\b`, "i").test(realTitle);
      }

      return false;
    }

    function evaluatePageRecipe() {
      const realTitle = (getRealMovieTitle() || "").toLowerCase();
      const pathname = (window.location.pathname || "").toLowerCase();

      // 1. Auto-detect if current page is one of our verified built-in cuts (using exact ID or word-boundary title)
      if (pathname.includes("0qry75b5jx2obl1p59w9bn0qxn") || (realTitle && /\bqueen\b/i.test(realTitle))) {
        setRecipe(BUILTIN_PRIME_QUEEN_4EP);
        return;
      }
      if (pathname.includes("81760391") || (realTitle && (/\blaapataa\b/i.test(realTitle) || /\blaapta\b/i.test(realTitle)))) {
        setRecipe(BUILTIN_NETFLIX_LAAPATAA_4EP);
        return;
      }
      if (pathname.includes("1271616952") || (realTitle && /\b2\s*states\b/i.test(realTitle))) {
        setRecipe(BUILTIN_HOTSTAR_2STATES_4EP);
        return;
      }
      if (pathname.includes("70270408") || (realTitle && /\bmillers\b/i.test(realTitle))) {
        setRecipe(BUILTIN_NETFLIX_MILLERS_4EP);
        return;
      }
      if (pathname.includes("1271525191") || (realTitle && /\bsarvam\b/i.test(realTitle))) {
        setRecipe(BUILTIN_HOTSTAR_SARVAM_MAYA_6EP);
        return;
      }
      if (pathname.includes("1271710275") || (realTitle && /\bbethlehem\b/i.test(realTitle))) {
        setRecipe(BUILTIN_HOTSTAR_BETHLEHEM_8EP);
        return;
      }

      // 2. Check if user explicitly assigned a recipe to this URL / path
      const currentPath = window.location.origin + window.location.pathname;
      chrome.storage?.local?.get(["url_recipe_map", "active_recipe"], (res) => {
        const urlMap = res?.url_recipe_map || {};
        if (urlMap[currentPath]) {
          console.log("[EOC-Shadow] Restored user-assigned recipe for this URL:", urlMap[currentPath].meta?.title);
          setRecipe(urlMap[currentPath]);
          return;
        }

        // 3. If storage has active_recipe, ONLY accept if it genuinely matches this page (and not a generic title)
        const isGeneric = ["netflix", "prime video", "movie", "feature film"].some((g) => (res?.active_recipe?.meta?.title || "").toLowerCase().includes(g));
        if (res?.active_recipe && !isGeneric && doesRecipeMatchPage(res.active_recipe)) {
          console.log("[EOC-Shadow] Verified stored recipe matches current page:", res.active_recipe.meta?.title);
          setRecipe(res.active_recipe);
          return;
        }

        // 4. UNMATCHED VIDEO: Stay in Silent Standby Mode! Zero HUD, zero pauses.
        clearRecipe();
      });
    }

    // Initial check
    evaluatePageRecipe();

    // Track SPA URL changes (Hotstar, Netflix, YouTube) so navigating away returns to Standby
    let lastObservedUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastObservedUrl) {
        lastObservedUrl = window.location.href;
        console.log("[EOC-Shadow] Page URL change detected:", lastObservedUrl);
        evaluatePageRecipe();
      }
    }, 1200);
  }

  window.addEventListener("message", (event) => {
    if (event.data?.action === "SET_RECIPE" && event.data.recipe) {
      setRecipe(event.data.recipe);
    } else if (event.data?.action === "CLEAR_RECIPE") {
      clearRecipe();
    }
  });

  // Expose API for standalone testing & simulation
  window.EpisodifyOverlay = {
    init: initEpisodifyOverlay,
    setRecipe: setRecipe,
    clearRecipe: clearRecipe,
    showModal: showEpisodeBreakModal,
    hideModal: hideEpisodeBreakModal,
    halt: haltVideoPlayback,
    resume: resumeVideoPlayback,
  };

  // Auto-init on page ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEpisodifyOverlay);
  } else {
    initEpisodifyOverlay();
  }
})();
