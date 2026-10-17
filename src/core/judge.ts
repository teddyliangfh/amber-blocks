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
    };

// Descriptive, for the UI to phrase a hint. Never a score.
export type VerdictReason =
  | 'matched'
  | 'count-mismatch'
  | 'not-one-cluster'
  | 'shape-mismatch'
  | 'groups-mismatch'
  | 'not-merged';

export interface Verdict {
  readonly matched: boolean;
  // The real number of identities on the bench, whatever the question asked for.
  readonly benchCount: number;
  readonly reason: VerdictReason;
}

function verdict(count: number, reason: VerdictReason): Verdict {
  return { matched: reason === 'matched', benchCount: count, reason };
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
  }
}
