import { clusters, groupSize } from '../core';
import type { BenchState, Question } from '../core';
import type { Puzzle } from './schema';

// A stop asked more than once on the same material: the pictures of a
// sequence, a sum asked several ways ("two ways to make 7", Phase 19), a
// split asked several ways or a countdown's counts (Phase 22).
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
// accepts only the allowed pairs earlier steps did not use (`used`); a split
// asked several ways refuses the splits earlier steps made.
export function questionAt(puzzle: Puzzle, step: number, used: ReadonlyArray<Pair>): Question {
  const q = puzzle.steps?.[step] ?? puzzle.question;
  if (used.length === 0) {
    return q;
  }
  if (q.kind === 'sum_composition') {
    return { ...q, allowed: q.allowed.filter((p) => !used.some((u) => samePair(u, p))) };
  }
  if (q.kind === 'split') {
    return { ...q, except: [...(q.except ?? []), ...used] };
  }
  return q;
}

// The two parts of a way on the bench: the sizes of the two partners there
// (on a right sum, the way it was made), or, with no partner on the bench, of
// the two piles of single blocks (a split, Phase 22); null otherwise.
export function benchPair(state: BenchState): Pair | null {
  const sizes = [...state.groups.values()].filter((g) => g.unitIds.every((u) => state.bench.has(u))).map(groupSize);
  if (sizes.length === 2) {
    return [sizes[0]!, sizes[1]!];
  }
  if (sizes.length === 0) {
    const piles = clusters(state);
    return piles.length === 2 ? [piles[0]!.unitIds.length, piles[1]!.unitIds.length] : null;
  }
  return null;
}
