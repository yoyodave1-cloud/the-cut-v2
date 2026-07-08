import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../constants/colors';
import { SHOT_TYPE_STYLE } from '../../constants/academy';
import { SHOT_TYPE_LIBRARY } from '../../lib/academy/shotTypeLibrary';
import { fetchUploadDetail } from '../../lib/academy/api';
import { cacheDetail, getCachedDetail, getDemoDetail } from '../../lib/academy/detailCache';
import { openYouTubeVideo } from '../../api';
import type { IdentifiedFault, Recommendation } from '../../lib/academy/types';
import type { AcademyStackParamList } from '../../navigation/academyStackTypes';

type Props = NativeStackScreenProps<AcademyStackParamList, 'Recommendations'>;

const SCREEN_W = Dimensions.get('window').width;

function RecommendationCard({
  rec,
  fault,
  accent,
}: {
  rec: Recommendation;
  fault: IdentifiedFault | undefined;
  accent: string;
}) {
  const thumb = rec.youtube_video_id
    ? `https://img.youtube.com/vi/${rec.youtube_video_id}/hqdefault.jpg`
    : null;
  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => rec.youtube_video_id && openYouTubeVideo(rec.youtube_video_id)}
    >
      <View style={[styles.faultBanner, { backgroundColor: `${accent}14` }]}>
        <Ionicons name="flag-outline" size={14} color={accent} />
        <Text style={[styles.faultBannerText, { color: accent }]} numberOfLines={1}>
          {fault?.name ?? rec.fault_tag}
        </Text>
      </View>
      <View style={styles.videoRow}>
        {thumb ? (
          <Image source={{ uri: thumb }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, { backgroundColor: colors.midNavy }]} />
        )}
        <View style={styles.videoBody}>
          <Text style={styles.videoTitle} numberOfLines={3}>
            {rec.video_title ?? 'Recommended lesson'}
          </Text>
          <View style={styles.creatorRow}>
            {rec.creator_avatar ? (
              <Image source={{ uri: rec.creator_avatar }} style={styles.creatorAvatar} />
            ) : null}
            <Text style={styles.creatorName} numberOfLines={1}>
              {rec.creator_name ?? 'The Cut creator'}
            </Text>
            <Ionicons name="logo-youtube" size={14} color={colors.bogeyRed} />
          </View>
        </View>
      </View>
      <View style={styles.reasonRow}>
        <Ionicons name="sparkles-outline" size={15} color={colors.coolGrey} style={{ marginTop: 2 }} />
        <Text style={styles.reasonText}>{rec.reason}</Text>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Faults from the analysis matched to lessons from The Cut's own creator
 * library — fault name -> matched video -> why this helps.
 */
export default function RecommendationsScreen({ navigation, route }: Props) {
  const { shotType, uploadId, demoShotType } = route.params;
  const def = SHOT_TYPE_LIBRARY[shotType];
  const accent = SHOT_TYPE_STYLE[shotType].accent;

  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [faults, setFaults] = useState<IdentifiedFault[]>([]);

  useEffect(() => {
    async function load() {
      if (demoShotType) {
        const demo = getDemoDetail(demoShotType);
        setRecommendations(demo.recommendations);
        setFaults(demo.analysis?.identified_faults ?? []);
        return;
      }
      if (!uploadId) {
        setRecommendations([]);
        return;
      }
      try {
        const cached = getCachedDetail(uploadId);
        const detail = cached ?? (await fetchUploadDetail(uploadId));
        cacheDetail(detail);
        setRecommendations(detail.recommendations ?? []);
        setFaults(detail.analysis?.identified_faults ?? []);
      } catch {
        setRecommendations([]);
      }
    }
    load();
  }, [uploadId, demoShotType]);

  const faultByTag = Object.fromEntries(faults.map((f) => [f.tag, f]));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.navy} />
        </TouchableOpacity>
        <Text style={styles.title}>Fix it with videos</Text>
      </View>
      <Text style={styles.subtitle}>
        Lessons from The Cut's creator library, matched to the faults found in your{' '}
        {def.label.toLowerCase()}.
      </Text>

      {recommendations == null ? (
        <View style={styles.centerPane}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      ) : recommendations.length === 0 ? (
        <View style={styles.centerPane}>
          <Ionicons name="checkmark-circle-outline" size={40} color={colors.birdieGreen} />
          <Text style={styles.emptyTitle}>Nothing to fix right now</Text>
          <Text style={styles.emptyText}>
            No faults were flagged in this analysis, so there's nothing to match videos against.
            Upload another swing to keep tracking your progress.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {recommendations.map((rec) => (
            <RecommendationCard
              key={`${rec.fault_tag}-${rec.rank}`}
              rec={rec}
              fault={faultByTag[rec.fault_tag]}
              accent={accent}
            />
          ))}
          <Text style={styles.footerNote}>
            Recommendations are matched per shot type from The Cut's tracked creators — not
            generic stock instruction.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.coolGrey,
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
  },
  centerPane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: colors.navy,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.coolGrey,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 12,
  },
  card: {
    width: SCREEN_W - 32,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  faultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  faultBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
  },
  videoRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  thumb: {
    width: 132,
    height: 76,
    borderRadius: 8,
    backgroundColor: colors.bg,
  },
  videoBody: {
    flex: 1,
    justifyContent: 'space-between',
  },
  videoTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.navy,
    lineHeight: 19,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  creatorAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  creatorName: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: colors.liveBlue,
  },
  reasonRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  reasonText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: colors.coolGrey,
  },
  footerNote: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.mutedGrey,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 12,
  },
});
