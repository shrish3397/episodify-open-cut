// Episodify Open Cut - Popup Logic with Open Registry Sync & Curator Publishing

const REGISTRY_INDEX_URL =
  "https://raw.githubusercontent.com/episodify/episodify-open-cut/main/recipes/index.json";
const CDN_RECIPE_BASE =
  "https://raw.githubusercontent.com/episodify/episodify-open-cut/main/recipes/";
const GITHUB_SUBMIT_BASE =
  "https://github.com/episodify/episodify-open-cut/new/main/recipes";

// Offline-ready built-in library (available even with zero internet)
const BUILTIN_RECIPES = {
  bethlehem: {
    $schema: "https://episodify.org/schema/v1.json",
    meta: { title: "Bethlehem Kudumba Unit", year: 2026, runtime_seconds: 9360, imdb_id: "tt31846512", pacing: "comedy" },
    total_episodes: 4,
    episodes: [
      { episode_number: 1, title: "The Angamaly Shift", start_time: "00:00:00", end_time: "00:39:15", cliffhanger_rating: 8.4, break_rationale: "Ashley attends her first Kudumba Unit prayer meeting; spark with Justin ignites.", recap_text: "Ashley relocates to Angamaly and crosses paths with Justin, the charismatic choir coordinator.", teaser_next: "Secret late-night choir rehearsals and scooter rides spark neighborhood gossip." },
      { episode_number: 2, title: "Rhythms & Rumors", start_time: "00:39:15", end_time: "01:18:40", cliffhanger_rating: 9.1, break_rationale: "Justin confesses feelings before parish feast as elders watch.", recap_text: "Shared love for music fuels their secret romance amidst humorous neighbor encounters.", teaser_next: "An unexpected student visa for Ireland arrives, threatening their future." },
      { episode_number: 3, title: "The Ireland Dilemma", start_time: "01:18:40", end_time: "01:57:25", cliffhanger_rating: 9.5, break_rationale: "Emotional airport departure, cutting 18 months forward to Kerala return.", recap_text: "Torn between Dublin studies and Justin, Ashley leaves as Justin selflessly lets her go.", teaser_next: "Ashley returns to Kerala for a wedding, finding Justin waiting at the church." },
      { episode_number: 4, title: "Harmonies of Bethlehem", start_time: "01:57:25", end_time: "02:36:00", cliffhanger_rating: 7.8, break_rationale: "Joyful choir wedding performance and heartfelt reconciliation.", recap_text: "Eighteen months after leaving, Ashley confronts past feelings, culminating in a reunion.", teaser_next: "Series finale concludes the heartwarming Malayalam miniseries." }
    ]
  },
  "the-batman": {
    $schema: "https://episodify.org/schema/v1.json",
    meta: { title: "The Batman", year: 2022, runtime_seconds: 10560, imdb_id: "tt1877830" },
    total_episodes: 4,
    episodes: [
      { episode_number: 1, title: "I Am the Shadows", start_time: "00:00:00", end_time: "00:44:12", cliffhanger_rating: 8.8, break_rationale: "Mayor's cipher solved.", recap_text: "Mayor Mitchell is murdered on Halloween; Batman and Gordon team up.", teaser_next: "A trip into the Iceberg Lounge uncovers police payoffs." },
      { episode_number: 2, title: "The Sins of the Father", start_time: "00:44:12", end_time: "01:29:40", cliffhanger_rating: 9.4, break_rationale: "Batmobile highway chase.", recap_text: "Batman infiltrates 44 Below and captures the Penguin.", teaser_next: "Colson drives a bomb into the cathedral funeral." },
      { episode_number: 3, title: "A Flood of Lies", start_time: "01:29:40", end_time: "02:14:15", cliffhanger_rating: 9.6, break_rationale: "Seawall bombs primed.", recap_text: "Falcone is executed from the shadows by the Riddler.", teaser_next: "The seawall shatters as floodwaters drown Gotham." },
      { episode_number: 4, title: "A Flare in the Dark", start_time: "02:14:15", end_time: "02:56:00", cliffhanger_rating: 8.0, break_rationale: "Arena rescue and beacon of hope.", recap_text: "Batman leads citizens through the flooded arena with a flare.", teaser_next: "Series finale concludes the detective noir." }
    ]
  },
  "dune-2": {
    $schema: "https://episodify.org/schema/v1.json",
    meta: { title: "Dune: Part Two", year: 2024, runtime_seconds: 9960, imdb_id: "tt15239678" },
    total_episodes: 4,
    episodes: [
      { episode_number: 1, title: "Usul & Muad'Dib", start_time: "00:00:00", end_time: "00:41:30", cliffhanger_rating: 8.9, break_rationale: "Sandworm ride mastered.", recap_text: "Paul and Jessica earn acceptance among the Fremen.", teaser_next: "Guerrilla raids paralyze Harkonnen spice harvesting." },
      { episode_number: 2, title: "The Northern Storm", start_time: "00:41:30", end_time: "01:23:45", cliffhanger_rating: 9.3, break_rationale: "Feyd-Rautha gladiator arena.", recap_text: "Paul raids harvesters; Feyd-Rautha takes command of Arrakis.", teaser_next: "Feyd-Rautha devastates Sietch Tabr with air bombardments." },
      { episode_number: 3, title: "The Water of Life", start_time: "01:23:45", end_time: "02:05:10", cliffhanger_rating: 9.7, break_rationale: "Kwisatz Haderach awakens.", recap_text: "Millions proclaim Paul the Mahdi; Paul drinks the worm bile.", teaser_next: "The Emperor's armada arrives as a mega sandstorm approaches." },
      { episode_number: 4, title: "The Prophet's Jihad", start_time: "02:05:10", end_time: "02:46:00", cliffhanger_rating: 9.1, break_rationale: "Atomic breach and galactic holy war.", recap_text: "Shield wall breached; Paul claims the throne and launches armada.", teaser_next: "Series finale concludes the epic miniseries." }
    ]
  },
  endgame: {
    $schema: "https://episodify.org/schema/v1.json",
    meta: { title: "Avengers: Endgame", year: 2019, runtime_seconds: 10860, imdb_id: "tt4154796" },
    total_episodes: 4,
    episodes: [
      { episode_number: 1, title: "Five Years Later", start_time: "00:00:00", end_time: "00:45:20", cliffhanger_rating: 8.7, break_rationale: "Scott Lang emerges from Quantum Realm.", recap_text: "Five grief-stricken years pass until Scott returns with a plan.", teaser_next: "Tony Stark cracks the Mobius strip equation for the Time Heist." },
      { episode_number: 2, title: "The Time Heist", start_time: "00:45:20", end_time: "01:31:10", cliffhanger_rating: 9.5, break_rationale: "Soul Stone sacrifice; past Thanos alerted.", recap_text: "Strike teams target 2012 New York, 2013 Asgard, and 2014 Morag.", teaser_next: "Hulk prepares to snap the Nano Gauntlet as danger nears." },
      { episode_number: 3, title: "Out of the Ashes", start_time: "01:31:10", end_time: "02:16:40", cliffhanger_rating: 9.9, break_rationale: "Portals open across ruined battlefield.", recap_text: "Banner snaps back the fallen; Thanos attacks upstate New York.", teaser_next: "The entire restored MCU rallies for the final stand." },
      { episode_number: 4, title: "I Am Iron Man", start_time: "02:16:40", end_time: "03:01:00", cliffhanger_rating: 8.2, break_rationale: "Tony's snap and passing the shield.", recap_text: "Tony snaps away Thanos's armies, sacrificing himself.", teaser_next: "Series finale concludes the superhero epic." }
    ]
  },
  godfather: {
    $schema: "https://episodify.org/schema/v1.json",
    meta: { title: "The Godfather", year: 1972, runtime_seconds: 10500, imdb_id: "tt0068646" },
    total_episodes: 4,
    episodes: [
      { episode_number: 1, title: "The Favor", start_time: "00:00:00", end_time: "00:43:20", cliffhanger_rating: 9.1, break_rationale: "Don Vito shot in fruit market.", recap_text: "Connie's wedding; Vito rejects Sollozzo's narcotics proposition.", teaser_next: "Vito lies unguarded in hospital as Michael takes action." },
      { episode_number: 2, title: "A Gun in the Cistern", start_time: "00:43:20", end_time: "01:27:15", cliffhanger_rating: 9.7, break_rationale: "Louis Restaurant assassination.", recap_text: "Michael assassinates Sollozzo and McCluskey in the Bronx.", teaser_next: "Michael seeks sanctuary in the hills of Sicily." },
      { episode_number: 3, title: "The Tollbooth Ambush", start_time: "01:27:15", end_time: "02:11:50", cliffhanger_rating: 9.5, break_rationale: "Sonny murdered; peace summit called.", recap_text: "Sonny is ambushed at the causeway; Don Vito calls Five Families.", teaser_next: "Michael returns to take command of the family." },
      { episode_number: 4, title: "The Baptism of Fire", start_time: "02:11:50", end_time: "02:55:00", cliffhanger_rating: 9.0, break_rationale: "Baptism montage and door closed on Kay.", recap_text: "Rival bosses eliminated; Michael ascends as Don Corleone.", teaser_next: "Series finale concludes the mafia saga." }
    ]
  },
  oppenheimer: {
    $schema: "https://episodify.org/schema/v1.json",
    meta: { title: "Oppenheimer", year: 2023, runtime_seconds: 10800, imdb_id: "tt15398776", pacing: "prestige_drama" },
    total_episodes: 4,
    episodes: [
      { episode_number: 1, title: "Prometheus Bound", start_time: "00:00:00", end_time: "00:46:18", cliffhanger_rating: 8.5, break_rationale: "Oppenheimer accepts Manhattan Project mandate from General Groves.", recap_text: "J. Robert Oppenheimer navigates quantum physics breakthroughs and joins General Groves.", teaser_next: "A remote desert mesa in New Mexico becomes the focal point." },
      { episode_number: 2, title: "The Secret City", start_time: "00:46:18", end_time: "01:34:05", cliffhanger_rating: 9.2, break_rationale: "Eve of Trinity test countdown as weather worsens.", recap_text: "Scientists gather at Los Alamos amidst rising logistical hurdles.", teaser_next: "Zero hour arrives in the Jornada del Muerto desert as storm clouds gather." },
      { episode_number: 3, title: "Trinity", start_time: "01:34:05", end_time: "02:15:30", cliffhanger_rating: 9.8, break_rationale: "Fateful silent detonation shockwave and geopolitical fallout.", recap_text: "The gadget is detonated; Oppenheimer's triumph is replaced by nuclear dread.", teaser_next: "Closed-door security hearing puts Oppenheimer on trial." },
      { episode_number: 4, title: "The Ruin of Nations", start_time: "02:15:30", end_time: "03:00:00", cliffhanger_rating: 8.9, break_rationale: "Pond conversation with Einstein revealed.", recap_text: "Strauss's machinations collapse during cabinet confirmation.", teaser_next: "Series finale concludes the historical epic." }
    ]
  }
};

let currentRecipe = BUILTIN_RECIPES.bethlehem;
let onlineRegistry = [];
let pendingPublishData = null;

document.addEventListener("DOMContentLoaded", () => {
  const movieSelect = document.getElementById("movie-select");
  const fileInput = document.getElementById("custom-file-input");
  const playerStatus = document.getElementById("player-status");

  // Check player connection status
  checkActiveTabStatus(playerStatus);

  // Restore stored active recipe or default
  chrome.storage.local.get(["active_recipe"], (res) => {
    if (res.active_recipe) {
      currentRecipe = res.active_recipe;
      updateUI();
    } else {
      applyRecipe(currentRecipe);
    }
  });

  // Sync with online Open Registry
  syncOpenRegistry(movieSelect);

  // Movie dropdown selection
  movieSelect.addEventListener("change", async (e) => {
    const val = e.target.value;
    if (val === "custom") {
      fileInput.click();
    } else if (val.startsWith("registry:")) {
      const fileName = val.replace("registry:", "");
      await loadRecipeFromRegistry(fileName);
    } else if (BUILTIN_RECIPES[val]) {
      applyRecipe(BUILTIN_RECIPES[val]);
    }
  });

  // Local file loading
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (parsed.meta && parsed.episodes) {
          applyRecipe(parsed);
        } else {
          alert("Invalid .eoc.json recipe: missing meta or episodes.");
        }
      } catch (err) {
        alert("Failed to parse JSON recipe: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Setup Curator Publishing Modal
  setupCuratorModal();
});

// Synchronize recipes with the decentralized Open Registry
async function syncOpenRegistry(selectEl) {
  const registryTag = document.getElementById("registry-tag");
  try {
    const resp = await fetch(REGISTRY_INDEX_URL, { cache: "no-cache" });
    if (!resp.ok) throw new Error("Network response not ok");
    const data = await resp.json();
    onlineRegistry = data.registry || [];

    if (registryTag) {
      registryTag.textContent = `🌐 Registry: ${onlineRegistry.length} Cuts`;
    }

    // Populate dropdown with any newly published community recipes
    onlineRegistry.forEach((item) => {
      const val = `registry:${item.recipe_file}`;
      // Check if already in options
      const exists = Array.from(selectEl.options).some(
        (opt) => opt.value === val || opt.text.includes(item.title)
      );
      if (!exists) {
        const opt = document.createElement("option");
        opt.value = val;
        opt.textContent = `🌐 ${item.title} (${item.year}) - ${item.total_episodes} Eps`;
        selectEl.insertBefore(opt, selectEl.lastElementChild);
      }
    });
  } catch (err) {
    console.log("[EOC] Offline mode: using bundled registry.", err.message);
    if (registryTag) {
      registryTag.textContent = `💾 Offline Registry`;
    }
  }
}

// Fetch a community recipe by filename over CDN
async function loadRecipeFromRegistry(recipeFileName) {
  try {
    const cacheKey = `recipe_${recipeFileName}`;
    const cached = await chrome.storage.local.get([cacheKey]);
    if (cached[cacheKey]) {
      applyRecipe(cached[cacheKey]);
      return;
    }

    const resp = await fetch(CDN_RECIPE_BASE + recipeFileName);
    if (!resp.ok) throw new Error("Could not download recipe file");
    const recipe = await resp.json();

    // Cache locally
    const saveObj = {};
    saveObj[cacheKey] = recipe;
    chrome.storage.local.set(saveObj);

    applyRecipe(recipe);
  } catch (err) {
    alert("Failed to load community recipe from Open Registry: " + err.message);
  }
}

function applyRecipe(recipe) {
  currentRecipe = recipe;
  chrome.storage.local.set({ active_recipe: recipe });
  updateUI();

  // Send to active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "SET_RECIPE", recipe: recipe }, () => {
        if (chrome.runtime.lastError) {
          // Tab does not have content script running
        }
      });
    }
  });
}

function updateUI() {
  if (!currentRecipe) return;

  const meta = currentRecipe.meta || {};
  document.getElementById("meta-title").textContent = meta.title || "Unknown Film";
  document.getElementById("meta-year").textContent = meta.year || "";

  const runtimeSec = meta.runtime_seconds || 0;
  const hrs = Math.floor(runtimeSec / 3600);
  const mins = Math.floor((runtimeSec % 3600) / 60);
  document.getElementById("meta-runtime").textContent = `${hrs}h ${mins}m runtime`;
  document.getElementById("meta-episodes-count").textContent = `${currentRecipe.total_episodes || currentRecipe.episodes?.length || 0} Episodes`;

  const listContainer = document.getElementById("episodes-list");
  listContainer.innerHTML = "";

  (currentRecipe.episodes || []).forEach((ep) => {
    const item = document.createElement("div");
    item.className = "episode-item";

    item.innerHTML = `
      <div class="episode-info">
        <div class="episode-item-title">Part ${ep.episode_number}: ${ep.title}</div>
        <div class="episode-item-meta">
          <span>${ep.start_time} - ${ep.end_time}</span>
          <span class="episode-cliffhanger">★ ${ep.cliffhanger_rating}/10</span>
        </div>
      </div>
      <button class="play-ep-btn" data-ep="${ep.episode_number}">
        ▶ Play
      </button>
    `;

    const btn = item.querySelector(".play-ep-btn");
    btn.addEventListener("click", () => {
      jumpToEpisode(ep.episode_number);
    });

    listContainer.appendChild(item);
  });
}

function jumpToEpisode(epNum) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "JUMP_TO_EPISODE", episode_number: epNum });
    }
  });
}

// Auto-detect movie from page URL or title across built-in & online registry
function autoDetectMovie(url = "", title = "") {
  const combined = (url + " " + title).toLowerCase();
  const movieSelect = document.getElementById("movie-select");
  if (!movieSelect || movieSelect.value === "custom") return;

  // 1. Check built-in recipes
  let matchedKey = null;
  if (combined.includes("bethlehem")) matchedKey = "bethlehem";
  else if (combined.includes("batman")) matchedKey = "the-batman";
  else if (combined.includes("dune")) matchedKey = "dune-2";
  else if (combined.includes("endgame") || combined.includes("avengers")) matchedKey = "endgame";
  else if (combined.includes("godfather")) matchedKey = "godfather";
  else if (combined.includes("oppenheimer")) matchedKey = "oppenheimer";

  if (matchedKey && BUILTIN_RECIPES[matchedKey]) {
    movieSelect.value = matchedKey;
    applyRecipe(BUILTIN_RECIPES[matchedKey]);
    console.log("[EOC] Auto-detected built-in cut:", matchedKey);
    return;
  }

  // 2. Check online registry
  for (const entry of onlineRegistry) {
    const entrySlug = entry.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanCombined = combined.replace(/[^a-z0-9]/g, "");
    if (cleanCombined.includes(entrySlug)) {
      const val = `registry:${entry.recipe_file}`;
      movieSelect.value = val;
      loadRecipeFromRegistry(entry.recipe_file);
      console.log("[EOC] Auto-detected community registry cut:", entry.title);
      return;
    }
  }
}

function checkActiveTabStatus(statusEl) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "GET_STATUS" }, (res) => {
        if (!chrome.runtime.lastError && res?.hasVideo) {
          statusEl.classList.add("connected");
          statusEl.querySelector(".status-text").textContent = "Player Active";
          statusEl.title = "Connected to active video player!";

          if (res.url || res.pageTitle) {
            autoDetectMovie(res.url, res.pageTitle);
          }
        } else {
          statusEl.classList.remove("connected");
          statusEl.querySelector(".status-text").textContent = "No Video Playing";
          statusEl.title = "Open and play a movie on Hotstar, Netflix, YouTube, or the demo player to connect.";
        }
      });
    }
  });
}

// Curator Modal setup
function setupCuratorModal() {
  const modal = document.getElementById("curate-modal");
  const openBtn = document.getElementById("open-curate-btn");
  const closeBtn = document.getElementById("close-modal-btn");
  const selectFileBtn = document.getElementById("select-publish-file-btn");
  const publishFileInput = document.getElementById("publish-file-input");
  const previewBox = document.getElementById("publish-preview");
  const previewTitle = document.getElementById("preview-film-title");
  const previewMeta = document.getElementById("preview-film-meta");
  const submitGithubBtn = document.getElementById("submit-to-github-btn");

  if (!modal || !openBtn) return;

  openBtn.addEventListener("click", () => {
    modal.style.display = "flex";
  });

  closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
  });

  selectFileBtn.addEventListener("click", () => {
    publishFileInput.click();
  });

  publishFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target.result;
        const parsed = JSON.parse(content);
        if (!parsed.meta || !parsed.episodes) {
          throw new Error("Missing required 'meta' or 'episodes' keys in recipe.");
        }

        const title = parsed.meta.title || "Unknown Film";
        const year = parsed.meta.year || "";
        const eps = parsed.total_episodes || parsed.episodes.length;

        previewTitle.textContent = `🎬 ${title} (${year})`;
        previewMeta.textContent = `${eps} Episodes &bull; Runtime: ${Math.round((parsed.meta.runtime_seconds || 0) / 60)} mins`;
        previewBox.style.display = "block";
        submitGithubBtn.style.display = "block";

        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        const targetFileName = `${slug}-${year}.eoc.json`;

        pendingPublishData = {
          fileName: targetFileName,
          content: content,
        };
      } catch (err) {
        alert("Invalid recipe: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  submitGithubBtn.addEventListener("click", () => {
    if (!pendingPublishData) return;

    // Use GitHub's web file creation endpoint with pre-filled content!
    const targetUrl = `${GITHUB_SUBMIT_BASE}?filename=${encodeURIComponent(
      pendingPublishData.fileName
    )}&value=${encodeURIComponent(pendingPublishData.content)}`;

    chrome.tabs.create({ url: targetUrl });
    modal.style.display = "none";
  });
}
