import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  EMPTY_MASTERCLASS_CONTENT,
  MasterclassContent,
  MasterclassMainTopic,
  ShortGameVideo,
  fetchShortGameVideos,
} from '../api';
import { MasterclassVideoCard } from '../components/ShortGameMasterclass';
import HomeHeader from '../components/HomeHeader';
import SectionGlow, { type SectionGlowVariant } from '../components/SectionGlow';
import { sectionTitleStyles } from '../components/SectionTitle';
import TornDivider from '../components/TornDivider';
import { colors } from '../constants/colors';

const TORN_DIVIDER_H = 34;

/** Same labels as the Academy Lesson Library carousel headers. */
const TOPIC_HEADER_COLOR = '#0d1730';
const TOPIC_MUTED_COLOR = '#3a4d72';

type LessonSectionConfig = {
  topic: MasterclassMainTopic;
  scheme: 'light' | 'dark';
  glowVariant: SectionGlowVariant;
};

const LESSON_SECTIONS: LessonSectionConfig[] = [
  { topic: 'Putting', scheme: 'light', glowVariant: 'default' },
  { topic: 'Chipping', scheme: 'dark', glowVariant: 'swapped' },
  { topic: 'Bunker', scheme: 'light', glowVariant: 'default' },
  { topic: 'Pitching', scheme: 'dark', glowVariant: 'swapped' },
  { topic: 'Approach Irons', scheme: 'light', glowVariant: 'default' },
  { topic: 'Hybrids & Woods', scheme: 'dark', glowVariant: 'swapped' },
  { topic: 'Drivers', scheme: 'light', glowVariant: 'default' },
];

function TopicSection({
  scheme,
  tornVariant,
  glowVariant = 'default',
  last,
  children,
}: {
  scheme: 'light' | 'dark';
  tornVariant?: number;
  glowVariant?: SectionGlowVariant;
  last?: boolean;
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
    tornVariant != null ? Math.max(0, size.height - TORN_DIVIDER_H) : size.height;

  return (
    <View
      collapsable={false}
      style={[
        scheme === 'light' ? styles.lightSection : styles.darkSection,
        tornVariant == null && styles.firstSection,
        last && styles.lastSection,
      ]}
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
            glowVariant={glowVariant}
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

function TopicTitle({ topic, scheme }: { topic: string; scheme: 'light' | 'dark' }) {
  return (
    <View>
      <Text
        style={[
          sectionTitleStyles.sectionSubtitle,
          scheme === 'light' && sectionTitleStyles.sectionSubtitleLight,
          styles.topicSubtitle,
        ]}
      >
        CREATOR GOLF
      </Text>
      <View style={sectionTitleStyles.sectionTitleRow}>
        <View
          collapsable={false}
          style={[sectionTitleStyles.sectionTitleBigWrap, styles.topicTitleBigWrap]}
        >
          <Text
            style={[
              sectionTitleStyles.sectionTitleBig,
              scheme === 'light' && sectionTitleStyles.sectionTitleBigLight,
              styles.topicTitleBigText,
            ]}
          >
            {topic}
          </Text>
        </View>
      </View>
    </View>
  );
}

function SubTopicCarousel({
  title,
  videos,
  scheme,
}: {
  title: string;
  videos: ShortGameVideo[];
  scheme: 'light' | 'dark';
}) {
  if (!videos.length) return null;

  const countLabel = videos.length === 1 ? '1 lesson' : `${videos.length} lessons`;
  const dark = scheme === 'dark';

  return (
    <View style={styles.topicBlock}>
      <View style={styles.topicHeader}>
        <Text style={[styles.topicTitle, dark && styles.topicTitleDark]}>{title}</Text>
        <Text style={[styles.lessonCount, dark && styles.lessonCountDark]}>{countLabel}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {videos.map((video) => (
          <MasterclassVideoCard
            key={video.id || video.youtubeVideoId}
            video={video}
            videoSource="short_game_videos"
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default function LessonLibraryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute();
  const showBack = route.name === 'LessonLibrary';
  const [content, setContent] = useState<MasterclassContent>(EMPTY_MASTERCLASS_CONTENT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchShortGameVideos()
      .then((next) => {
        if (cancelled) return;
        setContent(next);
        setError(null);
      })
      .catch((err: unknown) => {
        console.warn('[LessonLibrary] short-game-videos failed:', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load lessons');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.headerWrap}>
        <HomeHeader />
        {showBack ? (
          <TouchableOpacity
            style={[styles.headerBack, { top: insets.top + 8 }]}
            onPress={() => navigation.goBack()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: insets.bottom + 8 }}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageHeader}>
          <Text style={styles.lead}>
            We've trawled YouTube for the best golf instruction out there, so you don't have
            to. Scroll down for every part of your game.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.liveBlue} />
          </View>
        ) : (
          LESSON_SECTIONS.map((section, index) => {
            const group = content.mainTopics.find((row) => row.mainTopic === section.topic);
            const last = index === LESSON_SECTIONS.length - 1;
            return (
              <TopicSection
                key={section.topic}
                scheme={section.scheme}
                glowVariant={section.glowVariant}
                tornVariant={index === 0 ? undefined : index - 1}
                last={last}
              >
                <TopicTitle topic={section.topic} scheme={section.scheme} />
                {error && index === 0 ? <Text style={styles.feedError}>{error}</Text> : null}
                {(group?.subTopics ?? []).map((subTopic) => (
                  <SubTopicCarousel
                    key={subTopic.topic}
                    title={subTopic.topic}
                    videos={subTopic.videos}
                    scheme={section.scheme}
                  />
                ))}
              </TopicSection>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.navy },
  // Small nudge on top of SectionTitle's shared -8 Rock Salt offset (tuned for Home's
  // "Tour"/"Creator" words). Topic names here can start with a tall ascender like "P"
  // (Putting, Pitching), which was getting clipped by the "CREATOR GOLF" subtitle above.
  topicTitleBigWrap: {
    marginTop: -14,
  },
  // Shared SectionTitle style has marginBottom: 6 after "CREATOR GOLF" — tightened just
  // for Academy's titles. Doesn't touch the paddingTop fix above, so the "P"/"A" fixes
  // still hold; this only removes external whitespace around them.
  topicSubtitle: {
    marginBottom: 0,
  },
  // Confirmed: padding on the wrapping View doesn't stop glyph clipping — only padding
  // on the Text's own box does, since that's what actually bounds where a glyph can
  // paint. paddingTop revealed the full ascender on "P"; paddingLeft here does the same
  // for the bottom-left stroke of "A", which was bleeding past the Text's left edge.
  topicTitleBigText: {
    paddingTop: 20,
    paddingLeft: 10,
  },
  headerWrap: {
    position: 'relative',
  },
  headerBack: {
    position: 'absolute',
    left: 8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  scroll: { flex: 1 },
  pageHeader: {
    backgroundColor: colors.navy,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  lead: {
    marginTop: 8,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: '#D6DDE6',
    maxWidth: 340,
  },
  loadingWrap: {
    paddingVertical: 64,
    alignItems: 'center',
    backgroundColor: colors.bg,
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
  firstSection: { paddingTop: 34 },
  lastSection: { paddingBottom: 56 },
  sectionInner: { position: 'relative', overflow: 'visible' },
  tornBleed: { marginHorizontal: -24 },
  topicBlock: {
    marginTop: 12,
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  topicTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: TOPIC_HEADER_COLOR,
    marginRight: 8,
  },
  topicTitleDark: { color: '#FFFFFF' },
  lessonCount: {
    fontSize: 11,
    color: TOPIC_MUTED_COLOR,
    textAlign: 'right',
  },
  lessonCountDark: { color: colors.mutedGrey },
  feedError: {
    color: colors.bogeyRed,
    marginBottom: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
});
