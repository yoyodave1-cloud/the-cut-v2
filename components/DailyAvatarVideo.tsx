import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { colors } from '../constants/colors';

const DAILY_VIDEO_API = 'https://the-cut-production-f9f7.up.railway.app/api/daily-video';

type DailyVideoResponse = {
  video_url: string;
};

function DailyVideoPlayer({ videoUrl }: { videoUrl: string }) {
  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = false;
    p.play();
  });

  return (
    <VideoView
      player={player}
      style={styles.video}
      contentFit="contain"
      nativeControls
    />
  );
}

export default function DailyAvatarVideo() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(DAILY_VIDEO_API);
        if (!res.ok) {
          throw new Error('No daily video available');
        }
        const data: DailyVideoResponse = await res.json();
        if (!data.video_url) {
          throw new Error('Invalid daily video response');
        }
        if (!cancelled) {
          setVideoUrl(data.video_url);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load daily video');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.wrapper}>
      {loading ? (
        <ActivityIndicator color={colors.liveBlue} />
      ) : error || !videoUrl ? (
        <Text style={styles.errorText} numberOfLines={2}>
          {error ?? 'No video'}
        </Text>
      ) : (
        <DailyVideoPlayer videoUrl={videoUrl} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    aspectRatio: 9 / 16,
    overflow: 'hidden',
    backgroundColor: colors.midNavy,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  video: {
    width: '100%',
    height: '100%',
  },
  errorText: {
    color: colors.mutedGrey,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
