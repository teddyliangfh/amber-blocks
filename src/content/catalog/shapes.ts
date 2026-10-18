import { cell, template } from '../../core';
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
