import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  FlatList,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { Article, VideoItem, logImageError, videoThumbnailUri } from './api';
import { FeedBlock, FeedSession } from './feed';

// ---- Admiralty palette (light theme) ----
const colors = {
  bg: '#F0F4F8',
  card: '#FFFFFF',
  border: '#D8DEE6',
  navy: '#0B1629',
  midNavy: '#1A2E4A',
  coolGrey: '#566778',
  mutedGrey: '#8A9BB0',
  liveBlue: '#4A90D9',
  birdieGreen: '#1DBF73',
  eagleAmber: '#F5A623',
  bogeyRed: '#E84444',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / (1000 * 60 * 60));
  if (hrs < 1) return 'just now';
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ---------- Reusable card components ----------

function NewsCardCompact({ article, tag }: { article: Article; tag?: string }) {
  return (
    <TouchableOpacity style={styles.compactCard} activeOpacity={0.8}>
      {tag ? <Text style={styles.scaledTagLabel}>{tag}</Text> : null}
      <View style={[styles.compactCardRow, { marginTop: tag ? 8 : 0 }]}>
        <View style={styles.compactCardText}>
          <Text style={styles.cardTitle} numberOfLines={3}>
            {article.title}
          </Text>
          <Text style={styles.compactCardMeta}>
            {article.source?.name} · {timeAgo(article.publishedAt)}
          </Text>
        </View>
        {article.urlToImage ? (
          <Image source={{ uri: article.urlToImage }} style={styles.compactThumb} />
        ) : (
          <View style={[styles.compactThumb, { backgroundColor: colors.midNavy }]} />
        )}
      </View>
    </TouchableOpacity>
  );
}

function FeaturedNewsCard({ article, tag }: { article: Article; tag?: string }) {
  return (
    <TouchableOpacity style={styles.featuredNewsCard} activeOpacity={0.8}>
      {article.urlToImage ? (
        <Image source={{ uri: article.urlToImage }} style={styles.featuredImage} />
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

function TrendingList({ articles }: { articles: Article[] }) {
  const dots = [colors.liveBlue, colors.eagleAmber, colors.birdieGreen, colors.bogeyRed];
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.scaledTagLabel}>News</Text>
      <Text style={styles.sectionTitleScaled}>Trending in golf</Text>
      <View style={styles.trendingBox}>
        {articles.slice(0, 4).map((a, i) => (
          <View
            key={a.url}
            style={[
              styles.trendingRow,
              i < articles.length - 1 ? styles.trendingDivider : null,
            ]}
          >
            <View style={[styles.trendingDot, { backgroundColor: dots[i % dots.length] }]} />
            <Text style={styles.trendingText} numberOfLines={2}>
              {a.title}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function FeaturedVideoCard({ video, tag }: { video: VideoItem; tag?: string }) {
  const thumb = videoThumbnailUri(video);
  return (
    <TouchableOpacity style={styles.featuredVideoCard} activeOpacity={0.8}>
      <View>
        <Image
          source={{ uri: thumb }}
          style={styles.featuredVideoThumb}
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
          {video.creator?.name || 'Creator'} · {timeAgo(video.publishedAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function ShortsCarousel({ shorts, tag, title }: { shorts: VideoItem[]; tag: string; title: string }) {
  if (!shorts.length) return null;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.tagLabel}>{tag}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
        {shorts.map((s) => {
          const thumb = videoThumbnailUri(s);
          return (
            <TouchableOpacity key={s.videoId} style={styles.shortCard} activeOpacity={0.8}>
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

function FullBleedShort({ short, tag }: { short: VideoItem; tag: string }) {
  const thumb = videoThumbnailUri(short);
  return (
    <TouchableOpacity style={styles.fullBleedWrap} activeOpacity={0.85}>
      <Image
        source={{ uri: thumb }}
        style={styles.fullBleedImage}
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
          {short.creator?.name || 'Creator'} · {timeAgo(short.publishedAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function VideoCarousel({ videos, tag, title, subtitle }: { videos: VideoItem[]; tag: string; title: string; subtitle: string }) {
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
            <TouchableOpacity key={v.videoId} style={styles.carouselCard} activeOpacity={0.8}>
              <Image
                source={{ uri: thumb }}
                style={styles.carouselThumb}
                onError={logImageError('video-carousel', thumb)}
              />
              <Text style={styles.carouselTitle} numberOfLines={2}>
                {v.title}
              </Text>
              <Text style={styles.carouselMeta}>
                {v.creator?.name || 'Creator'} · {timeAgo(v.publishedAt)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
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

// ---------- Header ----------

function Header() {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>TC</Text>
        </View>
        <Text style={styles.strapline} numberOfLines={1}>
          Pro golf · Creator golf · All golf
        </Text>
      </View>
      <View style={styles.profileButton}>
        <Ionicons name="person-outline" size={16} color={colors.navy} />
      </View>
    </View>
  );
}

const TOURS = [
  { label: 'PGA\nTour', name: 'PGA Tour' },
  { label: 'DP\nWorld', name: 'DP World' },
  { label: 'LIV', name: 'LIV Golf' },
  { label: 'The\nOpen', name: 'The Open', dimmed: true },
];

function TourCircles() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toursRow}>
      {TOURS.map((t) => (
        <View key={t.name} style={[styles.tourItem, t.dimmed ? { opacity: 0.5 } : null]}>
          <View style={styles.tourCircle}>
            <Text style={styles.tourCircleText}>{t.label}</Text>
          </View>
          <Text style={styles.tourLabel}>{t.name}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function FilterPills() {
  const [active, setActive] = useState('For you');
  const pills = ['For you', 'Creators', 'Pro news'];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow}>
      {pills.map((p) => (
        <TouchableOpacity
          key={p}
          onPress={() => setActive(p)}
          style={[styles.pill, active === p ? styles.pillActive : null]}
        >
          <Text style={active === p ? styles.pillTextActive : styles.pillText}>{p}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ---------- Main app ----------

export default function App() {
  const sessionRef = useRef(new FeedSession());
  const [feedBlocks, setFeedBlocks] = useState<FeedBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [caughtUp, setCaughtUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    async function init() {
      try {
        await sessionRef.current.ensureInitialLoad();
        const { blocks, caughtUp: done } = await sessionRef.current.appendNextCycle();
        setFeedBlocks(blocks);
        setCaughtUp(done);
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
            <Header />
            <TourCircles />
            <FilterPills />
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
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  logoBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  strapline: { color: colors.coolGrey, fontSize: 13, fontWeight: '500', flexShrink: 1 },
  profileButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.mutedGrey,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toursRow: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
  tourItem: { width: 64, alignItems: 'center', marginRight: 10 },
  tourCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: colors.mutedGrey,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  tourCircleText: { fontSize: 10, fontWeight: '600', color: colors.navy, textAlign: 'center' },
  tourLabel: { fontSize: 10, color: colors.coolGrey },
  pillsRow: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#B9C3D1',
    marginRight: 8,
  },
  pillActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  pillText: { fontSize: 13, fontWeight: '500', color: colors.navy },
  pillTextActive: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },

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

  compactCard: {
    backgroundColor: colors.card,
    borderRadius: 15,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 15,
    marginBottom: 13,
  },
  compactCardRow: {
    flexDirection: 'row',
    gap: 13,
    alignItems: 'flex-start',
  },
  compactCardText: { flex: 1, minWidth: 0, paddingTop: 1 },
  compactThumb: { width: 100, height: 100, borderRadius: 10, flexShrink: 0 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.navy, lineHeight: 23 },
  compactCardMeta: { fontSize: 13, color: colors.coolGrey, marginTop: 5 },
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
  featuredImage: { width: '100%', height: 160 },
  featuredTitle: { fontSize: 18, fontWeight: '700', color: colors.navy, lineHeight: 24, marginTop: 4 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.navy, marginTop: 6, marginBottom: 2 },
  sectionTitleScaled: { fontSize: 20, fontWeight: '700', color: colors.navy, marginTop: 8, marginBottom: 3 },
  sectionSubtitle: { fontSize: 12, color: colors.coolGrey, marginBottom: 4 },
  sectionSubtitleScaled: { fontSize: 15, color: colors.coolGrey, marginBottom: 5 },

  trendingBox: {
    backgroundColor: colors.card,
    borderRadius: 15,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
    marginTop: 10,
  },
  trendingRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 15 },
  trendingDivider: { borderBottomWidth: 0.5, borderBottomColor: '#E5E9EE' },
  trendingDot: { width: 20, height: 20, borderRadius: 5, marginTop: 2 },
  trendingText: { fontSize: 16, fontWeight: '600', color: colors.navy, flex: 1, lineHeight: 23 },

  featuredVideoCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 14,
  },
  featuredVideoThumb: { width: '100%', height: 150, backgroundColor: colors.midNavy },
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
    height: 480,
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

  carouselCard: { width: 213, marginRight: 13 },
  carouselThumb: { width: 213, height: 120, borderRadius: 13, backgroundColor: colors.midNavy },
  carouselTitle: { fontSize: 15, fontWeight: '600', color: colors.navy, marginTop: 9, lineHeight: 20 },
  carouselMeta: { fontSize: 13, color: colors.coolGrey, marginTop: 3 },

  feedContent: { paddingHorizontal: 16, paddingBottom: 24 },
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
