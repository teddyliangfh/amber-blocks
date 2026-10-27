import { CHAPTERS, CONTENT_VERSION, chapterId, materialize, roundOf } from '../content';
import type { Rect } from './layout';
import { PHONES, isCompact, stageSizeOf } from './devices';
import type { DeviceCase } from './devices';
import { SIGN_SIZES, overSlot, placeRound, signGeometry } from './sign-layout';
import type { SignSize } from './sign-layout';

// Compare Island's stage (Phase 23d) on every phone the level screen is
// checked on, every stop, every round: everything inside the stage, nothing
// overlapping, one cell size per stop, and the sizes the 23d design measured.

function inside(outer: Rect, inner: Rect): boolean {
  const eps = 0.001;
  return inner.x >= outer.x - eps && inner.y >= outer.y - eps && inner.x + inner.width <= outer.x + outer.width + eps && inner.y + inner.height <= outer.y + outer.height + eps;
}
function overlap(a: Rect, b: Rect): boolean {
  const eps = 0.001;
  return a.x < b.x + b.width - eps && b.x < a.x + a.width - eps && a.y < b.y + b.height - eps && b.y < a.y + a.height - eps;
}

const ch6 = CHAPTERS.find((c) => c.id === chapterId('ch6'))!;
const sizeOf = (d: DeviceCase): SignSize => (d.width > d.height ? 'side' : isCompact(d) ? 'compact' : 'regular');
const geometryOn = (d: DeviceCase, id: string) => {
  const node = ch6.nodes.find((n) => n.id === id)!;
  const p = materialize({ contentVersion: CONTENT_VERSION, chapterId: ch6.id, nodeId: node.id, attemptVariant: 0, seed: 3 });
  const s = stageSizeOf(d);
  return { g: signGeometry(s.width, s.height, p.sign!.rounds, p.sign!.signs.length, sizeOf(d)), p, stage: { x: 0, y: 0, ...s } };
};
// The three viewports the design and the walk-through use.
const VIEWPORTS: ReadonlyArray<DeviceCase> = [
  { name: '375 × 812', width: 375, height: 812 },
  { name: '360 × 640', width: 360, height: 640 },
  { name: '667 × 331', width: 667, height: 331 },
];

describe('Compare Island stage on real phones (Phase 23d)', () => {
  const cases = [...PHONES, ...VIEWPORTS].flatMap((d) => ch6.nodes.map((n) => [d.name, n.id as string, d] as const));
  test.each(cases)('%s · %s', (_name, id, d) => {
    const { g, p, stage } = geometryOn(d, id);
    expect(g.sign).toBe(SIGN_SIZES[sizeOf(d)].sign);
    expect(inside(stage, g.tray)).toBe(true);
    expect(inside(stage, g.board)).toBe(true);
    expect(overlap(g.board, g.tray)).toBe(false);
    for (const h of g.homes) {
      expect(inside(g.tray, { ...h, width: g.sign, height: g.sign })).toBe(true);
    }
    // A number's block is always smaller than a sign block: the thing to pick up is the biggest.
    expect(g.cell).toBeLessThan(g.sign);
    for (const round of p.sign!.rounds) {
      const r = placeRound(g, round);
      for (const side of [r.left, r.right]) {
        expect(inside(stage, side.plate)).toBe(true);
        expect(inside(stage, side.blocks)).toBe(true);
        expect(overlap(side.blocks, side.plate)).toBe(false);
        expect(overlap(side.plate, r.slot)).toBe(false);
        expect(side.blocks.y + side.blocks.height).toBeCloseTo(side.plate.y);
      }
      expect(overlap(r.left.blocks, r.right.blocks)).toBe(false);
      expect(overlap(r.left.plate, r.right.plate)).toBe(false);
      expect(inside(stage, r.slot)).toBe(true);
      expect(overSlot(r, g.sign, r.signAt.x, r.signAt.y)).toBe(true);
      for (const h of g.homes) {
        expect(overSlot(r, g.sign, h.x, h.y)).toBe(false);
      }
    }
  });

  // The design's table (docs/mockups/compare-island-signs.html, "关卡表与检查"),
  // pinned: stops with a tower of 10 (8 – 10) are the only ones under 28px on
  // the three viewports; the shortest phones shrink the 7 – 10 towers.
  test('cells per stop: 375 × 812 / 360 × 640 / 667 × 331, and the three shortest phones', () => {
    const cells = (d: DeviceCase) => ch6.nodes.map((n) => geometryOn(d, n.id).g.cell);
    expect(VIEWPORTS.map(cells)).toEqual([
      [48, 48, 48, 48, 37, 48, 37, 33, 33, 33],
      [44, 44, 44, 44, 38, 44, 29, 26, 26, 26],
      [44, 44, 44, 43, 44, 44, 28, 25, 25, 25],
    ]);
    const shortest = ['iPhone SE Safari portrait', 'Android 360x640 Chrome portrait', 'Android 640x360 Chrome landscape'].map((name) => PHONES.find((d) => d.name === name)!);
    expect(shortest.map(cells)).toEqual([
      [36, 44, 36, 30, 41, 36, 20, 18, 18, 18],
      [39, 44, 39, 32, 38, 39, 21, 19, 19, 19],
      [44, 44, 44, 38, 44, 44, 25, 23, 23, 23],
    ]);
    // Up to stop 7 on the three viewports, 28px or more.
    for (const d of VIEWPORTS) {
      expect(cells(d).slice(0, 7).every((c) => c >= 28)).toBe(true);
    }
  });

  test('two sides that fit in equal halves sit either side of a centred slot; a wide row packs the group', () => {
    const d = VIEWPORTS[0]!;
    const s = stageSizeOf(d);
    const even = roundOf({ left: 4, right: 1 });
    const g = signGeometry(s.width, s.height, [even], 2, 'regular');
    const r = placeRound(g, even);
    expect(r.slot.x + r.slot.width / 2).toBeCloseTo(g.row.left + g.row.width / 2);
    const wide = roundOf({ left: { n: 5, layout: 'row' }, right: 3 });
    const gw = signGeometry(s.width, s.height, [wide], 3, 'regular');
    const rw = placeRound(gw, wide);
    expect(rw.slot.x + rw.slot.width / 2).toBeGreaterThan(gw.row.left + gw.row.width / 2);
    expect(rw.left.blocks.width).toBe(5 * gw.cell);
  });

  test('landscape stands the signs in a column right of the line; portrait lays them in a row below it', () => {
    const land = geometryOn(VIEWPORTS[2]!, 'ch6-n2').g;
    expect(land.tray.standing).toBe(true);
    expect(land.homes.map((h) => h.x)).toEqual([land.homes[0]!.x, land.homes[0]!.x, land.homes[0]!.x]);
    expect(land.tray.x).toBeGreaterThan(land.row.left + land.row.width);
    const port = geometryOn(VIEWPORTS[0]!, 'ch6-n1').g;
    expect(port.tray.standing).toBe(false);
    expect(port.homes).toHaveLength(2);
    expect(port.tray.y).toBeGreaterThan(port.lineTop);
  });
});
