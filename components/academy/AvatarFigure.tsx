import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import type { PoseFrame } from '../../lib/academy/types';
import { colors } from '../../constants/colors';
import { DEVIATION_OK, DEVIATION_WARN } from '../../lib/academy/poseNormalize';

const MIN_SCORE = 0.25;
const HALO = 'rgba(11,22,41,0.55)';
const TORSO_EDGE = 'rgba(11,22,41,0.4)';
const RECESSIVE_GREY = 'rgba(138,155,176,0.85)';

type Pt = { x: number; y: number };

type Props = {
  frame: PoseFrame | null;
  edges: [number, number][];
  width: number;
  height: number;
  color: string;
  deviations?: (number | null)[];
  recessive?: boolean;
};

/** Deviation (torso units) -> status colour; null => untracked grey. */
function deviationColor(dev: number | null | undefined): string {
  if (dev == null) return colors.coolGrey;
  if (dev < DEVIATION_OK) return colors.birdieGreen;
  if (dev <= DEVIATION_WARN) return colors.eagleAmber;
  return colors.bogeyRed;
}

function worseDeviation(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return Math.max(a, b);
}

/** Rounded-corner path through polygon points (subtle fillet at each vertex). */
function roundedPolygon(pts: Pt[], radius: number): string {
  const n = pts.length;
  let d = '';
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const inLen = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
    const outLen = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    const r1 = Math.min(radius, inLen / 2);
    const r2 = Math.min(radius, outLen / 2);
    const a = { x: p1.x - ((p1.x - p0.x) / inLen) * r1, y: p1.y - ((p1.y - p0.y) / inLen) * r1 };
    const b = { x: p1.x + ((p2.x - p1.x) / outLen) * r2, y: p1.y + ((p2.y - p1.y) / outLen) * r2 };
    d += `${i === 0 ? 'M' : 'L'} ${a.x} ${a.y} Q ${p1.x} ${p1.y} ${b.x} ${b.y} `;
  }
  return `${d}Z`;
}

// Limb segments: [a, b, thick?]. Thick = upper arm / thigh.
const LIMBS: [number, number, boolean][] = [
  [5, 7, true], [7, 9, false], // left arm
  [6, 8, true], [8, 10, false], // right arm
  [11, 13, true], [13, 15, false], // left leg
  [12, 14, true], [14, 16, false], // right leg
];

/**
 * Polished 2D avatar — a drop-in visual upgrade of SkeletonOverlay. Same pose
 * data in, richer SVG out: capsule limbs, a filled torso, a head + neck, and a
 * club approximation. When `deviations` is provided each limb is coloured by
 * the worse of its endpoints (Phase 1 thresholds); `recessive` forces a single
 * muted grey for the reference figure.
 */
export default function AvatarFigure({
  frame,
  edges: _edges,
  width,
  height,
  color,
  deviations,
  recessive,
}: Props) {
  if (!frame || width <= 0 || height <= 0) return null;

  const k = frame.k;
  const vis = (i: number) => k[i] && k[i][2] >= MIN_SCORE;
  const pt = (i: number): Pt => ({ x: k[i][0] * width, y: k[i][1] * height });
  const mid = (i: number, j: number): Pt => ({ x: (k[i][0] + k[j][0]) / 2 * width, y: (k[i][1] + k[j][1]) / 2 * height });

  const thickW = width * 0.03;
  const thinW = width * 0.022;
  const capR = width * 0.014;

  // Colour for a keypoint / limb, honouring recessive + deviation mode.
  const soloColor = (i: number) =>
    recessive || !deviations ? color : deviationColor(deviations[i]);
  const limbColor = (a: number, b: number) =>
    recessive || !deviations
      ? color
      : deviationColor(worseDeviation(deviations[a], deviations[b]));

  // Reference torso length (px) for club length + head fallback sizing.
  const shoulderC = vis(5) && vis(6) ? mid(5, 6) : null;
  const hipC = vis(11) && vis(12) ? mid(11, 12) : null;
  const torsoLen =
    shoulderC && hipC ? Math.hypot(shoulderC.x - hipC.x, shoulderC.y - hipC.y) : 0;

  const nodes: React.ReactNode[] = [];

  // 1. Torso fill (needs all four corners tracked).
  if (vis(5) && vis(6) && vis(11) && vis(12)) {
    const corners = [pt(5), pt(6), pt(12), pt(11)];
    const torsoColor = recessive || !deviations
      ? color
      : deviationColor(
          [deviations[5], deviations[6], deviations[11], deviations[12]].reduce<
            number | null
          >((w, d) => worseDeviation(w, d), null),
        );
    nodes.push(
      <Path
        key="torso"
        d={roundedPolygon(corners, torsoLen * 0.16)}
        fill={torsoColor}
        fillOpacity={0.9}
        stroke={TORSO_EDGE}
        strokeWidth={Math.max(1, width * 0.004)}
      />,
    );
  }

  // 2. Limb capsules (halo under a tapered rounded-cap stroke).
  LIMBS.forEach(([a, b, thick]) => {
    if (!vis(a) || !vis(b)) return;
    const pa = pt(a);
    const pb = pt(b);
    const w = thick ? thickW : thinW;
    nodes.push(
      <Line
        key={`h${a}-${b}`}
        x1={pa.x}
        y1={pa.y}
        x2={pb.x}
        y2={pb.y}
        stroke={HALO}
        strokeWidth={w + 2.5}
        strokeLinecap="round"
      />,
      <Line
        key={`l${a}-${b}`}
        x1={pa.x}
        y1={pa.y}
        x2={pb.x}
        y2={pb.y}
        stroke={limbColor(a, b)}
        strokeWidth={w}
        strokeLinecap="round"
      />,
    );
  });

  // 3. Head + neck.
  if (vis(0)) {
    const nose = pt(0);
    const headR =
      vis(3) && vis(4)
        ? 0.55 * Math.hypot(pt(3).x - pt(4).x, pt(3).y - pt(4).y)
        : vis(5) && vis(6)
          ? 0.34 * Math.hypot(pt(5).x - pt(6).x, pt(5).y - pt(6).y)
          : width * 0.05;
    if (shoulderC) {
      nodes.push(
        <Line
          key="neck"
          x1={shoulderC.x}
          y1={shoulderC.y}
          x2={nose.x}
          y2={nose.y + headR}
          stroke={color}
          strokeWidth={thickW}
          strokeLinecap="round"
        />,
      );
    }
    nodes.push(
      <Circle key="head" cx={nose.x} cy={nose.y} r={headR} fill={soloColor(0)} />,
    );
  }

  // 4. Hands + feet caps.
  [9, 10, 15, 16].forEach((i) => {
    if (!vis(i)) return;
    const p = pt(i);
    nodes.push(<Circle key={`c${i}`} cx={p.x} cy={p.y} r={capR} fill={soloColor(i)} />);
  });

  // 5. Club — extend from wrist midpoint along elbow->wrist direction.
  if (vis(7) && vis(8) && vis(9) && vis(10)) {
    const wristMid = mid(9, 10);
    const elbowMid = mid(7, 8);
    const dx = wristMid.x - elbowMid.x;
    const dy = wristMid.y - elbowMid.y;
    const dlen = Math.hypot(dx, dy) || 1;
    const clubLen = 1.15 * (torsoLen || dlen);
    const end = { x: wristMid.x + (dx / dlen) * clubLen, y: wristMid.y + (dy / dlen) * clubLen };
    nodes.push(
      <Line
        key="club"
        x1={wristMid.x}
        y1={wristMid.y}
        x2={end.x}
        y2={end.y}
        stroke={color}
        strokeWidth={thinW * 0.6}
        strokeLinecap="round"
      />,
      <Circle key="clubhead" cx={end.x} cy={end.y} r={capR * 0.9} fill={color} />,
    );
  }

  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      {nodes}
    </Svg>
  );
}
