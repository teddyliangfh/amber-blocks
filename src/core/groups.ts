import { alignedShape, reject } from './commands';
import type { Result } from './commands';
import { areAdjacent, cellKey } from './grid';
import type { Cell } from './grid';
import { groupId as makeGroupId } from './ids';
import type { GroupId, UnitId } from './ids';
import type { BenchState, Group } from './inventory';

// Registers a partner. Not a child-facing command: content uses it to build
// material (partners waiting in the tray, with the body they will land in) and
// tests use it to group units already on the bench (shape read from their cells).
export function defineGroup(
  state: BenchState,
  id: GroupId,
  unitIds: ReadonlyArray<UnitId>,
  shape?: ReadonlyArray<Cell>,
): Result<BenchState> {
  if (state.groups.has(id)) {
    return reject('group-exists');
  }
  if (unitIds.length === 0) {
    return reject('empty-group');
  }
  const taken = new Set<UnitId>();
  for (const group of state.groups.values()) {
    for (const u of group.unitIds) {
      taken.add(u);
    }
  }
  const inTray = new Set(state.tray.map((s) => s.unitId));
  let onBench = 0;
  for (const unitId of unitIds) {
    if (taken.has(unitId)) {
      return reject('already-grouped');
    }
    if (state.bench.has(unitId)) {
      onBench += 1;
    } else if (!inTray.has(unitId)) {
      return reject('not-in-tray');
    }
  }
  if (onBench !== 0 && onBench !== unitIds.length) {
    return reject('split-group');
  }

  let members: ReadonlyArray<readonly [UnitId, Cell]>;
  if (onBench === unitIds.length) {
    members = unitIds.map((u) => [u, state.bench.get(u) as Cell] as const);
  } else {
    // A malformed shape is a content bug, not a child's mistake.
    if (shape === undefined || shape.length !== unitIds.length) {
      throw new Error(`defineGroup: group ${id} in the tray needs a shape with ${unitIds.length} cells`);
    }
    if (new Set(shape.map(cellKey)).size !== shape.length) {
      throw new Error(`defineGroup: group ${id} shape has overlapping cells`);
    }
    members = unitIds.map((u, i) => [u, shape[i] as Cell] as const);
  }
  const sorted = [...members].sort(([a], [b]) => (a < b ? -1 : 1));
  const group: Group = {
    id,
    unitIds: sorted.map(([u]) => u),
    shape: alignedShape(sorted.map(([, c]) => c)),
    source: [],
  };
  return { ok: true, value: { ...state, groups: new Map(state.groups).set(id, group) } };
}

export function groupSize(group: Group): number {
  return group.unitIds.length;
}

export function groupCells(state: BenchState, group: Group): ReadonlyArray<Cell> {
  return group.unitIds.map((id) => state.bench.get(id) as Cell);
}

// Two partners touch when any member of one shares an edge with any member of the other.
export function areTouching(state: BenchState, a: Group, b: Group): boolean {
  const cellsA = groupCells(state, a);
  const cellsB = groupCells(state, b);
  return cellsA.some((ca) => cellsB.some((cb) => areAdjacent(ca, cb)));
}

// The combined partner, derived rather than stored: A and B stay in the state so
// the UI can still colour the 3 and the 4 inside the 7 (AC-39). The identity
// union is the only place the total comes from.
export function mergedGroup(state: BenchState, a: Group, b: Group): Group | undefined {
  if (a.id === b.id || !areTouching(state, a, b)) {
    return undefined;
  }
  const members = [...a.unitIds, ...b.unitIds].map((u) => [u, state.bench.get(u) as Cell] as const).sort(([x], [y]) => (x < y ? -1 : 1));
  return {
    id: makeGroupId(`${a.id}+${b.id}`),
    unitIds: members.map(([u]) => u),
    shape: alignedShape(members.map(([, c]) => c)),
    source: [a.id, b.id],
  };
}
