/**
 * Pose estimation pipeline: video file -> per-frame 2D landmarks.
 *
 * No LLM anywhere in this file. Frames are extracted with ffmpeg
 * (ffmpeg-static), decoded with jpeg-js, and run through MoveNet
 * (SinglePose Thunder) via @tensorflow-models/pose-detection.
 *
 * TensorFlow backend selection:
 *   1. @tensorflow/tfjs-node (native, fast) when installed and loadable
 *   2. @tensorflow/tfjs + wasm backend as a pure-JS fallback (slower but
 *      needs no native build — safe on Railway/Nixpacks)
 *
 * Landmarks are normalized to [0,1] in COCO-17 order (see geometry.js).
 * BlazePose (33 landmarks) can be enabled with ACADEMY_POSE_MODEL=blazepose;
 * its output is mapped down to the same COCO-17 order so the rest of the
 * pipeline is model-agnostic.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const jpeg = require('jpeg-js');

const MAX_FRAMES = 280;
const TARGET_WIDTH = 384; // MoveNet Thunder input is 256; keep some margin for crops

let detectorPromise = null;
let tfRef = null;

function ffmpegPath() {
  // eslint-disable-next-line global-require
  return process.env.FFMPEG_PATH || require('ffmpeg-static');
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(stderr);
      else reject(new Error(`${path.basename(cmd)} exited ${code}: ${stderr.slice(-500)}`));
    });
  });
}

/** Duration (s) and source frame rate parsed from ffmpeg -i output (avoids an ffprobe dependency). */
async function probeVideo(videoPath) {
  const stderr = await run(ffmpegPath(), ['-i', videoPath, '-f', 'null', '-t', '0.1', '-']).catch(
    (err) => err.message,
  );
  const dm = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr || '');
  const duration = dm ? Number(dm[1]) * 3600 + Number(dm[2]) * 60 + Number(dm[3]) : null;
  const fm = /(\d+(?:\.\d+)?)\s*fps/.exec(stderr || '');
  const sourceFps = fm ? Number(fm[1]) : null;
  return { duration, sourceFps };
}

async function extractFrames(videoPath, workDir, sampleFps, startTime, segmentDuration) {
  await fs.promises.mkdir(workDir, { recursive: true });
  const pattern = path.join(workDir, 'frame-%05d.jpg');
  const args = ['-i', videoPath];
  // -ss AFTER -i: slower (decodes from the start) but frame-exact, which the
  // phase timing needs. Clips are capped at 60s so the cost is trivial.
  if (startTime != null) args.push('-ss', String(startTime));
  if (segmentDuration != null) args.push('-t', String(segmentDuration));
  args.push(
    '-vf', `fps=${sampleFps},scale='min(${TARGET_WIDTH},iw)':-2`,
    '-q:v', '4',
    '-frames:v', String(MAX_FRAMES),
    '-y', pattern,
  );
  await run(ffmpegPath(), args);
  const files = (await fs.promises.readdir(workDir))
    .filter((f) => f.startsWith('frame-') && f.endsWith('.jpg'))
    .sort();
  return files.map((f) => path.join(workDir, f));
}

async function initTf() {
  if (tfRef) return tfRef;
  try {
    // eslint-disable-next-line global-require
    tfRef = require('@tensorflow/tfjs-node');
    console.log('[academy] TensorFlow backend: tfjs-node (native)');
    return tfRef;
  } catch {
    // Pure-JS fallback: tfjs + wasm backend. In Node, the wasm binary is
    // fetched — patch fetch to serve local .wasm files from disk.
    // eslint-disable-next-line global-require
    const tf = require('@tensorflow/tfjs');
    // eslint-disable-next-line global-require
    const wasm = require('@tensorflow/tfjs-backend-wasm');
    const wasmDir = path.dirname(
      require.resolve('@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm'),
    );
    const origFetch = global.fetch ? global.fetch.bind(global) : null;
    global.fetch = async (url, init) => {
      const s = String(url);
      if (s.endsWith('.wasm')) {
        const filePath = path.join(wasmDir, path.basename(s));
        const buf = await fs.promises.readFile(filePath);
        return new Response(buf, { headers: { 'Content-Type': 'application/wasm' } });
      }
      if (!origFetch) throw new Error(`fetch unavailable for ${s}`);
      return origFetch(url, init);
    };
    wasm.setWasmPaths(`${wasmDir}${path.sep}`);
    await tf.setBackend('wasm');
    await tf.ready();
    console.log('[academy] TensorFlow backend: wasm (pure JS fallback)');
    tfRef = tf;
    return tfRef;
  }
}

/** BlazePose landmark names -> COCO-17 index mapping. */
const BLAZE_TO_COCO = {
  nose: 0,
  left_eye: 1,
  right_eye: 2,
  left_ear: 3,
  right_ear: 4,
  left_shoulder: 5,
  right_shoulder: 6,
  left_elbow: 7,
  right_elbow: 8,
  left_wrist: 9,
  right_wrist: 10,
  left_hip: 11,
  right_hip: 12,
  left_knee: 13,
  right_knee: 14,
  left_ankle: 15,
  right_ankle: 16,
};

async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const tf = await initTf();
      // eslint-disable-next-line global-require
      const poseDetection = require('@tensorflow-models/pose-detection');
      const modelChoice = (process.env.ACADEMY_POSE_MODEL || 'movenet').toLowerCase();
      if (modelChoice === 'blazepose') {
        const detector = await poseDetection.createDetector(
          poseDetection.SupportedModels.BlazePose,
          { runtime: 'tfjs', modelType: 'full' },
        );
        return { detector, tf, model: 'blazepose' };
      }
      const detector = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER },
      );
      return { detector, tf, model: 'movenet' };
    })();
    detectorPromise.catch(() => {
      detectorPromise = null; // allow retry after transient failures (e.g. model fetch)
    });
  }
  return detectorPromise;
}

function decodeJpegToTensor(tf, buffer) {
  const { data, width, height } = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: false });
  return { tensor: tf.tensor3d(data, [height, width, 3], 'int32'), width, height };
}

function toCoco17(keypoints, model, width, height) {
  const out = new Array(17).fill(null).map(() => [0, 0, 0]);
  for (const kp of keypoints) {
    const idx = model === 'blazepose' ? BLAZE_TO_COCO[kp.name] : BLAZE_TO_COCO[kp.name];
    if (idx == null) continue;
    out[idx] = [
      Number((kp.x / width).toFixed(4)),
      Number((kp.y / height).toFixed(4)),
      Number((kp.score ?? 0).toFixed(2)),
    ];
  }
  return out;
}

/**
 * Full pipeline: video path -> { fps, model, frames: [{t, k}] }.
 *
 * options.window = { start, duration } re-extracts only that segment of the
 * video (used by the two-pass flow: coarse pass locates the swing, dense pass
 * re-samples just the swing window at up to 48fps). Frame timestamps are
 * always ABSOLUTE video times so client video-seek stays in sync.
 *
 * Throws with a user-presentable message when the video is unusable.
 */
async function estimatePoseFromVideo(videoPath, options = {}) {
  const probed = await probeVideo(videoPath);
  const fullDuration = probed.duration || 10;
  if (fullDuration > 60) {
    throw new Error('Video is longer than 60 seconds — trim it to just the swing and try again.');
  }
  const window = options.window || null;
  const startTime = window ? Math.max(0, window.start) : 0;
  const duration = window
    ? Math.min(window.duration, fullDuration - startTime)
    : fullDuration;

  // Sample as densely as the frame budget and the SOURCE frame rate allow
  // (never above the source — duplicated frames poison motion timing).
  // Higher sampling directly improves tempo accuracy: a driver downswing is
  // ~0.3s, so 24fps gives it only ~7 frames while 48fps gives ~14.
  const frameBudget = options.maxFrames || MAX_FRAMES;
  const budgetFps = Math.floor(frameBudget / Math.max(duration, 1));
  const sampleFps = Math.max(8, Math.min(48, probed.sourceFps || 30, budgetFps));

  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'academy-frames-'));
  try {
    const frameFiles = await extractFrames(
      videoPath,
      workDir,
      sampleFps,
      window ? startTime : null,
      window ? duration : null,
    );
    if (frameFiles.length < 8) {
      throw new Error('Could not read enough frames from the video — is the file a valid video?');
    }

    const { detector, tf, model } = await getDetector();
    const frames = [];
    let detected = 0;
    let aspect = null; // width / height of the (aspect-preserving) extracted frames

    for (let i = 0; i < frameFiles.length; i++) {
      const buf = await fs.promises.readFile(frameFiles[i]);
      const { tensor, width, height } = decodeJpegToTensor(tf, buf);
      if (aspect == null && width && height) aspect = Number((width / height).toFixed(4));
      try {
        const poses = await detector.estimatePoses(tensor, { flipHorizontal: false });
        const pose = poses && poses[0];
        const k = pose
          ? toCoco17(pose.keypoints, model, width, height)
          : new Array(17).fill(null).map(() => [0, 0, 0]);
        if (pose && pose.keypoints.some((kp) => (kp.score ?? 0) > 0.4)) detected++;
        // Absolute video time, not segment-relative — client seeking depends on it.
        frames.push({ t: Number((startTime + i / sampleFps).toFixed(3)), k });
      } finally {
        tensor.dispose();
      }
    }

    if (detected < frames.length * 0.3) {
      throw new Error(
        'Could not track a person reliably in this video. Re-record with your whole body in frame, good lighting, and the camera 3–4 metres away.',
      );
    }

    return { fps: sampleFps, model, duration: fullDuration, aspect, frames };
  } finally {
    fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Pre-initialize the TF backend + model so the first upload isn't slow. */
async function warmUp() {
  await getDetector();
}

module.exports = { estimatePoseFromVideo, warmUp };
