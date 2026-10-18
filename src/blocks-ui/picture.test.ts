import { apply } from '../core';
import type { BenchState, Command } from '../core';
import { CONTENT_VERSION, chapterId, materialize, nodeId } from '../content';
import { pictureOf } from './picture';

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

// The album draws a mat the way the stage colours it (2026-10-15 review Q).
describe('pictureOf', () => {
  test('loose blocks take the colour of the cluster they make, one face per cluster on its top-left block', () => {
    const p = puzzle('ch1-n2');
    const [a, b, c] = [...p.initial.units.keys()];
    const pair = play(p.initial, [{ type: 'take', unitId: a!, to: { x: 1, y: 1 } }, { type: 'take', unitId: b!, to: { x: 2, y: 1 } }]);
    expect(pictureOf(pair)).toEqual({
      blocks: [
        { unitId: a, cell: { x: 1, y: 1 }, hue: 'n2', face: true },
        { unitId: b, cell: { x: 2, y: 1 }, hue: 'n2', face: false },
      ],
      origin: { x: 1, y: 1 },
      cols: 2,
      rows: 1,
    });
    // Apart, each is a 1 with its own face; the box spans both.
    const apart = play(pair, [{ type: 'move', unitId: b!, to: { x: 2, y: 2 } }, { type: 'take', unitId: c!, to: { x: 0, y: 0 } }]);
    const pic = pictureOf(apart);
    expect(pic.blocks.map((x) => [x.hue, x.face])).toEqual([['n1', true], ['n1', true], ['n1', true]]);
    expect([pic.origin, pic.cols, pic.rows]).toEqual([{ x: 0, y: 0 }, 3, 3]);
  });

  test('Phase 20 F1: a partner and the singles touching it are one 5, in 5\'s colour with one face; apart, each keeps its own', () => {
    const p = puzzle('ch1-n5');
    const solved = play(p.initial, p.solution);
    const pic = pictureOf(solved);
    expect(pic.blocks).toHaveLength(5);
    expect(pic.blocks.map((x) => x.hue)).toEqual(['n5', 'n5', 'n5', 'n5', 'n5']);
    expect(pic.blocks.filter((x) => x.face)).toHaveLength(1);
    // The singles moved away from the 3: a 3 and a 2 again.
    const handle = [...p.initial.groups.values()][0]!;
    const apart = play(p.initial, [{ type: 'takeGroup', groupId: handle.id, origin: { x: 0, y: 0 } }, ...p.solution.filter((c) => c.type === 'take').map((c, i) => ({ ...c, to: { x: i, y: 2 } }))]);
    expect(pictureOf(apart).blocks.map((x) => x.hue).sort()).toEqual(['n2', 'n2', 'n3', 'n3', 'n3']);
  });

  test('17 = 10 + 5 + 2 joined: one 17 in its colour, one face (Phase 20 F1); the 8 brick one cyan 8; an empty mat draws nothing', () => {
    const p = puzzle('ch1-n12');
    const pic = pictureOf(play(p.initial, p.solution));
    expect(pic.blocks).toHaveLength(17);
    expect(new Set(pic.blocks.map((x) => x.hue))).toEqual(new Set(['n10']));
    expect(pic.blocks.filter((x) => x.face)).toHaveLength(1);
    const brick = puzzle('ch1-n8');
    const eight = pictureOf(play(brick.initial, brick.solution));
    expect(new Set(eight.blocks.map((x) => x.hue))).toEqual(new Set(['n8']));
    expect(eight.blocks.filter((x) => x.face)).toHaveLength(1);
    expect(pictureOf(p.initial)).toEqual({ blocks: [], origin: { x: 0, y: 0 }, cols: 0, rows: 0 });
  });
});

describe('D-097: pictureOf keeps the ways of a sum asked several ways apart', () => {
  test('two ways to make 7 stacked: two pink 7s with a face each, not one 14', () => {
    const p = puzzle('ch2-n8');
    const of = (n: number) => [...p.initial.groups.values()].find((g) => g.unitIds.length === n)!;
    const mat = play(p.initial, [
      { type: 'takeGroup', groupId: of(3).id, origin: { x: 0, y: 1 } },
      { type: 'takeGroup', groupId: of(4).id, origin: { x: 3, y: 1 } },
      { type: 'takeGroup', groupId: of(5).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: of(2).id, origin: { x: 5, y: 0 } },
    ]);
    const one = pictureOf(mat);
    expect(new Set(one.blocks.map((b) => b.hue))).toEqual(new Set(['n10']));
    expect(one.blocks.filter((b) => b.face)).toHaveLength(1);
    const two = pictureOf(mat, [[...of(3).unitIds, ...of(4).unitIds], [...of(5).unitIds, ...of(2).unitIds]]);
    expect(new Set(two.blocks.map((b) => b.hue))).toEqual(new Set(['n7']));
    expect(two.blocks.filter((b) => b.face).map((b) => b.cell)).toEqual(expect.arrayContaining([{ x: 0, y: 0 }, { x: 0, y: 1 }]));
    expect(two.blocks.filter((b) => b.face)).toHaveLength(2);
  });
});
