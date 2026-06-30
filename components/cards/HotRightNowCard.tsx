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
import CreatorAvatar from '../CreatorAvatar';
import { colors } from '../../constants/colors';

const ACCENT = '#FF6B35';
const ROW_DIVIDER = '#E5E9EE';
const COLLAPSED_ROW_COUNT = 3;
const ROW_GAP = 34;

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
  const [expanded, setExpanded] = useState(false);

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

  const canExpand = videos.length > COLLAPSED_ROW_COUNT;
  const visibleVideos = expanded ? videos : videos.slice(0, COLLAPSED_ROW_COUNT);

  return (
    <View style={styles.card}>
      <View style={styles.accentBar} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <Ionicons name="flame" size={20} color={ACCENT} style={styles.flameIcon} />
            <Text style={styles.title}>Hot Right Now</Text>
          </View>
          <Text style={styles.subtitle}>Trending across creator golf</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>TOP 10</Text>
        </View>
      </View>

      <View style={styles.rowsSection}>
        {loading ? (
          <SkeletonRows />
        ) : (
          visibleVideos.map((video, index) => (
            <TouchableOpacity
              key={video.videoId}
              style={[
                styles.row,
                index < visibleVideos.length - 1 ? styles.rowDivider : null,
              ]}
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
                    <CreatorAvatar
                      name={video.creator.name}
                      avatarUrl={video.creator.avatarUrl}
                      size={28}
                      style={styles.metaAvatar}
                    />
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
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerLeft}>Updated every 6 hours</Text>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            if (expanded) {
              setExpanded(false);
            } else if (canExpand) {
              setExpanded(true);
            }
          }}
        >
          <Text style={styles.footerRight}>
            {expanded ? 'Show less' : 'All trending ›'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 15,
    borderWidth: 0.5,
    borderColor: colors.border,
    marginBottom: 13,
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
    paddingHorizontal: 15,
    paddingTop: 12,
    paddingBottom: 0,
  },
  rowsSection: {
    marginTop: ROW_GAP,
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
    fontSize: 20,
    fontWeight: '700',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 15,
    color: colors.coolGrey,
    marginTop: 3,
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
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginBottom: ROW_GAP,
  },
  rowDivider: {
    borderBottomWidth: 2,
    borderBottomColor: ROW_DIVIDER,
  },
  rowContent: {
    flex: 1,
    marginRight: 14,
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
    lineHeight: 23,
    minWidth: 14,
  },
  videoTitle: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    color: colors.navy,
    lineHeight: 23,
  },
  videoSummary: {
    fontSize: 15,
    color: colors.coolGrey,
    marginTop: 8,
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 4,
  },
  metaLeading: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  metaAvatar: {
    marginRight: 8,
    flexShrink: 0,
  },
  creatorName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: colors.liveBlue,
    flexShrink: 1,
  },
  metaDot: {
    color: colors.coolGrey,
    fontSize: 13,
  },
  metaStat: {
    fontSize: 13,
    color: colors.coolGrey,
    flexShrink: 0,
  },
  thumbnail: {
    width: 88,
    height: 88,
    borderRadius: 6,
    backgroundColor: colors.midNavy,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: ROW_DIVIDER,
  },
  footerLeft: {
    fontSize: 11,
    color: colors.coolGrey,
  },
  footerRight: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: ACCENT,
  },
  skeletonThumb: {
    width: 88,
    height: 88,
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  skeletonLineWide: {
    height: 14,
    backgroundColor: colors.border,
    borderRadius: 4,
    width: '92%',
  },
  skeletonLineMedium: {
    height: 14,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginTop: 8,
    width: '78%',
  },
  skeletonLineNarrow: {
    height: 12,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginTop: 10,
    width: '55%',
  },
});
