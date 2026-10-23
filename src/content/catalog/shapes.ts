import { cell, rotate90, template } from '../../core';
import type { ShapeTemplate } from '../../core';

// Named outlines used by the catalog. Templates are stored normalized by the core.
export const SQUARE_2X2: ShapeTemplate = template([cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)]);
export const CORNER_3: ShapeTemplate = template([cell(0, 0), cell(0, 1), cell(1, 1)]);
export const LINE_4: ShapeTemplate = template([cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0)]);
export const BRICK_2X4: ShapeTemplate = template([cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0), cell(0, 1), cell(1, 1), cell(2, 1), cell(3, 1)]);
export const TOWER_2X3: ShapeTemplate = template([cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1), cell(0, 2), cell(1, 2)]);
// Phase 21: ten as two rows of five (5 + 5), and stairs of 1, 2 and 3 steps,
// left-aligned (1 + 2 + 3 = 6). The right-aligned stairs are these turned a
// quarter, so they count too (rotation on, mirror off by default).
export const TEN_2X5: ShapeTemplate = template([cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0), cell(4, 0), cell(0, 1), cell(1, 1), cell(2, 1), cell(3, 1), cell(4, 1)]);
export const STAIRS_6: ShapeTemplate = template([cell(0, 0), cell(0, 1), cell(1, 1), cell(0, 2), cell(1, 2), cell(2, 2)]);
// Phase 23a (content v9, PRD §4.1): new pictures on the unit grid. Partner
// pictures are written the way lying partners fill them, row by row (the
// reference answer lays partners as written, solution.ts). The 4s: a
// mushroom, a zigzag and a boot (the boot lying down, so a 3 and a 1 fill it).
export const T_4: ShapeTemplate = template([cell(0, 0), cell(1, 0), cell(2, 0), cell(1, 1)]);
export const S_4: ShapeTemplate = template([cell(1, 0), cell(2, 0), cell(0, 1), cell(1, 1)]);
export const L_4: ShapeTemplate = template([cell(0, 0), cell(1, 0), cell(2, 0), cell(0, 1)]);
// A plus: think of the middle block first.
export const PLUS_5: ShapeTemplate = template([cell(1, 0), cell(0, 1), cell(1, 1), cell(2, 1), cell(1, 2)]);
// A ring: 3 × 3 with a hole, 3 + 3 + 1 + 1. Filling the hole is 9, one too many.
export const RING_8: ShapeTemplate = template([cell(0, 0), cell(1, 0), cell(2, 0), cell(0, 1), cell(2, 1), cell(0, 2), cell(1, 2), cell(2, 2)]);
// Three 3s stacked: nine, a square number.
export const SQUARE_3X3: ShapeTemplate = template([cell(0, 0), cell(1, 0), cell(2, 0), cell(0, 1), cell(1, 1), cell(2, 1), cell(0, 2), cell(1, 2), cell(2, 2)]);
// Ten standing up, five 2s one on another (TEN_2X5 is the same ten lying down).
export const TEN_STANDING: ShapeTemplate = template([0, 1, 2, 3, 4].flatMap((y) => [cell(0, y), cell(1, y)]));
// Stairs of 1, 2, 3 and 4, left-aligned (STAIRS_6 one step taller).
export const STAIRS_10: ShapeTemplate = template([0, 1, 2, 3].flatMap((y) => Array.from({ length: y + 1 }, (_, x) => cell(x, y))));
// Phase 23b (content v10, PRD §4.2): Shape Island's pictures, written the way
// the shadow shows them and lying partners fill them, row by row. A corner of
// 5 (a 3 along the bottom, two stacked on its left end); a boat (a 3 for the
// hull, a 1 at each end); a duck (head on top of the left end of a 4); a tree
// (a 3 for the leaves, a trunk of two 1s); a house (a 1 for the roof over two
// 3s); a dog (head up on the right, two legs) and a rocket (a 3 for the fins,
// three 1s up the middle).
export const CORNER_5: ShapeTemplate = template([cell(0, 0), cell(0, 1), cell(0, 2), cell(1, 2), cell(2, 2)]);
export const BOAT_5: ShapeTemplate = template([cell(0, 0), cell(2, 0), cell(0, 1), cell(1, 1), cell(2, 1)]);
// The boat a quarter turn round, as the corner's next picture: written so, the
// corner turns into it by moving one block (judged the same as BOAT_5, rotation
// on; it deals the same, the shadow differs).
export const BOAT_5_C: ShapeTemplate = template(rotate90(BOAT_5.cells));
export const DUCK_5: ShapeTemplate = template([cell(0, 0), cell(0, 1), cell(1, 1), cell(2, 1), cell(3, 1)]);
export const TREE_5: ShapeTemplate = template([cell(0, 0), cell(1, 0), cell(2, 0), cell(1, 1), cell(1, 2)]);
export const HOUSE_7: ShapeTemplate = template([cell(1, 0), cell(0, 1), cell(1, 1), cell(2, 1), cell(0, 2), cell(1, 2), cell(2, 2)]);
export const DOG_6: ShapeTemplate = template([cell(2, 0), cell(0, 1), cell(1, 1), cell(2, 1), cell(0, 2), cell(2, 2)]);
export const ROCKET_6: ShapeTemplate = template([cell(1, 0), cell(1, 1), cell(1, 2), cell(0, 3), cell(1, 3), cell(2, 3)]);
