import { apply, commit, createHistory, MAX_UNDO, undo } from './commands';
import type { Command, History } from './commands';
import { cell } from './grid';
import { groupId, unitId, unitIds } from './ids';
import type { BenchState } from './inventory';
import { assertInvariants, assertSameMaterial, benchCount, createBenchState } from './state';

const bounds = { cols: 4, rows: 3 };
const [u0, u1, u2] = unitIds('q', 3) as [ReturnType<typeof unitId>, ReturnType<typeof unitId>, ReturnType<typeof unitId>];

function fresh(count = 3): BenchState {
  return createBenchState({ units: unitIds('q', count).map((id) => ({ id, hue: 'red' })), bounds });
}

// Applies a command that must succeed, checking the invariants on the way out.
function ok(state: BenchState, cmd: Command): BenchState {
  const result = apply(state, cmd);
  if (!result.ok) {
    throw new Error(`expected success, got ${result.reason}`);
  }
  assertInvariants(result.value);
  assertSameMaterial(state, result.value);
  return result.value;
}

function expectRejected(state: BenchState, cmd: Command, reason: string): void {
  const snapshot = { tray: state.tray, bench: state.bench, groups: state.groups };
  const result = apply(state, cmd);
  expect(result).toEqual({ ok: false, reason });
  // The input is untouched: same references, nothing mutated.
  expect(state.tray).toBe(snapshot.tray);
  expect(state.bench).toBe(snapshot.bench);
  expect(state.groups).toBe(snapshot.groups);
}

describe('take / return / take', () => {
  test('AC-35: tray and bench inventory is conserved across take, return, take', () => {
    const s0 = fresh();
    const s1 = ok(s0, { type: 'take', unitId: u1, to: cell(2, 1) });
    expect(s1.tray[1]).toEqual({ slot: 1, unitId: null });
    expect(s1.bench.get(u1)).toEqual(cell(2, 1));
    expect(benchCount(s1)).toBe(1);

    const s2 = ok(s1, { type: 'return', unitId: u1 });
    expect(s2.tray[1]).toEqual({ slot: 1, unitId: u1 });
    expect(s2.bench.has(u1)).toBe(false);
    expect(benchCount(s2)).toBe(0);

    const s3 = ok(s2, { type: 'take', unitId: u1, to: cell(0, 0) });
    expect(s3.tray.filter((s) => s.unitId !== null).map((s) => s.unitId)).toEqual([u0, u2]);
    expect(benchCount(s3)).toBe(1);
  });

  test('AC-25: the three main paths exist as commands: take, move, return', () => {
    const s0 = fresh();
    const s1 = ok(s0, { type: 'take', unitId: u0, to: cell(0, 0) });
    const s2 = ok(s1, { type: 'move', unitId: u0, to: cell(3, 2) });
    expect(s2.bench.get(u0)).toEqual(cell(3, 2));
    const s3 = ok(s2, { type: 'return', unitId: u0 });
    expect(s3.tray[0]?.unitId).toBe(u0);
  });

  test('return falls back to the first empty slot when the home slot is taken', () => {
    const base = fresh(2);
    // Hand-built: u1 sits in u0's home slot while u0 is on the bench.
    const odd: BenchState = {
      ...base,
      tray: [
        { slot: 0, unitId: u1 },
        { slot: 1, unitId: null },
      ],
      bench: new Map([[u0, cell(1, 1)]]),
    };
    assertInvariants(odd);
    const back = ok(odd, { type: 'return', unitId: u0 });
    expect(back.tray).toEqual([
      { slot: 0, unitId: u1 },
      { slot: 1, unitId: u0 },
    ]);
  });

  test('return with no empty slot is an invariant violation and throws', () => {
    const base = fresh(2);
    const broken: BenchState = {
      ...base,
      tray: [{ slot: 0, unitId: u1 }],
      bench: new Map([[u0, cell(1, 1)]]),
    };
    expect(() => apply(broken, { type: 'return', unitId: u0 })).toThrow(/invariant-1/);
  });

  test('return drops the unit from its group and removes a group that becomes empty', () => {
    const s1 = ok(ok(fresh(), { type: 'take', unitId: u0, to: cell(0, 0) }), { type: 'take', unitId: u1, to: cell(1, 0) });
    const pair = groupId('pair');
    const solo = groupId('solo');
    const grouped: BenchState = {
      ...s1,
      groups: new Map([
        [pair, { id: pair, unitIds: [u0, u1], shape: [cell(0, 0), cell(1, 0)], source: [] }],
      ]),
    };
    assertInvariants(grouped);
    const afterPair = ok(grouped, { type: 'return', unitId: u1 });
    expect(afterPair.groups.get(pair)?.unitIds).toEqual([u0]);
    expect(afterPair.groups.get(pair)?.shape).toEqual([cell(0, 0)]);

    const soloState: BenchState = {
      ...s1,
      groups: new Map([[solo, { id: solo, unitIds: [u1], shape: [cell(0, 0)], source: [] }]]),
    };
    const afterSolo = ok(soloState, { type: 'return', unitId: u1 });
    expect(afterSolo.groups.size).toBe(0);
    // A unit outside every group leaves the groups map untouched (same reference).
    const untouched = ok(soloState, { type: 'return', unitId: u0 });
    expect(untouched.groups).toBe(soloState.groups);
  });
});

describe('rejections never touch the input (AC-03, AC-33)', () => {
  test('take: occupied, out of bounds, not in tray', () => {
    const s1 = ok(fresh(), { type: 'take', unitId: u0, to: cell(1, 1) });
    expectRejected(s1, { type: 'take', unitId: u1, to: cell(1, 1) }, 'occupied');
    expectRejected(s1, { type: 'take', unitId: u1, to: cell(4, 0) }, 'out-of-bounds');
    expectRejected(s1, { type: 'take', unitId: u1, to: cell(0, -1) }, 'out-of-bounds');
    expectRejected(s1, { type: 'take', unitId: u0, to: cell(0, 0) }, 'not-in-tray');
    expectRejected(s1, { type: 'take', unitId: unitId('ghost'), to: cell(0, 0) }, 'not-in-tray');
  });

  test('move: not on bench, out of bounds, occupied by another unit', () => {
    const s1 = ok(ok(fresh(), { type: 'take', unitId: u0, to: cell(0, 0) }), { type: 'take', unitId: u1, to: cell(1, 0) });
    expectRejected(s1, { type: 'move', unitId: u2, to: cell(2, 0) }, 'not-on-bench');
    expectRejected(s1, { type: 'move', unitId: u0, to: cell(0, 3) }, 'out-of-bounds');
    expectRejected(s1, { type: 'move', unitId: u0, to: cell(1, 0) }, 'occupied');
    // Dropping a unit back onto its own cell is not "occupied": nobody else is there.
    const same = ok(s1, { type: 'move', unitId: u0, to: cell(0, 0) });
    expect(same.bench.get(u0)).toEqual(cell(0, 0));
  });

  test('return: not on bench', () => {
    expectRejected(fresh(), { type: 'return', unitId: u0 }, 'not-on-bench');
  });
});

describe('move touches one unit only', () => {
  test('AC-34: pulling one block away leaves its neighbour where it was', () => {
    const s1 = ok(ok(fresh(), { type: 'take', unitId: u0, to: cell(0, 0) }), { type: 'take', unitId: u1, to: cell(1, 0) });
    const s2 = ok(s1, { type: 'move', unitId: u1, to: cell(3, 2) });
    expect(s2.bench.get(u0)).toEqual(cell(0, 0));
    expect(s2.bench.get(u1)).toEqual(cell(3, 2));
    expect(benchCount(s2)).toBe(2);
  });
});

describe('history and undo', () => {
  function commitOk(h: History, cmd: Command): History {
    const r = commit(h, cmd);
    if (!r.ok) {
      throw new Error(`expected commit, got ${r.reason}`);
    }
    assertInvariants(r.value.state);
    return r.value;
  }

  test('AC-30: clearing the bench and undoing restores count, identity and position', () => {
    let h = createHistory(fresh());
    h = commitOk(h, { type: 'take', unitId: u0, to: cell(0, 0) });
    h = commitOk(h, { type: 'take', unitId: u1, to: cell(1, 0) });
    h = commitOk(h, { type: 'take', unitId: u2, to: cell(2, 0) });
    const built = h.state;
    h = commitOk(h, { type: 'return', unitId: u0 });
    h = commitOk(h, { type: 'return', unitId: u1 });
    h = commitOk(h, { type: 'return', unitId: u2 });
    expect(benchCount(h.state)).toBe(0);

    for (let i = 0; i < 3; i += 1) {
      const r = undo(h);
      expect(r.ok).toBe(true);
      if (r.ok) {
        h = r.value;
      }
    }
    expect(h.state).toBe(built);
    expect(benchCount(h.state)).toBe(3);
    expect(h.state.bench.get(u1)).toEqual(cell(1, 0));
  });

  test('undo is bounded by MAX_UNDO and fails cleanly when the past is empty', () => {
    expect(MAX_UNDO).toBe(8);
    let h = createHistory(fresh(1));
    // 10 commits of a single unit bouncing around: only the last 8 can be undone.
    for (let i = 0; i < 10; i += 1) {
      const cmd: Command =
        i === 0
          ? { type: 'take', unitId: u0, to: cell(0, 0) }
          : { type: 'move', unitId: u0, to: cell(i % 4, Math.floor(i / 4)) };
      h = commitOk(h, cmd);
    }
    expect(h.past).toHaveLength(MAX_UNDO);
    let undone = 0;
    for (;;) {
      const r = undo(h);
      if (!r.ok) {
        expect(r.reason).toBe('nothing-to-undo');
        break;
      }
      h = r.value;
      undone += 1;
    }
    expect(undone).toBe(MAX_UNDO);
    // After 8 undos we are at commit #2's result, not the initial tray state.
    expect(benchCount(h.state)).toBe(1);
  });

  test('a rejected command leaves the history untouched', () => {
    const h = createHistory(fresh());
    const r = commit(h, { type: 'move', unitId: u0, to: cell(0, 0) });
    expect(r).toEqual({ ok: false, reason: 'not-on-bench' });
    expect(h.past).toHaveLength(0);
  });

  test('maxUndo can be configured per history', () => {
    let h = createHistory(fresh(1));
    h = commitOk(h, { type: 'take', unitId: u0, to: cell(0, 0) });
    const r = commit(h, { type: 'move', unitId: u0, to: cell(1, 0) }, 1);
    expect(r.ok && r.value.past).toHaveLength(1);
  });
});
