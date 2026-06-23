import React from 'react';
import { SafeAreaView, Text, StyleSheet } from 'react-native';
import { colors } from '../constants/colors';

export default function CreatorPage() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Creators</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.navy,
  },
});
