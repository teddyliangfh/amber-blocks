import { THEME, colorsFor } from '../blocks-ui/palette';
import { CHAPTERS, chapterId } from '../content';
import { ASLEEP_OPACITY, GATED_OPACITY, MAP_LOOKS, bossesOf, lookOf, trailX } from './map-looks';

// The same measurements as palette.test.ts, on the five grounds the map paints
// since Phase 24 (2026-10-27 review §4.1).
function channel(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => channel(parseInt(h.slice(i, i + 2), 16) / 255)) as [number, number, number];
}
function luminance(hex: string): number {
  const [r, g, b] = rgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
function oklch(hex: string): { readonly h: number; readonly c: number } {
  const [r, g, b] = rgb(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360, c: Math.hypot(A, B) };
}
function over(fg: string, alpha: number, bg: string): string {
  const parse = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16));
  const [f, k] = [parse(fg), parse(bg)];
  return `#${f.map((v, i) => Math.round(alpha * v + (1 - alpha) * k[i]!).toString(16).padStart(2, '0')).join('')}`;
}

const HUES = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10'];
const ISLANDS = ['ch1', 'ch5', 'ch2', 'ch3', 'ch6'] as const;

describe('Phase 24: one look per island (map-looks.ts)', () => {
  test('every island on the map has a row of its own, and the five differ in ground, sign, kit, trail and landmark', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(ISLANDS);
    for (const c of CHAPTERS) {
      expect(MAP_LOOKS[c.id]).toBeDefined();
    }
    const looks = ISLANDS.map((id) => lookOf(chapterId(id)));
    expect(new Set(looks.map((l) => l.ground)).size).toBe(5);
    expect(new Set(looks.map((l) => l.sign)).size).toBe(5);
    expect(new Set(looks.map((l) => l.decor)).size).toBe(5);
    expect(new Set(looks.map((l) => l.trail.style)).size).toBe(5);
    // Two launch pads (the rocket's and the countdown's); the rest their own.
    expect(looks.map((l) => l.landmark)).toEqual(['mountain', 'launchpad', 'bridge', 'launchpad', 'scales']);
    // Number Island is as it was; an unknown island looks like it.
    expect(lookOf(chapterId('ch1')).ground).toBe(THEME.sand);
    expect(lookOf(chapterId('ch1')).groundDeep).toBe(THEME.sandDeep);
    expect(lookOf(chapterId('ch9'))).toEqual(lookOf(chapterId('ch1')));
  });

  test('the grounds stay near the sand\'s saturation (the boardwalk, the mat\'s own wood, a little above) and well under any block\'s: blocks stay the only saturated things (D-033)', () => {
    const sand = oklch(THEME.sand).c;
    const dullestBlock = Math.min(...HUES.map((h) => oklch(colorsFor(h).fill).c));
    for (const id of ISLANDS) {
      const g = lookOf(chapterId(id)).ground;
      expect(`${id} ${oklch(g).c <= sand * 1.5 && oklch(g).c < dullestBlock}`).toBe(`${id} true`);
    }
    const hues = ISLANDS.map((id) => oklch(lookOf(chapterId(id)).ground).h);
    // The meadow (125°) and the snow (229°) stand apart from every other; the
    // three warm grounds (sand 89°, wood 76°, dusk sand 79°) are kin by design
    // and differ by lightness and their scenery instead. 7 of the 10 pairs.
    const gaps = hues.flatMap((a, i) => hues.slice(i + 1).map((b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))));
    expect(gaps.filter((g) => g >= 15).length).toBe(7);
  });

  test('a sleeping stop on every ground: the number ≥ 3:1 and the outline ≥ 2.5:1 on its body (palette.test.ts F-3, every island); behind a gate, one step paler, ≥ 2.8 and ≥ 2.3', () => {
    for (const id of ISLANDS) {
      const ground = lookOf(chapterId(id)).ground;
      for (const [alpha, floor] of [
        [ASLEEP_OPACITY, 3],
        [GATED_OPACITY, 2.8],
      ] as const) {
        for (const h of HUES) {
          const c = colorsFor(h);
          const body = over(c.pale, alpha, ground);
          expect(`${id} ${alpha} ${h} number ${contrast(over(c.deep, alpha, ground), body) >= floor}`).toBe(`${id} ${alpha} ${h} number true`);
          expect(`${id} ${alpha} ${h} outline ${contrast(over(c.edge, alpha, ground), body) >= floor - 0.5}`).toBe(`${id} ${alpha} ${h} outline true`);
        }
      }
    }
    expect(GATED_OPACITY).toBeLessThan(ASLEEP_OPACITY);
  });

  // The review asked for the pale body itself ≥ 1.5:1 on the ground and the
  // sign's green ≥ 3:1 (§4.1). Neither holds on the sand the map has always
  // had (the pale bodies are 1.06–1.30:1 on it, the sign's deep green 2.75:1):
  // a sleeping stop is read by its number and outline, measured above, and
  // the sign by its dark outline and shadow. Whether to darken the pale
  // shades or the sign is Ted's call; the shortfalls are listed so a change
  // shows up here. The deep ground (the sign's neighbour, the trail, the
  // landmark) reads on every ground at ≥ 1.25:1, the boardwalk's planks best.
  const SIGN_GREEN_BELOW_3 = ['ch1', 'ch5', 'ch2', 'ch3'];

  test('measured, for Ted: the sign\'s deep green on each ground, and the deep ground on its ground', () => {
    const below = ISLANDS.filter((id) => contrast(THEME.leafDeep, lookOf(chapterId(id)).ground) < 3);
    expect(below).toEqual(SIGN_GREEN_BELOW_3);
    for (const id of ISLANDS) {
      const look = lookOf(chapterId(id));
      expect(`${id} ${contrast(THEME.leafDeep, look.ground) >= 2}`).toBe(`${id} true`);
      expect(`${id} ${contrast(look.groundDeep, look.ground) >= 1.25}`).toBe(`${id} true`);
      // The ink on the sign's dots and name: on the leaf green, as before.
      expect(contrast(THEME.ink, THEME.leaf)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('review M-2: no two islands put their first four stops on the same column (≥ 26 px apart on 375, 390 and 430 phones)', () => {
    // The trail width: the phone's width − 2·20 − 2·16 − 2·8.
    for (const width of [375, 390, 430].map((w) => w - 40 - 32 - 16)) {
      for (let i = 0; i < 4; i += 1) {
        const xs = ISLANDS.map((id) => trailX(i, width, 68, lookOf(chapterId(id)).trail));
        for (let a = 0; a < xs.length; a += 1) {
          for (let b = a + 1; b < xs.length; b += 1) {
            expect(`${width} stop ${i} ${ISLANDS[a]}/${ISLANDS[b]} ${Math.abs(xs[a]! - xs[b]!) >= 26}`).toBe(`${width} stop ${i} ${ISLANDS[a]}/${ISLANDS[b]} true`);
          }
        }
      }
    }
    const width = 375 - 40 - 32 - 16;
    // Number Island's trail is where it was (phase 0.4, the full swing).
    expect(trailX(2, width, 68)).toBe(width / 2 + (width / 2 - 34 - 10) * Math.sin(2 * 1.05 + 0.4) - 34);
    expect(trailX(2, width, 68, lookOf(chapterId('ch1')).trail)).toBe(trailX(2, width, 68));
  });

  test('review §4.2: a gate after every little boss (two on Number Island), the last boss on the landmark', () => {
    const bosses = CHAPTERS.map((c) => {
      const { tail, gates } = bossesOf(c);
      return [c.id, c.nodes[tail]!.id, gates.map((g) => c.nodes[g]!.id)];
    });
    expect(bosses).toEqual([
      ['ch1', 'ch1-n12', ['ch1-n4', 'ch1-n8']],
      ['ch5', 'ch5-n8', ['ch5-n4']],
      ['ch2', 'ch2-n8', ['ch2-n4']],
      ['ch3', 'ch3-n8', ['ch3-n4']],
      ['ch6', 'ch6-n10', ['ch6-n4']],
    ]);
  });
});
