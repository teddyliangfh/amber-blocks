import type { UnitId } from './ids';
import type { BenchState } from './inventory';

// One round of touching blocks to count them. The round is bound to the set of
// identities on the bench: add, remove or swap a block and the round is void;
// merely rearranging the same blocks keeps it (AC-27).
export interface CountRound {
  readonly fingerprint: string;
  readonly counted: ReadonlyArray<UnitId>;
}

export function fingerprintOf(state: BenchState): string {
  return [...state.bench.keys()].sort().join(',');
}

export function startRound(state: BenchState): CountRound {
  return { fingerprint: fingerprintOf(state), counted: [] };
}

export function isRoundValid(round: CountRound, state: BenchState): boolean {
  return round.fingerprint === fingerprintOf(state);
}

// The round that applies to `state`: the given one if still valid, else a fresh one.
export function reconcile(round: CountRound, state: BenchState): CountRound {
  return isRoundValid(round, state) ? round : startRound(state);
}

// Counts a block at most once per round (AC-02). A block that is not on the
// bench cannot be counted. Progress (`counted.length`) and the total
// (`benchCount`) stay separate values for the UI to choose from (AC-28).
export function countUnit(round: CountRound, state: BenchState, unitId: UnitId): CountRound {
  const current = reconcile(round, state);
  if (!state.bench.has(unitId) || current.counted.includes(unitId)) {
    return current;
  }
  return { ...current, counted: [...current.counted, unitId] };
}
