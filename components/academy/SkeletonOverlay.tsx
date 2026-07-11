import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import type { PoseFrame } from '../../lib/academy/types';
import { colors } from '../../constants/colors';
import { DEVIATION_OK, DEVIATION_WARN } from '../../lib/academy/poseNormalize';

const MIN_SCORE = 0.25;

type Props = {
  frame: PoseFrame | null;
  edges: [number, number][];
  width: number;
  height: number;
  color: string;
  /** Joint dot radius in px (scaled to overlay size by default). */
  jointRadius?: number;
  /**
   * Optional per-keypoint deviation (torso units) vs a reference. When
   * provided, each edge/joint is coloured by deviation instead of `color`.
   */
  deviations?: (number | null)[];
};

/** Map a deviation (torso units) to a status colour; null => untracked grey. */
function deviationColor(dev: number | null | undefined): string {
  if (dev == null) return colors.coolGrey; // untracked (bogeyGrey not defined)
  if (dev < DEVIATION_OK) return colors.birdieGreen;
  if (dev <= DEVIATION_WARN) return colors.eagleAmber;
  return colors.bogeyRed;
}

/** Worse (max) of two deviations; null only when both are null. */
function worseDeviation(
  a: number | null | undefined,
  b: number | null | undefined,
): number | null {
  if (a == null) return b ?? null;
  if (b == null) return a;
  return Math.max(a, b);
}

/**
 * 2D skeleton rendered over the swing video. Landmarks are normalized to the
 * video frame, so the Svg must exactly cover the displayed video rect.
 * Each bone is drawn twice — a dark halo underneath the accent stroke — so
 * the overlay stays readable on bright fairway/sky footage.
 *
 * When `deviations` is supplied, each edge is coloured by the worse of its two
 * endpoints and each joint by its own deviation, instead of the flat `color`.
 */
export default function SkeletonOverlay({
  frame,
  edges,
  width,
  height,
  color,
  jointRadius,
  deviations,
}: Props) {
  if (!frame || width <= 0 || height <= 0) return null;
  const r = jointRadius ?? Math.max(2.5, width * 0.011);
  const strokeW = Math.max(2, width * 0.008);

  const visible = (i: number) => frame.k[i] && frame.k[i][2] >= MIN_SCORE;

  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {edges.map(([a, b], i) => {
        if (!visible(a) || !visible(b)) return null;
        const [ax, ay] = frame.k[a];
        const [bx, by] = frame.k[b];
        const stroke = deviations
          ? deviationColor(worseDeviation(deviations[a], deviations[b]))
          : color;
        return (
          <React.Fragment key={`e${i}`}>
            <Line
              x1={ax * width}
              y1={ay * height}
              x2={bx * width}
              y2={by * height}
              stroke="rgba(11,22,41,0.55)"
              strokeWidth={strokeW + 2.5}
              strokeLinecap="round"
            />
            <Line
              x1={ax * width}
              y1={ay * height}
              x2={bx * width}
              y2={by * height}
              stroke={stroke}
              strokeWidth={strokeW}
              strokeLinecap="round"
            />
          </React.Fragment>
        );
      })}
      {frame.k.map((kp, i) => {
        if (!kp || kp[2] < MIN_SCORE) return null;
        const ring = deviations ? deviationColor(deviations[i]) : color;
        return (
          <Circle
            key={`j${i}`}
            cx={kp[0] * width}
            cy={kp[1] * height}
            r={r}
            fill="#FFFFFF"
            stroke={ring}
            strokeWidth={Math.max(1.5, strokeW * 0.6)}
          />
        );
      })}
    </Svg>
  );
}
