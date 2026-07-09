/**
 * Smoke test for the analysis engine.
 *
 * 1. Always: synthetic landmark sequences (no video, no TF) through phase
 *    detection -> metrics -> checkpoint/fault evaluation for all five shot
 *    types × tempo/trim variants, with GROUND-TRUTH keyframe assertions —
 *    the detected address/takeaway/top/impact/finish must land within a few
 *    frames of where the synthetic swing actually put them, regardless of
 *    tempo or how the clip is trimmed.
 * 2. With a video path argument: additionally runs the full ffmpeg + MoveNet
 *    pipeline end-to-end:  node smokeTest.js path\to\swing.mp4 driving face_on
 */

const { smoothFrames, bridgeWristGaps } = require('./geometry');
const { detectPhases } = require('./phases');
const { computeMetrics } = require('./metrics');
const { evaluate } = require('./analyze');
const { SHOT_TYPES } = require('./checkpoints');

// Synthetic sampling rate — matches production sampling for a typical phone
// clip (source-fps-capped, 30fps sources are the norm).
const FPS = 30;

function lerp(a, b, u) {
  return a + (b - a) * u;
}

function ease(u) {
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));
}

/**
 * Parametric face-on golfer. u values (0..1) morph address -> top -> impact -> finish.
 * shoulderDrop lowers the upper body (bending down); bodyShift translates the
 * whole figure including the feet (walking).
 */
function golferFrame(t, { handX, handY, turn, hipShift, shoulderDrop = 0, bodyShift = 0 }) {
  const cx = 0.5 + hipShift + bodyShift;
  const shoulderW = 0.07 * Math.cos((turn * Math.PI) / 180);
  const hipW = 0.05 * Math.cos((turn * 0.5 * Math.PI) / 180);
  const hx = handX + bodyShift;
  const k = new Array(17).fill(null);
  const p = (x, y) => [Number(x.toFixed(4)), Number(y.toFixed(4)), 0.9];
  k[0] = p(cx, 0.28 + shoulderDrop);
  k[1] = p(cx - 0.01, 0.27 + shoulderDrop);
  k[2] = p(cx + 0.01, 0.27 + shoulderDrop);
  k[3] = p(cx - 0.02, 0.28 + shoulderDrop);
  k[4] = p(cx + 0.02, 0.28 + shoulderDrop);
  k[5] = p(cx - shoulderW, 0.35 + shoulderDrop);
  k[6] = p(cx + shoulderW, 0.35 + shoulderDrop);
  k[7] = p(lerp(cx - 0.09, hx, 0.5), lerp(0.44 + shoulderDrop, handY, 0.5));
  k[8] = p(lerp(cx + 0.09, hx, 0.5), lerp(0.44 + shoulderDrop, handY, 0.5));
  k[9] = p(hx - 0.005, handY);
  k[10] = p(hx + 0.005, handY);
  k[11] = p(cx - hipW, 0.55);
  k[12] = p(cx + hipW, 0.55);
  k[13] = p(0.45 + bodyShift, 0.72);
  k[14] = p(0.55 + bodyShift, 0.72);
  k[15] = p(0.44 + bodyShift, 0.9);
  k[16] = p(0.56 + bodyShift, 0.9);
  return { t: Number(t.toFixed(3)), k };
}

/**
 * Post-swing motion appended after the finish hold — reproduces what real
 * uploads contain and what originally broke detection: bending down to pick
 * up the tee (shoulders drop, hands to the ground, feet planted), walking
 * off (whole body translates), and grabbing the camera (a hand burst FASTER
 * than the downswing right at the clip end).
 */
function postMotionState(kind, u, finish) {
  if (kind === 'pickup') {
    const phase = Math.sin(Math.PI * ease(u)); // down then back up
    return {
      handX: lerp(finish.handX, 0.52, phase),
      handY: lerp(finish.handY, 0.86, phase),
      turn: finish.turn,
      hipShift: finish.hipShift,
      shoulderDrop: 0.22 * phase,
    };
  }
  if (kind === 'walk') {
    return { ...finish, bodyShift: 0.28 * ease(u) };
  }
  // 'grab': still, then a very fast hand move toward the camera at the end.
  if (u < 0.55) return finish;
  const g = ease((u - 0.55) / 0.45);
  return {
    ...finish,
    handX: lerp(finish.handX, 0.72, g),
    handY: lerp(finish.handY, 0.5, g),
    shoulderDrop: 0.08 * g,
  };
}

/**
 * Build a synthetic swing and return frames + ground-truth phase times.
 */
function makeSwing(params, { still1 = 0.8, still2 = 0.6, followDur = 0.5, postMotion = null, postDur = 1.8, blurGap = false } = {}) {
  const addr = { handX: 0.5, handY: 0.58, turn: 0, hipShift: 0 };
  const topP = { handX: params.topX, handY: params.topY, turn: params.topTurn, hipShift: 0.01 };
  const impact = { handX: 0.5, handY: 0.58, turn: 5, hipShift: -0.015 };
  const finish = { handX: params.finishX, handY: params.finishY, turn: params.finishTurn, hipShift: -0.02 };

  const frames = [];
  const swingEnd = still1 + params.backDur + params.downDur + followDur + still2;
  const total = swingEnd + (postMotion ? postDur : 0);
  const n = Math.round(total * FPS);
  for (let i = 0; i <= n; i++) {
    const t = i / FPS;
    let s;
    if (t >= swingEnd && postMotion) {
      s = postMotionState(postMotion, (t - swingEnd) / postDur, finish);
    } else if (t < still1) s = addr;
    else if (t < still1 + params.backDur) {
      const u = ease((t - still1) / params.backDur);
      s = {
        handX: lerp(addr.handX, topP.handX, u),
        handY: lerp(addr.handY, topP.handY, u),
        turn: lerp(addr.turn, topP.turn, u),
        hipShift: lerp(addr.hipShift, topP.hipShift, u),
      };
    } else if (t < still1 + params.backDur + params.downDur) {
      const u = ease((t - still1 - params.backDur) / params.downDur);
      s = {
        handX: lerp(topP.handX, impact.handX, u),
        handY: lerp(topP.handY, impact.handY, u),
        turn: lerp(topP.turn, impact.turn, u),
        hipShift: lerp(topP.hipShift, impact.hipShift, u),
      };
    } else if (t < still1 + params.backDur + params.downDur + followDur) {
      const u = ease((t - still1 - params.backDur - params.downDur) / followDur);
      s = {
        handX: lerp(impact.handX, finish.handX, u),
        handY: lerp(impact.handY, finish.handY, u),
        turn: lerp(impact.turn, finish.turn, u),
        hipShift: lerp(impact.hipShift, finish.hipShift, u),
      };
    } else s = finish;
    frames.push(golferFrame(t, s));
  }

  // Simulate motion-blur wrist dropout mid-backswing (MoveNet does this on
  // real footage at the fastest parts of the move).
  if (blurGap) {
    const gi = Math.round((still1 + params.backDur * 0.55) * FPS);
    for (let j = gi; j < gi + 3 && j < frames.length; j++) {
      frames[j].k[9][2] = 0.1;
      frames[j].k[10][2] = 0.1;
    }
  }

  const truth = {
    takeaway: still1,
    top: still1 + params.backDur,
    impact: still1 + params.backDur + params.downDur,
    finish: still1 + params.backDur + params.downDur + followDur,
  };
  return { frames, truth };
}

const SWING_PARAMS = {
  driving: { backDur: 0.9, downDur: 0.3, topX: 0.64, topY: 0.22, topTurn: 85, finishX: 0.36, finishY: 0.26, finishTurn: 40 },
  iron: { backDur: 0.85, downDur: 0.29, topX: 0.62, topY: 0.25, topTurn: 80, finishX: 0.38, finishY: 0.28, finishTurn: 40 },
  bunker: { backDur: 0.6, downDur: 0.35, topX: 0.6, topY: 0.38, topTurn: 45, finishX: 0.4, finishY: 0.4, finishTurn: 35 },
  chipping: { backDur: 0.5, downDur: 0.35, topX: 0.57, topY: 0.5, topTurn: 20, finishX: 0.43, finishY: 0.5, finishTurn: 30 },
  putting: { backDur: 0.55, downDur: 0.28, topX: 0.555, topY: 0.575, topTurn: 6, finishX: 0.44, finishY: 0.57, finishTurn: 8 },
};

/**
 * Tempo/trim/aftermath variants — phases must hold across all of them.
 * The three post-motion variants reproduce the real-footage bug where
 * incidental movement after the swing hijacked the keyframes.
 */
const VARIANTS = [
  { name: 'normal', scaleBack: 1, scaleDown: 1, opts: {} },
  { name: 'fast', scaleBack: 0.6, scaleDown: 0.6, opts: {} },
  { name: 'slow', scaleBack: 1.7, scaleDown: 1.5, opts: {} },
  { name: 'trimmed-start', scaleBack: 1, scaleDown: 1, opts: { still1: 0.04 } },
  { name: 'long-tail', scaleBack: 1, scaleDown: 1, opts: { still2: 2.5 } },
  { name: 'tee-pickup', scaleBack: 1, scaleDown: 1, opts: { postMotion: 'pickup' } },
  { name: 'walk-off', scaleBack: 1, scaleDown: 1, opts: { postMotion: 'walk', postDur: 2.4 } },
  { name: 'camera-grab', scaleBack: 1, scaleDown: 1, opts: { postMotion: 'grab', postDur: 1.2 } },
  { name: 'blur-gap', scaleBack: 1, scaleDown: 1, opts: { blurGap: true } },
];

function assertPhase(name, detectedIdx, truthT, tolEarly, tolLate, errors) {
  const truthIdx = Math.round(truthT * FPS);
  const delta = detectedIdx - truthIdx;
  if (delta < -tolEarly || delta > tolLate) {
    errors.push(`${name}: detected frame ${detectedIdx}, truth ${truthIdx} (Δ${delta}, allowed -${tolEarly}..+${tolLate})`);
  }
}

async function runSynthetic() {
  let failures = 0;
  let cases = 0;
  for (const [shotTypeId, def] of Object.entries(SHOT_TYPES)) {
    for (const variant of VARIANTS) {
      cases++;
      // "fast" at 0.6x is realistic for full swings but produces a physically
      // implausible putting/chipping stroke (a real backstroke never dips
      // below ~0.4s); bound stroke-class scaling at 0.75x.
      const floorScale = def.swingClass === 'stroke' ? 0.75 : 0;
      const params = {
        ...SWING_PARAMS[shotTypeId],
        backDur: SWING_PARAMS[shotTypeId].backDur * Math.max(variant.scaleBack, floorScale),
        downDur: SWING_PARAMS[shotTypeId].downDur * Math.max(variant.scaleDown, floorScale),
      };
      const label = `${shotTypeId.padEnd(9)} ${variant.name.padEnd(14)}`;
      try {
        // Mirror analyze.js: bridge wrist dropouts, then phase timing on raw
        // frames and metrics on smoothed frames.
        const { frames: generated, truth } = makeSwing(params, variant.opts);
        const raw = bridgeWristGaps(generated);
        const frames = smoothFrames(raw, 5);
        const phases = detectPhases(raw, def.swingClass);
        const { address, takeaway, top, impact, finish } = phases.indices;

        const errors = [];
        if (!(address <= takeaway && takeaway < top && top < impact && impact <= finish)) {
          errors.push(`phase order wrong: ${JSON.stringify(phases.indices)}`);
        }
        // Takeaway may trail truth while the eased motion ramps past the
        // detection threshold — allow up to 25% of the backswing.
        const takeawayLate = Math.max(3, Math.round(params.backDur * FPS * 0.25));
        assertPhase('takeaway', takeaway, truth.takeaway, 3, takeawayLate, errors);
        assertPhase('top', top, truth.top, 2, 2, errors);
        assertPhase('impact', impact, truth.impact, 3, 2, errors);
        // Finish detection targets 90% of follow-through extent (eases in),
        // so it can sit a few frames early.
        assertPhase('finish', finish, truth.finish, 6, 3, errors);

        // Metrics + evaluation must run clean on every variant.
        const { metrics } = computeMetrics(frames, phases, def, 'face_on');
        const { faults } = evaluate(def, metrics, 'face_on');
        if (!Object.values(metrics).some((v) => v != null)) errors.push('no metrics measured');

        // Tempo (sub-frame interpolated) must land within 15% of ground truth.
        const detectedTempo = metrics.tempo_ratio;
        const truthTempo = params.backDur / params.downDur;
        if (detectedTempo == null || Math.abs(detectedTempo - truthTempo) / truthTempo > 0.15) {
          errors.push(`tempo ${detectedTempo} vs truth ${truthTempo.toFixed(2)}`);
        }

        if (errors.length) {
          failures++;
          console.error(`FAIL ${label} ${errors.join(' | ')}`);
        } else {
          console.log(
            `OK  ${label} phases=${JSON.stringify(phases.indices)} tempo=${detectedTempo} (truth ${truthTempo.toFixed(2)}) faults=${faults.length}`,
          );
        }
      } catch (err) {
        failures++;
        console.error(`FAIL ${label} ${err.message}`);
      }
    }
  }
  console.log(`\n${cases - failures}/${cases} ground-truth cases passed.`);
  return failures;
}

async function runVideo(videoPath, shotType, angleType) {
  const { analyzeVideo } = require('./analyze');
  console.log(`\nRunning full pipeline on ${videoPath} (${shotType}, ${angleType})...`);
  const started = Date.now();
  const analysis = await analyzeVideo(videoPath, shotType, angleType);
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Pipeline finished in ${secs}s`);
  console.log('  model:', analysis.joint_angle_data.model, '| frames:', analysis.joint_angle_data.frames.length, '| tracking:', analysis.joint_angle_data.tracking_quality);
  console.log('  keyframes:', JSON.stringify(analysis.joint_angle_data.keyframes));
  console.log('  tempo_ratio:', analysis.tempo_ratio);
  console.log('  metrics:', JSON.stringify(analysis.metrics));
  console.log('  faults:', analysis.identified_faults.map((f) => `${f.tag} (sev ${f.severity})`).join(', ') || 'none');
}

(async () => {
  const failures = await runSynthetic();
  const [, , videoPath, shotType = 'driving', angleType = 'face_on'] = process.argv;
  if (videoPath) await runVideo(videoPath, shotType, angleType);
  if (failures) {
    console.error(`\n${failures} case(s) failed`);
    process.exit(1);
  }
})();
