import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { BenchState, UnitId } from '../core';
import { BlockBody } from './Block';
import { THEME, colorsFor } from './palette';
import { pictureOf } from './picture';

const FRAME = 4;
// Felt around the blocks, in cells on each side.
const MARGIN = 0.4;
const MAX_CELL = 40;

// A finished mat to look at, not to play with (the album's cards, 2026-10-15
// review Q): the blocks in their colours with the head faces smiling, on a
// little felt mat in a wooden frame cut to fit them. No gestures, no tray, no
// counting. Measured at 360 × 640 with the CPU slowed 4×: nineteen stages as
// cards (a gesture handler per piece) opened with long tasks of up to 180 ms;
// nineteen of these with none. `apart`: as pictureOf.
export function WorkPicture({ state, width, height, apart, testID }: { readonly state: BenchState; readonly width: number; readonly height: number; readonly apart?: ReadonlyArray<ReadonlyArray<UnitId>>; readonly testID?: string }) {
  const picture = useMemo(() => pictureOf(state, apart), [state, apart]);
  const span = { w: picture.cols + 2 * MARGIN, h: picture.rows + 2 * MARGIN };
  const cell = Math.max(4, Math.min(MAX_CELL, Math.floor((width - 2 * FRAME) / span.w), Math.floor((height - 2 * FRAME) / span.h)));
  const mat = { width: cell * span.w, height: cell * span.h };
  const left = (width - mat.width) / 2;
  const top = (height - mat.height) / 2;
  return (
    <View pointerEvents="none" style={{ width, height }} testID={testID}>
      <View style={[styles.frame, { left: left - FRAME, top: top - FRAME, width: mat.width + 2 * FRAME, height: mat.height + 2 * FRAME }]} />
      <View style={[styles.felt, { left, top, width: mat.width, height: mat.height }]} />
      {picture.blocks.map((b) => (
        <BlockBody
          key={b.unitId as string}
          cell={cell}
          x={left + (b.cell.x - picture.origin.x + MARGIN) * cell}
          y={top + (b.cell.y - picture.origin.y + MARGIN) * cell}
          colors={colorsFor(b.hue)}
          face={b.face}
          mood="happy"
          count={null}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute', backgroundColor: THEME.wood, borderRadius: 14, boxShadow: `0 3px 0 ${THEME.woodDeep}` },
  felt: { position: 'absolute', backgroundColor: THEME.felt, borderRadius: 10 },
});
