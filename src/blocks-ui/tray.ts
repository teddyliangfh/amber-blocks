import type { BenchState, Cell, Group, GroupId, UnitId } from '../core';
import { footprintOf, layoutTray } from './layout';
import type { Footprint, StageGeometry, TrayPlacement } from './layout';

// The tray as a fixed set of objects, decided once from the puzzle's starting
// material: one per partner, one per loose block. Taking something out leaves a
// marked gap; putting it back fills the same gap. Nothing else moves or rescales,
// because the set of objects, and so the layout, never changes (PRD 4.1).

export interface TrayObject {
  // The partner's group id, or `slot-<n>` for a loose block.
  readonly id: string;
  readonly groupId: GroupId | null;
  readonly footprint: Footprint;
  // The cells of the object's outline, offsets from its top-left.
  readonly cells: ReadonlyArray<Cell>;
  // Which tray slots live in this object, and where inside it.
  readonly homes: ReadonlyArray<{ readonly slot: number; readonly offset: Cell }>;
}

export function trayObjects(material: BenchState): ReadonlyArray<TrayObject> {
  const grouped = new Set<UnitId>();
  const partners: TrayObject[] = [];
  for (const group of material.groups.values()) {
    const { footprint, offsets } = footprintOf(group.shape);
    const homes = group.unitIds.flatMap((u, i) => {
      grouped.add(u);
      const slot = material.home.get(u);
      return slot === undefined ? [] : [{ slot, offset: offsets[i] as Cell }];
    });
    partners.push({ id: group.id as string, groupId: group.id, footprint, cells: offsets, homes });
  }
  const loose: TrayObject[] = [];
  for (const [unitId, slot] of [...material.home.entries()].sort(([, a], [, b]) => a - b)) {
    if (!grouped.has(unitId)) {
      loose.push({ id: `slot-${slot}`, groupId: null, footprint: { w: 1, h: 1 }, cells: [{ x: 0, y: 0 }], homes: [{ slot, offset: { x: 0, y: 0 } }] });
    }
  }
  return [...partners, ...loose];
}

export interface TrayPlan {
  readonly objects: ReadonlyArray<TrayObject>;
  readonly spots: ReadonlyMap<string, TrayPlacement>;
  // Where the block of each tray slot rests when it is shown on its own.
  readonly slotSpots: ReadonlyMap<number, TrayPlacement>;
}

export function planTray(geo: StageGeometry, objects: ReadonlyArray<TrayObject>): TrayPlan {
  const spots = new Map(layoutTray(geo, objects.map((o) => ({ id: o.id, footprint: o.footprint }))).map((p) => [p.id, p]));
  const slotSpots = new Map<number, TrayPlacement>();
  for (const o of objects) {
    const spot = spots.get(o.id);
    if (spot === undefined) {
      continue;
    }
    for (const h of o.homes) {
      const unit = geo.cell * spot.scale;
      slotSpots.set(h.slot, { id: `slot-${h.slot}`, x: spot.x + h.offset.x * unit, y: spot.y + h.offset.y * unit, scale: spot.scale });
    }
  }
  return { objects, spots, slotSpots };
}

export interface TrayView {
  // Partners waiting whole in the tray, at their fixed spot.
  readonly partners: ReadonlyArray<{ readonly group: Group; readonly spot: TrayPlacement }>;
  // Single blocks waiting in the tray, at their slot's spot.
  readonly units: ReadonlyArray<{ readonly unitId: UnitId; readonly spot: TrayPlacement }>;
  // Gaps left by single blocks that are on the bench.
  readonly emptySlots: ReadonlyArray<TrayPlacement>;
  // Outlines left by partners that are on the bench.
  readonly emptyPartners: ReadonlyArray<{ readonly spot: TrayPlacement; readonly cells: ReadonlyArray<Cell> }>;
}

// What the tray shows for a committed state. Only occupancy changes; every
// object keeps the spot and scale the plan gave it.
export function trayView(plan: TrayPlan, state: BenchState): TrayView {
  const inTray = new Set<UnitId>();
  for (const slot of state.tray) {
    if (slot.unitId !== null) {
      inTray.add(slot.unitId);
    }
  }
  const asPartner = new Set<UnitId>();
  const partners: { group: Group; spot: TrayPlacement }[] = [];
  const emptyPartners: { spot: TrayPlacement; cells: ReadonlyArray<Cell> }[] = [];
  const emptySlots: TrayPlacement[] = [];
  for (const o of plan.objects) {
    const spot = plan.spots.get(o.id);
    if (spot === undefined) {
      continue;
    }
    if (o.groupId === null) {
      const home = o.homes[0];
      if (home !== undefined && state.tray[home.slot]?.unitId === null) {
        emptySlots.push(spot);
      }
      continue;
    }
    const group = state.groups.get(o.groupId);
    if (group !== undefined && group.unitIds.every((u) => inTray.has(u))) {
      partners.push({ group, spot });
      for (const u of group.unitIds) {
        asPartner.add(u);
      }
    } else {
      emptyPartners.push({ spot, cells: o.cells });
    }
  }
  const units: { unitId: UnitId; spot: TrayPlacement }[] = [];
  for (const slot of state.tray) {
    if (slot.unitId === null || asPartner.has(slot.unitId)) {
      continue;
    }
    const spot = plan.slotSpots.get(slot.slot);
    if (spot !== undefined) {
      units.push({ unitId: slot.unitId, spot });
    }
  }
  return { partners, units, emptySlots, emptyPartners };
}
