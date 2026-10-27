import { Platform } from 'react-native';

import type { Hue } from '../core';

export interface BlockColors {
  readonly fill: string;
  readonly edge: string;
  readonly text: string;
  // A darker shade that carries white text (≥ 4.5:1): partner labels.
  readonly deep: string;
  // Cheeks: pink, or a white glow on the red and pink blocks where pink would vanish.
  readonly blush: string;
  // The colour washed out towards white: a stop still asleep on the map.
  readonly pale: string;
}

const PINK_CHEEK = 'rgba(255,126,149,0.5)';
const WHITE_CHEEK = 'rgba(255,255,255,0.42)';

// Vivid, distinct theme colours per number, dark text on the light ones. The
// faces and outlines are original; only the "one number, one colour" idea is borrowed.
const PALETTE: Readonly<Record<string, BlockColors>> = {
  n1: { fill: '#F0533B', edge: '#B63724', text: '#FFFFFF', deep: '#B63724', blush: WHITE_CHEEK, pale: '#F9BAB1' },
  n2: { fill: '#F7923A', edge: '#C26A1C', text: '#2B1A08', deep: '#A9561A', blush: PINK_CHEEK, pale: '#FCD3B0' },
  // 3's yellow cannot stand out from the cream felt (1.37:1) without becoming
  // another colour; its outline carries it instead (2026-10-16 review F-2: was
  // #C7A215, 2.27:1 on the felt; now 3.72 on the felt, 3.15 on the sand).
  n3: { fill: '#F9D23C', edge: '#9C7B08', text: '#3A2E05', deep: '#866B0F', blush: PINK_CHEEK, pale: '#FDEDB1' },
  n4: { fill: '#52C462', edge: '#2F8F3D', text: '#0F2E14', deep: '#2A7D36', blush: PINK_CHEEK, pale: '#BAE7C0' },
  n5: { fill: '#3FA8E8', edge: '#1F6FA8', text: '#FFFFFF', deep: '#1F6FA8', blush: PINK_CHEEK, pale: '#B2DCF6' },
  n6: { fill: '#8B6BE0', edge: '#5B3FAE', text: '#FFFFFF', deep: '#5B3FAE', blush: PINK_CHEEK, pale: '#D1C4F3' },
  n7: { fill: '#F06BAE', edge: '#B8407E', text: '#FFFFFF', deep: '#A8396F', blush: WHITE_CHEEK, pale: '#F9C4DF' },
  n8: { fill: '#45C6C0', edge: '#1F8C87', text: '#0B2E2C', deep: '#1B7A75', blush: PINK_CHEEK, pale: '#B5E8E6' },
  // 9 and 10 were the only colourless blocks (2026-10-15 review): a grey that
  // made the longest stop the dullest, and a near-white that vanished on the
  // felt (1.05:1). Measured (palette.test.ts): both fills ≥ 1.5:1 on the felt
  // and the sand, edges ≥ 3:1 on the felt, ≥ 15° of OKLCH hue from every
  // neighbour. 9 is a periwinkle (H 266), 10 a lilac (H 322); no white can
  // reach 1.5:1 on the felt, so "10 is white" gave way to being seen (D-039).
  n9: { fill: '#789BEF', edge: '#4560A2', text: '#FFFFFF', deep: '#3C5592', blush: PINK_CHEEK, pale: '#CBD9F8' },
  n10: { fill: '#D18EDB', edge: '#86528E', text: '#2E1631', deep: '#794880', blush: WHITE_CHEEK, pale: '#E8D0EB' },
};

// One rounded family for every word on screen. Fredoka carries the digits and
// Latin letters (loaded in the root layout); Chinese falls through to PingFang
// on Apple and the system CJK font elsewhere. React Native Web's Text sets its
// own font, so the CSS on <body> never reached it: each Text names this.
const STACK = 'ui-rounded, "SF Pro Rounded", "PingFang SC", "Noto Sans SC", system-ui, sans-serif';
export const FONT = {
  display: Platform.select({ web: `Fredoka_700Bold, ${STACK}`, default: 'Fredoka_700Bold' }),
  body: Platform.select({ web: `Fredoka_600SemiBold, ${STACK}`, default: 'Fredoka_600SemiBold' }),
} as const;

export function colorsFor(hue: Hue): BlockColors {
  return PALETTE[hue] ?? PALETTE['n10']!;
}

// The island: sky above, sand underfoot, amber for the one thing to press.
// Blocks are the only other saturated things on screen.
export const THEME = {
  sky: '#CFE9F7',
  skyDeep: '#A9D5EE',
  sand: '#F4E3B7',
  sandDeep: '#E3C98B',
  board: '#FFFBF2',
  grid: '#E9DCBD',
  amber: '#FFB83D',
  amberDeep: '#C97F00',
  ink: '#2B3645',
  inkSoft: '#5F6D7E',
  leaf: '#9CD67A',
  leafDeep: '#4F9A3A',
  white: '#FFFFFF',
  // The snap ghost: neutral, neither a block's colour nor "right" (2026-10-16
  // review F-1a: it was a green between 4's block and the success green, so
  // on the 3 stop a 4th block lifted read as "right" while it was one too many).
  preview: '#5F6D7E',
  previewFill: 'rgba(43,54,69,0.10)',
  lock: '#D9D2C2',
  lockText: '#8E8676',
  // Faces: one warm ink that reads on every block colour (3.6–12:1).
  faceInk: '#3A2620',
  // Toy materials: a felt mat on a wooden frame, a sandbox, the sea around the island.
  felt: '#FFF6E4',
  stitch: '#EBD3A6',
  wood: '#EBC287',
  woodDeep: '#C9944F',
  sandSpeck: '#EAD29C',
  shoal: '#E6F6FB',
  trunk: '#B9824E',
  palm: '#6CC25A',
  palmDeep: '#4E9E3F',
  shell: '#F7B6A8',
  cloud: '#FFFFFF',
} as const;

// Compare Island's sign blocks (Phase 23d, design: measured there). The body is
// the island's "press this" amber (OKLCH hue 77°: 17° from 3's yellow and 19°
// from 2's orange, so never read as a number); the edge a shade darker than
// amberDeep, which was 2.5:1 on the sand tray (now 3.6:1 on the sand, 3.6 on
// the sky, 4.3 on the felt). White on amber is 1.7:1, so the sign is white with
// a dark amber outline (4.6:1 on the body, 8.0:1 around the white).
export const SIGN_COLORS = {
  fill: THEME.amber,
  edge: '#A66800',
  glyph: THEME.white,
  outline: '#7A4300',
  cheek: 'rgba(255,126,149,0.55)',
} as const;

export const STAGE_COLORS = {
  background: THEME.sky,
  benchFill: THEME.board,
  benchLine: THEME.grid,
  trayFill: THEME.sand,
  trayLine: THEME.sandDeep,
  preview: THEME.preview,
  text: THEME.ink,
  textSoft: THEME.inkSoft,
  accent: THEME.amber,
} as const;
