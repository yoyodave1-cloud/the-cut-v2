import { Linking } from 'react-native';

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
  return {
    videoId: row.videoId,
    title: row.title,
    summary: row.summary,
    publishedAt: row.publishedAt,
    thumbnailUrl: row.thumbnailUrl,
    creator: creator
      ? { name: creator.name, avatarUrl: creator.avatarUrl }
      : undefined,
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
  const res = await fetch(`${API_BASE}/top-videos?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(`top-videos failed (${res.status})`);
  return normalizeVideoList(await res.json());
}

export async function fetchTopShorts(limit = 20, offset = 0): Promise<VideoItem[]> {
  const res = await fetch(`${API_BASE}/top-shorts?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(`top-shorts failed (${res.status})`);
  return normalizeVideoList(await res.json());
}
