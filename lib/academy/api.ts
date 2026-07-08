import type {
  AngleType,
  DashboardData,
  ShotTypeId,
  SwingUpload,
  UploadDetail,
} from './types';

/**
 * Academy API client. Points at the shared Railway backend by default; set
 * an explicit base (e.g. a LAN dev-server URL like http://192.168.1.x:4100)
 * while the academy patch isn't deployed yet.
 */
export const ACADEMY_API_BASE: string = 'http://192.168.1.230:4100';

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
): Promise<SwingUpload[]> {
  const params = new URLSearchParams({ userId });
  if (shotType) params.set('shotType', shotType);
  const json = await getJson<{ uploads: SwingUpload[] }>(`/academy/uploads?${params}`);
  return json.uploads || [];
}

export async function fetchDashboard(userId: string): Promise<DashboardData> {
  return getJson<DashboardData>(`/academy/dashboard?userId=${encodeURIComponent(userId)}`);
}
