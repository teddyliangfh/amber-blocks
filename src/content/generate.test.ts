import { apply, cell, groupSize, judge, template } from '../core';
import type { BenchState, Command } from '../core';
import { fitBench } from './bench';
import { CONTENT_VERSION } from './catalog';
import { materialize, materializeNode } from './generate';
import { partnerMaterial } from './material';
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
    expect(() => validate({ ...square, ways: 2 }, { kind: 'quantity_shape', target: 4, templates: [square.display.template!], extra: 2 })).toThrow(/ways come from a sum spec/);
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
