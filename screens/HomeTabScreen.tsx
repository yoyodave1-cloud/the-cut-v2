import React, { useEffect, useId, useRef, useState } from 'react';
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
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
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
  useFeaturedSections,
} from '../api';
import { ArticleReaderProvider } from '../ArticleReader';
import HomeHeader from '../components/HomeHeader';
import HomeTourEventsStrip from '../components/HomeTourEventsStrip';
import SectionGlow, { SectionGlowPaint, type SectionGlowVariant } from '../components/SectionGlow';
import SectionTitle from '../components/SectionTitle';
import TornDivider from '../components/TornDivider';
import HotRightNowCard from '../components/cards/HotRightNowCard';
import { NewsCardCompact } from '../components/FeedNewsCards';
import FeaturedPodcastCard from '../components/FeaturedPodcastCard';
import FeaturedCreatorSection from '../components/FeaturedCreatorSection';
import FeaturedTourSection from '../components/FeaturedTourSection';
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

/** Depth of the smooth top arc, in px at the sides. Center of the curve is y=0. */
const HERO_CURVE_H = 44;
/** Fraction of the video height covered by the bottom navy fade into the torn seam. */
const HERO_FADE_FRACTION = 0.72;
/** Visible solid navy between the video fade and the ripped-paper edge. */
const HERO_NAVY_BUFFER = 28;
const TORN_DIVIDER_H = 34;
const INTRO_PAD_TOP = 56;

type HeadlineToken = { text: string; color: string };
type HeadlineTier = 'lead' | 'mid' | 'hero' | 'tail';
type HeadlineLine = { tokens: HeadlineToken[]; tier: HeadlineTier };

const HEADLINE_LINES: HeadlineLine[] = [
  { tier: 'lead', tokens: [{ text: 'Golf media', color: colors.liveBlue }] },
  { tier: 'lead', tokens: [{ text: 'picked a side,', color: '#FFFFFF' }] },
  {
    tier: 'mid',
    tokens: [
      { text: 'the fans ', color: '#FFFFFF' },
      { text: 'never', color: colors.liveBlue },
      { text: ' did,', color: '#FFFFFF' },
    ],
  },
  { tier: 'hero', tokens: [{ text: 'one app', color: colors.liveBlue }] },
  { tier: 'tail', tokens: [{ text: 'for all golf.', color: '#FFFFFF' }] },
];

const HEADLINE_SCALE = {
  allowFontScaling: false as const,
  maxFontSizeMultiplier: 1,
};

function headlineStyleFor(tier: HeadlineTier) {
  switch (tier) {
    case 'hero':
      return styles.oversizeHero;
    case 'mid':
      return styles.oversizeMid;
    case 'tail':
      return styles.oversizeTail;
    default:
      return styles.oversizeLead;
  }
}

function FittedHeadlineLine({
  tokens,
  baseStyle,
  minSize = 18,
}: {
  tokens: HeadlineToken[];
  baseStyle: TextStyle;
  minSize?: number;
}) {
  const flat = StyleSheet.flatten(baseStyle);
  const startSize = typeof flat.fontSize === 'number' ? flat.fontSize : 35;
  const lhRatio =
    typeof flat.lineHeight === 'number' && startSize > 0 ? flat.lineHeight / startSize : 1.12;
  const [fontSize, setFontSize] = useState(startSize);
  const locked = useRef(false);

  const sizedStyle: TextStyle = {
    ...flat,
    fontSize,
    lineHeight: Math.round(fontSize * lhRatio),
  };

  return (
    <Text
      {...HEADLINE_SCALE}
      style={[sizedStyle, styles.headlineLine]}
      onTextLayout={(event) => {
        if (locked.current) return;
        const lineCount = event.nativeEvent.lines.length;
        if (lineCount === 0) return;
        if (lineCount > 1 && fontSize > minSize) {
          setFontSize((size) => size - 1);
          return;
        }
        locked.current = true;
      }}
    >
      {tokens.map((token, tokenIndex) => (
        <Text key={tokenIndex} {...HEADLINE_SCALE} style={[sizedStyle, { color: token.color }]}>
          {token.text}
        </Text>
      ))}
    </Text>
  );
}

function IntroHeadline() {
  return (
    <View style={styles.headlineBlock}>
      {HEADLINE_LINES.map((line, lineIndex) => {
        const lineStyle = headlineStyleFor(line.tier);
        if (line.tier === 'mid' || line.tier === 'hero') {
          return (
            <FittedHeadlineLine
              key={lineIndex}
              tokens={line.tokens}
              baseStyle={lineStyle}
              minSize={line.tier === 'hero' ? 36 : 18}
            />
          );
        }
        return (
          <Text key={lineIndex} {...HEADLINE_SCALE} style={[lineStyle, styles.headlineLine]}>
            {line.tokens.map((token, tokenIndex) => (
              <Text key={tokenIndex} {...HEADLINE_SCALE} style={[lineStyle, { color: token.color }]}>
                {token.text}
              </Text>
            ))}
          </Text>
        );
      })}
      <View style={styles.rockSaltWrap}>
        <Text {...HEADLINE_SCALE} style={styles.rockSaltAccent}>
          Tour Vs Creator
        </Text>
      </View>
    </View>
  );
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
      nativeControls={false}
    />
  );
}

function IntroHeroVideo({ glowOffsetY }: { glowOffsetY: number }) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const fadeH = Math.round(size.height * HERO_FADE_FRACTION);
  const capClipId = `heroCap-${reactId}`;
  const capPath =
    size.width > 0
      ? `M0 0 H${size.width} V${HERO_CURVE_H} Q${size.width / 2} 0 0 ${HERO_CURVE_H} Z`
      : '';
  const glowWidth = size.width;
  const glowHeight = glowOffsetY + size.height + HERO_NAVY_BUFFER + TORN_DIVIDER_H;

  return (
    <View collapsable={false} style={styles.heroBleed}>
      <View
        collapsable={false}
        style={styles.heroVideoWrap}
        onLayout={({ nativeEvent }: LayoutChangeEvent) => {
          const { width, height } = nativeEvent.layout;
          if (width <= 0 || height <= 0) return;
          setSize((prev) =>
            prev.width === width && prev.height === height ? prev : { width, height },
          );
        }}
      >
        <HeroReel />
        {size.width > 0 ? (
          <>
            <Svg
              width={size.width}
              height={HERO_CURVE_H}
              style={styles.heroCurveSvg}
              pointerEvents="none"
            >
              <Defs>
                <ClipPath id={capClipId}>
                  <Path d={capPath} />
                </ClipPath>
              </Defs>
              <G clipPath={`url(#${capClipId})`}>
                <Rect width={size.width} height={HERO_CURVE_H} fill={colors.navy} />
                {glowWidth > 0 && glowHeight > 0 ? (
                  <G transform={`translate(0, ${-glowOffsetY})`}>
                    <SectionGlowPaint
                      scheme="dark"
                      width={glowWidth}
                      height={glowHeight}
                      variant="intro"
                      idPrefix={`heroGlow-${reactId}`}
                    />
                  </G>
                ) : null}
              </G>
            </Svg>
            <Svg
              width={size.width}
              height={fadeH}
              style={styles.heroFadeSvg}
              pointerEvents="none"
            >
              <Defs>
                <LinearGradient id={`heroFade-${reactId}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={colors.navy} stopOpacity="0" />
                  <Stop offset="25%" stopColor={colors.navy} stopOpacity="0.38" />
                  <Stop offset="58%" stopColor={colors.navy} stopOpacity="0.78" />
                  <Stop offset="100%" stopColor={colors.navy} stopOpacity="0.94" />
                </LinearGradient>
              </Defs>
              <Rect width={size.width} height={fadeH} fill={`url(#heroFade-${reactId})`} />
            </Svg>
          </>
        ) : null}
      </View>
      <View style={styles.heroNavyBuffer} />
    </View>
  );
}

function SectionShell({
  scheme,
  style,
  tornVariant,
  glowVariant = 'default',
  children,
}: {
  scheme: 'light' | 'dark';
  style: StyleProp<ViewStyle>;
  tornVariant?: number;
  glowVariant?: SectionGlowVariant;
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

  const glowH =
    glowVariant === 'intro' ? size.height : Math.max(0, size.height - TORN_DIVIDER_H);

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
          <SectionGlow
            scheme={scheme}
            width={size.width}
            height={glowH}
            variant={glowVariant}
          />
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
  const [copyBottom, setCopyBottom] = useState(0);

  return (
    <SectionShell scheme="dark" style={styles.introSection} glowVariant="intro">
      <View
        onLayout={({ nativeEvent }: LayoutChangeEvent) => {
          const bottom = INTRO_PAD_TOP + nativeEvent.layout.height;
          setCopyBottom((prev) => (prev === bottom ? prev : bottom));
        }}
      >
        <View style={styles.eyebrowWrap}>
          <View style={styles.eyebrow}>
            <PulseDot />
            <Text style={styles.eyebrowText}>Welcome to The Cut</Text>
          </View>
        </View>
        <IntroHeadline />
      </View>
      <IntroHeroVideo key="intro-hero-curve-v4" glowOffsetY={copyBottom} />
    </SectionShell>
  );
}

function FeaturedTourSlot({ tornVariant }: { tornVariant: number }) {
  const { tour } = useFeaturedSections();
  if (!tour) return null;
  return (
    <HomeSection scheme="light" tornVariant={tornVariant}>
      <FeaturedTourSection />
    </HomeSection>
  );
}

function FeaturedCreatorSlot({ tornVariant }: { tornVariant: number }) {
  const { creator } = useFeaturedSections();
  if (!creator) return null;
  return (
    <HomeSection scheme="dark" tornVariant={tornVariant}>
      <FeaturedCreatorSection />
    </HomeSection>
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
  eventStripTour,
}: {
  subtitle: string;
  videos: VideoItem[];
  articles: Article[];
  seeAllLabel: string;
  onSeeAll: () => void;
  tornVariant: number;
  eventStripTour?: string;
}) {
  return (
    <HomeSection scheme="light" tornVariant={tornVariant}>
      <SectionTitle
        subtitle={subtitle}
        big="Tour"
        small="golf"
        scheme="light"
        trailing={
          eventStripTour
            ? (availableWidth) => (
                <HomeTourEventsStrip tourTitle={eventStripTour} availableWidth={availableWidth} />
              )
            : undefined
        }
      />
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
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
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
          eventStripTour="PGA Tour"
        />

        <HomeSection scheme="dark" tornVariant={1}>
          <SectionTitle subtitle="Hot Right Now" big="Creator" small="golf" scheme="dark" />
          <View style={styles.newsWrap}>
            <HotRightNowCard maxItems={5} expandable={false} showHeader={false} showFooter={false} />
            <SeeAllLink label="See all trending →" scheme="dark" onPress={goCreators} />
          </View>
        </HomeSection>

        <FeaturedTourSlot tornVariant={8} />
        <FeaturedCreatorSlot tornVariant={9} />

        <TourGolfBlock
          subtitle="DP World Tour"
          videos={feed.dpwtVideos}
          articles={feed.dpwtNews}
          seeAllLabel="See all DP World Tour news →"
          onSeeAll={goTour}
          tornVariant={2}
          eventStripTour="DP World Tour"
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
          eventStripTour="LPGA"
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
    paddingTop: INTRO_PAD_TOP,
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
  headlineBlock: {
    alignSelf: 'stretch',
  },
  headlineLine: {
    width: '100%',
    textAlign: 'center',
  },
  oversizeLead: {
    fontFamily: 'BricolageGrotesque_800ExtraBold',
    fontSize: 35,
    lineHeight: 39,
    letterSpacing: -1.6,
    textTransform: 'uppercase',
    color: '#FFFFFF',
    textAlign: 'center',
    includeFontPadding: false,
  },
  oversizeMid: {
    fontFamily: 'BricolageGrotesque_800ExtraBold',
    fontSize: 35,
    lineHeight: 39,
    letterSpacing: -1.6,
    textTransform: 'uppercase',
    color: '#FFFFFF',
    textAlign: 'center',
    includeFontPadding: false,
  },
  oversizeHero: {
    fontFamily: 'BricolageGrotesque_800ExtraBold',
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -1.8,
    textTransform: 'uppercase',
    color: '#FFFFFF',
    textAlign: 'center',
    includeFontPadding: false,
  },
  oversizeTail: {
    fontFamily: 'BricolageGrotesque_800ExtraBold',
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.8,
    textTransform: 'uppercase',
    color: '#FFFFFF',
    textAlign: 'center',
    includeFontPadding: false,
  },
  rockSaltWrap: {
    marginTop: 8,
    paddingTop: 14,
    paddingBottom: 10,
    overflow: 'visible',
    zIndex: 4,
  },
  rockSaltAccent: {
    fontFamily: 'RockSalt_400Regular',
    fontSize: 26,
    lineHeight: 48,
    color: colors.voltCyan,
    textAlign: 'center',
    overflow: 'visible',
    transform: [{ rotate: '-2deg' }],
  },
  heroBleed: {
    marginHorizontal: -24,
    marginTop: 0,
    marginBottom: -90,
    backgroundColor: 'transparent',
  },
  heroVideoWrap: {
    position: 'relative',
    backgroundColor: 'transparent',
  },
  heroVideo: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.navy,
  },
  heroNavyBuffer: {
    height: HERO_NAVY_BUFFER + TORN_DIVIDER_H,
    backgroundColor: colors.navy,
  },
  heroCurveSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 2,
    elevation: 2,
  },
  heroFadeSvg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    zIndex: 2,
    elevation: 2,
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
