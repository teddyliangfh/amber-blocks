import { clusters } from './clusters';
import { areTouching, groupSize } from './groups';
import type { BenchState, Group } from './inventory';
import { DEFAULT_SYMMETRY, matchesTemplate } from './shapes';
import type { ShapeTemplate, Symmetry } from './shapes';
import { benchCount } from './state';

export type Question =
  | { readonly kind: 'quantity'; readonly target: number }
  | {
      readonly kind: 'quantity_shape';
      readonly target: number;
      readonly template: ShapeTemplate;
      readonly symmetry?: Symmetry;
    }
  | { readonly kind: 'addition_exact'; readonly operands: readonly [number, number] }
  | {
      readonly kind: 'sum_composition';
      readonly sum: number;
      readonly allowed: ReadonlyArray<readonly [number, number]>;
    }
  // Pull a number apart (Phase 22, Take-away Island): exactly `total` blocks
  // on the bench, in exactly `parts` clusters, whatever their sizes. `except`:
  // splits made already that do not count again (a stop asked several ways),
  // each as its part sizes in any order.
  | {
      readonly kind: 'split';
      readonly total: number;
      readonly parts: number;
      readonly except?: ReadonlyArray<ReadonlyArray<number>>;
    };

// Descriptive, for the UI to phrase a hint. Never a score.
export type VerdictReason =
  | 'matched'
  | 'count-mismatch'
  | 'not-one-cluster'
  | 'shape-mismatch'
  | 'groups-mismatch'
  | 'not-merged'
  // A split: the right count, but not that many clusters.
  | 'parts-mismatch'
  // A split made before (in `except`): right, but not again.
  | 'split-used';

export interface Verdict {
  readonly matched: boolean;
  // The real number of identities on the bench, whatever the question asked for.
  readonly benchCount: number;
  readonly reason: VerdictReason;
}

function verdict(count: number, reason: VerdictReason): Verdict {
  return { matched: reason === 'matched', benchCount: count, reason };
}

// The same sizes, in any order.
function sameSizes(a: ReadonlyArray<number>, b: ReadonlyArray<number>): boolean {
  const sort = (xs: ReadonlyArray<number>) => [...xs].sort((x, y) => x - y).join(',');
  return a.length === b.length && sort(a) === sort(b);
}

// All ordered pairs of distinct groups whose sizes are exactly {a, b} as a multiset.
// Distinct identity is what makes 2 + 2 need two partners (AC-44).
function pairsWithSizes(groups: ReadonlyArray<Group>, a: number, b: number): ReadonlyArray<readonly [Group, Group]> {
  const pairs: (readonly [Group, Group])[] = [];
  for (const first of groups) {
    for (const second of groups) {
      if (first.id !== second.id && groupSize(first) === a && groupSize(second) === b) {
        pairs.push([first, second]);
      }
    }
  }
  return pairs;
}

function judgePairs(state: BenchState, count: number, sizes: ReadonlyArray<readonly [number, number]>): Verdict {
  // Partners still waiting in the tray are not part of the answer.
  const groups = [...state.groups.values()].filter((g) => g.unitIds.every((u) => state.bench.has(u)));
  let sawPair = false;
  for (const [a, b] of sizes) {
    for (const [first, second] of pairsWithSizes(groups, a, b)) {
      sawPair = true;
      if (areTouching(state, first, second) && clusters(state).length === 1) {
        return verdict(count, 'matched');
      }
    }
  }
  return verdict(count, sawPair ? 'not-merged' : 'groups-mismatch');
}

// Called only on committed states; the UI never judges mid-drag.
export function judge(state: BenchState, question: Question): Verdict {
  const count = benchCount(state);
  switch (question.kind) {
    case 'quantity':
      return verdict(count, count === question.target ? 'matched' : 'count-mismatch');
    case 'quantity_shape': {
      if (count !== question.target) {
        return verdict(count, 'count-mismatch');
      }
      const parts = clusters(state);
      const whole = parts[0];
      if (parts.length !== 1 || whole === undefined) {
        return verdict(count, 'not-one-cluster');
      }
      const ok = matchesTemplate(whole.cells, question.template, question.symmetry ?? DEFAULT_SYMMETRY);
      return verdict(count, ok ? 'matched' : 'shape-mismatch');
    }
    case 'addition_exact': {
      const [a, b] = question.operands;
      if (count !== a + b) {
        return verdict(count, 'count-mismatch');
      }
      return judgePairs(state, count, [[a, b]]);
    }
    case 'sum_composition': {
      if (count !== question.sum) {
        return verdict(count, 'count-mismatch');
      }
      return judgePairs(state, count, question.allowed);
    }
    case 'split': {
      if (count !== question.total) {
        return verdict(count, 'count-mismatch');
      }
      const sizes = clusters(state).map((c) => c.unitIds.length);
      if (sizes.length !== question.parts) {
        return verdict(count, 'parts-mismatch');
      }
      return verdict(count, (question.except ?? []).some((e) => sameSizes(e, sizes)) ? 'split-used' : 'matched');
    }
  }
}
