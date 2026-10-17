import { cell, normalize, sameCells } from './grid';
import type { Cell } from './grid';

// A target outline, stored in canonical (normalized) form.
export interface ShapeTemplate {
  readonly cells: ReadonlyArray<Cell>;
}

// Which transforms count as "the same shape" for a question.
export interface Symmetry {
  readonly rotation: boolean;
  readonly mirror: boolean;
}

// Ordinary questions accept any rotation; mirroring must be enabled per question
// (level-progression §4, spec decision 2).
export const DEFAULT_SYMMETRY: Symmetry = { rotation: true, mirror: false };

export function template(cells: ReadonlyArray<Cell>): ShapeTemplate {
  return { cells: normalize(cells) };
}

// 90° counter-clockwise about the origin, then re-normalized.
export function rotate90(cells: ReadonlyArray<Cell>): ReadonlyArray<Cell> {
  return normalize(cells.map((c) => cell(-c.y, c.x)));
}

// Horizontal flip, then re-normalized.
export function mirrorX(cells: ReadonlyArray<Cell>): ReadonlyArray<Cell> {
  return normalize(cells.map((c) => cell(-c.x, c.y)));
}

// Every canonical cell set that counts as equal to the template under `symmetry`.
// Duplicates (e.g. a square's rotations) are collapsed.
export function variants(shape: ShapeTemplate, symmetry: Symmetry): ReadonlyArray<ReadonlyArray<Cell>> {
  let bases: ReadonlyArray<ReadonlyArray<Cell>> = [normalize(shape.cells)];
  if (symmetry.rotation) {
    const r1 = rotate90(bases[0] as ReadonlyArray<Cell>);
    const r2 = rotate90(r1);
    const r3 = rotate90(r2);
    bases = [...bases, r1, r2, r3];
  }
  if (symmetry.mirror) {
    bases = [...bases, ...bases.map(mirrorX)];
  }
  const unique: ReadonlyArray<Cell>[] = [];
  for (const candidate of bases) {
    if (!unique.some((u) => sameCells(u, candidate))) {
      unique.push(candidate);
    }
  }
  return unique;
}

export function matchesTemplate(
  cells: ReadonlyArray<Cell>,
  shape: ShapeTemplate,
  symmetry: Symmetry = DEFAULT_SYMMETRY,
): boolean {
  const canonical = normalize(cells);
  return variants(shape, symmetry).some((v) => sameCells(v, canonical));
}
