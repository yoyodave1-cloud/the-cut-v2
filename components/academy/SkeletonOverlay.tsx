import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import type { PoseFrame } from '../../lib/academy/types';

const MIN_SCORE = 0.25;

type Props = {
  frame: PoseFrame | null;
  edges: [number, number][];
  width: number;
  height: number;
  color: string;
  /** Joint dot radius in px (scaled to overlay size by default). */
  jointRadius?: number;
};

/**
 * 2D skeleton rendered over the swing video. Landmarks are normalized to the
 * video frame, so the Svg must exactly cover the displayed video rect.
 * Each bone is drawn twice — a dark halo underneath the accent stroke — so
 * the overlay stays readable on bright fairway/sky footage.
 */
export default function SkeletonOverlay({
  frame,
  edges,
  width,
  height,
  color,
  jointRadius,
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
              stroke={color}
              strokeWidth={strokeW}
              strokeLinecap="round"
            />
          </React.Fragment>
        );
      })}
      {frame.k.map((kp, i) => {
        if (!kp || kp[2] < MIN_SCORE) return null;
        return (
          <Circle
            key={`j${i}`}
            cx={kp[0] * width}
            cy={kp[1] * height}
            r={r}
            fill="#FFFFFF"
            stroke={color}
            strokeWidth={Math.max(1.5, strokeW * 0.6)}
          />
        );
      })}
    </Svg>
  );
}
