import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';

import { ShadowOutline, bossOutlineCells, cellToPx } from '../blocks-ui';
import type { BlockColors, StageGeometry } from '../blocks-ui';
import type { Puzzle } from '../content';
import type { Cell } from '../core';

// Which bosses make an entrance (Phase 24, 2026-10-27 review §4.3; the
// entrance itself, Phase 21). 'all': every boss, each kind its own way;
// 'join-only': as before Phase 24, only Join Island's two (BOSS_ENTRANCE in
// the content) and no opening for the rest. A default for Ted; not in the
// content, so no CONTENT_VERSION bump.
export const BOSS_OPENING: 'all' | 'join-only' = 'all';

// How a boss comes in:
// 'outline': the answer's shape, big and dashed with a sleeping face, in the
//   middle of the mat for a moment, then shrinking away towards the cloud's
//   little picture (the shape and handle bosses: 3 corner, 8 brick, 17, the
//   boat, the rocket). An entrance only: nothing stays on the mat to fill.
// 'entrance': Join Island's dashed row, lit as blocks go on (as before).
// 'slide': the row already on the mat slides in from the side (Take-away
//   Island's split and countdown).
// 'sign': Compare Island's two numbers slide in as they always did; the
//   boss's star pops (SignPlay).
export type BossOpeningKind = 'outline' | 'entrance' | 'slide' | 'sign';

export function bossOpeningOf(puzzle: Puzzle, { boss, entrance }: { readonly boss: boolean; readonly entrance: boolean }): BossOpeningKind | null {
  if (!boss) {
    return null;
  }
  if (entrance) {
    return 'entrance';
  }
  if (BOSS_OPENING === 'join-only') {
    return null;
  }
  if (puzzle.sign !== undefined) {
    return 'sign';
  }
  // Take-away Island's bosses (a split, a countdown) start with their row on the mat.
  return puzzle.takeAway !== undefined || puzzle.question.kind === 'split' ? 'slide' : 'outline';
}

// The opening's beats, ms: the outline holds in the middle, then shrinks away;
// the boss's star pops this long after the cloud comes in. Reduced motion:
// the outline is simply there for STILL_MS, then gone.
export const OPENING_HOLD_MS = 650;
export const OPENING_SHRINK_MS = 500;
export const OPENING_MS = OPENING_HOLD_MS + OPENING_SHRINK_MS;
export const OPENING_STILL_MS = 1000;
export const STAR_POP_AT_MS = 300;

// The answer's cells, as the entrance draws them: a picture's own cells in the
// middle of the mat; a plain number as the boss row (one row across the middle,
// wrapping if too long).
export function openingCells(geometry: StageGeometry, n: number, template: ReadonlyArray<Cell> | null): ReadonlyArray<Cell> {
  if (template === null || template.length === 0) {
    return bossOutlineCells(geometry.bench, n);
  }
  const w = Math.max(...template.map((c) => c.x)) + 1;
  const h = Math.max(...template.map((c) => c.y)) + 1;
  const dx = Math.max(0, Math.floor((geometry.bench.cols - w) / 2));
  const dy = Math.max(0, Math.floor((geometry.bench.rows - h) / 2));
  return template.map((c) => ({ x: c.x + dx, y: c.y + dy }));
}

// The boss's entrance on the mat: the outline, held, then shrinking away
// towards `towards` (the cloud, in stage px). Scenery: no touch.
export function BossOpening({ geometry, cells, colors, towards }: { readonly geometry: StageGeometry; readonly cells: ReadonlyArray<Cell>; readonly colors: BlockColors; readonly towards: { readonly x: number; readonly y: number } }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  const fade = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      fade.set(withDelay(OPENING_STILL_MS, withTiming(0, { duration: 0 })));
      return;
    }
    p.set(withSequence(withTiming(0, { duration: OPENING_HOLD_MS }), withTiming(1, { duration: OPENING_SHRINK_MS, easing: Easing.in(Easing.quad) })));
    fade.set(withSequence(withTiming(1, { duration: OPENING_HOLD_MS + OPENING_SHRINK_MS * 0.6 }), withTiming(0, { duration: OPENING_SHRINK_MS * 0.4 })));
  }, [p, fade, reduced]);
  const left = Math.min(...cells.map((c) => c.x));
  const top = Math.min(...cells.map((c) => c.y));
  const box = cellToPx(geometry, { x: left, y: top });
  const cx = box.x + ((Math.max(...cells.map((c) => c.x)) - left + 1) * geometry.cell) / 2;
  const cy = box.y + ((Math.max(...cells.map((c) => c.y)) - top + 1) * geometry.cell) / 2;
  const dx = towards.x - cx;
  const dy = towards.y - cy;
  const style = useAnimatedStyle(() => {
    const t = p.get();
    return {
      opacity: fade.get(),
      transform: [{ translateX: dx * t }, { translateY: dy * t }, { translateX: cx }, { translateY: cy }, { scale: 1 - 0.75 * t }, { translateX: -cx }, { translateY: -cy }],
    };
  });
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]} testID="boss-opening">
      <ShadowOutline geometry={geometry} cells={cells} lit={cells.map(() => false)} colors={colors} name="opening" />
    </Animated.View>
  );
}
