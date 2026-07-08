/**
 * 2D pose geometry helpers for Academy swing analysis.
 *
 * All landmark coordinates are normalized to [0, 1] with y increasing
 * downward (image convention). Angles are returned in degrees.
 *
 * MoveNet 17-keypoint order (COCO):
 *   0 nose, 1 left_eye, 2 right_eye, 3 left_ear, 4 right_ear,
 *   5 left_shoulder, 6 right_shoulder, 7 left_elbow, 8 right_elbow,
 *   9 left_wrist, 10 right_wrist, 11 left_hip, 12 right_hip,
 *   13 left_knee, 14 right_knee, 15 left_ankle, 16 right_ankle
 */

const KP = {
  nose: 0,
  leftEye: 1,
  rightEye: 2,
  leftEar: 3,
  rightEar: 4,
  leftShoulder: 5,
  rightShoulder: 6,
  leftElbow: 7,
  rightElbow: 8,
  leftWrist: 9,
  rightWrist: 10,
  leftHip: 11,
  rightHip: 12,
  leftKnee: 13,
  rightKnee: 14,
  leftAnkle: 15,
  rightAnkle: 16,
};

const KEYPOINT_NAMES = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
];

/** Skeleton edges used by the client overlay and by sanity checks here. */
const SKELETON_EDGES = [
  [KP.leftShoulder, KP.rightShoulder],
  [KP.leftShoulder, KP.leftElbow],
  [KP.leftElbow, KP.leftWrist],
  [KP.rightShoulder, KP.rightElbow],
  [KP.rightElbow, KP.rightWrist],
  [KP.leftShoulder, KP.leftHip],
  [KP.rightShoulder, KP.rightHip],
  [KP.leftHip, KP.rightHip],
  [KP.leftHip, KP.leftKnee],
  [KP.leftKnee, KP.leftAnkle],
  [KP.rightHip, KP.rightKnee],
  [KP.rightKnee, KP.rightAnkle],
  [KP.nose, KP.leftEye],
  [KP.nose, KP.rightEye],
  [KP.leftEye, KP.leftEar],
  [KP.rightEye, KP.rightEar],
];

const MIN_SCORE = 0.25;

function pt(frame, index) {
  const k = frame.k[index];
  if (!k || k[2] < MIN_SCORE) return null;
  return { x: k[0], y: k[1], score: k[2] };
}

function mid(a, b) {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, score: Math.min(a.score ?? 1, b.score ?? 1) };
}

function dist(a, b) {
  if (!a || !b) return null;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Interior angle at vertex b of triangle a-b-c, in degrees (0..180). */
function jointAngle(a, b, c) {
  if (!a || !b || !c) return null;
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const m1 = Math.hypot(v1.x, v1.y);
  const m2 = Math.hypot(v2.x, v2.y);
  if (m1 < 1e-6 || m2 < 1e-6) return null;
  const cos = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Signed angle of the line a -> b measured from vertical (image up),
 * in degrees. 0 = perfectly vertical, positive = leaning toward +x.
 */
function tiltFromVertical(a, b) {
  if (!a || !b) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y; // y grows downward
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return null;
  return (Math.atan2(dx, -dy) * 180) / Math.PI;
}

/** Signed angle of the line a -> b from horizontal, degrees. Positive = b lower than a. */
function slopeFromHorizontal(a, b) {
  if (!a || !b) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return null;
  return (Math.atan2(dy, Math.abs(dx)) * 180) / Math.PI;
}

/** Common derived body points for a frame. */
function bodyPoints(frame) {
  const leftShoulder = pt(frame, KP.leftShoulder);
  const rightShoulder = pt(frame, KP.rightShoulder);
  const leftHip = pt(frame, KP.leftHip);
  const rightHip = pt(frame, KP.rightHip);
  return {
    nose: pt(frame, KP.nose),
    leftShoulder,
    rightShoulder,
    leftElbow: pt(frame, KP.leftElbow),
    rightElbow: pt(frame, KP.rightElbow),
    leftWrist: pt(frame, KP.leftWrist),
    rightWrist: pt(frame, KP.rightWrist),
    leftHip,
    rightHip,
    leftKnee: pt(frame, KP.leftKnee),
    rightKnee: pt(frame, KP.rightKnee),
    leftAnkle: pt(frame, KP.leftAnkle),
    rightAnkle: pt(frame, KP.rightAnkle),
    shoulderCenter: mid(leftShoulder, rightShoulder),
    hipCenter: mid(leftHip, rightHip),
  };
}

/** Torso length (shoulder center to hip center) — the scale unit for normalized distances. */
function torsoLength(frame) {
  const b = bodyPoints(frame);
  return dist(b.shoulderCenter, b.hipCenter);
}

/** Average wrist point (falls back to whichever wrist is visible). */
function wristPoint(frame) {
  const b = bodyPoints(frame);
  if (b.leftWrist && b.rightWrist) return mid(b.leftWrist, b.rightWrist);
  return b.leftWrist || b.rightWrist;
}

/** Moving-average smoothing over landmark positions (window must be odd). */
function smoothFrames(frames, window = 5) {
  if (frames.length < 3) return frames;
  const half = Math.floor(window / 2);
  return frames.map((frame, i) => {
    const from = Math.max(0, i - half);
    const to = Math.min(frames.length - 1, i + half);
    const k = frame.k.map((kp, kpIdx) => {
      if (!kp) return kp;
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (let j = from; j <= to; j++) {
        const other = frames[j].k[kpIdx];
        if (other && other[2] >= MIN_SCORE) {
          sx += other[0];
          sy += other[1];
          n++;
        }
      }
      if (n === 0) return kp;
      return [sx / n, sy / n, kp[2]];
    });
    return { ...frame, k };
  });
}

/** Per-frame speed of a tracked point across the sequence (normalized units / second). */
function pointSpeeds(frames, getPoint) {
  const speeds = new Array(frames.length).fill(0);
  let prev = null;
  let prevT = null;
  for (let i = 0; i < frames.length; i++) {
    const p = getPoint(frames[i]);
    if (p && prev && frames[i].t > prevT) {
      speeds[i] = Math.hypot(p.x - prev.x, p.y - prev.y) / (frames[i].t - prevT);
    }
    if (p) {
      prev = p;
      prevT = frames[i].t;
    }
  }
  // Light smoothing so single-frame jitter doesn't create phantom peaks.
  return speeds.map((s, i) => {
    const a = speeds[Math.max(0, i - 1)];
    const b = speeds[Math.min(speeds.length - 1, i + 1)];
    return (a + s + b) / 3;
  });
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function round(v, dp = 1) {
  if (v == null || !Number.isFinite(v)) return null;
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

module.exports = {
  KP,
  KEYPOINT_NAMES,
  SKELETON_EDGES,
  MIN_SCORE,
  pt,
  mid,
  dist,
  jointAngle,
  tiltFromVertical,
  slopeFromHorizontal,
  bodyPoints,
  torsoLength,
  wristPoint,
  smoothFrames,
  pointSpeeds,
  clamp,
  round,
};
