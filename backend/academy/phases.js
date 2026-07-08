/**
 * Keyframe / phase detection over a smoothed 2D landmark sequence.
 *
 * Works for all three swing classes with the same displacement logic:
 *   - address:  end of the initial low-motion run
 *   - takeaway: first sustained motion after address (full swings only)
 *   - top:      max hand displacement from address before the speed peak
 *               (top of backswing for full swings, backstroke end for strokes)
 *   - impact:   hands back nearest the address position around the speed peak
 *   - finish:   motion decays after impact (or last frame)
 *
 * Also infers target direction (+x or -x in the image) and the golfer's
 * lead side so metrics can be signed "toward / away from target".
 */

const { wristPoint, bodyPoints, pointSpeeds, dist } = require('./geometry');

function displacementSeries(frames, origin) {
  return frames.map((f) => {
    const w = wristPoint(f);
    return w && origin ? dist(w, origin) : 0;
  });
}

function argmax(arr, from, to) {
  let best = from;
  for (let i = from; i <= to; i++) if (arr[i] > arr[best]) best = i;
  return best;
}

function argmin(arr, from, to) {
  let best = from;
  for (let i = from; i <= to; i++) if (arr[i] < arr[best]) best = i;
  return best;
}

/**
 * @param frames smoothed frames [{t, k}]
 * @param swingClass 'full' | 'short' | 'stroke'
 * @returns {{ indices: {address, takeaway, top, impact, finish}, targetDir, leadSide, quality }}
 */
function detectPhases(frames, swingClass) {
  const n = frames.length;
  if (n < 10) throw new Error('Video too short to analyze — need at least ~1 second of footage.');

  const speeds = pointSpeeds(frames, wristPoint);
  const peakSpeed = Math.max(...speeds);
  if (peakSpeed <= 0) throw new Error('No hand motion detected in the video.');

  const stillThresh = peakSpeed * (swingClass === 'stroke' ? 0.08 : 0.05);
  const moveThresh = peakSpeed * (swingClass === 'stroke' ? 0.15 : 0.1);

  // Address: last frame of the opening still period (before first sustained motion).
  let firstMove = 1;
  while (firstMove < n - 1 && speeds[firstMove] < moveThresh) firstMove++;
  let address = firstMove - 1;
  while (address > 0 && speeds[address] > stillThresh) address--;
  address = Math.max(0, address);

  const takeaway = Math.min(firstMove, n - 2);

  // Speed peak after the takeaway ≈ downswing just before impact.
  const searchFrom = Math.min(takeaway + 2, n - 1);
  const peakIdx = argmax(speeds, searchFrom, n - 1);

  // Top: furthest hand position from address before the speed peak.
  const originWrist = wristPoint(frames[address]);
  const disp = displacementSeries(frames, originWrist);
  const topSearchEnd = Math.max(searchFrom, peakIdx - 1);
  let top = argmax(disp, takeaway, topSearchEnd);
  if (top <= takeaway) top = Math.min(takeaway + 1, n - 2);

  // Impact: hands nearest the address position around the speed peak.
  const dt = frames.length > 1 ? frames[1].t - frames[0].t : 1 / 24;
  const win = Math.max(2, Math.round(0.25 / dt));
  const impactFrom = Math.max(top + 1, peakIdx - win);
  const impactTo = Math.min(n - 1, peakIdx + win);
  let impact = argmin(disp, impactFrom, impactTo);
  if (impact <= top) impact = Math.min(top + 1, n - 1);

  // Finish: motion decays after impact.
  let finish = n - 1;
  const decay = peakSpeed * 0.12;
  for (let i = Math.min(impact + 2, n - 1); i < n - 1; i++) {
    if (speeds[i] < decay && speeds[i + 1] < decay) {
      finish = i;
      break;
    }
  }
  if (finish <= impact) finish = n - 1;

  // Target direction: net hand travel after impact (follow-through side).
  const wImpact = wristPoint(frames[impact]);
  const wFinish = wristPoint(frames[Math.min(finish, n - 1)]);
  let targetDir = 0;
  if (wImpact && wFinish) targetDir = Math.sign(wFinish.x - wImpact.x) || 0;
  if (targetDir === 0 && originWrist && wFinish) {
    targetDir = Math.sign(wFinish.x - originWrist.x) || 1;
  }
  if (targetDir === 0) targetDir = 1;

  // Lead side: the body side closer to the target at address.
  const b = bodyPoints(frames[address]);
  let leadSide = 'left';
  if (b.leftShoulder && b.rightShoulder) {
    leadSide =
      b.leftShoulder.x * targetDir > b.rightShoulder.x * targetDir ? 'left' : 'right';
  }

  // Rough confidence: enough travel between phases to trust the segmentation.
  const travel = disp[top] || 0;
  const quality = travel < 0.05 ? 'low' : travel < 0.15 ? 'medium' : 'high';

  return {
    indices: { address, takeaway, top, impact, finish },
    targetDir,
    leadSide,
    quality,
    peakSpeed,
  };
}

module.exports = { detectPhases };
