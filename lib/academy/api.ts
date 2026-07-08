import type {
  AngleType,
  DashboardData,
  SessionSummary,
  ShotTypeId,
  UploadDetail,
} from './types';

/**
 * Academy API client — points at the dedicated Academy service on Railway
 * (deployed separately from the shared backend so heavy pose analysis can
 * never affect the main app's API). For local development against
 * backend/academy/server.js, temporarily switch to your LAN address,
 * e.g. 'http://192.168.1.230:4100'.
 */
export const ACADEMY_API_BASE: string = 'https://academy-production-752f.up.railway.app';

export class AcademyApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${ACADEMY_API_BASE}${path}`);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep default message */
    }
    throw new AcademyApiError(message, res.status);
  }
  return (await res.json()) as T;
}

export type UploadSwingParams = {
  uri: string;
  mimeType?: string;
  userId: string;
  shotType: ShotTypeId;
  angleType: AngleType;
};

export async function uploadSwing(params: UploadSwingParams): Promise<{ uploadId: string }> {
  const form = new FormData();
  form.append('video', {
    uri: params.uri,
    name: 'swing.mp4',
    type: params.mimeType || 'video/mp4',
  } as unknown as Blob);
  form.append('userId', params.userId);
  form.append('shotType', params.shotType);
  form.append('angleType', params.angleType);

  const res = await fetch(`${ACADEMY_API_BASE}/academy/uploads`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    let message = `Upload failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* keep default message */
    }
    throw new AcademyApiError(message, res.status);
  }
  const json = await res.json();
  if (!json?.uploadId) throw new AcademyApiError('Upload response missing uploadId', 500);
  return { uploadId: json.uploadId };
}

export async function fetchUploadDetail(uploadId: string): Promise<UploadDetail> {
  return getJson<UploadDetail>(`/academy/uploads/${encodeURIComponent(uploadId)}`);
}

/** Poll an upload until analysis completes or fails (returns the final detail). */
export async function pollUploadUntilDone(
  uploadId: string,
  onTick?: (detail: UploadDetail) => void,
  { intervalMs = 3000, timeoutMs = 240000 } = {},
): Promise<UploadDetail> {
  const started = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const detail = await fetchUploadDetail(uploadId);
    onTick?.(detail);
    if (detail.upload.status === 'complete' || detail.upload.status === 'failed') {
      return detail;
    }
    if (Date.now() - started > timeoutMs) {
      throw new AcademyApiError('Analysis is taking longer than expected — try again shortly.', 408);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

export async function fetchUploads(
  userId: string,
  shotType?: ShotTypeId,
): Promise<SessionSummary[]> {
  const params = new URLSearchParams({ userId });
  if (shotType) params.set('shotType', shotType);
  const json = await getJson<{ uploads: SessionSummary[] }>(`/academy/uploads?${params}`);
  return json.uploads || [];
}

/** Delete one session server-side (its progress rows cascade with it). */
export async function deleteUploadRemote(uploadId: string, userId: string): Promise<void> {
  const res = await fetch(
    `${ACADEMY_API_BASE}/academy/uploads/${encodeURIComponent(uploadId)}?userId=${encodeURIComponent(userId)}`,
    { method: 'DELETE' },
  );
  if (!res.ok && res.status !== 404) {
    throw new AcademyApiError(`Delete failed (${res.status})`, res.status);
  }
}

/** GDPR erase-all: every Academy row for this user. */
export async function deleteAllUserDataRemote(userId: string): Promise<void> {
  const res = await fetch(`${ACADEMY_API_BASE}/academy/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new AcademyApiError(`Erase failed (${res.status})`, res.status);
}

export async function fetchDashboard(userId: string): Promise<DashboardData> {
  return getJson<DashboardData>(`/academy/dashboard?userId=${encodeURIComponent(userId)}`);
}
