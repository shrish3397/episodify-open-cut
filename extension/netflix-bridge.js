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

    try {
      const player = getNetflixPlayer();
      if (!player) return;

      if (action === "NETFLIX_SEEK") {
        const ms = event.data.timeMs;
        if (typeof player.seek === "function") {
          player.seek(ms);
          console.log("[EOC Bridge] Netflix seeked to", ms, "ms");
        }
      } else if (action === "NETFLIX_PAUSE") {
        if (typeof player.pause === "function") {
          player.pause();
        }
      } else if (action === "NETFLIX_PLAY") {
        if (typeof player.play === "function") {
          player.play();
        }
      }
    } catch (err) {
      console.warn("[EOC Bridge] Action failed:", action, err);
    }
  });

  console.log("[EOC Bridge] Netflix Main-World API Bridge initialized.");
})();
