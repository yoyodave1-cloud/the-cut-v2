import React, { useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, G, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../constants/colors';

type WashTone = 'cyan' | 'violet';

type WashLayout = {
  tone: WashTone;
  widthRatio: number;
  heightRatio: number;
  leftRatio: number;
  topRatio: number;
};

export type SectionGlowVariant = 'default' | 'intro';

type Stops = { offset: string; color: string; opacity: number }[];

/**
 * The site blurs each glow by 120px, which spreads the core over a huge area and knocks the peak
 * alpha right down. react-native-svg has no cheap blur, so the falloff is hand-rolled as a long
 * multi-stop ramp instead — low peak, no hard shoulder.
 */
const TONES: Record<WashTone, Stops> = {
  cyan: [
    { offset: '0%', color: colors.voltCyan, opacity: 0.42 },
    { offset: '22%', color: colors.voltCyan, opacity: 0.32 },
    { offset: '44%', color: colors.liveBlue, opacity: 0.2 },
    { offset: '64%', color: colors.liveBlue, opacity: 0.1 },
    { offset: '82%', color: colors.voltCyan, opacity: 0.04 },
    { offset: '100%', color: colors.voltCyan, opacity: 0 },
  ],
  violet: [
    { offset: '0%', color: colors.violet, opacity: 0.42 },
    { offset: '22%', color: colors.violet, opacity: 0.32 },
    { offset: '44%', color: '#EC4899', opacity: 0.18 },
    { offset: '64%', color: '#EC4899', opacity: 0.09 },
    { offset: '82%', color: colors.violet, opacity: 0.04 },
    { offset: '100%', color: colors.violet, opacity: 0 },
  ],
};

/**
 * Ratios of the section box. Each wash is wider than the section and its centre sits near an outer
 * edge, so the visible middle of the section only ever shows the two faded tails overlapping.
 * Heights are kept short enough that both ramps reach their last visible stop by ~80% of the
 * section, leaving the torn divider below in clear air.
 */
const WASHES: WashLayout[] = [
  { tone: 'cyan', widthRatio: 1.9, heightRatio: 1.2, leftRatio: -0.75, topRatio: -0.32 },
  { tone: 'violet', widthRatio: 1.85, heightRatio: 1.05, leftRatio: -0.1, topRatio: -0.17 },
];

/** Taller, lower washes so Home intro glow still covers the headline block and meets the video arc. */
const INTRO_WASHES: WashLayout[] = [
  { tone: 'cyan', widthRatio: 1.9, heightRatio: 1.7, leftRatio: -0.75, topRatio: -0.08 },
  { tone: 'violet', widthRatio: 1.85, heightRatio: 1.55, leftRatio: -0.1, topRatio: 0.04 },
];

export function sectionGlowIntensity(scheme: 'light' | 'dark') {
  return scheme === 'light' ? 0.7 : 1;
}

/** Same wash rects/gradients as SectionGlow, for clipping into the torn-divider polygon. */
export function SectionGlowPaint({
  scheme,
  width,
  height,
  idPrefix,
  variant = 'default',
}: {
  scheme: 'light' | 'dark';
  width: number;
  height: number;
  idPrefix: string;
  variant?: SectionGlowVariant;
}) {
  const washes = variant === 'intro' ? INTRO_WASHES : WASHES;
  return (
    <G opacity={sectionGlowIntensity(scheme)}>
      {washes.map((wash) => {
        const w = width * wash.widthRatio;
        const h = height * wash.heightRatio;
        const x = width * wash.leftRatio;
        const y = height * wash.topRatio;
        const gid = `${idPrefix}-${wash.tone}`;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const rx = w / 2;
        const ry = h / 2;
        return (
          <G key={wash.tone}>
            <Defs>
              <RadialGradient
                id={gid}
                cx={cx}
                cy={cy}
                rx={rx}
                ry={ry}
                fx={cx}
                fy={cy}
                r={Math.min(rx, ry)}
                gradientUnits="userSpaceOnUse"
              >
                {TONES[wash.tone].map((stop) => (
                  <Stop
                    key={stop.offset}
                    offset={stop.offset}
                    stopColor={stop.color}
                    stopOpacity={stop.opacity}
                  />
                ))}
              </RadialGradient>
            </Defs>
            <Rect x={x} y={y} width={w} height={h} fill={`url(#${gid})`} />
          </G>
        );
      })}
    </G>
  );
}

export default function SectionGlow({
  scheme,
  width,
  height,
  variant = 'default',
}: {
  scheme: 'light' | 'dark';
  width: number;
  height: number;
  variant?: SectionGlowVariant;
}) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, '');

  if (width <= 0 || height <= 0) return null;

  return (
    <View pointerEvents="none" style={[styles.layer, { width, height }]}>
      <Svg width={width} height={height}>
        <SectionGlowPaint
          scheme={scheme}
          width={width}
          height={height}
          variant={variant}
          idPrefix={`sg-${reactId}`}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    overflow: 'hidden',
  },
});
