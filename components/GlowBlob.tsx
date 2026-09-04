import React, { useId } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

type GlowTone = 'cyan' | 'violet';

const TONES: Record<GlowTone, { core: string; mid: string }> = {
  cyan: { core: '#00E5FF', mid: '#4A90D9' },
  violet: { core: '#8B5CF6', mid: '#EC4899' },
};

type GlowBlobProps = {
  tone: GlowTone;
  opacity: number;
  width?: number;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export default function GlowBlob({
  tone,
  opacity,
  width = 320,
  height = 280,
  style,
}: GlowBlobProps) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const gradientId = `glow-${tone}-${reactId}`;
  const { core, mid } = TONES[tone];

  return (
    <View pointerEvents="none" style={[styles.blob, { width, height, opacity }, style]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0%" stopColor={core} stopOpacity={1} />
            <Stop offset="50%" stopColor={mid} stopOpacity={0.4} />
            <Stop offset="75%" stopColor={core} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width={width} height={height} fill={`url(#${gradientId})`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
  },
});
