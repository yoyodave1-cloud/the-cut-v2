import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { openYouTubeVideo, watchLaterAsVideoItem } from '../api';
import CreatorAvatar from '../components/CreatorAvatar';
import { FeaturedVideoCard } from '../components/VideoFeedCards';
import { colors } from '../constants/colors';
import { useAuth, userAvatarUrl, userDisplayName } from '../context/AuthContext';
import { useWatchLater } from '../context/WatchLaterContext';

export default function WatchLaterPage() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isSignedIn, user, signOut } = useAuth();
  const { items, loading, refresh, removeById } = useWatchLater();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const name = userDisplayName(user);
  const avatarUrl = userAvatarUrl(user);

  return (
    <View style={styles.root}>
      <View style={[styles.navBar, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          style={styles.navBack}
          onPress={() => navigation.goBack()}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={26} color={colors.navy} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Watch Later</Text>
        <View style={styles.navBack} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {isSignedIn ? (
          <View style={styles.accountRow}>
            <CreatorAvatar name={name || 'You'} avatarUrl={avatarUrl} size={40} />
            <View style={styles.accountCopy}>
              <Text style={styles.accountName} numberOfLines={1}>
                {name}
              </Text>
              {user?.email ? (
                <Text style={styles.accountEmail} numberOfLines={1}>
                  {user.email}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={() => void signOut()} hitSlop={8}>
              <Text style={styles.signOut}>Sign out</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {loading && items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <ActivityIndicator color={colors.liveBlue} />
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="bookmark-outline" size={32} color={colors.mutedGrey} />
            <Text style={styles.emptyText}>
              Nothing saved yet — tap the bookmark icon on any video to add it here.
            </Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.itemWrap}>
              <FeaturedVideoCard
                video={watchLaterAsVideoItem(item)}
                videoSource={item.videoSource}
              />
              <View style={styles.itemActions}>
                <TouchableOpacity
                  onPress={() => openYouTubeVideo(item.videoId)}
                  hitSlop={8}
                >
                  <Text style={styles.watchLink}>Watch</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => void removeById(item.id)} hitSlop={8}>
                  <Text style={styles.removeLink}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
  },
  navBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: colors.navy,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  accountCopy: {
    flex: 1,
    minWidth: 0,
  },
  accountName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: colors.navy,
  },
  accountEmail: {
    fontSize: 12,
    color: colors.coolGrey,
    marginTop: 2,
  },
  signOut: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: colors.liveBlue,
  },
  emptyWrap: {
    paddingTop: 48,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: colors.coolGrey,
    textAlign: 'center',
  },
  itemWrap: {
    marginBottom: 8,
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -6,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  watchLink: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: colors.liveBlue,
  },
  removeLink: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: colors.bogeyRed,
  },
});
