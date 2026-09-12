import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  fetchHotRightNow,
  formatHotRightNowViewCount,
  formatVelocityPerHour,
  logImageError,
  subscribeHotRightNow,
  type HotRightNowVideo,
} from '../../api';
import { useOpenArticle } from '../../ArticleReader';
import CreatorAvatar from '../CreatorAvatar';
import { colors } from '../../constants/colors';

const ACCENT = '#FF6B35';
const COLLAPSED_ROW_COUNT = 3;

type HotRightNowCardProps = {
  maxItems?: number;
  expandable?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
};

function formatMetaStat(video: HotRightNowVideo): string {
  if (video.velocityPerHour != null && Number.isFinite(video.velocityPerHour)) {
    return formatVelocityPerHour(video.velocityPerHour);
  }
  return formatHotRightNowViewCount(video.viewCount);
}

function SkeletonCards() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.itemCard, { opacity: 0.5 }]}>
          <View style={styles.skeletonThumb} />
          <View style={styles.skeletonLineWide} />
          <View style={styles.skeletonLineMedium} />
          <View style={styles.skeletonLineNarrow} />
        </View>
      ))}
    </>
  );
}

function VideoFeaturedCard({
  video,
  onPress,
}: {
  video: HotRightNowVideo;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.itemCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.thumbnailWrap}>
        <Image
          source={{ uri: video.thumbnailUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
          onError={logImageError('hot-right-now', video.thumbnailUrl)}
        />
      </View>
      <Text style={styles.videoTitle} numberOfLines={2}>
        {video.title}
      </Text>
      {video.summary ? (
        <Text style={styles.videoSummary} numberOfLines={2}>
          {video.summary}
        </Text>
      ) : null}
      <View style={styles.metaRow}>
        <CreatorAvatar
          name={video.creator.name}
          avatarUrl={video.creator.avatarUrl}
          size={24}
          style={styles.metaAvatar}
        />
        <Text style={styles.creatorName} numberOfLines={1}>
          {video.creator.name}
        </Text>
        <Text style={styles.metaDot}> · </Text>
        <Text style={styles.metaStat}>{formatMetaStat(video)}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HotRightNowCard({
  maxItems = 10,
  expandable = true,
  showHeader = true,
  showFooter = true,
}: HotRightNowCardProps) {
  const openVideo = useOpenArticle();
  const [videos, setVideos] = useState<HotRightNowVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    return subscribeHotRightNow((data) => {
      setVideos(data);
      setLoading(false);
    });
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      fetchHotRightNow()
        .then((data) => {
          if (!cancelled) setVideos(data);
        })
        .catch((err) => {
          console.warn('[HotRightNowCard] fetch failed:', err);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (!loading && videos.length === 0) return null;

  const capped = videos.slice(0, maxItems);
  const canExpand = expandable && capped.length > COLLAPSED_ROW_COUNT;
  const visibleVideos = expanded || !expandable ? capped : capped.slice(0, COLLAPSED_ROW_COUNT);

  return (
    <View style={styles.section}>
      {showHeader ? (
        <View style={styles.headerCard}>
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
        </View>
      ) : null}

      {loading ? (
        <SkeletonCards />
      ) : (
        visibleVideos.map((video) => (
          <VideoFeaturedCard
            key={video.videoId}
            video={video}
            onPress={() => openVideo(video.watchUrl, video.title)}
          />
        ))
      )}

      {showFooter ? (
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
            <Text style={styles.footerRight}>{expanded ? 'Show less' : 'All trending ›'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 13,
  },
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: 15,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 10,
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
    paddingBottom: 12,
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
  itemCard: {
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  thumbnailWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.midNavy,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  videoTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
    lineHeight: 24,
    color: colors.navy,
    marginTop: 8,
  },
  videoSummary: {
    fontSize: 16,
    lineHeight: 22,
    color: colors.mutedGrey,
    marginTop: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metaAvatar: {
    marginRight: 8,
    flexShrink: 0,
  },
  creatorName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: colors.liveBlue,
    flexShrink: 1,
  },
  metaDot: {
    color: colors.coolGrey,
    fontSize: 15,
  },
  metaStat: {
    fontSize: 15,
    color: colors.coolGrey,
    flexShrink: 0,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 10,
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
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  skeletonLineWide: {
    height: 16,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginTop: 8,
    width: '92%',
  },
  skeletonLineMedium: {
    height: 14,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginTop: 6,
    width: '78%',
  },
  skeletonLineNarrow: {
    height: 12,
    backgroundColor: colors.border,
    borderRadius: 4,
    marginTop: 6,
    width: '55%',
  },
});
