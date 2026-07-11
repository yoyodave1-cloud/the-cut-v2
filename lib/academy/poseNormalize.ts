/**
 * Pose normalization + deviation helpers for the Compare overlay.
 *
 * Makes two skeletons captured from different videos (different framing,
 * subject height, and handedness) spatially comparable by anchoring the hip
 * centre, rescaling to a fixed display torso, and optionally mirroring. Pure
 * functions only — no React, no rendering.
 */
import type { LandmarkTuple, PoseFrame } from './types';

const MIN_SCORE = 0.25;

// Fixed anchor + display size in normalized (0..1) space.
const ANCHOR_X = 0.5;
const ANCHOR_Y = 0.62;
const DISPLAY_TORSO = 0.22;
// Never divide by a torso shorter than this (degenerate/near-zero poses).
const MIN_TORSO = 0.02;

/**
 * Deviation thresholds in display-torso units. First-pass values — expected to
 * be tuned once we have real-footage testing (tracking noise vs genuine fault).
 */
export const DEVIATION_OK = 0.35; // <= matches the reference
export const DEVIATION_WARN = 0.7; // between OK and WARN = drifting; above = off

// COCO left/right keypoint pairs, for mirroring a left-handed swing onto a
// right-handed reference (and vice versa). Non-paired joints map to themselves.
const SWAP = [0, 2, 1, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11, 14, 13, 16, 15];

export { DISPLAY_TORSO };

/** Carry-forward anchor/scale from the most recent well-tracked frame. */
export type NormalizeCarry = {
  hip: { x: number; y: number } | null;
  torso: number | null;
};

export type NormalizeOpts = {
  /** Mirror left/right so opposite-handed swings overlay correctly. */
  mirror?: boolean;
  /** Mutable carry threaded across a sequence; updated in place. */
  carry?: NormalizeCarry;
};

function midpoint(
  k: LandmarkTuple[],
  i: number,
  j: number,
): { x: number; y: number } | null {
  const a = k[i];
  const b = k[j];
  if (!a || !b || a[2] < MIN_SCORE || b[2] < MIN_SCORE) return null;
  return { x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 };
}

/**
 * Normalize a single frame: translate the hip centre to the fixed anchor,
 * rescale so the shoulder-to-hip torso length maps to DISPLAY_TORSO, and
 * optionally mirror. Falls back to the carried anchor/scale when hips or
 * shoulders are missing/low-confidence; returns the frame unchanged if no
 * carry is available yet.
 */
export function normalizeFrame(frame: PoseFrame, opts: NormalizeOpts = {}): PoseFrame {
  const { mirror = false, carry } = opts;
  const k = frame.k;

  const hip = midpoint(k, 11, 12);
  const shoulder = midpoint(k, 5, 6);

  let anchorHip = hip;
  let torso =
    hip && shoulder ? Math.hypot(shoulder.x - hip.x, shoulder.y - hip.y) : null;

  if (!anchorHip || torso === null) {
    // Hips or shoulders untracked this frame — reuse the last good values.
    if (carry && carry.hip && carry.torso !== null) {
      anchorHip = carry.hip;
      torso = carry.torso;
    } else {
      return frame; // nothing to anchor to yet
    }
  } else if (carry) {
    carry.hip = anchorHip;
    carry.torso = torso;
  }

  const scale = DISPLAY_TORSO / Math.max(torso, MIN_TORSO);

  const normalized: LandmarkTuple[] = k.map((kp) => {
    const [x, y, s] = kp;
    return [
      ANCHOR_X + (x - anchorHip!.x) * scale,
      ANCHOR_Y + (y - anchorHip!.y) * scale,
      s,
    ];
  });

  if (!mirror) return { t: frame.t, k: normalized };

  // Flip x around the anchor AND relabel left/right so semantic joints match.
  const mirrored: LandmarkTuple[] = normalized.map((_, i) => {
    const src = normalized[SWAP[i]];
    return [2 * ANCHOR_X - src[0], src[1], src[2]];
  });
  return { t: frame.t, k: mirrored };
}

/**
 * Normalize a whole sequence, threading carry through a closure so untracked
 * frames inherit the most recent good anchor/scale.
 */
export function normalizeSequence(frames: PoseFrame[], mirror = false): PoseFrame[] {
  const carry: NormalizeCarry = { hip: null, torso: null };
  return frames.map((f) => normalizeFrame(f, { mirror, carry }));
}

/**
 * Per-keypoint Euclidean distance between two already-normalized frames,
 * expressed in display-torso units. Returns null for a keypoint where either
 * side is missing/low-confidence.
 */
export function deviationPerKeypoint(
  userFrame: PoseFrame,
  refFrame: PoseFrame,
): (number | null)[] {
  const n = Math.min(userFrame.k.length, refFrame.k.length);
  const out: (number | null)[] = [];
  for (let i = 0; i < n; i++) {
    const u = userFrame.k[i];
    const r = refFrame.k[i];
    if (!u || !r || u[2] < MIN_SCORE || r[2] < MIN_SCORE) {
      out.push(null);
      continue;
    }
    out.push(Math.hypot(u[0] - r[0], u[1] - r[1]) / DISPLAY_TORSO);
  }
  return out;
}

/**
 * Average several per-keypoint deviation arrays (a moving window), ignoring
 * nulls. A keypoint is null in the result only when null in every input.
 */
export function averageDeviations(windows: (number | null)[][]): (number | null)[] {
  const len = windows.reduce((m, w) => Math.max(m, w.length), 0);
  const out: (number | null)[] = [];
  for (let i = 0; i < len; i++) {
    let sum = 0;
    let count = 0;
    for (const w of windows) {
      const v = w[i];
      if (v != null) {
        sum += v;
        count += 1;
      }
    }
    out.push(count > 0 ? sum / count : null);
  }
  return out;
}
