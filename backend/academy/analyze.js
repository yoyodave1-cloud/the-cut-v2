/**
 * Analysis orchestrator: landmarks -> phases -> metrics -> checkpoints -> faults.
 *
 * Pure structured-data processing; no LLM here. The output shape matches the
 * academy_swing_analysis row (joint_angle_data, tempo_ratio, identified_faults,
 * checkpoint_results, metrics).
 */

const { smoothFrames, bridgeWristGaps, SKELETON_EDGES, KEYPOINT_NAMES } = require('./geometry');
const { detectPhases, findSwingAnchor } = require('./phases');
const { computeMetrics } = require('./metrics');
const { getShotType } = require('./checkpoints');

function benchmarkStatus(value, benchmark) {
  if (value == null) return 'unmeasured';
  if (value >= benchmark.min && value <= benchmark.max) return 'good';
  const span = Math.max(benchmark.max - benchmark.min, 1e-6);
  const overshoot =
    value > benchmark.max ? (value - benchmark.max) / span : (benchmark.min - value) / span;
  return overshoot <= 0.35 ? 'warning' : 'fault';
}

function faultSeverity(value, detect, benchmarkSpan) {
  const span = Math.max(benchmarkSpan, 1e-6);
  let overshoot = 0;
  if (detect.when === 'above') overshoot = (value - detect.value) / span;
  else if (detect.when === 'below') overshoot = (detect.value - value) / span;
  else if (detect.when === 'outside') {
    const [lo, hi] = detect.range;
    overshoot = value < lo ? (lo - value) / span : (value - hi) / span;
  }
  if (overshoot < 0.5) return 1;
  if (overshoot < 1.25) return 2;
  return 3;
}

function faultTriggered(value, detect) {
  if (value == null) return false;
  if (detect.when === 'above') return value > detect.value;
  if (detect.when === 'below') return value < detect.value;
  if (detect.when === 'outside') {
    const [lo, hi] = detect.range;
    return value < lo || value > hi;
  }
  return false;
}

/**
 * Evaluate checkpoint results and faults for computed metrics.
 * @returns {{ checkpointResults, faults }}
 */
function evaluate(shotDef, metrics, angleType) {
  const metricDefs = shotDef.metrics.filter(
    (m) => m.angle === 'any' || m.angle === angleType,
  );

  // Checkpoint results: measured checks grouped by phase, in phase order.
  const checkpointResults = shotDef.phases.map((phase) => ({
    phase: phase.id,
    label: phase.label,
    description: phase.description,
    checks: metricDefs
      .filter((m) => m.phase === phase.id)
      .map((m) => ({
        metric: m.id,
        label: m.label,
        unit: m.unit,
        value: metrics[m.id] ?? null,
        benchmark: m.benchmark,
        status: benchmarkStatus(metrics[m.id] ?? null, m.benchmark),
        description: m.description,
      })),
  }));

  const metricById = Object.fromEntries(shotDef.metrics.map((m) => [m.id, m]));
  const faults = [];
  for (const fault of shotDef.faults) {
    if (fault.angle !== 'any' && fault.angle !== angleType) continue;
    const value = metrics[fault.detect.metric];
    if (!faultTriggered(value, fault.detect)) continue;
    const mDef = metricById[fault.detect.metric];
    const span = mDef ? mDef.benchmark.max - mDef.benchmark.min : 1;
    faults.push({
      tag: fault.tag,
      name: fault.name,
      phase: fault.phase,
      severity: faultSeverity(value, fault.detect, span),
      metric: fault.detect.metric,
      metricLabel: mDef ? mDef.label : fault.detect.metric,
      value,
      unit: mDef ? mDef.unit : '',
      description: fault.description,
      tip: fault.tip,
      drill: fault.drill,
    });
  }
  faults.sort((a, b) => b.severity - a.severity);

  return { checkpointResults, faults };
}

/**
 * Full analysis of a local video file.
 * @returns analysis payload ready for the academy_swing_analysis row.
 */
async function analyzeVideo(videoPath, shotTypeId, angleType) {
  // Lazy require so evaluation-only consumers (and the smoke test) don't need
  // the TF/ffmpeg dependency chain loaded.
  const { estimatePoseFromVideo } = require('./poseEstimation');
  const shotDef = getShotType(shotTypeId);

  // Two-pass extraction: real uploads often contain long stretches of
  // non-swing footage (setup, tee pick-up, walking off), which both dilutes
  // the frame budget (a 20s clip samples at ~14fps — too coarse for tempo)
  // and used to let post-swing motion hijack the keyframes. Pass 1 samples
  // the whole clip coarsely just to LOCATE the swing; pass 2 re-extracts only
  // the swing window densely (up to 48fps). Short clips skip pass 2.
  let pose = await estimatePoseFromVideo(videoPath, { maxFrames: 200 });
  // Bridge motion-blur wrist dropouts before ANY motion analysis — a missing
  // wrist otherwise reads as zero displacement (hands teleporting to address).
  pose.frames = bridgeWristGaps(pose.frames);
  const coarse = pose;
  if (pose.duration > 8 || pose.fps < 20) {
    try {
      const { anchor } = findSwingAnchor(pose.frames, shotDef.swingClass);
      const anchorT = pose.frames[anchor].t;
      const start = Math.max(0, anchorT - 4.5);
      const end = Math.min(pose.duration, anchorT + 2.5);
      pose = await estimatePoseFromVideo(videoPath, {
        window: { start, duration: end - start },
      });
      pose.frames = bridgeWristGaps(pose.frames);
    } catch (err) {
      // Fall back to the coarse pass — detectPhases will raise a proper
      // user-facing error if there genuinely is no swing.
      console.warn('[academy] dense re-extraction skipped:', err.message);
      pose = coarse;
    }
  }

  // The rendered/measured skeleton gets 5-frame smoothing for a glitch-free
  // overlay, but phase timing runs on RAW frames: moving-average filtering
  // drags the top-of-backswing early and the impact crossing late on fast
  // downswings, systematically skewing tempo. detectPhases handles noise by
  // curve-fitting (no phase lag) instead of pre-filtering.
  const frames = smoothFrames(pose.frames, 5);
  const phases = detectPhases(pose.frames, shotDef.swingClass);
  const { metrics, perFrameAngles } = computeMetrics(frames, phases, shotDef, angleType);
  const { checkpointResults, faults } = evaluate(shotDef, metrics, angleType);

  const keyframes = {};
  for (const [name, idx] of Object.entries(phases.indices)) {
    keyframes[name] = { index: idx, t: frames[idx].t };
  }

  return {
    shot_type: shotTypeId,
    tempo_ratio: metrics.tempo_ratio ?? null,
    identified_faults: faults,
    checkpoint_results: checkpointResults,
    metrics,
    joint_angle_data: {
      model: pose.model,
      fps: pose.fps,
      duration: pose.duration,
      video_aspect: pose.aspect,
      angle_type: angleType,
      keypoint_names: KEYPOINT_NAMES,
      skeleton_edges: SKELETON_EDGES,
      target_dir: phases.targetDir,
      lead_side: phases.leadSide,
      tracking_quality: phases.quality,
      keyframes,
      frames,
      per_frame_angles: perFrameAngles,
    },
  };
}

module.exports = { analyzeVideo, evaluate };
