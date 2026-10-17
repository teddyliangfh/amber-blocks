import { areAdjacent } from './grid';
import type { Cell } from './grid';
import type { UnitId } from './ids';
import type { BenchState } from './inventory';

// A cluster is a connected component of the bench under edge adjacency. It is
// derived on demand from committed positions and never stored.
export interface Cluster {
  readonly unitIds: ReadonlyArray<UnitId>;
  readonly cells: ReadonlyArray<Cell>;
}

export function clusters(state: BenchState): ReadonlyArray<Cluster> {
  const entries = [...state.bench.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const seen = new Set<UnitId>();
  const result: Cluster[] = [];
  for (const [start] of entries) {
    if (seen.has(start)) {
      continue;
    }
    const unitIds: UnitId[] = [];
    const queue: UnitId[] = [start];
    seen.add(start);
    while (queue.length > 0) {
      const current = queue.shift() as UnitId;
      unitIds.push(current);
      const here = state.bench.get(current) as Cell;
      for (const [other, cell] of entries) {
        if (!seen.has(other) && areAdjacent(here, cell)) {
          seen.add(other);
          queue.push(other);
        }
      }
    }
    unitIds.sort();
    result.push({ unitIds, cells: unitIds.map((id) => state.bench.get(id) as Cell) });
  }
  return result;
}

export function clusterOf(state: BenchState, unitId: UnitId): Cluster | undefined {
  return clusters(state).find((c) => c.unitIds.includes(unitId));
}
