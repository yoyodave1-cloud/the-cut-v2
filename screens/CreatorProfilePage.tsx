import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import CreatorAvatar from '../components/CreatorAvatar';
import { fetchCreatorVideos, type CreatorVideoRow } from '../api';
import {
  getCreatorById,
  getCreatorBySupabaseId,
  youtubeThumbnailUri,
  type CreatorRef,
} from '../constants/creators';
import { colors } from '../constants/colors';
import type { CreatorsStackParamList } from '../navigation/creatorsStackTypes';

const PAD = 16;

function ProfileYoutubeThumb({
  videoId,
  imageUrl,
  width,
  height,
  aspectRatio,
  borderRadius = 0,
}: {
  videoId: string;
  imageUrl?: string;
  width: DimensionValue;
  height?: DimensionValue;
  aspectRatio?: number;
  borderRadius?: number;
}) {
  const [uri, setUri] = useState(() => imageUrl || youtubeThumbnailUri(videoId, 'max'));
  useEffect(() => {
    setUri(imageUrl || youtubeThumbnailUri(videoId, 'max'));
  }, [imageUrl, videoId]);
  const onError = useCallback(() => {
    setUri((cur) => {
      const hq = youtubeThumbnailUri(videoId, 'hq');
      return cur === hq ? cur : hq;
    });
  }, [videoId]);
  return (
    <Image
      source={{ uri }}
      style={{
        width,
        height,
        aspectRatio,
        borderRadius,
        backgroundColor: colors.midNavy,
      }}
      resizeMode="cover"
      onError={onError}
    />
  );
}

function formatRelativeTime(iso: string): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return '';
  const diffMs = Date.now() - at;
  if (diffMs < 60 * 1000) return 'Just now';
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(at).toLocaleDateString();
}

function resolveCreator(
  creatorId: string,
  creatorName: string,
  supabaseId?: string,
  handle?: string,
  avatarUrl?: string,
): CreatorRef | undefined {
  const fromSlug = getCreatorById(creatorId);
  if (fromSlug) return fromSlug;
  if (supabaseId) {
    const fromSupabase = getCreatorBySupabaseId(supabaseId);
    if (fromSupabase) return fromSupabase;
  }
  if (supabaseId && creatorName) {
    return {
      id: creatorId,
      supabaseId,
      name: creatorName,
      handle: handle ?? creatorName,
      avatarUrl: avatarUrl ?? '',
      channelId: '',
      descriptor: 'Creator golf on YouTube',
    };
  }
  return undefined;
}

export default function CreatorProfilePage() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<CreatorsStackParamList>>();
  const route = useRoute<RouteProp<CreatorsStackParamList, 'CreatorProfilePage'>>();
  const { creatorId, creatorName, supabaseId, handle, avatarUrl } = route.params;
  const creator = useMemo(
    () => resolveCreator(creatorId, creatorName, supabaseId, handle, avatarUrl),
    [avatarUrl, creatorId, creatorName, handle, supabaseId],
  );
  const displayName = creator?.name ?? creatorName;
  const isMountedRef = useRef(true);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [videoTab, setVideoTab] = useState<'videos' | 'shorts'>('videos');
  const [profileVideos, setProfileVideos] = useState<CreatorVideoRow[] | null>(null);
  const [profileShorts, setProfileShorts] = useState<CreatorVideoRow[] | null>(null);

  const apiCreatorId = creator?.supabaseId ?? supabaseId;

  const openChannel = useCallback(() => {
    if (!creator?.handle) return;
    void Linking.openURL(`https://youtube.com/@${creator.handle}`);
  }, [creator]);

  const openVideo = useCallback((watchUrl: string) => {
    void Linking.openURL(watchUrl);
  }, []);

  const fetchVideos = useCallback(
    async (type: 'videos' | 'shorts') => {
      if (!apiCreatorId) {
        if (!isMountedRef.current) return;
        if (type === 'videos') setProfileVideos([]);
        else setProfileShorts([]);
        return;
      }
      setLoadingVideos(true);
      try {
        const rows = await fetchCreatorVideos(apiCreatorId, type);
        if (!isMountedRef.current) return;
        if (type === 'videos') setProfileVideos(rows);
        else setProfileShorts(rows);
      } catch {
        if (!isMountedRef.current) return;
        if (type === 'videos') setProfileVideos([]);
        else setProfileShorts([]);
      } finally {
        if (isMountedRef.current) setLoadingVideos(false);
      }
    },
    [apiCreatorId],
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setVideoTab('videos');
    setProfileVideos(null);
    setProfileShorts(null);
    void fetchVideos('videos');
  }, [fetchVideos]);

  const onPressVideoTab = useCallback(
    (nextTab: 'videos' | 'shorts') => {
      setVideoTab(nextTab);
      if (nextTab === 'shorts' && profileShorts === null) {
        void fetchVideos('shorts');
      }
      if (nextTab === 'videos' && profileVideos === null) {
        void fetchVideos('videos');
      }
    },
    [fetchVideos, profileShorts, profileVideos],
  );

  const videosForRender = videoTab === 'shorts' ? profileShorts ?? [] : profileVideos ?? [];

  if (!creator) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.navBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.navBack}>
            <Ionicons name="chevron-back" size={26} color={colors.navy} />
          </Pressable>
          <Text style={styles.navTitle}>Creator Profile</Text>
          <View style={{ width: 88 }} />
        </View>
        <View style={styles.missingWrap}>
          <Text style={styles.missingText}>Creator not found.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.navBack}>
          <Ionicons name="chevron-back" size={26} color={colors.navy} />
        </Pressable>
        <Text style={styles.navTitle}>Creator Profile</Text>
        <Pressable onPress={openChannel} style={styles.ytPill} hitSlop={6}>
          <Ionicons name="logo-youtube" size={16} color="#FF0000" />
          <Text style={styles.ytPillText}>YouTube</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <View style={styles.profileHeader}>
          <CreatorAvatar name={displayName} avatarUrl={creator.avatarUrl} size={120} textSize={34} />
          <Text style={styles.headerName} numberOfLines={2}>
            {displayName}
          </Text>
          <Text style={styles.headerHandle}>@{creator.handle}</Text>
        </View>

        <View style={styles.videoTabsWrap}>
          <Pressable
            onPress={() => onPressVideoTab('videos')}
            style={[styles.videoTabChip, videoTab === 'videos' ? styles.videoTabChipActive : null]}
          >
            <Text style={[styles.videoTabText, videoTab === 'videos' ? styles.videoTabTextActive : null]}>
              Latest Videos
            </Text>
          </Pressable>
          <Pressable
            onPress={() => onPressVideoTab('shorts')}
            style={[styles.videoTabChip, videoTab === 'shorts' ? styles.videoTabChipActive : null]}
          >
            <Text style={[styles.videoTabText, videoTab === 'shorts' ? styles.videoTabTextActive : null]}>
              Shorts
            </Text>
          </Pressable>
        </View>

        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionTitle}>
            {videoTab === 'shorts' ? 'Latest Shorts' : 'Latest Videos'}
          </Text>
          <Text style={styles.sectionCount}>{videosForRender.length}</Text>
        </View>

        {loadingVideos ? (
          <View style={styles.loadingStateCard}>
            <Text style={styles.loadingStateText}>
              {videoTab === 'shorts' ? 'Loading latest shorts...' : 'Loading latest videos...'}
            </Text>
          </View>
        ) : null}

        {!loadingVideos && videoTab === 'shorts' && videosForRender.length === 0 ? (
          <View style={styles.emptyShortsWrap}>
            <Text style={styles.emptyShortsText}>No shorts available yet</Text>
          </View>
        ) : null}

        {videosForRender.map((v, idx) => {
          const isNewest = idx === 0;
          if (videoTab === 'shorts') {
            const shortThumbW = 90;
            const shortThumbH = 160;
            return (
              <Pressable
                key={`${v.videoId}-${idx}`}
                style={styles.videoRow}
                onPress={() => openVideo(v.watchUrl)}
              >
                <View style={styles.shortRow}>
                  <View style={[styles.videoThumbBox, { width: shortThumbW, height: shortThumbH }]}>
                    <ProfileYoutubeThumb
                      videoId={v.videoId}
                      imageUrl={v.thumbnailUrl}
                      width={shortThumbW}
                      height={shortThumbH}
                      borderRadius={8}
                    />
                    {isNewest ? <View style={styles.redDot} /> : null}
                  </View>
                  <View style={styles.shortRightCol}>
                    <View>
                      <Text style={styles.shortVideoTitle} numberOfLines={3}>
                        {v.title}
                      </Text>
                      <Text style={styles.shortHaiku} numberOfLines={3}>
                        {v.summary}
                      </Text>
                    </View>
                    <View style={styles.shortMetaRow}>
                      <Text style={styles.videoTime}>
                        {v.publishedAt ? formatRelativeTime(v.publishedAt) : '—'}
                      </Text>
                      <Text style={styles.videoMetaDot}>•</Text>
                      <Text style={styles.videoWatchLink}>Watch</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          }
          return (
            <Pressable
              key={`${v.videoId}-${idx}`}
              style={[styles.videoRow, styles.videoStackCard]}
              onPress={() => openVideo(v.watchUrl)}
            >
              <View style={[styles.videoThumbBox, styles.videoFullThumbBox]}>
                <ProfileYoutubeThumb
                  videoId={v.videoId}
                  imageUrl={v.thumbnailUrl}
                  width="100%"
                  aspectRatio={16 / 9}
                  borderRadius={8}
                />
                {isNewest ? <View style={styles.redDot} /> : null}
              </View>
              <Text style={styles.videoTitle} numberOfLines={2}>
                {v.title}
              </Text>
              <Text style={styles.videoHaiku} numberOfLines={2}>
                {v.summary}
              </Text>
              <View style={styles.videoBottomRow}>
                <Text style={styles.videoTime}>
                  {v.publishedAt ? formatRelativeTime(v.publishedAt) : '—'}
                </Text>
                <Text style={styles.videoMetaDot}>•</Text>
                <Text style={styles.videoWatchLink}>Watch</Text>
              </View>
            </Pressable>
          );
        })}
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
    paddingHorizontal: PAD,
    paddingBottom: 10,
    gap: 6,
  },
  navBack: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: colors.navy,
  },
  ytPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.card,
    maxWidth: 110,
  },
  ytPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.navy,
  },
  profileHeader: {
    backgroundColor: colors.bg,
    paddingTop: 48,
    paddingBottom: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '700',
    color: colors.navy,
    textAlign: 'center',
  },
  headerHandle: {
    marginTop: 4,
    fontSize: 14,
    color: colors.coolGrey,
    textAlign: 'center',
  },
  videoTabsWrap: {
    flexDirection: 'row',
    marginHorizontal: PAD,
    marginTop: 8,
    marginBottom: 4,
    gap: 16,
  },
  videoTabChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: 'transparent',
  },
  videoTabChipActive: {
    backgroundColor: colors.liveBlue,
    borderColor: colors.liveBlue,
  },
  videoTabText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: colors.mutedGrey,
    textAlign: 'center',
  },
  videoTabTextActive: {
    color: '#FFFFFF',
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.navy,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.coolGrey,
  },
  videoRow: {
    marginHorizontal: PAD,
    marginBottom: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: 12,
  },
  videoStackCard: {
    borderRadius: 8,
  },
  shortRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  videoThumbBox: {
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  videoFullThumbBox: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  shortRightCol: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: 160,
  },
  shortVideoTitle: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    color: colors.navy,
  },
  shortHaiku: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
    color: colors.coolGrey,
  },
  shortMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  redDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.bogeyRed,
    borderWidth: 2,
    borderColor: colors.card,
  },
  videoTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
    color: colors.navy,
  },
  videoHaiku: {
    marginTop: 6,
    fontSize: 16,
    lineHeight: 22,
    color: colors.coolGrey,
  },
  videoBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 8,
  },
  videoTime: {
    fontSize: 15,
    color: colors.coolGrey,
  },
  videoWatchLink: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.liveBlue,
  },
  videoMetaDot: {
    fontSize: 15,
    color: colors.coolGrey,
  },
  missingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  missingText: {
    fontSize: 15,
    color: colors.coolGrey,
  },
  loadingStateCard: {
    marginHorizontal: PAD,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  loadingStateText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.coolGrey,
  },
  emptyShortsWrap: {
    marginHorizontal: PAD,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  emptyShortsText: {
    fontSize: 16,
    color: colors.coolGrey,
    textAlign: 'center',
  },
});
