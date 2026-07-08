import type { ShotTypeId } from '../lib/academy/types';

export type AcademyStackParamList = {
  AcademyDashboard: undefined;
  SessionHistory: { shotType?: ShotTypeId } | undefined;
  ShotTypeSelect: undefined;
  RecordUpload: { shotType: ShotTypeId };
  SwingAnalysis: { uploadId?: string; demoShotType?: ShotTypeId };
  CompareSwings: { shotType: ShotTypeId; uploadId?: string; demoShotType?: ShotTypeId };
  Recommendations: { shotType: ShotTypeId; uploadId?: string; demoShotType?: ShotTypeId };
};
