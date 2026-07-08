import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import type { Keyframes, PhaseDef } from '../../lib/academy/types';

type Props = {
  frameCount: number;
  index: number;
  onIndexChange: (index: number, fromDrag: boolean) => void;
  keyframes: Keyframes;
  phases: PhaseDef[];
  playing: boolean;
  onTogglePlay: () => void;
  accent: string;
};

/**
 * Frame-by-frame scrubber with phase markers and jump chips — the
 * Sportsbox-style "scrub and watch the numbers change" interaction.
 */
export default function FrameScrubber({
  frameCount,
  index,
  onIndexChange,
  keyframes,
  phases,
  playing,
  onTogglePlay,
  accent,
}: Props) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const trackX = useRef(0);
  const trackRef = useRef<View>(null);

  const clampIndex = useCallback(
    (i: number) => Math.max(0, Math.min(frameCount - 1, Math.round(i))),
    [frameCount],
  );

  const indexFromPageX = useCallback(
    (pageX: number) => {
      const w = trackWidthRef.current;
      if (w <= 0) return 0;
      const u = (pageX - trackX.current) / w;
      return clampIndex(u * (frameCount - 1));
    },
    [clampIndex, frameCount],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => {
          trackRef.current?.measure((_x, _y, _w, _h, pageX) => {
            trackX.current = pageX;
            onIndexChange(indexFromPageX(e.nativeEvent.pageX), true);
          });
        },
        onPanResponderMove: (e: GestureResponderEvent) => {
          onIndexChange(indexFromPageX(e.nativeEvent.pageX), true);
        },
      }),
    [indexFromPageX, onIndexChange],
  );

  const u = frameCount > 1 ? index / (frameCount - 1) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={styles.stepButton}
          onPress={() => onIndexChange(clampIndex(index - 1), true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="play-skip-back" size={18} color={colors.navy} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.playButton, { backgroundColor: accent }]} onPress={onTogglePlay}>
          <Ionicons name={playing ? 'pause' : 'play'} size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.stepButton}
          onPress={() => onIndexChange(clampIndex(index + 1), true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="play-skip-forward" size={18} color={colors.navy} />
        </TouchableOpacity>
        <Text style={styles.frameLabel}>
          {index + 1}/{frameCount}
        </Text>
      </View>

      <View
        ref={trackRef}
        style={styles.track}
        onLayout={(e) => {
          setTrackWidth(e.nativeEvent.layout.width);
          trackWidthRef.current = e.nativeEvent.layout.width;
        }}
        {...panResponder.panHandlers}
      >
        <View style={styles.trackLine} />
        <View style={[styles.trackFill, { width: u * trackWidth, backgroundColor: accent }]} />
        {phases.map((phase) => {
          const kf = keyframes[phase.id];
          if (!kf || frameCount <= 1) return null;
          const px = (kf.index / (frameCount - 1)) * trackWidth;
          return <View key={phase.id} style={[styles.phaseTick, { left: px - 1 }]} />;
        })}
        <View style={[styles.thumb, { left: u * trackWidth - 9, borderColor: accent }]} />
      </View>

      <View style={styles.chipsRow}>
        {phases.map((phase) => {
          const kf = keyframes[phase.id];
          if (!kf) return null;
          const active = Math.abs(index - kf.index) <= 1;
          return (
            <TouchableOpacity
              key={phase.id}
              style={[styles.chip, active && { backgroundColor: accent, borderColor: accent }]}
              onPress={() => onIndexChange(kf.index, true)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{phase.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 6,
  },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameLabel: {
    position: 'absolute',
    right: 4,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: colors.mutedGrey,
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
});
