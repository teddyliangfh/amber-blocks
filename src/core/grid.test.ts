import { unitId } from './ids';
import {
  areAdjacent,
  cell,
  cellKey,
  inBounds,
  isFree,
  normalize,
  sameCell,
  sameCells,
  translate,
} from './grid';

describe('grid', () => {
  test('adjacency: shared edge only, diagonal is not adjacent', () => {
    expect(areAdjacent(cell(0, 0), cell(1, 0))).toBe(true);
    expect(areAdjacent(cell(0, 0), cell(0, 1))).toBe(true);
    expect(areAdjacent(cell(2, 2), cell(1, 2))).toBe(true);
    expect(areAdjacent(cell(0, 0), cell(1, 1))).toBe(false);
    expect(areAdjacent(cell(0, 0), cell(2, 0))).toBe(false);
    expect(areAdjacent(cell(0, 0), cell(0, 0))).toBe(false);
  });

  test('inBounds: zero-based, exclusive upper edge, integers only', () => {
    const b = { cols: 3, rows: 2 };
    expect(inBounds(b, cell(0, 0))).toBe(true);
    expect(inBounds(b, cell(2, 1))).toBe(true);
    expect(inBounds(b, cell(3, 1))).toBe(false);
    expect(inBounds(b, cell(2, 2))).toBe(false);
    expect(inBounds(b, cell(-1, 0))).toBe(false);
    expect(inBounds(b, cell(0, -1))).toBe(false);
    expect(inBounds(b, cell(0.5, 0))).toBe(false);
  });

  test('isFree reflects occupied cells on the bench', () => {
    const bench = new Map([[unitId('a'), cell(1, 1)]]);
    expect(isFree(bench, cell(1, 1))).toBe(false);
    expect(isFree(bench, cell(1, 0))).toBe(true);
    expect(isFree(new Map(), cell(1, 1))).toBe(true);
  });

  test('normalize: same shape at any offset, including negative, gives the same canonical cells', () => {
    const l = [cell(0, 0), cell(0, 1), cell(1, 1)];
    const shifted = [cell(5, 7), cell(5, 8), cell(6, 8)];
    const negative = [cell(-3, -2), cell(-3, -1), cell(-2, -1)];
    const scrambled = [cell(1, 1), cell(0, 1), cell(0, 0)];
    expect(normalize(shifted)).toEqual(normalize(l));
    expect(normalize(negative)).toEqual(normalize(l));
    expect(normalize(scrambled)).toEqual(normalize(l));
    expect(normalize(l)).toEqual([cell(0, 0), cell(0, 1), cell(1, 1)]);
    expect(normalize([])).toEqual([]);
  });

  test('sameCells compares canonical lists element by element', () => {
    const a = normalize([cell(0, 0), cell(1, 0)]);
    expect(sameCells(a, normalize([cell(4, 4), cell(5, 4)]))).toBe(true);
    expect(sameCells(a, normalize([cell(0, 0), cell(0, 1)]))).toBe(false);
    expect(sameCells(a, [cell(0, 0)])).toBe(false);
  });

  test('translate, sameCell and cellKey helpers', () => {
    expect(translate([cell(0, 0), cell(1, 0)], cell(2, -1))).toEqual([cell(2, -1), cell(3, -1)]);
    expect(sameCell(cell(1, 2), cell(1, 2))).toBe(true);
    expect(sameCell(cell(1, 2), cell(2, 1))).toBe(false);
    expect(cellKey(cell(3, 4))).toBe('3,4');
  });
});
