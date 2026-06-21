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

export async function fetchTourLatestVideos(limit = 15): Promise<VideoItem[]> {
  const res = await fetch(`${API_BASE}/tour-latest-videos?limit=${limit}`);
  if (!res.ok) throw new Error(`tour-latest-videos failed (${res.status})`);
  return normalizeVideoList(await res.json());
}
