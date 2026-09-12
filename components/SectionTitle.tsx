import React, { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { colors } from '../constants/colors';
import { HOME_INLINE_CIRCLE_BAND, HOME_TITLE_TRAILING_GAP } from '../lib/upcomingTourEvents';

export default function SectionTitle({
  subtitle,
  big,
  small,
  scheme,
  trailing,
}: {
  subtitle?: string;
  big: string;
  small: string;
  scheme: 'light' | 'dark';
  trailing?: React.ReactNode | ((availableWidth: number) => React.ReactNode);
}) {
  const [rowWidth, setRowWidth] = useState(0);
  const [wordsWidth, setWordsWidth] = useState(0);
  const availableWidth =
    rowWidth > 0 && wordsWidth > 0
      ? Math.max(0, rowWidth - wordsWidth - HOME_TITLE_TRAILING_GAP)
      : 0;

  const onRowLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setRowWidth((current) => (current === width ? current : width));
  };

  const onWordsLayout = (event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    setWordsWidth((current) => (current === width ? current : width));
  };

  const trailingNode =
    typeof trailing === 'function' ? trailing(availableWidth) : trailing;

  const subtitleNode = subtitle ? (
    <Text style={[styles.sectionSubtitle, scheme === 'light' && styles.sectionSubtitleLight]}>
      {subtitle}
    </Text>
  ) : null;

  const titleWords = (
    <View style={[styles.sectionTitleWords, trailing ? styles.sectionTitleWordsWithTrailing : null]}>
      <View collapsable={false} style={styles.sectionTitleBigWrap}>
        <Text style={[styles.sectionTitleBig, scheme === 'light' && styles.sectionTitleBigLight]}>
          {big}
        </Text>
      </View>
      <Text style={[styles.sectionTitleSmall, scheme === 'light' && styles.sectionTitleSmallLight]}>
        {small}
      </Text>
    </View>
  );

  if (trailing) {
    return (
      <View
        style={[styles.sectionTitleRow, styles.sectionTitleRowWithTrailing]}
        onLayout={onRowLayout}
      >
        <View style={styles.sectionTitleStack} onLayout={onWordsLayout}>
          {subtitleNode}
          {titleWords}
        </View>
        {trailingNode}
      </View>
    );
  }

  return (
    <View>
      {subtitleNode}
      <View style={styles.sectionTitleRow}>{titleWords}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionSubtitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: 0.96,
    textTransform: 'uppercase',
    color: '#9EEFFB',
    marginBottom: 6,
  },
  sectionSubtitleLight: { color: colors.subtitleBlue },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: HOME_TITLE_TRAILING_GAP,
    marginBottom: 10,
    overflow: 'visible',
  },
  sectionTitleRowWithTrailing: {
    alignItems: 'flex-start',
    flexWrap: 'nowrap',
    overflow: 'visible',
  },
  sectionTitleStack: {
    height: HOME_INLINE_CIRCLE_BAND,
    justifyContent: 'center',
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'visible',
  },
  sectionTitleWords: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: HOME_TITLE_TRAILING_GAP,
    overflow: 'visible',
  },
  sectionTitleWordsWithTrailing: {
    flexGrow: 0,
    flexShrink: 0,
    flexWrap: 'nowrap',
  },
  sectionTitleBigWrap: {
    marginTop: -8,
    overflow: 'visible',
  },
  sectionTitleBig: {
    fontFamily: 'RockSalt_400Regular',
    fontSize: 40,
    lineHeight: 72,
    letterSpacing: -0.4,
    color: colors.voltCyan,
    textAlignVertical: 'bottom',
  },
  sectionTitleBigLight: { color: colors.liveBlue },
  sectionTitleSmall: {
    fontFamily: 'PlayfairDisplay_900Black',
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.22,
    textTransform: 'uppercase',
    color: '#FFFFFF',
    paddingBottom: 20,
  },
  sectionTitleSmallLight: { color: colors.navy },
});
