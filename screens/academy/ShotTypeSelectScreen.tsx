import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../constants/colors';
import { SHOT_TYPE_STYLE } from '../../constants/academy';
import { SHOT_TYPE_IDS, SHOT_TYPE_LIBRARY } from '../../lib/academy/shotTypeLibrary';
import type { AcademyStackParamList } from '../../navigation/academyStackTypes';

type Props = NativeStackScreenProps<AcademyStackParamList, 'ShotTypeSelect'>;

/**
 * Step 1 of "Analyze a new swing": pick the discipline. Each shot type routes
 * to its own recording guidance and analysis model — a driver swing and a
 * putting stroke are checked against completely different benchmarks.
 */
export default function ShotTypeSelectScreen({ navigation }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.navy} />
        </TouchableOpacity>
        <Text style={styles.title}>What are we analyzing?</Text>
      </View>
      <Text style={styles.subtitle}>
        Each shot type is measured against its own checkpoints and benchmarks — pick the one you
        want to work on.
      </Text>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {SHOT_TYPE_IDS.map((id) => {
          const def = SHOT_TYPE_LIBRARY[id];
          const style = SHOT_TYPE_STYLE[id];
          return (
            <TouchableOpacity
              key={id}
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('RecordUpload', { shotType: id })}
            >
              <View style={[styles.iconWrap, { backgroundColor: `${style.accent}1A` }]}>
                <Ionicons name={style.icon} size={26} color={style.accent} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{def.label}</Text>
                <Text style={styles.cardSummary} numberOfLines={3}>
                  {def.summary}
                </Text>
                <Text style={[styles.cardMeta, { color: style.accent }]}>
                  {def.phases.length} checkpoints · {def.faults.length} faults tracked
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.mutedGrey} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: colors.navy,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.coolGrey,
    paddingHorizontal: 16,
    marginTop: 6,
    marginBottom: 10,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: colors.navy,
  },
  cardSummary: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.coolGrey,
    marginTop: 3,
  },
  cardMeta: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 6,
  },
});
