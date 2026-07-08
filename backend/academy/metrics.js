/**
 * Metric computation — turns a landmark sequence + detected phases into the
 * measured values the checkpoint library benchmarks against.
 *
 * Every function here is a 2D measurement or an explicitly documented 2D
 * proxy (see checkpoints.js descriptions). Values are null when the required
 * landmarks aren't confidently visible — never guessed.
 */

const {
  bodyPoints,
  torsoLength,
  wristPoint,
  jointAngle,
  tiltFromVertical,
  slopeFromHorizontal,
  pointSpeeds,
  dist,
  mid,
  clamp,
  round,
} = require('./geometry');

function median(values) {
  const v = values.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.floor(v.length / 2)];
}

function buildContext(frames, phases, angleType) {
  const { indices, targetDir, leadSide } = phases;
  const dt = frames.length > 1 ? frames[1].t - frames[0].t : 1 / 24;
  const torso = median(frames.map((f) => torsoLength(f)));
  const speeds = pointSpeeds(frames, wristPoint);
  const body = (i) => bodyPoints(frames[clamp(i, 0, frames.length - 1)]);
  const at = (phase) => indices[phase];
  const after = (i, seconds) => clamp(i + Math.round(seconds / dt), 0, frames.length - 1);
  const lead = (b, part) => (leadSide === 'left' ? b[`left${part}`] : b[`right${part}`]);
  const trail = (b, part) => (leadSide === 'left' ? b[`right${part}`] : b[`left${part}`]);
  return { frames, indices, targetDir, leadSide, angleType, dt, torso, speeds, body, at, after, lead, trail };
}

/** Apparent rotation from foreshortening of a landmark pair's x-width (face-on 2D proxy). */
function apparentTurn(widthNow, widthRef) {
  if (widthNow == null || widthRef == null || widthRef < 1e-4) return null;
  return (Math.acos(clamp(widthNow / widthRef, 0, 1)) * 180) / Math.PI;
}

function xWidth(a, b) {
  if (!a || !b) return null;
  return Math.abs(a.x - b.x);
}

function pctTorso(value, ctx) {
  if (value == null || ctx.torso == null || ctx.torso < 1e-4) return null;
  return (value / ctx.torso) * 100;
}

/** Max displacement of the hands from a reference point over [from..to]. */
function maxWristDisp(ctx, refPoint, from, to) {
  let max = 0;
  for (let i = from; i <= to; i++) {
    const w = wristPoint(ctx.frames[i]);
    const d = dist(w, refPoint);
    if (d != null && d > max) max = d;
  }
  return max;
}

/** Elbow bend of the lead arm (0° = straight) at frame i. */
function leadArmBend(ctx, i) {
  const b = ctx.body(i);
  const ang = jointAngle(ctx.lead(b, 'Shoulder'), ctx.lead(b, 'Elbow'), ctx.lead(b, 'Wrist'));
  return ang == null ? null : 180 - ang;
}

function kneeFlexAt(ctx, i) {
  const b = ctx.body(i);
  const left = jointAngle(b.leftHip, b.leftKnee, b.leftAnkle);
  const right = jointAngle(b.rightHip, b.rightKnee, b.rightAnkle);
  const flexes = [left, right].filter((a) => a != null).map((a) => 180 - a);
  if (!flexes.length) return null;
  return flexes.reduce((s, v) => s + v, 0) / flexes.length;
}

/** Spine tilt at frame i, signed positive toward +x. */
function rawSpineTilt(ctx, i) {
  const b = ctx.body(i);
  return tiltFromVertical(b.hipCenter, b.shoulderCenter);
}

/** Head drift: max distance of the nose from its address position over [from..to]. */
function headDrift(ctx, from, to, axis) {
  const ref = ctx.body(ctx.at('address')).nose;
  if (!ref) return null;
  let max = 0;
  for (let i = from; i <= to; i++) {
    const nose = ctx.body(i).nose;
    if (!nose) continue;
    const d =
      axis === 'x-away'
        ? (nose.x - ref.x) * -ctx.targetDir // positive = away from target
        : dist(nose, ref);
    if (d != null && d > max) max = d;
  }
  return max;
}

function hipDrift(ctx, from, to, axis) {
  const ref = ctx.body(ctx.at('address')).hipCenter;
  if (!ref) return null;
  let max = 0;
  for (let i = from; i <= to; i++) {
    const hc = ctx.body(i).hipCenter;
    if (!hc) continue;
    const d = axis === 'x-away' ? (hc.x - ref.x) * -ctx.targetDir : dist(hc, ref);
    if (d != null && d > max) max = d;
  }
  return max;
}

/** % of stance half-width that the body centre sits toward the lead foot at frame i. */
function weightForwardStancePct(ctx, i) {
  const b = ctx.body(i);
  const ankles = mid(b.leftAnkle, b.rightAnkle);
  const width = xWidth(b.leftAnkle, b.rightAnkle);
  if (!b.hipCenter || !ankles || width == null || width < 1e-4) return null;
  return ((b.hipCenter.x - ankles.x) * ctx.targetDir) / (width / 2) * 100;
}

// ---------------------------------------------------------------------------
// Metric implementations, keyed by metric id. Each returns a number or null.
// ---------------------------------------------------------------------------

const METRIC_FNS = {
  shoulder_turn_top(ctx) {
    const a = ctx.body(ctx.at('address'));
    const t = ctx.body(ctx.at('top'));
    return apparentTurn(xWidth(t.leftShoulder, t.rightShoulder), xWidth(a.leftShoulder, a.rightShoulder));
  },

  hip_turn_top(ctx) {
    const a = ctx.body(ctx.at('address'));
    const t = ctx.body(ctx.at('top'));
    return apparentTurn(xWidth(t.leftHip, t.rightHip), xWidth(a.leftHip, a.rightHip));
  },

  head_sway(ctx, def, shotDef) {
    if (shotDef.swingClass === 'full') {
      return pctTorso(headDrift(ctx, ctx.at('address'), ctx.at('top'), 'x-away'), ctx);
    }
    const to = ctx.after(ctx.at('impact'), 0.2);
    return pctTorso(headDrift(ctx, ctx.at('address'), to, 'euclid'), ctx);
  },

  head_stillness(ctx) {
    const to = ctx.after(ctx.at('impact'), 0.3);
    return pctTorso(headDrift(ctx, ctx.at('address'), to, 'euclid'), ctx);
  },

  hip_sway(ctx) {
    return pctTorso(hipDrift(ctx, ctx.at('address'), ctx.at('top'), 'x-away'), ctx);
  },

  body_sway(ctx) {
    const to = ctx.after(ctx.at('impact'), 0.2);
    return pctTorso(hipDrift(ctx, ctx.at('address'), to, 'euclid'), ctx);
  },

  spine_tilt_impact(ctx) {
    const tilt = rawSpineTilt(ctx, ctx.at('impact'));
    return tilt == null ? null : tilt * -ctx.targetDir; // positive = away from target
  },

  spine_tilt_top(ctx) {
    const tilt = rawSpineTilt(ctx, ctx.at('top'));
    return tilt == null ? null : tilt * ctx.targetDir; // positive = toward target (reverse pivot)
  },

  lead_arm_bend_top(ctx) {
    return leadArmBend(ctx, ctx.at('top'));
  },

  chicken_wing(ctx) {
    const from = ctx.at('impact');
    const to = ctx.after(from, 0.2);
    let max = null;
    for (let i = from; i <= to; i++) {
      const bend = leadArmBend(ctx, i);
      if (bend != null && (max == null || bend > max)) max = bend;
    }
    return max;
  },

  weight_forward_impact(ctx, def) {
    if (def.unit === '% stance') return weightForwardStancePct(ctx, ctx.at('impact'));
    const a = ctx.body(ctx.at('address')).hipCenter;
    const i = ctx.body(ctx.at('impact')).hipCenter;
    if (!a || !i) return null;
    return pctTorso((i.x - a.x) * ctx.targetDir, ctx);
  },

  weight_forward_address(ctx) {
    return weightForwardStancePct(ctx, ctx.at('address'));
  },

  hands_forward_impact(ctx) {
    const b = ctx.body(ctx.at('impact'));
    const w = wristPoint(ctx.frames[ctx.at('impact')]);
    if (!w || !b.hipCenter) return null;
    return pctTorso((w.x - b.hipCenter.x) * ctx.targetDir, ctx);
  },

  posture_bend_address(ctx) {
    const tilt = rawSpineTilt(ctx, ctx.at('address'));
    return tilt == null ? null : Math.abs(tilt);
  },

  posture_loss_impact(ctx) {
    const a = rawSpineTilt(ctx, ctx.at('address'));
    const i = rawSpineTilt(ctx, ctx.at('impact'));
    if (a == null || i == null) return null;
    return Math.abs(a) - Math.abs(i); // positive = more upright (standing up)
  },

  early_extension(ctx) {
    const addr = ctx.body(ctx.at('address'));
    const imp = ctx.body(ctx.at('impact'));
    const w = wristPoint(ctx.frames[ctx.at('address')]);
    const ankles = mid(addr.leftAnkle, addr.rightAnkle);
    if (!addr.hipCenter || !imp.hipCenter || !w || !ankles) return null;
    const ballSideDir = Math.sign(w.x - ankles.x) || 1; // hands hang toward the ball line
    return pctTorso((imp.hipCenter.x - addr.hipCenter.x) * ballSideDir, ctx);
  },

  head_dip(ctx) {
    const a = ctx.body(ctx.at('address')).nose;
    const i = ctx.body(ctx.at('impact')).nose;
    if (!a || !i) return null;
    return pctTorso(i.y - a.y, ctx); // y grows downward: positive = dipping
  },

  finish_balance(ctx) {
    const b = ctx.body(ctx.at('finish'));
    const leadAnkle = ctx.lead(b, 'Ankle');
    if (!b.hipCenter || !leadAnkle) return null;
    return pctTorso(Math.abs(b.hipCenter.x - leadAnkle.x), ctx);
  },

  tempo_ratio(ctx) {
    const { takeaway, top, impact } = ctx.indices;
    const back = ctx.frames[top].t - ctx.frames[takeaway].t;
    const down = ctx.frames[impact].t - ctx.frames[top].t;
    if (back <= 0 || down <= 0) return null;
    return back / down;
  },

  stance_width(ctx) {
    const b = ctx.body(ctx.at('address'));
    const ankles = xWidth(b.leftAnkle, b.rightAnkle);
    const shoulders = xWidth(b.leftShoulder, b.rightShoulder);
    if (ankles == null || shoulders == null || shoulders < 1e-4) return null;
    return ankles / shoulders;
  },

  knee_flex_address(ctx) {
    return kneeFlexAt(ctx, ctx.at('address'));
  },

  knee_flex_loss(ctx) {
    const a = kneeFlexAt(ctx, ctx.at('address'));
    const i = kneeFlexAt(ctx, ctx.at('impact'));
    if (a == null || i == null) return null;
    return a - i; // positive = legs straightening
  },

  early_hinge(ctx) {
    // Hands rising relative to elbows ~30% into the backswing = early wrist set.
    const { takeaway, top } = ctx.indices;
    const i = clamp(takeaway + Math.round((top - takeaway) * 0.3), takeaway, top);
    const b = ctx.body(i);
    const elbows = mid(b.leftElbow, b.rightElbow);
    const w = wristPoint(ctx.frames[i]);
    if (!elbows || !w) return null;
    return pctTorso(elbows.y - w.y, ctx); // positive = wrists above elbows
  },

  commit_ratio(ctx) {
    const { top, impact } = ctx.indices;
    let peak = 0;
    for (let i = top; i <= impact; i++) peak = Math.max(peak, ctx.speeds[i]);
    if (peak <= 0) return null;
    return clamp(ctx.speeds[impact] / peak, 0, 1.5);
  },

  follow_length(ctx) {
    return METRIC_FNS.stroke_symmetry(ctx);
  },

  stroke_symmetry(ctx) {
    const { address, takeaway, top, impact, finish } = ctx.indices;
    const origin = wristPoint(ctx.frames[address]);
    if (!origin) return null;
    const back = maxWristDisp(ctx, origin, takeaway, top);
    const through = maxWristDisp(ctx, origin, impact, finish);
    if (back < 1e-4) return null;
    return (through / back) * 100;
  },

  wrist_quietness(ctx) {
    // Range of lead-arm elbow bend through the stroke — flicking shows up here.
    const from = ctx.indices.takeaway;
    const to = ctx.after(ctx.indices.impact, 0.2);
    let min = null;
    let max = null;
    for (let i = from; i <= to; i++) {
      const bend = leadArmBend(ctx, i);
      if (bend == null) continue;
      if (min == null || bend < min) min = bend;
      if (max == null || bend > max) max = bend;
    }
    if (min == null || max == null) return null;
    return max - min;
  },

  pendulum_arc(ctx) {
    const from = ctx.indices.takeaway;
    const to = ctx.after(ctx.indices.impact, 0.2);
    let min = null;
    let max = null;
    for (let i = from; i <= to; i++) {
      const b = ctx.body(i);
      const w = wristPoint(ctx.frames[i]);
      const d = dist(b.shoulderCenter, w);
      if (d == null) continue;
      if (min == null || d < min) min = d;
      if (max == null || d > max) max = d;
    }
    if (min == null || max == null) return null;
    return pctTorso(max - min, ctx);
  },

  shoulder_engine(ctx) {
    const from = ctx.indices.takeaway;
    const to = ctx.after(ctx.indices.impact, 0.2);
    let min = null;
    let max = null;
    for (let i = from; i <= to; i++) {
      const b = ctx.body(i);
      const slope = slopeFromHorizontal(b.leftShoulder, b.rightShoulder);
      if (slope == null) continue;
      if (min == null || slope < min) min = slope;
      if (max == null || slope > max) max = slope;
    }
    if (min == null || max == null) return null;
    return max - min;
  },

  chest_rotation_finish(ctx) {
    const a = ctx.body(ctx.at('address'));
    const f = ctx.body(ctx.at('finish'));
    return apparentTurn(xWidth(f.leftShoulder, f.rightShoulder), xWidth(a.leftShoulder, a.rightShoulder));
  },
};

/**
 * Compute all metrics defined for the shot type that apply to this camera angle.
 * Returns { metrics: {id: value}, perFrameAngles: [...] } — values rounded, null when unmeasurable.
 */
function computeMetrics(frames, phases, shotDef, angleType) {
  const ctx = buildContext(frames, phases, angleType);
  const metrics = {};

  for (const def of shotDef.metrics) {
    if (def.angle !== 'any' && def.angle !== angleType) continue;
    const fn = METRIC_FNS[def.id];
    if (!fn) continue;
    let value = null;
    try {
      value = fn(ctx, def, shotDef);
    } catch {
      value = null;
    }
    metrics[def.id] = round(value, def.unit === ':1' || def.unit === '×' || def.unit === '× shoulders' ? 2 : 1);
  }

  // Per-frame angles for the client overlay callouts.
  const perFrameAngles = frames.map((f, i) => {
    const b = ctx.body(i);
    return {
      spine: round(tiltFromVertical(b.hipCenter, b.shoulderCenter), 1),
      leadArm: round(leadArmBend(ctx, i), 1),
      shoulderLine: round(slopeFromHorizontal(b.leftShoulder, b.rightShoulder), 1),
      hipLine: round(slopeFromHorizontal(b.leftHip, b.rightHip), 1),
      kneeFlex: round(kneeFlexAt(ctx, i), 1),
    };
  });

  return { metrics, perFrameAngles, ctx };
}

module.exports = { computeMetrics };
