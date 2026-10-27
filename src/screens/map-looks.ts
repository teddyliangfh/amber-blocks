import { THEME } from '../blocks-ui/palette';
import type { Chapter, ChapterId } from '../content';

// How each island looks on the map (Phase 24, 2026-10-27 review §4.1, Ted's
// direction A: one scroll, an identity per island). Everything the map draws
// for an island that is not its stops comes from this table: the ground, the
// sign's little picture, the scenery kit, the trail and the landmark behind
// the island's last boss. Keyed by chapter id, so the content stays as it is
// (no CONTENT_VERSION bump); each row is Ted's to change in a line.
//
// Grounds sit at the sand's saturation and differ by hue only (D-033: blocks
// are the only saturated things on the map). Measured in map-looks.test.ts
// the way palette.test.ts measures: a sleeping stop's number and outline on
// every ground, the sign's green on every ground.

// The picture on the island's sign: what the island teaches, not its name.
export type SignGlyph = 'block' | 'shadow' | 'pair' | 'house' | 'scales';
// The scenery kit, placed every third stop on the far side of the trail.
export type DecorKit = 'beach' | 'meadow' | 'dock' | 'camp' | 'steps';
// What the trail between stops is made of.
export type TrailStyle = 'stones' | 'slabs' | 'planks' | 'prints' | 'steps';
// The scenery behind the island's last boss, on its pedestal at the island's foot.
export type Landmark = 'mountain' | 'launchpad' | 'bridge' | 'tent' | 'scales';

export interface IslandLook {
  readonly ground: string;
  readonly groundDeep: string;
  readonly sign: SignGlyph;
  readonly decor: DecorKit;
  // `phase` (radians) and `amplitude` (a share of the full swing) move the
  // trail so no two islands' first stops sit on the same x (review M-2).
  readonly trail: { readonly style: TrailStyle; readonly phase: number; readonly amplitude: number };
  readonly landmark: Landmark;
}

// Number Island as it was before Phase 24: the sand, palms, stepping stones.
const NUMBER_ISLAND: IslandLook = {
  ground: THEME.sand,
  groundDeep: THEME.sandDeep,
  sign: 'block',
  decor: 'beach',
  trail: { style: 'stones', phase: 0.4, amplitude: 1 },
  landmark: 'mountain',
};

export const MAP_LOOKS: Readonly<Record<string, IslandLook>> = {
  // Number Island: knowing numbers, building shapes. A two-peaked mountain
  // behind the 17, the flag on its peak.
  ch1: NUMBER_ISLAND,
  // Shape Island: filling shadows. A meadow with mushrooms and saplings (its
  // own pictures), slabs for a path, the rocket's launch pad at the end.
  ch5: {
    ground: '#DDEFC2',
    groundDeep: '#B9D98F',
    sign: 'shadow',
    decor: 'meadow',
    trail: { style: 'slabs', phase: 4.4, amplitude: 0.8 },
    landmark: 'launchpad',
  },
  // Join Island: joining. A boardwalk (the mat's wood), posts and lamps,
  // planks that fill in as stops are done, the bridgehead at the end.
  ch2: {
    ground: THEME.wood,
    groundDeep: THEME.woodDeep,
    sign: 'pair',
    decor: 'dock',
    trail: { style: 'planks', phase: 5.8, amplitude: 0.9 },
    landmark: 'bridge',
  },
  // Take-away Island: taking apart, sending home. Dusk sand, beds and tents,
  // footprints, the countdown rocket's launch pad.
  ch3: {
    ground: '#F3D6A8',
    groundDeep: '#D9B07A',
    sign: 'house',
    decor: 'camp',
    trail: { style: 'prints', phase: 1.8, amplitude: 0.7 },
    landmark: 'launchpad',
  },
  // Compare Island: more or fewer. Pale snow, a tall and a short tree, steps
  // that climb, the scales tower at the end.
  ch6: {
    ground: '#E8F4FA',
    groundDeep: '#BFDCEA',
    sign: 'scales',
    decor: 'steps',
    trail: { style: 'steps', phase: 3.2, amplitude: 1 },
    landmark: 'scales',
  },
};

// An island not in the table looks like Number Island.
export function lookOf(chapterId: ChapterId): IslandLook {
  return MAP_LOOKS[chapterId] ?? NUMBER_ISLAND;
}

// A winding trail: stops swing left and right down the island, each island's
// swing shifted by its own phase and narrowed by its amplitude.
export function trailX(index: number, width: number, size: number, trail: IslandLook['trail'] = NUMBER_ISLAND.trail): number {
  const amplitude = Math.max(0, width / 2 - size / 2 - 10) * trail.amplitude;
  return width / 2 + amplitude * Math.sin(index * 1.05 + trail.phase) - size / 2;
}

// A sleeping stop's opacity over the ground; behind a closed gate one step
// paler still (Phase 24, Ted 2026-10-27: "再降一档"). Measured in
// map-looks.test.ts: asleep, the number stays ≥ 3:1 on the body on every
// ground; behind a gate the number falls to 2.8:1 on the reddest and the
// outline to 2.4:1 on the orange (a stop that cannot be opened yet is not
// there to be read). A default for Ted.
export const ASLEEP_OPACITY = 0.92;
export const GATED_OPACITY = 0.84;

// An island's bosses (Phase 24, review §4.2): its last boss is the one on the
// landmark at the island's foot; each one before it is a "little boss", with
// a gate on the trail after it (Number Island has two, the others one).
export function bossesOf(chapter: Chapter): { readonly tail: number; readonly gates: ReadonlyArray<number> } {
  const bosses = chapter.nodes.map((n, i) => (n.role === 'boss' ? i : -1)).filter((i) => i >= 0);
  const tail = bosses[bosses.length - 1] ?? chapter.nodes.length - 1;
  return { tail, gates: bosses.slice(0, -1) };
}
