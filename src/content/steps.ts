import { groupSize } from '../core';
import type { BenchState, Question } from '../core';
import type { Puzzle } from './schema';

// A stop asked more than once on the same material: the pictures of a
// sequence, or a sum asked several ways ("two ways to make 7", Phase 19).
// Shared by validate() and the level session so both read the steps the same way.

export type Pair = readonly [number, number];

// Two partners of these sizes, in either order.
export function samePair(a: Pair, b: Pair): boolean {
  return (a[0] === b[0] && a[1] === b[1]) || (a[0] === b[1] && a[1] === b[0]);
}

// How many times the stop is asked.
export function stepCount(puzzle: Puzzle): number {
  return puzzle.steps?.length ?? puzzle.ways ?? 1;
}

// The question at `step`: a sequence's own picture; a sum asked several ways
// accepts only the allowed pairs earlier steps did not use (`used`).
export function questionAt(puzzle: Puzzle, step: number, used: ReadonlyArray<Pair>): Question {
  const q = puzzle.steps?.[step] ?? puzzle.question;
  if (q.kind !== 'sum_composition' || used.length === 0) {
    return q;
  }
  return { ...q, allowed: q.allowed.filter((p) => !used.some((u) => samePair(u, p))) };
}

// The sizes of the two partners on the bench, when exactly two are there: on a
// right sum they are the way it was made.
export function benchPair(state: BenchState): Pair | null {
  const sizes = [...state.groups.values()].filter((g) => g.unitIds.every((u) => state.bench.has(u))).map(groupSize);
  return sizes.length === 2 ? [sizes[0]!, sizes[1]!] : null;
}
