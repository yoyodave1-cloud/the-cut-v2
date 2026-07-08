import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../../constants/colors';
import { SHOT_TYPE_STYLE } from '../../constants/academy';
import { SHOT_TYPE_LIBRARY } from '../../lib/academy/shotTypeLibrary';
import { uploadSwing } from '../../lib/academy/api';
import { getAcademyUserId } from '../../lib/academy/userId';
import SwingCamera from '../../components/academy/SwingCamera';
import type { AngleType } from '../../lib/academy/types';
import type { AcademyStackParamList } from '../../navigation/academyStackTypes';

type Props = NativeStackScreenProps<AcademyStackParamList, 'RecordUpload'>;

const GENERAL_TIPS = [
  { icon: 'resize-outline' as const, text: 'Stand 3–4 metres from the camera with your whole body and club in frame for the entire swing.' },
  { icon: 'sunny-outline' as const, text: 'Film in good light and avoid shooting straight into the sun — the tracker needs to see your joints.' },
  { icon: 'phone-portrait-outline' as const, text: 'Portrait orientation, camera steady (prop it up or use a tripod), one swing per clip.' },
  { icon: 'time-outline' as const, text: 'Keep the clip short: a second of stillness at address, the swing, and the finish is perfect.' },
];

/**
 * Record or upload a swing for the chosen shot type, with per-angle guidance
 * so the footage arrives analysable.
 */
export default function RecordUploadScreen({ navigation, route }: Props) {
  const { shotType } = route.params;
  const def = SHOT_TYPE_LIBRARY[shotType];
  const accent = SHOT_TYPE_STYLE[shotType].accent;

  const [angleType, setAngleType] = useState<AngleType>('face_on');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const submitVideo = async (uri: string, mimeType?: string) => {
    setUploading(true);
    try {
      const userId = await getAcademyUserId();
      const { uploadId } = await uploadSwing({ uri, mimeType, userId, shotType, angleType });
      navigation.replace('SwingAnalysis', { uploadId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      Alert.alert(
        'Upload failed',
        `${message}\n\nIf the Academy backend isn't reachable yet, you can explore a demo analysis instead.`,
        [
          { text: 'View demo analysis', onPress: () => navigation.replace('SwingAnalysis', { demoShotType: shotType }) },
          { text: 'OK', style: 'cancel' },
        ],
      );
    } finally {
      setUploading(false);
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to upload a swing video.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      videoMaxDuration: 30,
      quality: 0.8,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.uri) {
      submitVideo(asset.uri, asset.mimeType ?? 'video/mp4');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.navy} />
        </TouchableOpacity>
        <Text style={styles.title}>{def.label}</Text>
        <View style={[styles.typeDot, { backgroundColor: accent }]} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>Camera angle</Text>
        <View style={styles.angleRow}>
          {(['face_on', 'down_the_line'] as AngleType[]).map((angle) => {
            const active = angleType === angle;
            return (
              <TouchableOpacity
                key={angle}
                style={[styles.angleCard, active && { borderColor: accent, backgroundColor: `${accent}14` }]}
                onPress={() => setAngleType(angle)}
              >
                <Ionicons
                  name={angle === 'face_on' ? 'person-outline' : 'walk-outline'}
                  size={22}
                  color={active ? accent : colors.mutedGrey}
                />
                <Text style={[styles.angleTitle, active && { color: accent }]}>
                  {angle === 'face_on' ? 'Face-on' : 'Down-the-line'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.guidanceCard}>
          <Ionicons name="videocam-outline" size={18} color={accent} style={{ marginTop: 1 }} />
          <Text style={styles.guidanceText}>{def.recordingTips[angleType]}</Text>
        </View>

        <Text style={styles.sectionLabel}>Before you film</Text>
        <View style={styles.tipsCard}>
          {GENERAL_TIPS.map((tip, i) => (
            <View key={i} style={[styles.tipRow, i > 0 && styles.tipRowBorder]}>
              <Ionicons name={tip.icon} size={18} color={colors.coolGrey} />
              <Text style={styles.tipText}>{tip.text}</Text>
            </View>
          ))}
        </View>

        {uploading ? (
          <View style={styles.uploadingCard}>
            <ActivityIndicator color={accent} />
            <Text style={styles.uploadingText}>Uploading your swing…</Text>
          </View>
        ) : (
          <View style={styles.buttonsCol}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: accent }]}
              onPress={() => setCameraOpen(true)}
            >
              <Ionicons name="videocam" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Record now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={pickFromLibrary}>
              <Ionicons name="images-outline" size={20} color={colors.navy} />
              <Text style={styles.secondaryButtonText}>Upload from camera roll</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.demoLink}
              onPress={() => navigation.navigate('SwingAnalysis', { demoShotType: shotType })}
            >
              <Text style={styles.demoLinkText}>Just exploring? View a demo analysis</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <SwingCamera
        visible={cameraOpen}
        angleType={angleType}
        guidance={def.recordingTips[angleType]}
        onClose={() => setCameraOpen(false)}
        onRecorded={(uri) => {
          setCameraOpen(false);
          submitVideo(uri, 'video/mp4');
        }}
      />
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
  typeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  sectionLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: colors.mutedGrey,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 8,
  },
  angleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  angleCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  angleTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: colors.coolGrey,
  },
  guidanceCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginTop: 10,
  },
  guidanceText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.coolGrey,
  },
  tipsCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  tipRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.bg,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.coolGrey,
  },
  buttonsCol: {
    marginTop: 20,
    gap: 10,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 15,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.navy,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  demoLink: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  demoLinkText: {
    fontSize: 13,
    color: colors.liveBlue,
    fontFamily: 'Inter_600SemiBold',
  },
  uploadingCard: {
    marginTop: 24,
    alignItems: 'center',
    gap: 10,
    paddingVertical: 20,
  },
  uploadingText: {
    fontSize: 14,
    color: colors.coolGrey,
  },
});
