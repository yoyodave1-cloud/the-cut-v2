import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import Svg, { Line, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import type { AngleType } from '../../lib/academy/types';

type Props = {
  visible: boolean;
  angleType: AngleType;
  guidance: string;
  onClose: () => void;
  onRecorded: (uri: string) => void;
};

/**
 * In-app capture with angle-guidance overlay: a framing box plus a centre
 * line (face-on) or ball-target line (down-the-line) so uploads arrive at an
 * analysable angle.
 */
export default function SwingCamera({ visible, angleType, guidance, onClose, onRecorded }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);

  const ensurePermissions = async (): Promise<boolean> => {
    const cam = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    const mic = micPermission?.granted ? micPermission : await requestMicPermission();
    return Boolean(cam?.granted && mic?.granted);
  };

  const startRecording = async () => {
    if (!cameraRef.current || recording) return;
    if (!(await ensurePermissions())) return;
    setStarting(true);
    setRecording(true);
    try {
      const result = await cameraRef.current.recordAsync({ maxDuration: 30 });
      if (result?.uri) onRecorded(result.uri);
    } catch {
      // recording cancelled or failed — stay on the camera
    } finally {
      setRecording(false);
      setStarting(false);
    }
  };

  const stopRecording = () => {
    cameraRef.current?.stopRecording();
  };

  const permissionDenied =
    cameraPermission && !cameraPermission.granted && !cameraPermission.canAskAgain;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {cameraPermission?.granted ? (
          // 720p is plenty for pose tracking and keeps uploads small + fast.
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="video"
            videoQuality="720p"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.permissionPane]}>
            {permissionDenied ? (
              <Text style={styles.permissionText}>
                Camera access is blocked. Enable it in Settings to record a swing, or upload from
                your camera roll instead.
              </Text>
            ) : (
              <TouchableOpacity style={styles.permissionButton} onPress={ensurePermissions}>
                <Text style={styles.permissionButtonText}>Allow camera access</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Angle guidance overlay */}
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Rect
            x="12%"
            y="8%"
            width="76%"
            height="80%"
            fill="none"
            stroke="rgba(255,255,255,0.75)"
            strokeWidth={2}
            strokeDasharray="10 8"
            rx={16}
          />
          {angleType === 'face_on' ? (
            <Line
              x1="50%"
              y1="8%"
              x2="50%"
              y2="88%"
              stroke="rgba(74,144,217,0.85)"
              strokeWidth={2}
              strokeDasharray="4 8"
            />
          ) : (
            <Line
              x1="50%"
              y1="88%"
              x2="50%"
              y2="30%"
              stroke="rgba(74,144,217,0.85)"
              strokeWidth={2}
              strokeDasharray="4 8"
            />
          )}
        </Svg>

        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.guidancePill}>
            <Text style={styles.guidanceText}>{guidance}</Text>
          </View>
        </View>

        <View style={styles.bottomBar}>
          <Text style={styles.angleLabel}>
            {angleType === 'face_on' ? 'Face-on: camera square to your chest' : 'Down-the-line: camera behind the ball-target line'}
          </Text>
          <TouchableOpacity
            style={[styles.recordButton, recording && styles.recordButtonActive]}
            onPress={recording ? stopRecording : startRecording}
            disabled={starting && !recording}
          >
            {starting && !recording ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={recording ? styles.stopIcon : styles.recordIcon} />
            )}
          </TouchableOpacity>
          <Text style={styles.recordHint}>{recording ? 'Tap to stop' : 'Tap to record (max 30s)'}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  permissionPane: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.navy,
  },
  permissionText: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: colors.liveBlue,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 10,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  topBar: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(11,22,41,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guidancePill: {
    flex: 1,
    backgroundColor: 'rgba(11,22,41,0.55)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  guidanceText: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 17,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 10,
  },
  angleLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    backgroundColor: 'rgba(11,22,41,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    overflow: 'hidden',
  },
  recordButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232,68,68,0.35)',
  },
  recordButtonActive: {
    backgroundColor: 'rgba(232,68,68,0.7)',
  },
  recordIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.bogeyRed,
  },
  stopIcon: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  recordHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
  },
});
