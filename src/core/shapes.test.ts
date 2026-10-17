import { cell } from './grid';
import { DEFAULT_SYMMETRY, matchesTemplate, mirrorX, rotate90, template, variants } from './shapes';

const corner = template([cell(0, 0), cell(0, 1), cell(1, 1)]);
const square = template([cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)]);
const lineOf3 = [cell(0, 0), cell(1, 0), cell(2, 0)];
// Chiral: the 4-cell L and its mirror image J are not rotations of each other.
const L = template([cell(0, 0), cell(0, 1), cell(0, 2), cell(1, 2)]);
const lRotations = [
  [cell(0, 0), cell(0, 1), cell(0, 2), cell(1, 2)],
  [cell(0, 0), cell(1, 0), cell(2, 0), cell(0, 1)],
  [cell(0, 0), cell(1, 0), cell(1, 1), cell(1, 2)],
  [cell(2, 0), cell(0, 1), cell(1, 1), cell(2, 1)],
];
const jRotations = [
  [cell(1, 0), cell(1, 1), cell(1, 2), cell(0, 2)],
  [cell(0, 0), cell(0, 1), cell(1, 1), cell(2, 1)],
  [cell(0, 0), cell(1, 0), cell(0, 1), cell(0, 2)],
  [cell(0, 0), cell(1, 0), cell(2, 0), cell(2, 1)],
];

describe('shapes', () => {
  test('default symmetry: rotation on, mirror off', () => {
    expect(DEFAULT_SYMMETRY).toEqual({ rotation: true, mirror: false });
  });

  test('AC-43: the 3-block corner matches in all four rotations, a 3-line does not', () => {
    const corners = [
      [cell(0, 0), cell(0, 1), cell(1, 1)],
      [cell(0, 0), cell(1, 0), cell(0, 1)],
      [cell(0, 0), cell(1, 0), cell(1, 1)],
      [cell(1, 0), cell(0, 1), cell(1, 1)],
    ];
    for (const placement of corners) {
      expect(matchesTemplate(placement, corner)).toBe(true);
      expect(matchesTemplate(placement.map((c) => cell(c.x + 3, c.y + 2)), corner)).toBe(true);
    }
    expect(matchesTemplate(lineOf3, corner)).toBe(false);
    expect(matchesTemplate(lineOf3, corner, { rotation: true, mirror: true })).toBe(false);
  });

  test('mirror off: the four J placements do not match the L template; mirror on: they do', () => {
    for (const placement of lRotations) {
      expect(matchesTemplate(placement, L, { rotation: true, mirror: false })).toBe(true);
    }
    for (const placement of jRotations) {
      expect(matchesTemplate(placement, L, { rotation: true, mirror: false })).toBe(false);
      expect(matchesTemplate(placement, L, { rotation: true, mirror: true })).toBe(true);
    }
  });

  test('rotation off: only translation matches; mirror alone adds exactly the flipped form', () => {
    const none = { rotation: false, mirror: false };
    expect(matchesTemplate(lRotations[0] as never, L, none)).toBe(true);
    expect(matchesTemplate(lRotations[1] as never, L, none)).toBe(false);
    expect(matchesTemplate(jRotations[0] as never, L, none)).toBe(false);
    const mirrorOnly = { rotation: false, mirror: true };
    expect(matchesTemplate(jRotations[0] as never, L, mirrorOnly)).toBe(true);
    expect(matchesTemplate(jRotations[1] as never, L, mirrorOnly)).toBe(false);
    expect(matchesTemplate(lRotations[1] as never, L, mirrorOnly)).toBe(false);
  });

  test('variants collapse duplicates: a square has one variant, an L has 4 or 8', () => {
    expect(variants(square, { rotation: true, mirror: true })).toHaveLength(1);
    expect(variants(L, { rotation: true, mirror: false })).toHaveLength(4);
    expect(variants(L, { rotation: true, mirror: true })).toHaveLength(8);
    expect(variants(L, { rotation: false, mirror: false })).toHaveLength(1);
    expect(variants(L, { rotation: false, mirror: true })).toHaveLength(2);
  });

  test('rotate90 four times and mirrorX twice return to the canonical start', () => {
    const start = L.cells;
    const r4 = rotate90(rotate90(rotate90(rotate90(start))));
    expect(r4).toEqual(start);
    expect(mirrorX(mirrorX(start))).toEqual(start);
    expect(template([cell(5, 5), cell(6, 5)]).cells).toEqual([cell(0, 0), cell(1, 0)]);
  });

  test('size mismatch never matches', () => {
    expect(matchesTemplate([cell(0, 0), cell(1, 0)], corner)).toBe(false);
    expect(matchesTemplate([], corner)).toBe(false);
  });
});
