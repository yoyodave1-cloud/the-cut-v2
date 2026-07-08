import type React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './colors';
import type { ShotTypeId } from '../lib/academy/types';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** Per-shot-type presentation: accent colour + Ionicons name. */
export const SHOT_TYPE_STYLE: Record<ShotTypeId, { accent: string; icon: IoniconName }> = {
  driving: { accent: colors.liveBlue, icon: 'rocket-outline' },
  iron: { accent: colors.midNavy, icon: 'locate-outline' },
  bunker: { accent: colors.eagleAmber, icon: 'layers-outline' },
  chipping: { accent: colors.birdieGreen, icon: 'trending-up-outline' },
  putting: { accent: colors.bogeyRed, icon: 'golf-outline' },
};

export const CHECK_STATUS_COLOR: Record<string, string> = {
  good: colors.birdieGreen,
  warning: colors.eagleAmber,
  fault: colors.bogeyRed,
  unmeasured: colors.mutedGrey,
};

export const SEVERITY_LABEL: Record<number, string> = {
  1: 'Minor',
  2: 'Work on',
  3: 'Priority',
};
