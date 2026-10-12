// Episodify Open Cut - Content Script Player Controller

(function () {
  "use strict";

  let activeVideo = null;
  let activeRecipe = null;
  let currentEpisodeIndex = -1;
  let triggeredEpisodeBreaks = new Set();
  let overlayContainer = null;
  let hudBar = null;
  let ignoreCutUntil = 0;

  // Netflix-specific bridge state
  let netflixPlayerActive = false;
  let netflixCurrentTime = 0;

  // Time conversion helpers
  function timestampToSeconds(ts) {
    if (typeof ts === "number") return ts;
    const parts = ts.trim().replace(",", ".").split(":");
    if (parts.length === 3) {
      return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return parseFloat(ts) || 0;
  }

  function secondsToTimestamp(sec) {
    const totalSecs = Math.floor(sec);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  // Cross-platform playback control primitives
  function seekVideo(targetSec) {
    if (location.hostname.includes("netflix.com")) {
      window.postMessage(
        {
          source: "EOC_CONTENT",
          action: "NETFLIX_SEEK",
          timeMs: Math.round(targetSec * 1000),
        },
        "*"
      );
    }

    if (activeVideo) {
      try {
        activeVideo.currentTime = targetSec;
        activeVideo.play().catch(() => {});
      } catch (e) {
        console.warn("[EOC] Native video seek warning:", e);
      }
    }
  }

  function pauseVideo() {
    if (location.hostname.includes("netflix.com")) {
      window.postMessage({ source: "EOC_CONTENT", action: "NETFLIX_PAUSE" }, "*");
    }
    if (activeVideo) {
      try {
        activeVideo.pause();
      } catch (e) {}
    }
  }

  function playVideo() {
    if (location.hostname.includes("netflix.com")) {
      window.postMessage({ source: "EOC_CONTENT", action: "NETFLIX_PLAY" }, "*");
    }
    if (activeVideo) {
      try {
        activeVideo.play().catch(() => {});
      } catch (e) {}
    }
  }

  // Find video player element in DOM
  function findVideoElement() {
    // 1. Direct watch containers (Netflix, Prime, Disney+)
    const specific = document.querySelector(
      ".watch-video video, .VideoContainer video, .scaling-video-container video, video"
    );
    if (specific && (specific.videoWidth > 0 || specific.clientHeight > 0 || specific.readyState >= 1)) {
      return specific;
    }

    // 2. All video elements on page
    const videos = Array.from(document.querySelectorAll("video"));
    if (videos.length === 0) return null;

    // Prefer video currently playing or with largest display area
    return videos.reduce((best, v) => {
      const rect = v.getBoundingClientRect();
      const area = rect.width * rect.height;
      return area > best.area ? { video: v, area } : best;
    }, { video: videos[0], area: 0 }).video;
  }

  // Create or retrieve in-player overlay container
  function ensureOverlayContainer() {
    if (overlayContainer && document.body.contains(overlayContainer)) {
      return overlayContainer;
    }
    overlayContainer = document.createElement("div");
    overlayContainer.id = "eoc-overlay-container";
    document.body.appendChild(overlayContainer);
    return overlayContainer;
  }

  // Create or retrieve in-player HUD bar
  function ensureHudBar() {
    if (hudBar && document.body.contains(hudBar)) {
      return hudBar;
    }
    hudBar = document.createElement("div");
    hudBar.id = "eoc-hud-bar";
    hudBar.style.display = "none";
    document.body.appendChild(hudBar);
    return hudBar;
  }

  // Render episode end modal card
  function showEpisodeBreakModal(episode, nextEpisode) {
    const container = ensureOverlayContainer();
    const isFinalEpisode = !nextEpisode;

    container.innerHTML = `
      <div class="eoc-modal">
        <div class="eoc-header-tags">
          <span class="eoc-badge eoc-badge-act">Part ${episode.episode_number} Complete</span>
          <span class="eoc-badge eoc-badge-cliffhanger">★ Suspense: ${episode.cliffhanger_rating}/10</span>
        </div>
        <h2 class="eoc-title">${episode.title}</h2>
        <div class="eoc-subtitle">
          ${episode.start_time} ➔ ${episode.end_time} &bull; Break Rationale: ${episode.break_rationale}
        </div>

        <div class="eoc-card-body">
          <div class="eoc-panel">
            <div class="eoc-panel-title">Previously On (Recap)</div>
            <p class="eoc-panel-text">${episode.recap_text}</p>
          </div>
          <div class="eoc-panel">
            <div class="eoc-panel-title">${isFinalEpisode ? "Series Concluded" : `Up Next: Part ${nextEpisode.episode_number}`}</div>
            <p class="eoc-panel-text">${isFinalEpisode ? "You have completed the entire miniseries cut!" : nextEpisode.teaser_next}</p>
          </div>
        </div>

        <div class="eoc-actions">
          <button class="eoc-btn eoc-btn-secondary" id="eoc-continue-movie-btn">
            Continue Watching Film
          </button>
          ${!isFinalEpisode ? `
            <button class="eoc-btn eoc-btn-primary" id="eoc-next-episode-btn">
              ▶ Play Part ${nextEpisode.episode_number}: ${nextEpisode.title}
            </button>
          ` : `
            <button class="eoc-btn eoc-btn-primary" id="eoc-replay-btn">
              ↺ Replay Series
            </button>
          `}
        </div>
      </div>
    `;

    container.classList.add("eoc-visible");

    // Event listeners
    const continueBtn = container.querySelector("#eoc-continue-movie-btn");
    continueBtn?.addEventListener("click", () => {
      hideOverlay();
      const cur = activeVideo?.currentTime || netflixCurrentTime || 0;
      ignoreCutUntil = cur + 10;
      playVideo();
    });

    const nextBtn = container.querySelector("#eoc-next-episode-btn");
    nextBtn?.addEventListener("click", () => {
      hideOverlay();
      if (nextEpisode) {
        const targetSec = timestampToSeconds(nextEpisode.start_time);
        seekVideo(targetSec + 0.1);
        ignoreCutUntil = targetSec + 3.0;
      }
    });

    const replayBtn = container.querySelector("#eoc-replay-btn");
    replayBtn?.addEventListener("click", () => {
      hideOverlay();
      triggeredEpisodeBreaks.clear();
      seekVideo(0);
    });
  }

  function hideOverlay() {
    if (overlayContainer) {
      overlayContainer.classList.remove("eoc-visible");
      overlayContainer.innerHTML = "";
    }
  }

  // Update HUD bar during playback
  function updateHud(currentTime) {
    if (!activeRecipe || !activeRecipe.episodes) return;
    const hud = ensureHudBar();

    const currentEp = activeRecipe.episodes.find((ep) => {
      const s = timestampToSeconds(ep.start_time);
      const e = timestampToSeconds(ep.end_time);
      return currentTime >= s && currentTime < e;
    });

    if (!currentEp) {
      hud.style.display = "none";
      return;
    }

    const endSec = timestampToSeconds(currentEp.end_time);
    const remaining = Math.max(0, Math.floor(endSec - currentTime));
    const remMins = Math.floor(remaining / 60);
    const remSecs = remaining % 60;

    hud.innerHTML = `
      <span class="eoc-hud-title">Part ${currentEp.episode_number}: ${currentEp.title}</span>
      <span class="eoc-hud-time">⏱️ ${remMins}m ${remSecs}s remaining in episode</span>
    `;
    hud.style.display = "flex";
  }

  // Main playback monitoring loop
  function checkPlaybackTime(givenTime) {
    if (!activeRecipe || !activeRecipe.episodes) return;
    const curTime = typeof givenTime === "number" ? givenTime : (activeVideo?.currentTime || netflixCurrentTime || 0);

    updateHud(curTime);

    if (curTime < ignoreCutUntil) return;

    for (let i = 0; i < activeRecipe.episodes.length; i++) {
      const ep = activeRecipe.episodes[i];
      const endSec = timestampToSeconds(ep.end_time);

      // Trigger break if video reaches within 0.5s of episode cut timestamp
      if (Math.abs(curTime - endSec) < 0.5 || (curTime >= endSec && curTime < endSec + 1.5)) {
        if (!triggeredEpisodeBreaks.has(ep.episode_number)) {
          triggeredEpisodeBreaks.add(ep.episode_number);
          pauseVideo();
          const nextEp = activeRecipe.episodes[i + 1] || null;
          showEpisodeBreakModal(ep, nextEp);
          break;
        }
      }
    }
  }

  // Attach controller to video element
  function attachVideo(video) {
    if (!video || activeVideo === video) return;
    activeVideo = video;
    console.log("[EOC] Hooked video element:", video);

    video.addEventListener("timeupdate", () => checkPlaybackTime());
    video.addEventListener("seeking", () => {
      const cur = video.currentTime;
      if (activeRecipe?.episodes) {
        triggeredEpisodeBreaks.clear();
        activeRecipe.episodes.forEach((ep) => {
          if (cur > timestampToSeconds(ep.end_time)) {
            triggeredEpisodeBreaks.add(ep.episode_number);
          }
        });
      }
    });
  }

  // Poll / Observe DOM for video player
  function initVideoObserver() {
    const existing = findVideoElement();
    if (existing) attachVideo(existing);

    const observer = new MutationObserver(() => {
      const candidate = findVideoElement();
      if (candidate && candidate !== activeVideo) {
        attachVideo(candidate);
      }
    });
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  // Listen for messages from Netflix MAIN-world bridge
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.source !== "EOC_NETFLIX_BRIDGE") return;
    if (event.data.action === "STATUS_UPDATE") {
      netflixPlayerActive = true;
      netflixCurrentTime = event.data.currentTimeSec;
      checkPlaybackTime(netflixCurrentTime);
    }
  });

  // Listen for extension popup / background messages
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "SET_RECIPE") {
      activeRecipe = msg.recipe;
      triggeredEpisodeBreaks.clear();
      chrome.storage.local.set({ active_recipe: activeRecipe });
      console.log("[EOC] Loaded recipe:", activeRecipe.meta?.title);
      sendResponse({ status: "ok", title: activeRecipe.meta?.title });
      return true;
    } else if (msg.action === "JUMP_TO_EPISODE") {
      if (!activeVideo) {
        const v = findVideoElement();
        if (v) attachVideo(v);
      }
      if (activeRecipe) {
        const ep = activeRecipe.episodes.find((e) => e.episode_number === msg.episode_number);
        if (ep) {
          const targetSec = timestampToSeconds(ep.start_time);
          seekVideo(targetSec);
          ignoreCutUntil = targetSec + 3.0;
          hideOverlay();
          sendResponse({ status: "ok", time: targetSec });
          return true;
        }
      }
      sendResponse({ status: "error", message: "No active recipe or episode found" });
      return true;
    } else if (msg.action === "GET_STATUS") {
      if (!activeVideo) {
        const v = findVideoElement();
        if (v) attachVideo(v);
      }
      const isPlayerReady = !!activeVideo || netflixPlayerActive;
      sendResponse({
        hasVideo: isPlayerReady,
        currentTime: activeVideo ? activeVideo.currentTime : netflixCurrentTime,
        recipeTitle: activeRecipe?.meta?.title || null,
        episodesCount: activeRecipe?.episodes?.length || 0,
      });
      return true;
    }
  });

  // Restore stored recipe on script load
  chrome.storage.local.get(["active_recipe"], (res) => {
    if (res.active_recipe) {
      activeRecipe = res.active_recipe;
      console.log("[EOC] Restored active recipe from storage:", activeRecipe.meta?.title);
    }
  });

  // Initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initVideoObserver);
  } else {
    initVideoObserver();
  }
})();
