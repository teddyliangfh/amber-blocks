import { chapterId, nodeId } from './ids';
import { fnv1a, mulberry32, seedOf, seeded } from './rng';
import type { PuzzleRef } from './schema';

const ref: PuzzleRef = { contentVersion: 1, chapterId: chapterId('ch1'), nodeId: nodeId('ch1-n1'), attemptVariant: 0, seed: 42 };

describe('rng', () => {
  test('AC-44: the same ref always yields the same sequence (regression snapshot)', () => {
    expect(seedOf(ref)).toBe(780071396);
    const rng = seeded(ref);
    expect([rng.int(100), rng.int(100), rng.int(100), rng.int(100), rng.int(100)]).toEqual([35,13,7,2,54]);
    const again = seeded(ref);
    expect([again.int(100), again.int(100)]).toEqual([35,13,7,2,54].slice(0, 2));
  });

  test('any field of the ref but the content version changes the seed', () => {
    // A content bump must not reshuffle stops it did not change (saved work there still fits).
    expect(seedOf({ ...ref, contentVersion: 2 })).toBe(seedOf(ref));
    const variants: PuzzleRef[] = [
      { ...ref, chapterId: chapterId('ch2') },
      { ...ref, nodeId: nodeId('ch1-n2') },
      { ...ref, attemptVariant: 1 },
      { ...ref, seed: 43 },
    ];
    const seeds = new Set([seedOf(ref), ...variants.map(seedOf)]);
    expect(seeds.size).toBe(variants.length + 1);
  });

  test('int stays in range, pick returns a member, shuffle is a deterministic permutation', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i += 1) {
      const v = rng.int(5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
    }
    expect(['a', 'b', 'c']).toContain(rng.pick(['a', 'b', 'c']));
    const items = [1, 2, 3, 4, 5, 6];
    const first = mulberry32(99).shuffle(items);
    const second = mulberry32(99).shuffle(items);
    expect(first).toEqual(second);
    expect([...first].sort((a, b) => a - b)).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6]);
    // Six items under a fixed seed are not left in input order forever.
    const seedsThatMove = [1, 2, 3, 4, 5].filter((s) => mulberry32(s).shuffle(items).join() !== items.join());
    expect(seedsThatMove.length).toBeGreaterThan(0);
  });

  test('int and pick reject empty or non-positive ranges', () => {
    const rng = mulberry32(1);
    expect(() => rng.int(0)).toThrow(/positive integer/);
    expect(() => rng.int(2.5)).toThrow(/positive integer/);
    expect(() => rng.pick([])).toThrow(/empty/);
  });

  test('fnv1a is stable and spreads nearby inputs', () => {
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).not.toBe(fnv1a('b'));
    expect(fnv1a('ab')).not.toBe(fnv1a('ba'));
  });
});
