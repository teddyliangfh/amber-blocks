import { cell as makeCell } from '../core';
import type { Bounds, Cell, UnitId } from '../core';

// Pure geometry for the stage: where the bench grid and the tray sit, how big a
// cell is, and what a finger's release position means. No React, no DOM.

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

// 'below': the tray under the bench (portrait). 'side': the tray to the right
// of the bench (landscape, or wherever that keeps everything bigger).
export type Arrangement = 'below' | 'side';

export interface StageGeometry {
  readonly cell: number;
  readonly bench: Rect & { readonly cols: number; readonly rows: number };
  // The tray as drawn.
  readonly tray: Rect;
  // Where letting go of something puts it back in the tray: the drawn tray and
  // the sand around it. Drawn small, judged big (2026-10-16 review E-1).
  readonly trayZone: Rect;
  readonly gap: number;
  readonly arrangement: Arrangement;
}

export interface Footprint {
  readonly w: number;
  readonly h: number;
}

export const MIN_CELL = 28;
export const MAX_CELL = 84;
// Smallest size, in px, of one block waiting in the tray before the bench gives
// up room for it. Roughly a four-year-old's fingertip on a phone.
export const TRAY_MIN_BLOCK = 40;
export const TRAY_GAP = 8;
export const TRAY_PAD = 8;
// Sand left under the last row of a tray below the bench, beyond its padding.
// The tray is only as tall as what it holds plus this (2026-10-16 review E-1:
// on a tall phone the first stop's tray was two thirds empty sand).
export const TRAY_SLACK = 24;
// A mat this wide may use the screen's side margins (2026-10-16 review #7):
// 3 + 4 is 8 columns, the widest, and the margin was a column's worth of size.
export const WIDE_MAT_COLS = 8;
const SCALE_STEP = 0.01;

interface Frame {
  readonly bench: StageGeometry['bench'];
  readonly tray: Rect;
  readonly trayZone: Rect;
}

function frameFor(arrangement: Arrangement, stageWidth: number, stageHeight: number, bounds: Bounds, cell: number, gap: number): Frame | null {
  const benchWidth = cell * bounds.cols;
  const benchHeight = cell * bounds.rows;
  if (arrangement === 'below') {
    const trayHeight = stageHeight - benchHeight - 3 * gap;
    const margin = bounds.cols >= WIDE_MAT_COLS ? 0 : gap;
    if (benchWidth > stageWidth - 2 * margin || trayHeight <= 0) {
      return null;
    }
    const bench = { x: Math.floor((stageWidth - benchWidth) / 2), y: gap, width: benchWidth, height: benchHeight, cols: bounds.cols, rows: bounds.rows };
    const tray = { x: gap, y: bench.y + benchHeight + gap, width: stageWidth - 2 * gap, height: trayHeight };
    return { bench, tray, trayZone: tray };
  }
  const trayWidth = stageWidth - benchWidth - 3 * gap;
  if (benchHeight > stageHeight - 2 * gap || trayWidth <= 0) {
    return null;
  }
  const bench = { x: gap, y: gap, width: benchWidth, height: benchHeight, cols: bounds.cols, rows: bounds.rows };
  const tray = { x: bench.x + benchWidth + gap, y: gap, width: trayWidth, height: stageHeight - 2 * gap };
  return { bench, tray, trayZone: tray };
}

// A tray below the bench shrinks to what it holds (rows + padding + TRAY_SLACK)
// and the bench and tray together sit in the middle of the stage; the sand
// below catches the eye (LevelScreen's dune). Letting go anywhere from the
// tray's top edge to the bottom of the stage still puts things back
// (trayZone). The objects' size is unchanged: the rows fit the smaller tray
// at the same scale, so the tray never reflows while playing.
function settle(geo: StageGeometry, items: ReadonlyArray<Footprint>, stageHeight: number): StageGeometry {
  if (geo.arrangement !== 'below' || items.length === 0) {
    return geo;
  }
  const { scale } = fitTray(geo, items);
  const rows = packRows(items, geo.cell * scale, geo.tray.width - 2 * TRAY_PAD, TRAY_GAP);
  if (rows === null) {
    return geo;
  }
  const height = Math.min(geo.tray.height, Math.ceil(rowsHeight(rows, TRAY_GAP)) + 2 * TRAY_PAD + TRAY_SLACK);
  const shift = Math.floor((geo.tray.height - height) / 2);
  const bench = { ...geo.bench, y: geo.bench.y + shift };
  const tray = { ...geo.tray, y: bench.y + bench.height + geo.gap, height };
  return { ...geo, bench, tray, trayZone: { ...tray, height: stageHeight - geo.gap - tray.y } };
}

// Picks the biggest bench cell for which the tray still shows every object at a
// comfortable size, trying the tray below and beside the bench. When no layout
// reaches that size, the one with the biggest tray blocks wins; the tray never
// overflows either way (layoutTray shrinks until everything is inside).
//
// `rail`: rows kept free right above the bench (Phase 23c: a compare's rail,
// CompareRail, one row at the bench's cell size). The stage is laid out as
// if the bench had those rows too, then the bench is the rows below them.
export function computeGeometry(stageWidth: number, stageHeight: number, bounds: Bounds, trayItems: ReadonlyArray<Footprint> = [], gap = 12, rail = 0): StageGeometry {
  if (rail > 0) {
    const geo = computeGeometry(stageWidth, stageHeight, { cols: bounds.cols, rows: bounds.rows + rail }, trayItems, gap);
    const above = geo.cell * rail;
    return { ...geo, bench: { ...geo.bench, y: geo.bench.y + above, height: geo.bench.height - above, rows: bounds.rows } };
  }
  return settle(chooseGeometry(stageWidth, stageHeight, bounds, trayItems, gap), trayItems, stageHeight);
}

function chooseGeometry(stageWidth: number, stageHeight: number, bounds: Bounds, trayItems: ReadonlyArray<Footprint>, gap: number): StageGeometry {
  interface Candidate {
    readonly geo: StageGeometry;
    readonly block: number;
  }
  const best = (arrangement: Arrangement): { comfortable: Candidate | null; fallback: Candidate | null } => {
    let fallback: Candidate | null = null;
    for (let cell = MAX_CELL; cell >= MIN_CELL; cell -= 1) {
      const frame = frameFor(arrangement, stageWidth, stageHeight, bounds, cell, gap);
      if (frame === null) {
        continue;
      }
      const geo: StageGeometry = { cell, ...frame, gap, arrangement };
      const block = trayItems.length === 0 ? cell : cell * fitTray(geo, trayItems).scale;
      const candidate = { geo, block };
      if (block >= TRAY_MIN_BLOCK || block >= cell) {
        return { comfortable: candidate, fallback };
      }
      if (fallback === null || block > fallback.block) {
        fallback = candidate;
      }
    }
    return { comfortable: null, fallback };
  };
  const below = best('below');
  const side = best('side');
  if (below.comfortable !== null || side.comfortable !== null) {
    if (side.comfortable === null) {
      return (below.comfortable as Candidate).geo;
    }
    if (below.comfortable === null) {
      return side.comfortable.geo;
    }
    return side.comfortable.geo.cell > below.comfortable.geo.cell ? side.comfortable.geo : below.comfortable.geo;
  }
  const fallbacks = [below.fallback, side.fallback].filter((c): c is Candidate => c !== null);
  if (fallbacks.length > 0) {
    return fallbacks.reduce((a, b) => (b.block > a.block ? b : a)).geo;
  }
  // The stage is too small for any frame: keep the old floor so nothing divides by zero.
  const cell = MIN_CELL;
  const benchWidth = cell * bounds.cols;
  const benchHeight = cell * bounds.rows;
  const bench = { x: Math.floor((stageWidth - benchWidth) / 2), y: gap, width: benchWidth, height: benchHeight, cols: bounds.cols, rows: bounds.rows };
  const tray = { x: gap, y: bench.y + benchHeight + gap, width: Math.max(0, stageWidth - 2 * gap), height: Math.max(0, stageHeight - benchHeight - 3 * gap) };
  return { cell, bench, tray, trayZone: tray, gap, arrangement: 'below' };
}

// A mat on its own, as big as fits the box (at most MAX_CELL a cell), with no
// tray: for showing finished work, not for play.
export function showcaseGeometry(width: number, height: number, bounds: Bounds): StageGeometry {
  const cell = Math.max(1, Math.min(MAX_CELL, Math.floor(width / bounds.cols), Math.floor(height / bounds.rows)));
  const bench = { x: Math.floor((width - cell * bounds.cols) / 2), y: 0, width: cell * bounds.cols, height: cell * bounds.rows, cols: bounds.cols, rows: bounds.rows };
  const tray = { x: 0, y: bench.height, width: 0, height: 0 };
  return { cell, bench, tray, trayZone: tray, gap: 0, arrangement: 'below' };
}

export function cellToPx(geo: StageGeometry, c: Cell): { readonly x: number; readonly y: number } {
  return { x: geo.bench.x + c.x * geo.cell, y: geo.bench.y + c.y * geo.cell };
}

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height;
}

export type DropTarget =
  | { readonly kind: 'bench'; readonly origin: Cell }
  | { readonly kind: 'tray' }
  | { readonly kind: 'none' };

// Where a released object wants to go. The tray wins when the object's centre is
// over it (its zone: the drawn tray and the sand below it); otherwise the nearest grid origin, clamped into the bench so a near
// miss at the edge still lands. Occupancy and bounds are the core's call.
export function resolveDrop(geo: StageGeometry, topLeft: { readonly x: number; readonly y: number }, footprint: Footprint): DropTarget {
  const centre = { x: topLeft.x + (footprint.w * geo.cell) / 2, y: topLeft.y + (footprint.h * geo.cell) / 2 };
  if (inRect(geo.trayZone, centre.x, centre.y)) {
    return { kind: 'tray' };
  }
  const slack = geo.cell / 2;
  const benchPlus = { x: geo.bench.x - slack, y: geo.bench.y - slack, width: geo.bench.width + 2 * slack, height: geo.bench.height + 2 * slack };
  if (!inRect(benchPlus, centre.x, centre.y)) {
    return { kind: 'none' };
  }
  if (footprint.w > geo.bench.cols || footprint.h > geo.bench.rows) {
    return { kind: 'none' };
  }
  const rawX = Math.round((topLeft.x - geo.bench.x) / geo.cell);
  const rawY = Math.round((topLeft.y - geo.bench.y) / geo.cell);
  const x = Math.min(Math.max(rawX, 0), geo.bench.cols - footprint.w);
  const y = Math.min(Math.max(rawY, 0), geo.bench.rows - footprint.h);
  return { kind: 'bench', origin: makeCell(x, y) };
}

// Where a piece let go over a taken spot may land instead (Phase 20, play
// review Q12: a partner half a cell off, or a block on a taken cell, bounced
// all the way back). Every origin within one cell of where it was let go that
// keeps the piece on the mat, nearest first: the four sides, then the corners,
// each in reading order. The stage takes the first the core accepts (a partner
// first trying those where it would touch another partner).
export function nearbyOrigins(origin: Cell, footprint: Footprint, cols: number, rows: number): ReadonlyArray<Cell> {
  const out: { readonly cell: Cell; readonly d: number }[] = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const x = origin.x + dx;
      const y = origin.y + dy;
      if ((dx === 0 && dy === 0) || x < 0 || y < 0 || x + footprint.w > cols || y + footprint.h > rows) {
        continue;
      }
      out.push({ cell: makeCell(x, y), d: Math.abs(dx) + Math.abs(dy) });
    }
  }
  return out.sort((a, b) => a.d - b.d || a.cell.y - b.cell.y || a.cell.x - b.cell.x).map((o) => o.cell);
}

// Where a piece let go at `origin` comes to rest: there when `accepts` it,
// else the first nearby origin it accepts, one where `prefer` holds first (a
// partner beside another partner). Null: nowhere near fits; it bounces back.
export function settleOrigin(origin: Cell, footprint: Footprint, cols: number, rows: number, accepts: (o: Cell) => boolean, prefer?: (o: Cell) => boolean): Cell | null {
  if (accepts(origin)) {
    return origin;
  }
  const near = nearbyOrigins(origin, footprint, cols, rows).filter(accepts);
  return (prefer === undefined ? undefined : near.find(prefer)) ?? near[0] ?? null;
}

export interface TrayItem {
  readonly id: string;
  readonly footprint: Footprint;
}

export interface TrayPlacement {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

interface Row {
  readonly items: ReadonlyArray<Footprint>;
  readonly width: number;
  readonly height: number;
}

// Rows in the given order, each as tall as its tallest item. Null when one
// item alone is wider than the tray. `firstFit` puts an item into the first row
// that still has room for it instead of only the last one, so a spare block can
// sit beside a tall partner rather than open a row of its own.
function packOnce<T extends Footprint>(items: ReadonlyArray<T>, unit: number, maxWidth: number, gap: number, firstFit: boolean): ReadonlyArray<Row & { readonly items: ReadonlyArray<T> }> | null {
  const rows: { items: T[]; width: number; height: number }[] = [];
  for (const item of items) {
    const w = item.w * unit;
    const h = item.h * unit;
    if (w > maxWidth) {
      return null;
    }
    const fits = (r: { width: number }) => r.width + gap + w <= maxWidth;
    const last = rows[rows.length - 1];
    const row = firstFit ? rows.find(fits) : last !== undefined && fits(last) ? last : undefined;
    if (row !== undefined) {
      row.items.push(item);
      row.width += gap + w;
      row.height = Math.max(row.height, h);
    } else {
      rows.push({ items: [item], width: w, height: h });
    }
  }
  return rows;
}

// The shortest of three packings, plain wrapping first on a tie: wrapping in
// deal order, first fit in deal order, and first fit placing tall partners
// first (inside each row the deal order still holds). The tray only ever gets
// more compact, and that height goes back to the bench and its blocks (17 on a
// 375×553 phone: 29px blocks with plain wrapping alone, 34px now).
function packRows<T extends Footprint>(items: ReadonlyArray<T>, unit: number, maxWidth: number, gap: number): ReadonlyArray<Row & { readonly items: ReadonlyArray<T> }> | null {
  const wrapped = packOnce(items, unit, maxWidth, gap, false);
  if (wrapped === null) {
    return null;
  }
  const rank = new Map(items.map((item, i) => [item, i]));
  const tallFirst = [...items].sort((a, b) => b.h - a.h || b.w - a.w || rank.get(a)! - rank.get(b)!);
  const tall = packOnce(tallFirst, unit, maxWidth, gap, true)!.map((row) => ({ ...row, items: [...row.items].sort((a, b) => rank.get(a)! - rank.get(b)!) }));
  const candidates = [wrapped, packOnce(items, unit, maxWidth, gap, true)!, tall];
  return candidates.reduce((best, c) => (rowsHeight(c, gap) < rowsHeight(best, gap) ? c : best));
}

function rowsHeight(rows: ReadonlyArray<Row>, gap: number): number {
  return rows.reduce((sum, r) => sum + r.height, 0) + gap * Math.max(0, rows.length - 1);
}

// The biggest scale (≤ 1) at which every item fits inside the tray, width and
// height both, with each row as tall as its own tallest item.
export function fitTray(geo: StageGeometry, items: ReadonlyArray<Footprint>, gap = TRAY_GAP): { readonly scale: number } {
  const innerWidth = geo.tray.width - 2 * TRAY_PAD;
  const innerHeight = geo.tray.height - 2 * TRAY_PAD;
  for (let scale = 1; scale > SCALE_STEP / 2; scale = Math.round((scale - SCALE_STEP) * 100) / 100) {
    const rows = packRows(items, geo.cell * scale, innerWidth, gap);
    if (rows !== null && rowsHeight(rows, gap) <= innerHeight) {
      return { scale };
    }
  }
  return { scale: SCALE_STEP };
}

// Items flow left to right and wrap onto new rows (see packRows), all at one
// scale, so the tray never scrolls under a finger and nothing sits outside it.
// Rows start at the top of the tray, next to the bench; each row is centred.
export function layoutTray(geo: StageGeometry, items: ReadonlyArray<TrayItem>, gap = TRAY_GAP): ReadonlyArray<TrayPlacement> {
  if (items.length === 0) {
    return [];
  }
  const { scale } = fitTray(geo, items.map((i) => i.footprint), gap);
  const unit = geo.cell * scale;
  const tagged = items.map((item) => ({ ...item.footprint, item }));
  const rows = packRows(tagged, unit, geo.tray.width - 2 * TRAY_PAD, gap) ?? [{ items: tagged, width: 0, height: 0 }];
  const out: TrayPlacement[] = [];
  let y = geo.tray.y + TRAY_PAD;
  for (const row of rows) {
    let x = geo.tray.x + (geo.tray.width - row.width) / 2;
    for (const t of row.items) {
      out.push({ id: t.item.id, x, y: y + (row.height - t.h * unit) / 2, scale });
      x += t.w * unit + gap;
    }
    y += row.height + gap;
  }
  // In the order given, whichever row each item landed in.
  const index = new Map(items.map((item, i) => [item.id, i]));
  return out.sort((a, b) => index.get(a.id)! - index.get(b.id)!);
}

// How far, in cells, a counting tap may land from a block and still count it.
// Half a cell reaches the blocks beside the one under the finger, not the diagonals.
export const COUNT_SLOP = 0.5;

// Which bench block a counting tap counts. A tap on a block not yet counted
// counts that block. A tap on a block already counted counts nothing
// (2026-10-16 review A-2: tapping the same block again used to count the
// neighbour the finger was half a cell from, so the classic one-to-one slip,
// counting a block twice, was quietly corrected for the child). A tap that
// hits no block (a gap in a partner's box) counts the uncounted block nearest
// the finger within COUNT_SLOP, so a slightly-off finger on a crowded bench
// still gets the next number. Null: nothing to count there. `point` is in stage px.
export function countTarget(
  geo: StageGeometry,
  bench: ReadonlyMap<UnitId, Cell>,
  counted: ReadonlyMap<UnitId, number>,
  hit: UnitId | null,
  point: { readonly x: number; readonly y: number },
): UnitId | null {
  if (hit !== null) {
    return counted.has(hit) ? null : hit;
  }
  let best: { id: UnitId; d: number; c: Cell } | null = null;
  for (const [id, c] of bench) {
    if (counted.has(id)) {
      continue;
    }
    const p = cellToPx(geo, c);
    const dx = Math.max(p.x - point.x, 0, point.x - (p.x + geo.cell));
    const dy = Math.max(p.y - point.y, 0, point.y - (p.y + geo.cell));
    const d = Math.hypot(dx, dy);
    if (d > COUNT_SLOP * geo.cell + 1e-9) {
      continue;
    }
    if (best === null || d < best.d - 1e-9 || (Math.abs(d - best.d) <= 1e-9 && (c.y < best.c.y || (c.y === best.c.y && c.x < best.c.x)))) {
      best = { id, d, c };
    }
  }
  return best?.id ?? null;
}

// Which block of a partner a point (relative to the partner at rest) falls on,
// or -1 for a gap in its box. Lets a tap count one block of a whole partner.
export function blockAt(offsets: ReadonlyArray<Cell>, cell: number, point: { readonly x: number; readonly y: number }): number {
  const cx = Math.floor(point.x / cell);
  const cy = Math.floor(point.y / cell);
  return offsets.findIndex((c) => c.x === cx && c.y === cy);
}

// Where the partner's number sits, inside its own outline (2026-10-15 review:
// hung off the bottom-right corner it was cut by the mat's frame at the right
// edge and crowded the next partner in the tray). It sits in the bottom-right
// corner of the last block of the top row: never on the face (the head block,
// except for a partner of one, where it stays below the cheek), never on a
// counting number (top-right of each block), never outside the outline.
export function labelSpot(offsets: ReadonlyArray<Cell>, cell: number): { readonly left: number; readonly top: number; readonly size: number } {
  const top = Math.min(...offsets.map((c) => c.y));
  const tail = offsets.filter((c) => c.y === top).reduce((a, b) => (b.x > a.x ? b : a));
  const size = Math.max(16, Math.round(cell * (offsets.length === 1 ? 0.4 : 0.5)));
  const pad = Math.max(2, Math.round(cell * 0.04));
  return { left: (tail.x + 1) * cell - size - pad, top: (tail.y + 1) * cell - size - pad, size };
}

// Bounding box of a set of cells, in cells, plus each cell's offset inside it.
export function footprintOf(cells: ReadonlyArray<Cell>): { readonly origin: Cell; readonly footprint: Footprint; readonly offsets: ReadonlyArray<Cell> } {
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const maxX = Math.max(...cells.map((c) => c.x));
  const maxY = Math.max(...cells.map((c) => c.y));
  return {
    origin: makeCell(minX, minY),
    footprint: { w: maxX - minX + 1, h: maxY - minY + 1 },
    offsets: cells.map((c) => makeCell(c.x - minX, c.y - minY)),
  };
}
