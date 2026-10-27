import { DEFAULT_SYMMETRY, groupSize, variants } from '../core';
import type { BenchState, Bounds, Cell } from '../core';
import { partnerSizesFor } from './distractors';
import type { Chapter, NodeSpec, QuestionSpec } from './schema';
import { signBounds } from './sign';

// How big the mat is, worked out from what a stop deals (2026-10-15 review: a
// fixed 6 × 5 gave "make 1" thirty empty cells, and the 8 × 6 that 3 + 4 needs
// made 1 + 1 the smallest blocks on the map). The bench is just big enough for
// the largest thing the stop asks for, plus a spare row and column, and never
// too small to hold every piece at once: putting everything out is how a child
// finds "too many", so it must never bounce.

// The spare row and column around the biggest thing a stop asks for.
export const BENCH_MARGIN = 1;
// Even "make 1" gets a mat, not a slot.
export const MIN_BENCH: Bounds = { cols: 3, rows: 3 };

interface Box {
  readonly w: number;
  readonly h: number;
}

// A number laid out the way its partner is drawn: rows of five, top row first.
// For 1–10 this is exactly bodyOf(n)'s box.
export function numberBox(n: number): Box {
  return { w: Math.min(n, 5), h: Math.ceil(n / 5) };
}

function boxOf(cells: ReadonlyArray<Cell>): Box {
  return { w: Math.max(...cells.map((c) => c.x)) + 1, h: Math.max(...cells.map((c) => c.y)) + 1 };
}

// Two partners joined side by side, as the sum reads: a then b.
function sideBySide(a: number, b: number): Box {
  return { w: numberBox(a).w + numberBox(b).w, h: Math.max(numberBox(a).h, numberBox(b).h) };
}

interface Need {
  // What the stop asks the child to build, in any form the judge accepts that
  // the mat should leave room for.
  readonly shapes: ReadonlyArray<Box>;
  // Every partner dealt (by size) and how many single blocks come with them.
  readonly partners: ReadonlyArray<number>;
  readonly loose: number;
  // What the stop deals onto the mat itself, which must lie on it as it is,
  // with no spare row or column (Phase 21: the row to send the extra back from).
  readonly dealt?: Box;
}

function needOf(spec: QuestionSpec): Need {
  switch (spec.kind) {
    case 'quantity': {
      const target = Math.max(...spec.targets);
      if (spec.handles === undefined) {
        return { shapes: [numberBox(target)], partners: [], loose: target + spec.extra };
      }
      const partners = [...spec.handles, ...(spec.decoys ?? [])];
      // Singles: whatever the handles leave of the target, and the spares.
      return { shapes: [numberBox(target), ...partners.map(numberBox)], partners, loose: target - spec.handles.reduce((a, b) => a + b, 0) + spec.extra };
    }
    case 'quantity_shape': {
      const symmetry = spec.symmetry ?? DEFAULT_SYMMETRY;
      const shapes = spec.templates.flatMap((t) => variants(t, symmetry).map(boxOf));
      // The plain row is always within reach, so "right count, now the shape" can happen.
      if (spec.handles !== undefined) {
        const partners = [...spec.handles, ...(spec.decoys ?? [])];
        return { shapes: [numberBox(spec.target), ...shapes, ...partners.map(numberBox)], partners, loose: spec.extra };
      }
      return { shapes: [numberBox(spec.target), ...shapes], partners: [], loose: spec.target + spec.extra };
    }
    case 'addition_exact': {
      // A pool of pairs deals one tray per pair; leave room for the heaviest.
      const deals = spec.pairs.map((operands) => partnerSizesFor({ kind: 'addition_exact', operands }, spec.distractors));
      const partners = deals.reduce((best, d) => (sum(d) > sum(best) ? d : best), []);
      return { shapes: [...spec.pairs.map(([a, b]) => sideBySide(a, b)), ...deals.flat().map(numberBox)], partners, loose: 0 };
    }
    case 'sum_composition': {
      // A given partner (Phase 19) is one of the allowed pair's sizes, so it is
      // counted here like every partner the tray deals. Partners on the mat to
      // send back (Phase 21) are the allowed pair and the extras, in a row.
      const shapes = spec.allowed.map(([a, b]) => sideBySide(a, b));
      if (spec.onMat !== undefined) {
        const partners = [...spec.onMat, ...spec.distractors];
        const dealt = { w: spec.onMat.reduce((w, n) => w + numberBox(n).w, 0), h: Math.max(...spec.onMat.map((n) => numberBox(n).h)) };
        return { shapes: [...shapes, ...partners.map(numberBox)], partners, loose: 0, dealt };
      }
      const partners = partnerSizesFor({ kind: 'sum_composition', sum: spec.sum, allowed: spec.allowed }, spec.distractors);
      return { shapes: [...shapes, ...partners.map(numberBox)], partners, loose: 0 };
    }
    // Take-away Island (Phase 22): the row the stop opens with, with the spare
    // row and column around it (a block pulled away, or sent home, needs
    // somewhere to be); a row of partners the same.
    case 'split':
      return { shapes: [numberBox(spec.total)], partners: [], loose: spec.total };
    // Compare Island (Phase 23d) has its own mat (fitBench); never asked here.
    case 'sign':
      return { shapes: [], partners: [], loose: 0 };
    case 'take_away': {
      if (spec.onMat === undefined) {
        return { shapes: [numberBox(spec.start)], partners: [], loose: spec.start };
      }
      const row = { w: spec.onMat.reduce((w, n) => w + numberBox(n).w, 0), h: Math.max(...spec.onMat.map((n) => numberBox(n).h)) };
      return { shapes: [row, ...spec.onMat.map(numberBox)], partners: spec.onMat, loose: 0 };
    }
  }
}

function sum(sizes: ReadonlyArray<number>): number {
  return sizes.reduce((a, b) => a + b, 0);
}

// Can every piece sit on the mat at once? Partners go on shelves, tallest
// first, as their bounding boxes; single blocks then take any free cell, holes
// in a partner's box included. Shelf packing can miss a tighter fit, so a
// "no" only ever makes the mat bigger.
export function holdsAll(bounds: Bounds, partners: ReadonlyArray<Box & { readonly cells: number }>, loose: number): boolean {
  const sorted = [...partners].sort((a, b) => b.h - a.h || b.w - a.w);
  let x = 0;
  let y = 0;
  let shelf = 0;
  for (const p of sorted) {
    if (p.w > bounds.cols) {
      return false;
    }
    if (x + p.w > bounds.cols) {
      x = 0;
      y += shelf;
      shelf = 0;
    }
    x += p.w;
    shelf = Math.max(shelf, p.h);
  }
  if (y + shelf > bounds.rows) {
    return false;
  }
  const used = partners.reduce((a, p) => a + p.cells, 0);
  return bounds.cols * bounds.rows - used >= loose;
}

// The bench for a stop, from its spec alone (pure: tests and the map read it
// without dealing anything).
export function fitBench(spec: QuestionSpec): Bounds {
  // A Compare Island picture (Phase 23d): exactly its two sides and the gap
  // for the sign, no spare row or column (nothing is ever moved on it).
  if (spec.kind === 'sign') {
    return signBounds(spec.rounds);
  }
  const need = needOf(spec);
  let cols = Math.max(MIN_BENCH.cols, ...need.shapes.map((s) => s.w + BENCH_MARGIN), need.dealt?.w ?? 0);
  let rows = Math.max(MIN_BENCH.rows, ...need.shapes.map((s) => s.h + BENCH_MARGIN), need.dealt?.h ?? 0);
  const partners = need.partners.map((n) => ({ ...numberBox(n), cells: n }));
  // Grow downwards: on a phone the width is what sets the block size.
  while (!holdsAll({ cols, rows }, partners, need.loose)) {
    if (partners.some((p) => p.w > cols)) {
      cols += 1;
    } else {
      rows += 1;
    }
  }
  return { cols, rows };
}

// A node's own bounds win, then its chapter's, then the fitted mat.
export function benchFor(chapter: Chapter, node: NodeSpec): Bounds {
  return node.bounds ?? chapter.bounds ?? fitBench(node.spec);
}

// The same question asked of real material: every partner and loose block on the mat together.
export function holdsMaterial(state: BenchState): boolean {
  const grouped = new Set<string>();
  const partners = [...state.groups.values()].map((g) => {
    g.unitIds.forEach((u) => grouped.add(u));
    return { ...boxOf(g.shape), cells: groupSize(g) };
  });
  const loose = [...state.units.keys()].filter((u) => !grouped.has(u)).length;
  return holdsAll(state.bounds, partners, loose);
}
