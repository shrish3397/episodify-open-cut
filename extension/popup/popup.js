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
  "queen": {
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
      {
        episode_number: 1,
        title: "Part 1: The Solo Honeymoon",
        start_time: "00:00:00",
        end_time: "00:36:20",
        cliffhanger_rating: 8.9,
        break_rationale: "Crushed by Vijay calling off their wedding at the Delhi cafe, a devastated Rani makes the courageous decision to embark on their pre-booked Paris honeymoon completely alone, stepping out into the bustling European night.",
        recap_text: "In Rajouri Garden, Delhi, conservative bride Rani's world shatters when fiancé Vijay calls off their wedding one day before the ceremony. Defying family expectations, Rani packs her bags for Paris alone.",
        teaser_next: "Stranded in Paris with no international travel experience, Rani faces culture shock, lost directions, and a chaotic street confrontation."
      },
      {
        episode_number: 2,
        title: "Part 2: Parisian Freedom",
        start_time: "00:36:20",
        end_time: "01:12:45",
        cliffhanger_rating: 9.3,
        break_rationale: "After an exhilarating, liberating night across Paris with free-spirited Vijaylaxmi, Rani boards the train to Amsterdam transformed, only to discover her new budget hostel room is shared with three unfamiliar foreign men.",
        recap_text: "In Paris, vibrant Indo-French hotel worker Vijaylaxmi takes Rani under her wing, helping her overcome heartbreak and taste independence for the first time.",
        teaser_next: "Rani arrives in free-spirited Amsterdam and must navigate sharing a tiny hostel room with three boisterous male roommates."
      },
      {
        episode_number: 3,
        title: "Part 3: The Amsterdam Awakening",
        start_time: "01:12:45",
        end_time: "01:48:30",
        cliffhanger_rating: 9.5,
        break_rationale: "Rani triumphs at the Amsterdam street festival cooking Delhi golgappas and winning the crowd, but as she celebrates with her roommates, a guilt-ridden Vijay unexpectedly arrives in Amsterdam begging for her forgiveness.",
        recap_text: "Overcoming initial awkwardness, Rani forms an unbreakable bond with hostel roommates Taka, Tim, and Oleksandr, discovering her entrepreneurial passion making street snacks.",
        teaser_next: "Vijay corners Rani in Amsterdam, demanding she return to domestic life just as Rani discovers the power of her own independence."
      },
      {
        episode_number: 4,
        title: "Part 4: The Triumphant Return",
        start_time: "01:48:30",
        end_time: "02:24:00",
        cliffhanger_rating: 8.6,
        break_rationale: "Rani lovingly bids farewell to her European companions, returns to Delhi, and visits Vijay only to calmly return his engagement ring with a radiant, liberating smile of absolute self-worth.",
        recap_text: "Rejecting Vijay's regressive demands, Rani chooses herself, turning heartbreak into a triumphant celebration of womanhood and self-realization.",
        teaser_next: "Series finale concludes the beloved coming-of-age comedy-drama miniseries cut of Queen."
      }
    ]
  },
  "laapataa-ladies": {
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
      {
        episode_number: 1,
        title: "Part 1: The Veil of Confusion",
        start_time: "00:00:00",
        end_time: "00:31:30",
        cliffhanger_rating: 8.9,
        break_rationale: "Deepak disembarks in his village only to uncover the horrifying truth that he brought home the wrong veiled bride; miles away, Phool awakens stranded alone at an unfamiliar railway platform.",
        recap_text: "In rural 2001 India, newlyweds Deepak and Phool travel home on a packed night train with identical veiled brides. In the nighttime disembarkation chaos, Deepak accidentally leads the wrong bride home.",
        teaser_next: "Deepak launches a frantic search across the district as Phool struggles to survive stranded at the remote station."
      },
      {
        episode_number: 2,
        title: "Part 2: Stranded in Pateela",
        start_time: "00:31:30",
        end_time: "01:01:45",
        cliffhanger_rating: 9.2,
        break_rationale: "Cynical Inspector Shyam Manohar suspects foul play when he finds pawned jewelry, realizing the quiet bride in Deepak's home is operating under an alias with a hidden agenda.",
        recap_text: "At the railway station, kindly tea-stall owner Manju Maai takes Phool under her wing. Meanwhile, Deepak files a missing bride report as suspicion mounts around his veiled houseguest.",
        teaser_next: "Missing person sketches circulate across the state as Shyam Manohar closes in on Jaya's secret past."
      },
      {
        episode_number: 3,
        title: "Part 3: The Sketch & The Secret",
        start_time: "01:01:45",
        end_time: "01:34:00",
        cliffhanger_rating: 9.5,
        break_rationale: "Shyam Manohar discovers Jaya's admission letter to Dehradun Agricultural University and prepares to arrest her, just as her abusive husband tracks her down to the police station.",
        recap_text: "Jaya shares her dream of modern organic farming with Deepak's family. At the station, Phool learns self-reliance making snacks, but Deepak's missing posters struggle to reach her.",
        teaser_next: "With corrupt forces and a vengeful husband closing in, Jaya faces her final chance to reclaim her freedom and reunite Deepak with Phool."
      },
      {
        episode_number: 4,
        title: "Part 4: The Path to Surajmukhi",
        start_time: "01:34:00",
        end_time: "02:04:15",
        cliffhanger_rating: 8.5,
        break_rationale: "Shyam Manohar tears up the arrest warrant to set Jaya free; Deepak finally spots Phool at the railway station for a tearful, heartwarming reunion as both brides reclaim their destiny.",
        recap_text: "Overcoming rural prejudices and mistaken identities, Shyam Manohar protects Jaya, while Deepak and Phool reunite in an emotional station climax.",
        teaser_next: "Series finale concludes the beloved comedy-drama miniseries cut of Laapataa Ladies."
      }
    ]
  },
  "2-states": {
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
      {
        episode_number: 1,
        title: "Part 1: The Ahmedabad Spark",
        start_time: "00:00:00",
        end_time: "00:39:20",
        cliffhanger_rating: 8.8,
        break_rationale: "The Convocation ceremony concludes at IIM Ahmedabad as caps are tossed in the air; Krish and Ananya vow not to elope, parting ways to Delhi and Chennai to convince their families.",
        recap_text: "Punjabi Krish and Tamilian Ananya fall deeply in love at IIM Ahmedabad, navigating college life and cultural differences.",
        teaser_next: "Their families meet at Convocation, unleashing an immediate, hostile clash of cultures."
      },
      {
        episode_number: 2,
        title: "Part 2: Cultural Crossfire",
        start_time: "00:39:20",
        end_time: "01:16:30",
        cliffhanger_rating: 9.4,
        break_rationale: "Krish transfers to Chennai and wins over the Swaminathan family with his workplace presentation; Ananya's parents agree to the marriage before departing for Delhi.",
        recap_text: "Attempts to bring both families together collapse into regional prejudices and family drama.",
        teaser_next: "Krish takes a job transfer to Chennai, embarking on a mission to win over Ananya's strict parents."
      },
      {
        episode_number: 3,
        title: "Part 3: The Chennai Mission",
        start_time: "01:16:30",
        end_time: "01:53:40",
        cliffhanger_rating: 9.3,
        break_rationale: "The formal engagement dinner in Delhi erupts into a disastrous family confrontation; heartbroken, Krish and Ananya part ways and break the engagement.",
        recap_text: "In Chennai, Krish wins over Ananya's father, but the formal engagement in Delhi collapses in mutual insults.",
        teaser_next: "Heartbroken and separated, Krish confronts his estranged father Vikram in Delhi as a final chance to save their love."
      },
      {
        episode_number: 4,
        title: "Part 4: Two States, One Union",
        start_time: "01:53:40",
        end_time: "02:29:00",
        cliffhanger_rating: 8.5,
        break_rationale: "Krish's estranged father makes an unexpected gesture of reconciliation in Chennai, bringing both families together for a joyous traditional temple wedding.",
        recap_text: "Seeing his son's agony, Krish's father travels to Chennai to apologize, bringing the families together in heartwarming unity.",
        teaser_next: "Series finale concludes the beloved romantic comedy-drama miniseries cut of 2 States."
      }
    ]
  },
  "were-the-millers": {
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
      { episode_number: 1, title: "Part 1: The Fake Family Assembles", start_time: "00:00:00", end_time: "00:27:15", cliffhanger_rating: 8.7, break_rationale: "David is robbed and forced into a lethal Mexican drug run by Brad Gurdlinger, pitching the fake 'Miller' family scheme to stripper Rose, awkward Kenny, and runaway Casey.", recap_text: "Denver pot dealer David Clark loses his cash and stash to muggers. To clear his debt with eccentric kingpin Brad Gurdlinger, he rents a giant RV and hires his quirky neighbors to pose as a wholesome vacationing family.", teaser_next: "The Millers cross the border into Mexico, only to find the shipment is vastly larger and more dangerous than promised." },
      { episode_number: 2, title: "Part 2: A Smidge of Trouble", start_time: "00:27:15", end_time: "00:54:30", cliffhanger_rating: 9.2, break_rationale: "The Millers pack two tons of cartel weed into their RV and cross the US border, only to break down and get towed by a friendly tourist who turns out to be a DEA agent.", recap_text: "David realizes Brad tricked him into stealing two tons of weed from cartel kingpin Pablo Chacon. After sweating through border inspection, the RV's radiator blows, forcing them into the company of DEA agent Don Fitzgerald.", teaser_next: "Cartel henchmen close in as the Millers are cornered at a secluded desert warehouse." },
      { episode_number: 3, title: "Part 3: Spiders & Stripteases", start_time: "00:54:30", end_time: "01:21:45", cliffhanger_rating: 9.5, break_rationale: "Chacon captures the Millers at gunpoint, prompting Rose's desperate striptease to create an escape, while Kenny suffers a catastrophic tarantula bite.", recap_text: "Cornered by Pablo Chacon, Rose uses her dancer skills to trigger warehouse fire sprinklers and escape. While fleeing, Kenny is bitten by a venomous spider, landing the fake family in a chaotic Mexican hospital.", teaser_next: "David tries to take the money and abandon the family, but true loyalty forces a final high-stakes showdown." },
      { episode_number: 4, title: "Part 4: The 4th of July Finale", start_time: "01:21:45", end_time: "01:49:00", cliffhanger_rating: 8.9, break_rationale: "David chooses his fake family over the drug money, taking down Brad Gurdlinger with the DEA and moving into suburban witness protection as a real family.", recap_text: "Overcoming petty greed and fireworks standoffs, David reconciles with Rose, Casey, and Kenny to bust Brad Gurdlinger, turning their fake family cover into an authentic, loving home.", teaser_next: "Series finale concludes the uproarious comedy miniseries cut of We're the Millers." }
    ]
  },
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

let currentRecipe = null;
let onlineRegistry = [];
let pendingPublishData = null;

document.addEventListener("DOMContentLoaded", () => {
  const movieSelect = document.getElementById("movie-select");
  const fileInput = document.getElementById("custom-file-input");
  const playerStatus = document.getElementById("player-status");
  const toggleBtn = document.getElementById("toggle-episodify-btn");

  // Check player connection and synchronize with active tab
  checkActiveTabStatus(playerStatus);

  // Sync with online Open Registry
  syncOpenRegistry(movieSelect);

  // Toggle Episodify Button (Turn On / Turn Off)
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => {
      if (currentRecipe) {
        // Active -> Standby
        detachRecipe();
      } else {
        // Standby -> Active
        const val = movieSelect.value;
        if (val !== "none" && val !== "auto" && BUILTIN_RECIPES[val]) {
          applyRecipe(BUILTIN_RECIPES[val], true);
        } else if (val.startsWith("registry:")) {
          const fileName = val.replace("registry:", "");
          loadRecipeFromRegistry(fileName, true);
        } else {
          // If "none" or "auto", check current tab status or auto-detect
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (tab) {
              chrome.tabs.sendMessage(tab.id, { action: "GET_STATUS" }, (res) => {
                const effectiveUrl = res?.url || tab.url || "";
                const effectiveTitle = res?.pageTitle || tab.title || "";
                const matched = autoDetectMovie(effectiveUrl, effectiveTitle, true);
                if (matched) return;

                // If unlisted movie, open the Gemini AI Miniseries Slicer directly!
                const openAiBtn = document.getElementById("open-ai-modal-btn");
                if (openAiBtn) {
                  openAiBtn.click();
                  return;
                }
              });
            }
          });
        }
      }
    });
  }

  // Movie dropdown selection
  movieSelect.addEventListener("change", async (e) => {
    const val = e.target.value;
    if (val === "none") {
      detachRecipe();
    } else if (val === "auto") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab) {
          chrome.tabs.sendMessage(tab.id, { action: "GET_STATUS" }, (res) => {
            const effectiveUrl = res?.url || tab.url || "";
            const effectiveTitle = res?.pageTitle || tab.title || "";
            autoDetectMovie(effectiveUrl, effectiveTitle, true);
          });
        }
      });
    } else if (val === "custom") {
      fileInput.click();
    } else if (val.startsWith("registry:")) {
      const fileName = val.replace("registry:", "");
      await loadRecipeFromRegistry(fileName, true);
    } else if (BUILTIN_RECIPES[val]) {
      applyRecipe(BUILTIN_RECIPES[val], true);
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
          applyRecipe(parsed, true);
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

  // Setup Gemini AI In-Extension Slicer Modal
  setupAiSlicerModal();
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
async function loadRecipeFromRegistry(recipeFileName, assignToUrl = false) {
  try {
    const cacheKey = `recipe_${recipeFileName}`;
    const cached = await chrome.storage.local.get([cacheKey]);
    if (cached[cacheKey]) {
      applyRecipe(cached[cacheKey], assignToUrl);
      return;
    }

    const resp = await fetch(CDN_RECIPE_BASE + recipeFileName);
    if (!resp.ok) throw new Error("Could not download recipe file");
    const recipe = await resp.json();

    // Cache locally
    const saveObj = {};
    saveObj[cacheKey] = recipe;
    chrome.storage.local.set(saveObj);

    applyRecipe(recipe, assignToUrl);
  } catch (err) {
    alert("Failed to load community recipe from Open Registry: " + err.message);
  }
}

function applyRecipe(recipe, assignToUrl = false) {
  currentRecipe = recipe;
  chrome.storage.local.set({ active_recipe: recipe });
  updateUI();

  // Send to active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: "SET_RECIPE", recipe: recipe, assignToUrl: assignToUrl },
        () => {
          if (chrome.runtime.lastError) {
            // Tab does not have content script running
          }
        }
      );
    }
  });
}

function detachRecipe() {
  currentRecipe = null;
  const movieSelect = document.getElementById("movie-select");
  if (movieSelect) movieSelect.value = "none";
  chrome.storage.local.remove(["active_recipe"]);
  updateUI();

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "CLEAR_RECIPE" }, () => {
        if (chrome.runtime.lastError) {}
      });
    }
  });
}

function updateUI() {
  const modePill = document.getElementById("mode-pill");
  const modeDesc = document.getElementById("mode-desc");
  const toggleBtn = document.getElementById("toggle-episodify-btn");
  const metaTitle = document.getElementById("meta-title");
  const metaYear = document.getElementById("meta-year");
  const metaRuntime = document.getElementById("meta-runtime");
  const metaEpisodesCount = document.getElementById("meta-episodes-count");
  const listContainer = document.getElementById("episodes-list");
  const movieSelect = document.getElementById("movie-select");

  if (!currentRecipe) {
    if (modePill) {
      modePill.className = "mode-pill status-standby";
      modePill.textContent = "⏸️ Standby";
    }
    if (modeDesc) modeDesc.textContent = "Normal video playback (no cuts)";
    if (toggleBtn) {
      toggleBtn.className = "toggle-btn toggle-btn-enable";
      toggleBtn.textContent = "⚡ Episodify";
    }
    if (movieSelect && movieSelect.value !== "custom") {
      movieSelect.value = "none";
    }
    if (metaTitle) metaTitle.textContent = "Normal Playback Active";
    if (metaYear) metaYear.textContent = "";
    if (metaRuntime) metaRuntime.textContent = "No cuts active";
    if (metaEpisodesCount) metaEpisodesCount.textContent = "Standby";
    if (listContainer) {
      listContainer.innerHTML = `
        <div class="empty-standby-state">
          <div class="empty-standby-icon">⏸️</div>
          <div class="empty-standby-text">
            Video is playing normally without cuts.<br>
            Choose a cut above or click <b>⚡ Episodify</b>.
          </div>
        </div>
      `;
    }
    return;
  }

  // Active Recipe State
  if (modePill) {
    modePill.className = "mode-pill status-active";
    modePill.textContent = "🟢 Active";
  }
  if (modeDesc) {
    modeDesc.textContent = `Slicing into ${currentRecipe.episodes?.length || 0} episodes`;
  }
  if (toggleBtn) {
    toggleBtn.className = "toggle-btn toggle-btn-disable";
    toggleBtn.textContent = "⏹️ Turn Off";
  }

  const meta = currentRecipe.meta || {};
  if (metaTitle) {
    const rawTitle = meta.title || "Unknown Film";
    const cleanTitle = rawTitle.replace(/\s*\(\d+[- ](?:episode|part)[^)]*\)/i, "").trim();
    metaTitle.textContent = cleanTitle || rawTitle;
    metaTitle.title = meta.title || "";
  }
  if (metaYear) metaYear.textContent = meta.year || "";

  if (movieSelect) {
    const foundKey = Object.keys(BUILTIN_RECIPES).find(
      (k) => BUILTIN_RECIPES[k].meta?.title === currentRecipe.meta?.title
    );
    if (foundKey) {
      movieSelect.value = foundKey;
    } else {
      let activeOpt = Array.from(movieSelect.options).find((o) => o.value === "active_custom");
      if (!activeOpt) {
        activeOpt = document.createElement("option");
        activeOpt.value = "active_custom";
        movieSelect.insertBefore(activeOpt, movieSelect.children[2] || null);
      }
      activeOpt.textContent = `🎬 ${meta.title || "Active Miniseries Cut"}`;
      movieSelect.value = "active_custom";
    }
  }

  const runtimeSec = meta.runtime_seconds || 0;
  const hrs = Math.floor(runtimeSec / 3600);
  const mins = Math.floor((runtimeSec % 3600) / 60);
  if (metaRuntime) metaRuntime.textContent = `${hrs > 0 ? hrs + "h " : ""}${mins}m runtime`;
  if (metaEpisodesCount) {
    metaEpisodesCount.textContent = `${currentRecipe.total_episodes || currentRecipe.episodes?.length || 0} Episodes`;
  }

  if (listContainer) {
    listContainer.innerHTML = "";

    (currentRecipe.episodes || []).forEach((ep) => {
      const item = document.createElement("div");
      item.className = "episode-item";
      const rawEpTitle = ep.title || "";
      const displayTitle = rawEpTitle.toLowerCase().startsWith("part ")
        ? rawEpTitle
        : `Part ${ep.episode_number}: ${rawEpTitle}`;

      const durSec = timestampToSeconds(ep.end_time) - timestampToSeconds(ep.start_time);
      const durMins = Math.max(1, Math.round(durSec / 60));

      item.innerHTML = `
        <div class="episode-info">
          <div class="episode-item-title">${displayTitle}</div>
          <div class="episode-item-meta">${ep.start_time} – ${ep.end_time} &bull; ${durMins}m</div>
        </div>
        <button type="button" class="play-ep-btn" data-ep="${ep.episode_number}" title="Play Part ${ep.episode_number}">
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

  // Check if this is a built-in verified scene recipe
  const isBuiltIn = Object.values(BUILTIN_RECIPES).some(
    (b) => b.meta?.title === currentRecipe.meta?.title
  );

  // For verified recipes, DO NOT blindly scale internal scene boundaries!
  // Doing so shifts hand-curated / audio-verified scene transitions into random mid-dialogue lines.
  if (isBuiltIn) {
    console.log("[EOC] Preserving verified scene cuts for built-in recipe:", currentRecipe.meta?.title);
    currentRecipe.meta.runtime_seconds = Math.round(targetDurationSec);
    currentRecipe.episodes[currentRecipe.episodes.length - 1].end_time = secondsToTimestamp(Math.round(targetDurationSec));
    applyRecipe(currentRecipe);
    return;
  }

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
  const doJump = (recipe) => {
    if (!recipe || !recipe.episodes) return;
    const num = Number(epNum) || 1;
    const ep = recipe.episodes.find((e) => Number(e.episode_number) === num)
      || recipe.episodes[num - 1]
      || recipe.episodes[0];
    if (!ep) return;

    const targetSec = timestampToSeconds(ep.start_time);

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) return;

      const payload = {
        action: "JUMP_TO_EPISODE",
        episode_number: num,
        start_time: ep.start_time,
        targetSec: targetSec,
        recipe: recipe
      };

      chrome.tabs.sendMessage(tab.id, payload, (res) => {
        if (chrome.runtime.lastError || !res) {
          console.warn("[EOC-Popup] Content script unreachable, injecting overlay...", chrome.runtime.lastError);
          tryAutoInject(tab, () => {
            chrome.tabs.sendMessage(tab.id, payload, () => {});
          });
        }
      });
    });
  };

  if (currentRecipe && currentRecipe.episodes) {
    doJump(currentRecipe);
  } else {
    chrome.storage.local.get(["active_recipe"], (res) => {
      if (res?.active_recipe) {
        currentRecipe = res.active_recipe;
        doJump(res.active_recipe);
      }
    });
  }
}

// Auto-detect movie from page URL or title across built-in & online registry
function autoDetectMovie(url = "", title = "", autoApply = false) {
  const cleanTitle = cleanMovieTitle(title, url).toLowerCase();
  let pathname = "";
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch (e) {
    pathname = (url || "").split("?")[0].toLowerCase();
  }

  const movieSelect = document.getElementById("movie-select");
  if (!movieSelect || movieSelect.value === "custom") return null;

  // 1. Check built-in recipes using exact ID in pathname or regex word-boundaries on title
  let matchedKey = null;
  if (pathname.includes("0qry75b5jx2obl1p59w9bn0qxn") || /\bqueen\b/i.test(cleanTitle)) {
    matchedKey = "queen";
  } else if (pathname.includes("81760391") || /\blaapataa\b/i.test(cleanTitle) || /\blaapta\b/i.test(cleanTitle)) {
    matchedKey = "laapataa-ladies";
  } else if (pathname.includes("1271616952") || /\b2\s*states\b/i.test(cleanTitle)) {
    matchedKey = "2-states";
  } else if (pathname.includes("70270408") || /\bmillers\b/i.test(cleanTitle)) {
    matchedKey = "were-the-millers";
  } else if (pathname.includes("0lm2egozqqutdbb29smpp6mtxr") || /\bkhoobsurat\b/i.test(cleanTitle)) {
    matchedKey = "khoobsurat";
  } else if (pathname.includes("1271525191") || /\bsarvam\b/i.test(cleanTitle)) {
    matchedKey = "sarvam-maya";
  } else if (pathname.includes("1271710275") || /\bbethlehem\b/i.test(cleanTitle)) {
    matchedKey = "bethlehem-8ep";
  } else if (/\bbatman\b/i.test(cleanTitle)) matchedKey = "the-batman";
  else if (/\bdune\b/i.test(cleanTitle)) matchedKey = "dune-2";
  else if (/\bendgame\b/i.test(cleanTitle) || /\bavengers\b/i.test(cleanTitle)) matchedKey = "endgame";
  else if (/\bgodfather\b/i.test(cleanTitle)) matchedKey = "godfather";
  else if (/\boppenheimer\b/i.test(cleanTitle)) matchedKey = "oppenheimer";

  if (matchedKey && BUILTIN_RECIPES[matchedKey]) {
    movieSelect.value = matchedKey;
    if (autoApply) {
      applyRecipe(BUILTIN_RECIPES[matchedKey], true);
    }
    console.log("[EOC] Auto-detected built-in cut:", matchedKey);
    return BUILTIN_RECIPES[matchedKey];
  }

  // 2. Check online registry
  for (const entry of onlineRegistry) {
    const entrySlug = entry.title.toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanT = cleanTitle.replace(/[^a-z0-9]/g, "");
    if (cleanT.length >= 3 && cleanT.includes(entrySlug)) {
      const val = `registry:${entry.recipe_file}`;
      movieSelect.value = val;
      if (autoApply) {
        loadRecipeFromRegistry(entry.recipe_file, true);
      }
      console.log("[EOC] Auto-detected community registry cut:", entry.title);
      return entry;
    }
  }

  return null;
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
      if (!chrome.runtime.lastError && res) {
        if (res.hasVideo) {
          statusEl.classList.add("connected");
          statusEl.querySelector(".status-text").textContent = "Player Active";
          statusEl.title = "Connected to active video player!";
        } else {
          statusEl.classList.remove("connected");
          statusEl.querySelector(".status-text").textContent = "No Video Playing";
        }

        // If the active tab already has an active recipe loaded:
        if (res.recipe && !res.isStandby) {
          const recipeTitle = (res.recipe?.meta?.title || "").toLowerCase();
          const isGenericRecipe = ["netflix", "prime video", "hotstar", "movie (4-episode cut)"].some(g => recipeTitle.includes(g));
          const effectiveUrl = res.url || url;
          const effectiveTitle = res.pageTitle || tab.title || "";
          const matched = autoDetectMovie(effectiveUrl, effectiveTitle, false);

          // If a generic recipe was mistakenly loaded, or if the page matches a verified movie that differs from res.recipe:
          if (matched && (isGenericRecipe || (matched.meta?.title && matched.meta.title !== res.recipe.meta?.title))) {
            console.log("[EOC] Replacing stale recipe with detected movie cut:", matched.meta?.title);
            currentRecipe = matched;
            applyRecipe(matched, true);
            updateUI();
            return;
          }

          // If current stored recipe is generic and doesn't match this page, revert to Standby!
          if (isGenericRecipe && !matched) {
            console.log("[EOC] Purging stale generic recipe from non-matching page:", res.recipe.meta?.title);
            detachRecipe();
            return;
          }

          currentRecipe = res.recipe;
          const movieSelect = document.getElementById("movie-select");
          if (movieSelect) {
            const foundKey = Object.keys(BUILTIN_RECIPES).find(
              (k) => BUILTIN_RECIPES[k].meta?.title === currentRecipe.meta?.title
            );
            if (foundKey) {
              movieSelect.value = foundKey;
              const builtin = BUILTIN_RECIPES[foundKey];
              const isOutdated = builtin.episodes && currentRecipe.episodes && (
                builtin.episodes.length !== currentRecipe.episodes.length ||
                builtin.episodes.some((bEp, idx) => {
                  const cEp = currentRecipe.episodes[idx];
                  return cEp && (cEp.start_time !== bEp.start_time || cEp.end_time !== bEp.end_time);
                })
              );
              if (isOutdated) {
                console.log("[EOC] Updating stale recipe cuts to verified scene boundaries:", foundKey);
                currentRecipe = builtin;
                applyRecipe(builtin);
              }
            }
          }
          updateUI();
        } else {
          // Tab is in Standby mode. Only show matched recipe if current page actually matches!
          const matched = autoDetectMovie(res.url || url, res.pageTitle || tab.title || "", false);
          if (matched) {
            currentRecipe = matched;
            updateUI();
          } else if (currentRecipe && currentRecipe.episodes) {
            updateUI();
          } else {
            chrome.storage.local.get(["active_recipe"], (store) => {
              if (store?.active_recipe && store.active_recipe.episodes) {
                currentRecipe = store.active_recipe;
              } else {
                currentRecipe = null;
              }
              updateUI();
            });
          }
        }

        if (res.duration && res.duration > 60 && currentRecipe?.meta?.runtime_seconds) {
          const diff = Math.abs(res.duration - currentRecipe.meta.runtime_seconds);
          const banner = document.getElementById("mismatch-banner");
          if (banner) {
            const isBuiltIn = Object.values(BUILTIN_RECIPES).some(
              (b) => b.meta?.title === currentRecipe.meta?.title
            );
            if (diff > 180 && !isBuiltIn) {
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
            if (!chrome.runtime.lastError && retryRes) {
              if (retryRes.hasVideo) {
                statusEl.classList.add("connected");
                statusEl.querySelector(".status-text").textContent = "Player Active";
              }
              if (retryRes.recipe && !retryRes.isStandby) {
                const recipeTitle = (retryRes.recipe?.meta?.title || "").toLowerCase();
                const isGenericRecipe = ["netflix", "prime video", "hotstar", "movie (4-episode cut)"].some(g => recipeTitle.includes(g));
                const effectiveUrl = retryRes.url || url;
                const effectiveTitle = retryRes.pageTitle || tab.title || "";
                const matched = autoDetectMovie(effectiveUrl, effectiveTitle, false);

                if (matched && (isGenericRecipe || (matched.meta?.title && matched.meta.title !== retryRes.recipe.meta?.title))) {
                  console.log("[EOC] Replacing stale recipe with detected movie cut:", matched.meta?.title);
                  currentRecipe = matched;
                  applyRecipe(matched, true);
                  updateUI();
                  return;
                }

                if (isGenericRecipe && !matched) {
                  detachRecipe();
                  return;
                }

                currentRecipe = retryRes.recipe;
                const movieSelect = document.getElementById("movie-select");
                if (movieSelect) {
                  const foundKey = Object.keys(BUILTIN_RECIPES).find(
                    (k) => BUILTIN_RECIPES[k].meta?.title === currentRecipe.meta?.title
                  );
                  if (foundKey) {
                    movieSelect.value = foundKey;
                    const builtin = BUILTIN_RECIPES[foundKey];
                    const isOutdated = builtin.episodes && currentRecipe.episodes && (
                      builtin.episodes.length !== currentRecipe.episodes.length ||
                      builtin.episodes.some((bEp, idx) => {
                        const cEp = currentRecipe.episodes[idx];
                        return cEp && (cEp.start_time !== bEp.start_time || cEp.end_time !== bEp.end_time);
                      })
                    );
                    if (isOutdated) {
                      console.log("[EOC] Updating stale recipe cuts to verified scene boundaries:", foundKey);
                      currentRecipe = builtin;
                      applyRecipe(builtin);
                    }
                  }
                }
                updateUI();
              } else {
                const matched = autoDetectMovie(retryRes.url || url, retryRes.pageTitle || tab.title || "", false);
                if (matched) {
                  currentRecipe = matched;
                  updateUI();
                } else {
                  currentRecipe = null;
                  updateUI();
                }
              }
            } else {
              statusEl.classList.remove("connected");
              if (url.includes("netflix.com") && !url.includes("/watch/")) {
                statusEl.querySelector(".status-text").textContent = "Click Play on Movie";
                statusEl.title = "Click Play on the movie to open the video player!";
              } else {
                statusEl.querySelector(".status-text").textContent = "⚠️ Standby / Non-Video";
                statusEl.title = "No active video detected on this tab.";
              }
              currentRecipe = null;
              updateUI();
            }
          });
        });
      } else {
        statusEl.classList.remove("connected");
        statusEl.querySelector(".status-text").textContent = "No Video Playing";
        currentRecipe = null;
        updateUI();
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

// Clean movie titles from video streaming headers/footers
function cleanMovieTitle(title, url = "") {
  const checkStr = `${url} ${title}`.toLowerCase();
  if (checkStr.includes("60021525") || checkStr.includes("dil chahta hai") || checkStr.includes("dil chhata")) {
    return "Dil Chahta Hai";
  }
  if (checkStr.includes("81760391") || checkStr.includes("laapataa ladies") || checkStr.includes("laapta")) {
    return "Laapataa Ladies";
  }
  if (checkStr.includes("70270408") || checkStr.includes("we're the millers") || checkStr.includes("were the millers")) {
    return "We're the Millers";
  }
  if (checkStr.includes("0qry75b5jx2obl1p59w9bn0qxn") || checkStr.includes("queen")) {
    return "Queen";
  }
  if (checkStr.includes("1271616952") || checkStr.includes("2 states")) {
    return "2 States";
  }
  if (checkStr.includes("1271525191") || checkStr.includes("sarvam maya")) {
    return "Sarvam Maya";
  }
  if (checkStr.includes("1271710275") || checkStr.includes("bethlehem kudumba unit") || checkStr.includes("bethlehem")) {
    return "Bethlehem Kudumba Unit";
  }
  if (checkStr.includes("0j1ps71yn1v42wmlvt1lzmhpjn") || checkStr.includes("pride & prejudice") || checkStr.includes("pride and prejudice")) {
    return "Pride & Prejudice";
  }

  if (!title) return "Feature Film";
  let t = title
    .replace(/^Watch\s+movies,\s*tv\s*shows.*?$/i, "")
    .replace(/^Watch\s+/i, "")
    .replace(/^Prime Video:\s*/i, "")
    .replace(/\s*\|\s*Prime Video.*$/i, "")
    .replace(/\s*-\s*Prime Video.*$/i, "")
    .replace(/\s*\|\s*Netflix.*$/i, "")
    .replace(/\s*-\s*Netflix.*$/i, "")
    .replace(/\s*on Disney\+ Hotstar.*$/i, "")
    .replace(/\s*-\s*Disney\+ Hotstar.*$/i, "")
    .replace(/\s*-\s*YouTube.*$/i, "")
    .replace(/\s*\|\s*YouTube.*$/i, "")
    .replace(/ - Google Chrome$/i, "")
    .trim();

  // Strip parenthetical year or resolution tags if present
  t = t.replace(/\s*\(\d{4}\).*$/, "").replace(/\s*\[.*?\]$/, "").trim();

  const generic = [
    "netflix",
    "prime video",
    "primevideo",
    "hotstar",
    "disney+ hotstar",
    "youtube",
    "home",
    "watch",
    "video",
    "movie",
    "feature film",
    "watch movies, tv shows, and more",
    "movies, tv shows, and more"
  ];
  if (!t || generic.includes(t.toLowerCase()) || t.toLowerCase().startsWith("watch movies")) {
    if (checkStr.includes("0j1ps71yn1v42wmlvt1lzmhpjn") || checkStr.includes("pride")) {
      return "Pride & Prejudice";
    }
    return "Feature Film";
  }
  return t;
}

// Parse standard .srt or .vtt subtitle files into timestamped cues
function parseSrtOrVtt(content) {
  if (!content) return [];
  const lines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const cues = [];
  const timeRegex = /(?:(\d{1,2}):)?(\d{2}):(\d{2})[,\.](\d{1,3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[,\.](\d{1,3})/;

  let currentCue = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      if (currentCue && currentCue.text) {
        cues.push(currentCue);
        currentCue = null;
      }
      continue;
    }

    const match = line.match(timeRegex);
    if (match) {
      if (currentCue && currentCue.text) {
        cues.push(currentCue);
      }
      const startH = parseInt(match[1] || "0", 10);
      const startM = parseInt(match[2], 10);
      const startS = parseInt(match[3], 10);
      const startMs = parseInt(match[4].padEnd(3, "0").slice(0, 3), 10);
      const startSec = startH * 3600 + startM * 60 + startS + startMs / 1000;

      const endH = parseInt(match[5] || "0", 10);
      const endM = parseInt(match[6], 10);
      const endS = parseInt(match[7], 10);
      const endMs = parseInt(match[8].padEnd(3, "0").slice(0, 3), 10);
      const endSec = endH * 3600 + endM * 60 + endS + endMs / 1000;

      currentCue = {
        start: Math.round(startSec),
        end: Math.round(endSec),
        text: "",
      };
    } else if (currentCue) {
      if (/^\d+$/.test(line)) continue; // Subtitle index number
      if (line.startsWith("NOTE") || line.startsWith("WEBVTT")) continue;
      const clean = line.replace(/<[^>]+>/g, "").trim();
      if (clean) {
        currentCue.text = currentCue.text ? currentCue.text + " " + clean : clean;
      }
    }
  }
  if (currentCue && currentCue.text) {
    cues.push(currentCue);
  }
  return cues;
}

// Clean and enforce continuity on Gemini output for .eoc.json compliance
function cleanAndValidateRecipe(raw, fallbackTitle, durationSec, numEpisodes) {
  const meta = {
    title: raw.title || raw.meta?.title || `${fallbackTitle} (${numEpisodes}-Episode Miniseries)`,
    year: raw.year || raw.meta?.year || new Date().getFullYear(),
    runtime_seconds: durationSec,
    imdb_id: raw.imdb_id || raw.meta?.imdb_id || "",
    pacing: raw.pacing || raw.meta?.pacing || "drama",
    generator: "gemini-flash-ai",
  };

  const rawEpisodes = raw.episodes || [];
  if (!Array.isArray(rawEpisodes) || rawEpisodes.length === 0) {
    throw new Error("Gemini returned no episodes in the response.");
  }

  rawEpisodes.sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));

  const validEpisodes = [];
  const total = rawEpisodes.length;
  const targetDur = secondsToTimestamp(durationSec);

  for (let i = 0; i < total; i++) {
    const rawEp = rawEpisodes[i];
    const epNum = i + 1;
    const isFirst = i === 0;
    const isLast = i === total - 1;

    let startTime = isFirst ? "00:00:00" : validEpisodes[i - 1].end_time;
    let endTime = rawEp.end_time;

    if (!endTime || !endTime.includes(":")) {
      const fallbackSec = Math.round((durationSec / total) * epNum);
      endTime = secondsToTimestamp(fallbackSec);
    }
    if (isLast) {
      endTime = targetDur;
    }

    const startSec = timestampToSeconds(startTime);
    let endSec = timestampToSeconds(endTime);
    if (endSec <= startSec) {
      endSec = isLast ? durationSec : startSec + Math.round(durationSec / total);
      endTime = secondsToTimestamp(endSec);
    }

    const rating = Math.min(9.9, Math.max(7.0, parseFloat(rawEp.cliffhanger_rating) || 8.5));

    validEpisodes.push({
      episode_number: epNum,
      title: rawEp.title || `Part ${epNum}: Chapter ${epNum}`,
      start_time: startTime,
      end_time: endTime,
      cliffhanger_rating: Math.round(rating * 10) / 10,
      break_rationale: rawEp.break_rationale || `Key narrative act break for Part ${epNum}.`,
      recap_text: rawEp.recap_text || `Previously on ${fallbackTitle}...`,
      teaser_next: rawEp.teaser_next || `Coming up in Part ${epNum + 1}...`,
    });
  }

  // Enforce zero-gap continuity
  validEpisodes[0].start_time = "00:00:00";
  for (let i = 1; i < validEpisodes.length; i++) {
    validEpisodes[i].start_time = validEpisodes[i - 1].end_time;
  }
  validEpisodes[validEpisodes.length - 1].end_time = targetDur;

  return {
    $schema: "https://episodify.org/schema/v1.json",
    meta: meta,
    total_episodes: validEpisodes.length,
    episodes: validEpisodes,
  };
}

// Query Google ModelService dynamically to find active models for this user's API key
async function getAvailableGeminiModels(apiKey) {
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (resp.ok) {
      const data = await resp.json();
      const models = data?.models || [];
      const contentModels = models
        .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
        .map((m) => m.name.replace(/^models\//, ""));

      // Priority list of modern Flash models
      const priorityOrder = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-2.5-flash-lite",
        "gemini-3.8-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-2.0-flash-exp",
        "gemini-flash"
      ];

      const orderedList = [];
      for (const p of priorityOrder) {
        if (contentModels.includes(p)) orderedList.push(p);
      }
      for (const m of contentModels) {
        if (!orderedList.includes(m) && m.includes("flash")) orderedList.push(m);
      }
      for (const m of contentModels) {
        if (!orderedList.includes(m)) orderedList.push(m);
      }

      if (orderedList.length > 0) {
        console.log("[EOC-AI] Dynamically detected supported models:", orderedList);
        return orderedList;
      }
    } else {
      const errJson = await resp.json().catch(() => ({}));
      if (resp.status === 400 || resp.status === 403) {
        throw new Error(errJson?.error?.message || "Invalid or unauthorized Google Gemini API key. Please generate a new free key at https://aistudio.google.com/app/apikey");
      }
    }
  } catch (err) {
    if (err.message && err.message.includes("Invalid or unauthorized")) throw err;
    console.warn("[EOC-AI] Could not list models dynamically, falling back to priority list:", err.message);
  }

  return [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-2.0-flash-exp"
  ];
}

// Call Google Gemini REST API to slice film into miniseries
async function generateAiCutWithGemini({ apiKey, movieTitle, durationSec, numEpisodes, cues = [] }) {
  const durationFormatted = secondsToTimestamp(durationSec);
  const targetActMinutes = Math.round((durationSec / numEpisodes) / 60);

  let subtitleContext = "";
  if (cues && cues.length > 0) {
    let sampledCues = cues;
    if (cues.length > 1200) {
      const step = Math.ceil(cues.length / 1000);
      sampledCues = cues.filter((_, idx) => idx % step === 0);
    }
    const cuesText = sampledCues
      .map((c) => `[${secondsToTimestamp(c.start)}] ${c.text}`)
      .join("\n");
    subtitleContext = `\n\nDialogue transcript samples with timestamps:\n${cuesText}`;
  } else {
    subtitleContext = `\n\nNote: Subtitles were not detected in the player. Use your narrative beat knowledge of the screenplay for "${movieTitle}" and its total duration of ${durationFormatted} (${durationSec} seconds) to locate dramatic scene transitions and act breaks.`;
  }

  const prompt = `You are an expert series showrunner and editor for "Episodify Open Cut".
Your mission is to re-engineer the film "${movieTitle}" (runtime: ${durationFormatted}, ${durationSec} seconds) into a bingeable ${numEpisodes}-episode miniseries.

Each episode should be approximately ~${targetActMinutes} minutes long, cutting strictly at natural narrative act breaks, dramatic revelations, high-stakes dilemmas, or poignant emotional turning points.

Requirements:
1. Divide the movie into EXACTLY ${numEpisodes} continuous episodes.
2. Continuity: Episode 1 MUST start at "00:00:00". For all subsequent episodes, start_time must equal the exact end_time of the preceding episode. The final episode MUST end at "${durationFormatted}".
3. Cliffhanger Rating: Assign a suspense/cliffhanger rating between 7.0 and 9.9 for each episode break.
4. Episode Titles: Cinematic episode titles (e.g. "Part 1: The Inciting Spark").
5. Break Rationale: A 1-2 sentence dramatic explanation of why this specific moment serves as a compelling episodic break.
6. Recap Text: A 2-sentence summary of the preceding events suitable for an episodic "Previously On" card.
7. Teaser Next: A 1-sentence thrilling teaser for what comes next.
${subtitleContext}

Respond ONLY with valid JSON matching this exact structure:
{
  "title": "${movieTitle} (${numEpisodes}-Episode Miniseries)",
  "year": 2024,
  "runtime_seconds": ${durationSec},
  "pacing": "drama",
  "total_episodes": ${numEpisodes},
  "episodes": [
    {
      "episode_number": 1,
      "title": "Part 1: The Inciting Incident",
      "start_time": "00:00:00",
      "end_time": "HH:MM:SS",
      "cliffhanger_rating": 8.9,
      "break_rationale": "...",
      "recap_text": "...",
      "teaser_next": "..."
    }
  ]
}`;

  const candidateModels = await getAvailableGeminiModels(apiKey);
  let lastError = null;

  for (const model of candidateModels) {
    try {
      console.log(`[EOC-AI] Requesting narrative slice with model: ${model}`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          },
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson?.error?.message || response.statusText || `HTTP ${response.status}`;
        throw new Error(`${model} error: ${errMsg}`);
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) throw new Error(`${model} returned empty response`);

      const parsed = JSON.parse(rawText);
      return cleanAndValidateRecipe(parsed, movieTitle, durationSec, numEpisodes);
    } catch (err) {
      console.warn(`[EOC-AI] Model ${model} attempt failed:`, err.message);
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to generate miniseries with Gemini.");
}

// In-extension Gemini AI Miniseries Slicer Modal setup
function setupAiSlicerModal() {
  const modal = document.getElementById("ai-modal");
  const openBtn = document.getElementById("open-ai-modal-btn");
  const closeBtn = document.getElementById("close-ai-modal-btn");
  const filmTitleInput = document.getElementById("ai-film-title-input");
  const filmRuntimeEl = document.getElementById("ai-film-runtime");
  const captionsStatusEl = document.getElementById("ai-captions-status");
  const episodesSelect = document.getElementById("ai-episodes-select");
  const customEpisodesRow = document.getElementById("ai-custom-episodes-row");
  const customEpisodesInput = document.getElementById("ai-custom-episodes-input");
  const keyInput = document.getElementById("gemini-key-input");
  const saveKeyBtn = document.getElementById("save-key-btn");
  const keySavedHint = document.getElementById("key-saved-hint");
  const selectSubsBtn = document.getElementById("ai-select-subs-btn");
  const subsFileInput = document.getElementById("ai-subs-file-input");
  const subsFilenameEl = document.getElementById("ai-subs-filename");
  const progressBox = document.getElementById("ai-progress-box");
  const progressText = document.getElementById("ai-progress-text");
  const generateBtn = document.getElementById("start-ai-generate-btn");

  if (!modal || !openBtn) return;

  let detectedMovieTitle = "";
  let detectedRuntimeSec = 0;
  let extractedPlayerCues = [];
  let customUploadedCues = [];

  // Toggle custom episode count row
  episodesSelect?.addEventListener("change", () => {
    if (episodesSelect.value === "custom") {
      if (customEpisodesRow) customEpisodesRow.style.display = "flex";
      customEpisodesInput?.focus();
    } else {
      if (customEpisodesRow) customEpisodesRow.style.display = "none";
    }
  });

  // Load saved Gemini API key
  chrome.storage?.local?.get(["gemini_api_key"], (res) => {
    if (res?.gemini_api_key) {
      keyInput.value = res.gemini_api_key;
      keySavedHint.style.display = "block";
      keySavedHint.textContent = "✓ Key saved securely in your browser";
    }
  });

  // Save API key
  saveKeyBtn?.addEventListener("click", () => {
    const val = keyInput.value.trim();
    if (val) {
      chrome.storage?.local?.set({ gemini_api_key: val }, () => {
        keySavedHint.style.display = "block";
        keySavedHint.style.color = "";
        keySavedHint.textContent = "✓ Key saved securely in your browser";
      });
    }
  });

  // Open modal & inspect active tab video/captions
  openBtn.addEventListener("click", () => {
    modal.style.display = "flex";
    progressBox.style.display = "none";
    generateBtn.disabled = false;
    generateBtn.style.opacity = "";

    if (filmTitleInput && !filmTitleInput.value) {
      filmTitleInput.placeholder = "Scanning active player...";
    }
    filmRuntimeEl.textContent = "Detecting runtime...";
    captionsStatusEl.textContent = "Checking text tracks...";
    captionsStatusEl.className = "ai-captions-badge";

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (!tab?.id) {
        if (filmTitleInput && !filmTitleInput.value) {
          filmTitleInput.value = "Dil Chahta Hai";
        }
        filmRuntimeEl.textContent = "0s";
        captionsStatusEl.textContent = "Inactive";
        return;
      }

      function queryTabMedia() {
        chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_SUBTITLES" }, (subRes) => {
          if (!chrome.runtime.lastError && subRes) {
            const clean = cleanMovieTitle(subRes.pageTitle || tab.title || "", tab.url || "");
            detectedMovieTitle = clean;
            detectedRuntimeSec = subRes.duration > 300 ? Math.round(subRes.duration) : 7200;
            extractedPlayerCues = subRes.cues || [];

            if (filmTitleInput) {
              filmTitleInput.value = detectedMovieTitle;
            }
            filmRuntimeEl.textContent = `${secondsToTimestamp(detectedRuntimeSec)} (${Math.round(detectedRuntimeSec / 60)} mins)`;

            if (customUploadedCues.length > 0) {
              captionsStatusEl.textContent = `🟢 Loaded from file (${customUploadedCues.length} cues)`;
              captionsStatusEl.className = "ai-captions-badge ai-captions-active";
            } else if (subRes.hasSubtitles && extractedPlayerCues.length > 0) {
              captionsStatusEl.textContent = `🟢 Detected in player (${extractedPlayerCues.length} cues)`;
              captionsStatusEl.className = "ai-captions-badge ai-captions-active";
            } else {
              captionsStatusEl.textContent = "⚪ Using screenplay knowledge (or upload .srt)";
              captionsStatusEl.className = "ai-captions-badge";
            }
          } else {
            // Fallback to GET_STATUS
            chrome.tabs.sendMessage(tab.id, { action: "GET_STATUS" }, (statusRes) => {
              const clean = cleanMovieTitle(statusRes?.pageTitle || tab.title || "", tab.url || "");
              detectedMovieTitle = clean;
              detectedRuntimeSec = statusRes?.duration > 300 ? Math.round(statusRes.duration) : 7200;
              extractedPlayerCues = [];

              if (filmTitleInput) {
                filmTitleInput.value = detectedMovieTitle;
              }
              filmRuntimeEl.textContent = `${secondsToTimestamp(detectedRuntimeSec)} (${Math.round(detectedRuntimeSec / 60)} mins)`;

              if (customUploadedCues.length > 0) {
                captionsStatusEl.textContent = `🟢 Loaded from file (${customUploadedCues.length} cues)`;
                captionsStatusEl.className = "ai-captions-badge ai-captions-active";
              } else {
                captionsStatusEl.textContent = "⚪ Using screenplay knowledge (or upload .srt)";
                captionsStatusEl.className = "ai-captions-badge";
              }
            });
          }
        });
      }

      tryAutoInject(tab, queryTabMedia);
    });
  });

  // Close modal
  closeBtn?.addEventListener("click", () => {
    modal.style.display = "none";
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });

  // Optional custom subtitle file
  selectSubsBtn?.addEventListener("click", () => {
    subsFileInput.click();
  });

  subsFileInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = parseSrtOrVtt(evt.target.result);
        if (parsed.length === 0) {
          alert("Could not find subtitle timestamps in the uploaded file. Please select a valid .srt or .vtt file.");
          return;
        }
        customUploadedCues = parsed;
        subsFilenameEl.style.display = "block";
        subsFilenameEl.textContent = `📄 ${file.name} (${parsed.length} cues loaded)`;
        captionsStatusEl.textContent = `🟢 Loaded from file (${parsed.length} cues)`;
        captionsStatusEl.className = "ai-captions-badge ai-captions-active";
      } catch (err) {
        alert("Failed to parse subtitle file: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Trigger Gemini AI generation
  generateBtn?.addEventListener("click", async () => {
    const apiKey = keyInput.value.trim();
    if (!apiKey) {
      keyInput.focus();
      keyInput.style.borderColor = "#ef4444";
      keySavedHint.style.display = "block";
      keySavedHint.style.color = "#ef4444";
      keySavedHint.textContent = "⚠️ Please enter your Google Gemini API key first";
      return;
    }
    keyInput.style.borderColor = "";
    keySavedHint.style.color = "";
    chrome.storage?.local?.set({ gemini_api_key: apiKey });

    let numEpisodes = 4;
    if (episodesSelect.value === "custom") {
      numEpisodes = parseInt(customEpisodesInput?.value, 10);
      if (isNaN(numEpisodes) || numEpisodes < 2) numEpisodes = 2;
      if (numEpisodes > 12) numEpisodes = 12;
    } else {
      numEpisodes = parseInt(episodesSelect.value, 10) || 4;
    }

    const cuesToUse = customUploadedCues.length > 0 ? customUploadedCues : extractedPlayerCues;
    const movieTitle = filmTitleInput?.value?.trim() || detectedMovieTitle || "Dil Chahta Hai";
    const runtimeSec = detectedRuntimeSec > 300 ? detectedRuntimeSec : 7200;

    generateBtn.disabled = true;
    generateBtn.style.opacity = "0.6";
    progressBox.style.display = "flex";
    progressText.textContent = "Connecting to Google Gemini...";

    const steps = [
      "Analyzing screenplay act breaks & character arcs...",
      "Detecting dramatic act breaks & narrative turning points...",
      "Formatting episodic recaps and next-part teasers...",
      "Verifying zero-gap scene boundary continuity...",
    ];
    let stepIdx = 0;
    const progressTimer = setInterval(() => {
      if (stepIdx < steps.length) {
        progressText.textContent = steps[stepIdx++];
      }
    }, 2200);

    try {
      const recipe = await generateAiCutWithGemini({
        apiKey: apiKey,
        movieTitle: movieTitle,
        durationSec: runtimeSec,
        numEpisodes: numEpisodes,
        cues: cuesToUse,
      });

      clearInterval(progressTimer);
      progressText.textContent = `🎉 Created ${recipe.total_episodes}-part miniseries! Loading Part 1...`;

      // Apply newly generated recipe directly to player!
      applyRecipe(recipe, true);

      // Cache locally
      const slug = movieTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const cacheKey = `recipe_${slug}.eoc.json`;
      const saveObj = {};
      saveObj[cacheKey] = recipe;
      chrome.storage?.local?.set(saveObj);

      // Add to popup dropdown
      const movieSelect = document.getElementById("movie-select");
      if (movieSelect) {
        const optVal = `registry:${slug}.eoc.json`;
        let existingOpt = Array.from(movieSelect.options).find((o) => o.text.includes(movieTitle));
        if (!existingOpt) {
          existingOpt = document.createElement("option");
          existingOpt.value = optVal;
          existingOpt.textContent = `⚡ ${movieTitle} (${recipe.meta.year}) - ${recipe.total_episodes} Eps [AI Cut]`;
          movieSelect.insertBefore(existingOpt, movieSelect.children[2] || null);
        }
        movieSelect.value = existingOpt.value;
      }

      setTimeout(() => {
        modal.style.display = "none";
        generateBtn.disabled = false;
        generateBtn.style.opacity = "";
        progressBox.style.display = "none";
        updateUI();
      }, 1400);
    } catch (err) {
      clearInterval(progressTimer);
      progressText.textContent = `❌ Generation failed: ${err.message}`;
      generateBtn.disabled = false;
      generateBtn.style.opacity = "";
      console.error("[EOC-AI] Generation failed:", err);
    }
  });
}

