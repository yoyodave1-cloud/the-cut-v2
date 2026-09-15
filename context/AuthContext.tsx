import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Alert, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isSignedIn: boolean;
  isReady: boolean;
  signInWithApple: () => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

let googleConfigured = false;

function configureGoogleSignIn() {
  if (googleConfigured) return true;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (!webClientId) return false;
  GoogleSignin.configure({
    webClientId,
    ...(iosClientId ? { iosClientId } : {}),
  });
  googleConfigured = true;
  return true;
}

function isAuthCancelled(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code) : '';
  return (
    code === statusCodes.SIGN_IN_CANCELLED ||
    code === 'ERR_REQUEST_CANCELED' ||
    code === 'ERR_CANCELED'
  );
}

export function userDisplayName(user: User | null): string {
  if (!user) return '';
  const meta = user.user_metadata ?? {};
  const fullName =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    [meta.given_name, meta.family_name].filter((part) => typeof part === 'string' && part).join(' ');
  return fullName || user.email || 'Signed in';
}

export function userAvatarUrl(user: User | null): string | undefined {
  if (!user) return undefined;
  const meta = user.user_metadata ?? {};
  const url = meta.avatar_url || meta.picture;
  return typeof url === 'string' && url.trim() ? url.trim() : undefined;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      configureGoogleSignIn();
    }

    if (!isSupabaseConfigured) {
      setIsReady(true);
      return;
    }

    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) {
        setSession(data.session ?? null);
        setIsReady(true);
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signInWithApple = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      Alert.alert('Sign-in unavailable', 'Supabase Auth is not configured yet.');
      return false;
    }
    if (Platform.OS !== 'ios') {
      Alert.alert('Sign in with Apple', 'Available on iPhone and iPad.');
      return false;
    }

    try {
      const available = await AppleAuthentication.isAvailableAsync();
      if (!available) {
        Alert.alert('Sign in with Apple', 'Apple sign-in is not available on this device.');
        return false;
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        Alert.alert('Sign-in failed', 'Apple did not return an identity token.');
        return false;
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) {
        Alert.alert('Sign-in failed', error.message);
        return false;
      }

      const given = credential.fullName?.givenName;
      const family = credential.fullName?.familyName;
      const fullName = [given, family].filter(Boolean).join(' ');
      if (fullName) {
        await supabase.auth.updateUser({ data: { full_name: fullName } });
      }
      return true;
    } catch (error) {
      if (isAuthCancelled(error)) return false;
      Alert.alert(
        'Sign-in failed',
        error instanceof Error ? error.message : 'Could not sign in with Apple.',
      );
      return false;
    }
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    if (!isSupabaseConfigured) {
      Alert.alert('Sign-in unavailable', 'Supabase Auth is not configured yet.');
      return false;
    }
    if (Platform.OS === 'web') {
      Alert.alert('Sign-in unavailable', 'Google sign-in works in the iOS and Android apps.');
      return false;
    }
    if (!configureGoogleSignIn()) {
      Alert.alert(
        'Sign-in unavailable',
        'Google sign-in is not configured yet. Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.',
      );
      return false;
    }

    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }
      const response = await GoogleSignin.signIn();
      if (response.type === 'cancelled') return false;
      const idToken = response.data?.idToken;
      if (!idToken) {
        Alert.alert('Sign-in failed', 'Google did not return an ID token.');
        return false;
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error) {
        Alert.alert('Sign-in failed', error.message);
        return false;
      }
      return true;
    } catch (error) {
      if (isAuthCancelled(error)) return false;
      Alert.alert(
        'Sign-in failed',
        error instanceof Error ? error.message : 'Could not sign in with Google.',
      );
      return false;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (Platform.OS !== 'web') {
        await GoogleSignin.signOut().catch(() => undefined);
      }
    } finally {
      await supabase.auth.signOut();
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      isSignedIn: Boolean(session?.user),
      isReady,
      signInWithApple,
      signInWithGoogle,
      signOut,
    }),
    [isReady, session, signInWithApple, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return value;
}
