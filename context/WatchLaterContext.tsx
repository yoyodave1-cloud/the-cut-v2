import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import {
  deleteWatchLater,
  fetchWatchLater,
  saveWatchLater,
  type VideoSource,
  type WatchLaterItem,
} from '../api';
import { useAuth } from './AuthContext';
import SignInSheet from '../components/SignInSheet';

type WatchLaterContextValue = {
  items: WatchLaterItem[];
  loading: boolean;
  isSaved: (videoId: string) => boolean;
  toggleSave: (videoId: string, videoSource?: VideoSource) => Promise<void>;
  removeById: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
};

const WatchLaterContext = React.createContext<WatchLaterContextValue | null>(null);

export function WatchLaterProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, session } = useAuth();
  const [items, setItems] = useState<WatchLaterItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [signInVisible, setSignInVisible] = useState(false);
  const pendingSaveRef = useRef<{ videoId: string; videoSource: VideoSource } | null>(null);
  const accessToken = session?.access_token ?? null;

  const refresh = useCallback(async () => {
    if (!accessToken) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const next = await fetchWatchLater(accessToken);
      setItems(next);
    } catch (err) {
      console.warn('[WatchLater] fetch failed:', err instanceof Error ? err.message : err);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isSignedIn) {
      setItems([]);
      setLoading(false);
      return;
    }
    refresh();
  }, [isSignedIn, refresh]);

  const persistSave = useCallback(
    async (videoId: string, videoSource: VideoSource) => {
      if (!accessToken) return;
      try {
        const id = await saveWatchLater(accessToken, videoId, videoSource);
        setItems((prev) => {
          if (prev.some((item) => item.videoId === videoId)) return prev;
          const next: WatchLaterItem = {
            id: id ?? Date.now(),
            videoId,
            videoSource,
            savedAt: new Date().toISOString(),
            title: '',
            watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
          };
          return [next, ...prev];
        });
        refresh();
      } catch (err) {
        Alert.alert(
          'Could not save',
          err instanceof Error ? err.message : 'Please try again.',
        );
      }
    },
    [accessToken, refresh],
  );

  useEffect(() => {
    if (!isSignedIn || !accessToken) return;
    setSignInVisible(false);
    const pending = pendingSaveRef.current;
    if (!pending) return;
    pendingSaveRef.current = null;
    persistSave(pending.videoId, pending.videoSource);
  }, [accessToken, isSignedIn, persistSave]);

  const isSaved = useCallback(
    (videoId: string) => items.some((item) => item.videoId === videoId),
    [items],
  );

  const removeById = useCallback(
    async (id: number) => {
      if (!accessToken) return;
      const previous = items;
      setItems((prev) => prev.filter((item) => item.id !== id));
      try {
        await deleteWatchLater(accessToken, id);
      } catch (err) {
        setItems(previous);
        Alert.alert(
          'Could not remove',
          err instanceof Error ? err.message : 'Please try again.',
        );
      }
    },
    [accessToken, items],
  );

  const toggleSave = useCallback(
    async (videoId: string, videoSource: VideoSource = 'creator_videos') => {
      if (!videoId) return;
      const existing = items.find((item) => item.videoId === videoId);
      if (existing) {
        await removeById(existing.id);
        return;
      }
      if (!isSignedIn) {
        pendingSaveRef.current = { videoId, videoSource };
        setSignInVisible(true);
        return;
      }
      await persistSave(videoId, videoSource);
    },
    [isSignedIn, items, persistSave, removeById],
  );

  const value = useMemo<WatchLaterContextValue>(
    () => ({
      items,
      loading,
      isSaved,
      toggleSave,
      removeById,
      refresh,
    }),
    [isSaved, items, loading, refresh, removeById, toggleSave],
  );

  return (
    <WatchLaterContext.Provider value={value}>
      {children}
      <SignInSheet
        visible={signInVisible}
        onClose={() => {
          setSignInVisible(false);
          if (!isSignedIn) pendingSaveRef.current = null;
        }}
      />
    </WatchLaterContext.Provider>
  );
}

export function useWatchLater(): WatchLaterContextValue {
  const value = React.useContext(WatchLaterContext);
  if (!value) {
    throw new Error('useWatchLater must be used within WatchLaterProvider');
  }
  return value;
}
