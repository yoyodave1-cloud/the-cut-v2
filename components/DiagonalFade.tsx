import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../constants/colors';

type DiagonalFadeProps = {
  scheme: 'light' | 'dark';
};

function rgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const CYAN = colors.voltCyan;
const VIOLET = colors.violet;

/** Dark/blue: cyan top-left → purple bottom-right. */
const DARK_COLORS = [rgba(CYAN, 0.48), rgba(VIOLET, 0.42)] as const;

/** Light: same direction, softer opacity. */
const LIGHT_COLORS = [rgba(CYAN, 0.3), rgba(VIOLET, 0.28)] as const;

export default function DiagonalFade({ scheme }: DiagonalFadeProps) {
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const endY = height > 0 ? width / height : 1;

  return (
    <LinearGradient
      pointerEvents="none"
      colors={scheme === 'light' ? LIGHT_COLORS : DARK_COLORS}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: endY }}
      style={styles.fill}
      onLayout={(event) => {
        const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
        setSize((prev) =>
          prev.width === nextWidth && prev.height === nextHeight
            ? prev
            : { width: nextWidth, height: nextHeight },
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
  },
});
