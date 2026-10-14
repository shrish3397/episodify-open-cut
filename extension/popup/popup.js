// Episodify Open Cut - Popup Logic with Open Registry Sync & Curator Publishing

const REGISTRY_INDEX_URL =
  "https://raw.githubusercontent.com/episodify/episodify-open-cut/main/recipes/index.json";
const CDN_RECIPE_BASE =
  "https://raw.githubusercontent.com/episodify/episodify-open-cut/main/recipes/";
const GITHUB_SUBMIT_BASE =
  "https://github.com/episodify/episodify-open-cut/new/main/recipes";

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

// Offline-ready built-in library (available even with zero internet)
const BUILTIN_RECIPES = {
  "khoobsurat": {
    $schema: "https://episodify.org/schema/v1.json",
    meta: {
      title: "Khoobsurat (4-Episode Miniseries)",
      year: 2014,
      runtime_seconds: 7102,
      imdb_id: "tt3554418",
      pacing: "comedy",
      generator: "eoc-core"
    },
    total_episodes: 4,
    episodes: [
      { episode_number: 1, title: "Part 1: The Royal Whirlwind", start_time: "00:00:00", end_time: "00:29:30", cliffhanger_rating: 8.5, break_rationale: "Mili arrives at the rigid Sambalpur palace to treat King Shekhar, creating instant comic friction with the strict royal matriarch Nirmala Devi and catching Prince Vikram's attention.", recap_text: "Quirky physiotherapist Dr. Mili Chakravarty is hired to rehabilitate the stubborn, wheelchair-bound King of Sambalpur, shaking up the austere royal household.", teaser_next: "Mili's loud, colorful personality challenges Prince Vikram's disciplined royal decorum." },
      { episode_number: 2, title: "Part 2: Breaking the Palace Rules", start_time: "00:29:30", end_time: "00:59:15", cliffhanger_rating: 8.9, break_rationale: "Mili breaks the palace rules to help Shekhar smile again, while late-night conversations with Vikram ignite an undeniable mutual attraction.", recap_text: "Mili slowly wins over the depressed King with warmth and games, while sharing humorous late-night encounters with the stoic Prince Vikram.", teaser_next: "An unexpected desert kidnapping turns palace duty into romantic adventure." },
      { episode_number: 3, title: "Part 3: Desert Confessions", start_time: "00:59:15", end_time: "01:28:45", cliffhanger_rating: 9.3, break_rationale: "After escaping bungling kidnappers in the Rajasthani desert, Vikram and Mili share an intimate night, only for Vikram's royal engagement to pull them apart.", recap_text: "Stranded in the desert together, Mili and Vikram let their guards down, but royal duty and societal expectations threaten to crush their bond.", teaser_next: "The King takes his first steps as Vikram is forced to make an agonizing choice between duty and love." },
      { episode_number: 4, title: "Part 4: The Royal Heart", start_time: "01:28:45", end_time: "01:58:22", cliffhanger_rating: 8.7, break_rationale: "King Shekhar walks, and Prince Vikram publicly defies palace tradition to run after Mili in Delhi for a joyful, heartwarming royal reunion.", recap_text: "Having healed the royal family from within, Mili departs heartbroken, prompting Vikram to finally stand up to royal rigidity and follow his heart.", teaser_next: "Series finale concludes the beloved romantic comedy miniseries cut of Khoobsurat." }
    ]
  },
  "sarvam-maya": {
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
  },
  "bethlehem-8ep": {
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
  },
  "bethlehem-6ep": {
    $schema: "https://episodify.org/schema/v1.json",
    meta: {
      title: "Bethlehem Kudumba Unit (6-Episode Cut)",
      year: 2026,
      runtime_seconds: 9313,
      imdb_id: "tt31846512",
      pacing: "comedy",
      generator: "eoc-core"
    },
    total_episodes: 6,
    episodes: [
      { episode_number: 1, title: "Part 1: The Inciting Spark", start_time: "00:00:00", end_time: "00:25:52", cliffhanger_rating: 8.5, break_rationale: "Ashley relocates to Angamaly; her first choir session with Justin sparks immediate neighborhood interest.", recap_text: "Following financial distress in Mundakkayam, Ashley arrives in Angamaly and joins the parish prayer unit.", teaser_next: "Secret late-night choir rehearsals begin to raise suspicions among watchful elders." },
      { episode_number: 2, title: "Part 2: Rhythms & Rumors", start_time: "00:25:52", end_time: "00:51:44", cliffhanger_rating: 8.9, break_rationale: "Justin and Ashley bond over music across Angamaly; romantic sparks fly during late-night scooter rides.", recap_text: "Banter and music rehearsals blossom into a secret romance despite watchful neighbors.", teaser_next: "The grand parish feast arrives as family tensions escalate." },
      { episode_number: 3, title: "Part 3: The Parish Feast", start_time: "00:51:44", end_time: "01:17:36", cliffhanger_rating: 9.4, break_rationale: "Justin confesses his genuine feelings before the feast performance just as neighborhood rumors peak.", recap_text: "Their triumphant choir performance captivates the church, but family scrutiny reaches a boiling point.", teaser_next: "An unexpected letter from Dublin arrives, threatening to alter Ashley's future." },
      { episode_number: 4, title: "Part 4: The Ireland Dilemma", start_time: "01:17:36", end_time: "01:43:28", cliffhanger_rating: 9.6, break_rationale: "Ashley receives her student visa for Ireland; emotional midnight farewell at the airport gate.", recap_text: "Torn between her Dublin dreams and Justin, Ashley leaves as Justin selflessly lets her go.", teaser_next: "Eighteen months pass in Ireland before a parish wedding brings Ashley back to Kerala." },
      { episode_number: 5, title: "Part 5: Return to Angamaly", start_time: "01:43:28", end_time: "02:09:20", cliffhanger_rating: 9.2, break_rationale: "Ashley returns to Kerala for the wedding, discovering Justin waiting across the church courtyard.", recap_text: "Returning after 18 months in Dublin, Ashley confronts unspoken feelings and past memories.", teaser_next: "The wedding ceremony begins as Ashley and Justin take center stage." },
      { episode_number: 6, title: "Part 6: Harmonies of Bethlehem", start_time: "02:09:20", end_time: "02:35:13", cliffhanger_rating: 8.2, break_rationale: "Joyful choir wedding finale brings Ashley and Justin's romance to a triumphant conclusion.", recap_text: "Ashley and Justin reunite in a joyful musical celebration at the parish hall.", teaser_next: "Series finale concludes the 6-episode miniseries cut of Bethlehem Kudumba Unit!" }
    ]
  },
  "bethlehem-4ep": {
    $schema: "https://episodify.org/schema/v1.json",
    meta: { title: "Bethlehem Kudumba Unit (4-Episode Cut)", year: 2026, runtime_seconds: 9313, imdb_id: "tt31846512", pacing: "comedy" },
    total_episodes: 4,
    episodes: [
      { episode_number: 1, title: "The Angamaly Shift", start_time: "00:00:00", end_time: "00:38:48", cliffhanger_rating: 8.4, break_rationale: "Ashley attends her first Kudumba Unit prayer meeting; spark with Justin ignites.", recap_text: "Ashley relocates to Angamaly and crosses paths with Justin, the charismatic choir coordinator.", teaser_next: "Secret late-night choir rehearsals and scooter rides spark neighborhood gossip." },
      { episode_number: 2, title: "Rhythms & Rumors", start_time: "00:38:48", end_time: "01:17:36", cliffhanger_rating: 9.1, break_rationale: "Justin confesses feelings before parish feast as elders watch.", recap_text: "Shared love for music fuels their secret romance amidst humorous neighbor encounters.", teaser_next: "An unexpected student visa for Ireland arrives, threatening their future." },
      { episode_number: 3, title: "The Ireland Dilemma", start_time: "01:17:36", end_time: "01:56:24", cliffhanger_rating: 9.5, break_rationale: "Emotional airport departure, cutting 18 months forward to Kerala return.", recap_text: "Torn between Dublin studies and Justin, Ashley leaves as Justin selflessly lets her go.", teaser_next: "Ashley returns to Kerala for a wedding, finding Justin waiting at the church." },
      { episode_number: 4, title: "Harmonies of Bethlehem", start_time: "01:56:24", end_time: "02:35:13", cliffhanger_rating: 7.8, break_rationale: "Joyful choir wedding performance and heartfelt reconciliation.", recap_text: "Eighteen months after leaving, Ashley confronts past feelings, culminating in a reunion.", teaser_next: "Series finale concludes the heartwarming Malayalam miniseries." }
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

let currentRecipe = BUILTIN_RECIPES["bethlehem-8ep"];
let onlineRegistry = [];
let pendingPublishData = null;

document.addEventListener("DOMContentLoaded", () => {
  const movieSelect = document.getElementById("movie-select");
  const fileInput = document.getElementById("custom-file-input");
  const playerStatus = document.getElementById("player-status");

  // Check player connection status
  checkActiveTabStatus(playerStatus);

  // Restore stored active recipe or default
  chrome.storage.local.get(["active_recipe", "selected_recipe_key"], (res) => {
    const selectedKey = res.selected_recipe_key || movieSelect.value || "bethlehem-8ep";
    
    // If the selected key is a built-in recipe, always use the fresh built-in definition
    if (BUILTIN_RECIPES[selectedKey]) {
      currentRecipe = BUILTIN_RECIPES[selectedKey];
      movieSelect.value = selectedKey;
      applyRecipe(currentRecipe);
    } else if (res.active_recipe && res.active_recipe.episodes) {
      if (movieSelect.value === "bethlehem-8ep" && res.active_recipe.total_episodes !== 8) {
        currentRecipe = BUILTIN_RECIPES["bethlehem-8ep"];
        applyRecipe(currentRecipe);
      } else {
        currentRecipe = res.active_recipe;
        updateUI();
      }
    } else {
      currentRecipe = BUILTIN_RECIPES["bethlehem-8ep"];
      movieSelect.value = "bethlehem-8ep";
      applyRecipe(currentRecipe);
    }
  });

  // Sync with online Open Registry
  syncOpenRegistry(movieSelect);

  // Movie dropdown selection
  movieSelect.addEventListener("change", async (e) => {
    const val = e.target.value;
    chrome.storage.local.set({ selected_recipe_key: val });
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
    const isFirstEp = ep.episode_number === 1;

    item.innerHTML = `
      <div style="width: 100%;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <div class="episode-info">
            <div class="episode-item-title">Part ${ep.episode_number}: ${ep.title}</div>
            <div class="episode-item-meta">
              <span>${ep.start_time} - ${ep.end_time}</span>
              <span class="episode-cliffhanger">★ ${ep.cliffhanger_rating}/10</span>
            </div>
          </div>
          <div class="episode-actions">
            <button type="button" class="play-ep-btn" data-ep="${ep.episode_number}" title="Play Part ${ep.episode_number}">
              ▶ Play
            </button>
            ${!isFirstEp ? `<button type="button" class="calib-toggle-btn" data-ep="${ep.episode_number}" title="Adjust cut timing">⚙️</button>` : ""}
          </div>
        </div>
        ${!isFirstEp ? `
          <div class="calibration-panel" id="calib-panel-${ep.episode_number}" style="display: none;">
            <button type="button" class="nudge-btn nudge-minus" data-ep="${ep.episode_number}" title="Shift start 10s earlier">◀ -10s</button>
            <button type="button" class="nudge-btn nudge-plus" data-ep="${ep.episode_number}" title="Shift start 10s later">+10s ▶</button>
            <button type="button" class="set-now-btn" data-ep="${ep.episode_number}" title="Set Part ${ep.episode_number} start to current video playback time">📍 Set to Video Time</button>
          </div>
        ` : ""}
      </div>
    `;

    const btn = item.querySelector(".play-ep-btn");
    btn.addEventListener("click", () => {
      jumpToEpisode(ep.episode_number);
    });

    if (!isFirstEp) {
      const calibToggle = item.querySelector(".calib-toggle-btn");
      const calibPanel = item.querySelector(`#calib-panel-${ep.episode_number}`);
      calibToggle?.addEventListener("click", () => {
        calibPanel.style.display = calibPanel.style.display === "none" ? "flex" : "none";
      });

      const minusBtn = item.querySelector(".nudge-minus");
      minusBtn?.addEventListener("click", () => {
        nudgeEpisodeStart(ep.episode_number, -10);
      });

      const plusBtn = item.querySelector(".nudge-plus");
      plusBtn?.addEventListener("click", () => {
        nudgeEpisodeStart(ep.episode_number, 10);
      });

      const setNowBtn = item.querySelector(".set-now-btn");
      setNowBtn?.addEventListener("click", () => {
        setEpisodeStartToCurrentVideoTime(ep.episode_number);
      });
    }

    listContainer.appendChild(item);
  });
}

function nudgeEpisodeStart(epNum, deltaSec) {
  if (!currentRecipe || !currentRecipe.episodes) return;
  const epIdx = currentRecipe.episodes.findIndex((e) => e.episode_number === epNum);
  if (epIdx <= 0) return;

  const prevEp = currentRecipe.episodes[epIdx - 1];
  const thisEp = currentRecipe.episodes[epIdx];

  const currentSec = timestampToSeconds(thisEp.start_time);
  const minAllowed = timestampToSeconds(prevEp.start_time) + 30;
  const maxAllowed = timestampToSeconds(thisEp.end_time) - 30;

  const newSec = Math.max(minAllowed, Math.min(maxAllowed, currentSec + deltaSec));
  const newTs = secondsToTimestamp(newSec);

  thisEp.start_time = newTs;
  prevEp.end_time = newTs;

  applyRecipe(currentRecipe);
  jumpToEpisode(epNum);
}

function setEpisodeStartToCurrentVideoTime(epNum) {
  if (!currentRecipe || !currentRecipe.episodes) return;
  const epIdx = currentRecipe.episodes.findIndex((e) => e.episode_number === epNum);
  if (epIdx <= 0) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.id) return;
    chrome.tabs.sendMessage(tabs[0].id, { action: "GET_STATUS" }, (res) => {
      if (chrome.runtime.lastError || res?.currentTime === undefined) {
        alert("Could not read current video player time. Is the video playing?");
        return;
      }
      const curSec = Math.round(res.currentTime);
      const prevEp = currentRecipe.episodes[epIdx - 1];
      const thisEp = currentRecipe.episodes[epIdx];

      const minAllowed = timestampToSeconds(prevEp.start_time) + 10;
      const maxAllowed = timestampToSeconds(thisEp.end_time) - 10;

      if (curSec <= minAllowed || curSec >= maxAllowed) {
        alert(`Cannot set start time to ${secondsToTimestamp(curSec)}. Must be between ${prevEp.start_time} and ${thisEp.end_time}.`);
        return;
      }

      const newTs = secondsToTimestamp(curSec);
      thisEp.start_time = newTs;
      prevEp.end_time = newTs;

      applyRecipe(currentRecipe);
    });
  });
}

function scaleRecipeToDuration(targetDurationSec) {
  if (!currentRecipe || !currentRecipe.episodes || targetDurationSec <= 0) return;
  const oldDuration = currentRecipe.meta?.runtime_seconds || timestampToSeconds(currentRecipe.episodes[currentRecipe.episodes.length - 1].end_time);
  if (!oldDuration || oldDuration <= 0) return;

  const factor = targetDurationSec / oldDuration;
  currentRecipe.meta.runtime_seconds = Math.round(targetDurationSec);

  currentRecipe.episodes.forEach((ep, idx) => {
    if (idx === 0) {
      ep.start_time = "00:00:00";
    } else {
      ep.start_time = secondsToTimestamp(Math.round(timestampToSeconds(ep.start_time) * factor));
      currentRecipe.episodes[idx - 1].end_time = ep.start_time;
    }
  });
  currentRecipe.episodes[currentRecipe.episodes.length - 1].end_time = secondsToTimestamp(Math.round(targetDurationSec));

  applyRecipe(currentRecipe);
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
  if (combined.includes("khoobsurat") || combined.includes("0lm2egozqqutdbb29smpp6mtxr")) {
    matchedKey = "khoobsurat";
  } else if (combined.includes("sarvam") || combined.includes("1271525191")) {
    matchedKey = "sarvam-maya";
  } else if (combined.includes("bethlehem") || combined.includes("1271710275")) {
    matchedKey = "bethlehem-8ep";
  } else if (combined.includes("batman")) matchedKey = "the-batman";
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

function tryAutoInject(tab, callback) {
  if (!chrome.scripting || !tab?.id) {
    if (callback) callback();
    return;
  }

  chrome.scripting.executeScript(
    {
      target: { tabId: tab.id },
      files: ["content/overlay.js"],
    },
    () => {
      if (callback) setTimeout(callback, 200);
    }
  );
}

function checkActiveTabStatus(statusEl) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab?.id) return;
    const url = tab.url || "";

    chrome.tabs.sendMessage(tab.id, { action: "GET_STATUS" }, (res) => {
      if (!chrome.runtime.lastError && res?.hasVideo) {
        statusEl.classList.add("connected");
        statusEl.querySelector(".status-text").textContent = "Player Active";
        statusEl.title = "Connected to active video player!";

        if (res.url || res.pageTitle) {
          autoDetectMovie(res.url, res.pageTitle);
        }

        if (res.duration && res.duration > 60 && currentRecipe?.meta?.runtime_seconds) {
          const diff = Math.abs(res.duration - currentRecipe.meta.runtime_seconds);
          const banner = document.getElementById("mismatch-banner");
          if (banner) {
            if (diff > 180) {
              const streamDur = secondsToTimestamp(res.duration);
              const recipeDur = secondsToTimestamp(currentRecipe.meta.runtime_seconds);
              document.getElementById("mismatch-text").textContent = `⚠️ Stream is ${streamDur}, recipe is ${recipeDur}.`;
              banner.style.display = "flex";
              document.getElementById("rescale-btn").onclick = () => {
                scaleRecipeToDuration(res.duration);
                banner.style.display = "none";
              };
            } else {
              banner.style.display = "none";
            }
          }
        }
      } else if (chrome.runtime.lastError) {
        // Content script disconnected or not yet injected: auto-inject!
        tryAutoInject(tab, () => {
          chrome.tabs.sendMessage(tab.id, { action: "GET_STATUS" }, (retryRes) => {
            if (!chrome.runtime.lastError && retryRes?.hasVideo) {
              statusEl.classList.add("connected");
              statusEl.querySelector(".status-text").textContent = "Player Active";
              if (retryRes.url || retryRes.pageTitle) {
                autoDetectMovie(retryRes.url, retryRes.pageTitle);
              }
            } else {
              statusEl.classList.remove("connected");
              if (url.includes("netflix.com") && !url.includes("/watch/")) {
                statusEl.querySelector(".status-text").textContent = "Click Play on Movie";
                statusEl.title = "Click Play on the movie to open the video player!";
              } else {
                statusEl.querySelector(".status-text").textContent = "⚠️ Refresh Tab (Cmd+R)";
                statusEl.title = "Please refresh this tab once to connect the extension.";
              }
            }
          });
        });
      } else {
        statusEl.classList.remove("connected");
        if (url.includes("netflix.com") && !url.includes("/watch/")) {
          statusEl.querySelector(".status-text").textContent = "Click Play on Movie";
          statusEl.title = "Click Play on the movie to open the video player!";
        } else {
          statusEl.querySelector(".status-text").textContent = "No Video Playing";
          statusEl.title = "Open and play a movie on Hotstar, Netflix, YouTube, or the demo player to connect.";
        }
      }
    });
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
