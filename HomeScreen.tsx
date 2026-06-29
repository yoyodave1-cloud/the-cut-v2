import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  FlatList,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  type ListRenderItem,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import HomeHeader from './components/HomeHeader';
import { NewsCardCompact, TrendingList } from './components/FeedNewsCards';
import {
  Article,
  TOUR_LATEST_HEADER_LIMIT,
  VideoItem,
  fetchTourLatestVideos,
} from './api';
import {
  FeaturedVideoCard,
  FullBleedShort,
  ShortsCarousel,
  VideoCarousel,
} from './components/VideoFeedCards';
import UpcomingEventTile from './components/UpcomingEventTile';
import { ArticleReaderProvider, useOpenArticle } from './ArticleReader';
import { FeedBlock, FeedSession } from './feed';
import { colors } from './constants/colors';
import {
  EVENT_TILE_STRIDE,
  type UpcomingTourEvent,
  getMergedUpcomingTourEvents,
  resolveEventLeaderboardUrl,
  upcomingEventScrollTargetIndex,
} from './lib/upcomingTourEvents';

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / (1000 * 60 * 60));
  if (hrs < 1) return 'just now';
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function FeaturedNewsCard({ article, tag }: { article: Article; tag?: string }) {
  const openArticle = useOpenArticle();
  return (
    <TouchableOpacity
      style={styles.featuredNewsCard}
      activeOpacity={0.8}
      onPress={() => openArticle(article.url, article.title)}
    >
      {article.urlToImage ? (
        <Image
          source={{ uri: article.urlToImage }}
          style={styles.featuredImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.featuredImage, { backgroundColor: colors.midNavy }]} />
      )}
      <View style={{ padding: 12 }}>
        {tag ? <Text style={styles.tagLabel}>{tag}</Text> : null}
        <Text style={styles.featuredTitle}>{article.title}</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <Text style={styles.cardMeta}>
            {article.source?.name} · {timeAgo(article.publishedAt)}
          </Text>
          <Ionicons name="share-outline" size={16} color={colors.coolGrey} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function CaughtUpCard() {
  return (
    <View style={styles.caughtUpCard}>
      <Ionicons name="checkmark-circle-outline" size={28} color={colors.birdieGreen} />
      <Text style={styles.caughtUpTitle}>You're all caught up</Text>
      <Text style={styles.caughtUpSubtitle}>
        You've seen everything fresh across news, tour media, and creator golf for now. Check back
        later for new stories and videos.
      </Text>
    </View>
  );
}

function FeedBlockItem({ block }: { block: FeedBlock }) {
  switch (block.type) {
    case 'news-compact':
      return <NewsCardCompact article={block.article} tag={block.tag} />;
    case 'news-featured':
      return <FeaturedNewsCard article={block.article} tag={block.tag} />;
    case 'news-trending':
      return <TrendingList articles={block.articles} />;
    case 'featured-video':
      return <FeaturedVideoCard video={block.video} tag={block.tag} />;
    case 'shorts-carousel':
      return <ShortsCarousel shorts={block.shorts} tag={block.tag} title={block.title} />;
    case 'full-bleed-short':
      return <FullBleedShort short={block.short} tag={block.tag} />;
    case 'video-carousel':
      return (
        <VideoCarousel
          videos={block.videos}
          tag={block.tag}
          title={block.title}
          subtitle={block.subtitle}
        />
      );
    case 'caught-up':
      return <CaughtUpCard />;
    default:
      return null;
  }
}

function UpcomingEventsStrip() {
  const openArticle = useOpenArticle();
  const events = useMemo(() => getMergedUpcomingTourEvents(), []);
  const listRef = useRef<FlatList<UpcomingTourEvent>>(null);

  const getItemLayout = useCallback(
    (_: ArrayLike<UpcomingTourEvent> | null | undefined, index: number) => ({
      length: EVENT_TILE_STRIDE,
      offset: EVENT_TILE_STRIDE * index,
      index,
    }),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      if (events.length === 0) return;
      const target = upcomingEventScrollTargetIndex(events, new Date());
      const id = requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({
          index: target,
          viewPosition: 0,
          animated: false,
        });
      });
      return () => cancelAnimationFrame(id);
    }, [events]),
  );

  const renderEvent: ListRenderItem<UpcomingTourEvent> = useCallback(
    ({ item }) => (
      <UpcomingEventTile
        item={item}
        onPress={() => openArticle(resolveEventLeaderboardUrl(item), item.fullName)}
      />
    ),
    [openArticle],
  );

  if (events.length === 0) return null;

  return (
    <FlatList
      ref={listRef}
      horizontal
      data={events}
      keyExtractor={(item) => item.id}
      renderItem={renderEvent}
      showsHorizontalScrollIndicator={false}
      removeClippedSubviews
      style={styles.eventsRow}
      contentContainerStyle={styles.eventsRowContent}
      getItemLayout={getItemLayout}
      onScrollToIndexFailed={(info) => {
        listRef.current?.scrollToOffset({
          offset: info.averageItemLength * info.index,
          animated: false,
        });
      }}
    />
  );
}

// ---------- Main app ----------

export default function HomeScreen() {
  const sessionRef = useRef(new FeedSession());
  const [feedBlocks, setFeedBlocks] = useState<FeedBlock[]>([]);
  const [tourLatestVideos, setTourLatestVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [caughtUp, setCaughtUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    async function init() {
      try {
        const [, tourLatest] = await Promise.allSettled([
          sessionRef.current.ensureInitialLoad(),
          fetchTourLatestVideos(TOUR_LATEST_HEADER_LIMIT),
        ]);

        const { blocks, caughtUp: done } = await sessionRef.current.appendNextCycle();
        setFeedBlocks(blocks);
        setCaughtUp(done);

        if (tourLatest.status === 'fulfilled') {
          sessionRef.current.markVideosShown(tourLatest.value);
          setTourLatestVideos(tourLatest.value);
        } else {
          console.warn('[The Cut] tour-latest-videos failed:', tourLatest.reason);
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || caughtUp || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const { blocks, caughtUp: done } = await sessionRef.current.appendNextCycle();
      if (blocks.length) {
        setFeedBlocks((prev) => [...prev, ...blocks]);
      }
      if (done) setCaughtUp(true);
    } catch (e: any) {
      console.warn('[The Cut] Failed to load more feed:', e?.message || e);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [caughtUp, loading]);

  const handleEndReached = useCallback(() => {
    loadMore();
  }, [loadMore]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.liveBlue} />
        <Text style={{ color: colors.coolGrey, marginTop: 12 }}>Loading The Cut v2.0…</Text>
      </SafeAreaView>
    );
  }

  return (
    <ArticleReaderProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <FlatList
          data={feedBlocks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.feedBlockWrap}>
              <FeedBlockItem block={item} />
            </View>
          )}
          ListHeaderComponent={
            <>
              <HomeHeader />
              <UpcomingEventsStrip />
              {tourLatestVideos.length > 0 ? (
                <View style={styles.tourLatestCarouselWrap}>
                  <VideoCarousel
                    videos={tourLatestVideos}
                    tag="Tour"
                    title="Latest from the Tours"
                    subtitle="Pro tour coverage and highlights"
                  />
                </View>
              ) : null}
              {error ? (
                <Text style={[styles.feedError, { paddingHorizontal: 16 }]}>
                  Couldn't reach the backend: {error}
                </Text>
              ) : null}
            </>
          }
          ListFooterComponent={
            loadingMore && !caughtUp ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.liveBlue} />
                <Text style={styles.footerLoaderText}>Loading more…</Text>
              </View>
            ) : null
          }
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.35}
        />
      </SafeAreaView>
    </ArticleReaderProvider>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  eventsRow: { flexGrow: 0 },
  eventsRowContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },

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

  cardTitleLarge: { fontSize: 14, fontWeight: '700', color: colors.navy, lineHeight: 19, marginBottom: 4 },
  cardMeta: { fontSize: 11, color: colors.coolGrey, marginTop: 4 },

  featuredNewsCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 14,
  },
  featuredImage: { width: '100%', aspectRatio: 16 / 9 },
  featuredTitle: { fontSize: 18, fontWeight: '700', color: colors.navy, lineHeight: 24, marginTop: 4 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.navy, marginTop: 6, marginBottom: 2 },
  sectionSubtitle: { fontSize: 12, color: colors.coolGrey, marginBottom: 4 },
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

  feedContent: { paddingHorizontal: 16, paddingBottom: 24 },
  tourLatestCarouselWrap: { marginBottom: 4 },
  feedBlockWrap: { marginBottom: 0 },
  feedError: { color: colors.bogeyRed, marginBottom: 12 },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  footerLoaderText: { fontSize: 13, color: colors.coolGrey },
  caughtUpCard: {
    backgroundColor: colors.card,
    borderRadius: 15,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 24,
    alignItems: 'center',
    marginTop: 8,
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
});
