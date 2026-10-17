import { THEME, colorsFor } from './palette';

// WCAG 2 contrast, and OKLCH hue, computed from the hex values the app paints.
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
// OKLCH hue (degrees) and chroma.
function oklch(hex: string): { readonly h: number; readonly c: number } {
  const [r, g, b] = rgb(hex);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360, c: Math.hypot(A, B) };
}
function hue(hex: string): number {
  return oklch(hex).h;
}
function hueGap(a: string, b: string): number {
  const d = Math.abs(hue(a) - hue(b));
  return Math.min(d, 360 - d);
}
// `fg` at `alpha` over `bg`, as the screen composites it.
function over(fg: string, alpha: number, bg: string): string {
  const parse = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16));
  const [f, k] = [parse(fg), parse(bg)];
  return `#${f.map((v, i) => Math.round(alpha * v + (1 - alpha) * k[i]!).toString(16).padStart(2, '0')).join('')}`;
}

const HUES = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10'];

describe('block colours', () => {
  test('every block: white labels on the deep shade ≥ 4.5:1, the face ink on the fill ≥ 3:1', () => {
    for (const h of HUES) {
      const c = colorsFor(h);
      expect(`${h} ${contrast('#FFFFFF', c.deep) >= 4.5}`).toBe(`${h} true`);
      expect(`${h} ${contrast(THEME.faceInk, c.fill) >= 3}`).toBe(`${h} true`);
    }
  });

  // 3's yellow is the one fill that cannot reach 1.5:1 on the cream felt and
  // sand without turning into another colour (1.37 / 1.15); its edge carries
  // it (≥ 3:1 below). Whether to darken the yellow itself is Ted's call
  // (2026-10-16 review F-2). Listed so a fix shows up here.
  const PALE_FILL = ['n3'];

  test('2026-10-16 review F-3: every block stands out on the felt and the sand (3 by its outline), with an outline that reads on both and on the white card', () => {
    for (const h of HUES) {
      const c = colorsFor(h);
      const fill = Math.min(contrast(c.fill, THEME.felt), contrast(c.fill, THEME.sand));
      expect(`${h} fill ${fill >= 1.5}`).toBe(`${h} fill ${!PALE_FILL.includes(h)}`);
      expect(`${h} edge ${contrast(c.edge, THEME.felt) >= 3 && contrast(c.edge, THEME.sand) >= 3 && contrast(c.edge, THEME.white) >= 3}`).toBe(`${h} edge true`);
    }
  });

  // A sleeping stop on the map (MapScreen StopDot): the pale body outlined in
  // the edge, the number in the deep shade, the whole stop at this opacity
  // over the island's sand.
  const ASLEEP = 0.92;

  test('2026-10-16 review F-3: a sleeping stop as the map draws it, composited over the sand: the number ≥ 3:1, the outline ≥ 2.5:1 on the pale body', () => {
    for (const h of HUES) {
      const c = colorsFor(h);
      const body = over(c.pale, ASLEEP, THEME.sand);
      expect(`${h} number ${contrast(over(c.deep, ASLEEP, THEME.sand), body) >= 3}`).toBe(`${h} number true`);
      expect(`${h} outline ${contrast(over(c.edge, ASLEEP, THEME.sand), body) >= 2.5}`).toBe(`${h} outline true`);
    }
    // The number used to be at 0.75 on top of that: 2.6–3.2:1, below 3 for most.
    expect(HUES.some((h) => contrast(over(colorsFor(h).deep, 0.75, over(colorsFor(h).pale, ASLEEP, THEME.sand)), over(colorsFor(h).pale, ASLEEP, THEME.sand)) < 3)).toBe(true);
  });

  test('every block is a colour of its own: at least 15° of OKLCH hue from every other block', () => {
    for (const h of HUES) {
      for (const other of HUES.filter((o) => o !== h)) {
        expect(`${h}/${other} ${hueGap(colorsFor(h).fill, colorsFor(other).fill) >= 15}`).toBe(`${h}/${other} true`);
      }
    }
  });

  // The success greens sit 7–11° from the 4's green. Changing the success
  // colour is Ted's call (2026-10-16 review F-1); until then the clash is kept
  // off the places a 4 can be: the snap ghost is neutral and the counting chip
  // is ink. Listed so a fix (or a new clash) shows up here.
  const KNOWN_CLASHES = ['leaf/n4', 'leafDeep/n4'];

  test('2026-10-16 review F-1: what the screen means by colour (right, the ghost, the button) is neutral or ≥ 15° from every block', () => {
    const tokens = { leaf: THEME.leaf, leafDeep: THEME.leafDeep, preview: THEME.preview, amber: THEME.amber } as const;
    const clashes: string[] = [];
    for (const [name, hex] of Object.entries(tokens)) {
      // Near-grey has no hue to confuse.
      if (oklch(hex).c < 0.05) {
        continue;
      }
      for (const h of HUES) {
        if (hueGap(hex, colorsFor(h).fill) < 15) {
          clashes.push(`${name}/${h}`);
        }
      }
    }
    expect(clashes).toEqual(KNOWN_CLASHES);
    expect(oklch(THEME.preview).c).toBeLessThan(0.05);
  });

  test('an unknown hue falls back to 10', () => {
    expect(colorsFor('n99')).toEqual(colorsFor('n10'));
  });
});
