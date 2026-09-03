import { Linking } from 'react-native';
import { articleMatchesCreatorNews, filterCreatorTaggedNews, normalizeNewsTitleKey } from './lib/creatorNewsFilter';

export const API_BASE = 'https://the-cut-production-f9f7.up.railway.app';

export type Article = {
  title: string;
  description?: string;
  url: string;
  urlToImage?: string;
  source: { name: string };
  publishedAt: string;
};

export type VideoItem = {
  videoId: string;
  title: string;
  summary?: string;
  thumbnailUrl?: string;
  publishedAt: string;
  viewCount?: number;
  creator?: { name: string; avatarUrl?: string };
  /** True for YouTube Shorts; false for full-length. Undefined = treat as Short. */
  isShort?: boolean;
};

/** Raw row shape from /top-videos and /top-shorts (snake_case DB fields). */
type ApiVideoRow = {
  video_id?: string;
  videoId?: string;
  title?: string;
  summary?: string;
  description?: string;
  published_at?: string;
  publishedAt?: string;
  thumbnail_url?: string;
  thumbnailUrl?: string;
  view_count?: number;
  viewCount?: number;
  creators?: { name?: string; avatar_url?: string };
  creator?: { name?: string; avatarUrl?: string };
};

export function normalizeVideoItem(raw: ApiVideoRow): VideoItem {
  const videoId = raw.videoId ?? raw.video_id ?? '';
  const publishedAt = raw.publishedAt ?? raw.published_at ?? '';
  const thumbnailUrl =
    raw.thumbnailUrl ??
    raw.thumbnail_url ??
    (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : undefined);
  const creatorRaw = raw.creator ?? raw.creators;
  const avatarUrl =
    (creatorRaw as { avatarUrl?: string; avatar_url?: string } | undefined)?.avatarUrl ??
    (creatorRaw as { avatarUrl?: string; avatar_url?: string } | undefined)?.avatar_url;

  return {
    videoId,
    title: raw.title ?? '',
    summary: raw.summary ?? raw.description,
    thumbnailUrl,
    publishedAt,
    viewCount: raw.viewCount ?? raw.view_count,
    creator: creatorRaw?.name
      ? {
          name: creatorRaw.name,
          avatarUrl,
        }
      : undefined,
  };
}

export function normalizeVideoList(raw: unknown): VideoItem[] {
  const list = Array.isArray(raw) ? raw : (raw as { videos?: ApiVideoRow[] })?.videos ?? [];
  return list.map(normalizeVideoItem).filter((v) => v.videoId);
}

export function videoThumbnailUri(video: VideoItem): string {
  return (
    video.thumbnailUrl ||
    (video.videoId ? `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg` : '')
  );
}

export function logImageError(label: string, uri: string) {
  return () => {
    console.warn(`[The Cut] Image failed to load (${label}):`, uri);
  };
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function youtubeShortsUrl(videoId: string): string {
  return `https://www.youtube.com/shorts/${videoId}`;
}

export function openYouTubeVideo(videoId: string): void {
  if (videoId) {
    Linking.openURL(youtubeWatchUrl(videoId));
  }
}

export function openYouTubeShort(videoId: string): void {
  if (videoId) {
    Linking.openURL(youtubeShortsUrl(videoId));
  }
}

/** Matches header carousel fetch in App.tsx — feed tour highlights start after this. */
export const TOUR_LATEST_HEADER_LIMIT = 15;

export async function fetchTourLatestVideos(
  limit = TOUR_LATEST_HEADER_LIMIT,
  offset = 0,
): Promise<VideoItem[]> {
  const res = await fetch(`${API_BASE}/tour-latest-videos?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(`tour-latest-videos failed (${res.status})`);
  return normalizeVideoList(await res.json());
}

/** Latest tour-channel videos whose creator name matches (e.g. "PGA Tour"). */
export async function fetchTourLatestVideosByCreatorName(
  creatorName: string,
  limit = 10,
): Promise<VideoItem[]> {
  const pool = await fetchTourLatestVideos(50);
  const needle = creatorName.trim().toLowerCase();
  return pool
    .filter((video) => (video.creator?.name ?? '').trim().toLowerCase() === needle)
    .slice(0, limit);
}

function videoMatchesKeyword(video: VideoItem, keywords: readonly string[]): boolean {
  const terms = keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean);
  if (!terms.length) return false;
  const blob = `${video.title} ${video.summary ?? ''} ${video.creator?.name ?? ''}`.toLowerCase();
  return terms.some((term) => blob.includes(term));
}

/** Scan ranked creator videos for a keyword in title / summary / creator name. */
export async function fetchVideosMatchingKeyword(
  keywords: string | readonly string[],
  limit = 8,
): Promise<VideoItem[]> {
  const terms = (Array.isArray(keywords) ? keywords : [keywords]).map(String);
  const matches: VideoItem[] = [];
  const seen = new Set<string>();
  for (let offset = 0; offset < 400 && matches.length < limit; offset += 50) {
    const page = await fetchTopVideos(50, offset);
    if (!page.length) break;
    for (const video of page) {
      if (!video.videoId || seen.has(video.videoId)) continue;
      if (!videoMatchesKeyword(video, terms)) continue;
      seen.add(video.videoId);
      matches.push(video);
      if (matches.length >= limit) break;
    }
    if (page.length < 50) break;
  }
  return matches.slice(0, limit);
}


export type TopCreator = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
  subscriberCount: number | null;
  channelId: string;
};

type ApiTopCreatorRow = {
  id?: string;
  name?: string;
  handle?: string;
  avatarUrl?: string;
  avatar_url?: string;
  subscriberCount?: number | null;
  subscriber_count?: number | null;
  channelId?: string;
  channel_id?: string;
};

function normalizeTopCreator(raw: ApiTopCreatorRow): TopCreator | null {
  const id = raw.id?.trim();
  const name = raw.name?.trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    handle: raw.handle?.trim() || name,
    avatarUrl: raw.avatarUrl ?? raw.avatar_url ?? '',
    subscriberCount: raw.subscriberCount ?? raw.subscriber_count ?? null,
    channelId: raw.channelId ?? raw.channel_id ?? '',
  };
}

export function formatSubscriberCount(count: number | null | undefined): string {
  if (count == null || count < 0) return '—';
  if (count >= 1_000_000) {
    const value = count / 1_000_000;
    return `${value >= 10 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    const value = count / 1_000;
    return `${value >= 100 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return count.toLocaleString();
}

export type CreatorLeaderboard = {
  top50: TopCreator[];
  honorableMentions: TopCreator[];
  top1LatestVideo: VideoItem | null;
};

export type CreatorVideoRow = {
  videoId: string;
  title: string;
  summary: string;
  publishedAt: string;
  thumbnailUrl: string;
  watchUrl: string;
  creator?: { name: string; avatarUrl?: string };
  isShort?: boolean;
  is_short?: boolean;
};

export async function fetchCreatorVideos(
  creatorId: string,
  type: 'videos' | 'shorts',
  limit = 15,
): Promise<CreatorVideoRow[]> {
  const params = new URLSearchParams({
    creatorId,
    limit: String(limit),
  });
  if (type === 'shorts') {
    params.set('type', 'shorts');
  }
  const res = await fetch(`${API_BASE}/creator-videos?${params.toString()}`);
  if (!res.ok) throw new Error(`creator-videos failed (${res.status})`);
  const json = (await res.json()) as { videos?: CreatorVideoRow[] };
  return Array.isArray(json.videos) ? json.videos.slice(0, limit) : [];
}

function normalizeTopCreatorList(rows: ApiTopCreatorRow[] | undefined): TopCreator[] {
  const list = Array.isArray(rows) ? rows : [];
  return list.map(normalizeTopCreator).filter((c): c is TopCreator => c != null);
}

function creatorVideoRowToVideoItem(
  row: CreatorVideoRow,
  creator?: TopCreator,
): VideoItem {
  const embeddedCreator = row.creator;
  const isShort =
    typeof row.isShort === 'boolean'
      ? row.isShort
      : typeof row.is_short === 'boolean'
        ? row.is_short
        : undefined;
  return {
    videoId: row.videoId,
    title: row.title,
    summary: row.summary,
    publishedAt: row.publishedAt,
    thumbnailUrl: row.thumbnailUrl,
    creator: creator
      ? { name: creator.name, avatarUrl: creator.avatarUrl }
      : embeddedCreator?.name
        ? { name: embeddedCreator.name, avatarUrl: embeddedCreator.avatarUrl }
        : undefined,
    ...(typeof isShort === 'boolean' ? { isShort } : {}),
  };
}

export async function fetchLatestShortsForRankedCreators(
  creators: TopCreator[],
): Promise<VideoItem[]> {
  return fetchLatestMediaForRankedCreators(creators, 'shorts', 'fetchLatestShortsForRankedCreators');
}

export async function fetchLatestVideosForRankedCreators(
  creators: TopCreator[],
): Promise<VideoItem[]> {
  return fetchLatestMediaForRankedCreators(creators, 'videos', 'fetchLatestVideosForRankedCreators');
}

export type RankedInsertSpec = {
  insertIndex: number;
  startRank: number;
  endRank: number;
  media: 'videos' | 'shorts';
};

export async function fetchRankedInsertMedia(
  top50: TopCreator[],
  specs: RankedInsertSpec[],
): Promise<Record<number, VideoItem[]>> {
  const entries = await Promise.all(
    specs.map(async (spec) => {
      const creators = top50.slice(spec.startRank - 1, spec.endRank);
      const items =
        spec.media === 'shorts'
          ? await fetchLatestShortsForRankedCreators(creators)
          : await fetchLatestVideosForRankedCreators(creators);
      return [spec.insertIndex, items] as const;
    }),
  );
  return Object.fromEntries(entries);
}

async function fetchLatestMediaForRankedCreators(
  creators: TopCreator[],
  type: 'videos' | 'shorts',
  logLabel: string,
): Promise<VideoItem[]> {
  if (!creators.length) return [];

  const results = await Promise.all(
    creators.map(async (creator) => {
      try {
        const rows = await fetchCreatorVideos(creator.id, type, 1);
        const latest = rows[0];
        if (!latest) return null;
        return creatorVideoRowToVideoItem(latest, creator);
      } catch (err) {
        console.warn(
          `[${logLabel}] ${creator.name}:`,
          err instanceof Error ? err.message : err,
        );
        return null;
      }
    }),
  );

  return results.filter((item): item is VideoItem => item != null);
}

async function resolveTop1LatestVideo(
  top50: TopCreator[],
  embedded: ApiVideoRow | null | undefined,
): Promise<VideoItem | null> {
  const topCreator = top50[0];
  if (!topCreator) return null;

  if (embedded) {
    const normalized = normalizeVideoItem(embedded);
    if (normalized.videoId) {
      return {
        ...normalized,
        creator: normalized.creator ?? {
          name: topCreator.name,
          avatarUrl: topCreator.avatarUrl,
        },
      };
    }
  }

  const rows = await fetchCreatorVideos(topCreator.id, 'videos', 1);
  const latest = rows[0];
  if (!latest) return null;
  return creatorVideoRowToVideoItem(latest, topCreator);
}

export async function fetchTop100Creators(): Promise<CreatorLeaderboard> {
  const res = await fetch(`${API_BASE}/creators/top100`);
  if (!res.ok) throw new Error(`creators/top100 failed (${res.status})`);
  const json = (await res.json()) as {
    top50?: ApiTopCreatorRow[];
    honorableMentions?: ApiTopCreatorRow[];
    top1LatestVideo?: ApiVideoRow | null;
    creators?: ApiTopCreatorRow[];
  };

  if (Array.isArray(json.top50) || Array.isArray(json.honorableMentions)) {
    const top50 = normalizeTopCreatorList(json.top50).slice(0, 50);
    const top1LatestVideo = await resolveTop1LatestVideo(top50, json.top1LatestVideo);
    return {
      top50,
      honorableMentions: normalizeTopCreatorList(json.honorableMentions),
      top1LatestVideo,
    };
  }

  const legacy = normalizeTopCreatorList(json.creators);
  const top50 = legacy.slice(0, 50);
  const top1LatestVideo = await resolveTop1LatestVideo(top50, null);
  return {
    top50,
    honorableMentions: legacy.slice(50),
    top1LatestVideo,
  };
}

export async function fetchTopVideos(limit = 20, offset = 0): Promise<VideoItem[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const res = await fetch(`${API_BASE}/top-videos?${params.toString()}`);
  if (!res.ok) throw new Error(`top-videos failed (${res.status})`);
  const items = normalizeVideoList(await res.json());
  return items.slice(0, limit);
}

export type HotRightNowVideo = {
  videoId: string;
  title: string;
  summary: string;
  publishedAt: string;
  thumbnailUrl: string;
  watchUrl: string;
  viewCount: number;
  velocityPerHour: number | null;
  creator: {
    id: string;
    name: string;
    handle: string;
    avatarUrl: string | null;
  };
};

type HotRightNowApiRow = {
  videoId?: string;
  title?: string;
  summary?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  watchUrl?: string;
  viewCount?: number;
  velocityPerHour?: number | null;
  creator?: {
    id?: string;
    name?: string;
    handle?: string;
    avatarUrl?: string | null;
  };
};

function normalizeHotRightNowVideo(raw: HotRightNowApiRow): HotRightNowVideo | null {
  const videoId = raw.videoId?.trim();
  if (!videoId) return null;

  const creator = raw.creator;
  if (!creator?.id || !creator?.name) return null;

  return {
    videoId,
    title: raw.title ?? '',
    summary: raw.summary ?? '',
    publishedAt: raw.publishedAt ?? '',
    thumbnailUrl:
      raw.thumbnailUrl?.trim() ||
      `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    watchUrl: raw.watchUrl?.trim() || `https://www.youtube.com/watch?v=${videoId}`,
    viewCount: raw.viewCount ?? 0,
    velocityPerHour:
      raw.velocityPerHour == null || !Number.isFinite(raw.velocityPerHour)
        ? null
        : raw.velocityPerHour,
    creator: {
      id: creator.id,
      name: creator.name,
      handle: creator.handle ?? '',
      avatarUrl: creator.avatarUrl ?? null,
    },
  };
}

export async function fetchHotRightNow(): Promise<HotRightNowVideo[]> {
  const res = await fetch(`${API_BASE}/hot-right-now`);
  if (!res.ok) throw new Error(`hot-right-now failed (${res.status})`);
  const json = await res.json();
  const list = Array.isArray(json) ? json : [];
  return list
    .map((row) => normalizeHotRightNowVideo(row as HotRightNowApiRow))
    .filter((row): row is HotRightNowVideo => row != null)
    .slice(0, 10);
}

export function formatVelocityPerHour(velocity: number): string {
  if (velocity >= 1000) {
    return `+${(velocity / 1000).toFixed(1)}k views/hr`;
  }
  return `+${Math.round(velocity)} views/hr`;
}

export function formatHotRightNowViewCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M views`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K views`;
  return `${count} views`;
}

/** Creator-page featured carousel — latest upload per podcast creator. */
export const CREATOR_FEATURED_CAROUSEL_LIMIT = 8;

export async function fetchCreatorFeaturedVideos(): Promise<VideoItem[]> {
  const res = await fetch(`${API_BASE}/creator-videos?featured=podcast`);
  if (!res.ok) throw new Error(`creator-videos featured=podcast failed (${res.status})`);
  const json = (await res.json()) as { videos?: CreatorVideoRow[] };
  const rows = Array.isArray(json.videos) ? json.videos : [];
  return rows.map((row) => creatorVideoRowToVideoItem(row));
}

/** Home Section 5 carousel — Shorts-first, one item per podcast source. */
export async function fetchCreatorFeaturedPodcastShorts(): Promise<VideoItem[]> {
  const res = await fetch(`${API_BASE}/creator-videos?featured=podcast&format=shorts`);
  if (!res.ok) {
    throw new Error(`creator-videos featured=podcast format=shorts failed (${res.status})`);
  }
  const json = (await res.json()) as { videos?: CreatorVideoRow[] };
  const rows = Array.isArray(json.videos) ? json.videos : [];
  return rows.map((row) => creatorVideoRowToVideoItem(row));
}

export type FeaturedPodcastPick = {
  videoId: string;
  title: string;
  publishedAt: string;
  applePodcastId: string;
  podcastName: string;
};

type FeaturedPodcastPickRow = CreatorVideoRow & {
  applePodcastId?: string;
};

export async function fetchDailyFeaturedPodcastPicks(): Promise<FeaturedPodcastPick[]> {
  const res = await fetch(`${API_BASE}/creator-videos?featured=podcast&pick=3daily`);
  if (!res.ok) {
    throw new Error(`creator-videos featured=podcast pick=3daily failed (${res.status})`);
  }
  const json = (await res.json()) as { videos?: FeaturedPodcastPickRow[] };
  const rows = Array.isArray(json.videos) ? json.videos : [];
  return rows
    .map((row) => {
      const videoId = row.videoId?.trim();
      const applePodcastId = row.applePodcastId?.trim() ?? '';
      const podcastName = row.creator?.name?.trim() ?? '';
      if (!videoId || !applePodcastId || !podcastName) return null;
      return {
        videoId,
        title: row.title ?? '',
        publishedAt: row.publishedAt ?? '',
        applePodcastId,
        podcastName,
      };
    })
    .filter((row): row is FeaturedPodcastPick => row != null)
    .slice(0, 3);
}

export const MASTERCLASS_MAIN_TOPICS = [
  'Putting',
  'Chipping',
  'Bunker',
  'Pitching',
  'Approach Irons',
  'Hybrids & Woods',
  'Drivers',
] as const;

/** London calendar date that maps to Putting (index 0). */
const INSTRUCTIONAL_TOPIC_EPOCH = '2026-09-02';
const INSTRUCTIONAL_DAILY_COUNT = 10;
const INSTRUCTIONAL_CAROUSEL_COUNT = 7;

export type MasterclassMainTopic = (typeof MASTERCLASS_MAIN_TOPICS)[number];

export type ShortGameVideo = {
  id: string;
  youtubeVideoId: string;
  title: string;
  channelName: string;
  displayOrder: number;
  thumbnailUrl?: string;
};

export type MasterclassSubTopic = {
  topic: string;
  videos: ShortGameVideo[];
};

export type MasterclassMainTopicGroup = {
  mainTopic: MasterclassMainTopic;
  subTopics: MasterclassSubTopic[];
};

export type MasterclassContent = {
  mainTopics: MasterclassMainTopicGroup[];
};

const EMPTY_MASTERCLASS_CONTENT: MasterclassContent = {
  mainTopics: [],
};

type ApiMasterclassVideoRow = {
  youtubeVideoId?: string;
  youtube_video_id?: string;
  title?: string;
  channelName?: string;
  channel_name?: string;
  displayOrder?: number;
  display_order?: number;
};

type ApiMasterclassSubTopicRow = {
  topic?: string;
  videos?: ApiMasterclassVideoRow[];
};

type ApiMasterclassMainTopicRow = {
  mainTopic?: string;
  subTopics?: ApiMasterclassSubTopicRow[];
};

function normalizeMasterclassVideo(raw: ApiMasterclassVideoRow): ShortGameVideo | null {
  const youtubeVideoId = raw.youtubeVideoId ?? raw.youtube_video_id ?? '';
  if (!youtubeVideoId) return null;

  return {
    id: youtubeVideoId,
    youtubeVideoId,
    title: raw.title ?? '',
    channelName: raw.channelName ?? raw.channel_name ?? '',
    displayOrder: raw.displayOrder ?? raw.display_order ?? 0,
    thumbnailUrl: `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`,
  };
}

function normalizeMasterclassMainTopic(
  raw: ApiMasterclassMainTopicRow,
): MasterclassMainTopicGroup | null {
  const mainTopic = raw.mainTopic;
  if (!mainTopic || !MASTERCLASS_MAIN_TOPICS.includes(mainTopic as MasterclassMainTopic)) {
    return null;
  }

  const subTopics = (Array.isArray(raw.subTopics) ? raw.subTopics : [])
    .map((subTopicRow) => {
      const topic = subTopicRow.topic?.trim();
      if (!topic) return null;
      const videos = (Array.isArray(subTopicRow.videos) ? subTopicRow.videos : [])
        .map(normalizeMasterclassVideo)
        .filter((video): video is ShortGameVideo => video != null)
        .sort((a, b) => a.displayOrder - b.displayOrder);
      return { topic, videos };
    })
    .filter((subTopic): subTopic is MasterclassSubTopic => subTopic != null);

  return {
    mainTopic: mainTopic as MasterclassMainTopic,
    subTopics,
  };
}

export async function fetchShortGameVideos(): Promise<MasterclassContent> {
  const res = await fetch(`${API_BASE}/short-game-videos`);
  if (!res.ok) throw new Error(`short-game-videos failed (${res.status})`);
  const json = (await res.json()) as { mainTopics?: ApiMasterclassMainTopicRow[] };

  const byMainTopic = new Map<MasterclassMainTopic, MasterclassMainTopicGroup>();
  for (const row of Array.isArray(json.mainTopics) ? json.mainTopics : []) {
    const group = normalizeMasterclassMainTopic(row);
    if (group) byMainTopic.set(group.mainTopic, group);
  }

  return {
    mainTopics: MASTERCLASS_MAIN_TOPICS.map(
      (mainTopic) => byMainTopic.get(mainTopic) ?? { mainTopic, subTopics: [] },
    ),
  };
}

function londonCalendarYmd(now = new Date()): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? '');
  return { year: value('year'), month: value('month'), day: value('day') };
}

function calendarDaysSinceEpoch(now = new Date()): number {
  const today = londonCalendarYmd(now);
  const [epochYear, epochMonth, epochDay] = INSTRUCTIONAL_TOPIC_EPOCH.split('-').map(Number);
  const todayUtcDays = Date.UTC(today.year, today.month - 1, today.day) / 86_400_000;
  const epochUtcDays = Date.UTC(epochYear, epochMonth - 1, epochDay) / 86_400_000;
  return Math.floor(todayUtcDays - epochUtcDays);
}

export function todaysInstructionalTopic(now = new Date()): MasterclassMainTopic {
  const dayIndex = calendarDaysSinceEpoch(now);
  const topicIndex =
    ((dayIndex % MASTERCLASS_MAIN_TOPICS.length) + MASTERCLASS_MAIN_TOPICS.length) %
    MASTERCLASS_MAIN_TOPICS.length;
  return MASTERCLASS_MAIN_TOPICS[topicIndex];
}

function shortGameVideoToItem(video: ShortGameVideo): VideoItem {
  return {
    videoId: video.youtubeVideoId,
    title: video.title,
    publishedAt: '',
    thumbnailUrl: video.thumbnailUrl,
    creator: video.channelName ? { name: video.channelName } : undefined,
  };
}

type InstructionalPick = {
  video: ShortGameVideo;
  subTopic: string;
};

/** Interleaved round-robin across sub-topics, offset by how many times this topic has come around. */
function selectDailyInstructionalVideos(
  group: MasterclassMainTopicGroup,
  dayIndex: number,
  limit = INSTRUCTIONAL_DAILY_COUNT,
): InstructionalPick[] {
  const cycle = Math.floor(Math.max(0, dayIndex) / MASTERCLASS_MAIN_TOPICS.length);
  const queues = group.subTopics
    .map((subTopic) => ({
      topic: subTopic.topic,
      videos: subTopic.videos.filter((video) => video.youtubeVideoId),
    }))
    .filter((queue) => queue.videos.length > 0)
    .map((queue) => ({
      ...queue,
      next: queue.videos.length ? cycle % queue.videos.length : 0,
    }));

  const picked: InstructionalPick[] = [];
  const seen = new Set<string>();

  while (picked.length < limit && queues.length) {
    let progressed = false;
    for (const queue of queues) {
      if (picked.length >= limit) break;
      for (let step = 0; step < queue.videos.length; step += 1) {
        const index = (queue.next + step) % queue.videos.length;
        const video = queue.videos[index];
        if (seen.has(video.youtubeVideoId)) continue;
        seen.add(video.youtubeVideoId);
        queue.next = (index + 1) % queue.videos.length;
        picked.push({ video, subTopic: queue.topic });
        progressed = true;
        break;
      }
    }
    if (!progressed) break;
  }

  return picked;
}

export type DailyInstructionalFeatured = {
  video: VideoItem;
  subTopic: string;
};

export type DailyInstructionalSelection = {
  topic: MasterclassMainTopic;
  carousel: ShortGameVideo[];
  featured: DailyInstructionalFeatured[];
};

export async function fetchDailyInstructionalSelection(): Promise<DailyInstructionalSelection> {
  const content = await fetchShortGameVideos();
  const dayIndex = calendarDaysSinceEpoch();
  const topic = todaysInstructionalTopic();
  const group =
    content.mainTopics.find((row) => row.mainTopic === topic) ?? {
      mainTopic: topic,
      subTopics: [],
    };
  const selected = selectDailyInstructionalVideos(group, dayIndex);
  return {
    topic,
    carousel: selected.slice(0, INSTRUCTIONAL_CAROUSEL_COUNT).map((pick) => pick.video),
    featured: selected.slice(INSTRUCTIONAL_CAROUSEL_COUNT, INSTRUCTIONAL_DAILY_COUNT).map((pick) => ({
      video: shortGameVideoToItem(pick.video),
      subTopic: pick.subTopic,
    })),
  };
}

export { EMPTY_MASTERCLASS_CONTENT };

export type FetchNewsOptions = {
  page?: number;
  pageSize?: number;
  /** When set, asks the backend to return only articles matching tracked creator names. */
  creatorKeyword?: string;
  /** Explicit NewsAPI q string (backend /news?q=). */
  q?: string;
};

export type NewsPageResult = {
  articles: Article[];
  totalResults?: number;
  /** Articles returned by the API before client-side creator filtering. */
  rawCount: number;
};

export async function fetchNewsPage({
  page = 1,
  pageSize = 20,
  creatorKeyword,
  q,
}: FetchNewsOptions = {}): Promise<NewsPageResult> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  if (creatorKeyword) {
    params.set('creatorKeyword', creatorKeyword);
  }
  if (q) {
    params.set('q', q);
  }
  const res = await fetch(`${API_BASE}/news?${params.toString()}`);
  if (!res.ok) throw new Error(`news failed (${res.status})`);
  const json = await res.json();
  const articles: Article[] = Array.isArray(json) ? json : json.articles || [];
  const filtered = creatorKeyword
    ? filterCreatorTaggedNews(articles)
    : articles;
  return { articles: filtered, totalResults: json.totalResults, rawCount: articles.length };
}

const CREATOR_NEWS_SCAN_PAGE_SIZE = 50;
const CREATOR_NEWS_MAX_PAGES = 12;

export type CreatorTaggedNewsOptions = {
  excludeUrls?: ReadonlySet<string>;
  excludeTitleKeys?: ReadonlySet<string>;
};

/** Paginates /news until enough creator-tagged headlines are collected. */
export async function fetchCreatorTaggedNews(
  needed: number,
  options: CreatorTaggedNewsOptions = {},
): Promise<Article[]> {
  const results: Article[] = [];
  const seen = new Set<string>(options.excludeUrls ?? []);
  const excludedTitles = options.excludeTitleKeys ?? new Set<string>();

  for (let page = 1; page <= CREATOR_NEWS_MAX_PAGES && results.length < needed; page++) {
    const { articles, totalResults, rawCount } = await fetchNewsPage({
      page,
      pageSize: CREATOR_NEWS_SCAN_PAGE_SIZE,
      creatorKeyword: 'creator',
    });
    for (const article of articles) {
      if (!article.url || seen.has(article.url)) continue;
      const titleKey = normalizeNewsTitleKey(article.title);
      if (titleKey && excludedTitles.has(titleKey)) continue;
      if (!articleMatchesCreatorNews(article)) continue;
      seen.add(article.url);
      results.push(article);
      if (results.length >= needed) break;
    }
    // Stop only when the API page is empty — not when a page has no creator matches.
    if (rawCount === 0) break;
    if (totalResults != null && page * CREATOR_NEWS_SCAN_PAGE_SIZE >= totalResults) break;
  }

  return results;
}

export type CreatorPageNewsResult = {
  compact: Article[];
  trending: Article[];
  /** URL pinned in compact slot 3 when a Feed column article is available. */
  pinnedFeedUrl: string | null;
};

/** Compact cards + trending for CreatorPage (server pins "The Feed" to slot 3). */
export async function fetchCreatorPageNews(
  compactCount = 3,
  trendingCount = 4,
  options: CreatorTaggedNewsOptions = {},
): Promise<CreatorPageNewsResult> {
  const params = new URLSearchParams({
    compact: String(compactCount),
    trending: String(trendingCount),
  });
  const excludeTitleKeys = options.excludeTitleKeys;
  if (excludeTitleKeys && excludeTitleKeys.size > 0) {
    params.set('excludeTitleKeys', [...excludeTitleKeys].join('|'));
  }

  const res = await fetch(`${API_BASE}/news/creator-page?${params.toString()}`);
  if (!res.ok) throw new Error(`creator-page news failed (${res.status})`);
  const json = await res.json();

  return {
    compact: Array.isArray(json.compact) ? json.compact : [],
    trending: Array.isArray(json.trending) ? json.trending : [],
    pinnedFeedUrl: json.pinnedFeedUrl ?? null,
  };
}

export async function fetchTopShorts(
  limit = 20,
  offset = 0,
  types?: string,
): Promise<VideoItem[]> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (types) params.set('types', types);
  const res = await fetch(`${API_BASE}/top-shorts?${params}`);
  if (!res.ok) throw new Error(`top-shorts failed (${res.status})`);
  return normalizeVideoList(await res.json());
}
