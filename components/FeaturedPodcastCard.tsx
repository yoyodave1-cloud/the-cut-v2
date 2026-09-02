import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FeaturedPodcastPick, openYouTubeVideo } from '../api';
import { colors } from '../constants/colors';
import { fetchPodcastArtwork } from '../lib/podcastArtwork';

const THUMB = 112;

function PodcastThumbPlaceholder() {
  return (
    <View style={styles.placeholder}>
      <Ionicons name="mic-outline" size={32} color={colors.liveBlue} />
    </View>
  );
}

export default function FeaturedPodcastCard({ pick }: { pick: FeaturedPodcastPick }) {
  const [artworkUri, setArtworkUri] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setArtworkUri(null);
    if (!pick.applePodcastId) return undefined;
    fetchPodcastArtwork(pick.applePodcastId).then((uri) => {
      if (!cancelled) setArtworkUri(uri);
    });
    return () => {
      cancelled = true;
    };
  }, [pick.applePodcastId]);

  return (
    <TouchableOpacity
      style={styles.compactCard}
      activeOpacity={0.8}
      onPress={() => openYouTubeVideo(pick.videoId)}
    >
      <View style={styles.compactCardRow}>
        <View style={styles.compactCardText}>
          <Text style={styles.podcastName} numberOfLines={1}>
            {pick.podcastName}
          </Text>
          <Text style={styles.episodeTitle} numberOfLines={2}>
            {pick.title}
          </Text>
        </View>
        {artworkUri ? (
          <Image
            source={{ uri: artworkUri }}
            style={styles.compactThumb}
            resizeMode="cover"
            onError={() => setArtworkUri(null)}
          />
        ) : (
          <PodcastThumbPlaceholder />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  compactCard: {
    backgroundColor: colors.card,
    borderRadius: 15,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 15,
    marginBottom: 13,
  },
  compactCardRow: {
    flexDirection: 'row',
    gap: 13,
    alignItems: 'flex-start',
  },
  compactCardText: { flex: 1, minWidth: 0, paddingTop: 1 },
  compactThumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 10,
    flexShrink: 0,
    backgroundColor: colors.midNavy,
  },
  placeholder: {
    width: THUMB,
    height: THUMB,
    borderRadius: 10,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.midNavy,
  },
  podcastName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.navy,
    lineHeight: 23,
  },
  episodeTitle: {
    fontSize: 13,
    color: colors.coolGrey,
    marginTop: 5,
    lineHeight: 18,
  },
});
