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
import { SHOT_TYPE_STYLE } from '../../constants/academy';
import { SHOT_TYPE_LIBRARY } from '../../lib/academy/shotTypeLibrary';
import { fetchUploadDetail, fetchUploads } from '../../lib/academy/api';
import { getLocalVideoUri } from '../../lib/academy/localVideo';
import { cacheDetail, getCachedDetail, getDemoDetail } from '../../lib/academy/detailCache';
import { makeDemoSequence } from '../../lib/academy/demoData';
import { getAcademyUserId } from '../../lib/academy/userId';
import SkeletonOverlay from '../../components/academy/SkeletonOverlay';
import {
  averageDeviations,
  deviationPerKeypoint,
  normalizeSequence,
} from '../../lib/academy/poseNormalize';
import type { JointAngleData, PoseFrame, SessionSummary } from '../../lib/academy/types';
import type { AcademyStackParamList } from '../../navigation/academyStackTypes';

type Props = NativeStackScreenProps<AcademyStackParamList, 'CompareSwings'>;

const SCREEN_W = Dimensions.get('window').width;
const PANE_W = (SCREEN_W - 32 - 8) / 2;
const OVERLAY_W = SCREEN_W - 32;
const PHASE_ORDER = ['address', 'takeaway', 'top', 'impact', 'finish'];

const clampIndex = (i: number, len: number) => Math.max(0, Math.min(len - 1, i));

/** Anchor keyframes present in a sequence, in canonical phase order. */
function anchorsOf(jad: JointAngleData) {
  return PHASE_ORDER.filter((p) => jad.keyframes[p]).map((p) => ({
    phase: p,
    t: jad.keyframes[p].t,
    index: jad.keyframes[p].index,
  }));
}

/**
 * Map normalized progress u (0..1) to a frame index via phase-aligned
 * piecewise-linear interpolation, so address/top/impact line up on both
 * sides even when the two swings have different tempos.
 */
function frameAtU(jad: JointAngleData, sharedPhases: string[], u: number): number {
  const anchors = sharedPhases
    .filter((p) => jad.keyframes[p])
    .map((p) => jad.keyframes[p]);
  if (anchors.length < 2) {
    return Math.round(u * (jad.frames.length - 1));
  }
  const segments = anchors.length - 1;
  const scaled = Math.min(0.9999, Math.max(0, u)) * segments;
  const s = Math.floor(scaled);
  const local = scaled - s;
  const t = anchors[s].t + (anchors[s + 1].t - anchors[s].t) * local;
  // Frame timestamps are absolute video times (may not start at 0).
  const baseT = jad.frames[0]?.t ?? 0;
  return Math.max(0, Math.min(jad.frames.length - 1, Math.round((t - baseT) * jad.fps)));
}

type PaneData = {
  label: string;
  jad: JointAngleData;
  videoUrl: string | null;
  accent: string;
};

function ComparePane({
  pane,
  frameIndex,
  height,
}: {
  pane: PaneData;
  frameIndex: number;
  height: number;
}) {
  const player = useVideoPlayer(pane.videoUrl, (p) => {
    p.muted = true;
    p.pause();
  });
  const frame = pane.jad.frames[frameIndex] ?? null;

  // Seek the paused video to the scrubbed frame (throttled by frame change).
  const lastSeek = useRef(-1);
  useEffect(() => {
    if (!pane.videoUrl || !frame) return;
    if (Math.abs(frame.t - lastSeek.current) < 0.02) return;
    lastSeek.current = frame.t;
    player.currentTime = frame.t;
  }, [frame, pane.videoUrl, player]);

  return (
    <View style={[styles.pane, { height }]}>
      {pane.videoUrl ? (
        <VideoView
          player={player}
          style={{ width: PANE_W, height }}
          contentFit="cover"
          nativeControls={false}
        />
      ) : (
        <View style={[styles.paneBg, { width: PANE_W, height }]} />
      )}
      <SkeletonOverlay
        frame={frame}
        edges={pane.jad.skeleton_edges}
        width={PANE_W}
        height={height}
        color={pane.accent}
      />
      <View style={styles.paneLabel}>
        <Text style={styles.paneLabelText}>{pane.label}</Text>
      </View>
    </View>
  );
}

export default function CompareSwingsScreen({ navigation, route }: Props) {
  const { shotType, uploadId, demoShotType } = route.params;
  const def = SHOT_TYPE_LIBRARY[shotType];
  const accent = SHOT_TYPE_STYLE[shotType].accent;

  const [leftJad, setLeftJad] = useState<JointAngleData | null>(null);
  const [leftVideo, setLeftVideo] = useState<string | null>(null);
  const [refJad, setRefJad] = useState<JointAngleData | null>(null);
  const [refVideo, setRefVideo] = useState<string | null>(null);
  const [refChoice, setRefChoice] = useState<'ideal' | string>('ideal');
  const [history, setHistory] = useState<SessionSummary[]>([]);
  const [loadingRef, setLoadingRef] = useState(false);
  const [u, setU] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<'overlay' | 'side'>('overlay');

  // Load "your swing" side.
  useEffect(() => {
    async function load() {
      if (demoShotType) {
        const demo = getDemoDetail(demoShotType);
        setLeftJad(demo.analysis?.joint_angle_data ?? null);
        setLeftVideo(null);
        return;
      }
      if (!uploadId) return;
      const cached = getCachedDetail(uploadId);
      const detail = cached ?? (await fetchUploadDetail(uploadId).catch(() => null));
      if (detail?.analysis) {
        cacheDetail(detail);
        setLeftJad(detail.analysis.joint_angle_data);
        setLeftVideo(await getLocalVideoUri(uploadId));
      }
    }
    load();
  }, [uploadId, demoShotType]);

  // Ideal reference is always available.
  const idealJad = useMemo(() => makeDemoSequence(shotType, 'ideal'), [shotType]);
  useEffect(() => {
    if (refChoice === 'ideal') {
      setRefJad(idealJad);
      setRefVideo(null);
    }
  }, [refChoice, idealJad]);

  // Previous uploads of the same shot type for progress comparison.
  useEffect(() => {
    async function loadHistory() {
      try {
        const userId = await getAcademyUserId();
        const uploads = await fetchUploads(userId, shotType);
        setHistory(uploads.filter((up) => up.status === 'complete' && up.id !== uploadId).slice(0, 5));
      } catch {
        setHistory([]);
      }
    }
    loadHistory();
  }, [shotType, uploadId]);

  const selectReference = useCallback(
    async (choice: 'ideal' | string) => {
      setRefChoice(choice);
      if (choice === 'ideal') return;
      setLoadingRef(true);
      try {
        const cached = getCachedDetail(choice);
        const detail = cached ?? (await fetchUploadDetail(choice));
        if (detail.analysis) {
          cacheDetail(detail);
          setRefJad(detail.analysis.joint_angle_data);
          setRefVideo(await getLocalVideoUri(choice));
        }
      } catch {
        setRefChoice('ideal');
      } finally {
        setLoadingRef(false);
      }
    },
    [],
  );

  // Shared phases between both sides drive the sync mapping.
  const sharedPhases = useMemo(() => {
    if (!leftJad || !refJad) return PHASE_ORDER;
    const leftSet = new Set(anchorsOf(leftJad).map((a) => a.phase));
    return anchorsOf(refJad)
      .map((a) => a.phase)
      .filter((p) => leftSet.has(p));
  }, [leftJad, refJad]);

  // Overlay mode: mirror the user when handedness differs from the reference,
  // then pre-normalize both sequences (hip-anchored, torso-rescaled) so the
  // two figures are spatially comparable regardless of framing or height.
  const mirror = !!leftJad && !!refJad && leftJad.lead_side !== refJad.lead_side;
  const userNorm = useMemo(
    () => (leftJad ? normalizeSequence(leftJad.frames, mirror) : []),
    [leftJad, mirror],
  );
  const refNorm = useMemo(
    () => (refJad ? normalizeSequence(refJad.frames, false) : []),
    [refJad],
  );

  // Playback: advance u so the LEFT side's swing plays at natural speed.
  useEffect(() => {
    if (!playing || !leftJad) return undefined;
    const stepMs = 1000 / 30;
    const anchors = sharedPhases.filter((p) => leftJad.keyframes[p]).map((p) => leftJad.keyframes[p]);
    const swingDur =
      anchors.length >= 2 ? anchors[anchors.length - 1].t - anchors[0].t : leftJad.duration;
    const du = swingDur > 0 ? stepMs / 1000 / swingDur : 0.02;
    const id = setInterval(() => {
      setU((prev) => {
        if (prev >= 1) {
          setPlaying(false);
          return 1;
        }
        return Math.min(1, prev + du);
      });
    }, stepMs);
    return () => clearInterval(id);
  }, [playing, leftJad, sharedPhases]);

  const leftIndex = leftJad ? frameAtU(leftJad, sharedPhases, u) : 0;
  const refIndex = refJad ? frameAtU(refJad, sharedPhases, u) : 0;

  const leftAspect = leftJad?.video_aspect || 9 / 16;
  const paneH = Math.min(PANE_W / leftAspect, 360);

  // Scrubber track
  const [trackWidth, setTrackWidth] = useState(0);
  const trackRef = useRef<View>(null);
  const trackX = useRef(0);
  const setFromPageX = useCallback(
    (pageX: number) => {
      if (trackWidth <= 0) return;
      setPlaying(false);
      setU(Math.max(0, Math.min(1, (pageX - trackX.current) / trackWidth)));
    },
    [trackWidth],
  );

  if (!leftJad || !refJad) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.navy} />
          </TouchableOpacity>
          <Text style={styles.title}>Compare</Text>
        </View>
        <View style={styles.centerPane}>
          <ActivityIndicator size="large" color={accent} />
        </View>
      </SafeAreaView>
    );
  }

  const segments = Math.max(1, sharedPhases.length - 1);

  // Overlay pane is a square canvas so x/y scale uniformly (normalized poses
  // are not tied to the video aspect); capped by the same max as the panes.
  const overlayH = Math.min(OVERLAY_W, 360);
  const userNF: PoseFrame | null = userNorm[leftIndex] ?? null;
  const refNF: PoseFrame | null = refNorm[refIndex] ?? null;

  // 3-frame moving average of per-keypoint deviation, to stop colours flickering
  // frame-to-frame on tracking jitter.
  const devWindows: (number | null)[][] = [];
  for (const o of [-1, 0, 1]) {
    const uf = userNorm[clampIndex(leftIndex + o, userNorm.length)];
    const rf = refNorm[clampIndex(refIndex + o, refNorm.length)];
    if (uf && rf) devWindows.push(deviationPerKeypoint(uf, rf));
  }
  const smoothedDev = devWindows.length ? averageDeviations(devWindows) : undefined;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.navy} />
        </TouchableOpacity>
        <Text style={styles.title}>Compare · {def.label}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Overlay / side-by-side toggle */}
        <View style={styles.modeToggle}>
          {(['overlay', 'side'] as const).map((m) => {
            const active = mode === m;
            return (
              <TouchableOpacity
                key={m}
                style={[styles.modeOption, active && { backgroundColor: accent }]}
                onPress={() => setMode(m)}
              >
                <Text style={[styles.modeText, active && styles.modeTextActive]}>
                  {m === 'overlay' ? 'Overlay' : 'Side by side'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Reference selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.refRow}>
          <TouchableOpacity
            style={[styles.refChip, refChoice === 'ideal' && { backgroundColor: accent, borderColor: accent }]}
            onPress={() => selectReference('ideal')}
          >
            <Text style={[styles.refChipText, refChoice === 'ideal' && styles.refChipTextActive]}>
              Good position
            </Text>
          </TouchableOpacity>
          {history.map((up) => {
            const active = refChoice === up.id;
            const date = new Date(up.created_at);
            const label = `${date.getDate()}/${date.getMonth() + 1}`;
            return (
              <TouchableOpacity
                key={up.id}
                style={[styles.refChip, active && { backgroundColor: accent, borderColor: accent }]}
                onPress={() => selectReference(up.id)}
              >
                <Text style={[styles.refChipText, active && styles.refChipTextActive]}>
                  My swing · {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Overlay: both figures on one navy pane, user coloured by deviation */}
        {mode === 'overlay' && (
          <>
            <View style={[styles.pane, styles.overlayPane, { width: OVERLAY_W, height: overlayH }]}>
              {loadingRef ? (
                <ActivityIndicator color={accent} />
              ) : (
                <View style={{ width: overlayH, height: overlayH }}>
                  {/* Reference: recessive grey, no deviation colouring */}
                  <SkeletonOverlay
                    frame={refNF}
                    edges={refJad.skeleton_edges}
                    width={overlayH}
                    height={overlayH}
                    color="rgba(138,155,176,0.85)"
                  />
                  {/* User: coloured per-limb by deviation from the reference */}
                  <SkeletonOverlay
                    frame={userNF}
                    edges={leftJad.skeleton_edges}
                    width={overlayH}
                    height={overlayH}
                    color={accent}
                    deviations={smoothedDev}
                  />
                </View>
              )}
              <View style={styles.paneLabel}>
                <Text style={styles.paneLabelText}>You vs reference</Text>
              </View>
            </View>
            <View style={styles.legendRow}>
              {[
                { c: colors.birdieGreen, t: 'On track' },
                { c: colors.eagleAmber, t: 'Drifting' },
                { c: colors.bogeyRed, t: 'Off position' },
                { c: colors.coolGrey, t: 'Not tracked' },
              ].map((item) => (
                <View key={item.t} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.c }]} />
                  <Text style={styles.legendText}>{item.t}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Side by side: user swing vs reference in separate video-backed panes */}
        {mode === 'side' && (
          <View style={styles.panesRow}>
            <ComparePane
              pane={{ label: 'You', jad: leftJad, videoUrl: leftVideo, accent }}
              frameIndex={leftIndex}
              height={paneH}
            />
            {loadingRef ? (
              <View style={[styles.pane, styles.paneLoading, { height: paneH }]}>
                <ActivityIndicator color={accent} />
              </View>
            ) : (
              <ComparePane
                pane={{
                  label: refChoice === 'ideal' ? 'Good position' : 'Earlier swing',
                  jad: refJad,
                  videoUrl: refVideo,
                  accent: colors.birdieGreen,
                }}
                frameIndex={refIndex}
                height={paneH}
              />
            )}
          </View>
        )}

        {/* Synced scrubber */}
        <View style={styles.scrubCard}>
          <View style={styles.playRow}>
            <TouchableOpacity
              style={[styles.playButton, { backgroundColor: accent }]}
              onPress={() => {
                if (!playing && u >= 1) setU(0);
                setPlaying(!playing);
              }}
            >
              <Ionicons name={playing ? 'pause' : 'play'} size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          <View
            ref={trackRef}
            style={styles.track}
            onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
            onStartShouldSetResponder={() => true}
            onMoveShouldSetResponder={() => true}
            onResponderGrant={(e) => {
              trackRef.current?.measure((_x, _y, _w, _h, pageX) => {
                trackX.current = pageX;
                setFromPageX(e.nativeEvent.pageX);
              });
            }}
            onResponderMove={(e) => setFromPageX(e.nativeEvent.pageX)}
          >
            <View style={styles.trackLine} />
            <View style={[styles.trackFill, { width: u * trackWidth, backgroundColor: accent }]} />
            {sharedPhases.map((p, i) => (
              <View
                key={p}
                style={[styles.phaseTick, { left: (i / segments) * trackWidth - 1 }]}
              />
            ))}
            <View style={[styles.thumb, { left: u * trackWidth - 9, borderColor: accent }]} />
          </View>
          <View style={styles.chipsRow}>
            {sharedPhases.map((p, i) => {
              const phaseDef = def.phases.find((ph) => ph.id === p);
              const active = Math.abs(u - i / segments) < 0.5 / segments;
              return (
                <TouchableOpacity
                  key={p}
                  style={[styles.chip, active && { backgroundColor: accent, borderColor: accent }]}
                  onPress={() => {
                    setPlaying(false);
                    setU(i / segments);
                  }}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {phaseDef?.label ?? p}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.hintCard}>
          <Ionicons name="information-circle-outline" size={16} color={colors.mutedGrey} />
          <Text style={styles.hintText}>
            Both sides are phase-synced: address, top, and impact always line up, even when the
            tempos differ. Pick an earlier upload to track your progress, or "Good position" for
            the model reference.
          </Text>
        </View>
      </ScrollView>
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
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  centerPane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    marginTop: 8,
  },
  modeOption: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.coolGrey,
  },
  modeTextActive: {
    color: '#FFFFFF',
  },
  refRow: {
    marginTop: 6,
    marginBottom: 10,
  },
  refChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 8,
  },
  refChipText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.coolGrey,
  },
  refChipTextActive: {
    color: '#FFFFFF',
  },
  panesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pane: {
    width: PANE_W,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.navy,
  },
  paneBg: {
    backgroundColor: colors.navy,
  },
  overlayPane: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: colors.coolGrey,
  },
  paneLoading: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  paneLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(11,22,41,0.72)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  paneLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  scrubCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 12,
  },
  playRow: {
    alignItems: 'center',
    marginBottom: 6,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    height: 32,
    justifyContent: 'center',
  },
  trackLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
  },
  phaseTick: {
    position: 'absolute',
    width: 2,
    height: 12,
    borderRadius: 1,
    backgroundColor: colors.mutedGrey,
    top: 10,
  },
  thumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    top: 7,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: colors.coolGrey,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  hintCard: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: colors.mutedGrey,
  },
});
