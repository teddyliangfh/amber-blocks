import { cell, createBenchState, unitIds } from '../core';
import { picturedSides, roundOf, sideOf, sideShape, signBounds } from './sign';

describe('sign.ts (Phase 23d)', () => {
  test('a side spelled out: a number is a tower; layouts and partners as given', () => {
    expect(sideOf(3)).toEqual({ n: 3, layout: 'tower', parts: null, beside: false });
    expect(sideOf({ n: 4, layout: 'row' })).toEqual({ n: 4, layout: 'row', parts: null, beside: false });
    expect(sideOf({ n: 12, parts: [6, 6], beside: true })).toEqual({ n: 12, layout: 'tower', parts: [6, 6], beside: true });
    expect(roundOf({ left: 2, right: 5 }).answer).toBe('<');
  });

  test('shapes: tower, row, square, stacked and side-by-side partners', () => {
    expect(sideShape(sideOf(3))).toEqual({ cols: 1, rows: 3, pieces: [{ n: 3, cells: [cell(0, 0), cell(0, 1), cell(0, 2)] }] });
    expect(sideShape(sideOf({ n: 3, layout: 'row' }))).toMatchObject({ cols: 3, rows: 1 });
    expect(sideShape(sideOf({ n: 9, layout: 'square' }))).toMatchObject({ cols: 3, rows: 3 });
    const stacked = sideShape(sideOf({ n: 3, parts: [2, 1] }));
    expect(stacked.pieces.map((p) => p.cells.map((c) => c.y))).toEqual([[1, 2], [0]]);
    const beside = sideShape(sideOf({ n: 13, parts: [10, 3], beside: true }));
    expect([beside.cols, beside.rows]).toEqual([2, 10]);
    expect(beside.pieces[1]!.cells.map((c) => `${c.x},${c.y}`)).toEqual(['1,7', '1,8', '1,9']);
  });

  test('the mat holds the widest round and the tallest side', () => {
    expect(signBounds([{ left: { n: 5, layout: 'row' }, right: 3 }, { left: 9, right: 9 }])).toEqual({ cols: 7, rows: 9 });
  });

  test('a picture reads back as its two sides around the free column, or not at all', () => {
    const empty = createBenchState({ units: unitIds('t', 3).map((id) => ({ id, hue: 'n1' })), bounds: { cols: 4, rows: 2 } });
    expect(picturedSides(empty)).toBeNull();
    const ids = unitIds('t', 3);
    const placed = (xs: ReadonlyArray<number>) => ({ ...empty, bench: new Map(xs.map((x, i) => [ids[i]!, cell(x, 1)] as const)) });
    expect(picturedSides(placed([0, 1, 3]))).toEqual({ left: 2, right: 1, gap: 2 });
    // No free column between them, or nothing on one side: not a sign picture.
    expect(picturedSides(placed([0, 1, 2]))).toBeNull();
    expect(picturedSides(placed([1, 1, 3]))).toEqual({ left: 2, right: 1, gap: 2 });
  });
});
