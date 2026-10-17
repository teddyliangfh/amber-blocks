import { clusters, groupSize } from '../core';
import type { BenchState, Cell, Hue, UnitId } from '../core';
import { hueFor } from '../content';

export interface PicturedBlock {
  readonly unitId: UnitId;
  readonly cell: Cell;
  readonly hue: Hue;
  // The head of its partner or cluster wears the face.
  readonly face: boolean;
}

export interface Picture {
  readonly blocks: ReadonlyArray<PicturedBlock>;
  // The box the blocks fill, in mat cells.
  readonly origin: Cell;
  readonly cols: number;
  readonly rows: number;
}

function isHead(cell: Cell, cells: ReadonlyArray<Cell>): boolean {
  return cells.every((c) => c.y > cell.y || (c.y === cell.y && c.x >= cell.x));
}

// What a finished mat looks like, coloured the way the stage colours it: a
// partner in its own number's colour, loose blocks in the colour of the
// cluster they make (AC-37), one face per partner or cluster on its top-left
// block. Pure, so the album can draw a mat without the stage's gestures.
export function pictureOf(state: BenchState): Picture {
  const grouped = new Map<UnitId, { readonly hue: Hue; readonly cells: ReadonlyArray<Cell> }>();
  for (const g of state.groups.values()) {
    if (g.unitIds.every((u) => state.bench.has(u))) {
      const entry = { hue: hueFor(groupSize(g)), cells: g.unitIds.map((u) => state.bench.get(u) as Cell) };
      g.unitIds.forEach((u) => grouped.set(u, entry));
    }
  }
  const loose = new Map<UnitId, { readonly hue: Hue; readonly cells: ReadonlyArray<Cell> }>();
  for (const c of clusters(state)) {
    const units = c.unitIds.filter((u) => !grouped.has(u));
    const entry = { hue: hueFor(units.length), cells: units.map((u) => state.bench.get(u) as Cell) };
    units.forEach((u) => loose.set(u, entry));
  }
  const blocks = [...state.bench].map(([unitId, cell]) => {
    const owner = (grouped.get(unitId) ?? loose.get(unitId)) as { readonly hue: Hue; readonly cells: ReadonlyArray<Cell> };
    return { unitId, cell, hue: owner.hue, face: isHead(cell, owner.cells) };
  });
  const xs = blocks.map((b) => b.cell.x);
  const ys = blocks.map((b) => b.cell.y);
  if (blocks.length === 0) {
    return { blocks, origin: { x: 0, y: 0 }, cols: 0, rows: 0 };
  }
  const origin = { x: Math.min(...xs), y: Math.min(...ys) };
  return { blocks, origin, cols: Math.max(...xs) - origin.x + 1, rows: Math.max(...ys) - origin.y + 1 };
}
