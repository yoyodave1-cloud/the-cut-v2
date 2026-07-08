import type { ShotTypeId, UploadDetail } from './types';
import { makeDemoUploadDetail } from './demoData';

/** Session cache so Analysis -> Compare -> Recommendations don't refetch. */
const cache = new Map<string, UploadDetail>();

export function cacheDetail(detail: UploadDetail) {
  if (detail.upload?.id) cache.set(detail.upload.id, detail);
}

export function getCachedDetail(uploadId: string): UploadDetail | undefined {
  return cache.get(uploadId);
}

const demoCache = new Map<ShotTypeId, UploadDetail>();

export function getDemoDetail(shotType: ShotTypeId): UploadDetail {
  let detail = demoCache.get(shotType);
  if (!detail) {
    detail = makeDemoUploadDetail(shotType);
    demoCache.set(shotType, detail);
  }
  return detail;
}
