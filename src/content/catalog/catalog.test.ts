import { benchFor } from '../bench';
import { materialize } from '../generate';
import { CHAPTERS, CONTENT_VERSION, findChapter, findNode } from './index';
import { chapterId, nodeId } from '../ids';
import type { PuzzleRef } from '../schema';

const ref = (chapter: string, node: string, contentVersion = CONTENT_VERSION): PuzzleRef => ({
  contentVersion,
  chapterId: chapterId(chapter),
  nodeId: nodeId(node),
  attemptVariant: 0,
  seed: 1,
});

describe('catalog', () => {
  test('map: two islands, three legs of four with a boss each, then eight join stops', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['ch1', 'ch2']);
    expect(CHAPTERS[0]?.nodes).toHaveLength(12);
    expect(CHAPTERS[0]?.nodes.filter((n) => n.role === 'boss').map((n) => n.id)).toEqual(['ch1-n4', 'ch1-n8', 'ch1-n12']);
    expect(CHAPTERS[1]?.nodes).toHaveLength(8);
    expect(CHAPTERS[1]?.nodes.filter((n) => n.role === 'boss').map((n) => n.id)).toEqual(['ch2-n4', 'ch2-n8']);
    const seventeen = CHAPTERS[0]?.nodes[11]?.spec;
    expect(seventeen).toEqual({ kind: 'quantity', targets: [17], extra: 2, handles: [10, 5, 2], decoys: [4] });
    // Carrying every partner over is never the answer: a decoy makes it too
    // many, or the partners fall short and singles finish it (5 = 3 + two).
    for (const node of CHAPTERS[0]?.nodes ?? []) {
      if ((node.spec.kind === 'quantity' || node.spec.kind === 'quantity_shape') && node.spec.handles !== undefined) {
        const all = [...node.spec.handles, ...(node.spec.decoys ?? [])].reduce((a, b) => a + b, 0);
        expect(all).not.toBe(node.spec.kind === 'quantity' ? node.spec.targets[0]! : node.spec.target);
      }
    }
    // No island fixes a mat: each stop's is fitted to its material (2026-10-15).
    expect(findChapter(chapterId('ch1')).bounds).toBeUndefined();
    expect(findChapter(chapterId('ch2')).bounds).toBeUndefined();
    const mats = Object.fromEntries(CHAPTERS.flatMap((c) => c.nodes.map((n) => [n.id, `${benchFor(c, n).cols}x${benchFor(c, n).rows}`])));
    expect(mats).toEqual({
      'ch1-n1': '3x3', 'ch1-n2': '3x3', 'ch1-n3': '5x3', 'ch1-n4': '4x3', 'ch1-n5': '6x3', 'ch1-n6': '5x5',
      'ch1-n7': '6x4', 'ch1-n8': '6x5', 'ch1-n9': '6x3', 'ch1-n10': '6x3', 'ch1-n11': '6x4', 'ch1-n12': '6x5',
      'ch2-n1': '4x3', 'ch2-n2': '5x3', 'ch2-n3': '5x3', 'ch2-n4': '6x3', 'ch2-n5': '6x3', 'ch2-n6': '7x3', 'ch2-n7': '8x3', 'ch2-n8': '8x3',
    });
  });

  test('AC-43: every shape stop has as many template cells as its target', () => {
    for (const chapter of CHAPTERS) {
      for (const node of chapter.nodes) {
        if (node.spec.kind === 'quantity_shape') {
          for (const t of node.spec.templates) {
            expect(t.cells).toHaveLength(node.spec.target);
          }
        }
      }
    }
  });

  test('Phase 19: Join Island is three joins, the free-sum mini boss, three "who\'s missing?" stops and 7 made two ways', () => {
    const specs = CHAPTERS[1]!.nodes.map((n) => [n.id, n.role, n.spec]);
    expect(specs).toEqual([
      ['ch2-n1', 'normal', { kind: 'addition_exact', pairs: [[1, 1]], distractors: [3] }],
      ['ch2-n2', 'normal', { kind: 'addition_exact', pairs: [[2, 1]], distractors: [4] }],
      ['ch2-n3', 'normal', { kind: 'addition_exact', pairs: [[2, 2]], distractors: [3, 1] }],
      ['ch2-n4', 'boss', { kind: 'sum_composition', sum: 5, allowed: [[2, 3], [4, 1]], distractors: [5] }],
      ['ch2-n5', 'normal', { kind: 'sum_composition', sum: 5, given: 2, allowed: [[2, 3]], distractors: [1, 4] }],
      ['ch2-n6', 'normal', { kind: 'sum_composition', sum: 6, given: 4, allowed: [[4, 2]], distractors: [1, 3] }],
      ['ch2-n7', 'normal', { kind: 'sum_composition', sum: 7, given: 3, allowed: [[3, 4]], distractors: [2, 5] }],
      ['ch2-n8', 'boss', { kind: 'sum_composition', sum: 7, allowed: [[3, 4], [5, 2]], ways: 2, distractors: [1] }],
    ]);
    for (const node of CHAPTERS[1]!.nodes) {
      const s = node.spec;
      if (s.kind !== 'sum_composition') {
        continue;
      }
      // No distractor finishes the partner already on the mat.
      if (s.given !== undefined) {
        expect(s.distractors.filter((d) => d + s.given! === s.sum)).toEqual([]);
      }
      // The boss's tray makes 7 exactly the two allowed ways: 3 + 4 and 5 + 2.
      if (s.ways !== undefined) {
        const tray = [...s.allowed.flat(), ...s.distractors];
        const pairs = tray.flatMap((a, i) => tray.slice(i + 1).filter((b) => a + b === s.sum).map((b) => [a, b].sort().join('+')));
        expect(pairs.sort()).toEqual(['2+5', '3+4']);
      }
    }
    // A "who's missing?" stop opens with its partner on the mat and asks for the other half.
    const seven = materializeFor('ch2-n7');
    expect(groupSizeOf(seven, seven.given!)).toBe(3);
    expect(seven.prompt).toBe('prompt.missing_part');
    expect(materializeFor('ch2-n8').ways).toBe(2);
  });

  test('AC-47: a ref from another content version or an unknown node is refused', () => {
    expect(() => findNode(ref('ch1', 'ch1-n1', CONTENT_VERSION + 1))).toThrow(new RegExp(`content version ${CONTENT_VERSION + 1}`));
    expect(() => findNode(ref('ch1', 'ch1-n1', CONTENT_VERSION - 1))).toThrow(/content version/);
    expect(() => findNode(ref('ch1', 'ch1-n99'))).toThrow(/unknown node/);
    expect(() => findNode(ref('ch9', 'ch1-n1'))).toThrow(/unknown chapter/);
    expect(findNode(ref('ch1', 'ch1-n4')).node.role).toBe('boss');
  });

  test('2026-10-15 review L: Number Island 5–9 is 5 (3 + singles), the same 4 twice, the 6 tower, 8 from 4 + 4, 9 from 5 + 4', () => {
    const spec = (n: number) => CHAPTERS[0]!.nodes[n - 1]!.spec;
    // 2026-10-16 review A-6: five singles beside the 3 (extra 3), so counting out singles reaches 5 too.
    expect(spec(5)).toEqual({ kind: 'quantity', targets: [5], extra: 3, handles: [3] });
    expect(spec(6)).toMatchObject({ kind: 'quantity_shape', target: 4, sequence: true });
    expect(spec(7)).toMatchObject({ kind: 'quantity_shape', target: 6 });
    expect(spec(8)).toMatchObject({ kind: 'quantity_shape', target: 8, handles: [4, 4], decoys: [3] });
    expect(CHAPTERS[0]!.nodes[7]!.role).toBe('boss');
    expect(spec(9)).toEqual({ kind: 'quantity', targets: [9], extra: 2, handles: [5, 4], decoys: [3] });
    // The 4 is a square first, then a line: two steps on the same blocks.
    const four = materializeFor('ch1-n6');
    expect(four.steps).toHaveLength(2);
    expect(four.steps!.map((s) => (s.kind === 'quantity_shape' ? s.template.cells.length : 0))).toEqual([4, 4]);
  });

  test('2026-10-15 review L: no stop asks for more than six single blocks', () => {
    for (const chapter of CHAPTERS) {
      for (const node of chapter.nodes) {
        const singles = materializeFor(node.id).solution.filter((c) => c.type === 'take').length;
        expect(`${node.id} ${singles <= 6}`).toBe(`${node.id} true`);
      }
    }
  });
});

function materializeFor(id: string) {
  return materialize(ref(id.slice(0, 3), id));
}

function groupSizeOf(p: ReturnType<typeof materializeFor>, id: NonNullable<ReturnType<typeof materializeFor>['given']>): number {
  return p.initial.groups.get(id)!.unitIds.length;
}
