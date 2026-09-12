import React, { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  VideoItem,
  logImageError,
  openYouTubeShort,
  openYouTubeVideo,
  videoThumbnailUri,
} from '../api';
import { colors } from '../constants/colors';
import { youtubeOar2Uri } from '../constants/creators';
import ProfileYoutubeThumb from './ProfileYoutubeThumb';

export function formatVideoTimeAgo(iso: string) {
  if (!iso) return '';
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return '';
  const diff = Date.now() - at;
  const hrs = Math.floor(diff / (1000 * 60 * 60));
  if (hrs < 1) return 'just now';
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function FeaturedVideoCard({
  video,
  tag,
  subTopic,
  videoTitle,
  summary,
  youtubeVideoId,
  creatorName,
  creatorAvatarUrl,
  publishedAt,
  viewCount,
}: {
  video?: VideoItem;
  tag?: string;
  subTopic?: string;
  videoTitle?: string;
  summary?: string;
  youtubeVideoId?: string;
  creatorName?: string;
  creatorHandle?: string;
  creatorAvatarUrl?: string;
  publishedAt?: string;
  viewCount?: number;
}) {
  const resolved: VideoItem = video ?? {
    videoId: youtubeVideoId ?? '',
    title: videoTitle ?? '',
    summary,
    publishedAt: publishedAt ?? '',
    viewCount,
    creator: creatorName
      ? { name: creatorName, avatarUrl: creatorAvatarUrl }
      : undefined,
  };
  if (!resolved.videoId) return null;
  const thumb = videoThumbnailUri(resolved);
  const hasPublishedAt = Boolean(String(resolved.publishedAt ?? '').trim());
  const metaDetail = hasPublishedAt
    ? formatVideoTimeAgo(resolved.publishedAt)
    : (subTopic ?? '').trim();
  return (
    <TouchableOpacity
      style={styles.featuredVideoCard}
      activeOpacity={0.8}
      onPress={() => openYouTubeVideo(resolved.videoId)}
    >
      <View>
        <Image
          source={{ uri: thumb }}
          style={styles.featuredVideoThumb}
          resizeMode="cover"
          onError={logImageError('featured-video', thumb)}
        />
        <View style={styles.playButtonOverlay}>
          <Ionicons name="play" size={16} color="#FFFFFF" />
        </View>
      </View>
      <View style={{ padding: 12 }}>
        {tag ? <Text style={styles.tagLabel}>{tag}</Text> : null}
        <Text style={styles.cardTitleLarge} numberOfLines={2}>
          {resolved.title}
        </Text>
        <Text style={styles.cardMeta}>
          {resolved.creator?.name || 'Creator'} · {metaDetail}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function ShortsCarousel({
  shorts,
  tag,
  title,
}: {
  shorts: VideoItem[];
  tag?: string;
  title?: string;
}) {
  if (!shorts.length) return null;
  const showHeader = Boolean(tag || title);
  return (
    <View style={{ marginBottom: showHeader ? 14 : 0 }}>
      {tag ? <Text style={styles.tagLabel}>{tag}</Text> : null}
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: showHeader ? 4 : 0 }}
      >
        {shorts.map((s) => {
          const thumb = videoThumbnailUri(s);
          const fadeId = `shortCaptionFade-${s.videoId}`;
          return (
            <TouchableOpacity
              key={s.videoId}
              style={styles.shortCard}
              activeOpacity={0.8}
              onPress={() =>
                s.isShort === false
                  ? openYouTubeVideo(s.videoId)
                  : openYouTubeShort(s.videoId)
              }
            >
              <Image
                source={{ uri: thumb }}
                style={styles.shortThumb}
                resizeMode="cover"
                onError={logImageError('short-carousel', thumb)}
              />
              <Svg
                width={180}
                height={320}
                style={styles.shortGradient}
                pointerEvents="none"
              >
                <Defs>
                  <LinearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0.45" stopColor="#000000" stopOpacity="0" />
                    <Stop offset="1" stopColor="#000000" stopOpacity="0.72" />
                  </LinearGradient>
                </Defs>
                <Rect width="180" height="320" fill={`url(#${fadeId})`} />
              </Svg>
              <View style={styles.shortCaptionWrap}>
                <Text style={styles.shortCaption} numberOfLines={2}>
                  {s.title}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function FullBleedShort({ short, tag }: { short: VideoItem; tag: string }) {
  const thumb = videoThumbnailUri(short);
  return (
    <TouchableOpacity
      style={styles.fullBleedWrap}
      activeOpacity={0.85}
      onPress={() => openYouTubeShort(short.videoId)}
    >
      <Image
        source={{ uri: thumb }}
        style={styles.fullBleedImage}
        resizeMode="cover"
        onError={logImageError('full-bleed-short', thumb)}
      />
      <View style={styles.fullBleedTagWrap}>
        <Text style={styles.fullBleedTag}>{tag}</Text>
      </View>
      <View style={styles.fullBleedPlay}>
        <Ionicons name="play" size={20} color="#FFFFFF" />
      </View>
      <View style={styles.fullBleedCaptionWrap}>
        <Text style={styles.fullBleedCaption} numberOfLines={2}>
          {short.title}
        </Text>
        <Text style={styles.fullBleedMeta}>
          {short.creator?.name || 'Creator'} · {formatVideoTimeAgo(short.publishedAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export function VideoCarousel({
  videos,
  tag,
  title,
  subtitle,
}: {
  videos: VideoItem[];
  tag?: string;
  title?: string;
  subtitle?: string;
}) {
  if (!videos.length) return null;
  const showHeader = Boolean(tag || title || subtitle);
  return (
    <View style={{ marginBottom: showHeader ? 18 : 0 }}>
      {tag ? <Text style={styles.scaledTagLabel}>{tag}</Text> : null}
      {title ? <Text style={styles.sectionTitleScaled}>{title}</Text> : null}
      {subtitle ? <Text style={styles.sectionSubtitleScaled}>{subtitle}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: showHeader ? 5 : 0 }}>
        {videos.map((v) => {
          const thumb = videoThumbnailUri(v);
          return (
            <TouchableOpacity
              key={v.videoId}
              style={styles.carouselCard}
              activeOpacity={0.8}
              onPress={() => openYouTubeVideo(v.videoId)}
            >
              <Image
                source={{ uri: thumb }}
                style={styles.carouselThumb}
                onError={logImageError('video-carousel', thumb)}
              />
              <Text style={styles.carouselTitle} numberOfLines={2}>
                {v.title}
              </Text>
              <Text style={styles.carouselMeta}>
                {[v.creator?.name || 'Creator', formatVideoTimeAgo(v.publishedAt)]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tagLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.coolGrey,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  scaledTagLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.coolGrey,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardTitleLarge: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.navy,
    lineHeight: 19,
    marginBottom: 4,
  },
  cardMeta: { fontSize: 11, color: colors.coolGrey, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.navy, marginTop: 6, marginBottom: 2 },
  sectionTitleScaled: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.navy,
    marginTop: 8,
    marginBottom: 3,
  },
  sectionSubtitleScaled: { fontSize: 15, color: colors.coolGrey, marginBottom: 5 },
  featuredVideoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 14,
  },
  featuredVideoThumb: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.midNavy },
  playButtonOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -18,
    marginLeft: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortCard: { width: 180, height: 320, marginRight: 8, borderRadius: 10, overflow: 'hidden' },
  shortThumb: { width: 180, height: 320, backgroundColor: colors.midNavy },
  shortGradient: { position: 'absolute', top: 0, left: 0 },
  shortCaptionWrap: { position: 'absolute', bottom: 8, left: 8, right: 8 },
  shortCaption: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', lineHeight: 14 },
  fullBleedWrap: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.midNavy,
    marginBottom: 14,
  },
  fullBleedImage: { width: '100%', height: '100%' },
  fullBleedTagWrap: { position: 'absolute', top: 10, left: 10 },
  fullBleedTag: {
    fontSize: 9,
    fontWeight: '600',
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fullBleedPlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -22,
    marginLeft: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullBleedCaptionWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 14 },
  fullBleedCaption: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', lineHeight: 19 },
  fullBleedMeta: { color: '#D8DEE6', fontSize: 11, marginTop: 4 },
  carouselCard: { width: 240, marginRight: 15 },
  carouselThumb: { width: 240, height: 135, borderRadius: 15, backgroundColor: colors.midNavy },
  carouselTitle: { fontSize: 17, fontWeight: '600', color: colors.navy, marginTop: 10, lineHeight: 23 },
  carouselMeta: { fontSize: 15, color: colors.coolGrey, marginTop: 4 },
});

const PODCAST_MIXED_HEIGHT = 240;
const PODCAST_SHORT_WIDTH = Math.round((PODCAST_MIXED_HEIGHT * 9) / 16);
const PODCAST_VIDEO_WIDTH = Math.round((PODCAST_MIXED_HEIGHT * 16) / 9);

const oar2PortraitCache = new Map<string, boolean>();

/** True when YouTube has a vertical oar2 still (real Short). False = landscape episode art. */
function useOar2IsPortrait(videoId: string): boolean | null {
  const [portrait, setPortrait] = useState<boolean | null>(() =>
    oar2PortraitCache.has(videoId) ? oar2PortraitCache.get(videoId)! : null,
  );

  useEffect(() => {
    if (oar2PortraitCache.has(videoId)) {
      setPortrait(oar2PortraitCache.get(videoId)!);
      return;
    }
    let cancelled = false;
    Image.getSize(
      youtubeOar2Uri(videoId),
      (width, height) => {
        const isPortrait = height > width && width >= 200 && height >= 200;
        oar2PortraitCache.set(videoId, isPortrait);
        if (!cancelled) setPortrait(isPortrait);
      },
      () => {
        oar2PortraitCache.set(videoId, false);
        if (!cancelled) setPortrait(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  return portrait;
}

function PodcastMixedItem({ item }: { item: VideoItem }) {
  const portrait = useOar2IsPortrait(item.videoId);
  const isShortCard = portrait === true || (portrait === null && item.isShort === true);

  if (isShortCard) {
    return (
      <TouchableOpacity
        style={mixedStyles.shortCard}
        activeOpacity={0.8}
        onPress={() => openYouTubeShort(item.videoId)}
      >
        <View style={mixedStyles.shortThumbBox}>
          <ProfileYoutubeThumb
            videoId={item.videoId}
            imageUrl={youtubeOar2Uri(item.videoId)}
            width={PODCAST_SHORT_WIDTH}
            height={PODCAST_MIXED_HEIGHT}
            borderRadius={8}
          />
        </View>
      </TouchableOpacity>
    );
  }

  const thumb = videoThumbnailUri(item);
  return (
    <TouchableOpacity
      style={mixedStyles.videoCard}
      activeOpacity={0.8}
      onPress={() => openYouTubeVideo(item.videoId)}
    >
      <Image
        source={{ uri: thumb }}
        style={mixedStyles.videoThumb}
        resizeMode="cover"
        onError={logImageError('podcast-mixed-video', thumb)}
      />
    </TouchableOpacity>
  );
}

export function PodcastMixedCarousel({ videos }: { videos: VideoItem[] }) {
  if (!videos.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {videos.map((item) => (
        <PodcastMixedItem key={item.videoId} item={item} />
      ))}
    </ScrollView>
  );
}

const mixedStyles = StyleSheet.create({
  shortCard: { width: PODCAST_SHORT_WIDTH, height: PODCAST_MIXED_HEIGHT, marginRight: 8 },
  shortThumbBox: {
    width: PODCAST_SHORT_WIDTH,
    height: PODCAST_MIXED_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
  },
  videoCard: {
    width: PODCAST_VIDEO_WIDTH,
    height: PODCAST_MIXED_HEIGHT,
    marginRight: 8,
    overflow: 'hidden',
  },
  videoThumb: {
    width: PODCAST_VIDEO_WIDTH,
    height: PODCAST_MIXED_HEIGHT,
    borderRadius: 15,
    backgroundColor: colors.midNavy,
  },
});
