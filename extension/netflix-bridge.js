// Episodify Open Cut - Netflix Player API Bridge (Runs in MAIN world)
(function () {
  "use strict";

  function getNetflixPlayer() {
    try {
      const videoPlayer = window.netflix?.appContext?.state?.playerApp?.getAPI()?.videoPlayer;
      if (!videoPlayer) return null;
      const sessionIds = videoPlayer.getAllPlayerSessionIds();
      if (!sessionIds || sessionIds.length === 0) return null;
      return videoPlayer.getVideoPlayerBySessionId(sessionIds[sessionIds.length - 1]);
    } catch (e) {
      return null;
    }
  }

  // Listen for control commands from EOC content script
  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data || event.data.source !== "EOC_CONTENT") return;

    const { action } = event.data;
    const player = getNetflixPlayer();

    if (action === "NETFLIX_SEEK") {
      const ms = event.data.timeMs;
      if (player) {
        player.seek(ms);
        player.play();
        console.log("[EOC Bridge] Netflix seeked to", ms, "ms");
      }
    } else if (action === "NETFLIX_PAUSE") {
      if (player) {
        player.pause();
      }
    } else if (action === "NETFLIX_PLAY") {
      if (player) {
        player.play();
      }
    }
  });

  // Periodically report status back to content script
  setInterval(() => {
    const player = getNetflixPlayer();
    if (player) {
      try {
        const curMs = player.getCurrentTime();
        const durationMs = player.getDuration();
        const isPaused = player.isPaused();
        window.postMessage({
          source: "EOC_NETFLIX_BRIDGE",
          action: "STATUS_UPDATE",
          currentTimeSec: curMs / 1000,
          durationSec: durationMs / 1000,
          isPaused: isPaused,
        }, "*");
      } catch (e) {}
    }
  }, 400);

  console.log("[EOC Bridge] Netflix Main-World API Bridge initialized.");
})();
