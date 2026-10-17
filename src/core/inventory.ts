import type { Bounds, Cell } from './grid';
import type { GroupId, UnitId } from './ids';

// Display-only colour tag. The core never reads it for arithmetic.
export type Hue = string;

export interface Unit {
  readonly id: UnitId;
  readonly hue: Hue;
}

export interface TraySlot {
  readonly slot: number;
  readonly unitId: UnitId | null;
}

// A partner that can be carried as one piece. `source` keeps the groups it was
// merged from so the UI can colour 3 + 4 as two visible parts of 7.
export interface Group {
  readonly id: GroupId;
  // Sorted. `shape` is index-aligned with it.
  readonly unitIds: ReadonlyArray<UnitId>;
  // Relative offsets (min x / y = 0): the body the partner takes when it lands
  // from the tray. On the bench the real cells are the truth.
  readonly shape: ReadonlyArray<Cell>;
  readonly source: ReadonlyArray<GroupId>;
}

export interface BenchState {
  // All material for this question. Commands never add or remove entries.
  readonly units: ReadonlyMap<UnitId, Unit>;
  // Units not on the bench wait here; one slot per unit, index === slot.
  readonly tray: ReadonlyArray<TraySlot>;
  // Committed bench positions.
  readonly bench: ReadonlyMap<UnitId, Cell>;
  // Chapter 2: partners that move as one. Members are all in the tray or all on the bench.
  readonly groups: ReadonlyMap<GroupId, Group>;
  // Configured per question by `content`; the core has no default.
  readonly bounds: Bounds;
  // The slot each unit was dealt into, so `return` can put it back where it came from.
  readonly home: ReadonlyMap<UnitId, number>;
}
