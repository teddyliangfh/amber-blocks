import { apply } from './commands';
import type { Command } from './commands';
import { cell } from './grid';
import { defineGroup } from './groups';
import { groupId, unitIds } from './ids';
import type { BenchState } from './inventory';
import { judge } from './judge';
import { template } from './shapes';
import { createBenchState } from './state';

const ids = unitIds('q', 5);
const square = template([cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)]);
const corner = template([cell(0, 0), cell(0, 1), cell(1, 1)]);

function run(state: BenchState, cmds: ReadonlyArray<Command>): BenchState {
  return cmds.reduce((s, cmd) => {
    const r = apply(s, cmd);
    if (!r.ok) {
      throw new Error(r.reason);
    }
    return r.value;
  }, state);
}

function build(cells: ReadonlyArray<readonly [number, number]>, hues: ReadonlyArray<string> = []): BenchState {
  const base = createBenchState({
    units: ids.map((id, i) => ({ id, hue: hues[i] ?? 'red' })),
    bounds: { cols: 5, rows: 5 },
  });
  return run(
    base,
    cells.map(([x, y], i) => ({ type: 'take', unitId: ids[i] as never, to: cell(x, y) })),
  );
}

const row4: ReadonlyArray<readonly [number, number]> = [[0, 0], [1, 0], [2, 0], [3, 0]];
const square4: ReadonlyArray<readonly [number, number]> = [[0, 0], [1, 0], [0, 1], [1, 1]];
const scattered4: ReadonlyArray<readonly [number, number]> = [[0, 0], [2, 0], [0, 2], [4, 4]];

describe('quantity', () => {
  test('AC-37: four in a row and 2x2 both match quantity 4', () => {
    expect(judge(build(row4), { kind: 'quantity', target: 4 })).toEqual({ matched: true, benchCount: 4, reason: 'matched' });
    expect(judge(build(square4), { kind: 'quantity', target: 4 })).toEqual({ matched: true, benchCount: 4, reason: 'matched' });
  });

  test('AC-21: colour and connection are irrelevant to a quantity question', () => {
    const mixed = build(scattered4, ['red', 'blue', 'green', 'yellow']);
    expect(judge(mixed, { kind: 'quantity', target: 4 }).matched).toBe(true);
    expect(judge(build(scattered4), { kind: 'quantity', target: 4 }).matched).toBe(true);
  });

  test('AC-01 / AC-38: the verdict follows the real bench count after every commit', () => {
    const three = build([[0, 0], [1, 0], [2, 0]]);
    expect(judge(three, { kind: 'quantity', target: 4 })).toEqual({ matched: false, benchCount: 3, reason: 'count-mismatch' });
    const four = run(three, [{ type: 'take', unitId: ids[3] as never, to: cell(3, 0) }]);
    expect(judge(four, { kind: 'quantity', target: 4 }).matched).toBe(true);
    const backToThree = run(four, [{ type: 'return', unitId: ids[0] as never }]);
    expect(judge(backToThree, { kind: 'quantity', target: 4 })).toEqual({ matched: false, benchCount: 3, reason: 'count-mismatch' });
  });

  test('judge is pure: same state, same verdict, state untouched', () => {
    const state = build(row4);
    const before = state.bench;
    expect(judge(state, { kind: 'quantity', target: 4 })).toEqual(judge(state, { kind: 'quantity', target: 4 }));
    expect(state.bench).toBe(before);
  });
});

describe('quantity_shape', () => {
  test('AC-43: only the square matches a 2x2 template; the row reports the true count', () => {
    const q = { kind: 'quantity_shape', target: 4, template: square } as const;
    expect(judge(build(square4), q)).toEqual({ matched: true, benchCount: 4, reason: 'matched' });
    expect(judge(build(row4), q)).toEqual({ matched: false, benchCount: 4, reason: 'shape-mismatch' });
  });

  test('decision 1: an extra unit on the bench breaks a shape match', () => {
    const q = { kind: 'quantity_shape', target: 4, template: square } as const;
    const five = build([...square4, [4, 4]]);
    expect(judge(five, q)).toEqual({ matched: false, benchCount: 5, reason: 'count-mismatch' });
  });

  test('the right count split into two clusters is not the shape', () => {
    const q = { kind: 'quantity_shape', target: 4, template: square } as const;
    const dominoes = build([[0, 0], [1, 0], [3, 3], [4, 3]]);
    expect(judge(dominoes, q)).toEqual({ matched: false, benchCount: 4, reason: 'not-one-cluster' });
  });

  test('corner boss: every rotation passes, the 3-line does not, translation is free', () => {
    const q = { kind: 'quantity_shape', target: 3, template: corner } as const;
    expect(judge(build([[2, 2], [2, 3], [3, 3]]), q).matched).toBe(true);
    expect(judge(build([[2, 2], [3, 2], [2, 3]]), q).matched).toBe(true);
    expect(judge(build([[2, 2], [3, 2], [3, 3]]), q).matched).toBe(true);
    expect(judge(build([[3, 2], [2, 3], [3, 3]]), q).matched).toBe(true);
    expect(judge(build([[0, 0], [1, 0], [2, 0]]), q)).toEqual({ matched: false, benchCount: 3, reason: 'shape-mismatch' });
  });

  test('per-question symmetry overrides the default', () => {
    const L = template([cell(0, 0), cell(0, 1), cell(0, 2), cell(1, 2)]);
    const jPlacement: ReadonlyArray<readonly [number, number]> = [[1, 0], [1, 1], [1, 2], [0, 2]];
    expect(judge(build(jPlacement), { kind: 'quantity_shape', target: 4, template: L }).matched).toBe(false);
    expect(
      judge(build(jPlacement), { kind: 'quantity_shape', target: 4, template: L, symmetry: { rotation: true, mirror: true } }).matched,
    ).toBe(true);
  });
});

describe('addition (AC-44, AC-45, AC-39)', () => {
  function withGroups(groups: ReadonlyArray<readonly [string, ReadonlyArray<readonly [number, number]>]>, loose: ReadonlyArray<readonly [number, number]> = []): BenchState {
    const total = groups.reduce((n, [, cells]) => n + cells.length, 0) + loose.length;
    const all = unitIds('g', total);
    let state = createBenchState({ units: all.map((id) => ({ id, hue: 'red' })), bounds: { cols: 8, rows: 6 } });
    let next = 0;
    for (const [name, cells] of groups) {
      const members = all.slice(next, next + cells.length);
      state = run(state, cells.map(([x, y], i) => ({ type: 'take', unitId: members[i] as never, to: cell(x, y) })));
      const r = defineGroup(state, groupId(name), members);
      if (!r.ok) {
        throw new Error(r.reason);
      }
      state = r.value;
      next += cells.length;
    }
    state = run(state, loose.map(([x, y], i) => ({ type: 'take', unitId: all[next + i] as never, to: cell(x, y) })));
    return state;
  }
  const three: ReadonlyArray<readonly [number, number]> = [[0, 0], [0, 1], [1, 1]];
  const fourTouching: ReadonlyArray<readonly [number, number]> = [[2, 1], [3, 1], [2, 2], [3, 2]];
  const fourAway: ReadonlyArray<readonly [number, number]> = [[5, 0], [6, 0], [5, 1], [6, 1]];
  const five: ReadonlyArray<readonly [number, number]> = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]];
  const two: ReadonlyArray<readonly [number, number]> = [[0, 1], [1, 1]];

  test('AC-45: 3 + 4 passes in either order; 5 + 2 does not, but still counts 7', () => {
    const q = { kind: 'addition_exact', operands: [3, 4] } as const;
    expect(judge(withGroups([['a', three], ['b', fourTouching]]), q)).toEqual({ matched: true, benchCount: 7, reason: 'matched' });
    expect(judge(withGroups([['b', fourTouching], ['a', three]]), q)).toEqual({ matched: true, benchCount: 7, reason: 'matched' });
    expect(judge(withGroups([['a', five], ['b', two]]), q)).toEqual({ matched: false, benchCount: 7, reason: 'groups-mismatch' });
  });

  test('the right partners that are not joined report not-merged; wrong totals report count-mismatch', () => {
    const q = { kind: 'addition_exact', operands: [3, 4] } as const;
    expect(judge(withGroups([['a', three], ['b', fourAway]]), q)).toEqual({ matched: false, benchCount: 7, reason: 'not-merged' });
    expect(judge(withGroups([['a', three]]), q)).toEqual({ matched: false, benchCount: 3, reason: 'count-mismatch' });
    // 3 + 4 joined but a stray loose unit makes 8.
    expect(judge(withGroups([['a', three], ['b', fourTouching]], [[7, 5]]), q)).toEqual({ matched: false, benchCount: 8, reason: 'count-mismatch' });
    // Joined partners plus a loose unit that is also attached: count still wrong.
    expect(judge(withGroups([['a', three], ['b', fourTouching]], [[4, 1]]), q).reason).toBe('count-mismatch');
  });

  test('AC-44: 2 + 2 needs two distinct partners; one 4-partner or loose blocks do not count', () => {
    const q = { kind: 'addition_exact', operands: [2, 2] } as const;
    expect(judge(withGroups([['a', [[0, 0], [1, 0]]], ['b', [[0, 1], [1, 1]]]]), q)).toEqual({ matched: true, benchCount: 4, reason: 'matched' });
    expect(judge(withGroups([['only', [[0, 0], [1, 0], [0, 1], [1, 1]]]]), q)).toEqual({ matched: false, benchCount: 4, reason: 'groups-mismatch' });
    expect(judge(withGroups([['a', [[0, 0], [1, 0]]]], [[0, 1], [1, 1]]), q)).toEqual({ matched: false, benchCount: 4, reason: 'groups-mismatch' });
  });

  test('partners still in the tray never count (demo-found bug)', () => {
    const q = { kind: 'addition_exact', operands: [3, 4] } as const;
    const all = unitIds('t', 14);
    let state = createBenchState({ units: all.map((id) => ({ id, hue: 'red' })), bounds: { cols: 8, rows: 6 } });
    const defs: ReadonlyArray<readonly [string, number, ReadonlyArray<readonly [number, number]>]> = [
      ['five', 5, [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]],
      ['three', 3, [[0, 0], [0, 1], [1, 1]]],
      ['two', 2, [[0, 0], [1, 0]]],
      ['four', 4, [[0, 0], [1, 0], [0, 1], [1, 1]]],
    ];
    let next = 0;
    for (const [name, size, shape] of defs) {
      const r = defineGroup(state, groupId(name), all.slice(next, next + size), shape.map(([x, y]) => cell(x, y)));
      if (!r.ok) {
        throw new Error(r.reason);
      }
      state = r.value;
      next += size;
    }
    const wrongPair = run(state, [
      { type: 'takeGroup', groupId: groupId('five'), origin: cell(0, 0) },
      { type: 'takeGroup', groupId: groupId('two'), origin: cell(0, 1) },
    ]);
    expect(judge(wrongPair, q)).toEqual({ matched: false, benchCount: 7, reason: 'groups-mismatch' });
    expect(judge(state, q)).toEqual({ matched: false, benchCount: 0, reason: 'count-mismatch' });
  });

  test('sum_composition 7 accepts any allowed split, rejects others, and needs the join', () => {
    const q = { kind: 'sum_composition', sum: 7, allowed: [[3, 4], [5, 2]] } as const;
    expect(judge(withGroups([['a', three], ['b', fourTouching]]), q).matched).toBe(true);
    expect(judge(withGroups([['a', five], ['b', two]]), q).matched).toBe(true);
    expect(judge(withGroups([['a', [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]]], ['b', [[0, 1]]]]), q)).toEqual({ matched: false, benchCount: 7, reason: 'groups-mismatch' });
    expect(judge(withGroups([['a', three], ['b', fourAway]]), q)).toEqual({ matched: false, benchCount: 7, reason: 'not-merged' });
    expect(judge(withGroups([['a', three]]), q)).toEqual({ matched: false, benchCount: 3, reason: 'count-mismatch' });
  });
});
