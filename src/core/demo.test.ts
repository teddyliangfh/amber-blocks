import {
  benchCount,
  cell,
  commit,
  createBenchState,
  createHistory,
  defineGroup,
  groupId,
  judge,
  mergedGroup,
  template,
  undo,
  unitIds,
} from './index';
import type { BenchState, Cell, Command, Group, History, Question } from './index';

// Replays the playable slice with nothing but committed commands: four stations,
// then the 3 + 4 sample. Every station starts from fresh material (AC-47).
const bounds = { cols: 6, rows: 5 };

function station(count: number): History {
  return createHistory(createBenchState({ units: unitIds('s', count).map((id) => ({ id, hue: 'red' })), bounds }));
}

function play(h: History, cmds: ReadonlyArray<Command>): History {
  return cmds.reduce((acc, cmd) => {
    const r = commit(acc, cmd);
    if (!r.ok) {
      throw new Error(`${cmd.type} rejected: ${r.reason}`);
    }
    return r.value;
  }, h);
}

function matched(state: BenchState, q: Question): boolean {
  return judge(state, q).matched;
}

describe('playable slice via the public API', () => {
  test('station 1: wake one partner (quantity 1)', () => {
    const ids = unitIds('s', 1);
    const h = play(station(1), [{ type: 'take', unitId: ids[0]!, to: cell(2, 2) }]);
    expect(judge(h.state, { kind: 'quantity', target: 1 })).toEqual({ matched: true, benchCount: 1, reason: 'matched' });
  });

  test('station 2: find two partners, apart is fine (quantity 2)', () => {
    const ids = unitIds('s', 2);
    const h = play(station(2), [
      { type: 'take', unitId: ids[0]!, to: cell(0, 0) },
      { type: 'take', unitId: ids[1]!, to: cell(5, 4) },
    ]);
    expect(matched(h.state, { kind: 'quantity', target: 2 })).toBe(true);
  });

  test('station 3: four as a small square (quantity_shape 2x2), fixed from a row', () => {
    const ids = unitIds('s', 4);
    const q: Question = { kind: 'quantity_shape', target: 4, template: template([cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)]) };
    let h = play(station(4), [
      { type: 'take', unitId: ids[0]!, to: cell(1, 1) },
      { type: 'take', unitId: ids[1]!, to: cell(2, 1) },
      { type: 'take', unitId: ids[2]!, to: cell(3, 1) },
      { type: 'take', unitId: ids[3]!, to: cell(4, 1) },
    ]);
    expect(judge(h.state, q)).toEqual({ matched: false, benchCount: 4, reason: 'shape-mismatch' });
    h = play(h, [
      { type: 'move', unitId: ids[2]!, to: cell(1, 2) },
      { type: 'move', unitId: ids[3]!, to: cell(2, 2) },
    ]);
    expect(matched(h.state, q)).toBe(true);
    // Undo one move: an L of three plus a lone block, so not even one cluster.
    const u = undo(h);
    expect(u.ok && judge(u.value.state, q).reason).toBe('not-one-cluster');
  });

  test('station 4 boss: the corner team in a rotated pose (quantity_shape corner)', () => {
    const ids = unitIds('s', 3);
    const corner = template([cell(0, 0), cell(0, 1), cell(1, 1)]);
    const h = play(station(3), [
      { type: 'take', unitId: ids[0]!, to: cell(4, 3) },
      { type: 'take', unitId: ids[1]!, to: cell(5, 3) },
      { type: 'take', unitId: ids[2]!, to: cell(5, 2) },
    ]);
    expect(matched(h.state, { kind: 'quantity_shape', target: 3, template: corner })).toBe(true);
    expect(matched(h.state, { kind: 'quantity', target: 3 })).toBe(true);
  });

  test('after the boss: 3 + 4 = 7 from a tray of real partners [5, 3, 2, 4]', () => {
    const q: Question = { kind: 'addition_exact', operands: [3, 4] };
    // 14 units dealt into four partners, in the shuffled tray order of the playable slice.
    const ids = unitIds('s', 14);
    const material = createBenchState({ units: ids.map((id) => ({ id, hue: 'red' })), bounds: { cols: 8, rows: 6 } });
    const partners: ReadonlyArray<readonly [string, number, ReadonlyArray<Cell>]> = [
      ['five', 5, [cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0), cell(4, 0)]],
      ['three', 3, [cell(0, 0), cell(0, 1), cell(1, 1)]],
      ['two', 2, [cell(0, 0), cell(1, 0)]],
      ['four', 4, [cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)]],
    ];
    let state = material;
    let next = 0;
    for (const [name, size, shape] of partners) {
      const r = defineGroup(state, groupId(name), ids.slice(next, next + size), shape);
      if (!r.ok) {
        throw new Error(r.reason);
      }
      state = r.value;
      next += size;
    }
    let h = createHistory(state);

    // Wrong pair first: 5 and 2 really make 7, but this question asks for 3 and 4.
    h = play(h, [
      { type: 'takeGroup', groupId: groupId('five'), origin: cell(0, 0) },
      { type: 'takeGroup', groupId: groupId('two'), origin: cell(0, 1) },
    ]);
    expect(judge(h.state, q)).toEqual({ matched: false, benchCount: 7, reason: 'groups-mismatch' });
    expect(matched(h.state, { kind: 'sum_composition', sum: 7, allowed: [[3, 4], [5, 2]] })).toBe(true);

    // Put them back, bring out 3 and 4, apart at first, then joined.
    h = play(h, [
      { type: 'returnGroup', groupId: groupId('five') },
      { type: 'returnGroup', groupId: groupId('two') },
      { type: 'takeGroup', groupId: groupId('three'), origin: cell(0, 0) },
      { type: 'takeGroup', groupId: groupId('four'), origin: cell(3, 0) },
    ]);
    expect(judge(h.state, q)).toEqual({ matched: false, benchCount: 7, reason: 'not-merged' });
    h = play(h, [{ type: 'moveGroup', groupId: groupId('four'), delta: cell(-1, 0) }]);
    expect(judge(h.state, q)).toEqual({ matched: true, benchCount: 7, reason: 'matched' });

    const three = h.state.groups.get(groupId('three')) as Group;
    const four = h.state.groups.get(groupId('four')) as Group;
    const seven = mergedGroup(h.state, three, four);
    expect(seven?.unitIds).toHaveLength(7);
    expect(seven?.source).toEqual([groupId('three'), groupId('four')]);
    expect(benchCount(h.state)).toBe(7);
    expect(h.state.tray.filter((slot) => slot.unitId !== null)).toHaveLength(7);
  });
});
