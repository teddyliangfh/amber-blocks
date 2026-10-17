import { apply, cell, groupSize, judge } from '../core';
import { chapterId, nodeId } from './ids';
import { bodyOf, handlesFor, hueFor, looseMaterial, partnerMaterial, partnerOrder } from './material';
import type { PuzzleRef } from './schema';
import { buildSolution } from './solution';

const bounds = { cols: 8, rows: 6 };
const ref: PuzzleRef = { contentVersion: 1, chapterId: chapterId('ch2'), nodeId: nodeId('ch2-n1'), attemptVariant: 0, seed: 7 };

describe('material', () => {
  test('hueFor is the theme token of the number, clamped to 1..10', () => {
    expect(hueFor(3)).toBe('n3');
    expect(hueFor(0)).toBe('n1');
    expect(hueFor(17)).toBe('n10');
  });

  test('decision 3: bodies are one row to 5 and two rows to 10', () => {
    expect(bodyOf(1)).toEqual([cell(0, 0)]);
    expect(bodyOf(3)).toEqual([cell(0, 0), cell(1, 0), cell(2, 0)]);
    expect(bodyOf(7)).toEqual([cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0), cell(4, 0), cell(0, 1), cell(1, 1)]);
    expect(bodyOf(10)).toHaveLength(10);
    expect(() => bodyOf(0)).toThrow(/1\.\.10/);
    expect(() => bodyOf(11)).toThrow(/1\.\.10/);
  });

  test('AC-46: handles split big numbers as 10s, a 5 and a remainder', () => {
    expect(handlesFor(17)).toEqual([10, 5, 2]);
    expect(handlesFor(12)).toEqual([10, 2]);
    expect(handlesFor(15)).toEqual([10, 5]);
    expect(handlesFor(25)).toEqual([10, 10, 5]);
    expect(handlesFor(7)).toEqual([7]);
    expect(() => handlesFor(0)).toThrow(/positive integer/);
  });

  test('AC-20: loose material is target + extra units in one hue, all in the tray', () => {
    const state = looseMaterial(4, 2, bounds, 'q');
    expect(state.units.size).toBe(6);
    expect(state.bench.size).toBe(0);
    expect(state.tray.every((s) => s.unitId !== null)).toBe(true);
    expect(new Set([...state.units.values()].map((u) => u.hue))).toEqual(new Set(['n4']));
    expect(() => looseMaterial(4, 0, bounds, 'q')).toThrow(/extra must be at least 1/);
  });

  test('AC-44: partner material has one real partner per size, in tray order, labelled by size', () => {
    const { state, partnerIds } = partnerMaterial([5, 3, 2, 4], bounds, 'q');
    expect(partnerIds).toHaveLength(4);
    expect(partnerIds.map((id) => groupSize(state.groups.get(id)!))).toEqual([5, 3, 2, 4]);
    expect(state.units.size).toBe(14);
    expect(state.bench.size).toBe(0);
    const three = state.groups.get(partnerIds[1]!)!;
    expect(three.shape).toEqual(bodyOf(3));
    expect(three.unitIds.map((u) => state.units.get(u)!.hue)).toEqual(['n3', 'n3', 'n3']);
  });

  test('AC-46: 17 as three handles of 10, 5 and 2 really holds 17 units and counts as 17', () => {
    const { state, partnerIds } = partnerMaterial(handlesFor(17), bounds, 'boss');
    expect(partnerIds.map((id) => groupSize(state.groups.get(id)!))).toEqual([10, 5, 2]);
    expect(state.units.size).toBe(17);
    const solution = buildSolution({ kind: 'quantity', target: 17 }, state);
    expect(solution.map((c) => c.type)).toEqual(['takeGroup', 'takeGroup', 'takeGroup']);
    let s = state;
    for (const cmd of solution) {
      const r = apply(s, cmd);
      if (!r.ok) {
        throw new Error(r.reason);
      }
      s = r.value;
    }
    expect(judge(s, { kind: 'quantity', target: 17 })).toEqual({ matched: true, benchCount: 17, reason: 'matched' });
  });

  test('tray order: deterministic per ref, differs from the previous variant, and varies across variants', () => {
    const labels = [5, 3, 2, 4];
    expect(partnerOrder(ref, labels)).toEqual(partnerOrder(ref, labels));
    expect([...partnerOrder(ref, labels)].sort()).toEqual([...labels].sort());
    const orders = [0, 1, 2, 3, 4].map((attemptVariant) => partnerOrder({ ...ref, attemptVariant }, labels).join());
    for (let k = 1; k < orders.length; k += 1) {
      expect(orders[k]).not.toBe(orders[k - 1]);
    }
    expect(new Set(orders).size).toBeGreaterThan(1);
    // Labels with a single possible order do not loop forever.
    expect(partnerOrder({ ...ref, attemptVariant: 3 }, [2, 2])).toEqual([2, 2]);
  });
});
