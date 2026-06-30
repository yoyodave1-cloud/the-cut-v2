import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ArticleReaderProvider } from '../ArticleReader';
import {
  Article,
  EMPTY_MASTERCLASS_CONTENT,
  MasterclassContent,
  VideoItem,
  fetchCreatorFeaturedVideos,
  fetchCreatorPageNews,
  fetchShortGameVideos,
} from '../api';
import { THE_FEED_CARD_TAG } from '../lib/theFeedColumn';
import { normalizeNewsTitleKey } from '../lib/creatorNewsFilter';
import HotRightNowCard from '../components/cards/HotRightNowCard';
import { NewsCardCompact, TrendingList } from '../components/FeedNewsCards';
import HomeHeader from '../components/HomeHeader';
import ShortGameMasterclass from '../components/ShortGameMasterclass';
import TopCreatorsList from '../components/TopCreatorsList';
import { VideoCarousel } from '../components/VideoFeedCards';
import { colors } from '../constants/colors';

const CREATOR_NEWS_TAG = 'Creator';
const COMPACT_NEWS_COUNT = 3;
const TRENDING_NEWS_COUNT = 4;

/** Set true to re-enable compact news cards between Featured and Trending. */
const SHOW_COMPACT_NEWS_CARDS = true;

export default function CreatorPage() {
  const [featuredVideos, setFeaturedVideos] = useState<VideoItem[]>([]);
  const [compactNews, setCompactNews] = useState<Article[]>([]);
  const [trendingNews, setTrendingNews] = useState<Article[]>([]);
  const [masterclassContent, setMasterclassContent] =
    useState<MasterclassContent>(EMPTY_MASTERCLASS_CONTENT);
  const [pinnedFeedUrl, setPinnedFeedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [videos, shortGameResult] = await Promise.all([
          fetchCreatorFeaturedVideos(),
          fetchShortGameVideos().catch((err) => {
            console.warn('[CreatorPage] short-game-videos failed:', err);
            return EMPTY_MASTERCLASS_CONTENT;
          }),
        ]);
        if (cancelled) return;

        setFeaturedVideos(videos);
        setMasterclassContent(shortGameResult);

        const excludeTitleKeys = new Set(
          videos.map((video) => normalizeNewsTitleKey(video.title)),
        );
        const news = await fetchCreatorPageNews(
          COMPACT_NEWS_COUNT,
          TRENDING_NEWS_COUNT,
          { excludeTitleKeys },
        );

        if (cancelled) return;

        setCompactNews(news.compact);
        setTrendingNews(news.trending);
        setPinnedFeedUrl(news.pinnedFeedUrl);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          console.warn('[CreatorPage] load failed:', e);
          setError(e instanceof Error ? e.message : 'Failed to load creator content');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ArticleReaderProvider>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.liveBlue} />
            <Text style={styles.loadingText}>Loading creators…</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <HomeHeader />

            <View style={styles.feedSections}>
              {error ? <Text style={styles.feedError}>Couldn't reach the backend: {error}</Text> : null}

              {featuredVideos.length > 0 ? (
                <VideoCarousel
                  videos={featuredVideos}
                  tag="Creator"
                  title="Featured Creator Podcasts"
                  subtitle="Latest from top golf podcasts"
                />
              ) : null}

              <HotRightNowCard />

              {SHOW_COMPACT_NEWS_CARDS
                ? compactNews.map((article, index) => (
                    <NewsCardCompact
                      key={article.url || `${article.title}-${article.publishedAt}-${index}`}
                      article={article}
                      tag={
                        pinnedFeedUrl && article.url === pinnedFeedUrl
                          ? THE_FEED_CARD_TAG
                          : CREATOR_NEWS_TAG
                      }
                    />
                  ))
                : null}

              {trendingNews.length > 0 ? (
                <TrendingList articles={trendingNews} title="Trending in Creator Golf" />
              ) : null}

              <ShortGameMasterclass mainTopics={masterclassContent.mainTopics} />
            </View>

            <TopCreatorsList />
          </ScrollView>
        )}
      </SafeAreaView>
    </ArticleReaderProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: { color: colors.coolGrey, fontSize: 14 },
  scrollContent: { paddingBottom: 24 },
  feedSections: { paddingHorizontal: 16 },
  feedError: { color: colors.bogeyRed, marginBottom: 12 },
});
