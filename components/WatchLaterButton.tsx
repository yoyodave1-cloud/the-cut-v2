import React from 'react';
import { StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { VideoSource } from '../api';
import { useWatchLater } from '../context/WatchLaterContext';

type Props = {
  videoId: string;
  videoSource?: VideoSource;
  style?: StyleProp<ViewStyle>;
};

export default function WatchLaterButton({
  videoId,
  videoSource = 'creator_videos',
  style,
}: Props) {
  const { isSaved, toggleSave } = useWatchLater();
  if (!videoId) return null;
  const saved = isSaved(videoId);

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      activeOpacity={0.8}
      hitSlop={8}
      onPress={() => {
        void toggleSave(videoId, videoSource);
      }}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from Watch Later' : 'Save to Watch Later'}
    >
      <View pointerEvents="none">
        <Ionicons
          name={saved ? 'bookmark' : 'bookmark-outline'}
          size={18}
          color="#FFFFFF"
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(11,22,41,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
