import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  EVENT_TILE_WIDTH,
  circleLabelForEvent,
  isEventLive,
  outlineColorForEvent,
  type UpcomingTourEvent,
} from '../lib/upcomingTourEvents';
import { colors } from '../constants/colors';
import UpcomingEventCircle from './UpcomingEventCircle';

type UpcomingEventTileProps = {
  item: UpcomingTourEvent;
  onPress: () => void;
};

export default function UpcomingEventTile({ item, onPress }: UpcomingEventTileProps) {
  const live = isEventLive(item);

  return (
    <TouchableOpacity activeOpacity={0.8} style={styles.eventTile} onPress={onPress}>
      <UpcomingEventCircle
        borderColor={outlineColorForEvent(item)}
        label={circleLabelForEvent(item)}
        live={live}
      />
      <Text style={styles.tourLabel} numberOfLines={2}>
        {item.fullName}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  eventTile: {
    width: EVENT_TILE_WIDTH,
    alignItems: 'center',
    marginRight: 10,
  },
  tourLabel: {
    fontSize: 12,
    color: colors.coolGrey,
    textAlign: 'center',
    lineHeight: 15,
  },
});
