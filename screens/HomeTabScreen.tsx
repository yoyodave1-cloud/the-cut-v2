import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Article,
  DailyInstructionalSelection,
  FeaturedPodcastPick,
  ShortGameVideo,
  VideoItem,
  fetchCreatorFeaturedPodcastShorts,
  fetchDailyFeaturedPodcastPicks,
  fetchDailyInstructionalSelection,
  fetchNewsPage,
  fetchTourLatestVideosByCreatorName,
  todaysInstructionalTopic,
} from '../api';
import { ArticleReaderProvider } from '../ArticleReader';
import HomeHeader from '../components/HomeHeader';
import SectionGlow from '../components/SectionGlow';
import SectionTitle from '../components/SectionTitle';
import TornDivider from '../components/TornDivider';
import HotRightNowCard from '../components/cards/HotRightNowCard';
import { NewsCardCompact } from '../components/FeedNewsCards';
import FeaturedPodcastCard from '../components/FeaturedPodcastCard';
import { MasterclassVideoCard } from '../components/ShortGameMasterclass';
import {
  FeaturedVideoCard,
  PodcastMixedCarousel,
  VideoCarousel,
} from '../components/VideoFeedCards';
import { colors } from '../constants/colors';
import {
  PRODUCT_TEST_CAROUSEL_COUNT,
  PRODUCT_TEST_FEATURED_COUNT,
  PRODUCT_TEST_VIDEOS,
  ProductTestVideo,
} from '../constants/productTestVideos';
import heroReel from '../assets/gap-video.mp4';

const NEWS_LIMIT = 3;
const VIDEO_LIMIT = 8;

function productTestToMasterclassCard(video: ProductTestVideo, index: number): ShortGameVideo {
  return {
    id: video.videoId,
    youtubeVideoId: video.videoId,
    title: video.title,
    channelName: video.channelName,
    displayOrder: index,
    thumbnailUrl: video.thumbnailUrl,
  };
}

function productTestToVideoItem(video: ProductTestVideo): VideoItem {
  return {
    videoId: video.videoId,
    title: video.title,
    thumbnailUrl: video.thumbnailUrl,
    publishedAt: video.publishedAt,
    creator: { name: video.channelName },
  };
}

function PulseDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.25,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.eyebrowDot, { opacity }]} />;
}

function HeroReel() {
  const player = useVideoPlayer(heroReel, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={styles.heroVideo}
      contentFit="cover"
      nativeControls
    />
  );
}

const TORN_DIVIDER_H = 34;

function SectionShell({
  scheme,
  style,
  tornVariant,
  children,
}: {
  scheme: 'light' | 'dark';
  style: StyleProp<ViewStyle>;
  tornVariant?: number;
  children: React.ReactNode;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const takeLayout = (width: number, height: number, prefer: boolean) => {
    if (width <= 0 || height <= 0) return;
    setSize((prev) => {
      if (!prefer && prev.height > 0) return prev;
      if (prev.width === width && prev.height === height) return prev;
      return { width, height };
    });
  };

  const glowH = Math.max(0, size.height - TORN_DIVIDER_H);

  return (
    <View
      collapsable={false}
      style={style}
      onLayout={({ nativeEvent }: LayoutChangeEvent) =>
        takeLayout(nativeEvent.layout.width, nativeEvent.layout.height, true)
      }
    >
      {tornVariant != null ? (
        <View style={styles.tornBleed}>
          <TornDivider
            scheme={scheme}
            variant={tornVariant}
            sectionWidth={size.width}
            sectionHeight={size.height}
          />
        </View>
      ) : null}
      {glowH > 0 ? (
        <View
          pointerEvents="none"
          collapsable={false}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: size.width,
            height: glowH,
            overflow: 'hidden',
          }}
        >
          <SectionGlow scheme={scheme} width={size.width} height={glowH} />
        </View>
      ) : null}
      <View
        style={styles.sectionInner}
        onLayout={({ nativeEvent }: LayoutChangeEvent) =>
          takeLayout(nativeEvent.layout.width, nativeEvent.layout.height, false)
        }
      >
        {children}
      </View>
    </View>
  );
}

function HomeSection({
  scheme,
  last,
  tornVariant,
  children,
}: {
  scheme: 'light' | 'dark';
  last?: boolean;
  tornVariant?: number;
  children: React.ReactNode;
}) {
  return (
    <SectionShell
      scheme={scheme}
      tornVariant={tornVariant}
      style={[scheme === 'light' ? styles.lightSection : styles.darkSection, last && styles.lastSection]}
    >
      {children}
    </SectionShell>
  );
}

function IntroSection() {
  return (
    <SectionShell scheme="dark" style={styles.introSection}>
      <View style={styles.eyebrowWrap}>
        <View style={styles.eyebrow}>
          <PulseDot />
          <Text style={styles.eyebrowText}>Welcome to The Cut</Text>
        </View>
      </View>
      <Text style={styles.oversize}>{`Sunday golf,\nMonday golf,\none app.`}</Text>
      <Text style={styles.rockSaltAccent}>Tour Vs Creator</Text>
      <View style={styles.videoBox}>
        <HeroReel />
        <Text style={styles.videoCaption}>
          Golf media picked a side, the fans never did. One app for all golf.
        </Text>
      </View>
    </SectionShell>
  );
}

function SeeAllLink({
  label,
  scheme,
  onPress,
}: {
  label: string;
  scheme: 'light' | 'dark';
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Text style={scheme === 'light' ? styles.seeAllLight : styles.seeAllDark}>{label}</Text>
    </TouchableOpacity>
  );
}

function TourGolfBlock({
  subtitle,
  videos,
  articles,
  seeAllLabel,
  onSeeAll,
  tornVariant,
}: {
  subtitle: string;
  videos: VideoItem[];
  articles: Article[];
  seeAllLabel: string;
  onSeeAll: () => void;
  tornVariant: number;
}) {
  return (
    <HomeSection scheme="light" tornVariant={tornVariant}>
      <SectionTitle subtitle={subtitle} big="Tour" small="golf" scheme="light" />
      {videos.length > 0 ? (
        <View style={styles.carouselWrap}>
          <VideoCarousel videos={videos} />
        </View>
      ) : null}
      <View style={styles.newsWrap}>
        {articles.map((article) => (
          <NewsCardCompact key={article.url || article.title} article={article} />
        ))}
        <SeeAllLink label={seeAllLabel} scheme="light" onPress={onSeeAll} />
      </View>
    </HomeSection>
  );
}

function CreatorGolfBlock({
  subtitle,
  videos,
  articles,
  podcastPicks,
  featuredVideos,
  masterclassVideos,
  topicLabel,
  seeAllLabel,
  onSeeAll,
  last,
  carousel = 'video',
  tornVariant,
}: {
  subtitle: string;
  videos: VideoItem[];
  articles?: Article[];
  podcastPicks?: FeaturedPodcastPick[];
  featuredVideos?: Array<{ video: VideoItem; subTopic?: string }>;
  masterclassVideos?: ShortGameVideo[];
  topicLabel?: string;
  seeAllLabel: string;
  onSeeAll: () => void;
  last?: boolean;
  carousel?: 'video' | 'shorts';
  tornVariant: number;
}) {
  const hasMasterclassCarousel = (masterclassVideos?.length ?? 0) > 0;
  return (
    <HomeSection scheme="dark" last={last} tornVariant={tornVariant}>
      <SectionTitle subtitle={subtitle} big="Creator" small="golf" scheme="dark" />
      {topicLabel || videos.length > 0 || hasMasterclassCarousel ? (
        <View style={styles.carouselWrap}>
          {topicLabel ? <Text style={styles.instructionalTopic}>{topicLabel}</Text> : null}
          {hasMasterclassCarousel ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {(masterclassVideos ?? []).map((video) => (
                <MasterclassVideoCard
                  key={video.id || video.youtubeVideoId}
                  video={video}
                />
              ))}
            </ScrollView>
          ) : videos.length > 0 ? (
            carousel === 'shorts' ? (
              <PodcastMixedCarousel videos={videos} />
            ) : (
              <VideoCarousel videos={videos} />
            )
          ) : null}
        </View>
      ) : null}
      <View style={styles.newsWrap}>
        {podcastPicks
          ? podcastPicks.map((pick) => (
              <FeaturedPodcastCard key={pick.videoId || pick.podcastName} pick={pick} />
            ))
          : featuredVideos
            ? featuredVideos.map((pick) => (
                <FeaturedVideoCard
                  key={pick.video.videoId}
                  video={pick.video}
                  subTopic={pick.subTopic}
                />
              ))
            : (articles ?? []).map((article) => (
                <NewsCardCompact key={article.url || article.title} article={article} />
              ))}
        <SeeAllLink label={seeAllLabel} scheme="dark" onPress={onSeeAll} />
      </View>
    </HomeSection>
  );
}

type HomeFeed = {
  pgaVideos: VideoItem[];
  pgaNews: Article[];
  dpwtVideos: VideoItem[];
  dpwtNews: Article[];
  lpgaVideos: VideoItem[];
  lpgaNews: Article[];
  livVideos: VideoItem[];
  livNews: Article[];
  podcastVideos: VideoItem[];
  podcastPicks: FeaturedPodcastPick[];
  instructional: DailyInstructionalSelection;
  productCarousel: ShortGameVideo[];
  productFeatured: VideoItem[];
};

const EMPTY_INSTRUCTIONAL: DailyInstructionalSelection = {
  topic: todaysInstructionalTopic(),
  carousel: [],
  featured: [],
};

const EMPTY_FEED: HomeFeed = {
  pgaVideos: [],
  pgaNews: [],
  dpwtVideos: [],
  dpwtNews: [],
  lpgaVideos: [],
  lpgaNews: [],
  livVideos: [],
  livNews: [],
  podcastVideos: [],
  podcastPicks: [],
  instructional: EMPTY_INSTRUCTIONAL,
  productCarousel: PRODUCT_TEST_VIDEOS.slice(0, PRODUCT_TEST_CAROUSEL_COUNT).map(
    productTestToMasterclassCard,
  ),
  productFeatured: PRODUCT_TEST_VIDEOS.slice(
    PRODUCT_TEST_CAROUSEL_COUNT,
    PRODUCT_TEST_CAROUSEL_COUNT + PRODUCT_TEST_FEATURED_COUNT,
  ).map(productTestToVideoItem),
};

function settledList<T>(result: PromiseSettledResult<T[]>, label: string): T[] {
  if (result.status === 'fulfilled') return result.value;
  console.warn(`[The Cut] ${label} failed:`, result.reason);
  return [];
}

function settledNews(result: PromiseSettledResult<{ articles: Article[] }>, label: string): Article[] {
  if (result.status === 'fulfilled') return result.value.articles.slice(0, NEWS_LIMIT);
  console.warn(`[The Cut] ${label} failed:`, result.reason);
  return [];
}

function settledValue<T>(result: PromiseSettledResult<T>, fallback: T, label: string): T {
  if (result.status === 'fulfilled') return result.value;
  console.warn(`[The Cut] ${label} failed:`, result.reason);
  return fallback;
}

async function loadHomeFeed(): Promise<HomeFeed> {
  const [
    pgaVideos,
    pgaNews,
    dpwtVideos,
    dpwtNews,
    lpgaVideos,
    lpgaNews,
    livVideos,
    livNews,
    podcastVideos,
    podcastPicks,
    instructional,
  ] = await Promise.allSettled([
    fetchTourLatestVideosByCreatorName('PGA Tour', VIDEO_LIMIT),
    fetchNewsPage({ q: '"PGA Tour"', pageSize: NEWS_LIMIT }),
    fetchTourLatestVideosByCreatorName('DP World Tour', VIDEO_LIMIT),
    fetchNewsPage({
      q: '"DP World Tour" OR "Race to Dubai" OR ("European Tour" AND golf)',
      pageSize: NEWS_LIMIT,
    }),
    fetchTourLatestVideosByCreatorName('LPGA', VIDEO_LIMIT),
    fetchNewsPage({ q: '"LPGA"', pageSize: NEWS_LIMIT }),
    fetchTourLatestVideosByCreatorName('LIV Golf', VIDEO_LIMIT),
    fetchNewsPage({ q: '"LIV Golf"', pageSize: NEWS_LIMIT }),
    fetchCreatorFeaturedPodcastShorts(),
    fetchDailyFeaturedPodcastPicks(),
    fetchDailyInstructionalSelection(),
  ]);

  return {
    pgaVideos: settledList(pgaVideos, 'PGA Tour videos'),
    pgaNews: settledNews(pgaNews, 'PGA Tour news'),
    dpwtVideos: settledList(dpwtVideos, 'DP World Tour videos'),
    dpwtNews: settledNews(dpwtNews, 'DP World Tour news'),
    lpgaVideos: settledList(lpgaVideos, 'LPGA videos'),
    lpgaNews: settledNews(lpgaNews, 'LPGA news'),
    livVideos: settledList(livVideos, 'LIV Golf videos'),
    livNews: settledNews(livNews, 'LIV Golf news'),
    podcastVideos: settledList(podcastVideos, 'podcast videos'),
    podcastPicks: settledList(podcastPicks, 'podcast featured picks'),
    instructional: settledValue(
      instructional,
      { ...EMPTY_INSTRUCTIONAL, topic: todaysInstructionalTopic() },
      'instructional videos',
    ),
    productCarousel: PRODUCT_TEST_VIDEOS.slice(0, PRODUCT_TEST_CAROUSEL_COUNT).map(
      productTestToMasterclassCard,
    ),
    productFeatured: PRODUCT_TEST_VIDEOS.slice(
      PRODUCT_TEST_CAROUSEL_COUNT,
      PRODUCT_TEST_CAROUSEL_COUNT + PRODUCT_TEST_FEATURED_COUNT,
    ).map(productTestToVideoItem),
  };
}

function HomeTabBody() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [feed, setFeed] = useState<HomeFeed>(EMPTY_FEED);

  useEffect(() => {
    let cancelled = false;
    loadHomeFeed().then((next) => {
      if (!cancelled) setFeed(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const goTour = () => navigation.navigate('Tour' as never);
  const goCreators = () => navigation.navigate('Creators' as never);

  return (
    <View style={styles.root}>
      <HomeHeader />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}
        showsVerticalScrollIndicator={false}
      >
        <IntroSection />

        <TourGolfBlock
          subtitle="PGA Tour"
          videos={feed.pgaVideos}
          articles={feed.pgaNews}
          seeAllLabel="See all PGA Tour news →"
          onSeeAll={goTour}
          tornVariant={0}
        />

        <HomeSection scheme="dark" tornVariant={1}>
          <SectionTitle subtitle="Hot Right Now" big="Creator" small="golf" scheme="dark" />
          <View style={styles.newsWrap}>
            <HotRightNowCard maxItems={5} expandable={false} showHeader={false} showFooter={false} />
            <SeeAllLink label="See all trending →" scheme="dark" onPress={goCreators} />
          </View>
        </HomeSection>

        <TourGolfBlock
          subtitle="DP World Tour"
          videos={feed.dpwtVideos}
          articles={feed.dpwtNews}
          seeAllLabel="See all DP World Tour news →"
          onSeeAll={goTour}
          tornVariant={2}
        />

        <CreatorGolfBlock
          subtitle="Podcasts"
          videos={feed.podcastVideos}
          podcastPicks={feed.podcastPicks}
          seeAllLabel="See all podcasts →"
          onSeeAll={goCreators}
          carousel="shorts"
          tornVariant={3}
        />

        <TourGolfBlock
          subtitle="LPGA"
          videos={feed.lpgaVideos}
          articles={feed.lpgaNews}
          seeAllLabel="See all LPGA news →"
          onSeeAll={goTour}
          tornVariant={4}
        />

        <CreatorGolfBlock
          subtitle="Instructional"
          videos={[]}
          masterclassVideos={feed.instructional.carousel}
          featuredVideos={feed.instructional.featured}
          topicLabel={feed.instructional.topic}
          seeAllLabel="See all instruction →"
          onSeeAll={goCreators}
          tornVariant={5}
        />

        <TourGolfBlock
          subtitle="LIV Golf"
          videos={feed.livVideos}
          articles={feed.livNews}
          seeAllLabel="See all LIV Golf news →"
          onSeeAll={goTour}
          tornVariant={6}
        />

        <CreatorGolfBlock
          subtitle="Product Tests"
          videos={[]}
          masterclassVideos={feed.productCarousel}
          featuredVideos={feed.productFeatured.map((video) => ({ video }))}
          seeAllLabel="See all product tests →"
          onSeeAll={goCreators}
          last
          tornVariant={7}
        />
      </ScrollView>
    </View>
  );
}

export default function HomeTabScreen() {
  return (
    <ArticleReaderProvider>
      <HomeTabBody />
    </ArticleReaderProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy },
  scroll: { flex: 1 },
  introSection: {
    backgroundColor: colors.navy,
    overflow: 'visible',
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 90,
  },
  lightSection: {
    backgroundColor: colors.bg,
    overflow: 'visible',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 90,
  },
  darkSection: {
    backgroundColor: colors.navy,
    overflow: 'visible',
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 90,
  },
  lastSection: { paddingBottom: 56 },
  sectionInner: { position: 'relative', overflow: 'visible' },
  tornBleed: { marginHorizontal: -24 },
  eyebrowWrap: { alignItems: 'center' },
  eyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.4)',
    backgroundColor: 'rgba(0,229,255,0.07)',
    marginBottom: 22,
  },
  eyebrowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.voltCyan,
  },
  eyebrowText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.88,
    textTransform: 'uppercase',
    color: '#9EEFFB',
  },
  oversize: {
    fontFamily: 'BricolageGrotesque_800ExtraBold',
    fontSize: 42,
    lineHeight: 39,
    letterSpacing: -1.26,
    textTransform: 'uppercase',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  rockSaltAccent: {
    fontFamily: 'RockSalt_400Regular',
    fontSize: 26,
    color: colors.voltCyan,
    textAlign: 'center',
    marginTop: 18,
    transform: [{ rotate: '-2deg' }],
  },
  videoBox: {
    marginTop: 28,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(138,155,176,0.25)',
    backgroundColor: 'rgba(26,46,74,0.6)',
  },
  heroVideo: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.midNavy,
  },
  videoCaption: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
    lineHeight: 20,
    color: '#C6D2E0',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  carouselWrap: { marginTop: 22 },
  instructionalTopic: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.96,
    textTransform: 'uppercase',
    color: '#9EEFFB',
    marginBottom: 10,
  },
  newsWrap: { marginTop: 22 },
  seeAllLight: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    letterSpacing: 0.38,
    color: colors.subtitleBlue,
    textAlign: 'center',
    marginTop: 14,
  },
  seeAllDark: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    letterSpacing: 0.38,
    color: '#9EEFFB',
    textAlign: 'center',
    marginTop: 14,
  },
});
