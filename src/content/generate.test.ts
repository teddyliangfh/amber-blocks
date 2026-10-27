import { apply, cell, groupSize, judge, template } from '../core';
import type { BenchState, Command, GroupId } from '../core';
import { fitBench } from './bench';
import { STAIRS_6, TEN_2X5 } from './catalog/shapes';
import { CONTENT_VERSION } from './catalog';
import { materialize, materializeNode } from './generate';
import { onMatMaterial, partnerMaterial, presetMaterial } from './material';
import { buildSolution } from './solution';
import { benchPair, questionAt, samePair, stepCount } from './steps';
import { validate } from './validate';
import { chapterId, nodeId } from './ids';
import type { NodeSpec, PuzzleRef } from './schema';

const ref = (chapter: string, node: string, attemptVariant = 0, seed = 11): PuzzleRef => ({
  contentVersion: CONTENT_VERSION,
  chapterId: chapterId(chapter),
  nodeId: nodeId(node),
  attemptVariant,
  seed,
});

const custom = (spec: NodeSpec['spec'], role: NodeSpec['role'] = 'normal'): NodeSpec => ({ id: nodeId('x-n1'), role, spec });
const bounds = { cols: 8, rows: 6 };

function replay(initial: BenchState, solution: ReadonlyArray<Command>): BenchState {
  return solution.reduce((s, cmd) => {
    const r = apply(s, cmd);
    if (!r.ok) {
      throw new Error(r.reason);
    }
    return r.value;
  }, initial);
}

describe('materialize', () => {
  test('AC-44: the same ref gives the same puzzle, down to tray order and ids', () => {
    const a = materialize(ref('ch2', 'ch2-n7'));
    const b = materialize(ref('ch2', 'ch2-n7'));
    expect(a).toEqual(b);
    expect(a.display.partnerIds).toEqual(b.display.partnerIds);
  });

  test('AC-47: a ref from another content version is refused', () => {
    expect(() => materialize({ ...ref('ch1', 'ch1-n1'), contentVersion: CONTENT_VERSION + 1 })).toThrow(/content version/);
  });

  test('chapter 1 stops: big number, loose material, prompt key, bench empty', () => {
    const one = materialize(ref('ch1', 'ch1-n1'));
    expect(one.question).toEqual({ kind: 'quantity', target: 1 });
    expect(one.display).toEqual({ target: 1, operands: null, template: null, partnerIds: [] });
    expect(one.prompt).toBe('prompt.quantity');
    expect(one.initial.units.size).toBe(3);
    expect(one.initial.bench.size).toBe(0);
    const square = materialize(ref('ch1', 'ch1-n3'));
    expect(square.question.kind).toBe('quantity_shape');
    expect(square.display.template?.cells).toHaveLength(4);
    expect(square.prompt).toBe('prompt.quantity_shape');
  });

  test('an exact join (the 3 + 4 boss up to content version 5): real partners 3, 4, 5, 2 in a shuffled tray', () => {
    // ch2-n7 starts with the 3 on the mat since Phase 19; the exact join it used to be is dealt from its old spec.
    const p = materializeNode(custom({ kind: 'addition_exact', pairs: [[3, 4]], distractors: [5, 2] }, 'boss'), { cols: 8, rows: 3 }, ref('ch2', 'ch2-n7'));
    expect(p.question).toEqual({ kind: 'addition_exact', operands: [3, 4] });
    expect(p.display.operands).toEqual([3, 4]);
    expect(p.display.target).toBeNull();
    const sizes = p.display.partnerIds.map((id) => groupSize(p.initial.groups.get(id)!));
    expect([...sizes].sort()).toEqual([2, 3, 4, 5]);
    expect(p.prompt).toBe('prompt.addition_exact');
    const orders = [0, 1, 2, 3, 4].map((v) => materialize(ref('ch2', 'ch2-n1', v)).display.partnerIds.map((id) => groupSize(materialize(ref('ch2', 'ch2-n1', v)).initial.groups.get(id)!)).join());
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  test('recent targets steer the envelope when the pool allows', () => {
    const node = custom({ kind: 'quantity', targets: [1, 2, 4, 6, 9], extra: 2 });
    for (let seed = 0; seed < 20; seed += 1) {
      const p = materializeNode(node, bounds, { ...ref('ch1', 'x-n1', 0, seed) }, [6, 9]);
      expect([1, 2, 4]).toContain(p.question.kind === 'quantity' ? p.question.target : -1);
    }
  });

  test('AC-44: 2 + 2 produces two distinct partners of two, and the reference solution passes', () => {
    const p = materializeNode(custom({ kind: 'addition_exact', pairs: [[2, 2]], distractors: [3] }), bounds, ref('ch2', 'x-n1'));
    const twos = [...p.initial.groups.values()].filter((g) => groupSize(g) === 2);
    expect(twos).toHaveLength(2);
    expect(twos[0]!.id).not.toBe(twos[1]!.id);
    expect(judge(replay(p.initial, p.solution), p.question).matched).toBe(true);
  });

  test('AC-45: a free sum of 7 offers both splits and the solution uses an allowed one', () => {
    const p = materializeNode(custom({ kind: 'sum_composition', sum: 7, allowed: [[3, 4], [5, 2]], distractors: [6] }), bounds, ref('ch2', 'x-n1'));
    expect(p.display.target).toBe(7);
    expect(p.prompt).toBe('prompt.sum_composition');
    const sizes = [...p.initial.groups.values()].map(groupSize).sort();
    expect(sizes).toEqual([2, 3, 4, 5, 6]);
    expect(judge(replay(p.initial, p.solution), p.question).matched).toBe(true);
  });

  test('AC-46: a stop with handles deals the target as partners, a decoy partner and spare loose blocks', () => {
    const p = materialize(ref('ch1', 'ch1-n12'));
    expect(p.question).toEqual({ kind: 'quantity', target: 17 });
    expect(p.initial.units.size).toBe(23);
    expect([...p.initial.groups.values()].map(groupSize).sort((a, b) => a - b)).toEqual([2, 4, 5, 10]);
    expect(p.display.partnerIds).toHaveLength(4);
    const solved = replay(p.initial, p.solution);
    expect(judge(solved, p.question)).toEqual({ matched: true, benchCount: 17, reason: 'matched' });
    // The reference answer leaves the decoy 4 in the tray.
    const four = [...p.initial.groups.values()].find((g) => groupSize(g) === 4)!;
    expect(four.unitIds.some((u) => solved.bench.has(u))).toBe(false);
    // Spares are coloured as ones, not in the near-white of 10 that read as an empty slot.
    const inGroup = new Set([...p.initial.groups.values()].flatMap((g) => g.unitIds));
    expect([...p.initial.units.values()].filter((u) => !inGroup.has(u.id)).map((u) => u.hue)).toEqual(['n1', 'n1']);
    expect(() => materializeNode(custom({ kind: 'quantity', targets: [10], extra: 1, handles: [5, 5] }), bounds, ref('ch1', 'x-n1'))).toThrow(/at least one decoy/);
    // The reference answer picks partners that add up exactly (5 + 5 + 4 = 14); none do for 13.
    const ten = materialize(ref('ch1', 'ch1-n10'));
    expect(judge(replay(ten.initial, buildSolution({ kind: 'quantity', target: 14 }, ten.initial)), { kind: 'quantity', target: 14 }).matched).toBe(true);
    expect(() => buildSolution({ kind: 'quantity', target: 13 }, ten.initial)).toThrow(/no partners add up to 13/);
    expect(() => materializeNode(custom({ kind: 'quantity', targets: [3], extra: 1, decoys: [2] }), bounds, ref('ch1', 'x-n1'))).toThrow(/decoys come with handles/);
    expect(() => materializeNode(custom({ kind: 'quantity', targets: [9], extra: 1, handles: [5, 5] }), bounds, ref('ch1', 'x-n1'))).toThrow(/do not add up/);
    expect(() => materializeNode(custom({ kind: 'quantity', targets: [5, 5], extra: 1, handles: [5] }), bounds, ref('ch1', 'x-n1'))).toThrow(/single-target/);
    expect(() => materializeNode(custom({ kind: 'quantity', targets: [5], extra: 0, handles: [5] }), bounds, ref('ch1', 'x-n1'))).toThrow(/extra must be at least 1/);
    expect(() => materializeNode(custom({ kind: 'quantity', targets: [10], extra: 1, handles: [5, 5] }), { cols: 4, rows: 4 }, ref('ch1', 'x-n1'))).toThrow(/does not fit/);
  });

  test('2026-10-15: handles that leave part of the target to single blocks (5 = a 3 + two singles)', () => {
    const p = materializeNode(custom({ kind: 'quantity', targets: [5], extra: 2, handles: [3] }), bounds, ref('ch1', 'x-n1'));
    expect([...p.initial.groups.values()].map(groupSize)).toEqual([3]);
    // Two singles finish the 5 and two are spare, all coloured as ones.
    const inGroup = new Set([...p.initial.groups.values()].flatMap((g) => g.unitIds));
    expect([...p.initial.units.values()].filter((u) => !inGroup.has(u.id)).map((u) => u.hue)).toEqual(['n1', 'n1', 'n1', 'n1']);
    expect(p.solution.map((c) => c.type)).toEqual(['takeGroup', 'take', 'take']);
    expect(judge(replay(p.initial, p.solution), p.question)).toEqual({ matched: true, benchCount: 5, reason: 'matched' });
    // No decoy needed when the partners alone fall short.
    expect(() => materializeNode(custom({ kind: 'quantity', targets: [5], extra: 1, handles: [3] }), bounds, ref('ch1', 'x-n1'))).not.toThrow();
  });

  test('2026-10-15: a shape built from partners (the 8 brick from two 4s), with a decoy', () => {
    const brick = template([cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0), cell(0, 1), cell(1, 1), cell(2, 1), cell(3, 1)]);
    const p = materializeNode(custom({ kind: 'quantity_shape', target: 8, templates: [brick], extra: 1, handles: [4, 4], decoys: [3] }), bounds, ref('ch1', 'x-n1'));
    expect([...p.initial.groups.values()].map(groupSize).sort()).toEqual([3, 4, 4]);
    expect(p.solution.map((c) => c.type)).toEqual(['takeGroup', 'takeGroup']);
    expect(judge(replay(p.initial, p.solution), p.question).matched).toBe(true);
    expect(() => materializeNode(custom({ kind: 'quantity_shape', target: 8, templates: [brick], extra: 1, handles: [4, 3], decoys: [2] }), bounds, ref('ch1', 'x-n1'))).toThrow(/no partners add up to 8/);
    expect(() => validate(p, { kind: 'quantity_shape', target: 8, templates: [brick], extra: 1, handles: [4, 3], decoys: [3] })).toThrow(/handles must make 8, not 7/);
    expect(() => materializeNode(custom({ kind: 'quantity_shape', target: 8, templates: [brick], extra: 1, handles: [4, 4] }), bounds, ref('ch1', 'x-n1'))).toThrow(/at least one decoy/);
    expect(() => materializeNode(custom({ kind: 'quantity_shape', target: 4, templates: [template([cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)])], extra: 1, decoys: [2] }), bounds, ref('ch1', 'x-n1'))).toThrow(/decoys come with handles/);
  });

  test('2026-10-15: a sequence asks every picture in order on the same blocks; the answer passes each on the way', () => {
    const square = template([cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)]);
    const line = template([cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0)]);
    const spec = { kind: 'quantity_shape', target: 4, templates: [square, line], extra: 2, sequence: true } as const;
    const p = materializeNode(custom(spec), bounds, ref('ch1', 'x-n1'));
    expect(p.steps).toHaveLength(2);
    expect(p.question).toEqual(p.steps![0]);
    // Four blocks into the square, then two of them move to finish the line.
    expect(p.solution.map((c) => c.type)).toEqual(['take', 'take', 'take', 'take', 'move', 'move']);
    const square4 = replay(p.initial, p.solution.slice(0, 4));
    expect(judge(square4, p.steps![0]!).matched).toBe(true);
    expect(judge(replay(p.initial, p.solution), p.steps![1]!).matched).toBe(true);
    // Every variant deals the same pictures in the same order.
    expect(materializeNode(custom(spec), bounds, ref('ch1', 'x-n1', 3)).steps).toEqual(p.steps);
    // A sequence of one, or steps without a sequence, is a content bug.
    expect(() => materializeNode(custom({ ...spec, templates: [square] }), bounds, ref('ch1', 'x-n1'))).toThrow(/at least two/);
    expect(() => validate(p, { kind: 'quantity_shape', target: 4, templates: [square, line], extra: 2 })).toThrow(/steps come from a sequence/);
    // An answer that skips the first picture does not count.
    expect(() => validate({ ...p, solution: line.cells.map((to, i) => ({ type: 'take', unitId: [...p.initial.units.keys()][i]!, to })) }, spec)).toThrow(/a step was skipped/);
  });

  test('mirror off: the reference solution for an L is the L itself, and a J would not pass', () => {
    const L = template([cell(0, 0), cell(0, 1), cell(0, 2), cell(1, 2)]);
    const p = materializeNode(custom({ kind: 'quantity_shape', target: 4, templates: [L], symmetry: { rotation: true, mirror: false }, extra: 1 }), bounds, ref('ch1', 'x-n1'));
    const solved = replay(p.initial, p.solution);
    expect(judge(solved, p.question).matched).toBe(true);
    expect([...solved.bench.values()]).toEqual(L.cells);
    const jCells = [cell(1, 0), cell(1, 1), cell(1, 2), cell(0, 2)];
    const asJ = p.solution.map((cmd, i) => (cmd.type === 'take' ? { ...cmd, to: jCells[i]! } : cmd));
    expect(judge(replay(p.initial, asJ), p.question).matched).toBe(false);
  });

  test('content bugs throw instead of reaching a child', () => {
    expect(() => materializeNode(custom({ kind: 'quantity', targets: [3], extra: 0 }), bounds, ref('ch1', 'x-n1'))).toThrow(/extra must be at least 1/);
    const wide = template([cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0), cell(4, 0), cell(5, 0), cell(6, 0), cell(7, 0), cell(8, 0)]);
    expect(() => materializeNode(custom({ kind: 'quantity_shape', target: 9, templates: [wide], extra: 1 }), bounds, ref('ch1', 'x-n1'))).toThrow(/does not fit/);
    const three = template([cell(0, 0), cell(1, 0), cell(2, 0)]);
    expect(() => materializeNode(custom({ kind: 'quantity_shape', target: 4, templates: [three], extra: 1 }), bounds, ref('ch1', 'x-n1'))).toThrow(/3 cells for target 4/);
    expect(() => materializeNode(custom({ kind: 'addition_exact', pairs: [[3, 4]], distractors: [4] }), bounds, ref('ch2', 'x-n1'))).toThrow(/same size as an operand/);
    expect(() => materializeNode(custom({ kind: 'addition_exact', pairs: [[6, 6]], distractors: [] }), { cols: 5, rows: 2 }, ref('ch2', 'x-n1'))).toThrow(/rejected|does not fit/);
  });
});

describe("Phase 19: who's missing (a partner already on the mat)", () => {
  const spec = { kind: 'sum_composition', sum: 5, allowed: [[2, 3]], distractors: [1, 4], given: 2 } as const;
  const mat = fitBench(spec);
  const missing = (seed = 11, v = 0) => materializeNode(custom(spec), mat, ref('ch2', 'x-n1', v, seed));

  test('the given 2 starts on the mat at the left edge; the tray deals 3, 1 and 4 and keeps a home for the 2', () => {
    const p = missing();
    const given = p.initial.groups.get(p.given!)!;
    expect(groupSize(given)).toBe(2);
    expect(p.initial.bench.size).toBe(2);
    const cells = given.unitIds.map((u) => p.initial.bench.get(u)!);
    expect(Math.min(...cells.map((c) => c.x))).toBe(0);
    // Its slots are still its home, empty: the tray keeps its outline.
    expect(given.unitIds.map((u) => p.initial.tray[p.initial.home.get(u)!]!.unitId)).toEqual([null, null]);
    const tray = [...p.initial.groups.values()].filter((g) => g.id !== given.id);
    expect(tray.map(groupSize).sort()).toEqual([1, 3, 4]);
    // Exactly one partner in the tray finishes 2 + ? = 5.
    expect(tray.filter((g) => groupSize(g) === 3)).toHaveLength(1);
    expect(p.question).toEqual({ kind: 'sum_composition', sum: 5, allowed: [[2, 3]] });
    expect(p.display.target).toBe(5);
    expect(p.display.operands).toBeNull();
    expect(p.display.partnerIds).toHaveLength(4);
    expect(p.display.partnerIds[3]).toBe(p.given);
    expect(p.prompt).toBe('prompt.missing_part');
    expect(p.ways).toBeUndefined();
  });

  test('the reference answer is one move: the 3 right beside the 2, which never moves', () => {
    const p = missing();
    expect(p.solution).toHaveLength(1);
    const [move] = p.solution;
    expect(move?.type).toBe('takeGroup');
    expect(move?.type === 'takeGroup' ? groupSize(p.initial.groups.get(move.groupId)!) : 0).toBe(3);
    const solved = replay(p.initial, p.solution);
    expect(judge(solved, p.question)).toEqual({ matched: true, benchCount: 5, reason: 'matched' });
    for (const u of p.initial.groups.get(p.given!)!.unitIds) {
      expect(solved.bench.get(u)).toEqual(p.initial.bench.get(u));
    }
    const given = [...p.initial.bench.values()];
    expect(move?.type === 'takeGroup' ? move.origin : null).toEqual({ x: 2, y: given[0]!.y });
  });

  test('the same ref deals the same stop; every seed and variant starts with the 2 on the mat and passes', () => {
    expect(missing(7, 1)).toEqual(missing(7, 1));
    const orders = new Set<string>();
    for (const seed of [1, 7, 11, 4242]) {
      for (const v of [0, 1, 2]) {
        const p = missing(seed, v);
        expect(groupSize(p.initial.groups.get(p.given!)!)).toBe(2);
        expect(judge(replay(p.initial, p.solution), p.question).matched).toBe(true);
        orders.add(p.display.partnerIds.map((id) => groupSize(p.initial.groups.get(id)!)).join());
      }
    }
    // The tray is shuffled; the given one's home is always last.
    expect(orders.size).toBeGreaterThan(1);
    expect([...orders].every((o) => o.endsWith(',2'))).toBe(true);
  });

  test('a two-row other half: the given one sits high enough for it to fit beside it', () => {
    const tall = { kind: 'sum_composition', sum: 9, allowed: [[3, 6]], distractors: [1], given: 3 } as const;
    const p = materializeNode(custom(tall), fitBench(tall), ref('ch2', 'x-n1'));
    const y = Math.min(...[...p.initial.bench.values()].map((c) => c.y));
    expect(y + 2).toBeLessThanOrEqual(p.initial.bounds.rows);
    expect(judge(replay(p.initial, p.solution), p.question).matched).toBe(true);
  });

  test('content bugs: allowed must be exactly the given and its other half; one finisher; the given alone on the mat', () => {
    const p = missing();
    expect(() => validate(p, spec)).not.toThrow();
    expect(() => validate(p, { ...spec, allowed: [[2, 3], [1, 4]] })).toThrow(/only allowed pair is 2 \+ 3/);
    expect(() => validate(p, { ...spec, allowed: [[1, 4]] })).toThrow(/only allowed pair is 2 \+ 3/);
    expect(() => materializeNode(custom({ ...spec, allowed: [[2, 3], [4, 1]] }), mat, ref('ch2', 'x-n1'))).toThrow(/content:/);
    expect(() => validate(p, { ...spec, ways: 2 })).toThrow(/ways must be/);
    expect(() => validate({ ...p, ways: 2 }, { ...spec, ways: 2 })).toThrow(/at least 2 allowed pairs/);
    expect(() => materializeNode(custom({ ...spec, given: 5, allowed: [[5, 0]] }), mat, ref('ch2', 'x-n1'))).toThrow(/leaves nothing to find/);
    expect(() => materializeNode(custom({ ...spec, distractors: [3] }), mat, ref('ch2', 'x-n1'))).toThrow(/same size as an operand/);
    // A second 3 in the tray would make the answer a guess between two.
    const twoThrees = partnerMaterial([3, 3, 2], mat, 't');
    const two = twoThrees.partnerIds[2]!;
    const onMat = apply(twoThrees.state, { type: 'takeGroup', groupId: two, origin: cell(0, 1) });
    if (!onMat.ok) {
      throw new Error(onMat.reason);
    }
    const doubled = { ...p, initial: onMat.value, given: two, solution: [{ type: 'takeGroup', groupId: twoThrees.partnerIds[0]!, origin: cell(2, 1) }] as const };
    expect(() => validate(doubled, { ...spec, distractors: [] })).toThrow(/2 partners in the tray finish 2 \+ \? = 5/);
    // Something else on the mat beside the given one.
    const one = [...p.initial.groups.values()].find((g) => groupSize(g) === 1)!;
    const crowded = apply(p.initial, { type: 'takeGroup', groupId: one.id, origin: cell(5, 0) });
    expect(crowded.ok && (() => validate({ ...p, initial: crowded.value }, spec))).toThrow(/must be all there is on the mat/);
    // A given partner the spec does not have, and one the puzzle lost.
    expect(() => validate(p, { kind: 'sum_composition', sum: 5, allowed: [[2, 3]], distractors: [1, 4] })).toThrow(/start in the tray/);
    expect(() => validate({ ...p, given: undefined }, spec)).toThrow(/must be all there is on the mat/);
    const square = materialize(ref('ch1', 'ch1-n3'));
    expect(() => validate({ ...square, given: p.given }, { kind: 'quantity_shape', target: 4, templates: [square.display.template!], extra: 2 })).toThrow(/comes from a sum spec/);
  });
});

describe('Phase 19: two ways to make 7 (a sum asked several ways)', () => {
  const spec = { kind: 'sum_composition', sum: 7, allowed: [[3, 4], [5, 2]], distractors: [1], ways: 2 } as const;
  const mat = fitBench(spec);
  const twoWays = (seed = 11) => materializeNode(custom(spec, 'boss'), mat, ref('ch2', 'x-n1', 0, seed));
  const sorted = (pair: ReadonlyArray<number> | null) => (pair === null ? null : [...pair].sort());

  test('one tray for both ways; the reference answer builds one, sends it back, builds the other', () => {
    const p = twoWays();
    expect(p.ways).toBe(2);
    expect(stepCount(p)).toBe(2);
    expect(p.initial.bench.size).toBe(0);
    expect([...p.initial.groups.values()].map(groupSize).sort()).toEqual([1, 2, 3, 4, 5]);
    expect(p.prompt).toBe('prompt.sum_composition');
    expect(p.solution.map((c) => c.type)).toEqual(['takeGroup', 'takeGroup', 'returnGroup', 'returnGroup', 'takeGroup', 'takeGroup']);
    const first = replay(p.initial, p.solution.slice(0, 2));
    expect(judge(first, questionAt(p, 0, [])).matched).toBe(true);
    expect(sorted(benchPair(first))).toEqual([3, 4]);
    // Once 3 + 4 is used, it is no answer to the second step; 5 + 2 is.
    expect(judge(first, questionAt(p, 1, [[3, 4]])).matched).toBe(false);
    const end = replay(p.initial, p.solution);
    expect(sorted(benchPair(end))).toEqual([2, 5]);
    expect(judge(end, questionAt(p, 1, [[4, 3]]))).toEqual({ matched: true, benchCount: 7, reason: 'matched' });
    expect(twoWays(4242)).toEqual(twoWays(4242));
  });

  test('content bugs: as many allowed pairs as ways; no other pair in the tray makes the sum; one way built twice fails', () => {
    const p = twoWays();
    expect(() => validate(p, spec)).not.toThrow();
    expect(() => validate({ ...p, ways: 3 }, { ...spec, ways: 3 })).toThrow(/3 ways to make 7 need at least 3 allowed pairs/);
    expect(() => validate(p, { ...spec, ways: 0 })).toThrow(/ways must be/);
    expect(() => validate(p, { ...spec, ways: undefined })).toThrow(/ways must be/);
    expect(() => materializeNode(custom({ ...spec, ways: 3 }), mat, ref('ch2', 'x-n1'))).toThrow(/only 2 of 3 ways/);
    expect(() => materializeNode(custom({ ...spec, distractors: [1, 6] }), mat, ref('ch2', 'x-n1'))).toThrow(/6 \+ 1 also make 7|1 \+ 6 also make 7/);
    const once = p.solution.slice(0, 2);
    expect(() => validate({ ...p, solution: [...once, p.solution[2]!, p.solution[3]!, ...once] }, spec)).toThrow(/does not pass/);
    const square = materialize(ref('ch1', 'ch1-n3'));
    expect(() => validate({ ...square, ways: 2 }, { kind: 'quantity_shape', target: 4, templates: [square.display.template!], extra: 2 })).toThrow(/ways come from a sum/);
  });
});

describe('steps (shared by validate and the level session)', () => {
  test('pairs match in either order; a sequence and a one-question stop ignore used pairs', () => {
    expect(samePair([3, 4], [4, 3])).toBe(true);
    expect(samePair([3, 4], [3, 4])).toBe(true);
    expect(samePair([3, 4], [5, 2])).toBe(false);
    const four = materialize(ref('ch1', 'ch1-n6'));
    expect(questionAt(four, 1, [[1, 1]])).toBe(four.steps![1]);
    const one = materialize(ref('ch1', 'ch1-n1'));
    expect(questionAt(one, 0, [[1, 1]])).toBe(one.question);
    expect(stepCount(one)).toBe(1);
    expect(stepCount(four)).toBe(2);
    expect(benchPair(one.initial)).toBeNull();
  });
});

describe('Phase 21: send the extra away (partners already on the mat)', () => {
  const spec = { kind: 'sum_composition', sum: 7, onMat: [3, 4, 2], allowed: [[3, 4]], distractors: [] } as const;
  const mat = fitBench(spec);
  const away = (seed = 11, v = 0) => materializeNode(custom(spec), mat, ref('ch2', 'x-n1', v, seed));
  const cellsOf = (p: ReturnType<typeof away>, id: GroupId) => p.initial.groups.get(id)!.unitIds.map((u) => p.initial.bench.get(u)!);

  test('3, 4 and 2 start joined in one row from the left edge, in the middle of the mat; each keeps a home in the tray', () => {
    expect(mat).toEqual({ cols: 9, rows: 3 });
    const p = away();
    expect(p.onMat).toHaveLength(3);
    expect(p.onMat!.map((id) => groupSize(p.initial.groups.get(id)!))).toEqual([3, 4, 2]);
    expect(p.initial.bench.size).toBe(9);
    // Left to right, touching, on the middle row of three.
    const xs = p.onMat!.map((id) => cellsOf(p, id).map((c) => c.x));
    expect(xs).toEqual([[0, 1, 2], [3, 4, 5, 6], [7, 8]]);
    expect(new Set([...p.initial.bench.values()].map((c) => c.y))).toEqual(new Set([1]));
    // Their slots are still their home, empty: the tray keeps three outlines.
    for (const id of p.onMat!) {
      expect(p.initial.groups.get(id)!.unitIds.map((u) => p.initial.tray[p.initial.home.get(u)!]!.unitId).every((x) => x === null)).toBe(true);
    }
    expect(p.display.partnerIds).toEqual(p.onMat);
    expect(p.question).toEqual({ kind: 'sum_composition', sum: 7, allowed: [[3, 4]] });
    expect(p.display.target).toBe(7);
    expect(p.prompt).toBe('prompt.send_away');
    expect(p.given).toBeUndefined();
    expect(p.ways).toBeUndefined();
    expect(away(4242, 2)).toEqual(away(4242, 2));
  });

  test('the reference answer is one move: the 2 goes back; 3 + 4 stay where they are, joined', () => {
    const p = away();
    expect(p.solution).toEqual([{ type: 'returnGroup', groupId: p.onMat![2] }]);
    const solved = replay(p.initial, p.solution);
    expect(judge(solved, p.question)).toEqual({ matched: true, benchCount: 7, reason: 'matched' });
    expect(judge(p.initial, p.question)).toEqual({ matched: false, benchCount: 9, reason: 'count-mismatch' });
    for (const id of p.onMat!.slice(0, 2)) {
      for (const u of p.initial.groups.get(id)!.unitIds) {
        expect(solved.bench.get(u)).toEqual(p.initial.bench.get(u));
      }
    }
    // An extra at the left end goes back the same way, and a tray partner stays.
    const left = { kind: 'sum_composition', sum: 6, onMat: [1, 2, 4], allowed: [[2, 4]], distractors: [3] } as const;
    const q = materializeNode(custom(left), fitBench(left), ref('ch2', 'x-n1'));
    expect(q.solution).toEqual([{ type: 'returnGroup', groupId: q.onMat![0] }]);
    expect(judge(replay(q.initial, q.solution), q.question).matched).toBe(true);
    expect(q.display.partnerIds).toHaveLength(4);
    expect(q.display.partnerIds.slice(1)).toEqual(q.onMat);
  });

  test('content bugs: not more than the sum, other pairs, a middle extra, two ways to send back, mixing with given or ways', () => {
    const p = away();
    expect(() => validate(p, spec)).not.toThrow();
    expect(() => materializeNode(custom({ ...spec, onMat: [3, 4] }), mat, ref('ch2', 'x-n1'))).toThrow(/not more than 7/);
    expect(() => materializeNode(custom({ ...spec, allowed: [[3, 4], [4, 3]] }), mat, ref('ch2', 'x-n1'))).toThrow(/one allowed pair/);
    // A tray partner that makes the sum with one on the mat.
    expect(() => materializeNode(custom({ kind: 'sum_composition', sum: 6, onMat: [1, 2, 4], allowed: [[2, 4]], distractors: [5] }), mat, ref('ch2', 'x-n1'))).toThrow(/5 \+ 1 also make 6|1 \+ 5 also make 6/);
    // The 2 in the middle: after sending it back, 3 and 4 would still have to be pushed together.
    expect(() => materializeNode(custom({ ...spec, onMat: [3, 2, 4] }), mat, ref('ch2', 'x-n1'))).toThrow(/not next to each other/);
    // Two 4s: which one goes back is a guess.
    expect(() => materializeNode(custom({ ...spec, onMat: [4, 3, 4] }), { cols: 11, rows: 3 }, ref('ch2', 'x-n1'))).toThrow(/2 pairs on the mat make 7/);
    // The pair that makes the sum must be the allowed one.
    expect(() => materializeNode(custom({ ...spec, onMat: [5, 2, 3], allowed: [[2, 3]] }), { cols: 11, rows: 3 }, ref('ch2', 'x-n1'))).toThrow(/5 \+ 2 on the mat is not the allowed 2 \+ 3/);
    expect(() => materializeNode(custom({ ...spec, onMat: [5, 2, 1] }), mat, ref('ch2', 'x-n1'))).toThrow(/no allowed pair for 7 is on the mat/);
    // A tray partner that makes 7 with one on the mat: another way to get there.
    expect(() => materializeNode(custom({ ...spec, distractors: [5] }), mat, ref('ch2', 'x-n1'))).toThrow(/2 \+ 5 also make 7|5 \+ 2 also make 7/);
    expect(() => materializeNode(custom({ ...spec, distractors: [3] }), mat, ref('ch2', 'x-n1'))).toThrow(/same size as an operand/);
    expect(() => validate(p, { ...spec, given: 3 })).toThrow(/content:/);
    expect(() => validate({ ...p, ways: 2 }, { ...spec, ways: 2 })).toThrow(/content:/);
    // The row on the mat must be the puzzle's, all of it and nothing more.
    expect(() => validate({ ...p, onMat: p.onMat!.slice(0, 2) }, spec)).toThrow(/all there is on the mat/);
    const back = apply(p.initial, { type: 'returnGroup', groupId: p.onMat![2]! });
    expect(back.ok && (() => validate({ ...p, initial: back.value }, spec))).toThrow(/all there is on the mat/);
    // Partners on the mat the spec does not have.
    expect(() => validate(p, { kind: 'sum_composition', sum: 7, allowed: [[3, 4]], distractors: [2] })).toThrow(/start in the tray|onMat/);
    const square = materialize(ref('ch1', 'ch1-n3'));
    expect(() => validate({ ...square, onMat: p.onMat }, { kind: 'quantity_shape', target: 4, templates: [square.display.template!], extra: 2 })).toThrow(/come from a sum or take-away spec/);
  });

  test('a row that is not joined is refused', () => {
    const p = away();
    // The 2 a row up: diagonal to the 4, not touching it.
    const moved = apply(p.initial, { type: 'moveGroup', groupId: p.onMat![2]!, delta: cell(0, -1) });
    expect(moved.ok && (() => validate({ ...p, initial: moved.value }, spec))).toThrow(/one joined row/);
  });
});

describe('Phase 21: ten as two rows of five, and stairs of 1, 2 and 3', () => {
  const ten = { kind: 'quantity_shape', target: 10, templates: [TEN_2X5], extra: 1, handles: [5, 5], decoys: [4] } as const;
  const stairs = { kind: 'quantity_shape', target: 6, templates: [STAIRS_6], extra: 1, handles: [1, 2, 3], decoys: [4] } as const;
  const build = (s: typeof ten | typeof stairs, seed = 11) => materializeNode(custom(s), fitBench(s), ref('ch1', 'x-n1', 0, seed));
  // A state with exactly these cells on the mat, as loose blocks.
  const looseAt = (p: ReturnType<typeof build>, cells: ReadonlyArray<{ x: number; y: number }>): BenchState => {
    const inGroup = new Set([...p.initial.groups.values()].flatMap((g) => g.unitIds));
    const units = [...p.initial.units.keys()].filter((u) => !inGroup.has(u));
    const ids = [...p.initial.groups.values()].flatMap((g) => g.unitIds);
    const all = [...units, ...ids].slice(0, cells.length);
    const groups = new Map([...p.initial.groups].filter(([, g]) => !g.unitIds.some((u) => all.includes(u))));
    return { ...p.initial, groups, bench: new Map(all.map((u, i) => [u, cell(cells[i]!.x, cells[i]!.y)])), tray: p.initial.tray.map((t) => (t.unitId !== null && all.includes(t.unitId) ? { ...t, unitId: null } : t)) };
  };

  test('the templates: 5 + 5 in two rows, and left-aligned stairs 1 / 2 / 3', () => {
    expect(TEN_2X5.cells).toHaveLength(10);
    expect(STAIRS_6.cells).toHaveLength(6);
    expect(new Set(TEN_2X5.cells.map((c) => c.y))).toEqual(new Set([0, 1]));
    expect([0, 1, 2].map((y) => STAIRS_6.cells.filter((c) => c.y === y).map((c) => c.x))).toEqual([[0], [0, 1], [0, 1, 2]]);
  });

  test.each([1, 7, 4242])('the reference answers build both from their partners, leaving the decoy (seed %i)', (seed) => {
    for (const s of [ten, stairs]) {
      const p = build(s, seed);
      expect(p.solution.every((c) => c.type === 'takeGroup')).toBe(true);
      const solved = replay(p.initial, p.solution);
      expect(judge(solved, p.question).matched).toBe(true);
      const four = [...p.initial.groups.values()].find((g) => groupSize(g) === 4)!;
      expect(four.unitIds.some((u) => solved.bench.has(u))).toBe(false);
    }
    // The stairs take one partner a step: the 1 on top, the 2, then the 3.
    const p = build(stairs, seed);
    const sizes = p.solution.map((c) => (c.type === 'takeGroup' ? groupSize(p.initial.groups.get(c.groupId)!) : 0));
    expect(sizes).toEqual([1, 2, 3]);
  });

  test('turned shapes are right too; one block short, one too many or apart is not', () => {
    const p = build(stairs);
    // Right-aligned stairs are the left ones turned a quarter: built from the three partners.
    const right = replay(p.initial, [1, 2, 3].map((n, i) => {
      const g = [...p.initial.groups.values()].find((x) => groupSize(x) === n)!;
      return { type: 'takeGroup', groupId: g.id, origin: cell(3 - n, i) } as Command;
    }));
    expect(judge(right, p.question).matched).toBe(true);
    const upsideDown = looseAt(p, [cell(0, 0), cell(1, 0), cell(2, 0), cell(0, 1), cell(1, 1), cell(0, 2)]);
    expect(judge(upsideDown, p.question).matched).toBe(true);
    expect(judge(looseAt(p, [cell(0, 0), cell(0, 1), cell(1, 1), cell(0, 2), cell(1, 2)]), p.question).reason).toBe('count-mismatch');
    expect(judge(looseAt(p, [cell(0, 0), cell(0, 1), cell(1, 1), cell(0, 2), cell(1, 2), cell(2, 2), cell(3, 2)]), p.question).reason).toBe('count-mismatch');
    expect(judge(looseAt(p, [cell(0, 0), cell(0, 1), cell(1, 1), cell(0, 3), cell(1, 3), cell(2, 3)]), p.question).reason).toBe('not-one-cluster');
    // The 1 not over the end of the 2 is no staircase.
    expect(judge(looseAt(p, [cell(1, 0), cell(0, 1), cell(1, 1), cell(0, 2), cell(1, 2), cell(2, 2)]), p.question).reason).toBe('shape-mismatch');

    const t = build(ten);
    const tall = looseAt(t, Array.from({ length: 10 }, (_, i) => cell(i % 2, Math.floor(i / 2))));
    expect(judge(tall, t.question).matched).toBe(true);
    expect(judge(looseAt(t, Array.from({ length: 9 }, (_, i) => cell(i % 5, Math.floor(i / 5)))), t.question).reason).toBe('count-mismatch');
    expect(judge(looseAt(t, [...Array.from({ length: 5 }, (_, i) => cell(i, 0)), ...Array.from({ length: 5 }, (_, i) => cell(i, 2))]), t.question).reason).toBe('not-one-cluster');
    expect(judge(looseAt(t, Array.from({ length: 10 }, (_, i) => cell(i % 5 + (i >= 5 ? 1 : 0), Math.floor(i / 5)))), t.question).reason).toBe('shape-mismatch');
  });

  test('partners that add up but cannot cover the picture are no answer', () => {
    // 2 + 4 is 6, but no stairs: the solver goes on to 1 + 2 + 3.
    const groups = partnerMaterial([4, 2, 3, 1], fitBench(stairs), 's');
    const solution = buildSolution({ kind: 'quantity_shape', target: 6, template: STAIRS_6 }, groups.state);
    expect(solution.map((c) => (c.type === 'takeGroup' ? groupSize(groups.state.groups.get(c.groupId)!) : 0))).toEqual([1, 2, 3]);
    const onlyBars = partnerMaterial([4, 2], fitBench(stairs), 'b');
    expect(() => buildSolution({ kind: 'quantity_shape', target: 6, template: STAIRS_6 }, onlyBars.state)).toThrow(/cover the picture/);
  });
});

describe('Phase 21: teens (10 already on the mat)', () => {
  const spec = { kind: 'sum_composition', sum: 13, given: 10, allowed: [[10, 3]], distractors: [2, 4] } as const;

  test('the mat holds the 10 as two rows of five with room for the other half on its right; one partner finishes it', () => {
    expect(fitBench(spec)).toEqual({ cols: 9, rows: 3 });
    for (const seed of [1, 11, 4242]) {
      const p = materializeNode(custom(spec), fitBench(spec), ref('ch2', 'x-n1', 0, seed));
      const ten = p.initial.groups.get(p.given!)!;
      const cells = ten.unitIds.map((u) => p.initial.bench.get(u)!);
      expect(Math.min(...cells.map((c) => c.x))).toBe(0);
      expect(Math.max(...cells.map((c) => c.x))).toBe(4);
      expect(new Set(cells.map((c) => c.y)).size).toBe(2);
      expect([...p.initial.groups.values()].filter((g) => g.id !== ten.id && groupSize(g) === 3)).toHaveLength(1);
      expect(p.solution).toHaveLength(1);
      const [move] = p.solution;
      expect(move?.type === 'takeGroup' ? move.origin.x : -1).toBe(5);
      expect(judge(replay(p.initial, p.solution), p.question)).toEqual({ matched: true, benchCount: 13, reason: 'matched' });
    }
  });
});

describe('Phase 22: pull apart (a split, Take-away Island)', () => {
  const spec = { kind: 'split', total: 3, parts: 2 } as const;
  const mat = fitBench(spec);
  const split = (s: NodeSpec['spec'] = spec, seed = 11, v = 0) => materializeNode(custom(s), fitBench(s), ref('ch3', 'x-n1', v, seed));
  const row = (p: ReturnType<typeof split>) => [...p.initial.bench.entries()].sort(([, a], [, b]) => a.x - b.x);

  test('three blocks start joined in one row from the left, in the middle of a 4 × 3 mat; the tray keeps their beds', () => {
    expect(mat).toEqual({ cols: 4, rows: 3 });
    const p = split();
    expect(p.question).toEqual({ kind: 'split', total: 3, parts: 2 });
    expect(p.initial.units.size).toBe(3);
    expect(p.initial.groups.size).toBe(0);
    expect(row(p).map(([, c]) => [c.x, c.y])).toEqual([[0, 1], [1, 1], [2, 1]]);
    expect(p.initial.tray.map((t) => t.unitId)).toEqual([null, null, null]);
    expect([...p.initial.units.values()].every((u) => u.hue === 'n3')).toBe(true);
    expect(p.display).toEqual({ target: 3, operands: null, template: null, partnerIds: [] });
    expect(p.prompt).toBe('prompt.split');
    expect(p.ways).toBeUndefined();
    expect(p.takeAway).toBeUndefined();
    expect(split(spec, 4242, 2)).toEqual(split(spec, 4242, 2));
    // Opening: one pile, not two.
    expect(judge(p.initial, p.question)).toEqual({ matched: false, benchCount: 3, reason: 'parts-mismatch' });
  });

  test('the reference answer pulls the last block one cell to the right: 1 and 2; any other split is right too', () => {
    const p = split();
    const [last] = row(p).slice(-1);
    expect(p.solution).toEqual([{ type: 'move', unitId: last![0], to: cell(3, 1) }]);
    expect(judge(replay(p.initial, p.solution), p.question)).toEqual({ matched: true, benchCount: 3, reason: 'matched' });
    const [first] = row(p);
    const other = replay(p.initial, [{ type: 'move', unitId: first![0], to: cell(0, 0) }]);
    expect(judge(other, p.question).matched).toBe(true);
  });

  test('two ways (5): the answer makes 1 + 4, then 2 + 3 by moving one more block; the same split twice does not pass', () => {
    const five = { kind: 'split', total: 5, parts: 2, ways: 2 } as const;
    const p = split(five);
    expect(fitBench(five)).toEqual({ cols: 6, rows: 3 });
    expect(p.ways).toBe(2);
    expect(stepCount(p)).toBe(2);
    expect(p.solution.map((c) => (c.type === 'move' ? [c.to.x, c.to.y] : null))).toEqual([[5, 1], [4, 1]]);
    const one = replay(p.initial, p.solution.slice(0, 1));
    expect(benchPair(one)).toEqual([4, 1]);
    expect(questionAt(p, 1, [[4, 1]])).toEqual({ kind: 'split', total: 5, parts: 2, except: [[4, 1]] });
    expect(judge(one, questionAt(p, 1, [[4, 1]]))).toEqual({ matched: false, benchCount: 5, reason: 'split-used' });
    const two = replay(p.initial, p.solution);
    expect(benchPair(two)).toEqual([3, 2]);
    expect(judge(two, questionAt(p, 1, [[4, 1]])).matched).toBe(true);
    // Moving the pulled block back and forth is the same way: the answer does not pass.
    const again = [p.solution[0]!, { type: 'move', unitId: (p.solution[0] as unknown as { unitId: never }).unitId, to: cell(4, 0) } as Command];
    expect(() => validate({ ...p, solution: again }, five)).toThrow(/does not pass/);
  });

  test('content bugs: fewer than two blocks, not two parts, more ways than splits, blocks in the tray, partners, a broken row, a stray except', () => {
    expect(() => split({ kind: 'split', total: 1, parts: 2 })).toThrow(/at least 2 blocks/);
    expect(() => split({ kind: 'split', total: 4, parts: 3 })).toThrow(/two parts this round/);
    expect(() => split({ kind: 'split', total: 3, parts: 2, ways: 2 })).toThrow(/3 splits in two only 1 way/);
    expect(() => split({ kind: 'split', total: 4, parts: 2, ways: 0 })).toThrow(/ways must be a positive integer/);
    const p = split();
    const [last] = row(p).slice(-1);
    const back = replay(p.initial, [{ type: 'return', unitId: last![0] }]);
    expect(() => validate({ ...p, initial: back }, spec)).toThrow(/all on the mat/);
    const apart = replay(p.initial, p.solution);
    expect(() => validate({ ...p, initial: apart }, spec)).toThrow(/starts as one row/);
    expect(() => validate({ ...p, question: { ...p.question, except: [[1, 2]] } as never }, spec)).toThrow(/does not match its spec/);
    expect(() => validate({ ...p, ways: 2 }, spec)).toThrow(/ways must be a positive integer the puzzle carries/);
    expect(() => validate(p, { kind: 'quantity', targets: [3], extra: 1 })).toThrow(/must start in the tray/);
    // A split is single blocks: the partner material of 2 + 1 is not one.
    const partners = partnerMaterial([2, 1], mat, 'x');
    expect(() => validate({ ...p, initial: partners.state }, spec)).toThrow(/all on the mat/);
  });
});

describe('Phase 22: take away (blocks on the mat go home)', () => {
  const spec = { kind: 'take_away', start: 5, take: 2 } as const;
  const away = (s: NodeSpec['spec'] = spec, seed = 11, v = 0) => materializeNode(custom(s), fitBench(s), ref('ch3', 'x-n1', v, seed));
  const row = (p: ReturnType<typeof away>) => [...p.initial.bench.entries()].sort(([, a], [, b]) => a.x - b.x);

  test('5 − 2: five blocks start in a row on a 6 × 3 mat, judged as "3"; the answer sends the last two home, right to left', () => {
    expect(fitBench(spec)).toEqual({ cols: 6, rows: 3 });
    const p = away();
    expect(p.question).toEqual({ kind: 'quantity', target: 3 });
    expect(p.takeAway).toEqual({ start: 5, take: 2 });
    expect(p.steps).toBeUndefined();
    expect(p.onMat).toBeUndefined();
    expect(row(p).map(([, c]) => [c.x, c.y])).toEqual([[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]]);
    expect(p.initial.tray.every((t) => t.unitId === null)).toBe(true);
    expect(p.prompt).toBe('prompt.take_away');
    expect(p.display.target).toBe(3);
    const units = row(p).map(([u]) => u);
    expect(p.solution).toEqual([{ type: 'return', unitId: units[4] }, { type: 'return', unitId: units[3] }]);
    expect(judge(p.initial, p.question)).toEqual({ matched: false, benchCount: 5, reason: 'count-mismatch' });
    const solved = replay(p.initial, p.solution);
    expect(judge(solved, p.question).matched).toBe(true);
    // Each block goes back to its own bed.
    expect(solved.tray.map((t) => t.unitId)).toEqual([null, null, null, units[3], units[4]]);
    expect(away(spec, 4242, 2)).toEqual(away(spec, 4242, 2));
  });

  test('from partners (6 − 2 from a 4 and a 2): the row starts joined, the answer sends the 2 home; 7 − 3 from 3 + 2 + 2 sends the 3', () => {
    const six = { kind: 'take_away', start: 6, take: 2, onMat: [4, 2] } as const;
    expect(fitBench(six)).toEqual({ cols: 7, rows: 3 });
    const p = away(six);
    expect(p.onMat!.map((id) => groupSize(p.initial.groups.get(id)!))).toEqual([4, 2]);
    expect(p.display.partnerIds).toEqual(p.onMat);
    expect(p.initial.bench.size).toBe(6);
    expect(p.initial.tray.every((t) => t.unitId === null)).toBe(true);
    expect(p.prompt).toBe('prompt.take_away.partner');
    expect(p.question).toEqual({ kind: 'quantity', target: 4 });
    expect(p.solution).toEqual([{ type: 'returnGroup', groupId: p.onMat![1] }]);
    expect(judge(replay(p.initial, p.solution), p.question).matched).toBe(true);
    // Sending the 4 leaves 2: wrong, and the card says which went (hints).
    expect(judge(replay(p.initial, [{ type: 'returnGroup', groupId: p.onMat![0]! }]), p.question)).toEqual({ matched: false, benchCount: 2, reason: 'count-mismatch' });
    const seven = { kind: 'take_away', start: 7, take: 3, onMat: [3, 2, 2] } as const;
    expect(fitBench(seven)).toEqual({ cols: 8, rows: 3 });
    const q = away(seven);
    expect(q.solution).toEqual([{ type: 'returnGroup', groupId: q.onMat![0] }]);
    // The two 2s are 4 blocks: sending both leaves 3, not 4.
    const both = replay(q.initial, [{ type: 'returnGroup', groupId: q.onMat![1]! }, { type: 'returnGroup', groupId: q.onMat![2]! }]);
    expect(judge(both, q.question)).toEqual({ matched: false, benchCount: 3, reason: 'count-mismatch' });
  });

  test('a countdown (5, steps [1, 1, 1, 1]): the counts left are the steps, one block home each; the answer passes 4, 3, 2 on its way to 1', () => {
    const rocket = { kind: 'take_away', start: 5, take: 4, steps: [1, 1, 1, 1] } as const;
    const p = away(rocket);
    expect(p.steps).toEqual([{ kind: 'quantity', target: 4 }, { kind: 'quantity', target: 3 }, { kind: 'quantity', target: 2 }, { kind: 'quantity', target: 1 }]);
    expect(p.question).toEqual(p.steps![0]);
    expect(stepCount(p)).toBe(4);
    expect(p.solution.map((c) => c.type)).toEqual(['return', 'return', 'return', 'return']);
    let state = p.initial;
    p.solution.forEach((cmd, i) => {
      state = replay(state, [cmd]);
      expect(judge(state, p.steps![i]!).matched).toBe(true);
    });
    expect(state.bench.size).toBe(1);
    // Two at a time is allowed as steps too: 5, steps [2, 1] asks 3 then 2.
    const two = away({ kind: 'take_away', start: 5, take: 3, steps: [2, 1] });
    expect(two.steps!.map((q) => (q.kind === 'quantity' ? q.target : 0))).toEqual([3, 2]);
    expect(two.solution).toHaveLength(3);
  });

  test('content bugs: nothing left, blocks in the tray, partners that are not the start, two ways to take, a countdown of partners or of one step, steps that do not add up, a stray take-away', () => {
    expect(() => away({ kind: 'take_away', start: 3, take: 3 })).toThrow(/leaves nothing to count/);
    expect(() => away({ kind: 'take_away', start: 3, take: 0 })).toThrow(/leaves nothing to count/);
    expect(() => away({ kind: 'take_away', start: 6, take: 2, onMat: [4, 1] })).toThrow(/starts with exactly 6 blocks/);
    const five = away({ kind: 'take_away', start: 5, take: 2, onMat: [3, 2] });
    expect(() => validate(five, { kind: 'take_away', start: 5, take: 2, onMat: [4, 1] })).toThrow(/not as dealt|all there is on the mat|is not 5/);
    // A 2 or the other 2: a guess (two sets of the same sizes count as one way, so 2 + 2 take 2 is fine).
    expect(() => away({ kind: 'take_away', start: 6, take: 3, onMat: [3, 1, 2] })).toThrow(/2 ways to take 3/);
    expect(() => away({ kind: 'take_away', start: 4, take: 2, onMat: [2, 2] })).not.toThrow();
    expect(() => away({ kind: 'take_away', start: 6, take: 2, onMat: [4, 2], steps: [1, 1] })).toThrow(/countdown is of single blocks/);
    expect(() => away({ kind: 'take_away', start: 5, take: 2, steps: [2] })).toThrow(/at least two steps/);
    expect(() => away({ kind: 'take_away', start: 5, take: 2, steps: [1, 2] })).toThrow(/do not add up to 2/);
    const p = away();
    const [first] = row(p);
    expect(() => validate({ ...p, initial: replay(p.initial, [{ type: 'return', unitId: first![0] }]) }, spec)).toThrow(/all on the mat/);
    expect(() => validate(p, { kind: 'quantity', targets: [3], extra: 2 })).toThrow(/must start in the tray/);
    expect(() => validate({ ...p, takeAway: { start: 5, take: 3 } }, spec)).toThrow(/carries its start and take/);
    expect(() => validate({ ...p, question: { kind: 'quantity', target: 4 } }, spec)).toThrow(/judged as the count left, 3/);
    const quantity = materialize(ref('ch1', 'ch1-n2'));
    expect(() => validate({ ...quantity, takeAway: { start: 4, take: 2 } }, { kind: 'quantity', targets: [2], extra: 2 })).toThrow(/take-away puzzle comes from a take-away spec/);
    // An answer that sends the wrong partner home does not pass.
    const six = away({ kind: 'take_away', start: 6, take: 2, onMat: [4, 2] });
    expect(() => validate({ ...six, solution: [{ type: 'returnGroup', groupId: six.onMat![0]! }] }, { kind: 'take_away', start: 6, take: 2, onMat: [4, 2] })).toThrow(/does not pass/);
  });
});

describe('Phase 22: the content bugs the builders refuse (split and take-away material, answers and steps)', () => {
  const mat = { cols: 4, rows: 3 };

  test('presetMaterial needs a positive count and a mat the row fits on', () => {
    expect(() => presetMaterial(0, mat, 'x')).toThrow(/positive integer/);
    expect(() => presetMaterial(5, mat, 'x')).toThrow(/could not put block/);
    const three = presetMaterial(3, mat, 'x');
    expect([...three.bench.values()]).toEqual([cell(0, 1), cell(1, 1), cell(2, 1)]);
  });

  test('the reference answer refuses a take-away no partners on the mat make, and a split asked more ways than it has blocks', () => {
    const onMat = onMatMaterial([4, 2], [], { cols: 7, rows: 3 }, 'x');
    expect(() => buildSolution({ kind: 'quantity', target: 1 }, onMat.state)).toThrow(/no partners on the mat add up to the 5/);
    expect(() => buildSolution({ kind: 'split', total: 2, parts: 2 }, presetMaterial(2, mat, 'x'), [], 5)).toThrow(/cannot be split 5 ways/);
  });

  test('validate: a split of partners, a take-away of single blocks carrying partners, a partner row that is not the start, a split spec on a quantity question, a countdown step that is not the count left', () => {
    const splitSpec = { kind: 'split', total: 3, parts: 2 } as const;
    const split = materializeNode(custom(splitSpec), mat, ref('ch3', 'x-n1'));
    const partners = onMatMaterial([2, 1], [], mat, 'x');
    expect(() => validate({ ...split, initial: partners.state }, splitSpec)).toThrow(/single blocks/);
    const awaySpec = { kind: 'take_away', start: 5, take: 2 } as const;
    const away = materializeNode(custom(awaySpec), fitBench(awaySpec), ref('ch3', 'x-n1'));
    expect(() => validate({ ...away, onMat: [] }, awaySpec)).toThrow(/without `onMat` is of single blocks/);
    expect(() => validate(away, { kind: 'split', total: 5, parts: 2 })).toThrow(/question quantity does not match spec split/);
    const sixSpec = { kind: 'take_away', start: 6, take: 2, onMat: [4, 2] } as const;
    const six = materializeNode(custom(sixSpec), fitBench(sixSpec), ref('ch3', 'x-n1'));
    expect(() => validate(six, { ...sixSpec, onMat: [4, 1] })).toThrow(/4 \+ 1 on the mat is not 6/);
    const rocketSpec = { kind: 'take_away', start: 5, take: 4, steps: [1, 1, 1, 1] } as const;
    const rocket = materializeNode(custom(rocketSpec), fitBench(rocketSpec), ref('ch3', 'x-n1'));
    const steps = rocket.steps!;
    expect(() => validate({ ...rocket, steps: [steps[0]!, { kind: 'quantity', target: 2 }, steps[2]!, steps[3]!] }, rocketSpec)).toThrow(/count left/);
    // benchPair: one partner on the bench is no pair (the 2 of 6 − 2 sent home).
    expect(benchPair(replay(six.initial, six.solution))).toBeNull();
  });
});

describe('Phase 23b: pictures and shadows (validate)', () => {
  const r = ref('x', 'x-n1');
  const at = (spec: NodeSpec['spec'], b = bounds) => () => materializeNode(custom(spec), b, r);
  const T4 = template([cell(0, 0), cell(1, 0), cell(2, 0), cell(1, 1)]);
  const BOAT = template([cell(0, 0), cell(2, 0), cell(0, 1), cell(1, 1), cell(2, 1)]);

  test('a picture and its shadow ride on the puzzle; a decoy that makes the picture too is refused', () => {
    const p = at({ kind: 'quantity_shape', target: 4, templates: [T4], extra: 1, handles: [3, 1], decoys: [2], picture: 'mushroom', shadow: 'always' })();
    expect(p).toMatchObject({ picture: 'mushroom', shadow: 'always', prompt: 'prompt.picture.mushroom' });
    // A line of four from four 1s, with a decoy 3: 3 + 1 is a line of four too.
    expect(at({ kind: 'quantity_shape', target: 4, templates: [template([0, 1, 2, 3].map((x) => cell(x, 0)))], extra: 1, handles: [1, 1, 1, 1], decoys: [3] })).toThrow(/takes in a decoy and makes the picture too/);
    expect(at({ kind: 'quantity_shape', target: 5, templates: [BOAT], extra: 1, handles: [3, 1, 1], decoys: [2, 4] })).not.toThrow();
  });

  test('a shadow comes with a picture, on the first or second ask, and must fit the mat as written', () => {
    expect(at({ kind: 'quantity_shape', target: 4, templates: [T4], extra: 1, shadow: 'always' })).toThrow(/a shadow comes with a picture/);
    expect(at({ kind: 'quantity_shape', target: 4, templates: [T4], extra: 1, picture: 'mushroom', shadow: { onHelp: 3 as 1 } })).toThrow(/first or second ask/);
    expect(at({ kind: 'quantity_shape', target: 4, templates: [T4], extra: 1, picture: 'mushroom', shadow: { onHelp: 2 } })).not.toThrow();
    // Turned only (never as written) the picture would fit: a 4 × 1 written across a mat 1 wide is refused.
    const line = template([0, 1, 2, 3].map((x) => cell(x, 0)));
    const narrow = { cols: 1, rows: 9 };
    expect(() => validate({ ...materializeNode(custom({ kind: 'quantity_shape', target: 4, templates: [line], extra: 1 }), { cols: 4, rows: 4 }, r), initial: { ...materializeNode(custom({ kind: 'quantity_shape', target: 4, templates: [line], extra: 1 }), { cols: 4, rows: 4 }, r).initial, bounds: narrow } }, { kind: 'quantity_shape', target: 4, templates: [line], extra: 1, picture: 'mushroom', shadow: 'always' })).toThrow();
  });

  test('only a shape spec carries a picture or a shadow', () => {
    const p = materializeNode(custom({ kind: 'quantity', targets: [3], extra: 1 }), bounds, r);
    expect(() => validate({ ...p, picture: 'duck' }, { kind: 'quantity', targets: [3], extra: 1 })).toThrow(/come from a shape spec/);
  });
});

describe('Phase 23d: sign stops (Compare Island)', () => {
  type SignSpec = Extract<NodeSpec['spec'], { kind: 'sign' }>;
  const sign = (rounds: SignSpec['rounds'], signs?: SignSpec['signs']): SignSpec => (signs === undefined ? { kind: 'sign', rounds } : { kind: 'sign', rounds, signs });
  const make = (spec: SignSpec, attemptVariant = 0) => materializeNode(custom(spec), fitBench(spec), ref('ch6', 'x-n1', attemptVariant));
  const ok = sign([{ left: 4, right: 1 }, { left: 1, right: 3 }]);

  test('the material is the last round on the mat, partners in their own colours, standing on the bottom row with a free column between', () => {
    const p = make(sign([{ left: 2, right: 2 }, { left: { n: 5, parts: [2, 3], beside: true }, right: { n: 4, layout: 'square' } }]));
    expect(p.initial.bounds).toEqual({ cols: 5, rows: 3 });
    const at = [...p.initial.groups.values()].map((g) => [groupSize(g), g.unitIds.map((u) => p.initial.bench.get(u)).map((c) => `${c!.x},${c!.y}`).sort().join(' ')]);
    expect(at).toEqual([
      [2, '0,1 0,2'],
      [3, '1,0 1,1 1,2'],
      [4, '3,1 3,2 4,1 4,2'],
    ]);
    expect([...p.initial.units.values()].map((u) => u.hue)).toEqual(['n2', 'n2', 'n3', 'n3', 'n3', 'n4', 'n4', 'n4', 'n4']);
    // Stacked partners: the first at the bottom.
    const stacked = make(sign([{ left: { n: 3, parts: [2, 1] }, right: 3 }]));
    expect([...stacked.initial.groups.values()].map((g) => g.unitIds.map((u) => stacked.initial.bench.get(u)!.y).sort().join())).toEqual(['1,2', '0', '0,1,2']);
    // A row lies on the bottom row.
    const row = make(sign([{ left: { n: 3, layout: 'row' }, right: 2 }]));
    expect([...row.initial.bench.values()].filter((c) => c.x < 3).every((c) => c.y === 1)).toBe(true);
  });

  test('validate refuses a sign stop a child could not answer or a phone could not show', () => {
    // The bad side comes first: the material is the last round's, so validate is what refuses it.
    const bad = (left: SignSpec['rounds'][number]['left']) => make(sign([{ left, right: 1 }, { left: 2, right: 1 }]));
    expect(() => make(sign([]))).toThrow();
    expect(() => make(sign([{ left: 4, right: 1 }], []))).toThrow(/not a set/);
    expect(() => make(sign([{ left: 4, right: 1 }], ['>', '>']))).toThrow(/not a set/);
    expect(() => make(sign([{ left: 4, right: 4 }], ['>', '<']))).toThrow(/no = for 4 and 4/);
    expect(() => bad(0)).toThrow(/not a number/);
    expect(() => bad(18)).toThrow(/not a number/);
    expect(() => bad(2.5)).toThrow(/not a number/);
    expect(() => bad({ n: 5, parts: [2, 2] })).toThrow(/do not make 5/);
    expect(() => bad({ n: 5, parts: [5] })).toThrow(/do not make 5/);
    expect(() => bad({ n: 5, parts: [0, 5] })).toThrow(/do not make 5/);
    expect(() => bad({ n: 4, parts: [2, 2], layout: 'row' })).toThrow(/stand as towers/);
    expect(() => bad({ n: 4, beside: true })).toThrow(/only partners/);
    expect(() => bad({ n: 6, layout: 'square' })).toThrow(/not a square/);
    expect(() => bad({ n: 1, layout: 'square' })).toThrow(/not a square/);
    expect(() => bad(11)).toThrow(/more than 10 blocks high/);
    expect(() => bad({ n: 11, parts: [10, 1], beside: true })).not.toThrow();
    const p = make(ok);
    expect(() => validate(p, sign([]))).toThrow(/at least one round/);
    expect(() => validate({ ...p, sign: undefined }, ok)).toThrow(/its own rounds/);
    expect(() => validate({ ...p, sign: { ...p.sign!, rounds: [p.sign!.rounds[0]!, p.sign!.rounds[0]!] } }, ok)).toThrow(/its own rounds/);
    expect(() => validate({ ...p, sign: { ...p.sign!, rounds: [p.sign!.rounds[0]!] } }, ok)).toThrow(/its own rounds/);
    const other = make(sign([{ left: 1, right: 3 }, { left: 4, right: 2 }]));
    expect(() => validate({ ...p, initial: other.initial }, ok)).toThrow(/last round, on the mat/);
    expect(() => validate(p, { kind: 'quantity', targets: [4], extra: 1 })).toThrow();
    const plain = materializeNode(custom({ kind: 'quantity', targets: [3], extra: 1 }), bounds, ref('ch1', 'x-n1'));
    expect(() => validate({ ...plain, sign: p.sign }, { kind: 'quantity', targets: [3], extra: 1 })).toThrow(/a sign puzzle comes from a sign spec/);
  });

  test('a replay shuffles the rounds by the ref; when every order runs a sign three times or repeats, it falls back', () => {
    const three = sign([{ left: 4, right: 1 }, { left: 5, right: 1 }, { left: 6, right: 1 }]);
    // Every order is > > >: no shuffle passes, so the catalog order stays.
    expect(make(three, 1).sign!.rounds.map((r) => r.left.n)).toEqual([4, 5, 6]);
    // Two rounds have two orders: a replay alternates as far as it can.
    const two = sign([{ left: 4, right: 1 }, { left: 1, right: 3 }]);
    const orders = [0, 1, 2, 3].map((v) => make(two, v).sign!.rounds.map((r) => r.answer).join(''));
    expect(orders[0]).toBe('><');
    expect(new Set(orders).size).toBe(2);
    // One round: nothing to shuffle.
    expect(make(sign([{ left: 2, right: 2 }]), 3).sign!.rounds).toHaveLength(1);
  });
});
