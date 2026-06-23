import React, { useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageStyle, type StyleProp } from 'react-native';
import { creatorInitials } from '../constants/creators';
import { colors } from '../constants/colors';

type Props = {
  name: string;
  avatarUrl?: string | null;
  size: number;
  style?: StyleProp<ImageStyle>;
  textSize?: number;
};

export default function CreatorAvatar({ name, avatarUrl, size, style, textSize }: Props) {
  const [failed, setFailed] = useState(false);
  const showFallback = failed || !avatarUrl;
  const radius = size / 2;
  const initialsSize = textSize ?? Math.round(size * 0.34);

  if (showFallback) {
    return (
      <View
        style={[
          styles.fallback,
          { width: size, height: size, borderRadius: radius },
          style,
        ]}
      >
        <Text style={[styles.fallbackText, { fontSize: initialsSize }]}>{creatorInitials(name)}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: avatarUrl }}
      style={[{ width: size, height: size, borderRadius: radius, backgroundColor: colors.midNavy }, style]}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.liveBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
