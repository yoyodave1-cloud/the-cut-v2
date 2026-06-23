import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import CreatorAvatar from './CreatorAvatar';
import {
  FeaturedVideoCard,
  FullBleedShort,
  ShortsCarousel,
  VideoCarousel,
} from './VideoFeedCards';
import {
  fetchRankedInsertMedia,
  fetchTop100Creators,
  formatSubscriberCount,
  type RankedInsertSpec,
  type TopCreator,
  type VideoItem,
} from '../api';
import { getCreatorBySupabaseId } from '../constants/creators';
import { colors } from '../constants/colors';
import type { CreatorsStackParamList } from '../navigation/creatorsStackTypes';

const FEATURED_TAG = 'Creator golf';
const MAX_FEATURED_INSERTS = 10;

type FeaturedCardType =
  | 'featured-video'
  | 'shorts-carousel'
  | 'video-carousel'
  | 'full-bleed-short';

const FEATURED_CYCLE: FeaturedCardType[] = [
  'featured-video',
  'shorts-carousel',
  'video-carousel',
  'full-bleed-short',
];

const RANKED_INSERT_SPECS: RankedInsertSpec[] = [
  { insertIndex: 1, startRank: 2, endRank: 10, media: 'shorts' },
  { insertIndex: 2, startRank: 11, endRank: 15, media: 'videos' },
  { insertIndex: 3, startRank: 16, endRank: 16, media: 'shorts' },
  { insertIndex: 4, startRank: 17, endRank: 17, media: 'videos' },
  { insertIndex: 5, startRank: 18, endRank: 26, media: 'shorts' },
  { insertIndex: 6, startRank: 27, endRank: 36, media: 'videos' },
  { insertIndex: 7, startRank: 37, endRank: 37, media: 'shorts' },
  { insertIndex: 8, startRank: 38, endRank: 38, media: 'videos' },
  { insertIndex: 9, startRank: 39, endRank: 50, media: 'shorts' },
];

type ListItem =
  | { kind: 'creator'; creator: TopCreator; rank: number }
  | { kind: 'featured'; cardType: FeaturedCardType; insertIndex: number };

function resolveCreatorSlug(creator: TopCreator): string {
  const known = getCreatorBySupabaseId(creator.id);
  return known?.id ?? creator.id;
}

function buildTop50ListItems(creators: TopCreator[]): ListItem[] {
  const items: ListItem[] = [];
  let insertIndex = 0;

  for (let i = 0; i < creators.length; i++) {
    items.push({ kind: 'creator', creator: creators[i]!, rank: i + 1 });
    const rank = i + 1;
    if (rank % 5 === 0 && insertIndex < MAX_FEATURED_INSERTS) {
      items.push({
        kind: 'featured',
        cardType: FEATURED_CYCLE[insertIndex % FEATURED_CYCLE.length]!,
        insertIndex,
      });
      insertIndex += 1;
    }
  }

  return items;
}

function findRankedInsertSpec(insertIndex: number): RankedInsertSpec | undefined {
  return RANKED_INSERT_SPECS.find((spec) => spec.insertIndex === insertIndex);
}

function formatRankRangeTitle(
  kind: 'shorts' | 'videos',
  startRank: number,
  endRank: number,
): string {
  const label = kind === 'shorts' ? 'shorts' : 'videos';
  if (startRank === endRank) {
    return `Latest ${label} · rank ${startRank}`;
  }
  return `Latest ${label} · ranks ${startRank}–${endRank}`;
}

function rankedItemsForInsert(
  rankedMedia: Record<number, VideoItem[]>,
  insertIndex: number,
): VideoItem[] {
  return rankedMedia[insertIndex] ?? [];
}

function rankedSingleForInsert(
  rankedMedia: Record<number, VideoItem[]>,
  insertIndex: number,
): VideoItem | null {
  return rankedItemsForInsert(rankedMedia, insertIndex)[0] ?? null;
}

function FeaturedInsert({
  cardType,
  insertIndex,
  top1LatestVideo,
  rankedMedia,
}: {
  cardType: FeaturedCardType;
  insertIndex: number;
  top1LatestVideo: VideoItem | null;
  rankedMedia: Record<number, VideoItem[]>;
}) {
  const spec = findRankedInsertSpec(insertIndex);

  switch (cardType) {
    case 'featured-video': {
      const video =
        insertIndex === 0 ? top1LatestVideo : rankedSingleForInsert(rankedMedia, insertIndex);
      if (!video) return null;
      return <FeaturedVideoCard video={video} tag={FEATURED_TAG} />;
    }
    case 'shorts-carousel': {
      const shorts = rankedItemsForInsert(rankedMedia, insertIndex);
      if (!shorts.length) return null;
      return (
        <ShortsCarousel
          shorts={shorts}
          tag={FEATURED_TAG}
          title={
            spec
              ? formatRankRangeTitle('shorts', spec.startRank, spec.endRank)
              : 'Latest shorts'
          }
        />
      );
    }
    case 'video-carousel': {
      const videos = rankedItemsForInsert(rankedMedia, insertIndex);
      if (!videos.length) return null;
      return (
        <VideoCarousel
          videos={videos}
          tag={FEATURED_TAG}
          title={
            spec
              ? formatRankRangeTitle('videos', spec.startRank, spec.endRank)
              : 'Latest videos'
          }
          subtitle="Most recent long-form from each creator"
        />
      );
    }
    case 'full-bleed-short': {
      const short = rankedSingleForInsert(rankedMedia, insertIndex);
      if (!short) return null;
      return <FullBleedShort short={short} tag={FEATURED_TAG} />;
    }
    default:
      return null;
  }
}

function CaughtUpFooter() {
  return (
    <View style={styles.caughtUpCard}>
      <Ionicons name="checkmark-circle-outline" size={28} color={colors.birdieGreen} />
      <Text style={styles.caughtUpTitle}>You're all caught up</Text>
      <Text style={styles.caughtUpSubtitle}>
        You've seen the full creator leaderboard for now. Check back later as subscriber counts
        update.
      </Text>
    </View>
  );
}

export default function TopCreatorsList() {
  const navigation = useNavigation<NativeStackNavigationProp<CreatorsStackParamList>>();
  const [top50, setTop50] = useState<TopCreator[]>([]);
  const [honorableMentions, setHonorableMentions] = useState<TopCreator[]>([]);
  const [top1LatestVideo, setTop1LatestVideo] = useState<VideoItem | null>(null);
  const [rankedMedia, setRankedMedia] = useState<Record<number, VideoItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const leaderboard = await fetchTop100Creators();
        const media = await fetchRankedInsertMedia(leaderboard.top50, RANKED_INSERT_SPECS);
        if (!cancelled) {
          setTop50(leaderboard.top50);
          setHonorableMentions(leaderboard.honorableMentions);
          setTop1LatestVideo(leaderboard.top1LatestVideo);
          setRankedMedia(media);
          setError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load creators');
          setTop50([]);
          setHonorableMentions([]);
          setTop1LatestVideo(null);
          setRankedMedia({});
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const top50Items = useMemo(() => buildTop50ListItems(top50), [top50]);
  const totalCreators = top50.length + honorableMentions.length;

  const openCreator = useCallback(
    (creator: TopCreator) => {
      const slug = resolveCreatorSlug(creator);
      navigation.navigate('CreatorProfilePage', {
        creatorId: slug,
        creatorName: creator.name,
        supabaseId: creator.id,
        handle: creator.handle,
        avatarUrl: creator.avatarUrl,
      });
    },
    [navigation],
  );

  if (loading) {
    return (
      <View style={styles.stateWrap}>
        <ActivityIndicator size="small" color={colors.liveBlue} />
        <Text style={styles.stateText}>Loading top creators…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.stateWrap}>
        <Text style={styles.errorText}>Couldn't load top creators: {error}</Text>
      </View>
    );
  }

  if (!totalCreators) {
    return (
      <View style={styles.stateWrap}>
        <Text style={styles.stateText}>No creator rankings available yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <Text style={styles.sectionTitle}>Top 50</Text>
      <Text style={styles.sectionSubtitle}>
        Ranked by YouTube subscribers · {totalCreators} verified creators
      </Text>
      {top50Items.map((item) => {
        if (item.kind === 'creator') {
          return (
            <TopCreatorRow
              key={`top50-${item.creator.id}`}
              creator={item.creator}
              rank={item.rank}
              onPress={() => openCreator(item.creator)}
            />
          );
        }
        return (
          <View key={`featured-${item.insertIndex}-${item.cardType}`} style={styles.featuredWrap}>
            <FeaturedInsert
              cardType={item.cardType}
              insertIndex={item.insertIndex}
              top1LatestVideo={top1LatestVideo}
              rankedMedia={rankedMedia}
            />
          </View>
        );
      })}

      {honorableMentions.length > 0 ? (
        <View style={styles.honorableSection}>
          <Text style={styles.honorableTitle}>Knocking on the Door of the Top 50</Text>
          {honorableMentions.map((creator) => (
            <TopCreatorRow
              key={`honorable-${creator.id}`}
              creator={creator}
              onPress={() => openCreator(creator)}
            />
          ))}
        </View>
      ) : null}

      <CaughtUpFooter />
    </View>
  );
}

function TopCreatorRow({
  creator,
  rank,
  onPress,
}: {
  creator: TopCreator;
  rank?: number;
  onPress: () => void;
}) {
  const isTopThree = rank != null && rank <= 3;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, isTopThree ? styles.rowTopThree : null]}
    >
      {rank != null ? (
        <Text style={[styles.rank, isTopThree ? styles.rankTopThree : null]}>#{rank}</Text>
      ) : (
        <View style={styles.rankSpacer} />
      )}
      <CreatorAvatar name={creator.name} avatarUrl={creator.avatarUrl} size={40} textSize={14} />
      <Text
        style={[styles.name, isTopThree ? styles.nameTopThree : null]}
        numberOfLines={1}
      >
        {creator.name}
      </Text>
      <Text style={[styles.subs, isTopThree ? styles.subsTopThree : null]}>
        {formatSubscriberCount(creator.subscriberCount)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.coolGrey,
    marginBottom: 14,
  },
  honorableSection: {
    marginTop: 20,
  },
  honorableTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.navy,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  rowTopThree: {
    backgroundColor: '#E8F2FC',
    borderColor: colors.liveBlue,
  },
  rank: {
    width: 36,
    fontSize: 15,
    fontWeight: '600',
    color: colors.coolGrey,
  },
  rankSpacer: {
    width: 4,
  },
  rankTopThree: {
    color: colors.navy,
    fontWeight: '700',
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: colors.navy,
  },
  nameTopThree: {
    fontWeight: '700',
  },
  subs: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.coolGrey,
    minWidth: 56,
    textAlign: 'right',
  },
  subsTopThree: {
    color: colors.navy,
    fontWeight: '600',
  },
  featuredWrap: {
    marginBottom: 8,
  },
  caughtUpCard: {
    backgroundColor: colors.card,
    borderRadius: 15,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  caughtUpTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.navy,
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  caughtUpSubtitle: {
    fontSize: 14,
    color: colors.coolGrey,
    lineHeight: 20,
    textAlign: 'center',
  },
  stateWrap: {
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  stateText: {
    fontSize: 14,
    color: colors.coolGrey,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    color: colors.bogeyRed,
    textAlign: 'center',
  },
});
