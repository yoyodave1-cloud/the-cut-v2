/** Shared Academy types — mirror of the backend academy payload shapes. */

export type ShotTypeId = 'driving' | 'iron' | 'bunker' | 'chipping' | 'putting';
export type AngleType = 'face_on' | 'down_the_line';

export type Benchmark = { min: number; ideal: number; max: number };

export type PhaseDef = { id: string; label: string; description: string };

export type MetricDef = {
  id: string;
  label: string;
  unit: string;
  angle: AngleType | 'any';
  phase: string;
  benchmark: Benchmark;
  description: string;
  progressMetric?: boolean;
};

export type FaultDef = {
  tag: string;
  name: string;
  angle: AngleType | 'any';
  phase: string;
  description: string;
  tip: string;
  drill: string;
  searchKeywords: string[];
};

export type ShotTypeDef = {
  id: ShotTypeId;
  label: string;
  swingClass: 'full' | 'short' | 'stroke';
  summary: string;
  phases: PhaseDef[];
  tempo: { idealRatio: number; min: number; max: number; label: string };
  metrics: MetricDef[];
  faults: FaultDef[];
  recordingTips: Record<AngleType, string>;
};

/** [x, y, score], all normalized to the video frame. */
export type LandmarkTuple = [number, number, number];
export type PoseFrame = { t: number; k: LandmarkTuple[] };

export type PerFrameAngles = {
  spine: number | null;
  leadArm: number | null;
  shoulderLine: number | null;
  hipLine: number | null;
  kneeFlex: number | null;
};

export type Keyframes = Record<string, { index: number; t: number }>;

export type JointAngleData = {
  model: string;
  fps: number;
  duration: number;
  video_aspect: number | null;
  angle_type: AngleType;
  keypoint_names: string[];
  skeleton_edges: [number, number][];
  target_dir: number;
  lead_side: 'left' | 'right';
  tracking_quality: 'low' | 'medium' | 'high';
  keyframes: Keyframes;
  frames: PoseFrame[];
  per_frame_angles: PerFrameAngles[];
};

export type CheckStatus = 'good' | 'warning' | 'fault' | 'unmeasured';

export type CheckResult = {
  metric: string;
  label: string;
  unit: string;
  value: number | null;
  benchmark: Benchmark;
  status: CheckStatus;
  description: string;
};

export type CheckpointResult = {
  phase: string;
  label: string;
  description: string;
  checks: CheckResult[];
};

export type IdentifiedFault = {
  tag: string;
  name: string;
  phase: string;
  severity: number;
  metric: string;
  metricLabel: string;
  value: number | null;
  unit: string;
  description: string;
  tip: string;
  drill: string;
};

export type Coaching = {
  summary: string;
  tips: { fault_tag: string; tip: string; drill?: string }[];
  model: string;
  generated_at: string;
};

export type SwingAnalysis = {
  id?: string;
  upload_id?: string;
  shot_type: ShotTypeId;
  tempo_ratio: number | null;
  identified_faults: IdentifiedFault[];
  checkpoint_results: CheckpointResult[];
  metrics: Record<string, number | null>;
  joint_angle_data: JointAngleData;
  coaching?: Coaching | null;
};

export type Recommendation = {
  fault_tag: string;
  reason: string;
  rank: number;
  youtube_video_id: string | null;
  video_title: string | null;
  creator_name: string | null;
  creator_avatar: string | null;
};

export type UploadStatus = 'uploaded' | 'processing' | 'complete' | 'failed';

/**
 * Server upload record. Note there is intentionally no video URL: raw video
 * is never stored server-side. Playback uses the on-device copy keyed by
 * this id (lib/academy/localVideo.ts).
 */
export type SwingUpload = {
  id: string;
  shot_type: ShotTypeId;
  angle_type: AngleType;
  status: UploadStatus;
  error_message?: string | null;
  created_at: string;
};

/** History row: upload + lightweight analysis summary for list rendering. */
export type SessionSummary = {
  id: string;
  shot_type: ShotTypeId;
  angle_type: AngleType;
  status: UploadStatus;
  error_message: string | null;
  created_at: string;
  summary: {
    tempo_ratio: number | null;
    fault_count: number;
    top_fault: string | null;
  } | null;
};

export type UploadDetail = {
  upload: SwingUpload;
  analysis: SwingAnalysis | null;
  recommendations: Recommendation[];
  /** True when this payload is bundled demo data rather than a real upload. */
  demo?: boolean;
};

export type FocusFault = { tag: string; name: string; count: number; severity: number };
export type TrendPoint = { value: number; recordedAt: string; uploadId?: string | null };

export type ShotTypeDashboard = {
  uploadCount: number;
  lastUploadAt: string | null;
  lastUploadId: string | null;
  focusFaults: FocusFault[];
  trends: Record<string, TrendPoint[]>;
};

export type DashboardRecommendation = {
  faultTag: string;
  reason: string;
  shotType: ShotTypeId;
  youtubeVideoId: string | null;
  videoTitle: string | null;
  creatorName: string | null;
  creatorAvatar: string | null;
};

export type DashboardData = {
  shotTypes: Record<ShotTypeId, ShotTypeDashboard>;
  recentRecommendations: DashboardRecommendation[];
  demo?: boolean;
};
