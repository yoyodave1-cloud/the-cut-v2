import React, { useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import SectionGlow from './SectionGlow';

/**
 * Same cyan/violet washes as Home sections, sized to this container.
 * Use as the body below a navy header so Tour/Creator keep a light page
 * while the fades sit behind scrolling content.
 */
export default function PageGlow({
  scheme = 'light',
  style,
  children,
}: {
  scheme?: 'light' | 'dark';
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const takeLayout = ({ nativeEvent }: LayoutChangeEvent) => {
    const { width, height } = nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setSize((prev) =>
      prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  return (
    <View collapsable={false} style={[styles.root, style]} onLayout={takeLayout}>
      {size.width > 0 && size.height > 0 ? (
        <View
          pointerEvents="none"
          collapsable={false}
          style={[styles.glow, { width: size.width, height: size.height }]}
        >
          <SectionGlow scheme={scheme} width={size.width} height={size.height} />
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
});
