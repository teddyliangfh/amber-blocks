import { clusters } from '../core';
import type { BenchState, Cell, UnitId } from '../core';

// Joining up (Phase 20, play review F1): partners that touch, and single
// blocks touching them, show as ONE new number character: the colour of their
// total, one plate under all of it, one face on its head block, one badge with
// the total. Display only, derived from the mat: every unit keeps its identity,
// nothing is saved and the judge never sees it (PRD §4.3). Pulling a piece
// away splits it back at once.

// When a cluster turns into one character. 'success': once the answer is right
// (after the second beat of the solve); 'touch': as soon as pieces touch, right
// or not. Unconfirmed (play review §6 #2); to change it, change this line.
export const MERGE_ON: 'success' | 'touch' = 'success';
// The joining: the seams between the pieces light up for this long, then the
// faces turn to each other and blink for this long, then the colours run into
// one. The number's own move follows. Reduced motion: none of it, the colour
// just changes.
export const MERGE_SEAM_MS = 220;
export const MERGE_BLINK_MS = 220;

// One thing that moves on the mat: a partner (its group id) or a single block (its unit id).
export interface MergePiece {
  readonly id: string;
  readonly units: ReadonlyArray<UnitId>;
}

export interface MergedCluster {
  // The cluster's units, sorted and joined: the same blocks give the same key.
  readonly key: string;
  readonly units: ReadonlyArray<UnitId>;
  readonly cells: ReadonlyArray<Cell>;
  readonly total: number;
  readonly pieces: ReadonlyArray<MergePiece>;
  // The parts it is made of, left (then top) first: each partner, and each
  // group of touching single blocks (5 + 3 + 1, as said aloud).
  readonly parts: ReadonlyArray<number>;
  // Its box on the mat, in cells.
  readonly origin: Cell;
  readonly width: number;
  readonly height: number;
  // The block that wears the one face: the leftmost of the top row.
  readonly head: Cell;
  // Neighbouring cells of two different parts: the seams that light up.
  readonly seams: ReadonlyArray<readonly [Cell, Cell]>;
}

function corner(cells: ReadonlyArray<Cell>): Cell {
  return { x: Math.min(...cells.map((c) => c.x)), y: Math.min(...cells.map((c) => c.y)) };
}

// Every cluster on the mat holding a partner and made of two parts or more.
// `apart`: sets of units that join only among themselves, the rest joining as
// usual (D-097: two ways to make 7 that touch are two 7s, not one 14).
export function mergedClusters(state: BenchState, apart: ReadonlyArray<ReadonlyArray<UnitId>> = []): ReadonlyArray<MergedCluster> {
  if (apart.length > 0) {
    const taken = new Set(apart.flat());
    const only = (units: ReadonlyArray<UnitId>): BenchState => ({ ...state, bench: new Map(units.map((u) => [u, state.bench.get(u)!] as const)) });
    return [...apart, [...state.bench.keys()].filter((u) => !taken.has(u))].flatMap((units) => mergedClusters(only(units)));
  }
  const groupOf = new Map<UnitId, string>();
  for (const g of state.groups.values()) {
    if (g.unitIds.every((u) => state.bench.has(u))) {
      g.unitIds.forEach((u) => groupOf.set(u, g.id));
    }
  }
  const out: MergedCluster[] = [];
  for (const c of clusters(state)) {
    if (!c.unitIds.some((u) => groupOf.has(u))) {
      continue;
    }
    // Parts: the partners, and the single blocks grouped by touching each other.
    const partOf = new Map<UnitId, string>();
    for (const u of c.unitIds) {
      const g = groupOf.get(u);
      if (g !== undefined) {
        partOf.set(u, g);
      }
    }
    const loose = c.unitIds.filter((u) => !groupOf.has(u));
    const looseState = { ...state, bench: new Map(loose.map((u) => [u, state.bench.get(u)!] as const)) };
    for (const sub of clusters(looseState)) {
      sub.unitIds.forEach((u) => partOf.set(u, `loose:${sub.unitIds[0]!}`));
    }
    const partIds = [...new Set(c.unitIds.map((u) => partOf.get(u)!))];
    if (partIds.length < 2) {
      continue;
    }
    const cellOf = (u: UnitId) => state.bench.get(u)!;
    const parts = partIds
      .map((id) => {
        const units = c.unitIds.filter((u) => partOf.get(u) === id);
        return { n: units.length, at: corner(units.map(cellOf)) };
      })
      .sort((a, b) => a.at.x - b.at.x || a.at.y - b.at.y)
      .map((p) => p.n);
    const pieces: MergePiece[] = [];
    for (const u of c.unitIds) {
      const g = groupOf.get(u);
      if (g === undefined) {
        pieces.push({ id: u, units: [u] });
      } else if (!pieces.some((p) => p.id === g)) {
        pieces.push({ id: g, units: state.groups.get(g as never)!.unitIds });
      }
    }
    const cells = c.unitIds.map(cellOf);
    const origin = corner(cells);
    const at = new Map(c.unitIds.map((u) => [`${cellOf(u).x},${cellOf(u).y}`, partOf.get(u)!]));
    const seams: (readonly [Cell, Cell])[] = [];
    for (const cell of cells) {
      for (const next of [{ x: cell.x + 1, y: cell.y }, { x: cell.x, y: cell.y + 1 }]) {
        const other = at.get(`${next.x},${next.y}`);
        if (other !== undefined && other !== at.get(`${cell.x},${cell.y}`)) {
          seams.push([cell, next]);
        }
      }
    }
    const head = cells.reduce((best, x) => (x.y < best.y || (x.y === best.y && x.x < best.x) ? x : best));
    out.push({
      key: [...c.unitIds].sort().join(','),
      units: c.unitIds,
      cells,
      total: c.unitIds.length,
      pieces,
      parts,
      origin,
      width: Math.max(...cells.map((x) => x.x)) - origin.x + 1,
      height: Math.max(...cells.map((x) => x.y)) - origin.y + 1,
      head,
      seams,
    });
  }
  return out;
}
