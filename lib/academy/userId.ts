import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'academy:user-id';
let cached: string | null = null;

/**
 * Anonymous per-install user id for Academy uploads/progress. When real auth
 * lands, map this device id to the auth user server-side — the academy_*
 * tables use text user_ids for exactly that reason.
 */
export async function getAcademyUserId(): Promise<string> {
  if (cached) return cached;
  const existing = await AsyncStorage.getItem(KEY);
  if (existing) {
    cached = existing;
    return existing;
  }
  const fresh = `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(KEY, fresh);
  cached = fresh;
  return fresh;
}
