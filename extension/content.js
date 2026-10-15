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
  let isBreakModalActive = false;
  let pauseEnforcementInterval = null;

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

    const v = activeVideo || findVideoElement();
    if (v) {
      try {
        v.currentTime = targetSec;
        v.play().catch(() => {});
        console.log("[EOC] Native video seeked to:", targetSec);
      } catch (e) {
        console.warn("[EOC] Native video seek warning:", e);
      }
    }
  }

  function pauseVideo(clampSec) {
    console.log("[EOC] pauseVideo() invoked. Halting OTT playback pipeline...");

    // 1. Netflix bridge message
    if (location.hostname.includes("netflix.com")) {
      window.postMessage({ source: "EOC_CONTENT", action: "NETFLIX_PAUSE" }, "*");
    }

    const v = activeVideo || findVideoElement();

    // 2. Direct HTML5 video pause & optional clamp
    if (v) {
      try {
        v.pause();
        if (typeof clampSec === "number") {
          v.currentTime = clampSec;
        }
      } catch (e) {
        console.warn("[EOC] Direct video pause warning:", e);
      }
    }

    // 3. Dispatch Spacebar and 'k' keyboard events to player, document, and window
    // (Crucial for Hotstar, YouTube, Prime Video whose player controllers listen to keyboard events)
    try {
      const keyEvents = [
        { key: " ", code: "Space", keyCode: 32, which: 32 },
        { key: "k", code: "KeyK", keyCode: 75, which: 75 },
      ];
      const targets = [
        v,
        v?.parentElement,
        document.activeElement,
        document.querySelector(".shaka-video-container, .player-container, [data-testid*='player'], .video-player"),
        document.body,
        document,
        window,
      ].filter(Boolean);

      keyEvents.forEach(({ key, code, keyCode, which }) => {
        targets.forEach((target) => {
          try {
            target.dispatchEvent(new KeyboardEvent("keydown", {
              key, code, keyCode, which, bubbles: true, cancelable: true, composed: true
            }));
            target.dispatchEvent(new KeyboardEvent("keyup", {
              key, code, keyCode, which, bubbles: true, cancelable: true, composed: true
            }));
          } catch (e) {}
        });
      });
    } catch (err) {
      console.warn("[EOC] Keyboard pause dispatch warning:", err);
    }

    // 4. Click native OTT player pause button if currently visible in DOM
    try {
      const pauseSelectors = [
        'button[aria-label="Pause"]',
        'button[aria-label="Pause (k)"]',
        'button[aria-label*="Pause" i]',
        'button[title*="Pause" i]',
        '[data-testid="player-pause-button"]',
        'button[data-testid*="pause" i]',
        'button.play-pause-btn',
        '.shaka-controls-button-info[aria-label*="pause" i]',
        'button.control-btn[aria-label*="pause" i]',
      ];
      for (const sel of pauseSelectors) {
        const btn = document.querySelector(sel);
        if (btn) {
          btn.click();
          console.log("[EOC] Clicked native OTT pause button:", sel);
          break;
        }
      }
    } catch (btnErr) {
      console.warn("[EOC] Native pause button click warning:", btnErr);
    }

    // 5. Active enforcement loop: Hotstar's player manager may attempt auto-resume on DOM pause.
    // Lock the pause state while the episode break modal remains open.
    if (pauseEnforcementInterval) clearInterval(pauseEnforcementInterval);
    let enforceTicks = 0;
    pauseEnforcementInterval = setInterval(() => {
      enforceTicks++;
      const curVid = activeVideo || findVideoElement();
      if (curVid && !curVid.paused) {
        try {
          curVid.pause();
          console.log("[EOC] Enforced video pause lock.");
        } catch (e) {}
      }
      if (enforceTicks > 20 || !isBreakModalActive) {
        clearInterval(pauseEnforcementInterval);
        pauseEnforcementInterval = null;
      }
    }, 100);
  }

  function playVideo() {
    isBreakModalActive = false;
    if (pauseEnforcementInterval) {
      clearInterval(pauseEnforcementInterval);
      pauseEnforcementInterval = null;
    }
    if (location.hostname.includes("netflix.com")) {
      window.postMessage({ source: "EOC_CONTENT", action: "NETFLIX_PLAY" }, "*");
    }
    const v = activeVideo || findVideoElement();
    if (v) {
      try {
        v.play().catch(() => {});
      } catch (e) {}
    }
  }

  // Find video player element in DOM
  function findVideoElement() {
    const videos = Array.from(document.querySelectorAll("video"));
    if (videos.length === 0) return null;

    // Prefer video currently playing, with duration, or largest display area
    return videos.reduce((best, v) => {
      const rect = v.getBoundingClientRect();
      const area = rect.width * rect.height;
      const score = (v.paused ? 0 : 500000) + area + (!isNaN(v.duration) && v.duration > 0 ? 10000 : 0);
      const bestScore = (best.video.paused ? 0 : 500000) + best.area + (!isNaN(best.video.duration) && best.video.duration > 0 ? 10000 : 0);
      return score > bestScore ? { video: v, area } : best;
    }, { video: videos[0], area: 0 }).video;
  }

  function getPlayerContainer() {
    return document.fullscreenElement ||
      document.querySelector(".shaka-video-container, .player-container, [data-testid*='player-container'], .video-player") ||
      document.body;
  }

  // Create or retrieve in-player overlay container (fullscreen compatible)
  function ensureOverlayContainer() {
    const parent = getPlayerContainer();
    if (overlayContainer && parent.contains(overlayContainer)) {
      return overlayContainer;
    }
    if (overlayContainer && overlayContainer.parentNode) {
      overlayContainer.parentNode.removeChild(overlayContainer);
    }
    overlayContainer = document.createElement("div");
    overlayContainer.id = "eoc-overlay-container";
    parent.appendChild(overlayContainer);
    return overlayContainer;
  }

  // Create or retrieve in-player HUD bar (fullscreen compatible)
  function ensureHudBar() {
    const parent = getPlayerContainer();
    if (hudBar && parent.contains(hudBar)) {
      return hudBar;
    }
    if (hudBar && hudBar.parentNode) {
      hudBar.parentNode.removeChild(hudBar);
    }
    hudBar = document.createElement("div");
    hudBar.id = "eoc-hud-bar";
    hudBar.style.display = "none";
    parent.appendChild(hudBar);
    return hudBar;
  }

  // Render episode end modal card
  function showEpisodeBreakModal(episode, nextEpisode) {
    isBreakModalActive = true;
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
      triggeredEpisodeBreaks.add(episode.episode_number);
      hideOverlay();
      const cur = activeVideo?.currentTime || netflixCurrentTime || 0;
      ignoreCutUntil = cur + 10;
      playVideo();
    });

    const nextBtn = container.querySelector("#eoc-next-episode-btn");
    nextBtn?.addEventListener("click", () => {
      triggeredEpisodeBreaks.add(episode.episode_number);
      hideOverlay();
      if (nextEpisode) {
        activeRecipe?.episodes?.forEach((other) => {
          if (other.episode_number <= episode.episode_number) {
            triggeredEpisodeBreaks.add(other.episode_number);
          }
        });
        const targetSec = timestampToSeconds(nextEpisode.start_time);
        ignoreCutUntil = targetSec + 4.0;
        seekVideo(targetSec + 0.1);
        playVideo();
      }
    });

    const replayBtn = container.querySelector("#eoc-replay-btn");
    replayBtn?.addEventListener("click", () => {
      hideOverlay();
      triggeredEpisodeBreaks.clear();
      seekVideo(0);
      playVideo();
    });
  }

  function hideOverlay() {
    isBreakModalActive = false;
    if (pauseEnforcementInterval) {
      clearInterval(pauseEnforcementInterval);
      pauseEnforcementInterval = null;
    }
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
    const isNotLast = currentEp.episode_number < activeRecipe.episodes.length;

    hud.innerHTML = `
      <span class="eoc-hud-title">Part ${currentEp.episode_number}: ${currentEp.title}</span>
      <span class="eoc-hud-time">⏱️ ${remMins}m ${remSecs}s remaining in episode</span>
      ${isNotLast ? `
        <div class="eoc-hud-nudge">
          <button type="button" class="eoc-hud-btn" id="eoc-hud-nudge-prev" title="Shift cut point 1 minute earlier">◀ -1m</button>
          <button type="button" class="eoc-hud-btn" id="eoc-hud-nudge-next" title="Shift cut point 1 minute later">+1m ▶</button>
        </div>
      ` : ""}
    `;

    if (isNotLast) {
      hud.querySelector("#eoc-hud-nudge-prev")?.addEventListener("click", (e) => {
        e.stopPropagation();
        nudgeCurrentCut(-60);
      });
      hud.querySelector("#eoc-hud-nudge-next")?.addEventListener("click", (e) => {
        e.stopPropagation();
        nudgeCurrentCut(60);
      });
    }

    hud.style.display = "flex";
  }

  function nudgeCurrentCut(deltaSec) {
    if (!activeRecipe || !activeRecipe.episodes) return;
    const curTime = activeVideo?.currentTime || netflixCurrentTime || 0;
    const epIdx = activeRecipe.episodes.findIndex((ep) => {
      const s = timestampToSeconds(ep.start_time);
      const e = timestampToSeconds(ep.end_time);
      return curTime >= s && curTime < e;
    });
    if (epIdx < 0 || epIdx >= activeRecipe.episodes.length - 1) return;

    const currentEp = activeRecipe.episodes[epIdx];
    const nextEp = activeRecipe.episodes[epIdx + 1];

    const currentCutSec = timestampToSeconds(currentEp.end_time);
    const minAllowed = timestampToSeconds(currentEp.start_time) + 60;
    const maxAllowed = timestampToSeconds(nextEp.end_time) - 60;
    const newCutSec = Math.max(minAllowed, Math.min(maxAllowed, currentCutSec + deltaSec));
    const newTs = secondsToTimestamp(newCutSec);

    currentEp.end_time = newTs;
    nextEp.start_time = newTs;

    chrome.storage.local.set({ active_recipe: activeRecipe });
    triggeredEpisodeBreaks.clear();
    console.log("[EOC] Nudged cut point to:", newTs);
    updateHud(curTime);
  }

  // Main playback monitoring loop
  function checkPlaybackTime(givenTime) {
    if (!activeRecipe || !activeRecipe.episodes || isBreakModalActive) return;
    const curTime = typeof givenTime === "number" ? givenTime : (activeVideo?.currentTime || netflixCurrentTime || 0);

    updateHud(curTime);

    if (curTime < ignoreCutUntil) return;

    for (let i = 0; i < activeRecipe.episodes.length; i++) {
      const ep = activeRecipe.episodes[i];
      const startSec = timestampToSeconds(ep.start_time);
      const endSec = timestampToSeconds(ep.end_time);

      // Trigger break only when playback naturally hits within 1s before cut up to 3s after cut, within this episode
      const isPastOrAtEnd = curTime >= (endSec - 1.0) && curTime <= (endSec + 3.0) && curTime >= startSec;

      if (isPastOrAtEnd) {
        if (!triggeredEpisodeBreaks.has(ep.episode_number)) {
          triggeredEpisodeBreaks.add(ep.episode_number);
          console.log(`[EOC] >>> EPISODE ${ep.episode_number} END REACHED at ${secondsToTimestamp(curTime)} (Target: ${ep.end_time})! Pausing playback.`);
          pauseVideo(endSec);
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
          if (cur >= timestampToSeconds(ep.end_time) - 1.0) {
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

    // 1. High-frequency playback polling heartbeat (crucial for SPAs like Hotstar, YouTube, Prime)
    setInterval(() => {
      const candidate = activeVideo || findVideoElement();
      if (candidate) {
        if (candidate !== activeVideo) attachVideo(candidate);
        if (!candidate.paused) {
          checkPlaybackTime(candidate.currentTime);
        }
      }
    }, 150);

    // 2. Fullscreen transitions listener
    document.addEventListener("fullscreenchange", () => {
      if (overlayContainer && overlayContainer.classList.contains("eoc-visible")) {
        ensureOverlayContainer();
      }
      if (hudBar && hudBar.style.display !== "none") {
        ensureHudBar();
      }
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

  // Clear active recipe and revert to Standby mode
  function clearRecipe() {
    activeRecipe = null;
    triggeredEpisodeBreaks.clear();
    hideOverlay();
    if (hudBar) hudBar.style.display = "none";
    if (pauseEnforcementInterval) {
      clearInterval(pauseEnforcementInterval);
      pauseEnforcementInterval = null;
    }
    isBreakModalActive = false;
    console.log("[EOC] Recipe cleared. Extension in silent Standby mode (native playback untouched).");
  }

  // Listen for extension popup / background messages
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "SET_RECIPE") {
      if (msg.recipe) {
        activeRecipe = msg.recipe;
        triggeredEpisodeBreaks.clear();
        const cur = activeVideo ? Math.floor(activeVideo.currentTime) : 0;
        if (activeRecipe?.episodes) {
          activeRecipe.episodes.forEach((ep) => {
            if (cur >= timestampToSeconds(ep.end_time) - 1.0) {
              triggeredEpisodeBreaks.add(ep.episode_number);
            }
          });
        }
        if (msg.assignToUrl) {
          const currentPath = window.location.origin + window.location.pathname;
          chrome.storage?.local?.get(["url_recipe_map"], (res) => {
            const map = res?.url_recipe_map || {};
            map[currentPath] = msg.recipe;
            chrome.storage?.local?.set({ url_recipe_map: map, active_recipe: msg.recipe });
          });
        }
        console.log("[EOC] Loaded recipe:", activeRecipe.meta?.title);
        sendResponse({ status: "ok", title: activeRecipe.meta?.title });
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
      if (!activeVideo) {
        const v = findVideoElement();
        if (v) attachVideo(v);
      }
      if (activeRecipe) {
        const ep = activeRecipe.episodes.find((e) => e.episode_number === msg.episode_number);
        if (ep) {
          const targetSec = timestampToSeconds(ep.start_time);
          triggeredEpisodeBreaks.clear();
          activeRecipe.episodes.forEach((other) => {
            if (other.episode_number < ep.episode_number) {
              triggeredEpisodeBreaks.add(other.episode_number);
            }
          });
          hideOverlay();
          ignoreCutUntil = targetSec + 4.0;
          seekVideo(targetSec + 0.1);
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
        duration: activeVideo ? activeVideo.duration : 0,
        recipeTitle: activeRecipe?.meta?.title || null,
        recipe: activeRecipe,
        episodesCount: activeRecipe?.episodes?.length || 0,
        pageTitle: document.title,
        url: window.location.href,
        isStandby: !activeRecipe,
      });
      return true;
    }
  });

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
      { episode_number: 1, title: "Part 1: The Ahmedabad Spark", start_time: "00:00:00", end_time: "00:37:15", cliffhanger_rating: 8.8, break_rationale: "Krish and Ananya fall in love at IIM Ahmedabad, but at Convocation vow to marry only with their parents' full blessing.", recap_text: "Punjabi Krish and Tamilian Ananya fall deeply in love at IIM Ahmedabad, navigating college life and cultural differences.", teaser_next: "Their families meet at Convocation, unleashing an immediate, hostile clash of cultures." },
      { episode_number: 2, title: "Part 2: Cultural Crossfire", start_time: "00:37:15", end_time: "01:14:30", cliffhanger_rating: 9.4, break_rationale: "An explosive confrontation erupts between Krish's outspoken Punjabi mother and Ananya's traditional Tamil parents during their first formal meeting.", recap_text: "Attempts to bring both families together collapse into regional prejudices and family drama.", teaser_next: "Krish takes a job transfer to Chennai, embarking on a mission to win over Ananya's strict parents." },
      { episode_number: 3, title: "Part 3: The Chennai Mission", start_time: "01:14:30", end_time: "01:51:45", cliffhanger_rating: 9.3, break_rationale: "Krish wins over Ananya's family in Chennai, but during the family engagement in Delhi, a devastating parental fight breaks the alliance off.", recap_text: "In Chennai, Krish wins over Ananya's father, but the formal engagement in Delhi collapses in mutual insults.", teaser_next: "Heartbroken and separated, Krish confronts his estranged father Vikram in Delhi as a final chance to save their love." },
      { episode_number: 4, title: "Part 4: Two States, One Union", start_time: "01:51:45", end_time: "02:29:00", cliffhanger_rating: 8.5, break_rationale: "Krish's estranged father makes an unexpected gesture of reconciliation, reuniting Krish and Ananya for a joyous traditional wedding in Chennai.", recap_text: "Seeing his son's agony, Krish's father travels to Chennai to apologize, bringing the families together in heartwarming unity.", teaser_next: "Series finale concludes the beloved romantic comedy-drama miniseries cut of 2 States." }
    ]
  };

  function doesRecipeMatchPage(recipe) {
    if (!recipe || !recipe.meta) return false;
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    const combined = url + " " + title;

    const movieTitle = (recipe.meta.title || "").toLowerCase();
    const cleanTitle = movieTitle.replace(/\(.*?\)/g, "").trim();
    const words = cleanTitle.split(/\s+/).filter((w) => w.length > 3);

    const titleMatch = words.length > 0 && words.every((w) => combined.includes(w));
    const imdbId = (recipe.meta.imdb_id || "").toLowerCase();
    const imdbMatch = imdbId && combined.includes(imdbId);

    return titleMatch || imdbMatch;
  }

  function evaluatePageRecipe() {
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    const combined = url + " " + title;

    // 1. Auto-detect if current page is one of our verified built-in cuts
    if (combined.includes("2-states") || combined.includes("2 states") || combined.includes("1271616952")) {
      activeRecipe = BUILTIN_HOTSTAR_2STATES_4EP;
      triggeredEpisodeBreaks.clear();
      console.log("[EOC] Auto-matched film: 2 States!");
      return;
    }
    if (combined.includes("millers") || combined.includes("70270408")) {
      activeRecipe = BUILTIN_NETFLIX_MILLERS_4EP;
      triggeredEpisodeBreaks.clear();
      console.log("[EOC] Auto-matched film: We're the Millers!");
      return;
    }
    if (combined.includes("sarvam") || combined.includes("1271525191")) {
      activeRecipe = BUILTIN_HOTSTAR_SARVAM_MAYA_6EP;
      triggeredEpisodeBreaks.clear();
      console.log("[EOC] Auto-matched film: Sarvam Maya!");
      return;
    }
    if (combined.includes("bethlehem") || combined.includes("1271710275")) {
      activeRecipe = BUILTIN_HOTSTAR_BETHLEHEM_8EP;
      triggeredEpisodeBreaks.clear();
      console.log("[EOC] Auto-matched film: Bethlehem Kudumba Unit!");
      return;
    }

    // 2. Check if user explicitly assigned a recipe to this URL / path
    const currentPath = window.location.origin + window.location.pathname;
    chrome.storage?.local?.get(["url_recipe_map", "active_recipe"], (res) => {
      const urlMap = res?.url_recipe_map || {};
      if (urlMap[currentPath]) {
        activeRecipe = urlMap[currentPath];
        triggeredEpisodeBreaks.clear();
        console.log("[EOC] Restored user-assigned recipe for this URL:", activeRecipe.meta?.title);
        return;
      }

      // 3. If storage has active_recipe, ONLY accept if it genuinely matches this page
      if (res?.active_recipe && doesRecipeMatchPage(res.active_recipe)) {
        activeRecipe = res.active_recipe;
        triggeredEpisodeBreaks.clear();
        console.log("[EOC] Verified stored recipe matches current page:", activeRecipe.meta?.title);
        return;
      }

      // 4. UNMATCHED VIDEO: Stay in Silent Standby Mode! Zero HUD, zero pauses.
      clearRecipe();
    });
  }

  // Initialize
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      evaluatePageRecipe();
      initVideoObserver();
    });
  } else {
    evaluatePageRecipe();
    initVideoObserver();
  }

  // Track SPA URL changes (Hotstar, Netflix, YouTube) so navigating away returns to Standby
  let lastObservedUrl = window.location.href;
  setInterval(() => {
    if (window.location.href !== lastObservedUrl) {
      lastObservedUrl = window.location.href;
      console.log("[EOC] Page URL change detected:", lastObservedUrl);
      evaluatePageRecipe();
    }
  }, 1200);
})();
