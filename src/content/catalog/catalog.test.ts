import { benchFor } from '../bench';
import { materialize } from '../generate';
import { CHAPTERS, CONTENT_VERSION, findChapter, findNode } from './index';
import { chapterId, nodeId } from '../ids';
import type { PuzzleRef, QuestionSpec } from '../schema';
import type { ShapeTemplate } from '../../core';
import { DEFAULT_SYMMETRY, variants } from '../../core';
import { STAIRS_6, TEN_2X5 } from './shapes';

const ref = (chapter: string, node: string, contentVersion = CONTENT_VERSION): PuzzleRef => ({
  contentVersion,
  chapterId: chapterId(chapter),
  nodeId: nodeId(node),
  attemptVariant: 0,
  seed: 1,
});

describe('catalog', () => {
  test('map: three islands, three legs of four with a boss each, twelve join stops, then eight take-away stops', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['ch1', 'ch2', 'ch3']);
    expect(CHAPTERS[2]?.nodes).toHaveLength(8);
    expect(CHAPTERS[2]?.nodes.filter((n) => n.role === 'boss').map((n) => n.id)).toEqual(['ch3-n4', 'ch3-n8']);
    expect(CHAPTERS[0]?.nodes).toHaveLength(12);
    expect(CHAPTERS[0]?.nodes.filter((n) => n.role === 'boss').map((n) => n.id)).toEqual(['ch1-n4', 'ch1-n8', 'ch1-n12']);
    expect(CHAPTERS[1]?.nodes).toHaveLength(12);
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
    expect(findChapter(chapterId('ch3')).bounds).toBeUndefined();
    const mats = Object.fromEntries(CHAPTERS.flatMap((c) => c.nodes.map((n) => [n.id, `${benchFor(c, n).cols}x${benchFor(c, n).rows}`])));
    expect(mats).toEqual({
      'ch1-n1': '3x3', 'ch1-n2': '3x3', 'ch1-n3': '5x3', 'ch1-n4': '4x3', 'ch1-n5': '6x3', 'ch1-n6': '5x5',
      'ch1-n7': '6x4', 'ch1-n8': '6x5', 'ch1-n9': '6x3', 'ch1-n10': '6x3', 'ch1-n11': '6x4', 'ch1-n12': '6x5',
      'ch2-n1': '4x3', 'ch2-n2': '5x3', 'ch2-n3': '5x3', 'ch2-n4': '6x3', 'ch2-n5': '6x3', 'ch2-n6': '7x3', 'ch2-n7': '8x3', 'ch2-n8': '8x3',
      // Phase 21: the ten is judged lying down only, so its mat is not tall;
      // the row to send back from and the 10 with its other half fill nine columns.
      'ch2-n9': '6x3', 'ch2-n10': '9x3', 'ch2-n11': '6x4', 'ch2-n12': '9x3',
      // Phase 22: the row the stop opens with, one column to pull a block
      // away into or to leave empty (design §3.1).
      'ch3-n1': '4x3', 'ch3-n2': '5x3', 'ch3-n3': '5x3', 'ch3-n4': '6x3', 'ch3-n5': '6x3', 'ch3-n6': '7x3', 'ch3-n7': '8x3', 'ch3-n8': '6x3',
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

  test('Phase 21: Join Island is twelve stops, a new kind of move every two or three', () => {
    const specs = CHAPTERS[1]!.nodes.map((n) => [n.id, n.role, n.spec]);
    expect(specs).toEqual([
      ['ch2-n1', 'normal', { kind: 'addition_exact', pairs: [[1, 1]], distractors: [3] }],
      ['ch2-n2', 'normal', { kind: 'addition_exact', pairs: [[2, 1]], distractors: [4] }],
      ['ch2-n3', 'normal', { kind: 'addition_exact', pairs: [[2, 2]], distractors: [3, 1] }],
      ['ch2-n9', 'normal', { kind: 'quantity_shape', target: 10, templates: [TEN_2X5], symmetry: { rotation: false, mirror: false }, extra: 1, handles: [5, 5], decoys: [4] }],
      ['ch2-n4', 'boss', { kind: 'sum_composition', sum: 5, allowed: [[2, 3], [4, 1]], distractors: [5] }],
      ['ch2-n10', 'normal', { kind: 'sum_composition', sum: 7, onMat: [3, 4, 2], allowed: [[3, 4]], distractors: [] }],
      ['ch2-n5', 'normal', { kind: 'sum_composition', sum: 5, given: 2, allowed: [[2, 3]], distractors: [1, 4] }],
      ['ch2-n6', 'normal', { kind: 'sum_composition', sum: 6, given: 4, allowed: [[4, 2]], distractors: [1, 3] }],
      ['ch2-n11', 'normal', { kind: 'quantity_shape', target: 6, templates: [STAIRS_6], extra: 1, handles: [1, 2, 3], decoys: [4] }],
      ['ch2-n7', 'normal', { kind: 'sum_composition', sum: 7, given: 3, allowed: [[3, 4]], distractors: [2, 5] }],
      ['ch2-n12', 'normal', { kind: 'sum_composition', sum: 13, given: 10, allowed: [[10, 3]], distractors: [2, 4] }],
      ['ch2-n8', 'boss', { kind: 'sum_composition', sum: 7, allowed: [[3, 4], [5, 2]], ways: 2, distractors: [1] }],
    ]);
    for (const node of CHAPTERS[1]!.nodes) {
      const s = node.spec;
      if (s.kind === 'quantity_shape') {
        // Of the partners alone, only the handles cover the picture: the decoy
        // makes no other set that does (2 + 4 is 6, but a 4 is no step of the stairs).
        const partners = [...s.handles!, ...s.decoys!];
        const sets = subsets(partners).filter((set) => set.reduce((a, b) => a + b, 0) === s.target);
        const covering = sets.filter((set) => coversWithBars(set, s.templates[0]!, s.symmetry));
        expect(`${node.id} ${covering.map((set) => [...set].sort().join('+')).join(' ')}`).toBe(`${node.id} ${[...s.handles!].sort().join('+')}`);
        continue;
      }
      if (s.kind !== 'sum_composition') {
        continue;
      }
      // No distractor finishes the partner already on the mat.
      if (s.given !== undefined) {
        expect(s.distractors.filter((d) => d + s.given! === s.sum)).toEqual([]);
      }
      // The row to send back from: exactly one pair in it makes 7, 3 + 4, side
      // by side; the 2 at the end is the only thing to send back.
      if (s.onMat !== undefined) {
        const row = s.onMat;
        const pairs = row.flatMap((_, i) => row.slice(i + 1).map((__, k) => [i, i + 1 + k] as const)).filter(([i, j]) => row[i]! + row[j]! === s.sum);
        expect(pairs).toEqual([[0, 1]]);
        const p = materializeFor(node.id);
        expect(p.solution).toEqual([{ type: 'returnGroup', groupId: p.onMat![2] }]);
        expect(p.prompt).toBe('prompt.send_away');
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
    const teen = materializeFor('ch2-n12');
    expect(groupSizeOf(teen, teen.given!)).toBe(10);
    expect(materializeFor('ch2-n8').ways).toBe(2);
    // Every two or three stops the move changes (brief 21: no more than two of a kind in a row).
    const move = (s: QuestionSpec) =>
      s.kind === 'quantity_shape' ? 'shape' : s.kind === 'addition_exact' ? 'join' : s.kind !== 'sum_composition' ? 'quantity' : s.onMat !== undefined ? 'send' : s.given !== undefined ? 'missing' : s.ways !== undefined ? 'ways' : 'free';
    const moves = CHAPTERS[1]!.nodes.map((n) => move(n.spec));
    expect(moves).toEqual(['join', 'join', 'join', 'shape', 'free', 'send', 'missing', 'missing', 'shape', 'missing', 'missing', 'ways']);
  });

  test('Phase 22: Take-away Island is eight stops: pull apart, send home, choose who goes, count down', () => {
    const specs = CHAPTERS[2]!.nodes.map((n) => [n.id, n.role, n.spec]);
    expect(specs).toEqual([
      ['ch3-n1', 'normal', { kind: 'split', total: 3, parts: 2 }],
      ['ch3-n2', 'normal', { kind: 'split', total: 4, parts: 2 }],
      ['ch3-n3', 'normal', { kind: 'take_away', start: 4, take: 1 }],
      ['ch3-n4', 'boss', { kind: 'split', total: 5, parts: 2, ways: 2 }],
      ['ch3-n5', 'normal', { kind: 'take_away', start: 5, take: 2 }],
      ['ch3-n6', 'normal', { kind: 'take_away', start: 6, take: 2, onMat: [4, 2] }],
      ['ch3-n7', 'normal', { kind: 'take_away', start: 7, take: 3, onMat: [3, 2, 2] }],
      ['ch3-n8', 'boss', { kind: 'take_away', start: 5, take: 4, steps: [1, 1, 1, 1] }],
    ]);
    // Numbers never pass 7, and nothing is taken down to nothing (design §1.1).
    for (const node of CHAPTERS[2]!.nodes) {
      const s = node.spec;
      const whole = s.kind === 'split' ? s.total : s.kind === 'take_away' ? s.start : 0;
      expect(`${node.id} ${whole <= 7}`).toBe(`${node.id} true`);
      if (s.kind === 'take_away') {
        expect(s.start - s.take).toBeGreaterThanOrEqual(1);
        // From partners: exactly one set of them (by sizes) is the take, so
        // there is one right thing to send home. 7 − 3 from 3 + 2 + 2: only the 3
        // (the two 2s are 4 blocks, not 3).
        if (s.onMat !== undefined) {
          const sets = subsets(s.onMat).filter((set) => set.reduce((a, b) => a + b, 0) === s.take).map((set) => [...set].sort().join('+'));
          expect(`${node.id} ${[...new Set(sets)].join(' ')}`).toBe(`${node.id} ${s.take}`);
          expect(s.onMat.reduce((a, b) => a + b, 0)).toBe(s.start);
        }
      }
      // Two ways to split 5: 1 + 4 and 2 + 3 are different, and there are no more.
      if (s.kind === 'split' && s.ways !== undefined) {
        expect(s.ways).toBeLessThanOrEqual(Math.floor(s.total / 2));
      }
    }
    // What each stop opens with and how it is solved.
    const three = materializeFor('ch3-n1');
    expect(three.initial.bench.size).toBe(3);
    expect(three.solution).toEqual([{ type: 'move', unitId: expect.any(String), to: { x: 3, y: 1 } }]);
    expect(three.prompt).toBe('prompt.split');
    const four = materializeFor('ch3-n3');
    expect(four.question).toEqual({ kind: 'quantity', target: 3 });
    expect(four.takeAway).toEqual({ start: 4, take: 1 });
    expect(four.solution.map((c) => c.type)).toEqual(['return']);
    expect(four.prompt).toBe('prompt.take_away');
    expect(materializeFor('ch3-n4').ways).toBe(2);
    const six = materializeFor('ch3-n6');
    expect(six.onMat!.map((id) => groupSizeOf(six, id))).toEqual([4, 2]);
    expect(six.solution).toEqual([{ type: 'returnGroup', groupId: six.onMat![1] }]);
    expect(six.prompt).toBe('prompt.take_away.partner');
    const seven = materializeFor('ch3-n7');
    expect(seven.solution).toEqual([{ type: 'returnGroup', groupId: seven.onMat![0] }]);
    const rocket = materializeFor('ch3-n8');
    expect(rocket.steps!.map((q) => (q.kind === 'quantity' ? q.target : 0))).toEqual([4, 3, 2, 1]);
    expect(rocket.solution.map((c) => c.type)).toEqual(['return', 'return', 'return', 'return']);
    expect(rocket.takeAway).toEqual({ start: 5, take: 4 });
    // Every stop is at most six single-block drags (the countdown is four).
    const moves = CHAPTERS[2]!.nodes.map((n) => [n.id, materializeFor(n.id).solution.length] as const);
    expect(moves).toEqual([['ch3-n1', 1], ['ch3-n2', 1], ['ch3-n3', 1], ['ch3-n4', 2], ['ch3-n5', 2], ['ch3-n6', 1], ['ch3-n7', 1], ['ch3-n8', 4]]);
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

// Every sub-multiset of sizes (by position).
function subsets(sizes: ReadonlyArray<number>): ReadonlyArray<ReadonlyArray<number>> {
  return sizes.reduce<ReadonlyArray<ReadonlyArray<number>>>((all, n) => [...all, ...all.map((set) => [...set, n])], [[]]);
}

// Can rigid partner bars (one row up to 5, a partner is never turned) cover
// some turn of the picture exactly? Tries every way, from the top-left gap.
function coversWithBars(sizes: ReadonlyArray<number>, picture: ShapeTemplate, symmetry = DEFAULT_SYMMETRY): boolean {
  const bar = (n: number) => Array.from({ length: Math.min(n, 5) }, (_, x) => ({ x, y: 0 })).concat(Array.from({ length: Math.max(0, n - 5) }, (_, x) => ({ x, y: 1 })));
  return variants(picture, symmetry).some((cells) => {
    const key = (c: { x: number; y: number }) => `${c.x},${c.y}`;
    const inside = new Set(cells.map(key));
    const order = [...cells].sort((a, b) => a.y - b.y || a.x - b.x);
    const fill = (left: ReadonlyArray<number>, covered: ReadonlySet<string>): boolean => {
      const next = order.find((c) => !covered.has(key(c)));
      if (next === undefined) {
        return left.length === 0;
      }
      return left.some((n, i) => {
        const mine = bar(n).map((c) => key({ x: c.x + next.x, y: c.y + next.y }));
        return mine.every((k) => inside.has(k) && !covered.has(k)) && fill(left.filter((_, j) => j !== i), new Set([...covered, ...mine]));
      });
    };
    return fill(sizes, new Set());
  });
}
