import React, { useId, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../constants/colors';

type WashTone = 'cyan' | 'violet';

type Stops = { offset: string; color: string; opacity: number }[];

/**
 * The site blurs each glow by 120px, which spreads the core over a huge area and knocks the peak
 * alpha right down. react-native-svg has no cheap blur, so the falloff is hand-rolled as a long
 * multi-stop ramp instead — low peak, no hard shoulder.
 */
const TONES: Record<WashTone, Stops> = {
  cyan: [
    { offset: '0%', color: colors.voltCyan, opacity: 0.21 },
    { offset: '22%', color: colors.voltCyan, opacity: 0.17 },
    { offset: '44%', color: colors.liveBlue, opacity: 0.115 },
    { offset: '64%', color: colors.liveBlue, opacity: 0.06 },
    { offset: '82%', color: colors.voltCyan, opacity: 0.022 },
    { offset: '100%', color: colors.voltCyan, opacity: 0 },
  ],
  violet: [
    { offset: '0%', color: colors.violet, opacity: 0.21 },
    { offset: '22%', color: colors.violet, opacity: 0.17 },
    { offset: '44%', color: '#EC4899', opacity: 0.105 },
    { offset: '64%', color: '#EC4899', opacity: 0.055 },
    { offset: '82%', color: colors.violet, opacity: 0.022 },
    { offset: '100%', color: colors.violet, opacity: 0 },
  ],
};

/**
 * Ratios of the section box. Each wash is wider than the section and its centre sits near an outer
 * edge, so the visible middle of the section only ever shows the two faded tails overlapping.
 * Heights are kept short enough that both ramps reach their last visible stop by ~80% of the
 * section, leaving the torn divider below in clear air.
 */
const WASHES: {
  tone: WashTone;
  widthRatio: number;
  heightRatio: number;
  leftRatio: number;
  topRatio: number;
}[] = [
  { tone: 'cyan', widthRatio: 1.9, heightRatio: 1.2, leftRatio: -0.75, topRatio: -0.32 },
  { tone: 'violet', widthRatio: 1.85, heightRatio: 1.05, leftRatio: -0.1, topRatio: -0.17 },
];

function GlowWash({
  tone,
  width,
  height,
  left,
  top,
}: {
  tone: WashTone;
  width: number;
  height: number;
  left: number;
  top: number;
}) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradientId = `wash-${tone}-${reactId}`;

  return (
    <View pointerEvents="none" style={[styles.wash, { width, height, left, top }]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" rx="50%" ry="50%">
            {TONES[tone].map((stop) => (
              <Stop
                key={stop.offset}
                offset={stop.offset}
                stopColor={stop.color}
                stopOpacity={stop.opacity}
              />
            ))}
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}

export default function SectionGlow({ scheme }: { scheme: 'light' | 'dark' }) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  /** Light sections sit on #F0F4F8, where the same alpha reads far hotter and eats title contrast. */
  const intensity = scheme === 'light' ? 0.55 : 1;

  const onLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    if (width !== box.width || height !== box.height) setBox({ width, height });
  };

  return (
    <View pointerEvents="none" style={[styles.layer, { opacity: intensity }]} onLayout={onLayout}>
      {box.width > 0
        ? WASHES.map((wash) => (
            <GlowWash
              key={wash.tone}
              tone={wash.tone}
              width={box.width * wash.widthRatio}
              height={box.height * wash.heightRatio}
              left={box.width * wash.leftRatio}
              top={box.height * wash.topRatio}
            />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  wash: {
    position: 'absolute',
  },
});
