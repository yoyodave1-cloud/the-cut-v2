/**
 * Featured podcast carousel for GET /creator-videos?featured=podcast
 *
 * Returns one most-recent upload per active podcast creator (no Shorts duration
 * filter), ordered with a deterministic twice-daily shuffle.
 *
 * Integration (the-cut/backend/server.js):
 *   const {
 *     isFeaturedPodcastRequest,
 *     handleFeaturedPodcastVideos,
 *   } = require('./patches/featured-podcast-carousel');
 *
 *   app.get('/creator-videos', async (req, res) => {
 *     if (isFeaturedPodcastRequest(req)) {
 *       return handleFeaturedPodcastVideos(req, res, supabase, mapCreatorVideoRows);
 *     }
 *     // ... existing handler
 *   });
 */

/** Canonical carousel order — rotateIndex maps into this list. */
const PODCAST_CHANNEL_IDS = [
  "UCZNEuuyLZQt5H9lUqImc0CQ",
  "UC-7RYbWkDhY2FjYEXBGXUMQ",
  "UCZn1UAWT9W0pLTWCdt8CTBg",
  "UC1lZT-3zObkaPerEyjxtA_w",
  "UCt5ESUx6omMUsMoEKvMTzlA",
  "UCEWo2BUWvCgRXSD1Xg3QOtQ",
  "UCc5JXe0hSVA-VOh0x5qkXag",
  "UCa98aY7eenHS_YhehF-vuEQ",
];

const PODCAST_CAROUSEL_SIZE = PODCAST_CHANNEL_IDS.length;

function firstQueryValue(value) {
  if (Array.isArray(value)) return String(value[0] ?? "").trim();
  return String(value ?? "").trim();
}

function isFeaturedPodcastRequest(req) {
  return firstQueryValue(req.query.featured).toLowerCase() === "podcast";
}

function hashSeed(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function next() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle(items, seed) {
  const result = [...items];
  const random = mulberry32(hashSeed(seed));
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function localDateString(now) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function orderFeaturedPodcastVideos(videosByChannelId, now = new Date()) {
  const dayNumber = Math.floor(now.getTime() / 86400000);
  const isPM = now.getHours() >= 12;
  const rotateIndex = (dayNumber * 2 + (isPM ? 1 : 0)) % PODCAST_CAROUSEL_SIZE;
  const seed = `${localDateString(now)}-${isPM ? "PM" : "AM"}`;

  const featuredChannelId = PODCAST_CHANNEL_IDS[rotateIndex];
  const featuredVideo = videosByChannelId.get(featuredChannelId);
  const rest = PODCAST_CHANNEL_IDS.filter((_, index) => index !== rotateIndex)
    .map((channelId) => videosByChannelId.get(channelId))
    .filter(Boolean);

  if (featuredVideo) {
    return [featuredVideo, ...seededShuffle(rest, seed)];
  }

  const available = PODCAST_CHANNEL_IDS.map((channelId) => videosByChannelId.get(channelId)).filter(
    Boolean,
  );
  return seededShuffle(available, seed);
}

function latestVideoPerCreator(rows) {
  const byCreatorId = new Map();
  for (const row of rows) {
    if (!row?.creator_id || !row?.video_id) continue;
    if (!byCreatorId.has(row.creator_id)) {
      byCreatorId.set(row.creator_id, row);
    }
  }
  return byCreatorId;
}

function localDayOfYear(now) {
  const start = new Date(now.getFullYear(), 0, 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((today.getTime() - start.getTime()) / 86400000) + 1;
}

/**
 * Daily Home featured cards — shuffle the 8 sources by day-of-year and take 3.
 * Seed is intentionally different from the twice-daily carousel rotation.
 */
function pickDailyFeaturedPodcastVideos(videosByChannelId, now = new Date()) {
  const seed = `home-cards-${now.getFullYear()}-${localDayOfYear(now)}`;
  return seededShuffle([...PODCAST_CHANNEL_IDS], seed)
    .map((channelId) => videosByChannelId.get(channelId))
    .filter(Boolean)
    .slice(0, 3);
}

function isDailyPodcastPickRequest(req) {
  return (
    isFeaturedPodcastRequest(req) &&
    firstQueryValue(req.query.pick).toLowerCase() === "3daily"
  );
}

/** Apple Podcasts collection IDs keyed by YouTube channel_id (artwork via iTunes Lookup). */
const APPLE_PODCAST_ID_BY_CHANNEL = {
  "UCZNEuuyLZQt5H9lUqImc0CQ": "1406443091",
  "UC-7RYbWkDhY2FjYEXBGXUMQ": "1200343264",
  "UCZn1UAWT9W0pLTWCdt8CTBg": "880837011",
  "UC1lZT-3zObkaPerEyjxtA_w": "880837011",
  "UCt5ESUx6omMUsMoEKvMTzlA": "1498625027",
  "UCEWo2BUWvCgRXSD1Xg3QOtQ": "1663329120",
  "UCc5JXe0hSVA-VOh0x5qkXag": "1131723994",
  "UCa98aY7eenHS_YhehF-vuEQ": "1198293635",
};

function applePodcastIdForChannel(channelId) {
  return APPLE_PODCAST_ID_BY_CHANNEL[String(channelId || "").trim()] || "";
}

async function fetchLatestPodcastVideosByChannelId(supabase) {
  const { data: creators, error: creatorsError } = await supabase
    .from("creators")
    .select("id, channel_id")
    .eq("active", true)
    .eq("type", "podcast");

  if (creatorsError) {
    throw creatorsError;
  }

  const podcastCreators = Array.isArray(creators) ? creators : [];
  if (!podcastCreators.length) {
    return { videosByChannelId: new Map(), channelIdByCreatorId: new Map() };
  }

  const creatorIds = podcastCreators.map((row) => row.id).filter(Boolean);
  const channelIdByCreatorId = new Map(
    podcastCreators.map((row) => [row.id, row.channel_id]),
  );

  const { data, error } = await supabase
    .from("creator_videos")
    .select(
      "video_id,title,summary,published_at,creator_id,creators(id,name,handle,avatar_url,type)",
    )
    .in("creator_id", creatorIds)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw error;
  }

  const latestByCreator = latestVideoPerCreator(Array.isArray(data) ? data : []);
  const videosByChannelId = new Map();

  for (const row of latestByCreator.values()) {
    const channelId = channelIdByCreatorId.get(row.creator_id);
    if (!channelId) continue;
    videosByChannelId.set(String(channelId).trim(), row);
  }

  return { videosByChannelId, channelIdByCreatorId };
}

async function fetchFeaturedPodcastVideoRows(supabase) {
  const { videosByChannelId } = await fetchLatestPodcastVideosByChannelId(supabase);
  return orderFeaturedPodcastVideos(videosByChannelId);
}

function mapDailyPickVideos(rows, mapCreatorVideoRows, channelIdByCreatorId) {
  return rows
    .map((row) => {
      const mapped = mapCreatorVideoRows([row])[0];
      if (!mapped) return null;
      const channelId = channelIdByCreatorId.get(row.creator_id);
      return {
        ...mapped,
        applePodcastId: applePodcastIdForChannel(channelId),
      };
    })
    .filter(Boolean);
}

async function handleFeaturedPodcastVideos(req, res, supabase, mapCreatorVideoRows) {
  try {
    if (isDailyPodcastPickRequest(req)) {
      const { videosByChannelId, channelIdByCreatorId } =
        await fetchLatestPodcastVideosByChannelId(supabase);
      const rows = pickDailyFeaturedPodcastVideos(videosByChannelId);
      return res.json({
        videos: mapDailyPickVideos(rows, mapCreatorVideoRows, channelIdByCreatorId),
      });
    }

    const rows = await fetchFeaturedPodcastVideoRows(supabase);
    return res.json({ videos: mapCreatorVideoRows(rows) });
  } catch (err) {
    return res.status(500).json({
      error: "Database error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

module.exports = {
  PODCAST_CHANNEL_IDS,
  PODCAST_CAROUSEL_SIZE,
  APPLE_PODCAST_ID_BY_CHANNEL,
  isFeaturedPodcastRequest,
  isDailyPodcastPickRequest,
  handleFeaturedPodcastVideos,
  fetchFeaturedPodcastVideoRows,
  orderFeaturedPodcastVideos,
  pickDailyFeaturedPodcastVideos,
  seededShuffle,
};
