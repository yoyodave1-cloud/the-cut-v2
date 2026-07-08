/**
 * Keyframe / phase detection over a smoothed 2D landmark sequence.
 *
 * Projection-based and scale/tempo-free: every threshold is relative to the
 * clip's own motion statistics, so a lightning-quick chip and a slow-motion
 * driver swing segment identically, and clips trimmed right to the takeaway
 * (no stillness at the start) still resolve.
 *
 * Method:
 *   1. address  — last quiet frame before the first sustained hand motion
 *                 (frame 0 if the clip starts mid-move)
 *   2. axis     — the backswing direction, taken from the hands' early
 *                 displacement away from address
 *   3. top      — maximum displacement along that axis (top of backswing /
 *                 backstroke end)
 *   4. impact   — the hands' return through the address position after the
 *                 top (projection zero-crossing, refined to the nearest frame)
 *   5. finish   — the far extreme on the follow-through side of the axis
 *
 * Because top/impact/finish are geometric (positions on the backswing axis),
 * not speed-peak heuristics, they hold across tempos and trims.
 */

const { wristPoint, bodyPoints, pointSpeeds } = require('./geometry');

function percentile(values, p) {
  const v = [...values].sort((a, b) => a - b);
  if (!v.length) return 0;
  const idx = Math.min(v.length - 1, Math.max(0, Math.floor(p * (v.length - 1))));
  return v[idx];
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
  // Unaveraged speeds for takeaway timing: the 3-point average in `speeds`
  // bleeds motion one frame backward, which is exactly the frame boundary the
  // takeaway estimate cares about.
  const rawSpeeds = pointSpeeds(frames, wristPoint, false);
  const p95 = percentile(speeds, 0.95);
  if (p95 <= 0) throw new Error('No hand motion detected in the video.');
  const moveThresh = p95 * 0.12;
  const stillThresh = p95 * 0.06;

  // --- 1. first sustained motion + address --------------------------------
  let firstMove = -1;
  for (let i = 0; i < n - 1; i++) {
    if (speeds[i] > moveThresh && speeds[i + 1] > moveThresh) {
      firstMove = i;
      break;
    }
  }
  if (firstMove < 0) throw new Error('No hand motion detected in the video.');

  let address = -1;
  for (let i = firstMove - 1; i >= 0; i--) {
    if (speeds[i] <= stillThresh) {
      address = i;
      break;
    }
  }
  if (address < 0) address = Math.max(0, firstMove - 1); // clip trimmed mid-takeaway

  // Sustained-motion detection triggers part-way into the (slow-starting)
  // takeaway; walk back to where hand speed actually rises from zero so the
  // backswing time — and therefore the tempo ratio — isn't truncated.
  let takeaway = Math.max(address, Math.min(firstMove, n - 2));
  const riseThresh = p95 * 0.02;
  while (takeaway > address + 1 && rawSpeeds[takeaway - 1] > riseThresh) takeaway--;

  // --- 2. backswing axis ----------------------------------------------------
  const origin = wristPoint(frames[address]);
  if (!origin) throw new Error('Hands not visible at the start of the swing.');

  const disp = frames.map((f) => {
    const w = wristPoint(f);
    return w ? { x: w.x - origin.x, y: w.y - origin.y, m: Math.hypot(w.x - origin.x, w.y - origin.y) } : null;
  });
  let maxDisp = 0;
  for (let i = takeaway; i < n; i++) if (disp[i] && disp[i].m > maxDisp) maxDisp = disp[i].m;
  if (maxDisp < 1e-4) throw new Error('No hand motion detected in the video.');

  // Early displacement defines which side is the backswing.
  let axis = null;
  for (let i = takeaway; i < n; i++) {
    if (disp[i] && disp[i].m >= 0.4 * maxDisp) {
      axis = { x: disp[i].x / disp[i].m, y: disp[i].y / disp[i].m };
      break;
    }
  }
  if (!axis) axis = { x: 1, y: 0 };

  const proj = disp.map((d) => (d ? d.x * axis.x + d.y * axis.y : 0));

  // --- 3. top ----------------------------------------------------------------
  let top = takeaway;
  for (let i = takeaway; i < n; i++) if (proj[i] > proj[top]) top = i;
  if (top <= takeaway) top = Math.min(takeaway + 1, n - 2);
  const topProj = proj[top];

  // --- 4. impact: zero-crossing of the projection after the top --------------
  let impact = -1;
  const impactLevel = topProj * 0.05;
  for (let i = top + 1; i < n; i++) {
    if (proj[i] <= impactLevel) {
      // Refine to whichever adjacent frame is truly closest to the address line.
      impact = i > top + 1 && Math.abs(proj[i - 1]) < Math.abs(proj[i]) ? i - 1 : i;
      break;
    }
  }
  let impactCrossed = impact >= 0;
  if (!impactCrossed) {
    // Downswing cut off before the ball: nearest return toward address.
    impact = top + 1;
    for (let i = top + 1; i < n; i++) if (proj[i] < proj[impact]) impact = i;
  }
  impact = Math.max(Math.min(impact, n - 1), top + 1);

  // --- 5. finish: follow-through extreme on the opposite side ----------------
  let minIdx = impact;
  for (let i = impact; i < n; i++) if (proj[i] < proj[minIdx]) minIdx = i;
  let finish = n - 1;
  if (proj[minIdx] < -0.05 * topProj) {
    // First frame reaching 90% of the follow-through extreme — avoids drifting
    // into the post-swing hold on clips with a long tail.
    for (let i = impact; i <= minIdx; i++) {
      if (proj[i] <= 0.9 * proj[minIdx]) {
        finish = i;
        break;
      }
    }
  } else {
    // No real follow-through in frame: decay of motion after impact.
    finish = n - 1;
    for (let i = Math.min(impact + 2, n - 1); i < n - 1; i++) {
      if (speeds[i] < stillThresh && speeds[i + 1] < stillThresh) {
        finish = i;
        break;
      }
    }
  }
  if (finish <= impact) finish = Math.min(impact + 1, n - 1);

  // --- direction + handedness ------------------------------------------------
  const wImpact = wristPoint(frames[impact]);
  const wFinish = wristPoint(frames[finish]);
  let targetDir = 0;
  if (wImpact && wFinish) targetDir = Math.sign(wFinish.x - wImpact.x) || 0;
  if (targetDir === 0) targetDir = Math.sign(-axis.x) || 1;

  const b = bodyPoints(frames[address]);
  let leadSide = 'left';
  if (b.leftShoulder && b.rightShoulder) {
    leadSide = b.leftShoulder.x * targetDir > b.rightShoulder.x * targetDir ? 'left' : 'right';
  }

  // --- sub-frame phase times for tempo -----------------------------------------
  // A downswing is only ~7 frames at 24fps, so integer keyframes quantize the
  // tempo ratio by up to ±30%. Interpolate continuous times: parabolic vertex
  // at the top, linear zero-crossing at impact, speed-rise crossing at takeaway.
  const times = {
    takeaway: frames[takeaway].t,
    top: frames[top].t,
    impact: frames[impact].t,
  };
  if (top > 0 && top < n - 1) {
    const y0 = proj[top - 1];
    const y1 = proj[top];
    const y2 = proj[top + 1];
    const denom = y0 - 2 * y1 + y2;
    if (Math.abs(denom) > 1e-9) {
      const offset = Math.max(-1, Math.min(1, (0.5 * (y0 - y2)) / denom));
      const dtLocal = (frames[top + 1].t - frames[top - 1].t) / 2;
      times.top = frames[top].t + offset * dtLocal;
    }
  }
  for (let i = top + 1; i < n; i++) {
    if (proj[i] <= 0 && proj[i - 1] > 0) {
      const u = proj[i - 1] / (proj[i - 1] - proj[i]);
      times.impact = frames[i - 1].t + u * (frames[i].t - frames[i - 1].t);
      break;
    }
  }
  if (takeaway > 0 && rawSpeeds[takeaway] > riseThresh && rawSpeeds[takeaway - 1] <= riseThresh) {
    const u = (riseThresh - rawSpeeds[takeaway - 1]) / (rawSpeeds[takeaway] - rawSpeeds[takeaway - 1]);
    times.takeaway = frames[takeaway - 1].t + u * (frames[takeaway].t - frames[takeaway - 1].t);
  }

  // --- quality ----------------------------------------------------------------
  const minTravel = swingClass === 'stroke' ? 0.02 : 0.06;
  let quality = 'high';
  if (topProj < minTravel || !impactCrossed) quality = 'low';
  else if (topProj < minTravel * 2) quality = 'medium';

  return {
    indices: { address, takeaway, top, impact, finish },
    times,
    targetDir,
    leadSide,
    quality,
    peakSpeed: p95,
  };
}

module.exports = { detectPhases };
