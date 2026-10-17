import { cellKey, inBounds } from './grid';
import type { Bounds } from './grid';
import type { UnitId } from './ids';
import type { BenchState, TraySlot, Unit } from './inventory';

export interface CreateBenchStateInput {
  readonly units: ReadonlyArray<Unit>;
  readonly bounds: Bounds;
}

// Deals every unit into its own tray slot, in input order. The bench starts empty.
export function createBenchState(input: CreateBenchStateInput): BenchState {
  // Type-level required; the runtime check protects untyped callers and content bugs.
  if (input.bounds === undefined) {
    throw new Error("createBenchState: bounds is required");
  }
  const units = new Map<UnitId, Unit>();
  const tray: TraySlot[] = [];
  const home = new Map<UnitId, number>();
  input.units.forEach((unit, index) => {
    if (units.has(unit.id)) {
      throw new Error(`createBenchState: duplicate unit id ${unit.id}`);
    }
    units.set(unit.id, unit);
    tray.push({ slot: index, unitId: unit.id });
    home.set(unit.id, index);
  });
  return { units, tray, bench: new Map(), groups: new Map(), bounds: input.bounds, home };
}

// The only place a quantity comes from: how many identities sit on the bench.
export function benchCount(state: BenchState): number {
  return state.bench.size;
}

function fail(invariant: number, detail: string): never {
  throw new Error(`invariant-${invariant}: ${detail}`);
}

// Structural invariants that every command must preserve. Tests call this after
// each command; production calls it only in __DEV__ builds.
export function assertInvariants(state: BenchState): void {
  // 1. Every unit is in exactly one of tray / bench, and both only hold known units.
  const inTray = new Set<UnitId>();
  state.tray.forEach((slot, index) => {
    if (slot.slot !== index) {
      fail(1, `tray slot ${slot.slot} stored at index ${index}`);
    }
    if (slot.unitId === null) {
      return;
    }
    if (!state.units.has(slot.unitId)) {
      fail(1, `tray holds unknown unit ${slot.unitId}`);
    }
    if (inTray.has(slot.unitId)) {
      fail(1, `unit ${slot.unitId} appears twice in the tray`);
    }
    inTray.add(slot.unitId);
  });
  for (const unitId of state.bench.keys()) {
    if (!state.units.has(unitId)) {
      fail(1, `bench holds unknown unit ${unitId}`);
    }
    if (inTray.has(unitId)) {
      fail(1, `unit ${unitId} is both in the tray and on the bench`);
    }
  }
  for (const unitId of state.units.keys()) {
    if (!inTray.has(unitId) && !state.bench.has(unitId)) {
      fail(1, `unit ${unitId} is neither in the tray nor on the bench`);
    }
    if (!state.home.has(unitId)) {
      fail(1, `unit ${unitId} has no home slot`);
    }
  }

  // 2. Bench cells are unique and inside the bounds.
  const occupied = new Set<string>();
  for (const [unitId, cell] of state.bench) {
    if (!inBounds(state.bounds, cell)) {
      fail(2, `unit ${unitId} is out of bounds at ${cellKey(cell)}`);
    }
    const key = cellKey(cell);
    if (occupied.has(key)) {
      fail(2, `two units share cell ${key}`);
    }
    occupied.add(key);
  }

  // 3. Groups are non-empty, pairwise disjoint, shape-aligned, and wholly in one
  //    place: all members in the tray, or all on the bench.
  const grouped = new Set<UnitId>();
  for (const group of state.groups.values()) {
    if (group.unitIds.length === 0) {
      fail(3, `group ${group.id} is empty`);
    }
    if (group.shape.length !== group.unitIds.length) {
      fail(3, `group ${group.id} shape has ${group.shape.length} cells for ${group.unitIds.length} units`);
    }
    const onBench = group.unitIds.filter((u) => state.bench.has(u)).length;
    if (onBench !== 0 && onBench !== group.unitIds.length) {
      fail(3, `group ${group.id} is split between the tray and the bench`);
    }
    if (onBench === 0) {
      const keys = new Set(group.shape.map(cellKey));
      if (keys.size !== group.shape.length) {
        fail(3, `group ${group.id} shape has overlapping cells`);
      }
    }
    for (const unitId of group.unitIds) {
      if (!state.units.has(unitId)) {
        fail(3, `group ${group.id} member ${unitId} is unknown`);
      }
      if (grouped.has(unitId)) {
        fail(3, `unit ${unitId} belongs to more than one group`);
      }
      grouped.add(unitId);
    }
  }
}

// 4. Commands never change the material. Compared across a before / after pair.
export function assertSameMaterial(before: BenchState, after: BenchState): void {
  if (before.units.size !== after.units.size) {
    fail(4, `unit count changed from ${before.units.size} to ${after.units.size}`);
  }
  for (const [unitId, unit] of before.units) {
    if (after.units.get(unitId) !== unit) {
      fail(4, `unit ${unitId} was replaced or removed`);
    }
  }
}
