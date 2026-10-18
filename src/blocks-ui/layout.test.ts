import { cell, unitId } from '../core';
import { CHAPTERS, CONTENT_VERSION, materialize } from '../content';
import { LEVEL_CHROME, portraitChrome } from './chrome';
import { PHONES, isCompact, stageSizeOf } from './devices';
import { COUNT_SLOP, MIN_CELL, TRAY_MIN_BLOCK, TRAY_PAD, TRAY_SLACK, WIDE_MAT_COLS, blockAt, cellToPx, computeGeometry, countTarget, fitTray, footprintOf, inRect, labelSpot, layoutTray, nearbyOrigins, resolveDrop, settleOrigin } from './layout';
import type { Footprint, Rect, StageGeometry, TrayItem } from './layout';
import { trayObjects } from './tray';

const geo = computeGeometry(390, 700, { cols: 6, rows: 5 });

function items(footprints: ReadonlyArray<Footprint>): ReadonlyArray<TrayItem> {
  return footprints.map((footprint, i) => ({ id: `i${i}`, footprint }));
}

function inside(outer: Rect, inner: Rect): boolean {
  const eps = 0.001;
  return inner.x >= outer.x - eps && inner.y >= outer.y - eps && inner.x + inner.width <= outer.x + outer.width + eps && inner.y + inner.height <= outer.y + outer.height + eps;
}

function overlap(a: Rect, b: Rect): boolean {
  const eps = 0.001;
  return a.x < b.x + b.width - eps && b.x < a.x + a.width - eps && a.y < b.y + b.height - eps && b.y < a.y + a.height - eps;
}

// Every placement as a rectangle in px.
function boxes(g: StageGeometry, list: ReadonlyArray<TrayItem>): ReadonlyArray<Rect> {
  const placed = layoutTray(g, list);
  return placed.map((p, i) => {
    const f = list[i]!.footprint;
    return { x: p.x, y: p.y, width: f.w * g.cell * p.scale, height: f.h * g.cell * p.scale };
  });
}

describe('layout', () => {
  test('geometry: bench as big as the width allows, tray takes the rest below', () => {
    expect(geo.cell).toBe(61);
    expect(geo.bench.width).toBe(366);
    expect(geo.bench.x).toBe(12);
    expect(geo.arrangement).toBe('below');
    expect(geo.tray.y).toBe(geo.bench.y + geo.bench.height + geo.gap);
    expect(geo.tray.y + geo.tray.height).toBe(700 - geo.gap);
    const short = computeGeometry(390, 400, { cols: 6, rows: 5 }, Array.from({ length: 11 }, () => ({ w: 1, h: 1 })));
    expect(short.cell).toBeLessThan(geo.cell);
    expect(computeGeometry(100, 100, { cols: 8, rows: 6 }).cell).toBe(MIN_CELL);
    expect(computeGeometry(4000, 4000, { cols: 2, rows: 2 }).cell).toBe(84);
  });

  test('geometry: a wide, short stage puts the tray beside the bench', () => {
    const wide = computeGeometry(600, 340, { cols: 6, rows: 5 }, [{ w: 5, h: 2 }, { w: 5, h: 1 }, { w: 2, h: 1 }, { w: 1, h: 1 }, { w: 1, h: 1 }]);
    expect(wide.arrangement).toBe('side');
    expect(wide.tray.x).toBe(wide.bench.x + wide.bench.width + wide.gap);
    expect(inside({ x: 0, y: 0, width: 600, height: 340 }, wide.bench)).toBe(true);
    expect(inside({ x: 0, y: 0, width: 600, height: 340 }, wide.tray)).toBe(true);
  });

  test('geometry: the bench shrinks before tray blocks drop below a comfortable size', () => {
    const many = Array.from({ length: 11 }, () => ({ w: 1, h: 1 }));
    const g = computeGeometry(375, 385, { cols: 6, rows: 5 }, many);
    expect(g.cell * fitTray(g, many).scale).toBeGreaterThanOrEqual(Math.min(TRAY_MIN_BLOCK, g.cell));
  });

  test('cellToPx and inRect', () => {
    expect(cellToPx(geo, cell(2, 1))).toEqual({ x: geo.bench.x + 122, y: geo.bench.y + 61 });
    expect(inRect(geo.bench, geo.bench.x, geo.bench.y)).toBe(true);
    expect(inRect(geo.bench, geo.bench.x + geo.bench.width, geo.bench.y)).toBe(false);
  });

  test('resolveDrop: tray by centre, bench by nearest origin with clamping, none far away', () => {
    const one = { w: 1, h: 1 };
    const trayPoint = { x: geo.tray.x + 10, y: geo.tray.y + 10 };
    expect(resolveDrop(geo, trayPoint, one)).toEqual({ kind: 'tray' });
    const exact = cellToPx(geo, cell(3, 2));
    expect(resolveDrop(geo, exact, one)).toEqual({ kind: 'bench', origin: cell(3, 2) });
    expect(resolveDrop(geo, { x: exact.x + 20, y: exact.y - 25 }, one)).toEqual({ kind: 'bench', origin: cell(3, 2) });
    const pastRight = cellToPx(geo, cell(6, 0));
    expect(resolveDrop(geo, { x: pastRight.x - 20, y: pastRight.y }, one)).toEqual({ kind: 'bench', origin: cell(5, 0) });
    expect(resolveDrop(geo, { x: -200, y: -200 }, one)).toEqual({ kind: 'none' });
    const square = { w: 2, h: 2 };
    const corner = cellToPx(geo, cell(5, 4));
    expect(resolveDrop(geo, corner, square)).toEqual({ kind: 'bench', origin: cell(4, 3) });
    expect(resolveDrop(geo, cellToPx(geo, cell(0, 0)), { w: 7, h: 1 })).toEqual({ kind: 'none' });
  });

  test('layoutTray (review P2): rows check width and height, each row as tall as its own items', () => {
    // 390 x 600 stage, ch1-n11's material: a 10 (two cells tall), a 2 and two spares.
    const g = computeGeometry(390, 600, { cols: 6, rows: 5 }, [{ w: 5, h: 2 }, { w: 2, h: 1 }, { w: 1, h: 1 }, { w: 1, h: 1 }]);
    const list = items([{ w: 5, h: 2 }, { w: 2, h: 1 }, { w: 1, h: 1 }, { w: 1, h: 1 }]);
    for (const b of boxes(g, list)) {
      expect(inside(g.tray, b)).toBe(true);
    }
    // A forced short tray shrinks instead of spilling out of the bottom.
    const short: StageGeometry = { ...g, tray: { ...g.tray, height: 2 * g.cell } };
    const squeezed = boxes(short, list);
    for (const b of squeezed) {
      expect(inside(short.tray, b)).toBe(true);
    }
    expect(layoutTray(short, list)[0]!.scale).toBeLessThan(1);
  });

  test('layoutTray: keeps order, wraps rows, never overlaps, centres each row', () => {
    const list = items(Array.from({ length: 11 }, () => ({ w: 1, h: 1 })));
    const placed = layoutTray(geo, list);
    const rows = [...new Set(placed.map((p) => p.y))];
    expect(rows.length).toBeGreaterThan(1);
    expect(placed[1]!.x).toBeGreaterThan(placed[0]!.x);
    const b = boxes(geo, list);
    for (let i = 0; i < b.length; i += 1) {
      for (let j = i + 1; j < b.length; j += 1) {
        expect(overlap(b[i]!, b[j]!)).toBe(false);
      }
    }
    const three = layoutTray(geo, items([{ w: 1, h: 1 }, { w: 1, h: 1 }, { w: 1, h: 1 }]));
    expect(three[0]!.scale).toBe(1);
    expect(three[0]!.y).toBe(geo.tray.y + TRAY_PAD);
    const used = 3 * geo.cell + 2 * 8;
    expect(three[0]!.x).toBeCloseTo(geo.tray.x + (geo.tray.width - used) / 2);
    expect(layoutTray(geo, [])).toEqual([]);
  });

  test('blockAt: a tap inside a partner picks the block under the finger, gaps pick nothing', () => {
    // The 7 partner: five on top, two below.
    const seven = [cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0), cell(4, 0), cell(0, 1), cell(1, 1)];
    expect(blockAt(seven, 50, { x: 10, y: 10 })).toBe(0);
    expect(blockAt(seven, 50, { x: 249, y: 49 })).toBe(4);
    expect(blockAt(seven, 50, { x: 60, y: 75 })).toBe(6);
    expect(blockAt(seven, 50, { x: 160, y: 75 })).toBe(-1);
  });

  test('countTarget (review: 34px blocks): a block counts once; a tap in a gap counts the nearest uncounted neighbour, never a far or diagonal one', () => {
    // A row of three at (0,0) (1,0) (2,0) and one below the first at (0,1).
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(unitId) as [ReturnType<typeof unitId>, ReturnType<typeof unitId>, ReturnType<typeof unitId>, ReturnType<typeof unitId>];
    const bench = new Map([[a, cell(0, 0)], [b, cell(1, 0)], [c, cell(2, 0)], [d, cell(0, 1)]]);
    const at = (x: number, y: number) => ({ x: geo.bench.x + x * geo.cell, y: geo.bench.y + y * geo.cell });
    const none = new Map<ReturnType<typeof unitId>, number>();
    // Squarely on an uncounted block: that block, wherever the finger is inside it.
    expect(countTarget(geo, bench, none, b, at(1.05, 0.05))).toBe(b);
    // 2026-10-16 review A-2: a tap on a block already counted counts nothing,
    // wherever on it the finger is, even right beside an uncounted neighbour.
    const aCounted = new Map([[a, 1]]);
    expect(countTarget(geo, bench, aCounted, a, at(0.5, 0.5))).toBeNull();
    expect(countTarget(geo, bench, aCounted, a, at(0.95, 0.5))).toBeNull();
    expect(countTarget(geo, bench, aCounted, a, at(0.5, 0.95))).toBeNull();
    // Tapping the same block twice: one number, not two.
    const once = countTarget(geo, bench, none, a, at(0.5, 0.5));
    expect(once).toBe(a);
    expect(countTarget(geo, bench, new Map([[once!, 1]]), a, at(0.5, 0.5))).toBeNull();
    // A gap inside a partner's box (no block under the finger) still finds the
    // nearest uncounted neighbour within half a cell, skipping counted ones, or nothing.
    expect(countTarget(geo, bench, none, null, at(1.5, 1.2))).toBe(b);
    expect(countTarget(geo, bench, new Map([[b, 1]]), null, at(1.5, 1.2))).toBe(d);
    expect(countTarget(geo, bench, aCounted, null, at(0.5, 1.05))).toBe(d);
    expect(countTarget(geo, bench, none, null, at(2.9, 1.9))).toBeNull();
    expect(COUNT_SLOP).toBe(0.5);
  });

  test('footprintOf gives origin, size and offsets', () => {
    expect(footprintOf([cell(2, 3), cell(3, 3), cell(2, 4)])).toEqual({ origin: cell(2, 3), footprint: { w: 2, h: 2 }, offsets: [cell(0, 0), cell(1, 0), cell(0, 1)] });
  });
});

describe('stage budget (review P2: the feedback card is 84 / 70px, not a 24px line)', () => {
  test('the device helper subtracts the chrome the level screen actually draws', () => {
    expect(portraitChrome(false)).toBe(104 + 84 + 4 + 76);
    // 2026-10-16 review #7: a short phone's card is 56 and its button row 52 (was 70 and 64).
    expect(portraitChrome(true)).toBe(80 + 56 + 4 + 52);
    const se = PHONES.find((p) => p.name === 'iPhone SE Safari portrait')!;
    expect(isCompact(se)).toBe(true);
    // Measured in the browser on the real page (2026-10-16, Phase 18): 361px (was 335).
    expect(stageSizeOf(se)).toEqual({ width: 375, height: 361 });
    const pro = PHONES.find((p) => p.name === 'iPhone 16 Pro Safari portrait')!;
    expect(isCompact(pro)).toBe(false);
    expect(stageSizeOf(pro)).toEqual({ width: 402, height: 714 - 268 });
    const home = PHONES.find((p) => p.name === 'iPhone 16 Pro home screen portrait')!;
    expect(stageSizeOf(home)).toEqual({ width: 402, height: 874 - 62 - 34 - 268 });
    const land = PHONES.find((p) => p.name === 'iPhone 16 Pro Safari landscape')!;
    expect(stageSizeOf(land)).toEqual({ width: 874 - 124 - LEVEL_CHROME.sideColumn, height: 370 - 21 });
  });

  test('tray packing: 17 keeps 34px blocks on a 375 x 553 phone whatever order the partners are dealt in', () => {
    // Plain wrapping left a 2 and a spare alone on rows of their own and shrank everything to 29px.
    const stage = stageSizeOf(PHONES.find((p) => p.name === 'iPhone SE Safari portrait')!);
    const partners: ReadonlyArray<Footprint> = [{ w: 5, h: 2 }, { w: 5, h: 1 }, { w: 2, h: 1 }, { w: 4, h: 1 }];
    const permutations = (list: ReadonlyArray<Footprint>): ReadonlyArray<ReadonlyArray<Footprint>> =>
      list.length <= 1 ? [list] : list.flatMap((f, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [f, ...rest]));
    const orders = permutations(partners);
    expect(orders).toHaveLength(24);
    for (const order of orders) {
      const tray = [...order, { w: 1, h: 1 }, { w: 1, h: 1 }];
      const g = computeGeometry(stage.width, stage.height, { cols: 6, rows: 5 }, tray);
      expect(g.cell).toBeGreaterThanOrEqual(34);
      const b = boxes(g, items(tray));
      for (const box of b) {
        expect(inside(g.tray, box)).toBe(true);
      }
      for (let i = 0; i < b.length; i += 1) {
        for (let j = i + 1; j < b.length; j += 1) {
          expect(overlap(b[i]!, b[j]!)).toBe(false);
        }
      }
    }
  });

  test('tray packing keeps the deal order inside a row and never packs taller than plain wrapping', () => {
    const g = computeGeometry(375, 335, { cols: 6, rows: 5 }, []);
    const list = items([{ w: 4, h: 1 }, { w: 2, h: 1 }, { w: 5, h: 1 }, { w: 5, h: 2 }, { w: 1, h: 1 }, { w: 1, h: 1 }]);
    const placed = layoutTray(g, list);
    const byRow = new Map<number, string[]>();
    for (const p of placed) {
      byRow.set(Math.round(p.y), [...(byRow.get(Math.round(p.y)) ?? []), p.id]);
    }
    for (const ids of byRow.values()) {
      expect([...ids].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))).toEqual(ids);
    }
    // All the same size: exactly plain wrapping, left to right.
    const same = layoutTray(geo, items(Array.from({ length: 11 }, () => ({ w: 1, h: 1 }))));
    expect(same.map((p) => p.id)).toEqual(Array.from({ length: 11 }, (_, i) => `i${i}`));
  });
});

describe('fitted mats (2026-10-15 review: the mat was sized for the hardest stop)', () => {
  const at = (phone: string, id: string, bounds?: { cols: number; rows: number }) => {
    const size = stageSizeOf(PHONES.find((p) => p.name === phone)!);
    const chapter = CHAPTERS.find((c) => c.nodes.some((n) => n.id === id))!;
    const puzzle = materialize({ contentVersion: CONTENT_VERSION, chapterId: chapter.id, nodeId: chapter.nodes.find((n) => n.id === id)!.id, attemptVariant: 0, seed: 11 });
    return computeGeometry(size.width, size.height, bounds ?? puzzle.initial.bounds, trayObjects(puzzle.initial).map((o) => o.footprint)).cell;
  };
  // What every stop had before: one mat per island.
  const old = (id: string) => (id.startsWith('ch1') ? { cols: 6, rows: 5 } : { cols: 8, rows: 6 });

  test('390 x 844: the first stops and the first sums get big blocks', () => {
    const phone = 'Emulated 390x844 portrait';
    expect(at(phone, 'ch1-n1')).toBeGreaterThanOrEqual(70);
    expect(at(phone, 'ch1-n2')).toBeGreaterThanOrEqual(70);
    for (const id of ['ch2-n1', 'ch2-n2', 'ch2-n3']) {
      expect(at(phone, id)).toBeGreaterThanOrEqual(56);
    }
    // 1 + 1 is no longer smaller than the first island's blocks.
    expect(at(phone, 'ch2-n1')).toBeGreaterThanOrEqual(at(phone, 'ch1-n5'));
  });

  test('no stop on any phone got smaller blocks than with the old mats (17 and 3 + 4 included)', () => {
    // Phase 21's stops never had the old mats (the row of nine to send the
    // extra back from does not even fit one); their blocks are held to 40px
    // by the layout budget test below.
    const added = new Set(['ch2-n9', 'ch2-n10', 'ch2-n11', 'ch2-n12']);
    for (const phone of PHONES) {
      for (const chapter of CHAPTERS) {
        for (const node of chapter.nodes.filter((n) => !added.has(n.id))) {
          expect(`${phone.name} ${node.id} ${at(phone.name, node.id) >= at(phone.name, node.id, old(node.id))}`).toBe(`${phone.name} ${node.id} true`);
        }
      }
    }
  });
});

// Every stop of the real catalog, three variants each, on common phones in
// portrait and landscape: everything visible sits inside the stage, the tray
// objects stay inside the tray without overlapping, and nothing shrinks below
// a size a small finger can still pick up.
const MIN_PLAYABLE = 32;

describe('layout on real phones with the real catalog (review P2)', () => {
  const cases = PHONES.flatMap((phone) => CHAPTERS.flatMap((chapter) => chapter.nodes.map((node) => ({ phone, chapter, node }))));
  test.each(cases.map((c) => [c.phone.name, c.node.id as string, c] as const))('%s · %s', (_name, _id, { phone, chapter, node }) => {
    const size = stageSizeOf(phone);
    const stage = { x: 0, y: 0, width: size.width, height: size.height };
    for (const attemptVariant of [0, 1, 2]) {
      const puzzle = materialize({ contentVersion: CONTENT_VERSION, chapterId: chapter.id, nodeId: node.id, attemptVariant, seed: 11 });
      const objects = trayObjects(puzzle.initial);
      const g = computeGeometry(size.width, size.height, puzzle.initial.bounds, objects.map((o) => o.footprint));
      expect(inside(stage, g.bench)).toBe(true);
      expect(inside(stage, g.tray)).toBe(true);
      expect(overlap(g.bench, g.tray)).toBe(false);
      expect(g.cell).toBeGreaterThanOrEqual(MIN_PLAYABLE);
      const list = objects.map((o) => ({ id: o.id, footprint: o.footprint }));
      const b = boxes(g, list);
      expect(b).toHaveLength(objects.length);
      for (const box of b) {
        expect(inside(g.tray, box)).toBe(true);
      }
      for (let i = 0; i < b.length; i += 1) {
        for (let j = i + 1; j < b.length; j += 1) {
          expect(overlap(b[i]!, b[j]!)).toBe(false);
        }
      }
      expect(g.cell * layoutTray(g, list)[0]!.scale).toBeGreaterThanOrEqual(MIN_PLAYABLE);
    }
  });
});

// 2026-10-16 review #7: the stage's height goes where it is needed.
describe('layout budget (2026-10-16 review E-1 / B-1)', () => {
  const puzzleOf = (id: string, attemptVariant = 0) => {
    const chapter = CHAPTERS.find((c) => c.nodes.some((n) => n.id === id))!;
    return materialize({ contentVersion: CONTENT_VERSION, chapterId: chapter.id, nodeId: chapter.nodes.find((n) => n.id === id)!.id, attemptVariant, seed: 11 });
  };
  const on = (phone: string, id: string, attemptVariant = 0) => {
    const size = stageSizeOf(PHONES.find((p) => p.name === phone)!);
    const objects = trayObjects(puzzleOf(id, attemptVariant).initial);
    const g = computeGeometry(size.width, size.height, puzzleOf(id, attemptVariant).initial.bounds, objects.map((o) => o.footprint));
    const list = objects.map((o) => ({ id: o.id, footprint: o.footprint }));
    const placed = boxes(g, list);
    const used = Math.max(...placed.map((b) => b.y + b.height)) - Math.min(...placed.map((b) => b.y)) + 2 * TRAY_PAD;
    return { g, size, block: g.cell * layoutTray(g, list)[0]!.scale, empty: 1 - used / g.tray.height };
  };

  // Where blocks stay under 40px, the smallest of the three variants, as
  // measured. 17 on a 375 or 360 wide phone is limited by the tray's width,
  // not its height: its best packing puts 5 + 2 + 1 + 1 in one row, nine
  // blocks and three gaps across 335px. Making these ≥ 40 needs a content or
  // layout decision (tasks/todo.md Phase 18, "needs Ted").
  const SMALL: Readonly<Record<string, number>> = {
    'iPhone SE Safari portrait · ch1-n12': 34,
    'Android 360x640 Chrome portrait · ch1-n12': 34,
    'Android 640x360 Chrome landscape · ch1-n11': 38,
    'Android 640x360 Chrome landscape · ch1-n12': 38,
  };

  test('every phone × every stop: mat cells and tray blocks ≥ 40px, except the listed few, which do not shrink', () => {
    const small: Record<string, number> = {};
    for (const phone of PHONES) {
      for (const chapter of CHAPTERS) {
        for (const node of chapter.nodes) {
          const worst = Math.min(...[0, 1, 2].map((v) => Math.min(on(phone.name, node.id, v).g.cell, Math.floor(on(phone.name, node.id, v).block))));
          if (worst < TRAY_MIN_BLOCK) {
            small[`${phone.name} · ${node.id}`] = worst;
          }
        }
      }
    }
    expect(small).toEqual(SMALL);
  });

  test('a tray below the mat is only as tall as what it holds; the mat and tray sit in the middle of the stage', () => {
    // The first stop and the join boss (ch2-n8 since Phase 19, five partners;
    // the old 3 + 4 boss was ch2-n7 with four).
    for (const id of ['ch1-n1', 'ch2-n8']) {
      const { g, size, empty } = on('Emulated 390x844 portrait', id);
      expect(g.arrangement).toBe('below');
      // 2026-10-16 review: 68% and 74% empty sand before.
      expect(empty).toBeLessThanOrEqual(id === 'ch1-n1' ? 0.4 : 0.45);
      const above = g.bench.y;
      const below = size.height - (g.tray.y + g.tray.height);
      expect(Math.abs(above - below)).toBeLessThanOrEqual(1);
      expect(g.tray.y).toBe(g.bench.y + g.bench.height + g.gap);
    }
    // A tray that needs all the room keeps it: nothing to centre.
    const full = on('iPhone SE Safari portrait', 'ch1-n12').g;
    expect(full.tray.height).toBeLessThanOrEqual(stageSizeOf(PHONES[0]!).height);
    expect(TRAY_SLACK).toBe(24);
  });

  test('360 × 640: the 4 that changes shape keeps a tray taller than its blocks (it was squeezed to 61px)', () => {
    const { g, block } = on('Emulated 360x640 portrait', 'ch1-n6');
    expect(g.tray.height).toBeGreaterThanOrEqual(block + 2 * TRAY_PAD);
    expect(block).toBeGreaterThanOrEqual(TRAY_MIN_BLOCK);
  });

  test('drawn small, judged big: letting go on the sand below the tray still puts it back', () => {
    const { g, size } = on('Emulated 390x844 portrait', 'ch1-n1');
    expect(g.trayZone.y).toBe(g.tray.y);
    expect(g.trayZone.y + g.trayZone.height).toBe(size.height - g.gap);
    const below = { x: g.tray.x + 20, y: g.tray.y + g.tray.height + 30 };
    expect(inRect(g.tray, below.x, below.y)).toBe(false);
    expect(resolveDrop(g, { x: below.x - g.cell / 2, y: below.y - g.cell / 2 }, { w: 1, h: 1 })).toEqual({ kind: 'tray' });
    // Above the tray, over the mat: still the mat.
    expect(resolveDrop(g, { x: g.bench.x, y: g.bench.y }, { w: 1, h: 1 }).kind).toBe('bench');
  });

  test('an 8-column mat may use the side margins: the 7-made-two-ways boss on a 390 phone gets 48px blocks (45 with the margins)', () => {
    // ch2-n8 since Phase 19 (the old 3 + 4 boss was ch2-n7; both are 8 columns).
    const { g, size } = on('Emulated 390x844 portrait', 'ch2-n8');
    expect(puzzleOf('ch2-n8').initial.bounds.cols).toBe(WIDE_MAT_COLS);
    expect(puzzleOf('ch2-n7').initial.bounds.cols).toBe(WIDE_MAT_COLS);
    expect(on('Emulated 390x844 portrait', 'ch2-n7').g.cell).toBe(48);
    expect(g.cell).toBe(48);
    expect(g.bench.x).toBeGreaterThanOrEqual(0);
    expect(g.bench.x + g.bench.width).toBeLessThanOrEqual(size.width);
    // A narrower mat keeps its margins.
    const six = on('Emulated 390x844 portrait', 'ch1-n12').g;
    expect(six.bench.x).toBeGreaterThanOrEqual(six.gap);
  });
});

describe('partner number badge (2026-10-15 review F: badges hung off the outline)', () => {
  const body = (n: number) => Array.from({ length: n }, (_, i) => cell(i < 5 ? i : i - 5, i < 5 ? 0 : 1));
  const box = (offsets: ReturnType<typeof body>, c: number) => {
    const s = labelSpot(offsets, c);
    return { x: s.left, y: s.top, width: s.size, height: s.size };
  };

  test('always inside the outline, in the last block of the top row, never in the head block (except a partner of one)', () => {
    for (const c of [34, 45, 61, 84]) {
      for (let n = 1; n <= 10; n += 1) {
        const offsets = body(n);
        const b = box(offsets, c);
        const w = Math.min(n, 5) * c;
        const h = (n > 5 ? 2 : 1) * c;
        expect(inside({ x: 0, y: 0, width: w, height: h }, b)).toBe(true);
        // The tail block of the top row holds it.
        const tail = Math.min(n, 5) - 1;
        expect(inside({ x: tail * c, y: 0, width: c, height: c }, b)).toBe(true);
        // Below the counting number, which sits in the top-right of a block.
        expect(b.y).toBeGreaterThanOrEqual(c * 0.4);
      }
    }
  });

  test('3 + 4 side by side at the mat\'s right edge: no badge pixel outside the mat', () => {
    const g = computeGeometry(390, 576, { cols: 8, rows: 3 });
    const three = box(body(3), g.cell);
    const four = box(body(4), g.cell);
    const at = (origin: number, r: Rect) => ({ ...r, x: g.bench.x + origin * g.cell + r.x, y: g.bench.y + r.y });
    expect(inside(g.bench, at(0, three))).toBe(true);
    expect(inside(g.bench, at(4, four))).toBe(true);
  });

  test('ch1-n10\'s tray: the three partner badges never overlap one another', () => {
    for (const phone of PHONES) {
      const size = stageSizeOf(phone);
      const puzzle = materialize({ contentVersion: CONTENT_VERSION, chapterId: CHAPTERS[0]!.id, nodeId: CHAPTERS[0]!.nodes[9]!.id, attemptVariant: 0, seed: 11 });
      const objects = trayObjects(puzzle.initial);
      const g = computeGeometry(size.width, size.height, puzzle.initial.bounds, objects.map((o) => o.footprint));
      const placed = layoutTray(g, objects.map((o) => ({ id: o.id, footprint: o.footprint })));
      const badges = objects.flatMap((o, i) => {
        if (o.groupId === null) {
          return [];
        }
        const p = placed[i]!;
        const r = box(o.cells.map((c) => cell(c.x, c.y)), g.cell * p.scale);
        return [{ ...r, x: p.x + r.x, y: p.y + r.y }];
      });
      expect(badges).toHaveLength(3);
      for (let i = 0; i < badges.length; i += 1) {
        for (let j = i + 1; j < badges.length; j += 1) {
          expect(overlap(badges[i]!, badges[j]!)).toBe(false);
        }
      }
    }
  });
});

describe('Phase 20 Q12: a piece let go on a taken spot lands on the nearest free one', () => {
  test('nearby origins: within one cell, sides before corners, never off the mat', () => {
    expect(nearbyOrigins(cell(2, 1), { w: 1, h: 1 }, 5, 3)).toEqual([cell(2, 0), cell(1, 1), cell(3, 1), cell(2, 2), cell(1, 0), cell(3, 0), cell(1, 2), cell(3, 2)]);
    // A corner of the mat: only what stays on it.
    expect(nearbyOrigins(cell(0, 0), { w: 1, h: 1 }, 5, 3)).toEqual([cell(1, 0), cell(0, 1), cell(1, 1)]);
    // A 3-wide partner on a 5-wide mat at x 2 cannot go right.
    expect(nearbyOrigins(cell(2, 0), { w: 3, h: 1 }, 5, 3).map((c) => c.x)).not.toContain(3);
  });

  test('settle: where it was let go when that is free; else the nearest free; a partner beside another first; nowhere near: back', () => {
    const free = (taken: ReadonlyArray<string>) => (o: { x: number; y: number }) => !taken.includes(`${o.x},${o.y}`);
    expect(settleOrigin(cell(1, 1), { w: 1, h: 1 }, 3, 3, free([]))).toEqual(cell(1, 1));
    expect(settleOrigin(cell(1, 1), { w: 1, h: 1 }, 3, 3, free(['1,1']))).toEqual(cell(1, 0));
    expect(settleOrigin(cell(1, 1), { w: 1, h: 1 }, 3, 3, free(['1,1', '1,0', '0,1']))).toEqual(cell(2, 1));
    // The preferred one wins over a nearer one.
    expect(settleOrigin(cell(1, 1), { w: 1, h: 1 }, 3, 3, free(['1,1']), (o) => o.x === 2 && o.y === 2)).toEqual(cell(2, 2));
    // Nothing within a cell: it bounces back.
    expect(settleOrigin(cell(0, 0), { w: 1, h: 1 }, 3, 3, free(['0,0', '1,0', '0,1', '1,1']))).toBeNull();
  });
});

