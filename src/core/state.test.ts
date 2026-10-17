import { cell } from './grid';
import { groupId, unitId, unitIds } from './ids';
import type { BenchState, Unit } from './inventory';
import { assertInvariants, assertSameMaterial, benchCount, createBenchState } from './state';

const bounds = { cols: 4, rows: 3 };

function material(count: number): Unit[] {
  return unitIds('q', count).map((id, i) => ({ id, hue: i % 2 === 0 ? 'red' : 'blue' }));
}

describe('createBenchState', () => {
  test('deals every unit into its own tray slot and records its home', () => {
    const state = createBenchState({ units: material(3), bounds });
    expect(state.tray).toEqual([
      { slot: 0, unitId: 'q-u0' },
      { slot: 1, unitId: 'q-u1' },
      { slot: 2, unitId: 'q-u2' },
    ]);
    expect(state.bench.size).toBe(0);
    expect(state.groups.size).toBe(0);
    expect(state.home.get(unitId('q-u2'))).toBe(2);
    expect(benchCount(state)).toBe(0);
    expect(() => assertInvariants(state)).not.toThrow();
  });

  test('rejects duplicate unit ids', () => {
    const dup = [...material(1), ...material(1)];
    expect(() => createBenchState({ units: dup, bounds })).toThrow(/duplicate unit id/);
  });

  test('bounds is required (no default in the core)', () => {
    // @ts-expect-error bounds must be supplied by content
    expect(() => createBenchState({ units: material(1) })).toThrow();
  });
});

describe('assertInvariants', () => {
  function onBench(state: BenchState, id: string, x: number, y: number): BenchState {
    const uid = unitId(id);
    return {
      ...state,
      tray: state.tray.map((s) => (s.unitId === uid ? { ...s, unitId: null } : s)),
      bench: new Map(state.bench).set(uid, cell(x, y)),
    };
  }

  test('invariant 1: a unit in both the tray and on the bench', () => {
    const base = createBenchState({ units: material(2), bounds });
    const broken: BenchState = { ...base, bench: new Map([[unitId('q-u0'), cell(0, 0)]]) };
    expect(() => assertInvariants(broken)).toThrow(/invariant-1.*both/);
  });

  test('invariant 1: a unit in neither place', () => {
    const base = createBenchState({ units: material(2), bounds });
    const broken: BenchState = {
      ...base,
      tray: base.tray.map((s) => (s.slot === 1 ? { ...s, unitId: null } : s)),
    };
    expect(() => assertInvariants(broken)).toThrow(/invariant-1.*neither/);
  });

  test('invariant 1: unknown units, duplicated tray entries, mis-indexed slots, missing home', () => {
    const base = createBenchState({ units: material(2), bounds });
    const unknownInTray: BenchState = {
      ...base,
      tray: [{ slot: 0, unitId: unitId('ghost') }, ...base.tray.slice(1)],
    };
    expect(() => assertInvariants(unknownInTray)).toThrow(/invariant-1.*unknown/);
    const twiceInTray: BenchState = {
      ...base,
      tray: [base.tray[0]!, { slot: 1, unitId: unitId('q-u0') }],
    };
    expect(() => assertInvariants(twiceInTray)).toThrow(/invariant-1.*twice/);
    const misIndexed: BenchState = { ...base, tray: [base.tray[1]!, base.tray[0]!] };
    expect(() => assertInvariants(misIndexed)).toThrow(/invariant-1.*index/);
    const unknownOnBench: BenchState = {
      ...base,
      bench: new Map([[unitId('ghost'), cell(0, 0)]]),
    };
    expect(() => assertInvariants(unknownOnBench)).toThrow(/invariant-1.*unknown/);
    const noHome: BenchState = { ...base, home: new Map() };
    expect(() => assertInvariants(noHome)).toThrow(/invariant-1.*home/);
  });

  test('invariant 2: overlapping cells and out-of-bounds cells', () => {
    const base = createBenchState({ units: material(2), bounds });
    const overlap = onBench(onBench(base, 'q-u0', 1, 1), 'q-u1', 1, 1);
    expect(() => assertInvariants(overlap)).toThrow(/invariant-2.*share/);
    const outside = onBench(base, 'q-u0', 4, 0);
    expect(() => assertInvariants(outside)).toThrow(/invariant-2.*out of bounds/);
  });

  test('invariant 3: groups are whole (tray or bench), disjoint, shape-aligned and non-empty', () => {
    const base = createBenchState({ units: material(3), bounds });
    const placed = onBench(onBench(base, 'q-u0', 0, 0), 'q-u1', 1, 0);
    const okGroup: BenchState = {
      ...placed,
      groups: new Map([[groupId('g'), { id: groupId('g'), unitIds: [unitId('q-u0'), unitId('q-u1')], shape: [cell(0, 0), cell(1, 0)], source: [] }]]),
    };
    expect(() => assertInvariants(okGroup)).not.toThrow();
    const inTray: BenchState = {
      ...placed,
      groups: new Map([[groupId('g'), { id: groupId('g'), unitIds: [unitId('q-u2')], shape: [cell(0, 0)], source: [] }]]),
    };
    // A whole partner in the tray is fine; a partner split across tray and bench is not.
    expect(() => assertInvariants(inTray)).not.toThrow();
    const split: BenchState = {
      ...placed,
      groups: new Map([[groupId('s'), { id: groupId('s'), unitIds: [unitId('q-u0'), unitId('q-u2')], shape: [cell(0, 0), cell(1, 0)], source: [] }]]),
    };
    expect(() => assertInvariants(split)).toThrow(/invariant-3.*split/);
    const badShape: BenchState = {
      ...placed,
      groups: new Map([[groupId('b'), { id: groupId('b'), unitIds: [unitId('q-u0')], shape: [], source: [] }]]),
    };
    expect(() => assertInvariants(badShape)).toThrow(/invariant-3.*shape has 0 cells/);
    const overlapShape: BenchState = {
      ...base,
      groups: new Map([[groupId('o'), { id: groupId('o'), unitIds: [unitId('q-u0'), unitId('q-u1')], shape: [cell(0, 0), cell(0, 0)], source: [] }]]),
    };
    expect(() => assertInvariants(overlapShape)).toThrow(/invariant-3.*overlapping/);
    const unknownMember: BenchState = {
      ...base,
      groups: new Map([[groupId('u'), { id: groupId('u'), unitIds: [unitId('ghost')], shape: [cell(0, 0)], source: [] }]]),
    };
    expect(() => assertInvariants(unknownMember)).toThrow(/invariant-3.*unknown/);
    const twice: BenchState = {
      ...placed,
      groups: new Map([
        [groupId('a'), { id: groupId('a'), unitIds: [unitId('q-u0')], shape: [cell(0, 0)], source: [] }],
        [groupId('b'), { id: groupId('b'), unitIds: [unitId('q-u0')], shape: [cell(0, 0)], source: [] }],
      ]),
    };
    expect(() => assertInvariants(twice)).toThrow(/invariant-3.*more than one/);
    const empty: BenchState = {
      ...placed,
      groups: new Map([[groupId('e'), { id: groupId('e'), unitIds: [], shape: [], source: [] }]]),
    };
    expect(() => assertInvariants(empty)).toThrow(/invariant-3.*empty/);
  });

  test('invariant 4: material must be identical across a command', () => {
    const before = createBenchState({ units: material(2), bounds });
    expect(() => assertSameMaterial(before, { ...before })).not.toThrow();
    const fewer: BenchState = { ...before, units: new Map([...before.units].slice(0, 1)) };
    expect(() => assertSameMaterial(before, fewer)).toThrow(/invariant-4.*count/);
    const swapped: BenchState = {
      ...before,
      units: new Map([...before.units].map(([id, u]) => [id, { ...u }])),
    };
    expect(() => assertSameMaterial(before, swapped)).toThrow(/invariant-4.*replaced/);
  });
});
