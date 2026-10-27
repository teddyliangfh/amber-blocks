import { SIGNS, apply, cell, createBenchState, defineGroup, groupId, signOf, unitIds } from '../core';
import type { BenchState, Bounds, Cell, Sign, Unit } from '../core';
import { hueFor } from './material';
import { fnv1a, mulberry32, seedOf } from './rng';
import type { PuzzleRef, SignLayout, SignRound, SignRoundSpec, SignSide, SignSideView } from './schema';

// Compare Island (Phase 23d, D-129): two numbers side by side, each with its
// own blocks, and a slot between them for > < =. The blocks are only looked at
// (and counted by tapping); the child answers with a sign. What this file
// knows: how a side is drawn, the order a visit asks the rounds in, and the
// material the finished picture is made of.

// The sign blocks a stop deals when its spec names none.
export const ALL_SIGNS: ReadonlyArray<Sign> = SIGNS;

// The tallest a side may stand (validate): a tower of 10 is the most a phone
// shows at a size a finger can still count (33px a block on a 375 × 812 phone,
// 25 – 26px on 360 × 640 and 667 × 331; the 23d design measured these).
export const SIGN_MAX_ROWS = 10;

export function sideOf(side: SignSide): SignSideView {
  if (typeof side === 'number') {
    return { n: side, layout: 'tower', parts: null, beside: false };
  }
  return { n: side.n, layout: side.layout ?? 'tower', parts: side.parts ?? null, beside: side.beside === true };
}

export function roundOf(spec: SignRoundSpec): SignRound {
  const left = sideOf(spec.left);
  const right = sideOf(spec.right);
  return { left, right, answer: signOf(left.n, right.n) };
}

// A side's blocks, top-left at (0, 0), y down: one piece per partner. A tower
// stands one block wide; a row lies one block high; a square is k × k (4, 9).
// Partners stack into one tower, the first at the bottom (2 + 1: the 2 below,
// the 1 on top), or, `beside`, stand as towers side by side from the left on
// one floor (12 = 6 and 6: two columns, lower than a 10 that stands alone).
// Each partner keeps its own colour.
export interface SideShape {
  readonly cols: number;
  readonly rows: number;
  readonly pieces: ReadonlyArray<{ readonly n: number; readonly cells: ReadonlyArray<Cell> }>;
}

function layoutCells(n: number, layout: SignLayout): ReadonlyArray<Cell> {
  if (layout === 'row') {
    return Array.from({ length: n }, (_, i) => cell(i, 0));
  }
  if (layout === 'square') {
    const k = Math.round(Math.sqrt(n));
    return Array.from({ length: n }, (_, i) => cell(i % k, Math.floor(i / k)));
  }
  return Array.from({ length: n }, (_, i) => cell(0, i));
}

export function sideShape(side: SignSideView): SideShape {
  if (side.parts !== null && side.beside) {
    const rows = Math.max(...side.parts);
    const pieces = side.parts.map((p, x) => ({ n: p, cells: Array.from({ length: p }, (_, i) => cell(x, rows - p + i)) }));
    return { cols: side.parts.length, rows, pieces };
  }
  if (side.parts !== null) {
    let below = 0;
    const pieces = side.parts.map((p) => {
      const top = side.n - below - p;
      below += p;
      return { n: p, cells: Array.from({ length: p }, (_, i) => cell(0, top + i)) };
    });
    return { cols: 1, rows: side.n, pieces };
  }
  const cells = layoutCells(side.n, side.layout);
  return { cols: Math.max(...cells.map((c) => c.x)) + 1, rows: Math.max(...cells.map((c) => c.y)) + 1, pieces: [{ n: side.n, cells }] };
}

// The finished picture's mat: the widest round's two sides with one column
// between them for the sign, as tall as the tallest side (fixed per stop, so
// every visit's picture fits the same mat).
export function signBounds(rounds: ReadonlyArray<SignRoundSpec>): Bounds {
  const sizes = rounds.map(roundOf).map((r) => [sideShape(r.left), sideShape(r.right)] as const);
  return {
    cols: Math.max(...sizes.map(([l, r]) => l.cols + 1 + r.cols)),
    rows: Math.max(...sizes.flatMap(([l, r]) => [l.rows, r.rows])),
  };
}

// "Play again" asks the rounds in another order (PRD §3.2): the first visit
// keeps the catalog's order; later ones shuffle by the ref, never putting the
// same sign three rounds running, and never repeating the order just played
// when another one is allowed.
const MAX_RESHUFFLES = 24;

function threeRunning(answers: ReadonlyArray<Sign>): boolean {
  return answers.some((s, i) => i >= 2 && s === answers[i - 1] && s === answers[i - 2]);
}

export function roundOrder(ref: PuzzleRef, rounds: ReadonlyArray<SignRound>): ReadonlyArray<number> {
  const plain = rounds.map((_, i) => i);
  if (ref.attemptVariant === 0) {
    return plain;
  }
  const previous = roundOrder({ ...ref, attemptVariant: ref.attemptVariant - 1 }, rounds).join();
  const rng = mulberry32(fnv1a(`sign|${seedOf(ref)}`));
  let fallback: ReadonlyArray<number> | null = null;
  for (let tries = 0; tries < MAX_RESHUFFLES; tries += 1) {
    const order = rng.shuffle(plain);
    if (threeRunning(order.map((i) => rounds[i]!.answer))) {
      continue;
    }
    if (order.join() !== previous) {
      return order;
    }
    fallback = fallback ?? order;
  }
  return fallback ?? plain;
}

// The finished picture as material (PRD §7.3): the round's two sides on the
// mat, standing on its bottom row, the left one from column 0 and the right
// one after a free column (where the sign is drawn). Each piece is a partner
// in its own colour; its tray bed stays its home (core invariant 1). Saved as
// the stop's work and album picture when the last round is right.
export function signMaterial(round: SignRound, bounds: Bounds, prefix: string): BenchState {
  const sides = [sideShape(round.left), sideShape(round.right)] as const;
  const pieces = sides.flatMap((s, side) => s.pieces.map((p) => ({ ...p, side, shape: s })));
  const units: Unit[] = [];
  const members = pieces.map((p, i) => {
    const ids = unitIds(`${prefix}-s${i}`, p.n);
    ids.forEach((id) => units.push({ id, hue: hueFor(p.n) }));
    return ids;
  });
  let state = createBenchState({ units, bounds });
  pieces.forEach((p, i) => {
    const top = Math.min(...p.cells.map((c) => c.y));
    const left = Math.min(...p.cells.map((c) => c.x));
    const id = groupId(`${prefix}-s${i}`);
    const defined = defineGroup(state, id, members[i]!, p.cells.map((c) => cell(c.x - left, c.y - top)));
    if (!defined.ok) {
      throw new Error(`content: could not define side piece ${id}: ${defined.reason}`);
    }
    const x = (p.side === 0 ? 0 : sides[0].cols + 1) + left;
    const y = bounds.rows - p.shape.rows + top;
    const placed = apply(defined.value, { type: 'takeGroup', groupId: id, origin: cell(x, y) });
    if (!placed.ok) {
      throw new Error(`content: could not stand side piece ${id} on the mat: ${placed.reason}`);
    }
    state = placed.value;
  });
  return state;
}

// A saved picture read back (album, island page): how many blocks stand left
// and right of the free column, and which column the sign goes in. Null when
// the mat does not split that way (not a Compare Island picture).
export function picturedSides(work: BenchState): { readonly left: number; readonly right: number; readonly gap: number } | null {
  const columns = new Set([...work.bench.values()].map((c) => c.x));
  if (columns.size === 0) {
    return null;
  }
  const last = Math.max(...columns);
  let gap = -1;
  for (let x = 1; x < last; x += 1) {
    if (!columns.has(x)) {
      gap = x;
      break;
    }
  }
  if (gap < 0) {
    return null;
  }
  const xs = [...work.bench.values()].map((c) => c.x);
  if (xs.some((x) => x > gap && x < gap)) {
    return null;
  }
  const left = xs.filter((x) => x < gap).length;
  const right = xs.filter((x) => x > gap).length;
  return left > 0 && right > 0 ? { left, right, gap } : null;
}
