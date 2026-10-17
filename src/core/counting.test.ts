import { apply } from './commands';
import type { Command } from './commands';
import { countUnit, fingerprintOf, isRoundValid, reconcile, startRound } from './counting';
import { cell } from './grid';
import { unitIds } from './ids';
import type { BenchState } from './inventory';
import { benchCount, createBenchState } from './state';

const ids = unitIds('q', 4);
const [a, b, c, d] = ids as [typeof ids[number], typeof ids[number], typeof ids[number], typeof ids[number]];

function run(state: BenchState, cmds: ReadonlyArray<Command>): BenchState {
  return cmds.reduce((s, cmd) => {
    const r = apply(s, cmd);
    if (!r.ok) {
      throw new Error(r.reason);
    }
    return r.value;
  }, state);
}

function threeOnBench(): BenchState {
  const base = createBenchState({ units: ids.map((id) => ({ id, hue: 'red' })), bounds: { cols: 5, rows: 5 } });
  return run(base, [
    { type: 'take', unitId: a, to: cell(0, 0) },
    { type: 'take', unitId: b, to: cell(1, 0) },
    { type: 'take', unitId: c, to: cell(2, 0) },
  ]);
}

describe('counting rounds', () => {
  test('AC-02: the same block counts once per round', () => {
    const state = threeOnBench();
    let round = startRound(state);
    round = countUnit(round, state, a);
    round = countUnit(round, state, a);
    expect(round.counted).toEqual([a]);
    round = countUnit(round, state, b);
    expect(round.counted).toEqual([a, b]);
  });

  test('AC-27: adding a fourth block mid-count voids the round; rearranging does not', () => {
    const state = threeOnBench();
    let round = countUnit(countUnit(startRound(state), state, a), state, b);
    expect(round.counted).toHaveLength(2);

    const rearranged = run(state, [{ type: 'move', unitId: c, to: cell(4, 4) }]);
    expect(isRoundValid(round, rearranged)).toBe(true);
    expect(reconcile(round, rearranged)).toBe(round);

    const grown = run(state, [{ type: 'take', unitId: d, to: cell(3, 0) }]);
    expect(isRoundValid(round, grown)).toBe(false);
    expect(reconcile(round, grown).counted).toEqual([]);
    expect(fingerprintOf(grown)).toBe([a, b, c, d].join(','));

    const shrunk = run(state, [{ type: 'return', unitId: c }]);
    expect(isRoundValid(round, shrunk)).toBe(false);

    // Swapping one block for another of the same count is still a different set.
    const swapped = run(shrunk, [{ type: 'take', unitId: d, to: cell(2, 0) }]);
    expect(benchCount(swapped)).toBe(3);
    expect(isRoundValid(round, swapped)).toBe(false);
  });

  test('counting on a voided round starts a fresh one with that block', () => {
    const state = threeOnBench();
    const round = countUnit(startRound(state), state, a);
    const grown = run(state, [{ type: 'take', unitId: d, to: cell(3, 0) }]);
    const next = countUnit(round, grown, b);
    expect(next.counted).toEqual([b]);
    expect(next.fingerprint).toBe(fingerprintOf(grown));
  });

  test('AC-28: progress and total are separate values; off-bench blocks cannot be counted', () => {
    const state = threeOnBench();
    const round = countUnit(startRound(state), state, a);
    expect(round.counted.length).toBe(1);
    expect(benchCount(state)).toBe(3);
    expect(countUnit(round, state, d)).toBe(round);
  });
});
