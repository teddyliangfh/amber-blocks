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

describe('split (Phase 22, Take-away Island)', () => {
  const q = { kind: 'split', total: 3, parts: 2 } as const;
  const row3: ReadonlyArray<readonly [number, number]> = [[0, 0], [1, 0], [2, 0]];

  test('three in a row is one part; one pulled away makes two, whatever their sizes; three apart is three', () => {
    expect(judge(build(row3), q)).toEqual({ matched: false, benchCount: 3, reason: 'parts-mismatch' });
    expect(judge(build([[0, 0], [1, 0], [3, 0]]), q)).toEqual({ matched: true, benchCount: 3, reason: 'matched' });
    expect(judge(build([[0, 0], [2, 0], [3, 0]]), q)).toEqual({ matched: true, benchCount: 3, reason: 'matched' });
    // Pulled down a row and over: touching only by a corner is apart.
    expect(judge(build([[0, 0], [1, 0], [2, 1]]), q).matched).toBe(true);
    expect(judge(build([[0, 0], [2, 0], [4, 0]]), q)).toEqual({ matched: false, benchCount: 3, reason: 'parts-mismatch' });
  });

  test('the count comes first: one sent back to the tray, or one too many, is count-mismatch, not a split', () => {
    expect(judge(build([[0, 0], [2, 0]]), q)).toEqual({ matched: false, benchCount: 2, reason: 'count-mismatch' });
    expect(judge(build([[0, 0], [1, 0], [3, 0], [4, 0]]), q)).toEqual({ matched: false, benchCount: 4, reason: 'count-mismatch' });
    expect(judge(build([]), q)).toEqual({ matched: false, benchCount: 0, reason: 'count-mismatch' });
  });

  test('colour and arrangement within a part are irrelevant; parts can be any number', () => {
    const mixed = build([[0, 0], [1, 0], [3, 0]], ['red', 'blue', 'green']);
    expect(judge(mixed, q).matched).toBe(true);
    const stacked = build([[0, 0], [0, 1], [3, 3]]);
    expect(judge(stacked, q).matched).toBe(true);
    expect(judge(build([[0, 0], [2, 0], [4, 0]]), { kind: 'split', total: 3, parts: 3 }).matched).toBe(true);
    expect(judge(build(row3), { kind: 'split', total: 3, parts: 1 }).matched).toBe(true);
  });

  test('a split already made (except) is right but not again, in either order; another split still counts', () => {
    const five = { kind: 'split', total: 5, parts: 2, except: [[1, 4]] } as const;
    const oneFour = build([[0, 0], [1, 0], [2, 0], [3, 0], [0, 2]]);
    expect(judge(oneFour, five)).toEqual({ matched: false, benchCount: 5, reason: 'split-used' });
    const fourOne = build([[4, 0], [0, 2], [1, 2], [2, 2], [3, 2]]);
    expect(judge(fourOne, five).reason).toBe('split-used');
    const twoThree = build([[0, 0], [1, 0], [3, 0], [4, 0], [4, 1]]);
    expect(judge(twoThree, five)).toEqual({ matched: true, benchCount: 5, reason: 'matched' });
    expect(judge(twoThree, { ...five, except: [[1, 4], [3, 2]] }).reason).toBe('split-used');
    // Without `except` the same split is simply right.
    expect(judge(oneFour, { kind: 'split', total: 5, parts: 2 }).matched).toBe(true);
    // Three parts with one used: parts come first.
    expect(judge(build([[0, 0], [2, 0], [4, 0], [0, 2], [2, 2]]), five).reason).toBe('parts-mismatch');
  });
});

describe('compare and order (Phase 23c, Compare Island)', () => {
  function partners(groups: ReadonlyArray<ReadonlyArray<readonly [number, number]>>, loose: ReadonlyArray<readonly [number, number]> = []): BenchState {
    const total = groups.reduce((n, cells) => n + cells.length, 0) + loose.length;
    const all = unitIds('p', total);
    let state = createBenchState({ units: all.map((id) => ({ id, hue: 'red' })), bounds: { cols: 9, rows: 3 } });
    let next = 0;
    groups.forEach((cells, k) => {
      const members = all.slice(next, next + cells.length);
      state = run(state, cells.map(([x, y], i) => ({ type: 'take', unitId: members[i] as never, to: cell(x, y) })));
      const r = defineGroup(state, groupId(`g${k}`), members);
      if (!r.ok) {
        throw new Error(r.reason);
      }
      state = r.value;
      next += cells.length;
    });
    return run(state, loose.map(([x, y], i) => ({ type: 'take', unitId: all[next + i] as never, to: cell(x, y) })));
  }
  const row = (from: number, n: number, y = 0): ReadonlyArray<readonly [number, number]> => Array.from({ length: n }, (_, i) => [from + i, y] as const);

  test('compare counts only how many: same, more, fewer, one more, one fewer', () => {
    const cases = [
      ['same', 3, [false, false, true, false, false]],
      ['more', 2, [false, false, true, true, true]],
      ['fewer', 4, [true, true, true, false, false]],
      ['one_more', 3, [false, false, false, true, false]],
      ['one_fewer', 5, [false, false, false, true, false]],
    ] as const;
    for (const [relation, given, expected] of cases) {
      const got = [1, 2, 3, 4, 5].map((n) => judge(build(row(0, n)), { kind: 'compare', given, relation }).matched);
      expect(`${relation} ${got}`).toBe(`${relation} ${expected}`);
    }
    // Wrong is count-mismatch, with the real count for the UI to say which way.
    expect(judge(build(row(0, 4)), { kind: 'compare', given: 3, relation: 'same' })).toEqual({ matched: false, benchCount: 4, reason: 'count-mismatch' });
  });

  test('compare: not the shape, not which partners; an empty bench is never "fewer"', () => {
    expect(judge(build(scattered4), { kind: 'compare', given: 4, relation: 'same' }).matched).toBe(true);
    // 1 + 2 is the same as 3; 2 + 5 is more than 3 (design §9 #9).
    expect(judge(partners([row(0, 1), row(1, 2)]), { kind: 'compare', given: 3, relation: 'same' }).matched).toBe(true);
    expect(judge(partners([row(0, 2), row(2, 5)]), { kind: 'compare', given: 3, relation: 'more' }).matched).toBe(true);
    expect(judge(build([]), { kind: 'compare', given: 4, relation: 'fewer' })).toEqual({ matched: false, benchCount: 0, reason: 'count-mismatch' });
    expect(judge(build([]), { kind: 'compare', given: 1, relation: 'one_fewer' }).matched).toBe(false);
  });

  test('order: 1, 3, 4 left to right, touching or not, in any row', () => {
    const q = { kind: 'order', sizes: [1, 3, 4] } as const;
    expect(judge(partners([row(0, 1), row(1, 3), row(4, 4)]), q)).toEqual({ matched: true, benchCount: 8, reason: 'matched' });
    expect(judge(partners([row(0, 1, 2), row(2, 3, 0), row(5, 4, 1)]), q).matched).toBe(true);
    // Dealt in any order: which group is which does not matter, only where it stands.
    expect(judge(partners([row(5, 4), row(0, 1), row(1, 3)]), q).matched).toBe(true);
  });

  test('order: the wrong way round, or stacked over the same columns, is order-mismatch', () => {
    const q = { kind: 'order', sizes: [1, 3, 4] } as const;
    expect(judge(partners([row(0, 3), row(3, 1), row(4, 4)]), q)).toEqual({ matched: false, benchCount: 8, reason: 'order-mismatch' });
    expect(judge(partners([row(0, 4), row(4, 3), row(7, 1)]), q).reason).toBe('order-mismatch');
    // The 1 above the 3: they share a column, so neither stands first.
    expect(judge(partners([row(1, 1, 0), row(0, 3, 1), row(4, 4, 1)]), q).reason).toBe('order-mismatch');
  });

  test('order: one still in the tray is count-mismatch; loose blocks or other partners are groups-mismatch', () => {
    const q = { kind: 'order', sizes: [1, 3, 4] } as const;
    expect(judge(partners([row(0, 1), row(1, 3)]), q)).toEqual({ matched: false, benchCount: 4, reason: 'count-mismatch' });
    expect(judge(partners([row(1, 3), row(4, 4)], [[0, 0]]), q).reason).toBe('groups-mismatch');
    expect(judge(partners([row(0, 2), row(2, 2), row(4, 4)]), q).reason).toBe('groups-mismatch');
  });
});
