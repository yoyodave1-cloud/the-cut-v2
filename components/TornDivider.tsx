import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { colors } from '../constants/colors';

/**
 * Polygon point-sets ported 1:1 from homepage_mockup.html (viewBox 0 0 390 34).
 * Index matches seam order: 0 = after intro, 1 = after PGA Tour, …
 */
export const TORN_DIVIDER_VARIANTS = [
  '0,34 0,10 14,16 29,6 45,18 61,4 78,15 94,8 111,19 128,5 145,14 162,9 179,20 196,6 213,16 230,8 247,19 264,5 281,15 298,9 315,18 332,6 349,16 366,8 390,14 390,34',
  '0,34 0,12 16,22 33,7 50,17 67,5 84,20 101,9 118,16 135,4 152,19 169,8 186,15 203,6 220,21 237,9 254,14 271,5 288,18 305,8 322,16 339,6 356,19 373,9 390,15 390,34',
  '0,34 0,9 17,19 34,6 51,16 68,4 85,18 102,8 119,15 136,5 153,20 170,9 187,14 204,6 221,17 238,8 255,16 272,5 289,19 306,9 323,15 340,6 357,18 374,8 390,14 390,34',
  '0,34 0,11 15,21 32,7 49,17 66,5 83,19 100,8 117,16 134,4 151,20 168,9 185,15 202,6 219,18 236,8 253,16 270,5 287,19 304,9 321,15 338,6 355,17 372,8 390,15 390,34',
  '0,34 0,10 14,20 31,6 48,16 65,4 82,18 99,8 116,15 133,5 150,19 167,9 184,14 201,6 218,17 235,8 252,16 269,5 286,19 303,9 320,15 337,6 354,18 371,8 390,14 390,34',
  '0,34 0,13 16,23 33,8 50,18 67,6 84,21 101,10 118,17 135,5 152,20 169,9 186,16 203,7 220,22 237,10 254,15 271,6 288,19 305,9 322,17 339,7 356,20 373,10 390,16 390,34',
  '0,34 0,11 15,19 30,7 47,17 64,5 81,18 98,8 115,16 132,5 149,19 166,9 183,15 200,6 217,17 234,8 251,16 268,5 285,19 302,9 319,15 336,6 353,18 370,8 390,14 390,34',
  '0,34 0,10 14,18 29,6 46,16 63,4 80,19 97,9 114,15 131,4 148,20 165,10 182,14 199,5 216,18 233,8 250,16 267,5 284,19 301,9 318,15 335,6 352,18 369,8 390,15 390,34',
] as const;

const DEFAULT_HEIGHT = 34;
const VIEWBOX_HEIGHT = 34;
/** Extra px painted into the following section so a hairline of page bg cannot show at the join. */
const SEAM_OVERLAP = 1;

const TORN_FILLS = {
  light: colors.bg,
  dark: colors.navy,
} as const;

type TornDividerProps = {
  scheme: 'light' | 'dark';
  variant?: number;
  height?: number;
};

export default function TornDivider({
  scheme,
  variant = 0,
  height = DEFAULT_HEIGHT,
}: TornDividerProps) {
  const fill = TORN_FILLS[scheme];
  const points =
    TORN_DIVIDER_VARIANTS[
      ((variant % TORN_DIVIDER_VARIANTS.length) + TORN_DIVIDER_VARIANTS.length) %
        TORN_DIVIDER_VARIANTS.length
    ];
  const overlappedPoints = points.replace(
    /,34(?=\s|$)/g,
    `,${VIEWBOX_HEIGHT + SEAM_OVERLAP}`,
  );

  return (
    <View pointerEvents="none" style={[styles.wrap, { height, marginTop: -height }]}>
      <Svg
        width="100%"
        height={height + SEAM_OVERLAP}
        viewBox={`0 0 390 ${VIEWBOX_HEIGHT + SEAM_OVERLAP}`}
        preserveAspectRatio="none"
      >
        <Polygon points={overlappedPoints} fill={fill} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    zIndex: 1,
    overflow: 'visible',
  },
});
