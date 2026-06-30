import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchHotRightNow,
  formatHotRightNowViewCount,
  formatVelocityPerHour,
  type HotRightNowVideo,
} from '../../api';
import { useOpenArticle } from '../../ArticleReader';

const ACCENT = '#FF6B35';

function formatMetaStat(video: HotRightNowVideo): string {
  if (video.velocityPerHour != null && Number.isFinite(video.velocityPerHour)) {
    return formatVelocityPerHour(video.velocityPerHour);
  }
  return formatHotRightNowViewCount(video.viewCount);
}

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[styles.row, i < 2 ? styles.rowDivider : null, { opacity: 0.5 }]}
        >
          <View style={styles.rowContent}>
            <View style={styles.skeletonLineWide} />
            <View style={styles.skeletonLineMedium} />
            <View style={styles.skeletonLineNarrow} />
          </View>
          <View style={styles.skeletonThumb} />
        </View>
      ))}
    </>
  );
}

export default function HotRightNowCard() {
  const openVideo = useOpenArticle();
  const [videos, setVideos] = useState<HotRightNowVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchHotRightNow()
      .then((data) => {
        if (!cancelled) setVideos(data);
      })
      .catch((err) => {
        console.warn('[HotRightNowCard] fetch failed:', err);
        if (!cancelled) setVideos([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loading && videos.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.accentBar} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <Ionicons name="flame" size={18} color={ACCENT} style={styles.flameIcon} />
            <Text style={styles.title}>Hot Right Now</Text>
          </View>
          <Text style={styles.subtitle}>Trending across creator golf</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>TOP 3</Text>
        </View>
      </View>

      {loading ? (
        <SkeletonRows />
      ) : (
        videos.map((video, index) => (
          <TouchableOpacity
            key={video.videoId}
            style={[styles.row, index < videos.length - 1 ? styles.rowDivider : null]}
            onPress={() => openVideo(video.watchUrl, video.title)}
            activeOpacity={0.8}
          >
            <View style={styles.rowContent}>
              <View style={styles.titleBlock}>
                <Text style={styles.rank}>{index + 1}</Text>
                <Text style={styles.videoTitle} numberOfLines={2}>
                  {video.title}
                </Text>
              </View>
              <Text style={styles.videoSummary} numberOfLines={2}>
                {video.summary}
              </Text>
              <View style={styles.metaRow}>
                <View style={styles.metaLeading}>
                  <Text style={styles.creatorName} numberOfLines={1}>
                    {video.creator.name}
                  </Text>
                  <Text style={styles.metaDot}> · </Text>
                </View>
                <Text style={styles.metaStat}>{formatMetaStat(video)}</Text>
              </View>
            </View>
            <Image
              source={{ uri: video.thumbnailUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          </TouchableOpacity>
        ))
      )}

      <View style={styles.footer}>
        <Text style={styles.footerLeft}>Updated every 6 hours</Text>
        <TouchableOpacity activeOpacity={0.7}>
          <Text style={styles.footerRight}>All trending ›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A2E4A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B5068',
    marginBottom: 12,
    overflow: 'hidden',
  },
  accentBar: {
    height: 3,
    backgroundColor: ACCENT,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerLeft: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flameIcon: {
    marginRight: 6,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12,
    color: '#8A9BB0',
    marginTop: 2,
  },
  badge: {
    backgroundColor: 'rgba(255,107,53,0.2)',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: ACCENT,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    marginBottom: 10,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#3B5068',
    marginBottom: 0,
    paddingBottom: 12,
  },
  rowContent: {
    flex: 1,
    marginRight: 12,
    minWidth: 0,
  },
  titleBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  rank: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: ACCENT,
    lineHeight: 24,
    minWidth: 14,
  },
  videoTitle: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  videoSummary: {
    fontSize: 16,
    color: '#8A9BB0',
    marginTop: 6,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },
  metaLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  creatorName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#4A90D9',
    flexShrink: 1,
  },
  metaDot: {
    color: '#566778',
    fontSize: 13,
  },
  metaStat: {
    fontSize: 13,
    color: '#566778',
    flexShrink: 0,
  },
  thumbnail: {
    width: 112,
    height: 112,
    borderRadius: 8,
    backgroundColor: '#243D5C',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#3B5068',
  },
  footerLeft: {
    fontSize: 11,
    color: '#566778',
  },
  footerRight: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: ACCENT,
  },
  skeletonThumb: {
    width: 112,
    height: 112,
    borderRadius: 8,
    backgroundColor: '#243D5C',
  },
  skeletonLineWide: {
    height: 14,
    backgroundColor: '#243D5C',
    borderRadius: 4,
    width: '92%',
  },
  skeletonLineMedium: {
    height: 14,
    backgroundColor: '#243D5C',
    borderRadius: 4,
    marginTop: 8,
    width: '78%',
  },
  skeletonLineNarrow: {
    height: 12,
    backgroundColor: '#243D5C',
    borderRadius: 4,
    marginTop: 10,
    width: '55%',
  },
});
