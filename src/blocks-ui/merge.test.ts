import { apply } from '../core';
import type { BenchState, Command } from '../core';
import { CONTENT_VERSION, chapterId, materialize, nodeId } from '../content';
import { MERGE_BLINK_MS, MERGE_ON, MERGE_SEAM_MS, mergedClusters } from './merge';

function puzzle(id: string) {
  return materialize({ contentVersion: CONTENT_VERSION, chapterId: chapterId(id.slice(0, 3)), nodeId: nodeId(id), attemptVariant: 0, seed: 3 });
}

function play(work: BenchState, cmds: ReadonlyArray<Command>): BenchState {
  return cmds.reduce((w, cmd) => {
    const r = apply(w, cmd);
    if (!r.ok) {
      throw new Error(r.reason);
    }
    return r.value;
  }, work);
}

const of = (p: ReturnType<typeof puzzle>, n: number) => [...p.initial.groups.values()].find((g) => g.unitIds.length === n)!.id;

describe('Phase 20 F1: joined pieces are one character (display only)', () => {
  test('the defaults: it joins once the answer is right, after a quarter second of seams and one of faces', () => {
    expect(MERGE_ON).toBe('success');
    expect(MERGE_SEAM_MS + MERGE_BLINK_MS).toBeLessThanOrEqual(500);
  });

  test('two partners joined are one cluster: the total, its parts left first, its head, the seam between them', () => {
    const p = puzzle('ch2-n8');
    const mat = play(p.initial, [
      { type: 'takeGroup', groupId: of(p, 4), origin: { x: 3, y: 0 } },
      { type: 'takeGroup', groupId: of(p, 3), origin: { x: 0, y: 0 } },
    ]);
    const [c, ...rest] = mergedClusters(mat);
    expect(rest).toEqual([]);
    expect(c!.total).toBe(7);
    expect(c!.parts).toEqual([3, 4]);
    expect(c!.head).toEqual({ x: 0, y: 0 });
    expect([c!.origin, c!.width, c!.height]).toEqual([{ x: 0, y: 0 }, 7, 1]);
    expect(c!.seams).toEqual([[{ x: 2, y: 0 }, { x: 3, y: 0 }]]);
    expect(c!.pieces.map((x) => x.id).sort()).toEqual([of(p, 3), of(p, 4)].sort());
    // The same blocks give the same key wherever they stand.
    const moved = play(mat, [{ type: 'moveGroup', groupId: of(p, 3), delta: { x: 0, y: 1 } }, { type: 'moveGroup', groupId: of(p, 4), delta: { x: 0, y: 1 } }]);
    expect(mergedClusters(moved)[0]!.key).toBe(c!.key);
  });

  test('apart, a partner alone, or single blocks alone are not joined', () => {
    const p = puzzle('ch2-n8');
    const apart = play(p.initial, [
      { type: 'takeGroup', groupId: of(p, 3), origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: of(p, 4), origin: { x: 0, y: 2 } },
    ]);
    expect(mergedClusters(apart)).toEqual([]);
    const loose = puzzle('ch1-n2');
    const [a, b] = [...loose.initial.units.keys()];
    expect(mergedClusters(play(loose.initial, [{ type: 'take', unitId: a!, to: { x: 0, y: 0 } }, { type: 'take', unitId: b!, to: { x: 1, y: 0 } }]))).toEqual([]);
  });

  test('a partner and the singles touching it: one 5, its parts the 3 and the pair of singles', () => {
    const p = puzzle('ch1-n5');
    const [c] = mergedClusters(play(p.initial, p.solution));
    expect(c!.total).toBe(5);
    expect([...c!.parts].sort()).toEqual([2, 3]);
    expect(c!.pieces).toHaveLength(3);
  });

  test('the 8 brick, two 4s: one 8; 17 = 10 + 5 + 2: one 17', () => {
    const brick = puzzle('ch1-n8');
    const [eight] = mergedClusters(play(brick.initial, brick.solution));
    expect([eight!.total, eight!.parts]).toEqual([8, [4, 4]]);
    expect(eight!.seams).toHaveLength(4);
    const big = puzzle('ch1-n12');
    const [seventeen] = mergedClusters(play(big.initial, big.solution));
    expect(seventeen!.total).toBe(17);
    expect([...seventeen!.parts].sort((x, y) => x - y)).toEqual([2, 5, 10]);
  });
});
