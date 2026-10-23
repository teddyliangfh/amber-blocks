import { CHAPTERS, CONTENT_CHANGES, CONTENT_VERSION } from './catalog';
import { materialize } from './generate';
import { fnv1a } from './rng';
import type { Puzzle } from './schema';

// What every stop deals, hashed, for the running content version. Saved work is
// only valid against the exact material it was made from, so changing what a
// stop deals (sizes, order, colours, ids, the question) without bumping
// CONTENT_VERSION silently breaks old saves (2026-10-14 review: 10 / 12 / 17
// changed under version 1). When this fails on purpose: bump CONTENT_VERSION,
// list the changed stops in CONTENT_CHANGES, then update the table below.

// Version 2's material is byte-identical to what the build before the bump
// dealt under version 1 (checked 2026-10-14), so saves from that build keep all
// their work; only saves from before the decoys lose work on 10 / 12 / 17.
// Version 3 (2026-10-15) changed only the mats (fitted per stop): every unit,
// colour, slot and partner is as version 2 dealt it, and 8 and 17 are unchanged.
// Version 4 (2026-10-15) changed only 5, 6, 8 and 9 (the reordered middle leg).
// Version 5 (2026-10-16) changed only 5 (five singles beside the 3, not four).
// Version 6 (2026-10-16, Phase 19) changed only Join Island 5–7 (a partner on
// the mat from the start) and added ch2-n8 (7 made two ways); every other stop,
// Number Island and Join Island 1–4 included, is byte-identical to version 5.
// Version 7 (2026-10-18, Phase 21) added Join Island n9 – n12 between the old
// stops; all twenty stops before are byte-identical to version 6.
// Version 8 (2026-10-19, Phase 22) added Take-away Island (ch3-n1 – n8) after
// Join Island; all twenty-four stops before are byte-identical to version 7.
// Version 9 (2026-10-23, Phase 23a) added six picture stops (ch1-n13 – n17,
// ch2-n13) between the old ones; all thirty-two stops before are
// byte-identical to version 8.
// Version 10 (2026-10-23, Phase 23b) added Shape Island (ch5-n1 – n8) after
// Number Island; all thirty-eight stops before are byte-identical to version 9.
// Version 11 (2026-10-23, Phase 23c) added Compare Island (ch4-n1 – n8) after
// Take-away Island; all forty-six stops before are byte-identical to version 10.
const FINGERPRINT_VERSION = 11;
const FINGERPRINTS: Readonly<Record<string, string>> = {
  'ch1-n1': 'df3b63c2',
  'ch1-n2': '795c9b41',
  'ch1-n3': '78183bce',
  'ch1-n4': '2c830f23',
  'ch1-n5': 'e33c688f',
  'ch1-n6': '01c397fa',
  'ch1-n7': '4caf24b4',
  'ch1-n8': '580b1bb9',
  'ch1-n9': '51186367',
  'ch1-n10': '29e4ff0f',
  'ch1-n11': 'acadc268',
  'ch1-n12': 'a5b67418',
  'ch1-n13': '7698ef0f',
  'ch1-n14': '631429b3',
  'ch1-n15': '98d0336a',
  'ch1-n16': 'd05ee624',
  'ch1-n17': 'd06c3df8',
  'ch2-n1': '3dfffa88',
  'ch2-n2': 'deab7bca',
  'ch2-n3': 'fbd94da1',
  'ch2-n4': 'c9dd5ad8',
  'ch2-n5': '1ddcbdea',
  'ch2-n6': '0d3f2cd6',
  'ch2-n7': 'dfc97337',
  'ch2-n8': '681b29c8',
  'ch2-n9': '86c69617',
  'ch2-n10': '3ec25ced',
  'ch2-n11': '808c3608',
  'ch2-n12': '53dc5454',
  'ch2-n13': 'e82d4a05',
  'ch3-n1': '81eccc44',
  'ch3-n2': '8d97d408',
  'ch3-n3': '46e7ebb8',
  'ch3-n4': 'b6b0991c',
  'ch3-n5': 'fc7dae1d',
  'ch3-n6': '2e58cc53',
  'ch3-n7': '93f43e80',
  'ch3-n8': 'f87bbf98',
  'ch5-n1': '03c789ca',
  'ch5-n2': '4bc53515',
  'ch5-n3': '4e866202',
  'ch5-n4': 'adb13c09',
  'ch5-n5': 'edeb0d66',
  'ch5-n6': 'ba1e51ce',
  'ch5-n7': '871ee45c',
  'ch5-n8': 'c92ed705',
  'ch4-n1': '193a0041',
  'ch4-n2': 'e1a7170e',
  'ch4-n3': '225d6ea7',
  'ch4-n4': 'f75ed30e',
  'ch4-n5': '606bca21',
  'ch4-n6': 'ba41a567',
  'ch4-n7': 'bb3e3f1a',
  'ch4-n8': 'f843b856',
};

const REFS = [1, 7, 4242].flatMap((seed) => [0, 1, 2].map((attemptVariant) => ({ seed, attemptVariant })));

function describePuzzle(p: Puzzle): string {
  const s = p.initial;
  return JSON.stringify([
    p.question,
    s.bounds,
    [...s.units.values()].map((u) => [u.id, u.hue]),
    s.tray.map((t) => t.unitId),
    [...s.home.entries()],
    [...s.groups.values()].map((g) => [g.id, g.unitIds, g.shape]),
    p.display,
    p.prompt,
    // Only stops asked in steps carry them, so every other fingerprint is unchanged.
    ...(p.steps === undefined ? [] : [p.steps]),
    // Likewise a sum asked several ways, and a partner that starts on the mat
    // (where it sits is part of what the stop deals) (Phase 19).
    ...(p.ways === undefined ? [] : [p.ways]),
    ...(p.given === undefined ? [] : [p.given, [...s.bench.entries()]]),
    // And partners on the mat to send back (Phase 21).
    ...(p.onMat === undefined ? [] : [p.onMat, [...s.bench.entries()]]),
    // And a take-away's start and take, and a split's / take-away's blocks on the mat (Phase 22).
    ...(p.takeAway === undefined ? [] : [p.takeAway]),
    ...(p.onMat === undefined && s.bench.size > 0 && p.given === undefined ? [[...s.bench.entries()]] : []),
    // And a Shape Island picture and its shadow (Phase 23b).
    ...(p.picture === undefined && p.shadow === undefined ? [] : [p.picture, p.shadow]),
  ]);
}

function fingerprint(chapterId: Puzzle['ref']['chapterId'], nodeId: Puzzle['ref']['nodeId']): string {
  const all = REFS.map((r) => describePuzzle(materialize({ contentVersion: CONTENT_VERSION, chapterId, nodeId, ...r }))).join('\n');
  return fnv1a(all).toString(16).padStart(8, '0');
}

describe('content fingerprints', () => {
  const nodes = CHAPTERS.flatMap((c) => c.nodes.map((n) => ({ chapterId: c.id, nodeId: n.id })));

  test('the table is for the running content version, and every version step lists its changes', () => {
    expect(FINGERPRINT_VERSION).toBe(CONTENT_VERSION);
    const known = new Set(nodes.map((n) => n.nodeId as string));
    for (let v = 2; v <= CONTENT_VERSION; v += 1) {
      expect(CONTENT_CHANGES[v]).toBeDefined();
      for (const id of CONTENT_CHANGES[v] ?? []) {
        expect(known.has(id)).toBe(true);
      }
    }
  });

  test.each(nodes.map((n) => [n.nodeId as string, n] as const))('%s deals the material this content version was published with', (id, n) => {
    if (process.env['PRINT_FINGERPRINTS'] === '1') {
      console.log(`FP '${id}': '${fingerprint(n.chapterId, n.nodeId)}',`);
    }
    expect(`${id} ${fingerprint(n.chapterId, n.nodeId)}`).toBe(`${id} ${FINGERPRINTS[id]}`);
  });
});
