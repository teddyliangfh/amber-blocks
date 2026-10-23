import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { Cell } from '../core';
import { Face } from './Face';
import { useBreathe } from './juice';
import { cellToPx } from './layout';
import type { StageGeometry } from './layout';
import type { BlockColors } from './palette';
import { THEME } from './palette';

// Whether a block let go near the shadow snaps into it (PRD §3.4, §8 #18):
// 0, it does not (a drop lands where it lands; the mat's own snapping only
// picks a free cell nearby when the one under the finger is taken). Half a
// cell (0.5) would pull a drop that close into line with the shadow, a change
// to the drop itself (resolveDrop and its pinned tests) that is not built: a
// default for Ted, to turn on only if children keep missing the shadow (S1).
export const SHADOW_SNAP: 0 = 0;

// The cell a shadow's sleeping face sits on: its first in reading order (the
// top row, then the left), where a picture's head is (the duck's, the dog's).
export function shadowHead(cells: ReadonlyArray<Cell>): Cell {
  return [...cells].sort((a, b) => a.y - b.y || a.x - b.x)[0]!;
}

// A dashed outline of cells on the mat, drawn under the pieces (Phase 23b,
// taken out of the boss's entrance, Phase 21): a sleeping face on its first
// cell, breathing; a cell lights up (`lit`, one flag a cell) when a block is
// on it, and help can make some glow (`glow`: "this bit is missing"). Scenery
// only: it takes no touch, the judge never sees it and nothing snaps to it
// (SHADOW_SNAP). Reduced motion: no breathing; the cells still light.
// `name`: the testID prefix (`boss` keeps the entrance's ids).
export function ShadowOutline({
  geometry,
  cells,
  lit,
  glow = [],
  colors,
  name = 'shadow',
}: {
  readonly geometry: StageGeometry;
  readonly cells: ReadonlyArray<Cell>;
  readonly lit: ReadonlyArray<boolean>;
  readonly glow?: ReadonlyArray<Cell>;
  readonly colors: BlockColors;
  readonly name?: string;
}) {
  const breathe = useBreathe(true, 300);
  const cell = geometry.cell;
  if (cells.length === 0) {
    return null;
  }
  // The outline's own box, so it breathes about its middle.
  const left = Math.min(...cells.map((c) => c.x));
  const top = Math.min(...cells.map((c) => c.y));
  const box = cellToPx(geometry, { x: left, y: top });
  const width = (Math.max(...cells.map((c) => c.x)) - left + 1) * cell;
  const height = (Math.max(...cells.map((c) => c.y)) - top + 1) * cell;
  const inset = Math.max(3, Math.round(cell * 0.08));
  const head = shadowHead(cells);
  const glowing = new Set(glow.map((c) => `${c.x},${c.y}`));
  return (
    <Animated.View pointerEvents="none" style={[styles.box, { left: box.x, top: box.y, width, height }, breathe]} testID={`${name}-outline`}>
      {cells.map((c, i) => {
        const on = lit[i] === true;
        const shine = glowing.has(`${c.x},${c.y}`);
        return (
          <View
            key={`${c.x},${c.y}`}
            testID={shine ? `${name}-cell-glow` : on ? `${name}-cell-lit` : `${name}-cell`}
            style={[
              styles.cell,
              { left: (c.x - left) * cell + inset, top: (c.y - top) * cell + inset, width: cell - 2 * inset, height: cell - 2 * inset, borderRadius: cell * 0.26, borderColor: colors.edge, backgroundColor: on ? colors.pale : 'transparent' },
              shine ? styles.glow : null,
            ]}
          />
        );
      })}
      <View style={[styles.face, { left: (head.x - left) * cell + inset, top: (head.y - top) * cell + inset, width: cell - 2 * inset, height: cell - 2 * inset }]} testID={`${name}-face`}>
        <Face size={cell - 2 * inset} mood="sleepy" blush={colors.pale} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute' },
  cell: { position: 'absolute', borderWidth: 2.5, borderStyle: 'dashed', opacity: 0.85 },
  // "This bit": help's amber, as the spotlight ring.
  glow: { borderWidth: 4, borderStyle: 'solid', borderColor: THEME.amberDeep, backgroundColor: 'rgba(255,184,61,0.22)', opacity: 1 },
  face: { position: 'absolute', opacity: 0.6, alignItems: 'center', justifyContent: 'center' },
});
