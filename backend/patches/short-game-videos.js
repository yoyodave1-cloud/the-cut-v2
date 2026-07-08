/**
 * GET /short-game-videos — curated short-game masterclass lessons by main topic.
 *
 * Integration (the-cut/backend/server.js):
 *   const { registerShortGameVideosRoutes } = require('./patches/short-game-videos');
 *   registerShortGameVideosRoutes(app, supabase);
 */

const MAIN_TOPIC_ORDER = [
  "Putting",
  "Chipping",
  "Bunker",
  "Pitching",
  "Approach Irons",
  "Hybrids & Woods",
  "Drivers",
];

const PUTTING_FALLBACK_SUB_TOPICS = [
  "Lag Putts",
  "Green Reading",
  "Short Putts",
  "Setup & Technique",
];

/** One main topic of curated fallback when Supabase is empty or unreachable. */
const CURATED_FALLBACK_VIDEOS = [
  {
    main_topic: "Putting",
    topic: "Setup & Technique",
    youtube_video_id: "qp6k5d8FJOA",
    title: "I get a Lesson from the World's Best Putting Coach (Brad Faxon)",
    channel_name: "Rick Shiels Golf Show",
    display_order: 1,
  },
  {
    main_topic: "Putting",
    topic: "Setup & Technique",
    youtube_video_id: "-O_fF94DDFU",
    title: "Butch Harmon School of Golf: The Keys to Great Putting",
    channel_name: "Butch Harmon",
    display_order: 2,
  },
  {
    main_topic: "Putting",
    topic: "Setup & Technique",
    youtube_video_id: "nltss_br28s",
    title: "Easiest Putting Technique Ever",
    channel_name: "TruGolf Academy",
    display_order: 3,
  },
  {
    main_topic: "Putting",
    topic: "Setup & Technique",
    youtube_video_id: "_jdL1hCE1To",
    title: "The Last Putting Lesson You Will Ever Need",
    channel_name: "Danny Maude",
    display_order: 4,
  },
];

const CACHE_KEY = "short-game-videos";
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = {};

function getCache(key) {
  const entry = cache[key];
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    delete cache[key];
    return null;
  }
  return entry.data;
}

function setCache(key, data, ttlMs) {
  cache[key] = { data, expiresAt: Date.now() + ttlMs };
}

function mapShortGameVideoRow(row) {
  if (!row?.youtube_video_id) return null;
  return {
    youtubeVideoId: row.youtube_video_id,
    title: row.title || "",
    channelName: row.channel_name || "",
    displayOrder: row.display_order,
  };
}

function groupVideosByMainTopic(rows) {
  const byMainTopic = new Map();

  for (const row of rows) {
    const mainTopic = row.main_topic;
    const topic = row.topic;
    if (!mainTopic || !topic) continue;

    const video = mapShortGameVideoRow(row);
    if (!video) continue;

    if (!byMainTopic.has(mainTopic)) {
      byMainTopic.set(mainTopic, new Map());
    }
    const bySubTopic = byMainTopic.get(mainTopic);
    if (!bySubTopic.has(topic)) {
      bySubTopic.set(topic, []);
    }
    bySubTopic.get(topic).push(video);
  }

  for (const bySubTopic of byMainTopic.values()) {
    for (const videos of bySubTopic.values()) {
      videos.sort((a, b) => a.displayOrder - b.displayOrder);
    }
  }

  const seenMainTopics = new Set(MAIN_TOPIC_ORDER);
  const mainTopics = MAIN_TOPIC_ORDER.map((mainTopic) => {
    const bySubTopic = byMainTopic.get(mainTopic);
    const subTopics = bySubTopic
      ? Array.from(bySubTopic.entries()).map(([topic, videos]) => ({ topic, videos }))
      : [];
    return { mainTopic, subTopics };
  });

  for (const [mainTopic, bySubTopic] of byMainTopic.entries()) {
    if (seenMainTopics.has(mainTopic)) continue;
    mainTopics.push({
      mainTopic,
      subTopics: Array.from(bySubTopic.entries()).map(([topic, videos]) => ({
        topic,
        videos,
      })),
    });
  }

  return { mainTopics };
}

function curatedFallbackPayload() {
  const bySubTopic = new Map(
    PUTTING_FALLBACK_SUB_TOPICS.map((topic) => [topic, []]),
  );

  for (const row of CURATED_FALLBACK_VIDEOS) {
    const video = mapShortGameVideoRow(row);
    if (!video) continue;
    const bucket = bySubTopic.get(row.topic);
    if (bucket) bucket.push(video);
  }

  for (const videos of bySubTopic.values()) {
    videos.sort((a, b) => a.displayOrder - b.displayOrder);
  }

  return {
    mainTopics: [
      {
        mainTopic: "Putting",
        subTopics: PUTTING_FALLBACK_SUB_TOPICS.map((topic) => ({
          topic,
          videos: bySubTopic.get(topic) ?? [],
        })),
      },
    ],
  };
}

function isMissingTableError(error) {
  return error?.code === "PGRST205";
}

async function fetchShortGameVideosPayload(supabase) {
  const { data, error } = await supabase
    .from("short_game_videos")
    .select("main_topic,topic,youtube_video_id,title,channel_name,display_order")
    .eq("active", true)
    .order("main_topic", { ascending: true })
    .order("topic", { ascending: true })
    .order("display_order", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) {
      console.warn(
        "[short-game-videos] table missing; serving curated fallback list",
      );
      return { fromDatabase: false, payload: curatedFallbackPayload() };
    }

    console.warn(
      "[short-game-videos] database error; serving curated fallback list:",
      error.message,
    );
    return { fromDatabase: false, payload: curatedFallbackPayload() };
  }

  const rows = Array.isArray(data) ? data : [];
  if (rows.length === 0) {
    return { fromDatabase: false, payload: curatedFallbackPayload() };
  }

  return { fromDatabase: true, payload: groupVideosByMainTopic(rows) };
}

function registerShortGameVideosRoutes(app, supabase) {
  app.get("/short-game-videos", async (req, res) => {
    try {
      const cached = getCache(CACHE_KEY);
      if (cached) return res.json(cached);

      const { fromDatabase, payload } = await fetchShortGameVideosPayload(supabase);
      if (fromDatabase) {
        setCache(CACHE_KEY, payload, CACHE_TTL_MS);
      }
      return res.json(payload);
    } catch (err) {
      console.warn(
        "[short-game-videos] request failed; serving curated fallback list:",
        err instanceof Error ? err.message : String(err),
      );
      return res.json(curatedFallbackPayload());
    }
  });
}

module.exports = {
  registerShortGameVideosRoutes,
  MAIN_TOPIC_ORDER,
  PUTTING_FALLBACK_SUB_TOPICS,
  CURATED_FALLBACK_VIDEOS,
  groupVideosByMainTopic,
  curatedFallbackPayload,
  mapShortGameVideoRow,
};
