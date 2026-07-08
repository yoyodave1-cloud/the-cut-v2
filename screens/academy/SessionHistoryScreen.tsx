import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../constants/colors';
import { SHOT_TYPE_STYLE } from '../../constants/academy';
import { SHOT_TYPE_IDS, SHOT_TYPE_LIBRARY } from '../../lib/academy/shotTypeLibrary';
import { deleteUploadRemote, fetchUploads } from '../../lib/academy/api';
import { deleteLocalVideo } from '../../lib/academy/localVideo';
import { getAcademyUserId } from '../../lib/academy/userId';
import type { SessionSummary, ShotTypeId } from '../../lib/academy/types';
import type { AcademyStackParamList } from '../../navigation/academyStackTypes';

type Props = NativeStackScreenProps<AcademyStackParamList, 'SessionHistory'>;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/**
 * Past sessions, filterable by shot type. Reopen any completed session to see
 * its full saved analysis; delete removes it everywhere — server rows cascade
 * (so trends/averages drop it immediately) and the local video copy goes too.
 */
export default function SessionHistoryScreen({ navigation, route }: Props) {
  const [filter, setFilter] = useState<ShotTypeId | 'all'>(route.params?.shotType ?? 'all');
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const userId = await getAcademyUserId();
      const uploads = await fetchUploads(userId);
      setSessions(uploads);
    } catch {
      setSessions([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const confirmDelete = (session: SessionSummary) => {
    const label = SHOT_TYPE_LIBRARY[session.shot_type]?.label ?? session.shot_type;
    Alert.alert(
      'Delete this session?',
      `The ${label.toLowerCase()} analysis from ${formatDate(session.created_at)} will be removed everywhere — including from your trends and averages. This can't be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(session.id);
            try {
              const userId = await getAcademyUserId();
              await deleteUploadRemote(session.id, userId);
              await deleteLocalVideo(session.id);
              setSessions((prev) => (prev ? prev.filter((s) => s.id !== session.id) : prev));
            } catch (err) {
              Alert.alert('Delete failed', err instanceof Error ? err.message : 'Try again.');
            } finally {
              setDeleting(null);
            }
          },
        },
      ],
    );
  };

  const filtered = (sessions ?? []).filter((s) => filter === 'all' || s.shot_type === filter);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.navy} />
        </TouchableOpacity>
        <Text style={styles.title}>Session history</Text>
      </View>

      <View style={styles.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['all', ...SHOT_TYPE_IDS] as const).map((id) => {
            const active = filter === id;
            const accent = id === 'all' ? colors.navy : SHOT_TYPE_STYLE[id].accent;
            return (
              <TouchableOpacity
                key={id}
                style={[styles.filterChip, active && { backgroundColor: accent, borderColor: accent }]}
                onPress={() => setFilter(id)}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {id === 'all' ? 'All' : SHOT_TYPE_LIBRARY[id].label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {sessions == null ? (
        <View style={styles.centerPane}>
          <ActivityIndicator size="large" color={colors.liveBlue} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerPane}>
          <Ionicons name="film-outline" size={40} color={colors.mutedGrey} />
          <Text style={styles.emptyTitle}>No sessions yet</Text>
          <Text style={styles.emptyText}>
            {filter === 'all'
              ? 'Analyse a swing and it will appear here.'
              : `No ${SHOT_TYPE_LIBRARY[filter as ShotTypeId].label.toLowerCase()} sessions yet.`}
          </Text>
          <TouchableOpacity
            style={styles.emptyCta}
            onPress={() => navigation.navigate('ShotTypeSelect')}
          >
            <Text style={styles.emptyCtaText}>Analyze a new swing</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const style = SHOT_TYPE_STYLE[item.shot_type];
            const def = SHOT_TYPE_LIBRARY[item.shot_type];
            const failed = item.status === 'failed';
            const processing = item.status === 'processing' || item.status === 'uploaded';
            return (
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.8}
                disabled={processing}
                onPress={() =>
                  failed
                    ? Alert.alert('Analysis failed', item.error_message ?? 'This video could not be analysed.')
                    : navigation.navigate('SwingAnalysis', { uploadId: item.id })
                }
              >
                <View style={[styles.rowIcon, { backgroundColor: `${style.accent}1A` }]}>
                  <Ionicons name={style.icon} size={18} color={style.accent} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>{def.label}</Text>
                  <Text style={styles.rowMeta}>
                    {formatDate(item.created_at)} ·{' '}
                    {item.angle_type === 'face_on' ? 'Face-on' : 'Down-the-line'}
                  </Text>
                  {failed ? (
                    <Text style={[styles.rowSummary, { color: colors.bogeyRed }]}>Analysis failed</Text>
                  ) : processing ? (
                    <Text style={styles.rowSummary}>Processing…</Text>
                  ) : item.summary ? (
                    <Text style={styles.rowSummary}>
                      {item.summary.fault_count === 0
                        ? 'No faults found'
                        : item.summary.fault_count === 1
                          ? `1 fault · ${item.summary.top_fault}`
                          : `${item.summary.fault_count} faults · top: ${item.summary.top_fault}`}
                      {item.summary.tempo_ratio != null ? ` · tempo ${item.summary.tempo_ratio}:1` : ''}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => confirmDelete(item)}
                  disabled={deleting === item.id}
                >
                  {deleting === item.id ? (
                    <ActivityIndicator size="small" color={colors.bogeyRed} />
                  ) : (
                    <Ionicons name="trash-outline" size={19} color={colors.mutedGrey} />
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}
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
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: colors.navy,
  },
  filterWrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  filterChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.coolGrey,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  centerPane: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: colors.navy,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.coolGrey,
    textAlign: 'center',
  },
  emptyCta: {
    backgroundColor: colors.navy,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 11,
    marginTop: 6,
  },
  emptyCtaText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: colors.navy,
  },
  rowMeta: {
    fontSize: 12,
    color: colors.mutedGrey,
    marginTop: 1,
  },
  rowSummary: {
    fontSize: 12.5,
    color: colors.coolGrey,
    marginTop: 4,
  },
  deleteButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
