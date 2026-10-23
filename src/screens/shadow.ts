import type { BenchState, Bounds, Cell, ShapeTemplate } from '../core';

// A Shape Island picture's shadow on the mat (Phase 23b, PRD §4.2.3): where it
// lies and which of its cells are filled. Pure: the level session keeps the
// shadow's place (ShadowState) and moves it by these rules; the screen draws
// it (blocks-ui ShadowOutline). Scenery only: the judge never sees it, so a
// picture built anywhere else is just as right.

// Which cells light up (PRD §4.2.3, §8 #19): 'covered', every cell a block is
// on, a decoy too ("covered", not "right"); 'solution', only cells under a
// single block or a partner the reference answer uses (closer to Building
// Blocks' "a piece that does not fit fades"). A default for Ted.
export const SHADOW_LIT: 'covered' | 'solution' = 'covered';

export interface ShadowState {
  // Where the picture's top-left corner (as written) lies on the mat.
  readonly origin: Cell;
  // Drawn now: from the start, or once help has brought it (ShadowSpec).
  readonly shown: boolean;
}

const key = (c: Cell): string => `${c.x},${c.y}`;
const readingOrder = (a: Cell, b: Cell): number => a.y - b.y || a.x - b.x;

// The picture's cells, as written, with its corner at `origin`.
export function shadowCells(template: ShapeTemplate, origin: Cell): ReadonlyArray<Cell> {
  return template.cells.map((c) => ({ x: c.x + origin.x, y: c.y + origin.y }));
}

function inside(bounds: Bounds, cells: ReadonlyArray<Cell>): boolean {
  return cells.every((c) => c.x >= 0 && c.y >= 0 && c.x < bounds.cols && c.y < bounds.rows);
}

// Where a shadow first lies: in the middle of the mat (rounded up and left).
export function centred(bounds: Bounds, template: ShapeTemplate): Cell {
  const w = Math.max(...template.cells.map((c) => c.x)) + 1;
  const h = Math.max(...template.cells.map((c) => c.y)) + 1;
  return { x: Math.max(0, Math.floor((bounds.cols - w) / 2)), y: Math.max(0, Math.floor((bounds.rows - h) / 2)) };
}

// The first piece goes down outside the shadow (PRD §3.4, §4.2.3): the shadow
// moves to take it in, if it still fits on the mat there. Of the places where
// the piece lies wholly inside the shadow, the one that puts the piece's first
// cell on the shadow's earliest (top-left first; a lone block on the head
// cell, as the PRD has it); with none, the piece's first cell on the shadow's
// first. A piece already inside, or a shadow that would leave the mat, stays.
export function follow(bounds: Bounds, template: ShapeTemplate, origin: Cell, piece: ReadonlyArray<Cell>): Cell {
  if (piece.length === 0) {
    return origin;
  }
  const here = new Set(shadowCells(template, origin).map(key));
  if (piece.every((c) => here.has(key(c)))) {
    return origin;
  }
  const head = [...piece].sort(readingOrder)[0]!;
  const written = [...template.cells].sort(readingOrder);
  const fits = (at: Cell) => inside(bounds, shadowCells(template, at));
  const covers = (at: Cell) => {
    const cells = new Set(shadowCells(template, at).map(key));
    return piece.every((c) => cells.has(key(c)));
  };
  const candidates = written.map((t) => ({ x: head.x - t.x, y: head.y - t.y }));
  return candidates.find((at) => fits(at) && covers(at)) ?? [candidates[0]!].find(fits) ?? origin;
}

// The next picture of a stop in steps (n6: the corner, then the boat) lies
// with its corner on the top-left of what was built, not in the middle again.
export function cornerOf(state: BenchState): Cell | null {
  const cells = [...state.bench.values()];
  return cells.length === 0 ? null : { x: Math.min(...cells.map((c) => c.x)), y: Math.min(...cells.map((c) => c.y)) };
}

// Which of `cells` a block is on (`by`: whether that block counts, SHADOW_LIT).
export function litCells(cells: ReadonlyArray<Cell>, state: BenchState, by: (unitId: string) => boolean = () => true): ReadonlyArray<boolean> {
  const at = new Map([...state.bench.entries()].map(([u, c]) => [key(c), u as string]));
  return cells.map((c) => {
    const u = at.get(key(c));
    return u !== undefined && by(u);
  });
}

// Something to put into the shadow: a partner (its id and its shape, offsets
// from its top-left) or a single block (one cell).
export interface Piece {
  readonly id: string;
  readonly shape: ReadonlyArray<Cell>;
}

export interface Placement {
  readonly id: string;
  // The piece's top-left corner on the mat (a partner's origin; a block's cell).
  readonly origin: Cell;
  readonly cells: ReadonlyArray<Cell>;
}

function at(piece: Piece, origin: Cell): ReadonlyArray<Cell> {
  return piece.shape.map((c) => ({ x: c.x + origin.x, y: c.y + origin.y }));
}

function cornerFor(head: Cell, onto: Cell): Cell {
  return { x: onto.x - head.x, y: onto.y - head.y };
}

// Fill `gap` exactly with some of `pieces`, each put down whole and never
// turned: from the gap's first cell (top-left first), a partner whose first
// block fits there and whose body stays in the gap (bigger ones first), else a
// single block. The placements in order, or null when they cannot fill it.
// `first`: a piece that must be one of them, tried before anything else.
export function fill(gap: ReadonlyArray<Cell>, pieces: ReadonlyArray<Piece>, first?: Piece): ReadonlyArray<Placement> | null {
  const free = new Set(gap.map(key));
  const order = [...gap].sort(readingOrder);
  const sorted = [...pieces].sort((a, b) => b.shape.length - a.shape.length);
  const place = (left: ReadonlyArray<Piece>, taken: ReadonlySet<string>): ReadonlyArray<Placement> | null => {
    const next = order.find((c) => !taken.has(key(c)));
    if (next === undefined) {
      return [];
    }
    // (Pieces of the same shape are tried once: two spare blocks are the same move.)
    const tried = new Set<string>();
    for (const p of left) {
      const shape = p.shape.map(key).join(' ');
      if (tried.has(shape)) {
        continue;
      }
      tried.add(shape);
      const head = [...p.shape].sort(readingOrder)[0]!;
      const origin = cornerFor(head, next);
      const mine = at(p, origin);
      if (mine.every((c) => free.has(key(c)) && !taken.has(key(c)))) {
        const rest = place(
          left.filter((x) => x !== p),
          new Set([...taken, ...mine.map(key)]),
        );
        if (rest !== null) {
          return [{ id: p.id, origin, cells: mine }, ...rest];
        }
      }
    }
    return null;
  };
  if (first === undefined) {
    return place(sorted, new Set());
  }
  // The piece that must go in: every place for it in the gap, then the rest.
  for (const onto of order) {
    for (const head of first.shape) {
      const origin = cornerFor(head, onto);
      const mine = at(first, origin);
      if (mine.every((c) => free.has(key(c)))) {
        const rest = place(sorted, new Set(mine.map(key)));
        if (rest !== null) {
          return [{ id: first.id, origin, cells: mine }, ...rest];
        }
      }
    }
  }
  return null;
}
