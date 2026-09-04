import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../constants/colors';

export default function SectionTitle({
  subtitle,
  big,
  small,
  scheme,
}: {
  subtitle?: string;
  big: string;
  small: string;
  scheme: 'light' | 'dark';
}) {
  return (
    <View>
      {subtitle ? (
        <Text style={[styles.sectionSubtitle, scheme === 'light' && styles.sectionSubtitleLight]}>
          {subtitle}
        </Text>
      ) : null}
      <View style={styles.sectionTitleRow}>
        <View collapsable={false} style={styles.sectionTitleBigWrap}>
          <Text style={[styles.sectionTitleBig, scheme === 'light' && styles.sectionTitleBigLight]}>
            {big}
          </Text>
        </View>
        <Text style={[styles.sectionTitleSmall, scheme === 'light' && styles.sectionTitleSmallLight]}>
          {small}
        </Text>
      </View>
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
    gap: 10,
    marginBottom: 10,
    overflow: 'visible',
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
