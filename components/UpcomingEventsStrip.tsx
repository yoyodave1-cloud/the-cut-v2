import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef } from 'react';
import { FlatList, StyleSheet, type ListRenderItem } from 'react-native';
import { useOpenArticle } from '../ArticleReader';
import {
  EVENT_TILE_STRIDE,
  type UpcomingTourEvent,
  getMergedUpcomingTourEvents,
  resolveEventLeaderboardUrl,
  upcomingEventScrollTargetIndex,
} from '../lib/upcomingTourEvents';
import UpcomingEventTile from './UpcomingEventTile';

export default function UpcomingEventsStrip() {
  const openArticle = useOpenArticle();
  const events = useMemo(() => getMergedUpcomingTourEvents(), []);
  const listRef = useRef<FlatList<UpcomingTourEvent>>(null);

  const getItemLayout = useCallback(
    (_: ArrayLike<UpcomingTourEvent> | null | undefined, index: number) => ({
      length: EVENT_TILE_STRIDE,
      offset: EVENT_TILE_STRIDE * index,
      index,
    }),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      if (events.length === 0) return;
      const target = upcomingEventScrollTargetIndex(events, new Date());
      const id = requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({
          index: target,
          viewPosition: 0,
          animated: false,
        });
      });
      return () => cancelAnimationFrame(id);
    }, [events]),
  );

  const renderEvent: ListRenderItem<UpcomingTourEvent> = useCallback(
    ({ item }) => (
      <UpcomingEventTile
        item={item}
        onPress={() => openArticle(resolveEventLeaderboardUrl(item), item.fullName)}
      />
    ),
    [openArticle],
  );

  if (events.length === 0) return null;

  return (
    <FlatList
      ref={listRef}
      horizontal
      data={events}
      keyExtractor={(item) => item.id}
      renderItem={renderEvent}
      showsHorizontalScrollIndicator={false}
      removeClippedSubviews
      style={styles.eventsRow}
      contentContainerStyle={styles.eventsRowContent}
      getItemLayout={getItemLayout}
      onScrollToIndexFailed={(info) => {
        listRef.current?.scrollToOffset({
          offset: info.averageItemLength * info.index,
          animated: false,
        });
      }}
    />
  );
}

const styles = StyleSheet.create({
  eventsRow: { flexGrow: 0 },
  eventsRowContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6 },
});
