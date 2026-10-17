import { cell, cellKey, inBounds, sameCell } from './grid';
import type { Cell } from './grid';
import type { GroupId, UnitId } from './ids';
import type { BenchState, Group, TraySlot } from './inventory';

export type RejectReason =
  | 'occupied'
  | 'out-of-bounds'
  | 'not-on-bench'
  | 'not-in-tray'
  | 'unknown-group'
  | 'group-exists'
  | 'empty-group'
  | 'already-grouped'
  | 'split-group'
  | 'grouped'
  | 'nothing-to-undo';

export type Result<T> = { ok: true; value: T } | { ok: false; reason: RejectReason };

export type Command =
  | { type: 'take'; unitId: UnitId; to: Cell }
  | { type: 'move'; unitId: UnitId; to: Cell }
  | { type: 'return'; unitId: UnitId }
  | { type: 'moveGroup'; groupId: GroupId; delta: Cell }
  | { type: 'takeGroup'; groupId: GroupId; origin: Cell }
  | { type: 'returnGroup'; groupId: GroupId };

export function reject<T>(reason: RejectReason): Result<T> {
  return { ok: false, reason };
}

// A cell is available to the units in `movers` when no other unit sits there.
function isAvailable(state: BenchState, movers: ReadonlySet<UnitId>, to: Cell): boolean {
  for (const [other, cell] of state.bench) {
    if (!movers.has(other) && sameCell(cell, to)) {
      return false;
    }
  }
  return true;
}

function clearTraySlot(tray: ReadonlyArray<TraySlot>, unitId: UnitId): ReadonlyArray<TraySlot> {
  return tray.map((s) => (s.unitId === unitId ? { ...s, unitId: null } : s));
}

// Puts one bench unit back into its home slot, else the first empty slot. A full
// tray with a unit off it cannot happen under invariant 1, so that case throws.
function placeInTray(state: BenchState, tray: ReadonlyArray<TraySlot>, unitId: UnitId): ReadonlyArray<TraySlot> {
  const home = state.home.get(unitId);
  const homeSlot = home === undefined ? undefined : tray[home];
  const target = homeSlot !== undefined && homeSlot.unitId === null ? homeSlot : tray.find((s) => s.unitId === null);
  if (target === undefined) {
    throw new Error(`invariant-1: no empty tray slot to return ${unitId}`);
  }
  return tray.map((s) => (s.slot === target.slot ? { ...s, unitId } : s));
}

// Offsets of the given cells relative to their minimum corner, order preserved.
export function alignedShape(cells: ReadonlyArray<Cell>): ReadonlyArray<Cell> {
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  return cells.map((c) => cell(c.x - minX, c.y - minY));
}

// Removes a unit from whichever group holds it (dropping its shape entry too);
// a group left empty disappears. Returns the same map when nothing changed.
function withoutMember(groups: ReadonlyMap<GroupId, Group>, unitId: UnitId): ReadonlyMap<GroupId, Group> {
  let changed = false;
  const next = new Map<GroupId, Group>();
  for (const [id, group] of groups) {
    const index = group.unitIds.indexOf(unitId);
    if (index === -1) {
      next.set(id, group);
      continue;
    }
    changed = true;
    const unitIds = group.unitIds.filter((_, i) => i !== index);
    const shape = group.shape.filter((_, i) => i !== index);
    if (unitIds.length > 0) {
      next.set(id, { ...group, unitIds, shape });
    }
  }
  return changed ? next : groups;
}

function isGrouped(state: BenchState, unitId: UnitId): boolean {
  for (const group of state.groups.values()) {
    if (group.unitIds.includes(unitId)) {
      return true;
    }
  }
  return false;
}

// Tray -> bench. The caller decides where; the core only checks the landing cell.
// A unit that belongs to a partner waiting in the tray cannot leave on its own:
// the partner is one object there, and comes out whole through takeGroup.
export function take(state: BenchState, unitId: UnitId, to: Cell): Result<BenchState> {
  const slot = state.tray.find((s) => s.unitId === unitId);
  if (slot === undefined) {
    return reject('not-in-tray');
  }
  if (isGrouped(state, unitId)) {
    return reject('grouped');
  }
  if (!inBounds(state.bounds, to)) {
    return reject('out-of-bounds');
  }
  if (!isAvailable(state, new Set([unitId]), to)) {
    return reject('occupied');
  }
  const bench = new Map(state.bench).set(unitId, to);
  return { ok: true, value: { ...state, bench, tray: clearTraySlot(state.tray, unitId) } };
}

// Bench -> bench for one unit only. Neighbours stay put, so pulling one block out
// of a cluster never drags the cluster along (AC-34). A grouped unit leaves its
// group: single-block and whole-partner gestures never share semantics (AC-40).
export function move(state: BenchState, unitId: UnitId, to: Cell): Result<BenchState> {
  if (!state.bench.has(unitId)) {
    return reject('not-on-bench');
  }
  if (!inBounds(state.bounds, to)) {
    return reject('out-of-bounds');
  }
  if (!isAvailable(state, new Set([unitId]), to)) {
    return reject('occupied');
  }
  const bench = new Map(state.bench).set(unitId, to);
  return { ok: true, value: { ...state, bench, groups: withoutMember(state.groups, unitId) } };
}

// Bench -> tray for one unit; it leaves its group on the way.
export function returnUnit(state: BenchState, unitId: UnitId): Result<BenchState> {
  if (!state.bench.has(unitId)) {
    return reject('not-on-bench');
  }
  const tray = placeInTray(state, state.tray, unitId);
  const bench = new Map(state.bench);
  bench.delete(unitId);
  return { ok: true, value: { ...state, bench, tray, groups: withoutMember(state.groups, unitId) } };
}

function allOnBench(state: BenchState, group: Group): boolean {
  return group.unitIds.every((u) => state.bench.has(u));
}

function allInTray(state: BenchState, group: Group): boolean {
  const inTray = new Set(state.tray.map((s) => s.unitId));
  return group.unitIds.every((u) => inTray.has(u));
}

// Whole-partner translation on the bench. Either every member lands, or nothing moves (AC-26).
export function moveGroup(state: BenchState, groupId: GroupId, delta: Cell): Result<BenchState> {
  const group = state.groups.get(groupId);
  if (group === undefined) {
    return reject('unknown-group');
  }
  if (!allOnBench(state, group)) {
    return reject('not-on-bench');
  }
  const movers = new Set(group.unitIds);
  const bench = new Map(state.bench);
  for (const unitId of group.unitIds) {
    const from = state.bench.get(unitId) as Cell;
    const to = cell(from.x + delta.x, from.y + delta.y);
    if (!inBounds(state.bounds, to)) {
      return reject('out-of-bounds');
    }
    if (!isAvailable(state, movers, to)) {
      return reject('occupied');
    }
    bench.set(unitId, to);
  }
  return { ok: true, value: { ...state, bench } };
}

// Tray -> bench for a whole partner in one commit: member i lands on origin + shape[i].
export function takeGroup(state: BenchState, groupId: GroupId, origin: Cell): Result<BenchState> {
  const group = state.groups.get(groupId);
  if (group === undefined) {
    return reject('unknown-group');
  }
  if (!allInTray(state, group)) {
    return reject('not-in-tray');
  }
  const bench = new Map(state.bench);
  const landing = new Set<string>();
  for (let i = 0; i < group.unitIds.length; i += 1) {
    const unitId = group.unitIds[i] as UnitId;
    const offset = group.shape[i] as Cell;
    const to = cell(origin.x + offset.x, origin.y + offset.y);
    if (!inBounds(state.bounds, to)) {
      return reject('out-of-bounds');
    }
    if (!isAvailable(state, new Set(), to) || landing.has(cellKey(to))) {
      return reject('occupied');
    }
    landing.add(cellKey(to));
    bench.set(unitId, to);
  }
  let tray = state.tray;
  for (const unitId of group.unitIds) {
    tray = clearTraySlot(tray, unitId);
  }
  return { ok: true, value: { ...state, bench, tray } };
}

// Bench -> tray for a whole partner in one commit. The shape is refreshed from the
// pose it had on the bench, so it comes back out the same way.
export function returnGroup(state: BenchState, groupId: GroupId): Result<BenchState> {
  const group = state.groups.get(groupId);
  if (group === undefined) {
    return reject('unknown-group');
  }
  if (!allOnBench(state, group)) {
    return reject('not-on-bench');
  }
  const shape = alignedShape(group.unitIds.map((u) => state.bench.get(u) as Cell));
  const bench = new Map(state.bench);
  let tray = state.tray;
  for (const unitId of group.unitIds) {
    tray = placeInTray(state, tray, unitId);
    bench.delete(unitId);
  }
  const groups = new Map(state.groups).set(groupId, { ...group, shape });
  return { ok: true, value: { ...state, bench, tray, groups } };
}

export function apply(state: BenchState, cmd: Command): Result<BenchState> {
  switch (cmd.type) {
    case 'take':
      return take(state, cmd.unitId, cmd.to);
    case 'move':
      return move(state, cmd.unitId, cmd.to);
    case 'return':
      return returnUnit(state, cmd.unitId);
    case 'moveGroup':
      return moveGroup(state, cmd.groupId, cmd.delta);
    case 'takeGroup':
      return takeGroup(state, cmd.groupId, cmd.origin);
    case 'returnGroup':
      return returnGroup(state, cmd.groupId);
  }
}

// Undo works on committed commands only; drag previews never reach the core.
export const MAX_UNDO = 8;

export interface History {
  readonly state: BenchState;
  readonly past: ReadonlyArray<BenchState>;
}

export function createHistory(state: BenchState): History {
  return { state, past: [] };
}

// Applies the command and, on success, pushes the previous state (bounded).
// A rejected command leaves the history untouched.
export function commit(history: History, cmd: Command, maxUndo: number = MAX_UNDO): Result<History> {
  const result = apply(history.state, cmd);
  if (!result.ok) {
    return result;
  }
  const past = [...history.past, history.state].slice(-maxUndo);
  return { ok: true, value: { state: result.value, past } };
}

export function undo(history: History): Result<History> {
  const previous = history.past[history.past.length - 1];
  if (previous === undefined) {
    return reject('nothing-to-undo');
  }
  return { ok: true, value: { state: previous, past: history.past.slice(0, -1) } };
}
