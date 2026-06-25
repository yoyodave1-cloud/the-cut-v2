import React, { useEffect, useId, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors } from '../constants/colors';

export const EVENT_CIRCLE_SIZE = 90;
const RING_INSET = 5;
const RING_SIZE = EVENT_CIRCLE_SIZE + RING_INSET * 2;
const RING_STROKE = 2.5;
const LIVE_ACCENT = colors.bogeyRed;
const ROTATION_MS = 2600;

type UpcomingEventCircleProps = {
  borderColor: string;
  label: string;
  live: boolean;
};

function LiveGlowRing({ gradientId }: { gradientId: string }) {
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

  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.28;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ringLayer,
        {
          width: RING_SIZE,
          height: RING_SIZE,
          transform: [{ rotate }],
        },
      ]}
    >
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={LIVE_ACCENT} stopOpacity="1" />
            <Stop offset="55%" stopColor={LIVE_ACCENT} stopOpacity="0.35" />
            <Stop offset="100%" stopColor={LIVE_ACCENT} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={RING_STROKE}
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
}: UpcomingEventCircleProps) {
  const gradientId = useId().replace(/:/g, '');

  return (
    <View style={styles.wrap}>
      {live ? <LiveGlowRing gradientId={gradientId} /> : null}
      <View style={[styles.circle, { borderColor }]}>
        <Text style={styles.circleText}>{label}</Text>
      </View>
      {live ? (
        <View style={styles.liveBadge}>
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  ringLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  circle: {
    width: EVENT_CIRCLE_SIZE,
    height: EVENT_CIRCLE_SIZE,
    borderRadius: EVENT_CIRCLE_SIZE / 2,
    borderWidth: 2,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleText: {
    fontSize: 15,
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
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  liveBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
});
