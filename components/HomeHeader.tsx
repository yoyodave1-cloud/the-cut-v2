import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

export default function HomeHeader() {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <View style={styles.homeLogoClip}>
          <Image
            source={require('../assets/logo-header-03.png')}
            style={styles.homeLogo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.strapline} numberOfLines={1}>
          Pro golf · Creator golf · All golf
        </Text>
      </View>
      <View style={styles.profileButton}>
        <Ionicons name="person-outline" size={16} color={colors.navy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  homeLogoClip: {
    width: 56,
    height: 56,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  homeLogo: {
    width: 56,
    height: 56,
    transform: [{ scale: 1.85 }],
  },
  strapline: { color: colors.coolGrey, fontSize: 15, fontWeight: '500', flexShrink: 1 },
  profileButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.mutedGrey,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
