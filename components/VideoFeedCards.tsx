import React from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  VideoItem,
  logImageError,
  openYouTubeShort,
  openYouTubeVideo,
  videoThumbnailUri,
} from '../api';
import { colors } from '../constants/colors';

export function formatVideoTimeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / (1000 * 60 * 60));
  if (hrs < 1) return 'just now';
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function FeaturedVideoCard({ video, tag }: { video: VideoItem; tag?: string }) {
  const thumb = videoThumbnailUri(video);
  return (
    <TouchableOpacity
      style={styles.featuredVideoCard}
      activeOpacity={0.8}
      onPress={() => openYouTubeVideo(video.videoId)}
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
          {video.title}
        </Text>
        <Text style={styles.cardMeta}>
          {video.creator?.name || 'Creator'} · {formatVideoTimeAgo(video.publishedAt)}
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
  tag: string;
  title: string;
}) {
  if (!shorts.length) return null;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.tagLabel}>{tag}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
        {shorts.map((s) => {
          const thumb = videoThumbnailUri(s);
          return (
            <TouchableOpacity
              key={s.videoId}
              style={styles.shortCard}
              activeOpacity={0.8}
              onPress={() => openYouTubeShort(s.videoId)}
            >
              <Image
                source={{ uri: thumb }}
                style={styles.shortThumb}
                onError={logImageError('short-carousel', thumb)}
              />
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
  tag: string;
  title: string;
  subtitle: string;
}) {
  if (!videos.length) return null;
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.scaledTagLabel}>{tag}</Text>
      <Text style={styles.sectionTitleScaled}>{title}</Text>
      <Text style={styles.sectionSubtitleScaled}>{subtitle}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 5 }}>
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
                {v.creator?.name || 'Creator'} · {formatVideoTimeAgo(v.publishedAt)}
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
  shortCard: { width: 180, marginRight: 8 },
  shortThumb: { width: 180, height: 320, borderRadius: 10, backgroundColor: colors.midNavy },
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
