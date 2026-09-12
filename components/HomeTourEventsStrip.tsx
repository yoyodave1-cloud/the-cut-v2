import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useRef } from 'react';
import { FlatList, StyleSheet, type ListRenderItem } from 'react-native';
import { useOpenArticle } from '../ArticleReader';
import {
  EVENT_TILE_STRIDE,
  HOME_INLINE_BADGE_PAD,
  type UpcomingTourEvent,
  getTourScheduleEvents,
  homeTourStripLayout,
  resolveEventLeaderboardUrl,
  upcomingEventScrollTargetIndex,
} from '../lib/upcomingTourEvents';
import UpcomingEventTile from './UpcomingEventTile';

export default function HomeTourEventsStrip({
  tourTitle,
  availableWidth = 0,
}: {
  tourTitle: string;
  availableWidth?: number;
}) {
  const openArticle = useOpenArticle();
  const events = useMemo(() => getTourScheduleEvents(tourTitle), [tourTitle]);
  const layout = useMemo(() => homeTourStripLayout(availableWidth), [availableWidth]);
  const listRef = useRef<FlatList<UpcomingTourEvent>>(null);

  const getItemLayout = useCallback(
    (_: ArrayLike<UpcomingTourEvent> | null | undefined, index: number) => ({
      length: EVENT_TILE_STRIDE,
      offset: EVENT_TILE_STRIDE * index,
      index,
    }),
    [],
  );

  const scrollToCurrent = useCallback(() => {
    if (events.length === 0) return;
    const index = upcomingEventScrollTargetIndex(events, new Date());
    listRef.current?.scrollToOffset({
      offset: EVENT_TILE_STRIDE * index,
      animated: false,
    });
  }, [events]);

  useFocusEffect(
    useCallback(() => {
      const id = requestAnimationFrame(scrollToCurrent);
      return () => cancelAnimationFrame(id);
    }, [scrollToCurrent]),
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
      nestedScrollEnabled
      removeClippedSubviews={false}
      style={[styles.row, { width: layout.viewport }]}
      contentContainerStyle={styles.rowContent}
      getItemLayout={getItemLayout}
      onLayout={scrollToCurrent}
      onScrollToIndexFailed={(info) => {
        listRef.current?.scrollToOffset({
          offset: EVENT_TILE_STRIDE * info.index,
          animated: false,
        });
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexGrow: 0,
    flexShrink: 0,
  },
  rowContent: {
    paddingTop: HOME_INLINE_BADGE_PAD,
  },
});
