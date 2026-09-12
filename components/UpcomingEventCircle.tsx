import React, { useEffect, useId, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '../constants/colors';

export const EVENT_CIRCLE_SIZE = 90;
const DEFAULT_RING_INSET = 5;
const LIVE_ACCENT = colors.bogeyRed;
const ROTATION_MS = 2600;

type UpcomingEventCircleProps = {
  borderColor: string;
  label: string;
  live: boolean;
  size?: number;
  ringInset?: number;
  /** Caption spacing under the tour-page tile. Home inline uses 0. */
  marginBottom?: number;
};

function LiveGlowRing({
  gradientId,
  ringSize,
  stroke,
}: {
  gradientId: string;
  ringSize: number;
  stroke: number;
}) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: ROTATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const radius = (ringSize - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.28;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ringLayer,
        {
          width: ringSize,
          height: ringSize,
          transform: [{ rotate }],
        },
      ]}
    >
      <Svg width={ringSize} height={ringSize}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={LIVE_ACCENT} stopOpacity="1" />
            <Stop offset="55%" stopColor={LIVE_ACCENT} stopOpacity="0.35" />
            <Stop offset="100%" stopColor={LIVE_ACCENT} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={ringSize / 2}
          cy={ringSize / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circumference - arcLength}`}
        />
      </Svg>
    </Animated.View>
  );
}

export default function UpcomingEventCircle({
  borderColor,
  label,
  live,
  size = EVENT_CIRCLE_SIZE,
  ringInset = DEFAULT_RING_INSET,
  marginBottom = 6,
}: UpcomingEventCircleProps) {
  const gradientId = useId().replace(/:/g, '');
  const ringSize = size + ringInset * 2;
  const compact = size < EVENT_CIRCLE_SIZE;
  const stroke = compact ? 2 : 2.5;
  const fontSize = compact ? 10 : 15;
  const badgePadH = compact ? 4 : 5;
  const badgePadV = compact ? 1 : 2;
  const badgeFont = compact ? 7 : 8;

  return (
    <View style={[styles.wrap, { width: ringSize, height: ringSize, marginBottom }]}>
      {live ? <LiveGlowRing gradientId={gradientId} ringSize={ringSize} stroke={stroke} /> : null}
      <View
        style={[
          styles.circle,
          {
            borderColor,
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: compact ? 1.5 : 2,
          },
        ]}
      >
        <Text style={[styles.circleText, { fontSize }]}>{label}</Text>
      </View>
      {live ? (
        <View
          style={[
            styles.liveBadge,
            { paddingHorizontal: badgePadH, paddingVertical: badgePadV },
          ]}
        >
          <Text style={[styles.liveBadgeText, { fontSize: badgeFont }]}>LIVE</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  ringLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  circle: {
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleText: {
    fontWeight: '600',
    color: colors.navy,
    textAlign: 'center',
  },
  liveBadge: {
    position: 'absolute',
    top: -2,
    right: 2,
    backgroundColor: LIVE_ACCENT,
    borderRadius: 6,
  },
  liveBadgeText: {
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
});
