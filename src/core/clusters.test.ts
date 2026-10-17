import { clusterOf, clusters } from './clusters';
import { cell } from './grid';
import { unitIds } from './ids';
import { createBenchState } from './state';
import type { BenchState } from './inventory';

const [a, b, c, d] = unitIds('q', 4) as [
  ReturnType<typeof unitIds>[number],
  ReturnType<typeof unitIds>[number],
  ReturnType<typeof unitIds>[number],
  ReturnType<typeof unitIds>[number],
];

function placed(positions: ReadonlyArray<readonly [ReturnType<typeof unitIds>[number], number, number]>): BenchState {
  const base = createBenchState({ units: unitIds('q', 4).map((id) => ({ id, hue: 'red' })), bounds: { cols: 5, rows: 5 } });
  const onBench = new Set(positions.map(([id]) => id));
  return {
    ...base,
    tray: base.tray.map((s) => (s.unitId !== null && onBench.has(s.unitId) ? { ...s, unitId: null } : s)),
    bench: new Map(positions.map(([id, x, y]) => [id, cell(x, y)])),
  };
}

describe('clusters', () => {
  test('two edge-adjacent units form one cluster', () => {
    const parts = clusters(placed([[a, 0, 0], [b, 1, 0]]));
    expect(parts).toHaveLength(1);
    expect(parts[0]?.unitIds).toEqual([a, b]);
    expect(parts[0]?.cells).toEqual([cell(0, 0), cell(1, 0)]);
  });

  test('diagonal units are two clusters', () => {
    expect(clusters(placed([[a, 0, 0], [b, 1, 1]]))).toHaveLength(2);
  });

  test('a corner of three is one cluster; a far unit is its own', () => {
    const parts = clusters(placed([[a, 0, 0], [b, 0, 1], [c, 1, 1], [d, 4, 4]]));
    expect(parts.map((p) => p.unitIds)).toEqual([[a, b, c], [d]]);
  });

  test('empty bench has no clusters; clusterOf finds the owning cluster', () => {
    expect(clusters(placed([]))).toEqual([]);
    const state = placed([[a, 0, 0], [b, 1, 0], [c, 3, 3]]);
    expect(clusterOf(state, b)?.unitIds).toEqual([a, b]);
    expect(clusterOf(state, c)?.unitIds).toEqual([c]);
    expect(clusterOf(state, d)).toBeUndefined();
  });

  test('cluster order does not depend on bench insertion order', () => {
    const forward = clusters(placed([[a, 0, 0], [b, 1, 0], [c, 3, 3]]));
    const reversed = clusters(placed([[c, 3, 3], [b, 1, 0], [a, 0, 0]]));
    expect(reversed).toEqual(forward);
  });
});
