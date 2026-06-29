import React, { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  MASTERCLASS_MAIN_TOPICS,
  MasterclassMainTopic,
  MasterclassMainTopicGroup,
  ShortGameVideo,
  logImageError,
  openYouTubeVideo,
} from '../api';
import { colors } from '../constants/colors';

/** Matches VideoCarousel card/thumbnail sizing on CreatorPage. */
const CARD_WIDTH = 240;
const THUMB_HEIGHT = 135;
const THUMB_RADIUS = 15;

const SECTION_COLORS = {
  background: '#c5d3ea',
  border: '#93a8cc',
  heading: '#0d1730',
  muted: '#3a4d72',
  card: '#ffffff',
};

const DEFAULT_MAIN_TOPIC: MasterclassMainTopic = 'Putting';

function lessonCountLabel(count: number) {
  return count === 1 ? '1 lesson' : `${count} lessons`;
}

function thumbnailUri(video: ShortGameVideo) {
  return (
    video.thumbnailUrl ||
    `https://img.youtube.com/vi/${video.youtubeVideoId}/hqdefault.jpg`
  );
}

function MasterclassVideoCard({ video }: { video: ShortGameVideo }) {
  const thumb = thumbnailUri(video);
  return (
    <TouchableOpacity
      style={styles.videoCard}
      activeOpacity={0.8}
      onPress={() => openYouTubeVideo(video.youtubeVideoId)}
    >
      <Image
        source={{ uri: thumb }}
        style={styles.thumb}
        resizeMode="cover"
        onError={logImageError('short-game-masterclass', thumb)}
      />
      <Text style={styles.videoTitle} numberOfLines={2}>
        {video.title}
      </Text>
      <Text style={styles.channelName} numberOfLines={1}>
        {video.channelName}
      </Text>
    </TouchableOpacity>
  );
}

function TopicCarousel({
  title,
  videos,
}: {
  title: string;
  videos: ShortGameVideo[];
}) {
  if (!videos.length) return null;

  return (
    <View style={styles.topicBlock}>
      <View style={styles.topicHeader}>
        <Text style={styles.topicTitle}>{title}</Text>
        <Text style={styles.lessonCount}>{lessonCountLabel(videos.length)}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {videos.map((video) => (
          <MasterclassVideoCard key={video.id || video.youtubeVideoId} video={video} />
        ))}
      </ScrollView>
    </View>
  );
}

function MainTopicPills({
  selectedMainTopic,
  onSelect,
}: {
  selectedMainTopic: MasterclassMainTopic;
  onSelect: (mainTopic: MasterclassMainTopic) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.pillRow}
      contentContainerStyle={styles.pillRowContent}
    >
      {MASTERCLASS_MAIN_TOPICS.map((mainTopic) => {
        const active = mainTopic === selectedMainTopic;
        return (
          <TouchableOpacity
            key={mainTopic}
            activeOpacity={0.8}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onSelect(mainTopic)}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>
              {mainTopic}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export default function ShortGameMasterclass({
  mainTopics,
}: {
  mainTopics: MasterclassMainTopicGroup[];
}) {
  const [selectedMainTopic, setSelectedMainTopic] =
    useState<MasterclassMainTopic>(DEFAULT_MAIN_TOPIC);

  const hasVideos = mainTopics.some((group) =>
    group.subTopics.some((subTopic) => subTopic.videos.length > 0),
  );
  if (!hasVideos) return null;

  const activeGroup =
    mainTopics.find((group) => group.mainTopic === selectedMainTopic) ??
    mainTopics.find((group) => group.mainTopic === DEFAULT_MAIN_TOPIC);

  return (
    <View style={styles.wrapper}>
      <View style={styles.section}>
        <View style={styles.titleRow}>
          <View style={styles.titleLogoClip}>
            <Image
              source={require('../assets/logo-header-03.png')}
              style={styles.titleLogo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.mainTitle}>Lesson Library</Text>
        </View>
        <Text style={styles.subtitle}>
          We've trawled YouTube for the best golf instruction out there, so you don't have to.
          Hand-picked lessons for every part of your game — just pick a topic below.
        </Text>

        <MainTopicPills
          selectedMainTopic={selectedMainTopic}
          onSelect={setSelectedMainTopic}
        />

        {(activeGroup?.subTopics ?? []).map((subTopic) => (
          <TopicCarousel
            key={subTopic.topic}
            title={subTopic.topic}
            videos={subTopic.videos}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 18,
  },
  pillRow: {
    marginBottom: 14,
  },
  pillRowContent: {
    paddingRight: 4,
  },
  pill: {
    borderWidth: 1,
    borderColor: SECTION_COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 17,
    paddingVertical: 9,
    marginRight: 8,
    backgroundColor: SECTION_COLORS.card,
  },
  pillActive: {
    backgroundColor: SECTION_COLORS.heading,
    borderColor: SECTION_COLORS.heading,
  },
  pillText: {
    fontSize: 15,
    fontWeight: '600',
    color: SECTION_COLORS.heading,
  },
  pillTextActive: {
    color: SECTION_COLORS.card,
  },
  section: {
    backgroundColor: SECTION_COLORS.background,
    borderWidth: 0.5,
    borderColor: SECTION_COLORS.border,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  titleLogoClip: {
    width: 44,
    height: 44,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleLogo: {
    width: 44,
    height: 44,
    transform: [{ scale: 1.85 }],
  },
  mainTitle: {
    fontSize: 25,
    fontWeight: '700',
    color: SECTION_COLORS.heading,
  },
  subtitle: {
    fontSize: 16,
    color: SECTION_COLORS.muted,
    lineHeight: 22,
    marginBottom: 14,
  },
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
    color: SECTION_COLORS.heading,
    marginRight: 8,
  },
  lessonCount: {
    fontSize: 11,
    color: SECTION_COLORS.muted,
    textAlign: 'right',
  },
  videoCard: {
    width: CARD_WIDTH,
    marginRight: 15,
    backgroundColor: SECTION_COLORS.card,
    borderWidth: 0.5,
    borderColor: SECTION_COLORS.border,
    borderRadius: THUMB_RADIUS,
    overflow: 'hidden',
    paddingBottom: 10,
  },
  thumb: {
    width: CARD_WIDTH,
    height: THUMB_HEIGHT,
    backgroundColor: colors.midNavy,
  },
  videoTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: SECTION_COLORS.heading,
    marginTop: 8,
    marginHorizontal: 10,
    lineHeight: 16,
  },
  channelName: {
    fontSize: 10,
    color: SECTION_COLORS.muted,
    marginTop: 4,
    marginHorizontal: 10,
  },
});
