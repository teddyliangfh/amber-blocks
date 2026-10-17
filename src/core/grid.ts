import type { UnitId } from './ids';

// Integer grid cells. Adjacency means sharing an edge (4-neighbourhood);
// diagonal cells are not adjacent.

export interface Cell {
  readonly x: number;
  readonly y: number;
}

export interface Bounds {
  readonly cols: number;
  readonly rows: number;
}

export function cell(x: number, y: number): Cell {
  return { x, y };
}

export function sameCell(a: Cell, b: Cell): boolean {
  return a.x === b.x && a.y === b.y;
}

// Stable string key so cells can live in Map / Set.
export function cellKey(c: Cell): string {
  return `${c.x},${c.y}`;
}

export function inBounds(bounds: Bounds, c: Cell): boolean {
  return (
    Number.isInteger(c.x) &&
    Number.isInteger(c.y) &&
    c.x >= 0 &&
    c.y >= 0 &&
    c.x < bounds.cols &&
    c.y < bounds.rows
  );
}

export function areAdjacent(a: Cell, b: Cell): boolean {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}

export function isFree(bench: ReadonlyMap<UnitId, Cell>, c: Cell): boolean {
  for (const occupied of bench.values()) {
    if (sameCell(occupied, c)) {
      return false;
    }
  }
  return true;
}

export function translate(cells: ReadonlyArray<Cell>, delta: Cell): ReadonlyArray<Cell> {
  return cells.map((c) => cell(c.x + delta.x, c.y + delta.y));
}

// Canonical form of a cell set: shifted so the minimum x and y are 0, then sorted
// row-major. Two sets are the same shape up to translation iff their canonical
// forms are equal element by element.
export function normalize(cells: ReadonlyArray<Cell>): ReadonlyArray<Cell> {
  if (cells.length === 0) {
    return [];
  }
  let minX = Infinity;
  let minY = Infinity;
  for (const c of cells) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
  }
  return translate(cells, cell(-minX, -minY))
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

export function sameCells(a: ReadonlyArray<Cell>, b: ReadonlyArray<Cell>): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((c, i) => {
    const other = b[i];
    return other !== undefined && sameCell(c, other);
  });
}
