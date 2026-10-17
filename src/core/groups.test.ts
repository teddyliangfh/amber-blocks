import { apply, commit, createHistory, undo } from './commands';
import type { Command } from './commands';
import { cell } from './grid';
import { areTouching, defineGroup, groupCells, groupSize, mergedGroup } from './groups';
import { groupId, unitIds } from './ids';
import type { BenchState, Group } from './inventory';
import { judge } from './judge';
import { assertInvariants, assertSameMaterial, benchCount, createBenchState } from './state';

function run(state: BenchState, cmds: ReadonlyArray<Command>): BenchState {
  return cmds.reduce((s, cmd) => {
    const r = apply(s, cmd);
    if (!r.ok) {
      throw new Error(r.reason);
    }
    assertInvariants(r.value);
    assertSameMaterial(s, r.value);
    return r.value;
  }, state);
}

// Builds a bench with named partners placed at explicit cells.
function partners(
  spec: ReadonlyArray<readonly [string, ReadonlyArray<readonly [number, number]>]>,
  bounds = { cols: 8, rows: 6 },
): { state: BenchState; group: (name: string) => Group } {
  const total = spec.reduce((n, [, cells]) => n + cells.length, 0);
  const ids = unitIds('q', total);
  let state = createBenchState({ units: ids.map((id) => ({ id, hue: 'red' })), bounds });
  let next = 0;
  for (const [name, cells] of spec) {
    const members = ids.slice(next, next + cells.length);
    state = run(
      state,
      cells.map(([x, y], i) => ({ type: 'take', unitId: members[i] as never, to: cell(x, y) })),
    );
    const r = defineGroup(state, groupId(name), members);
    if (!r.ok) {
      throw new Error(r.reason);
    }
    state = r.value;
    assertInvariants(state);
    next += cells.length;
  }
  return { state, group: (name) => state.groups.get(groupId(name)) as Group };
}

const three: ReadonlyArray<readonly [number, number]> = [[0, 0], [0, 1], [1, 1]];
const fourAway: ReadonlyArray<readonly [number, number]> = [[4, 0], [5, 0], [4, 1], [5, 1]];
const fourTouching: ReadonlyArray<readonly [number, number]> = [[2, 1], [3, 1], [2, 2], [3, 2]];

describe('defineGroup', () => {
  test('creates a partner from bench units; rejects unknown, grouped, empty or duplicate ids', () => {
    const { state, group } = partners([['a', three]]);
    expect(groupSize(group('a'))).toBe(3);
    expect(groupCells(state, group('a'))).toEqual([cell(0, 0), cell(0, 1), cell(1, 1)]);
    const extraIds = unitIds('q', 4);
    expect(defineGroup(state, groupId('a'), [extraIds[3] as never])).toEqual({ ok: false, reason: 'group-exists' });
    expect(defineGroup(state, groupId('b'), [])).toEqual({ ok: false, reason: 'empty-group' });
    expect(defineGroup(state, groupId('b'), [unitIds('zz', 1)[0] as never])).toEqual({ ok: false, reason: 'not-in-tray' });
    expect(defineGroup(state, groupId('b'), [extraIds[0] as never])).toEqual({ ok: false, reason: 'already-grouped' });
  });
});

describe('moveGroup (AC-26, AC-40)', () => {
  test('moves every member by the same delta in one commit', () => {
    const { state, group } = partners([['a', three], ['b', fourAway]]);
    const moved = run(state, [{ type: 'moveGroup', groupId: groupId('b'), delta: cell(-2, 1) }]);
    expect(groupCells(moved, moved.groups.get(groupId('b')) as Group)).toEqual(fourTouching.map(([x, y]) => cell(x, y)));
    expect(groupCells(moved, group('a'))).toEqual(three.map(([x, y]) => cell(x, y)));
    expect(benchCount(moved)).toBe(7);
  });

  test('partially out of bounds or onto an outsider rejects the whole move, input untouched', () => {
    const { state } = partners([['a', three], ['b', fourAway]]);
    const bench = state.bench;
    expect(apply(state, { type: 'moveGroup', groupId: groupId('b'), delta: cell(3, 0) })).toEqual({ ok: false, reason: 'out-of-bounds' });
    expect(apply(state, { type: 'moveGroup', groupId: groupId('b'), delta: cell(-4, 0) })).toEqual({ ok: false, reason: 'occupied' });
    expect(apply(state, { type: 'moveGroup', groupId: groupId('zzz'), delta: cell(0, 0) })).toEqual({ ok: false, reason: 'unknown-group' });
    expect(state.bench).toBe(bench);
  });

  test('a group may slide over its own cells', () => {
    const { state } = partners([['b', fourAway]]);
    const slid = run(state, [{ type: 'moveGroup', groupId: groupId('b'), delta: cell(1, 0) }]);
    expect(groupCells(slid, slid.groups.get(groupId('b')) as Group)).toEqual([cell(5, 0), cell(6, 0), cell(5, 1), cell(6, 1)]);
  });

  test('AC-40: moving one block of a partner detaches it; the rest of the partner stays put', () => {
    const { state } = partners([['a', three]]);
    const ids = unitIds('q', 3);
    const pulled = run(state, [{ type: 'move', unitId: ids[2] as never, to: cell(6, 5) }]);
    expect(pulled.groups.get(groupId('a'))?.unitIds).toEqual(ids.slice(0, 2));
    expect(pulled.groups.get(groupId('a'))?.shape).toEqual([cell(0, 0), cell(0, 1)]);
    expect(pulled.bench.get(ids[0] as never)).toEqual(cell(0, 0));
    expect(judge(pulled, { kind: 'quantity', target: 3 }).matched).toBe(true);
  });

  test('a member of a tray partner cannot be taken on its own (property-test counterexample)', () => {
    const ids = unitIds('q', 3);
    const base = createBenchState({ units: ids.map((id) => ({ id, hue: 'red' })), bounds: { cols: 2, rows: 2 } });
    const r = defineGroup(base, groupId('g0'), ids.slice(0, 2), [cell(0, 0), cell(1, 0)]);
    if (!r.ok) {
      throw new Error(r.reason);
    }
    expect(apply(r.value, { type: 'take', unitId: ids[0] as never, to: cell(0, 0) })).toEqual({ ok: false, reason: 'grouped' });
    // The loose third unit is unaffected.
    const loose = run(r.value, [{ type: 'take', unitId: ids[2] as never, to: cell(0, 1) }]);
    expect(benchCount(loose)).toBe(1);
  });

  test('moveGroup on a partner still in the tray is not-on-bench', () => {
    const ids = unitIds('q', 2);
    const base = createBenchState({ units: ids.map((id) => ({ id, hue: 'red' })), bounds: { cols: 4, rows: 4 } });
    const r = defineGroup(base, groupId('t'), ids, [cell(0, 0), cell(1, 0)]);
    if (!r.ok) {
      throw new Error(r.reason);
    }
    expect(apply(r.value, { type: 'moveGroup', groupId: groupId('t'), delta: cell(1, 0) })).toEqual({ ok: false, reason: 'not-on-bench' });
  });

  test('undo restores the whole group position', () => {
    const { state } = partners([['b', fourAway]]);
    let h = createHistory(state);
    const c = commit(h, { type: 'moveGroup', groupId: groupId('b'), delta: cell(-2, 1) });
    if (!c.ok) {
      throw new Error(c.reason);
    }
    h = c.value;
    const u = undo(h);
    expect(u.ok && u.value.state).toBe(state);
  });
});

describe('takeGroup / returnGroup (AC-26, decision 6)', () => {
  const ids = unitIds('q', 9);
  // Tray holds a 2x2 partner, a corner partner and two loose units.
  function trayPartners(): BenchState {
    let state = createBenchState({ units: ids.map((id) => ({ id, hue: 'red' })), bounds: { cols: 5, rows: 4 } });
    const square = defineGroup(state, groupId('four'), ids.slice(0, 4), [cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)]);
    if (!square.ok) {
      throw new Error(square.reason);
    }
    const corner = defineGroup(square.value, groupId('three'), ids.slice(4, 7), [cell(0, 0), cell(0, 1), cell(1, 1)]);
    if (!corner.ok) {
      throw new Error(corner.reason);
    }
    state = corner.value;
    assertInvariants(state);
    return state;
  }

  test('takeGroup lands every member at origin + shape in one commit and empties their slots', () => {
    const state = trayPartners();
    const landed = run(state, [{ type: 'takeGroup', groupId: groupId('four'), origin: cell(2, 1) }]);
    expect(groupCells(landed, landed.groups.get(groupId('four')) as Group)).toEqual([cell(2, 1), cell(3, 1), cell(2, 2), cell(3, 2)]);
    expect(landed.tray.slice(0, 4).every((s) => s.unitId === null)).toBe(true);
    expect(benchCount(landed)).toBe(4);
    expect(judge(landed, { kind: 'quantity', target: 4 }).matched).toBe(true);
  });

  test('takeGroup is atomic: out of bounds or onto an occupied cell rejects the whole partner', () => {
    const state = trayPartners();
    expect(apply(state, { type: 'takeGroup', groupId: groupId('four'), origin: cell(4, 0) })).toEqual({ ok: false, reason: 'out-of-bounds' });
    expect(apply(state, { type: 'takeGroup', groupId: groupId('four'), origin: cell(0, 3) })).toEqual({ ok: false, reason: 'out-of-bounds' });
    const withLoose = run(state, [{ type: 'take', unitId: ids[8] as never, to: cell(1, 1) }]);
    const bench = withLoose.bench;
    expect(apply(withLoose, { type: 'takeGroup', groupId: groupId('four'), origin: cell(0, 0) })).toEqual({ ok: false, reason: 'occupied' });
    expect(withLoose.bench).toBe(bench);
    expect(apply(state, { type: 'takeGroup', groupId: groupId('nope'), origin: cell(0, 0) })).toEqual({ ok: false, reason: 'unknown-group' });
  });

  test('takeGroup on a partner already on the bench is not-in-tray; returnGroup on a tray partner is not-on-bench', () => {
    const state = trayPartners();
    const landed = run(state, [{ type: 'takeGroup', groupId: groupId('four'), origin: cell(0, 0) }]);
    expect(apply(landed, { type: 'takeGroup', groupId: groupId('four'), origin: cell(2, 2) })).toEqual({ ok: false, reason: 'not-in-tray' });
    expect(apply(state, { type: 'returnGroup', groupId: groupId('four') })).toEqual({ ok: false, reason: 'not-on-bench' });
    expect(apply(state, { type: 'returnGroup', groupId: groupId('nope') })).toEqual({ ok: false, reason: 'unknown-group' });
  });

  test('returnGroup puts every member back in its home slot and keeps the pose as the shape', () => {
    const state = trayPartners();
    const out = run(state, [
      { type: 'takeGroup', groupId: groupId('three'), origin: cell(1, 1) },
      { type: 'moveGroup', groupId: groupId('three'), delta: cell(1, 0) },
    ]);
    const back = run(out, [{ type: 'returnGroup', groupId: groupId('three') }]);
    expect(back.tray).toEqual(state.tray);
    expect(benchCount(back)).toBe(0);
    expect(back.groups.get(groupId('three'))?.shape).toEqual([cell(0, 0), cell(0, 1), cell(1, 1)]);
    // Detach one block, then return the rest: the shape shrinks with the partner.
    const pulled = run(out, [{ type: 'move', unitId: ids[6] as never, to: cell(4, 3) }]);
    const twoBack = run(pulled, [{ type: 'returnGroup', groupId: groupId('three') }]);
    expect(twoBack.groups.get(groupId('three'))?.unitIds).toEqual(ids.slice(4, 6));
    expect(twoBack.groups.get(groupId('three'))?.shape).toEqual([cell(0, 0), cell(0, 1)]);
    expect(benchCount(twoBack)).toBe(1);
  });

  test('undo of takeGroup and returnGroup restores the exact previous state', () => {
    const state = trayPartners();
    let h = createHistory(state);
    const c1 = commit(h, { type: 'takeGroup', groupId: groupId('four'), origin: cell(0, 0) });
    if (!c1.ok) {
      throw new Error(c1.reason);
    }
    h = c1.value;
    const c2 = commit(h, { type: 'returnGroup', groupId: groupId('four') });
    if (!c2.ok) {
      throw new Error(c2.reason);
    }
    const u2 = undo(c2.value);
    expect(u2.ok && u2.value.state).toBe(h.state);
    const u1 = undo(h);
    expect(u1.ok && u1.value.state).toBe(state);
  });

  test('defineGroup: tray partners need a well-formed shape; split partners are rejected', () => {
    const base = createBenchState({ units: ids.map((id) => ({ id, hue: 'red' })), bounds: { cols: 5, rows: 4 } });
    expect(() => defineGroup(base, groupId('x'), ids.slice(0, 2))).toThrow(/needs a shape/);
    expect(() => defineGroup(base, groupId('x'), ids.slice(0, 2), [cell(0, 0)])).toThrow(/needs a shape/);
    expect(() => defineGroup(base, groupId('x'), ids.slice(0, 2), [cell(0, 0), cell(0, 0)])).toThrow(/overlapping/);
    const oneOut = run(base, [{ type: 'take', unitId: ids[0] as never, to: cell(0, 0) }]);
    expect(defineGroup(oneOut, groupId('x'), ids.slice(0, 2), [cell(0, 0), cell(1, 0)])).toEqual({ ok: false, reason: 'split-group' });
    // Shape is stored aligned to sorted ids and normalized to the origin.
    const r = defineGroup(base, groupId('y'), [ids[1] as never, ids[0] as never], [cell(5, 5), cell(6, 5)]);
    expect(r.ok && r.value.groups.get(groupId('y'))?.unitIds).toEqual(ids.slice(0, 2));
    expect(r.ok && r.value.groups.get(groupId('y'))?.shape).toEqual([cell(1, 0), cell(0, 0)]);
  });
});

describe('touching and merged partner (AC-39, AC-04)', () => {
  test('touching needs a shared edge between any two members', () => {
    const apart = partners([['a', three], ['b', fourAway]]);
    expect(areTouching(apart.state, apart.group('a'), apart.group('b'))).toBe(false);
    expect(mergedGroup(apart.state, apart.group('a'), apart.group('b'))).toBeUndefined();
    const close = partners([['a', three], ['b', fourTouching]]);
    expect(areTouching(close.state, close.group('a'), close.group('b'))).toBe(true);
    const diagonal = partners([['a', [[0, 0]]], ['b', [[1, 1]]]]);
    expect(areTouching(diagonal.state, diagonal.group('a'), diagonal.group('b'))).toBe(false);
  });

  test('the merged partner is the identity union with both sources; material is conserved', () => {
    const { state, group } = partners([['a', three], ['b', fourTouching]]);
    const merged = mergedGroup(state, group('a'), group('b')) as Group;
    expect(merged.unitIds).toEqual(unitIds('q', 7));
    expect(merged.source).toEqual([groupId('a'), groupId('b')]);
    expect(merged.shape).toHaveLength(7);
    expect(groupSize(merged)).toBe(groupSize(group('a')) + groupSize(group('b')));
    expect(state.groups.size).toBe(2);
    expect(mergedGroup(state, group('a'), group('a'))).toBeUndefined();
  });
});

describe('AC-46: seventeen from 10 / 5 / 2 handles', () => {
  test('three partners carried into one body give a real count of 17', () => {
    const ten: ReadonlyArray<readonly [number, number]> = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [0, 1], [1, 1], [2, 1], [3, 1], [4, 1]];
    const five: ReadonlyArray<readonly [number, number]> = [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]];
    const two: ReadonlyArray<readonly [number, number]> = [[7, 0], [7, 1]];
    const { state } = partners([['ten', ten], ['five', five], ['two', two]], { cols: 8, rows: 6 });
    const body = run(state, [
      { type: 'moveGroup', groupId: groupId('five'), delta: cell(0, -2) },
      { type: 'moveGroup', groupId: groupId('two'), delta: cell(-2, 0) },
    ]);
    expect(benchCount(body)).toBe(17);
    expect(judge(body, { kind: 'quantity', target: 17 })).toEqual({ matched: true, benchCount: 17, reason: 'matched' });
    expect(judge(state, { kind: 'quantity', target: 17 }).matched).toBe(true);
  });
});
