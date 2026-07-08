import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import { colors } from '../../constants/colors';
import type { Benchmark, TrendPoint } from '../../lib/academy/types';

type Props = {
  points: TrendPoint[];
  benchmark?: Benchmark;
  color: string;
  width: number;
  height?: number;
  unit?: string;
};

/**
 * Sparkline trend chart for dashboard progress metrics, with the benchmark
 * range drawn as a soft band so "am I in the good zone?" reads at a glance.
 */
export default function TrendChart({
  points,
  benchmark,
  color,
  width,
  height = 56,
  unit = '',
}: Props) {
  if (!points.length || width <= 0) return null;

  const values = points.map((p) => p.value);
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (benchmark) {
    lo = Math.min(lo, benchmark.min);
    hi = Math.max(hi, benchmark.max);
  }
  if (hi - lo < 1e-6) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.12;
  lo -= pad;
  hi += pad;

  const px = (i: number) =>
    points.length > 1 ? (i / (points.length - 1)) * (width - 12) + 6 : width / 2;
  const py = (v: number) => height - ((v - lo) / (hi - lo)) * (height - 10) - 5;

  const last = points[points.length - 1];

  return (
    <View>
      <Svg width={width} height={height}>
        {benchmark ? (
          <Rect
            x={0}
            y={py(benchmark.max)}
            width={width}
            height={Math.max(2, py(benchmark.min) - py(benchmark.max))}
            fill="rgba(29,191,115,0.12)"
            rx={3}
          />
        ) : null}
        {points.length > 1 ? (
          <Polyline
            points={points.map((p, i) => `${px(i)},${py(p.value)}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        {points.map((p, i) => (
          <Circle
            key={i}
            cx={px(i)}
            cy={py(p.value)}
            r={i === points.length - 1 ? 4 : 2.5}
            fill={i === points.length - 1 ? color : '#FFFFFF'}
            stroke={color}
            strokeWidth={1.5}
          />
        ))}
      </Svg>
      <View style={styles.labelRow}>
        <Text style={styles.rangeLabel}>
          {points.length} session{points.length === 1 ? '' : 's'}
        </Text>
        <Text style={[styles.lastValue, { color }]}>
          {last.value}
          {unit}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  rangeLabel: {
    fontSize: 11,
    color: colors.mutedGrey,
  },
  lastValue: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
});
