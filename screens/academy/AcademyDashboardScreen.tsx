import React, { useCallback, useState } from 'react';
import {
  Dimensions,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../constants/colors';
import { SHOT_TYPE_STYLE } from '../../constants/academy';
import { SHOT_TYPE_IDS, SHOT_TYPE_LIBRARY } from '../../lib/academy/shotTypeLibrary';
import { fetchDashboard } from '../../lib/academy/api';
import { makeDemoDashboard } from '../../lib/academy/demoData';
import { getAcademyUserId } from '../../lib/academy/userId';
import { openYouTubeVideo } from '../../api';
import TrendChart from '../../components/academy/TrendChart';
import type { DashboardData, ShotTypeId } from '../../lib/academy/types';
import type { AcademyStackParamList } from '../../navigation/academyStackTypes';

type Props = NativeStackScreenProps<AcademyStackParamList, 'AcademyDashboard'>;

const SCREEN_W = Dimensions.get('window').width;
const CARD_W = SCREEN_W - 32;
const CHART_W = CARD_W - 28;

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 1) return 'just now';
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** True when the API returned data but the user hasn't analysed anything yet. */
function isEmpty(data: DashboardData): boolean {
  return SHOT_TYPE_IDS.every((id) => (data.shotTypes[id]?.uploadCount ?? 0) === 0);
}

export default function AcademyDashboardScreen({ navigation }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [empty, setEmpty] = useState(false);

  const load = useCallback(async () => {
    try {
      const userId = await getAcademyUserId();
      const live = await fetchDashboard(userId);
      if (isEmpty(live)) {
        // No history yet: show the demo dashboard so the section reads as
        // designed, clearly badged, with the CTA front and centre.
        setEmpty(true);
        setData(makeDemoDashboard());
      } else {
        setEmpty(false);
        setData(live);
      }
    } catch {
      setEmpty(true);
      setData(makeDemoDashboard());
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const openLastAnalysis = (shotType: ShotTypeId) => {
    const st = data?.shotTypes[shotType];
    if (!st) return;
    if (data?.demo || !st.lastUploadId || st.lastUploadId.startsWith('demo-')) {
      navigation.navigate('SwingAnalysis', { demoShotType: shotType });
    } else {
      navigation.navigate('SwingAnalysis', { uploadId: st.lastUploadId });
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Academy</Text>
            <Text style={styles.subtitle}>Your swing, measured — across every part of the game.</Text>
          </View>
          {data?.demo ? (
            <View style={styles.demoBadge}>
              <Text style={styles.demoBadgeText}>DEMO DATA</Text>
            </View>
          ) : null}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={styles.cta}
          activeOpacity={0.9}
          onPress={() => navigation.navigate('ShotTypeSelect')}
        >
          <View style={styles.ctaIcon}>
            <Ionicons name="videocam" size={24} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Analyze a new swing</Text>
            <Text style={styles.ctaSubtitle}>
              {empty
                ? 'Upload your first video — driving, irons, bunker, chipping or putting.'
                : 'Record or upload, get your checkpoints in under a minute.'}
            </Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={30} color={colors.liveBlue} />
        </TouchableOpacity>

        {/* Recent recommendations */}
        {data?.recentRecommendations?.length ? (
          <>
            <Text style={styles.sectionTitle}>Recommended for your game</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recRow}
            >
              {data.recentRecommendations.map((rec, i) => {
                const accent = SHOT_TYPE_STYLE[rec.shotType]?.accent ?? colors.liveBlue;
                const thumb = rec.youtubeVideoId
                  ? `https://img.youtube.com/vi/${rec.youtubeVideoId}/mqdefault.jpg`
                  : null;
                return (
                  <TouchableOpacity
                    key={`${rec.faultTag}-${i}`}
                    style={styles.recCard}
                    activeOpacity={0.85}
                    onPress={() => rec.youtubeVideoId && openYouTubeVideo(rec.youtubeVideoId)}
                  >
                    {thumb ? (
                      <Image source={{ uri: thumb }} style={styles.recThumb} resizeMode="cover" />
                    ) : (
                      <View style={[styles.recThumb, { backgroundColor: colors.midNavy }]} />
                    )}
                    <View style={styles.recBody}>
                      <Text style={[styles.recShotType, { color: accent }]}>
                        {SHOT_TYPE_LIBRARY[rec.shotType]?.label ?? rec.shotType}
                      </Text>
                      <Text style={styles.recTitle} numberOfLines={2}>
                        {rec.videoTitle ?? 'Recommended lesson'}
                      </Text>
                      <Text style={styles.recCreator} numberOfLines={1}>
                        {rec.creatorName ?? ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        {/* Per-shot-type overview */}
        <Text style={styles.sectionTitle}>Your game by shot type</Text>
        {SHOT_TYPE_IDS.map((id) => {
          const def = SHOT_TYPE_LIBRARY[id];
          const style = SHOT_TYPE_STYLE[id];
          const st = data?.shotTypes[id];
          const hasData = (st?.uploadCount ?? 0) > 0;
          const trendEntries = st ? Object.entries(st.trends).slice(0, 2) : [];

          return (
            <View key={id} style={styles.typeCard}>
              <TouchableOpacity
                style={styles.typeHeader}
                activeOpacity={0.8}
                onPress={() =>
                  hasData ? openLastAnalysis(id) : navigation.navigate('RecordUpload', { shotType: id })
                }
              >
                <View style={[styles.typeIcon, { backgroundColor: `${style.accent}1A` }]}>
                  <Ionicons name={style.icon} size={20} color={style.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.typeTitle}>{def.label}</Text>
                  <Text style={styles.typeMeta}>
                    {hasData
                      ? `${st!.uploadCount} swing${st!.uploadCount === 1 ? '' : 's'} analysed · last ${timeAgo(st!.lastUploadAt)}`
                      : 'Not analysed yet — tap to start'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedGrey} />
              </TouchableOpacity>

              {/* Faults being worked on */}
              {st?.focusFaults?.length ? (
                <View style={styles.focusRow}>
                  <Text style={styles.focusLabel}>Working on</Text>
                  <View style={styles.focusChips}>
                    {st.focusFaults.map((f) => (
                      <View key={f.tag} style={[styles.focusChip, { borderColor: style.accent }]}>
                        <Text style={[styles.focusChipText, { color: style.accent }]} numberOfLines={1}>
                          {f.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Trends */}
              {trendEntries.map(([metricId, points]) => {
                const metricDef = def.metrics.find((m) => m.id === metricId);
                if (!points.length) return null;
                return (
                  <View key={metricId} style={styles.trendBlock}>
                    <Text style={styles.trendLabel}>{metricDef?.label ?? metricId}</Text>
                    <TrendChart
                      points={points}
                      benchmark={metricDef?.benchmark}
                      color={style.accent}
                      width={CHART_W}
                      unit={metricDef?.unit ?? ''}
                    />
                  </View>
                );
              })}
            </View>
          );
        })}

        <Text style={styles.footerNote}>
          Trends track your measured checkpoints per shot type — a driver tempo and a putting
          stroke are different skills, so they're never mixed.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 19,
    color: colors.coolGrey,
    marginTop: 3,
  },
  demoBadge: {
    borderWidth: 1.5,
    borderColor: colors.eagleAmber,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 6,
  },
  demoBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: colors.eagleAmber,
    letterSpacing: 0.8,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.navy,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  ctaIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.liveBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: '#FFFFFF',
  },
  ctaSubtitle: {
    fontSize: 12.5,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: colors.navy,
    marginTop: 22,
    marginBottom: 10,
  },
  recRow: {
    gap: 10,
    paddingRight: 6,
  },
  recCard: {
    width: 210,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  recThumb: {
    width: '100%',
    height: 110,
    backgroundColor: colors.bg,
  },
  recBody: {
    padding: 10,
  },
  recShotType: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.navy,
    lineHeight: 18,
    marginTop: 3,
  },
  recCreator: {
    fontSize: 12,
    color: colors.liveBlue,
    marginTop: 4,
  },
  typeCard: {
    width: CARD_W,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: colors.navy,
  },
  typeMeta: {
    fontSize: 12,
    color: colors.mutedGrey,
    marginTop: 1,
  },
  focusRow: {
    marginTop: 12,
  },
  focusLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: colors.mutedGrey,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  focusChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  focusChip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: CARD_W - 60,
  },
  focusChipText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  trendBlock: {
    marginTop: 12,
  },
  trendLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: colors.coolGrey,
    marginBottom: 4,
  },
  footerNote: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.mutedGrey,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
  },
});
