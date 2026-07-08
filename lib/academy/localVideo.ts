import * as FileSystem from 'expo-file-system/legacy';

/**
 * On-device video store — the ONLY durable home of a swing video.
 *
 * The backend processes each upload transiently and deletes it; nothing
 * identifiable is retained server-side (the stored record is pose landmark
 * data). Rewatching a past session plays the copy saved here, keyed by
 * uploadId. If the copy is gone (reinstall, new device, storage cleared),
 * screens fall back to skeleton-only playback of the saved analysis.
 */

const DIR = `${FileSystem.documentDirectory}academy-videos/`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DIR, { intermediates: true });
  }
}

function pathFor(uploadId: string): string {
  return `${DIR}${uploadId}.mp4`;
}

/** Copy a just-uploaded video into the local store, keyed by its uploadId. */
export async function saveLocalVideo(uploadId: string, sourceUri: string): Promise<void> {
  try {
    await ensureDir();
    await FileSystem.copyAsync({ from: sourceUri, to: pathFor(uploadId) });
  } catch (err) {
    // Non-fatal: the analysis still works; playback falls back to skeleton-only.
    console.warn('[academy] failed to keep local video copy:', err);
  }
}

/** Local playback URI for a session, or null when the copy no longer exists. */
export async function getLocalVideoUri(uploadId: string): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(pathFor(uploadId));
    return info.exists ? pathFor(uploadId) : null;
  } catch {
    return null;
  }
}

export async function deleteLocalVideo(uploadId: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(pathFor(uploadId), { idempotent: true });
  } catch {
    /* already gone */
  }
}

/** Remove every stored swing video (used by "delete all Academy data"). */
export async function deleteAllLocalVideos(): Promise<void> {
  try {
    await FileSystem.deleteAsync(DIR, { idempotent: true });
  } catch {
    /* already gone */
  }
}
