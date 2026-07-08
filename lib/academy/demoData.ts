/**
 * Bundled demo data for Academy.
 *
 * Two jobs:
 *  1. Demo mode — every Academy screen renders real UI in Expo Go before the
 *     backend patch is live (clearly badged "Demo" in the UI via the `demo`
 *     flags).
 *  2. Reference sequences — the Compare view's "good position" side uses the
 *     ideal synthetic sequence for the selected shot type, real data or not.
 *
 * The skeleton sequences are parametric stick-figure swings (same generator
 * family as the backend smoke test), so overlays, scrubbing, keyframes, and
 * angle callouts all behave exactly like a real analysis payload.
 */

import { SHOT_TYPE_LIBRARY } from './shotTypeLibrary';
import type {
  DashboardData,
  IdentifiedFault,
  JointAngleData,
  LandmarkTuple,
  PerFrameAngles,
  PoseFrame,
  ShotTypeId,
  UploadDetail,
} from './types';

const FPS = 24;

const SKELETON_EDGES: [number, number][] = [
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10], [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16], [0, 1], [0, 2], [1, 3], [2, 4],
];

const KEYPOINT_NAMES = [
  'nose', 'left_eye', 'right_eye', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
];

function lerp(a: number, b: number, u: number) {
  return a + (b - a) * u;
}

function ease(u: number) {
  return 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));
}

type FigureState = { handX: number; handY: number; turn: number; hipShift: number };

function golferFrame(t: number, s: FigureState): PoseFrame {
  const cx = 0.5 + s.hipShift;
  const shoulderW = 0.07 * Math.cos((s.turn * Math.PI) / 180);
  const hipW = 0.05 * Math.cos((s.turn * 0.5 * Math.PI) / 180);
  const p = (x: number, y: number): LandmarkTuple => [
    Number(x.toFixed(4)),
    Number(y.toFixed(4)),
    0.9,
  ];
  const k: LandmarkTuple[] = new Array(17);
  k[0] = p(cx, 0.28);
  k[1] = p(cx - 0.01, 0.27);
  k[2] = p(cx + 0.01, 0.27);
  k[3] = p(cx - 0.02, 0.28);
  k[4] = p(cx + 0.02, 0.28);
  k[5] = p(cx - shoulderW, 0.35);
  k[6] = p(cx + shoulderW, 0.35);
  k[7] = p(lerp(cx - 0.09, s.handX, 0.5), lerp(0.44, s.handY, 0.5));
  k[8] = p(lerp(cx + 0.09, s.handX, 0.5), lerp(0.44, s.handY, 0.5));
  k[9] = p(s.handX - 0.005, s.handY);
  k[10] = p(s.handX + 0.005, s.handY);
  k[11] = p(cx - hipW, 0.55);
  k[12] = p(cx + hipW, 0.55);
  k[13] = p(0.45, 0.72);
  k[14] = p(0.55, 0.72);
  k[15] = p(0.44, 0.9);
  k[16] = p(0.56, 0.9);
  return { t: Number(t.toFixed(3)), k };
}

type SwingParams = {
  backDur: number;
  downDur: number;
  topX: number;
  topY: number;
  topTurn: number;
  finishX: number;
  finishY: number;
  finishTurn: number;
};

/** Ideal reference motion per shot type (used for Compare's "good position" side). */
const IDEAL_PARAMS: Record<ShotTypeId, SwingParams> = {
  driving: { backDur: 0.95, downDur: 0.32, topX: 0.66, topY: 0.2, topTurn: 90, finishX: 0.34, finishY: 0.24, finishTurn: 45 },
  iron: { backDur: 0.9, downDur: 0.3, topX: 0.63, topY: 0.24, topTurn: 85, finishX: 0.37, finishY: 0.27, finishTurn: 42 },
  bunker: { backDur: 0.62, downDur: 0.38, topX: 0.61, topY: 0.36, topTurn: 48, finishX: 0.38, finishY: 0.36, finishTurn: 38 },
  chipping: { backDur: 0.52, downDur: 0.37, topX: 0.575, topY: 0.5, topTurn: 22, finishX: 0.42, finishY: 0.49, finishTurn: 35 },
  putting: { backDur: 0.56, downDur: 0.28, topX: 0.555, topY: 0.575, topTurn: 6, finishX: 0.44, finishY: 0.57, finishTurn: 8 },
};

/** Slightly flawed motion for the demo "your swing" side (quicker, shorter turn). */
const FLAWED_PARAMS: Record<ShotTypeId, SwingParams> = {
  driving: { backDur: 0.7, downDur: 0.34, topX: 0.6, topY: 0.27, topTurn: 62, finishX: 0.38, finishY: 0.3, finishTurn: 32 },
  iron: { backDur: 0.68, downDur: 0.32, topX: 0.6, topY: 0.28, topTurn: 60, finishX: 0.4, finishY: 0.31, finishTurn: 32 },
  bunker: { backDur: 0.5, downDur: 0.42, topX: 0.585, topY: 0.42, topTurn: 35, finishX: 0.44, finishY: 0.43, finishTurn: 25 },
  chipping: { backDur: 0.55, downDur: 0.4, topX: 0.59, topY: 0.5, topTurn: 15, finishX: 0.46, finishY: 0.51, finishTurn: 18 },
  putting: { backDur: 0.45, downDur: 0.32, topX: 0.56, topY: 0.575, topTurn: 3, finishX: 0.465, finishY: 0.572, finishTurn: 4 },
};

function jointAngle(
  a: LandmarkTuple | undefined,
  b: LandmarkTuple | undefined,
  c: LandmarkTuple | undefined,
): number | null {
  if (!a || !b || !c) return null;
  const v1 = { x: a[0] - b[0], y: a[1] - b[1] };
  const v2 = { x: c[0] - b[0], y: c[1] - b[1] };
  const m1 = Math.hypot(v1.x, v1.y);
  const m2 = Math.hypot(v2.x, v2.y);
  if (m1 < 1e-6 || m2 < 1e-6) return null;
  const cos = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (m1 * m2)));
  return Math.round(((Math.acos(cos) * 180) / Math.PI) * 10) / 10;
}

function anglesForFrame(frame: PoseFrame): PerFrameAngles {
  const k = frame.k;
  const midX = (i: number, j: number) => (k[i][0] + k[j][0]) / 2;
  const midY = (i: number, j: number) => (k[i][1] + k[j][1]) / 2;
  const spine =
    Math.round(
      ((Math.atan2(midX(5, 6) - midX(11, 12), -(midY(5, 6) - midY(11, 12))) * 180) / Math.PI) * 10,
    ) / 10;
  const leadArmAngle = jointAngle(k[5], k[7], k[9]);
  const shoulderLine =
    Math.round(((Math.atan2(k[6][1] - k[5][1], Math.abs(k[6][0] - k[5][0])) * 180) / Math.PI) * 10) / 10;
  const hipLine =
    Math.round(((Math.atan2(k[12][1] - k[11][1], Math.abs(k[12][0] - k[11][0])) * 180) / Math.PI) * 10) / 10;
  const lKnee = jointAngle(k[11], k[13], k[15]);
  const rKnee = jointAngle(k[12], k[14], k[16]);
  const kneeFlex =
    lKnee != null && rKnee != null ? Math.round((360 - lKnee - rKnee) / 2 * 10) / 10 : null;
  return {
    spine,
    leadArm: leadArmAngle == null ? null : Math.round((180 - leadArmAngle) * 10) / 10,
    shoulderLine,
    hipLine,
    kneeFlex,
  };
}

/** Build a full synthetic JointAngleData sequence for a shot type. */
export function makeDemoSequence(
  shotType: ShotTypeId,
  variant: 'ideal' | 'flawed',
): JointAngleData {
  const params = (variant === 'ideal' ? IDEAL_PARAMS : FLAWED_PARAMS)[shotType];
  const addr: FigureState = { handX: 0.5, handY: 0.58, turn: 0, hipShift: 0 };
  const top: FigureState = { handX: params.topX, handY: params.topY, turn: params.topTurn, hipShift: 0.01 };
  const impact: FigureState = { handX: 0.5, handY: 0.58, turn: 5, hipShift: -0.015 };
  const finish: FigureState = { handX: params.finishX, handY: params.finishY, turn: params.finishTurn, hipShift: -0.02 };

  const still1 = 0.6;
  const followDur = 0.5;
  const still2 = 0.5;
  const total = still1 + params.backDur + params.downDur + followDur + still2;
  const n = Math.round(total * FPS);

  const frames: PoseFrame[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / FPS;
    let s: FigureState;
    if (t < still1) s = addr;
    else if (t < still1 + params.backDur) {
      const u = ease((t - still1) / params.backDur);
      s = {
        handX: lerp(addr.handX, top.handX, u),
        handY: lerp(addr.handY, top.handY, u),
        turn: lerp(addr.turn, top.turn, u),
        hipShift: lerp(addr.hipShift, top.hipShift, u),
      };
    } else if (t < still1 + params.backDur + params.downDur) {
      const u = ease((t - still1 - params.backDur) / params.downDur);
      s = {
        handX: lerp(top.handX, impact.handX, u),
        handY: lerp(top.handY, impact.handY, u),
        turn: lerp(top.turn, impact.turn, u),
        hipShift: lerp(top.hipShift, impact.hipShift, u),
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

  const idxAt = (t: number) => Math.min(n, Math.round(t * FPS));
  const keyframes = {
    address: { index: idxAt(still1 * 0.8), t: Number((still1 * 0.8).toFixed(3)) },
    takeaway: { index: idxAt(still1), t: Number(still1.toFixed(3)) },
    top: { index: idxAt(still1 + params.backDur), t: Number((still1 + params.backDur).toFixed(3)) },
    impact: {
      index: idxAt(still1 + params.backDur + params.downDur),
      t: Number((still1 + params.backDur + params.downDur).toFixed(3)),
    },
    finish: {
      index: idxAt(still1 + params.backDur + params.downDur + followDur),
      t: Number((still1 + params.backDur + params.downDur + followDur).toFixed(3)),
    },
  };

  return {
    model: 'demo',
    fps: FPS,
    duration: total,
    video_aspect: 9 / 16,
    angle_type: 'face_on',
    keypoint_names: KEYPOINT_NAMES,
    skeleton_edges: SKELETON_EDGES,
    target_dir: -1,
    lead_side: 'right',
    tracking_quality: 'high',
    keyframes,
    frames,
    per_frame_angles: frames.map(anglesForFrame),
  };
}

/** Demo fault selection per shot type: [tag, measuredValue] pairs from the library. */
const DEMO_FAULTS: Record<ShotTypeId, Array<[string, number]>> = {
  driving: [
    ['driving-quick-tempo', 2.1],
    ['driving-flat-shoulder-turn', 62],
  ],
  iron: [
    ['iron-hang-back', 3.4],
    ['iron-quick-tempo', 2.1],
  ],
  bunker: [
    ['bunker-quit', 0.58],
    ['bunker-no-hinge', 3.2],
  ],
  chipping: [
    ['chipping-wristy', 31],
    ['chipping-decel', 0.62],
  ],
  putting: [
    ['putting-tempo', 1.4],
    ['putting-jab', 68],
  ],
};

const DEMO_METRIC_VALUES: Record<ShotTypeId, Record<string, number>> = {
  driving: { tempo_ratio: 2.1, shoulder_turn_top: 62, hip_turn_top: 38, head_sway: 7.2, hip_sway: 9.1, spine_tilt_impact: 9.5, spine_tilt_top: -3.2, lead_arm_bend_top: 12, weight_forward_impact: 8.4, chicken_wing: 22, head_dip: 2.1, finish_balance: 14 },
  iron: { tempo_ratio: 2.1, shoulder_turn_top: 74, head_sway: 5.8, hip_sway: 7.4, weight_forward_impact: 3.4, hands_forward_impact: 4.2, spine_tilt_impact: 5.1, spine_tilt_top: -4.5, lead_arm_bend_top: 14, chicken_wing: 25, head_dip: 3.4 },
  bunker: { tempo_ratio: 1.35, stance_width: 1.28, knee_flex_address: 24, knee_flex_loss: 4.5, early_hinge: 3.2, head_sway: 6.1, weight_forward_address: 12, commit_ratio: 0.58, follow_length: 82 },
  chipping: { tempo_ratio: 1.35, stance_width: 0.8, weight_forward_address: 22, weight_forward_impact: 24, hands_forward_impact: 7.5, wrist_quietness: 31, stroke_symmetry: 84, commit_ratio: 0.62, head_sway: 4.2, chest_rotation_finish: 28 },
  putting: { tempo_ratio: 1.4, head_stillness: 3.1, body_sway: 2.4, wrist_quietness: 9, pendulum_arc: 3.2, stroke_symmetry: 68, commit_ratio: 0.9, shoulder_engine: 5.5 },
};

/** Build a complete demo UploadDetail for a shot type. */
export function makeDemoUploadDetail(shotType: ShotTypeId): UploadDetail {
  const def = SHOT_TYPE_LIBRARY[shotType];
  const metrics = DEMO_METRIC_VALUES[shotType];
  const faultDefs = Object.fromEntries(def.faults.map((f) => [f.tag, f]));

  const identified_faults: IdentifiedFault[] = DEMO_FAULTS[shotType]
    .filter(([tag]) => faultDefs[tag])
    .map(([tag, value], i) => {
      const fd = faultDefs[tag];
      const metricDef = def.metrics.find((m) => def.faults.find((f) => f.tag === tag) && m.phase === fd.phase) ?? def.metrics[0];
      return {
        tag,
        name: fd.name,
        phase: fd.phase,
        severity: i === 0 ? 2 : 1,
        metric: metricDef.id,
        metricLabel: metricDef.label,
        value,
        unit: metricDef.unit,
        description: fd.description,
        tip: fd.tip,
        drill: fd.drill,
      };
    });

  const checkpoint_results = def.phases.map((phase) => ({
    phase: phase.id,
    label: phase.label,
    description: phase.description,
    checks: def.metrics
      .filter((m) => m.phase === phase.id && (m.angle === 'any' || m.angle === 'face_on'))
      .map((m) => {
        const value = metrics[m.id] ?? null;
        let status: 'good' | 'warning' | 'fault' | 'unmeasured' = 'unmeasured';
        if (value != null) {
          status = value >= m.benchmark.min && value <= m.benchmark.max ? 'good' : 'fault';
          if (status === 'fault') {
            const span = Math.max(m.benchmark.max - m.benchmark.min, 1e-6);
            const over =
              value > m.benchmark.max
                ? (value - m.benchmark.max) / span
                : (m.benchmark.min - value) / span;
            if (over <= 0.35) status = 'warning';
          }
        }
        return {
          metric: m.id,
          label: m.label,
          unit: m.unit,
          value,
          benchmark: m.benchmark,
          status,
          description: m.description,
        };
      }),
  }));

  const demoVideos: Record<ShotTypeId, { id: string; title: string; creator: string }[]> = {
    driving: [
      { id: 'HrqUYSuz4a8', title: 'The Effortless Driver Swing — Longer Drives With Less Effort', creator: 'Danny Maude' },
      { id: 'V0bMKpKMDwk', title: 'How To Get A Full Shoulder Turn In Your Golf Swing', creator: 'Me and My Golf' },
    ],
    iron: [
      { id: '25ZTIb3fzz0', title: 'Strike Your Irons Pure — Weight Forward Drill', creator: 'Danny Maude' },
      { id: 'kJluj3T0Ntg', title: 'How To Compress Your Irons Like A Tour Pro', creator: 'Me and My Golf' },
    ],
    bunker: [
      { id: 'kO_ZDVsBAhk', title: 'Get Out Of Every Bunker — The Splash Shot Made Simple', creator: 'Dan Grieve' },
      { id: 'YtiCSXA9h1c', title: 'Bunker Basics: Setup And Commitment', creator: 'Danny Maude' },
    ],
    chipping: [
      { id: 'F1zHzcVXVzE', title: 'The Simple Chipping Technique That Works Under Pressure', creator: 'Dan Grieve' },
      { id: 'Cn8HqLPvxfI', title: 'Stop Flicking Your Wrists When Chipping', creator: 'Danny Maude' },
    ],
    putting: [
      { id: 'qp6k5d8FJOA', title: "I get a Lesson from the World's Best Putting Coach (Brad Faxon)", creator: 'Rick Shiels Golf' },
      { id: '_jdL1hCE1To', title: 'The Last Putting Lesson You Will Ever Need', creator: 'Danny Maude' },
    ],
  };

  const recommendations = identified_faults.slice(0, 2).map((fault, i) => {
    const video = demoVideos[shotType][i];
    return {
      fault_tag: fault.tag,
      reason: `Targets ${fault.name.toLowerCase()} directly — a focused ${def.label.toLowerCase()} lesson.`,
      rank: i,
      youtube_video_id: video.id,
      video_title: video.title,
      creator_name: video.creator,
      creator_avatar: null,
    };
  });

  const priority = identified_faults[0];
  return {
    demo: true,
    upload: {
      id: `demo-${shotType}`,
      shot_type: shotType,
      angle_type: 'face_on',
      status: 'complete',
      created_at: new Date().toISOString(),
    },
    analysis: {
      shot_type: shotType,
      tempo_ratio: metrics.tempo_ratio ?? null,
      identified_faults,
      checkpoint_results,
      metrics,
      joint_angle_data: makeDemoSequence(shotType, 'flawed'),
      coaching: {
        summary: `This is a demo ${def.label.toLowerCase()} analysis so you can explore the Academy screens. ${priority ? `The priority flag is ${priority.name.toLowerCase()} — ${priority.tip}` : 'No faults flagged.'} Upload a real swing to replace this with your own numbers.`,
        tips: identified_faults.map((f) => ({ fault_tag: f.tag, tip: f.tip, drill: f.drill })),
        model: 'demo',
        generated_at: new Date().toISOString(),
      },
    },
    recommendations,
  };
}

/** Demo dashboard with plausible multi-session trends for every shot type. */
export function makeDemoDashboard(): DashboardData {
  const now = Date.now();
  const day = 86400000;
  const series = (values: number[]) =>
    values.map((value, i) => ({
      value,
      recordedAt: new Date(now - (values.length - 1 - i) * 4 * day).toISOString(),
      uploadId: null,
    }));

  const shotTypes: DashboardData['shotTypes'] = {
    driving: {
      uploadCount: 4,
      lastUploadAt: new Date(now - day).toISOString(),
      lastUploadId: 'demo-driving',
      focusFaults: [
        { tag: 'driving-quick-tempo', name: 'Rushed transition', count: 3, severity: 2 },
        { tag: 'driving-flat-shoulder-turn', name: 'Incomplete shoulder turn', count: 2, severity: 1 },
      ],
      trends: {
        tempo_ratio: series([1.8, 1.9, 2.0, 2.1]),
        shoulder_turn_top: series([55, 58, 60, 62]),
        head_sway: series([11, 9.5, 8.1, 7.2]),
      },
    },
    iron: {
      uploadCount: 3,
      lastUploadAt: new Date(now - 3 * day).toISOString(),
      lastUploadId: 'demo-iron',
      focusFaults: [{ tag: 'iron-hang-back', name: 'Hanging back', count: 2, severity: 2 }],
      trends: {
        weight_forward_impact: series([1.2, 2.5, 3.4]),
        tempo_ratio: series([1.9, 2.0, 2.1]),
      },
    },
    bunker: {
      uploadCount: 2,
      lastUploadAt: new Date(now - 6 * day).toISOString(),
      lastUploadId: 'demo-bunker',
      focusFaults: [{ tag: 'bunker-quit', name: 'Quitting in the sand', count: 2, severity: 3 }],
      trends: {
        commit_ratio: series([0.52, 0.58]),
        follow_length: series([70, 82]),
      },
    },
    chipping: {
      uploadCount: 3,
      lastUploadAt: new Date(now - 2 * day).toISOString(),
      lastUploadId: 'demo-chipping',
      focusFaults: [{ tag: 'chipping-wristy', name: 'Wristy, flicky strike', count: 3, severity: 2 }],
      trends: {
        wrist_quietness: series([38, 34, 31]),
        hands_forward_impact: series([4.1, 6.2, 7.5]),
      },
    },
    putting: {
      uploadCount: 5,
      lastUploadAt: new Date(now - day).toISOString(),
      lastUploadId: 'demo-putting',
      focusFaults: [{ tag: 'putting-jab', name: 'Jabby / decelerating stroke', count: 3, severity: 2 }],
      trends: {
        tempo_ratio: series([1.2, 1.25, 1.3, 1.35, 1.4]),
        stroke_symmetry: series([55, 58, 62, 65, 68]),
        head_stillness: series([5.2, 4.6, 4.0, 3.4, 3.1]),
      },
    },
  };

  const recentRecommendations: DashboardData['recentRecommendations'] = (
    ['putting', 'driving', 'chipping'] as ShotTypeId[]
  ).flatMap((st) => {
    const detail = makeDemoUploadDetail(st);
    return detail.recommendations.slice(0, 1).map((r) => ({
      faultTag: r.fault_tag,
      reason: r.reason,
      shotType: st,
      youtubeVideoId: r.youtube_video_id,
      videoTitle: r.video_title,
      creatorName: r.creator_name,
      creatorAvatar: r.creator_avatar,
    }));
  });

  return { shotTypes, recentRecommendations, demo: true };
}
