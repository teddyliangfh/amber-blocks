import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Bounds, Cell } from '../core';
import { Face } from './Face';
import { useBreathe } from './juice';
import { cellToPx } from './layout';
import type { StageGeometry } from './layout';
import type { BlockColors } from './palette';

// Where a boss's outline lies (Phase 21, play review F2): `n` cells in one row
// across the middle of the mat, wrapping onto more rows only if it is too long.
export function bossOutlineCells(bounds: Bounds, n: number): ReadonlyArray<Cell> {
  const width = Math.min(n, bounds.cols);
  const rows = Math.ceil(n / width);
  const x0 = Math.floor((bounds.cols - width) / 2);
  const y0 = Math.max(0, Math.floor((bounds.rows - rows) / 2));
  return Array.from({ length: n }, (_, i) => ({ x: x0 + (i % width), y: y0 + Math.floor(i / width) }));
}

// A boss's entrance: the answer's size as a dashed outline with a sleeping
// face on its first cell, breathing; the first `lit` cells light up, left to
// right, as blocks go onto the mat. Scenery only: it is drawn under the
// pieces, takes no touch, the judge never sees it and nothing snaps to it.
// Reduced motion: no breathing; the cells still light.
export function BossOutline({ geometry, n, lit, colors }: { readonly geometry: StageGeometry; readonly n: number; readonly lit: number; readonly colors: BlockColors }) {
  const breathe = useBreathe(true, 300);
  const cell = geometry.cell;
  const cells = bossOutlineCells(geometry.bench, n);
  // The outline's own box, so it breathes about its middle.
  const box = cellToPx(geometry, cells[0]!);
  const width = (Math.max(...cells.map((c) => c.x)) - cells[0]!.x + 1) * cell;
  const height = (Math.max(...cells.map((c) => c.y)) - cells[0]!.y + 1) * cell;
  const inset = Math.max(3, Math.round(cell * 0.08));
  return (
    <Animated.View pointerEvents="none" style={[styles.box, { left: box.x, top: box.y, width, height }, breathe]} testID="boss-outline">
      {cells.map((c, i) => {
        const on = i < lit;
        return (
          <View
            key={`${c.x},${c.y}`}
            testID={on ? 'boss-cell-lit' : 'boss-cell'}
            style={[styles.cell, { left: (c.x - cells[0]!.x) * cell + inset, top: (c.y - cells[0]!.y) * cell + inset, width: cell - 2 * inset, height: cell - 2 * inset, borderRadius: cell * 0.26, borderColor: colors.edge, backgroundColor: on ? colors.pale : 'transparent' }]}
          />
        );
      })}
      <View style={[styles.face, { left: inset, top: inset, width: cell - 2 * inset, height: cell - 2 * inset }]} testID="boss-face">
        <Face size={cell - 2 * inset} mood="sleepy" blush={colors.pale} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute' },
  cell: { position: 'absolute', borderWidth: 2.5, borderStyle: 'dashed', opacity: 0.85 },
  face: { position: 'absolute', opacity: 0.6, alignItems: 'center', justifyContent: 'center' },
});
