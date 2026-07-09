import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../constants/colors';
import { CHECK_STATUS_COLOR, SEVERITY_LABEL, SHOT_TYPE_STYLE } from '../../constants/academy';
import { SHOT_TYPE_LIBRARY } from '../../lib/academy/shotTypeLibrary';
import { fetchUploadDetail, pollUploadUntilDone } from '../../lib/academy/api';
import { getLocalVideoUri } from '../../lib/academy/localVideo';
import { cacheDetail, getCachedDetail, getDemoDetail } from '../../lib/academy/detailCache';
import SkeletonOverlay from '../../components/academy/SkeletonOverlay';
import FrameScrubber from '../../components/academy/FrameScrubber';
import type {
  CheckResult,
  IdentifiedFault,
  UploadDetail,
} from '../../lib/academy/types';
import type { AcademyStackParamList } from '../../navigation/academyStackTypes';

type Props = NativeStackScreenProps<AcademyStackParamList, 'SwingAnalysis'>;

const SCREEN_W = Dimensions.get('window').width;
const MAX_VIDEO_H = 440;

/** Which per-frame angle callouts to show, per swing class. */
const CALLOUTS: Record<string, Array<{ key: 'spine' | 'leadArm' | 'shoulderLine' | 'hipLine' | 'kneeFlex'; label: string }>> = {
  full: [
    { key: 'spine', label: 'Spine tilt' },
    { key: 'leadArm', label: 'Lead arm bend' },
    { key: 'shoulderLine', label: 'Shoulder line' },
  ],
  short: [
    { key: 'spine', label: 'Spine tilt' },
    { key: 'leadArm', label: 'Lead arm bend' },
    { key: 'kneeFlex', label: 'Knee flex' },
  ],
  stroke: [
    { key: 'shoulderLine', label: 'Shoulder rock' },
    { key: 'leadArm', label: 'Lead arm bend' },
    { key: 'hipLine', label: 'Hip line' },
  ],
};

function formatBenchmark(check: CheckResult): string {
  return `${check.benchmark.min}–${check.benchmark.max}${check.unit}`;
}

function FaultCard({ fault, accent }: { fault: IdentifiedFault; accent: string }) {
  const sevColor =
    fault.severity >= 3 ? colors.bogeyRed : fault.severity === 2 ? colors.eagleAmber : colors.coolGrey;
  return (
    <View style={styles.faultCard}>
      <View style={styles.faultHeader}>
        <Text style={styles.faultName}>{fault.name}</Text>
        <View style={[styles.sevBadge, { backgroundColor: `${sevColor}22` }]}>
          <Text style={[styles.sevBadgeText, { color: sevColor }]}>
            {SEVERITY_LABEL[fault.severity] ?? 'Work on'}
          </Text>
        </View>
      </View>
      {fault.value != null ? (
        <Text style={styles.faultMeasured}>
          Measured: {fault.metricLabel} {fault.value}
          {fault.unit}
        </Text>
      ) : null}
      <Text style={styles.faultDescription}>{fault.description}</Text>
      <View style={styles.faultTipRow}>
        <Ionicons name="bulb-outline" size={16} color={accent} style={{ marginTop: 2 }} />
        <Text style={styles.faultTip}>{fault.tip}</Text>
      </View>
      <View style={styles.faultTipRow}>
        <Ionicons name="repeat-outline" size={16} color={colors.coolGrey} style={{ marginTop: 2 }} />
        <Text style={styles.faultDrill}>{fault.drill}</Text>
      </View>
    </View>
  );
}

export default function SwingAnalysisScreen({ navigation, route }: Props) {
  const { uploadId, demoShotType } = route.params;

  const [detail, setDetail] = useState<UploadDetail | null>(null);
  const [statusText, setStatusText] = useState('Loading analysis…');
  const [error, setError] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const analysis = detail?.analysis ?? null;
  const jad = analysis?.joint_angle_data ?? null;
  const shotType = analysis?.shot_type ?? detail?.upload.shot_type ?? demoShotType ?? 'driving';
  const def = SHOT_TYPE_LIBRARY[shotType];
  const accent = SHOT_TYPE_STYLE[shotType].accent;

  // ---- data loading -------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (demoShotType) {
        setDetail(getDemoDetail(demoShotType));
        return;
      }
      if (!uploadId) {
        setError('No upload specified.');
        return;
      }
      const cached = getCachedDetail(uploadId);
      if (cached && cached.upload.status === 'complete') {
        setDetail(cached);
        return;
      }
      try {
        const first = await fetchUploadDetail(uploadId);
        if (cancelled) return;
        if (first.upload.status === 'complete' || first.upload.status === 'failed') {
          cacheDetail(first);
          setDetail(first);
          return;
        }
        setStatusText('Tracking your body position frame by frame…');
        const done = await pollUploadUntilDone(uploadId, (tick) => {
          if (!cancelled && tick.upload.status === 'processing') {
            setStatusText('Measuring checkpoints and looking for faults…');
          }
        });
        if (!cancelled) {
          cacheDetail(done);
          setDetail(done);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load analysis');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [uploadId, demoShotType]);

  // ---- video + playback sync ----------------------------------------------
  // Raw video is never stored server-side; playback uses the on-device copy.
  // When it's missing (reinstall, new device) the saved analysis still renders
  // as skeleton-only playback.
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [localChecked, setLocalChecked] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (!uploadId || demoShotType) {
      setLocalChecked(true);
      return undefined;
    }
    getLocalVideoUri(uploadId).then((uri) => {
      if (!cancelled) {
        setLocalUri(uri);
        setLocalChecked(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [uploadId, demoShotType]);

  const videoUrl = localUri;
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.05;
    p.muted = true;
  });

  const frames = jad?.frames ?? [];
  const frameCount = frames.length;

  const nearestFrame = useCallback(
    (t: number) => {
      if (!frameCount || !jad) return 0;
      // Frame timestamps are absolute video times and may not start at 0
      // (the backend re-samples just the swing window on long clips).
      const baseT = jad.frames[0]?.t ?? 0;
      const idx = Math.round((t - baseT) * jad.fps);
      return Math.max(0, Math.min(frameCount - 1, idx));
    },
    [frameCount, jad],
  );

  useEffect(() => {
    if (!videoUrl) return undefined;
    const sub = player.addListener('timeUpdate', (payload) => {
      setFrameIndex(nearestFrame(payload.currentTime));
    });
    const endSub = player.addListener('playToEnd', () => setPlaying(false));
    return () => {
      sub.remove();
      endSub.remove();
    };
  }, [player, videoUrl, nearestFrame]);

  // Skeleton-only playback (demo mode / missing video): timer at capture fps.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (videoUrl || !playing || !jad) return undefined;
    timerRef.current = setInterval(() => {
      setFrameIndex((i) => {
        if (i >= frameCount - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 1000 / jad.fps);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing, videoUrl, jad, frameCount]);

  const onScrub = useCallback(
    (index: number, fromDrag: boolean) => {
      setFrameIndex(index);
      if (fromDrag) {
        setPlaying(false);
        if (videoUrl && frames[index]) {
          player.pause();
          player.currentTime = frames[index].t;
        }
      }
    },
    [videoUrl, frames, player],
  );

  const togglePlay = useCallback(() => {
    if (videoUrl) {
      if (playing) player.pause();
      else {
        if (frameIndex >= frameCount - 1) player.currentTime = 0;
        player.play();
      }
      setPlaying(!playing);
    } else {
      if (!playing && frameIndex >= frameCount - 1) setFrameIndex(0);
      setPlaying(!playing);
    }
  }, [videoUrl, playing, player, frameIndex, frameCount]);

  // ---- layout ---------------------------------------------------------------
  const aspect = jad?.video_aspect || 9 / 16;
  const videoW = Math.min(SCREEN_W - 32, MAX_VIDEO_H * aspect);
  const videoH = videoW / aspect;

  const callouts = useMemo(() => CALLOUTS[def.swingClass] ?? CALLOUTS.full, [def.swingClass]);
  const currentAngles = jad?.per_frame_angles?.[frameIndex] ?? null;

  // ---- render ---------------------------------------------------------------
  if (error || detail?.upload.status === 'failed') {
    const message = error ?? detail?.upload.error_message ?? 'Analysis failed.';
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <Header navigation={navigation} title={`${def.label} Analysis`} accent={accent} demo={false} />
        <View style={styles.centerPane}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.bogeyRed} />
          <Text style={styles.errorTitle}>Couldn't analyse that swing</Text>
          <Text style={styles.errorText}>{message}</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: accent }]} onPress={() => navigation.goBack()}>
            <Text style={styles.retryButtonText}>Try another video</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!detail || !analysis || !jad) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <Header navigation={navigation} title={`${def.label} Analysis`} accent={accent} demo={false} />
        <View style={styles.centerPane}>
          <ActivityIndicator size="large" color={accent} />
          <Text style={styles.loadingText}>{statusText}</Text>
          <Text style={styles.loadingHint}>
            Pose tracking runs on the server — this usually takes under a minute.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const faults = analysis.identified_faults ?? [];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <Header
        navigation={navigation}
        title={`${def.label} Analysis`}
        accent={accent}
        demo={Boolean(detail.demo)}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Video + skeleton overlay */}
        <View style={[styles.videoWrap, { width: videoW, height: videoH }]}>
          {videoUrl ? (
            <VideoView
              player={player}
              style={{ width: videoW, height: videoH }}
              contentFit="cover"
              nativeControls={false}
            />
          ) : (
            <View style={[styles.skeletonBg, { width: videoW, height: videoH }]} />
          )}
          <SkeletonOverlay
            frame={frames[frameIndex] ?? null}
            edges={jad.skeleton_edges}
            width={videoW}
            height={videoH}
            color={accent}
          />
          {currentAngles ? (
            <View style={styles.calloutCard}>
              {callouts.map((c) => {
                const v = currentAngles[c.key];
                return (
                  <View key={c.key} style={styles.calloutRow}>
                    <Text style={styles.calloutLabel}>{c.label}</Text>
                    <Text style={styles.calloutValue}>{v == null ? '—' : `${v}°`}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          {jad.tracking_quality === 'low' ? (
            <View style={styles.qualityBadge}>
              <Ionicons name="warning-outline" size={12} color="#FFFFFF" />
              <Text style={styles.qualityBadgeText}>Low tracking confidence</Text>
            </View>
          ) : null}
        </View>

        {/* Missing local video notice (analysis still fully usable) */}
        {!detail.demo && localChecked && !localUri ? (
          <View style={styles.noticeCard}>
            <Ionicons name="phone-portrait-outline" size={16} color={colors.coolGrey} />
            <Text style={styles.noticeText}>
              The original video only lives on the phone that recorded it, so it can't be shown
              here — your full analysis is saved and plays as the tracked skeleton instead.
            </Text>
          </View>
        ) : null}

        {/* Scrubber */}
        <View style={styles.card}>
          <FrameScrubber
            frameCount={frameCount}
            index={frameIndex}
            onIndexChange={onScrub}
            keyframes={jad.keyframes}
            phases={def.phases}
            playing={playing}
            onTogglePlay={togglePlay}
            accent={accent}
          />
        </View>

        {/* Coaching summary */}
        {analysis.coaching?.summary ? (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={accent} />
              <Text style={styles.cardTitle}>Coach's read</Text>
            </View>
            <Text style={styles.coachSummary}>{analysis.coaching.summary}</Text>
          </View>
        ) : null}

        {/* Tempo */}
        {analysis.tempo_ratio != null ? (
          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="timer-outline" size={18} color={accent} />
              <Text style={styles.cardTitle}>Tempo</Text>
              <Text style={[styles.tempoValue, { color: accent }]}>{analysis.tempo_ratio}:1</Text>
            </View>
            <Text style={styles.tempoLabel}>{def.tempo.label}</Text>
          </View>
        ) : null}

        {/* Checkpoints */}
        <Text style={styles.sectionTitle}>Checkpoints</Text>
        {analysis.checkpoint_results.map((cp) => {
          const kf = jad.keyframes[cp.phase];
          if (!cp.checks.length) return null;
          return (
            <View key={cp.phase} style={styles.card}>
              <TouchableOpacity
                style={styles.cardTitleRow}
                onPress={() => kf && onScrub(kf.index, true)}
                activeOpacity={0.7}
              >
                <Text style={styles.cardTitle}>{cp.label}</Text>
                {kf ? <Ionicons name="film-outline" size={16} color={colors.mutedGrey} /> : null}
              </TouchableOpacity>
              {cp.checks.map((check) => (
                <View key={check.metric} style={styles.checkRow}>
                  <View
                    style={[styles.statusDot, { backgroundColor: CHECK_STATUS_COLOR[check.status] }]}
                  />
                  <View style={styles.checkBody}>
                    <Text style={styles.checkLabel}>{check.label}</Text>
                    <Text style={styles.checkBenchmark}>Good range: {formatBenchmark(check)}</Text>
                  </View>
                  <Text
                    style={[
                      styles.checkValue,
                      { color: CHECK_STATUS_COLOR[check.status] },
                    ]}
                  >
                    {check.value == null ? '—' : `${check.value}${check.unit}`}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}

        {/* Faults */}
        <Text style={styles.sectionTitle}>
          {faults.length ? `Faults found (${faults.length})` : 'No faults found'}
        </Text>
        {faults.length ? (
          faults.map((fault) => <FaultCard key={fault.tag} fault={fault} accent={accent} />)
        ) : (
          <View style={styles.card}>
            <Text style={styles.coachSummary}>
              Everything we measure for a {def.label.toLowerCase()} checked out. Keep grooving it.
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: accent }]}
            onPress={() =>
              navigation.navigate('CompareSwings', {
                shotType,
                uploadId: detail.demo ? undefined : detail.upload.id,
                demoShotType: detail.demo ? shotType : undefined,
              })
            }
          >
            <Ionicons name="git-compare-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Compare</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() =>
              navigation.navigate('Recommendations', {
                shotType,
                uploadId: detail.demo ? undefined : detail.upload.id,
                demoShotType: detail.demo ? shotType : undefined,
              })
            }
          >
            <Ionicons name="play-circle-outline" size={18} color={colors.navy} />
            <Text style={[styles.actionButtonText, { color: colors.navy }]}>
              Fix it with videos{faults.length ? ` (${Math.min(faults.length, 5)})` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({
  navigation,
  title,
  accent,
  demo,
}: {
  navigation: Props['navigation'];
  title: string;
  accent: string;
  demo: boolean;
}) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={24} color={colors.navy} />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      {demo ? (
        <View style={[styles.demoBadge, { borderColor: accent }]}>
          <Text style={[styles.demoBadgeText, { color: accent }]}>DEMO</Text>
        </View>
      ) : null}
    </View>
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
  demoBadge: {
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 10,
  },
  demoBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.8,
  },
  scroll: {
    paddingBottom: 30,
    alignItems: 'center',
  },
  centerPane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: colors.navy,
    textAlign: 'center',
  },
  loadingHint: {
    fontSize: 13,
    color: colors.mutedGrey,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: colors.navy,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.coolGrey,
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  videoWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.navy,
    marginTop: 8,
  },
  skeletonBg: {
    backgroundColor: colors.navy,
  },
  calloutCard: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(11,22,41,0.72)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
    minWidth: 128,
  },
  calloutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  calloutLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
  },
  calloutValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  qualityBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(232,68,68,0.85)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qualityBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
  },
  card: {
    width: SCREEN_W - 32,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 12,
  },
  noticeCard: {
    width: SCREEN_W - 32,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginTop: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.coolGrey,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: colors.navy,
  },
  coachSummary: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.coolGrey,
    marginTop: 8,
  },
  tempoValue: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  tempoLabel: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.mutedGrey,
    marginTop: 6,
  },
  sectionTitle: {
    width: SCREEN_W - 32,
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: colors.navy,
    marginTop: 20,
    marginBottom: 2,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.bg,
    marginTop: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  checkBody: {
    flex: 1,
  },
  checkLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.navy,
  },
  checkBenchmark: {
    fontSize: 12,
    color: colors.mutedGrey,
    marginTop: 1,
  },
  checkValue: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  faultCard: {
    width: SCREEN_W - 32,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 12,
  },
  faultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  faultName: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: colors.navy,
  },
  sevBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sevBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
  },
  faultMeasured: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: colors.mutedGrey,
    marginTop: 4,
  },
  faultDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.coolGrey,
    marginTop: 8,
  },
  faultTipRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  faultTip: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.navy,
  },
  faultDrill: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.coolGrey,
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    width: SCREEN_W - 32,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 14,
  },
  actionButtonSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
  },
});
