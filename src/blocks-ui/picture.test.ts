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

  test('a partner keeps its own number\'s colour beside loose blocks touching it (5 = a 3 and two singles)', () => {
    const p = puzzle('ch1-n5');
    const solved = play(p.initial, p.solution);
    const pic = pictureOf(solved);
    expect(pic.blocks).toHaveLength(5);
    const hues = pic.blocks.map((x) => x.hue).sort();
    expect(hues).toEqual(['n2', 'n2', 'n3', 'n3', 'n3']);
    // One face on the partner, one on the pair of singles.
    expect(pic.blocks.filter((x) => x.face).map((x) => x.hue).sort()).toEqual(['n2', 'n3']);
  });

  test('17 = 10 + 5 + 2: three partners, three faces; an empty mat draws nothing', () => {
    const p = puzzle('ch1-n12');
    const pic = pictureOf(play(p.initial, p.solution));
    expect(pic.blocks).toHaveLength(17);
    expect(pic.blocks.filter((x) => x.face).map((x) => x.hue).sort()).toEqual(['n10', 'n2', 'n5']);
    expect(pictureOf(p.initial)).toEqual({ blocks: [], origin: { x: 0, y: 0 }, cols: 0, rows: 0 });
  });
});
