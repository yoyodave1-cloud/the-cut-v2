import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function SignInSheet({ visible, onClose }: Props) {
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const showApple = Platform.OS === 'ios';

  const run = async (provider: 'apple' | 'google') => {
    if (busy) return;
    setBusy(provider);
    try {
      const signedIn = provider === 'apple' ? await signInWithApple() : await signInWithGoogle();
      if (!signedIn) return;
      // Parent closes this sheet after the session lands, then saves the pending video.
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => undefined}>
          <Text style={styles.title}>Save to Watch Later</Text>
          <Text style={styles.subtitle}>
            Sign in to keep this video on your list. The rest of the app stays open without an
            account.
          </Text>

          {showApple ? (
            busy === 'apple' ? (
              <View style={styles.appleBusy}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={10}
                style={styles.appleButton}
                onPress={() => run('apple')}
              />
            )
          ) : null}

          {/* Google Sign-In disabled — native iOS SDK auto-embeds a nonce that this library version can't expose, causing a Supabase auth mismatch. Needs either a switch to expo-auth-session or a native patch. Re-enable once fixed.
          <TouchableOpacity
            style={styles.googleButton}
            activeOpacity={0.85}
            onPress={() => run('google')}
            disabled={busy != null}
          >
            {busy === 'google' ? (
              <ActivityIndicator color={colors.navy} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={colors.navy} />
                <Text style={styles.googleLabel}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
          */}

          <TouchableOpacity onPress={onClose} style={styles.cancelWrap} disabled={busy != null}>
            <Text style={styles.cancel}>Not now</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,22,41,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: colors.navy,
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 20,
    color: colors.coolGrey,
  },
  appleButton: {
    width: '100%',
    height: 44,
    marginBottom: 10,
  },
  appleBusy: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  googleButton: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  googleLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: colors.navy,
  },
  cancelWrap: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 4,
  },
  cancel: {
    fontSize: 14,
    color: colors.mutedGrey,
  },
});
