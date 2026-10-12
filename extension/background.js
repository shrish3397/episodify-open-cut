// Episodify Open Cut - Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  console.log("Episodify Open Cut extension installed.");
  // Set default settings
  chrome.storage.local.get(["eoc_settings"], (res) => {
    if (!res.eoc_settings) {
      chrome.storage.local.set({
        eoc_settings: {
          autoplay_next: false,
          show_hud: true,
          cliffhanger_alerts: true,
        },
      });
    }
  });
});

// Relay messages between popup and active tab content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "GET_ACTIVE_RECIPE") {
    chrome.storage.local.get(["active_recipe"], (res) => {
      sendResponse({ recipe: res.active_recipe || null });
    });
    return true; // Keep message port open for async response
  }
});
