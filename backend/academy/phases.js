/**
 * Keyframe / phase detection over a 2D landmark sequence.
 *
 * Two stages, both scale/tempo-free:
 *
 *  1. findSwingAnchor — locate the actual swing inside the clip. Real uploads
 *     contain setup fidgeting, tee pick-ups, walking off, and grabbing the
 *     camera, some of which move the hands FASTER or FURTHER than the swing
 *     itself. Candidate motion bursts are therefore scored on swing-likeness,
 *     not raw speed:
 *       - ankle stillness   (walking moves the feet; a swing doesn't)
 *       - shoulder-height stability (bending to pick up a tee drops the
 *         shoulders by half a torso; a swing keeps them level)
 *       - hands returning through their pre-swing position (impact passes
 *         back through address; walking off never returns)
 *       - the V-shaped hand-height signature of full/short swings (hands
 *         high at the top, lowest at impact, high again in the follow-through)
 *
 *  2. Bounded geometric detection around the anchor: address = last stillness
 *     before the burst, top = max displacement along the backswing axis
 *     BEFORE the anchor, impact = the hands' return through address (with
 *     sub-frame interpolation for tempo), finish = motion decay after impact.
 *     Nothing outside the anchor window is ever considered — incidental
 *     movement after the finish cannot claim a checkpoint.
 */

const { wristPoint, bodyPoints, pointSpeeds, torsoLength, dist } = require('./geometry');

function percentile(values, p) {
  const v = [...values].sort((a, b) => a - b);
  if (!v.length) return 0;
  const idx = Math.min(v.length - 1, Math.max(0, Math.floor(p * (v.length - 1))));
  return v[idx];
}

function median(values) {
  const v = values.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
}

function clampIdx(i, n) {
  return Math.max(0, Math.min(n - 1, i));
}

/** Softened multiplier: a weak signal dampens the score but can't zero a true swing. */
function soften(score) {
  return 0.25 + 0.75 * Math.max(0, Math.min(1, score));
}

/**
 * Find the frame index of the swing's downswing/through-stroke speed peak.
 * @returns {{ anchor: number, score: number }}
 */
function findSwingAnchor(frames, swingClass) {
  const n = frames.length;
  const speeds = pointSpeeds(frames, wristPoint);
  const maxSpeed = Math.max(...speeds);
  if (maxSpeed <= 0) throw new Error('No hand motion detected in the video.');

  const dt = n > 1 ? (frames[n - 1].t - frames[0].t) / (n - 1) : 1 / 24;
  const f = (seconds) => Math.max(1, Math.round(seconds / dt));
  const torso = median(frames.map((fr) => torsoLength(fr))) || 0.2;

  // Candidate bursts: local speed maxima with non-max suppression.
  const gap = f(0.5);
  const candidates = [];
  for (let i = 1; i < n - 1; i++) {
    if (speeds[i] < 0.3 * maxSpeed) continue;
    let isMax = true;
    for (let j = Math.max(0, i - gap); j <= Math.min(n - 1, i + gap); j++) {
      if (speeds[j] > speeds[i]) {
        isMax = false;
        break;
      }
    }
    if (isMax) candidates.push(i);
  }
  if (!candidates.length) throw new Error('No hand motion detected in the video.');

  const wristY = frames.map((fr) => {
    const w = wristPoint(fr);
    return w ? w.y : null;
  });

  let best = null;
  for (const c of candidates) {
    // --- ankle stillness BEFORE the burst ---------------------------------
    // Pre-anchor only: through backswing + downswing both feet are planted,
    // but the trail heel legitimately lifts in the follow-through. And take
    // the MIN of the two ankles — walking moves both feet, a swing keeps the
    // lead foot planted even when the trail heel releases.
    let ankleDrift = null;
    {
      const from = clampIdx(c - f(0.7), n);
      const to = c;
      const refBody = bodyPoints(frames[from]);
      for (const side of ['leftAnkle', 'rightAnkle']) {
        const ref = refBody[side];
        if (!ref) continue;
        let drift = 0;
        for (let j = from; j <= to; j++) {
          const b = bodyPoints(frames[j]);
          const d = dist(b[side], ref);
          if (d != null && d > drift) drift = d;
        }
        if (ankleDrift == null || drift < ankleDrift) ankleDrift = drift;
      }
    }
    const ankleScore = ankleDrift == null ? 0.5 : 1 - ankleDrift / torso / 0.6;

    // --- shoulder height stability (kills bending for the tee) ------------
    let shoulderRange = 0;
    {
      const from = clampIdx(c - f(0.35), n);
      const to = clampIdx(c + f(0.35), n);
      let min = null;
      let max = null;
      for (let j = from; j <= to; j++) {
        const sc = bodyPoints(frames[j]).shoulderCenter;
        if (!sc) continue;
        if (min == null || sc.y < min) min = sc.y;
        if (max == null || sc.y > max) max = sc.y;
      }
      if (min != null && max != null) shoulderRange = (max - min) / torso;
    }
    const shoulderScore = 1 - shoulderRange / 0.6;

    // --- hands return through their pre-swing (address) position ----------
    const quietFrom = clampIdx(c - f(2.4), n);
    const quietTo = clampIdx(c - f(1.2), n);
    const quietW = [];
    for (let j = quietFrom; j <= quietTo; j++) {
      const w = wristPoint(frames[j]);
      if (w) quietW.push(w);
    }
    let returnScore = 0;
    if (quietW.length) {
      const qx = median(quietW.map((w) => w.x));
      const qy = median(quietW.map((w) => w.y));
      let minReturn = null;
      for (let j = clampIdx(c - f(0.1), n); j <= clampIdx(c + f(0.15), n); j++) {
        const w = wristPoint(frames[j]);
        if (!w) continue;
        const d = Math.hypot(w.x - qx, w.y - qy);
        if (minReturn == null || d < minReturn) minReturn = d;
      }
      if (minReturn != null) returnScore = 1 - minReturn / torso / 0.5;
    }

    // --- V-shaped hand height (full/short swings) --------------------------
    let vScore = 0;
    {
      const yAt = wristY[c];
      let beforeHigh = null;
      for (let j = clampIdx(c - f(1.2), n); j <= clampIdx(c - f(0.15), n); j++) {
        if (wristY[j] != null && (beforeHigh == null || wristY[j] < beforeHigh)) beforeHigh = wristY[j];
      }
      let afterHigh = null;
      for (let j = clampIdx(c + f(0.12), n); j <= clampIdx(c + f(0.9), n); j++) {
        if (wristY[j] != null && (afterHigh == null || wristY[j] < afterHigh)) afterHigh = wristY[j];
      }
      if (yAt != null && beforeHigh != null && afterHigh != null) {
        const vDepth = Math.min(yAt - beforeHigh, yAt - afterHigh) / torso;
        const fullDepth = swingClass === 'full' ? 0.35 : 0.15;
        vScore = vDepth / fullDepth;
      }
    }

    const shape = swingClass === 'stroke' ? returnScore : Math.max(vScore, returnScore);
    const score = (speeds[c] / maxSpeed) * soften(ankleScore) * soften(shoulderScore) * soften(shape);
    if (!best || score > best.score) best = { anchor: c, score };
  }

  if (!best || best.score < 0.05) {
    throw new Error(
      'Could not find a golf swing in this video. Make sure the full swing is in frame and try again.',
    );
  }
  return best;
}

/**
 * @param frames landmark frames [{t, k}] (raw, unsmoothed — curve fitting
 *        handles noise without the phase lag of pre-filtering)
 * @param swingClass 'full' | 'short' | 'stroke'
 * @returns {{ indices, times, targetDir, leadSide, quality }}
 */
function detectPhases(frames, swingClass) {
  const n = frames.length;
  if (n < 10) throw new Error('Video too short to analyze — need at least ~1 second of footage.');

  const dt = n > 1 ? (frames[n - 1].t - frames[0].t) / (n - 1) : 1 / 24;
  const f = (seconds) => Math.max(1, Math.round(seconds / dt));

  // --- 1. locate the swing ---------------------------------------------------
  const { anchor, score: anchorScore } = findSwingAnchor(frames, swingClass);

  // Everything below operates inside this window only.
  const lo = clampIdx(anchor - f(4.0), n);
  const hi = clampIdx(anchor + f(2.0), n);

  const speeds = pointSpeeds(frames, wristPoint);
  const rawSpeeds = pointSpeeds(frames, wristPoint, false);
  let windowPeak = 0;
  for (let i = lo; i <= hi; i++) windowPeak = Math.max(windowPeak, speeds[i]);
  const p95 = Math.max(percentile(speeds.slice(lo, hi + 1), 0.95), windowPeak * 0.3);
  const stillThresh = p95 * 0.06;
  const riseThresh = p95 * 0.02;

  // --- 2. provisional address: last stillness run before the burst ------------
  // Only used to place the projection origin; the final address is re-derived
  // from the takeaway below, so pre-swing waggling can't drag it early.
  const minStill = f(0.2);
  let address0 = -1;
  {
    const searchEnd = clampIdx(anchor - f(0.25), n);
    let runLen = 0;
    for (let i = lo; i <= searchEnd; i++) {
      if (speeds[i] <= stillThresh) {
        runLen++;
        if (runLen >= minStill) address0 = i; // end of the latest qualifying run
      } else {
        runLen = 0;
      }
    }
    if (address0 < 0) {
      // Clip trimmed straight into the action: quietest frame ahead of the burst.
      let quietest = clampIdx(anchor - f(0.3), n);
      const from = clampIdx(anchor - f(2.5), n);
      for (let i = from; i <= clampIdx(anchor - f(0.3), n); i++) {
        if (speeds[i] < speeds[quietest]) quietest = i;
      }
      address0 = quietest;
    }
  }
  address0 = clampIdx(address0, n);

  // --- 3. backswing axis + projection ------------------------------------------
  const origin = wristPoint(frames[address0]);
  if (!origin) throw new Error('Hands not visible at the start of the swing.');

  const disp = frames.map((fr, i) => {
    if (i < lo || i > hi) return null;
    const w = wristPoint(fr);
    return w
      ? { x: w.x - origin.x, y: w.y - origin.y, m: Math.hypot(w.x - origin.x, w.y - origin.y) }
      : null;
  });

  // Backswing displacement peaks at the top, which precedes the anchor.
  let maxBackDisp = 0;
  for (let i = address0; i <= anchor; i++) if (disp[i] && disp[i].m > maxBackDisp) maxBackDisp = disp[i].m;
  if (maxBackDisp < 1e-4) throw new Error('No hand motion detected in the video.');

  let axis = null;
  for (let i = address0; i <= anchor; i++) {
    if (disp[i] && disp[i].m >= 0.4 * maxBackDisp) {
      axis = { x: disp[i].x / disp[i].m, y: disp[i].y / disp[i].m };
      break;
    }
  }
  if (!axis) axis = { x: 1, y: 0 };

  const proj = disp.map((d) => (d ? d.x * axis.x + d.y * axis.y : 0));

  // --- 4. top: max projection BEFORE the downswing speed peak ------------------
  let top = address0;
  for (let i = address0; i <= anchor; i++) if (proj[i] > proj[top]) top = i;
  if (top <= address0) top = clampIdx(address0 + 1, n);
  const topProj = proj[top];

  // --- 5. takeaway + final address ---------------------------------------------
  // Takeaway = the base of the MONOTONE rise into the top. Speed-based "first
  // motion after address" breaks on real golfers, who waggle between settling
  // and swinging — waggle speed kept the old detector permanently "in motion",
  // inflating backswing time (and therefore tempo) by seconds. Walk back from
  // the top along the median-smoothed displacement MAGNITUDE (distance from
  // address — monotone even on strongly curved real backswing paths, unlike
  // the 1-D projection) and stop at the base (~0) or at the first upward bump
  // behind us (a waggle). The median kills single-frame tracking glitches.
  const magAt = (i) => (disp[i] ? disp[i].m : 0);
  const magSm = frames.map((_, i) => {
    const a = magAt(Math.max(0, i - 1));
    const b = magAt(i);
    const c = magAt(Math.min(n - 1, i + 1));
    return [a, b, c].sort((x, y) => x - y)[1];
  });
  const eps = 0.02 * maxBackDisp;
  let takeaway = top;
  while (takeaway > address0) {
    if (magSm[takeaway] <= 0.03 * maxBackDisp) break; // base of the rise
    if (magSm[takeaway - 1] > magSm[takeaway] + eps) break; // waggle bump behind us
    takeaway--;
  }
  // Micro-refinement against raw speed for the gentle first inches of the
  // move — capped to a short window so it can never traverse a waggle.
  const refineFloor = Math.max(address0, takeaway - f(0.25));
  while (takeaway > refineFloor && rawSpeeds[takeaway - 1] > riseThresh) takeaway--;
  takeaway = clampIdx(Math.min(takeaway, top - 1), n);

  // Address = the last quiet frame at/before the takeaway.
  let address = -1;
  for (let i = takeaway; i >= Math.max(lo, takeaway - f(1.2)); i--) {
    if (speeds[i] <= stillThresh) {
      address = i;
      break;
    }
  }
  if (address < 0) {
    address = Math.max(lo, takeaway - 1);
    for (let i = Math.max(lo, takeaway - f(1.2)); i <= takeaway; i++) {
      if (speeds[i] < speeds[address]) address = i;
    }
  }
  address = clampIdx(Math.min(address, takeaway), n);

  // --- 6. impact: hands return through address after the top ------------------
  const impactSearchEnd = clampIdx(Math.min(hi, anchor + f(0.4)), n);
  let impact = -1;
  const impactLevel = topProj * 0.05;
  for (let i = top + 1; i <= impactSearchEnd; i++) {
    if (proj[i] <= impactLevel) {
      impact = i > top + 1 && Math.abs(proj[i - 1]) < Math.abs(proj[i]) ? i - 1 : i;
      break;
    }
  }
  let impactCrossed = impact >= 0;
  if (!impactCrossed) {
    impact = top + 1;
    for (let i = top + 1; i <= impactSearchEnd; i++) if (proj[i] < proj[impact]) impact = i;
  }
  impact = clampIdx(Math.max(impact, top + 1), n);

  // --- 7. finish: motion decay (or follow-through extreme) after impact -------
  // Decay must be SUSTAINED (a finish hold), and the search starts a beat
  // after impact — hand speed momentarily dips near impact on slow strokes.
  const finishWindowEnd = clampIdx(Math.min(hi, impact + f(1.5)), n);
  let finish = -1;
  const decayRun = Math.max(2, f(0.12));
  let run = 0;
  for (let i = clampIdx(impact + f(0.1), n); i <= finishWindowEnd; i++) {
    if (speeds[i] < windowPeak * 0.12) {
      run++;
      if (run >= decayRun) {
        finish = i - decayRun + 1;
        break;
      }
    } else {
      run = 0;
    }
  }
  if (finish < 0) {
    let minIdx = impact;
    for (let i = impact; i <= finishWindowEnd; i++) if (proj[i] < proj[minIdx]) minIdx = i;
    if (proj[minIdx] < -0.05 * topProj) {
      for (let i = impact; i <= minIdx; i++) {
        if (proj[i] <= 0.9 * proj[minIdx]) {
          finish = i;
          break;
        }
      }
    }
  }
  if (finish < 0 || finish <= impact) finish = Math.max(finishWindowEnd, impact + 1);
  finish = clampIdx(finish, n);

  // --- 8. sub-frame phase times for tempo -------------------------------------
  // A downswing is only a handful of frames, so integer keyframes quantize the
  // tempo ratio far too coarsely. Interpolate continuous times: parabolic
  // vertex at the top, linear zero-crossing at impact, speed-rise at takeaway.
  const times = {
    takeaway: frames[takeaway].t,
    top: frames[top].t,
    impact: frames[impact].t,
  };
  if (top > 0 && top < n - 1) {
    const y0 = proj[top - 1] ?? 0;
    const y1 = proj[top];
    const y2 = proj[top + 1] ?? 0;
    const denom = y0 - 2 * y1 + y2;
    if (Math.abs(denom) > 1e-9) {
      const offset = Math.max(-1, Math.min(1, (0.5 * (y0 - y2)) / denom));
      const dtLocal = (frames[clampIdx(top + 1, n)].t - frames[clampIdx(top - 1, n)].t) / 2;
      times.top = frames[top].t + offset * dtLocal;
    }
  }
  for (let i = top + 1; i <= impactSearchEnd; i++) {
    if ((proj[i] ?? 0) <= 0 && (proj[i - 1] ?? 0) > 0) {
      const u = proj[i - 1] / (proj[i - 1] - proj[i]);
      times.impact = frames[i - 1].t + u * (frames[i].t - frames[i - 1].t);
      break;
    }
  }
  if (takeaway > 0 && rawSpeeds[takeaway] > riseThresh && rawSpeeds[takeaway - 1] <= riseThresh) {
    const u = (riseThresh - rawSpeeds[takeaway - 1]) / (rawSpeeds[takeaway] - rawSpeeds[takeaway - 1]);
    times.takeaway = frames[takeaway - 1].t + u * (frames[takeaway].t - frames[takeaway - 1].t);
  }

  // --- direction + handedness ---------------------------------------------------
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

  // --- quality -------------------------------------------------------------------
  const minTravel = swingClass === 'stroke' ? 0.02 : 0.06;
  let quality = 'high';
  if (topProj < minTravel || !impactCrossed || anchorScore < 0.12) quality = 'low';
  else if (topProj < minTravel * 2 || anchorScore < 0.25) quality = 'medium';

  return {
    indices: { address, takeaway, top, impact, finish },
    times,
    targetDir,
    leadSide,
    quality,
    peakSpeed: windowPeak,
    anchorScore,
  };
}

module.exports = { detectPhases, findSwingAnchor };
