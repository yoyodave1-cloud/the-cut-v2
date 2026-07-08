/**
 * Smoke test for the analysis engine.
 *
 * 1. Always: runs synthetic landmark sequences (no video, no TF) through
 *    phase detection -> metrics -> checkpoint/fault evaluation for all five
 *    shot types, and fails loudly on missing phases or crashes.
 * 2. With a video path argument: additionally runs the full ffmpeg + MoveNet
 *    pipeline end-to-end:  node smokeTest.js path\to\swing.mp4 driving face_on
 */

const { smoothFrames } = require('./geometry');
const { detectPhases } = require('./phases');
const { computeMetrics } = require('./metrics');
const { evaluate } = require('./analyze');
const { SHOT_TYPES } = require('./checkpoints');

const FPS = 24;

function lerp(a, b, u) {
  return a + (b - a) * u;
}

function ease(u) {
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));
}

/**
 * Parametric face-on golfer. u values (0..1) morph address -> top -> impact -> finish.
 * back/through describe hand travel; turn compresses shoulder/hip widths.
 */
function golferFrame(t, { handX, handY, turn, hipShift }) {
  const cx = 0.5 + hipShift;
  const shoulderW = 0.07 * Math.cos((turn * Math.PI) / 180);
  const hipW = 0.05 * Math.cos((turn * 0.5 * Math.PI) / 180);
  const k = new Array(17).fill(null);
  const p = (x, y) => [Number(x.toFixed(4)), Number(y.toFixed(4)), 0.9];
  k[0] = p(cx, 0.28); // nose
  k[1] = p(cx - 0.01, 0.27);
  k[2] = p(cx + 0.01, 0.27);
  k[3] = p(cx - 0.02, 0.28);
  k[4] = p(cx + 0.02, 0.28);
  k[5] = p(cx - shoulderW, 0.35); // shoulders
  k[6] = p(cx + shoulderW, 0.35);
  k[7] = p(lerp(cx - 0.09, handX, 0.5), lerp(0.44, handY, 0.5)); // elbows track hands
  k[8] = p(lerp(cx + 0.09, handX, 0.5), lerp(0.44, handY, 0.5));
  k[9] = p(handX - 0.005, handY); // wrists
  k[10] = p(handX + 0.005, handY);
  k[11] = p(cx - hipW, 0.55); // hips
  k[12] = p(cx + hipW, 0.55);
  k[13] = p(0.5 - 0.05, 0.72); // knees stay planted
  k[14] = p(0.5 + 0.05, 0.72);
  k[15] = p(0.5 - 0.06, 0.9); // ankles
  k[16] = p(0.5 + 0.06, 0.9);
  return { t: Number(t.toFixed(3)), k };
}

/** Build a synthetic swing: still -> backswing -> downswing -> follow -> still. */
function makeSwing({ backDur, downDur, topX, topY, topTurn, finishX, finishY, finishTurn }) {
  const addr = { handX: 0.5, handY: 0.58, turn: 0, hipShift: 0 };
  const topP = { handX: topX, handY: topY, turn: topTurn, hipShift: 0.01 };
  const impact = { handX: 0.5, handY: 0.58, turn: 5, hipShift: -0.015 };
  const finish = { handX: finishX, handY: finishY, turn: finishTurn, hipShift: -0.02 };

  const frames = [];
  const still1 = 0.8;
  const followDur = 0.5;
  const still2 = 0.6;
  const total = still1 + backDur + downDur + followDur + still2;
  const n = Math.round(total * FPS);
  for (let i = 0; i <= n; i++) {
    const t = i / FPS;
    let s;
    if (t < still1) s = addr;
    else if (t < still1 + backDur) {
      const u = ease((t - still1) / backDur);
      s = {
        handX: lerp(addr.handX, topP.handX, u),
        handY: lerp(addr.handY, topP.handY, u),
        turn: lerp(addr.turn, topP.turn, u),
        hipShift: lerp(addr.hipShift, topP.hipShift, u),
      };
    } else if (t < still1 + backDur + downDur) {
      const u = ease((t - still1 - backDur) / downDur);
      s = {
        handX: lerp(topP.handX, impact.handX, u),
        handY: lerp(topP.handY, impact.handY, u),
        turn: lerp(topP.turn, impact.turn, u),
        hipShift: lerp(topP.hipShift, impact.hipShift, u),
      };
    } else if (t < still1 + backDur + downDur + followDur) {
      const u = ease((t - still1 - backDur - downDur) / followDur);
      s = {
        handX: lerp(impact.handX, finish.handX, u),
        handY: lerp(impact.handY, finish.handY, u),
        turn: lerp(impact.turn, finish.turn, u),
        hipShift: lerp(impact.hipShift, finish.hipShift, u),
      };
    } else s = finish;
    frames.push(golferFrame(t, s));
  }
  return frames;
}

const SWING_PARAMS = {
  driving: { backDur: 0.9, downDur: 0.3, topX: 0.64, topY: 0.22, topTurn: 85, finishX: 0.36, finishY: 0.26, finishTurn: 40 },
  iron: { backDur: 0.85, downDur: 0.29, topX: 0.62, topY: 0.25, topTurn: 80, finishX: 0.38, finishY: 0.28, finishTurn: 40 },
  bunker: { backDur: 0.6, downDur: 0.35, topX: 0.6, topY: 0.38, topTurn: 45, finishX: 0.4, finishY: 0.4, finishTurn: 35 },
  chipping: { backDur: 0.5, downDur: 0.35, topX: 0.57, topY: 0.5, topTurn: 20, finishX: 0.43, finishY: 0.5, finishTurn: 30 },
  putting: { backDur: 0.55, downDur: 0.28, topX: 0.555, topY: 0.575, topTurn: 6, finishX: 0.44, finishY: 0.57, finishTurn: 8 },
};

async function runSynthetic() {
  let failures = 0;
  for (const [shotTypeId, def] of Object.entries(SHOT_TYPES)) {
    for (const angle of ['face_on', 'down_the_line']) {
      try {
        const frames = smoothFrames(makeSwing(SWING_PARAMS[shotTypeId]), 5);
        const phases = detectPhases(frames, def.swingClass);
        const { address, takeaway, top, impact, finish } = phases.indices;
        if (!(address <= takeaway && takeaway < top && top < impact && impact <= finish)) {
          throw new Error(`phase order wrong: ${JSON.stringify(phases.indices)}`);
        }
        const { metrics } = computeMetrics(frames, phases, def, angle);
        const { checkpointResults, faults } = evaluate(def, metrics, angle);
        const measured = Object.entries(metrics).filter(([, v]) => v != null);
        if (!measured.length) throw new Error('no metrics measured');
        const checks = checkpointResults.reduce((s, c) => s + c.checks.length, 0);
        console.log(
          `OK  ${shotTypeId.padEnd(9)} ${angle.padEnd(13)} phases=${JSON.stringify(phases.indices)} tempo=${metrics.tempo_ratio ?? '—'} metrics=${measured.length} checks=${checks} faults=${faults.map((f) => f.tag).join(',') || 'none'}`,
        );
      } catch (err) {
        failures++;
        console.error(`FAIL ${shotTypeId} ${angle}: ${err.message}`);
      }
    }
  }
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
    console.error(`\n${failures} synthetic case(s) failed`);
    process.exit(1);
  }
  console.log('\nAll synthetic cases passed.');
})();
