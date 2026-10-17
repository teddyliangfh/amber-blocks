import { apply, cell, createBenchState, defineGroup, groupId, unitIds } from '../core';
import type { BenchState, Bounds, Cell, GroupId, Hue, Unit } from '../core';
import { fnv1a, mulberry32, seedOf } from './rng';
import type { PuzzleRef } from './schema';

// Theme colour token of a number partner. Display only; the core never reads it.
export function hueFor(n: number): Hue {
  return `n${Math.min(Math.max(Math.trunc(n), 1), 10)}`;
}

// The standard body of a partner: one row up to 5, two rows (5 on top) up to 10.
export function bodyOf(n: number): ReadonlyArray<Cell> {
  if (!Number.isInteger(n) || n < 1 || n > 10) {
    throw new Error(`content: bodyOf expects 1..10, got ${n}`);
  }
  const cells: Cell[] = [];
  for (let i = 0; i < Math.min(n, 5); i += 1) {
    cells.push(cell(i, 0));
  }
  for (let i = 0; i < n - 5; i += 1) {
    cells.push(cell(i, 1));
  }
  return cells;
}

// Bigger numbers are carried as a few handles rather than one body: 17 = 10 + 5 + 2 (AC-46).
export function handlesFor(n: number): ReadonlyArray<number> {
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`content: handlesFor expects a positive integer, got ${n}`);
  }
  if (n <= 10) {
    return [n];
  }
  const out: number[] = [];
  let rest = n;
  while (rest > 10) {
    out.push(10);
    rest -= 10;
  }
  if (rest > 5) {
    out.push(5);
    rest -= 5;
  }
  if (rest > 0) {
    out.push(rest);
  }
  return out;
}

// Chapter 1 material: target + extra loose blocks, all in the stop's theme colour.
// The count comes from identities alone; the shared hue proves it (AC-20).
export function looseMaterial(target: number, extra: number, bounds: Bounds, prefix: string): BenchState {
  if (!Number.isInteger(extra) || extra < 1) {
    throw new Error(`content: extra must be at least 1, got ${extra}`);
  }
  const units: Unit[] = unitIds(prefix, target + extra).map((id) => ({ id, hue: hueFor(target) }));
  return createBenchState({ units, bounds });
}

// Chapter 1 big numbers: the target as a few partners to carry (and single
// blocks for whatever they leave), decoy partners the answer does not need,
// and spare single blocks. Spares are coloured as ones
// (as they turn on the bench): in the near-white of 10 they looked like empty slots.
// `order` deals the partners into the tray; the count is still judged by identities.
export function handleMaterial(
  target: number,
  handles: ReadonlyArray<number>,
  extra: number,
  bounds: Bounds,
  prefix: string,
  { decoys, order }: { readonly decoys: ReadonlyArray<number>; readonly order: (sizes: ReadonlyArray<number>) => ReadonlyArray<number> },
): PartnerMaterial {
  if (!Number.isInteger(extra) || extra < 1) {
    throw new Error(`content: extra must be at least 1, got ${extra}`);
  }
  const sum = handles.reduce((a, b) => a + b, 0);
  if (sum > target) {
    throw new Error(`content: handles ${handles.join('+')} do not add up to ${target}`);
  }
  const sizes = order([...handles, ...decoys]);
  const units: Unit[] = [];
  const members: UnitIdList[] = [];
  sizes.forEach((size, index) => {
    const ids = unitIds(`${prefix}-h${index}`, size);
    members.push(ids);
    for (const id of ids) {
      units.push({ id, hue: hueFor(size) });
    }
  });
  // Single blocks: what the handles leave of the target, plus the spares.
  for (const id of unitIds(`${prefix}-x`, target - sum + extra)) {
    units.push({ id, hue: hueFor(1) });
  }
  let state = createBenchState({ units, bounds });
  const partnerIds: GroupId[] = [];
  sizes.forEach((size, index) => {
    const id = groupId(`${prefix}-h${index}`);
    const r = defineGroup(state, id, members[index] as UnitIdList, bodyOf(size));
    if (!r.ok) {
      throw new Error(`content: could not define handle ${id}: ${r.reason}`);
    }
    state = r.value;
    partnerIds.push(id);
  });
  return { state, partnerIds };
}

export interface PartnerMaterial {
  readonly state: BenchState;
  // Tray order; the number label of each is groupSize().
  readonly partnerIds: ReadonlyArray<GroupId>;
}

// Chapter 2 material: one partner per size, dealt into the tray in the given order.
export function partnerMaterial(sizes: ReadonlyArray<number>, bounds: Bounds, prefix: string): PartnerMaterial {
  const units: Unit[] = [];
  const members: UnitIdList[] = [];
  sizes.forEach((size, index) => {
    const ids = unitIds(`${prefix}-p${index}`, size);
    members.push(ids);
    for (const id of ids) {
      units.push({ id, hue: hueFor(size) });
    }
  });
  let state = createBenchState({ units, bounds });
  const partnerIds: GroupId[] = [];
  sizes.forEach((size, index) => {
    const id = groupId(`${prefix}-p${index}`);
    const r = defineGroup(state, id, members[index] as UnitIdList, bodyOf(size));
    if (!r.ok) {
      throw new Error(`content: could not define partner ${id}: ${r.reason}`);
    }
    state = r.value;
    partnerIds.push(id);
  });
  return { state, partnerIds };
}

// "Who's missing?" material (Phase 19): the tray partners as dealt (the
// missing half and the distractors, in tray order), then the given partner,
// which moves straight onto the mat: at the left edge, at a height that leaves
// room for the other half (`beside`, its size) to join it on the right. Its
// tray slots stay its home (core invariant 1), so it can always go back.
export function givenMaterial(given: number, beside: number, sizes: ReadonlyArray<number>, bounds: Bounds, prefix: string): PartnerMaterial & { readonly given: GroupId } {
  const material = partnerMaterial([...sizes, given], bounds, prefix);
  const id = material.partnerIds[material.partnerIds.length - 1] as GroupId;
  const height = Math.max(...[given, beside].map((n) => Math.max(...bodyOf(n).map((c) => c.y)) + 1));
  const r = apply(material.state, { type: 'takeGroup', groupId: id, origin: cell(0, Math.max(0, Math.floor((bounds.rows - height) / 2))) });
  if (!r.ok) {
    throw new Error(`content: could not put the given partner on the mat: ${r.reason}`);
  }
  return { state: r.value, partnerIds: material.partnerIds, given: id };
}

type UnitIdList = ReturnType<typeof unitIds>;

const MAX_RESHUFFLES = 8;

// Tray order for the partners of a given attempt. Variant k reshuffles until it
// differs from variant k-1, so the right partner does not sit in the same spot
// every time a child asks for a new one. Labels with no distinct order stop early.
export function partnerOrder(ref: PuzzleRef, labels: ReadonlyArray<number>): ReadonlyArray<number> {
  const rng = mulberry32(fnv1a(`tray|${seedOf(ref)}`));
  let order = rng.shuffle(labels);
  if (ref.attemptVariant === 0) {
    return order;
  }
  const previous = partnerOrder({ ...ref, attemptVariant: ref.attemptVariant - 1 }, labels).join();
  for (let tries = 0; tries < MAX_RESHUFFLES && order.join() === previous; tries += 1) {
    order = rng.shuffle(labels);
  }
  return order;
}
