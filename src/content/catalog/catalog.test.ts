import { benchFor } from '../bench';
import { materialize } from '../generate';
import { BOSS_ENTRANCE, CHAPTERS, CONTENT_VERSION, SHAPE_ISLAND_GATE, SHAPE_ISLAND_POSITION, SIDE_ISLANDS, findChapter, findNode } from './index';
import { SHADOW_POLICY } from './chapter-5';
import { chapterId, nodeId } from '../ids';
import type { PuzzleRef, QuestionSpec } from '../schema';
import type { ShapeTemplate } from '../../core';
import { DEFAULT_SYMMETRY, matchesTemplate, mirrorX, rotate90, variants } from '../../core';
import { SINGLES_DRAG_CAP } from './chapter-1';
import { BOAT_5, BOAT_5_C, CORNER_5, DOG_6, DUCK_5, L_4, PLUS_5, RING_8, SQUARE_3X3, STAIRS_10, STAIRS_6, S_4, TEN_2X5, TEN_STANDING, T_4 } from './shapes';

// An island by its number (ch5, Shape Island, sits second on the map since Phase 23b).
const ch = (n: number) => findChapter(chapterId(`ch${n}`));

const ref = (chapter: string, node: string, contentVersion = CONTENT_VERSION): PuzzleRef => ({
  contentVersion,
  chapterId: chapterId(chapter),
  nodeId: nodeId(node),
  attemptVariant: 0,
  seed: 1,
});

describe('catalog', () => {
  test('map: three islands, three legs with a boss each (seventeen stops since Phase 23a), thirteen join stops, then eight take-away stops', () => {
    // Phase 23b: Shape Island (ch5) between Number Island and Join Island (SHAPE_ISLAND_POSITION).
    expect(CHAPTERS.map((c) => c.id)).toEqual(['ch1', 'ch5', 'ch2', 'ch3']);
    expect(ch(3).nodes).toHaveLength(8);
    expect(ch(3).nodes.filter((n) => n.role === 'boss').map((n) => n.id)).toEqual(['ch3-n4', 'ch3-n8']);
    expect(ch(1).nodes).toHaveLength(17);
    expect(ch(1).nodes.filter((n) => n.role === 'boss').map((n) => n.id)).toEqual(['ch1-n4', 'ch1-n8', 'ch1-n12']);
    expect(ch(2).nodes).toHaveLength(13);
    expect(ch(2).nodes.filter((n) => n.role === 'boss').map((n) => n.id)).toEqual(['ch2-n4', 'ch2-n8']);
    const seventeen = ch(1).nodes.find((n) => n.id === 'ch1-n12')?.spec;
    expect(ch(1).nodes[16]?.id).toBe('ch1-n12');
    expect(seventeen).toEqual({ kind: 'quantity', targets: [17], extra: 2, handles: [10, 5, 2], decoys: [4] });
    // Carrying every partner over is never the answer: a decoy makes it too
    // many, or the partners fall short and singles finish it (5 = 3 + two).
    for (const node of ch(1).nodes ?? []) {
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
      // Phase 23a: the new pictures; the standing ten's 6 × 5 is set on the stop.
      'ch1-n13': '5x4', 'ch1-n14': '6x4', 'ch1-n15': '6x4', 'ch1-n16': '6x4', 'ch1-n17': '6x5', 'ch2-n13': '6x5',
      // Phase 23b: Shape Island, fitted as PRD §4.2.1 has them, but the duck:
      // never turned, it needs no room standing up (6 × 3, not 6 × 5).
      'ch5-n1': '5x4', 'ch5-n2': '6x3', 'ch5-n3': '6x4', 'ch5-n4': '6x4', 'ch5-n5': '6x4', 'ch5-n6': '6x4', 'ch5-n7': '6x4', 'ch5-n8': '6x5',
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

  test('Phase 21: Join Island is twelve stops (thirteen since Phase 23a), a new kind of move every two or three', () => {
    const specs = ch(2).nodes.map((n) => [n.id, n.role, n.spec]);
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
      ['ch2-n13', 'normal', { kind: 'quantity_shape', target: 10, templates: [STAIRS_10], extra: 1, handles: [1, 2, 3, 4], decoys: [5] }],
      ['ch2-n7', 'normal', { kind: 'sum_composition', sum: 7, given: 3, allowed: [[3, 4]], distractors: [2, 5] }],
      ['ch2-n12', 'normal', { kind: 'sum_composition', sum: 13, given: 10, allowed: [[10, 3]], distractors: [2, 4] }],
      ['ch2-n8', 'boss', { kind: 'sum_composition', sum: 7, allowed: [[3, 4], [5, 2]], ways: 2, distractors: [1] }],
    ]);
    for (const node of ch(2).nodes) {
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
    const moves = ch(2).nodes.map((n) => move(n.spec));
    expect(moves).toEqual(['join', 'join', 'join', 'shape', 'free', 'send', 'missing', 'missing', 'shape', 'shape', 'missing', 'missing', 'ways']);
  });

  test('Phase 22: Take-away Island is eight stops: pull apart, send home, choose who goes, count down', () => {
    const specs = ch(3).nodes.map((n) => [n.id, n.role, n.spec]);
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
    for (const node of ch(3).nodes) {
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
    const moves = ch(3).nodes.map((n) => [n.id, materializeFor(n.id).solution.length] as const);
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
    const spec = (n: number) => ch(1).nodes.find((x) => x.id === `ch1-n${n}`)!.spec;
    // 2026-10-16 review A-6: five singles beside the 3 (extra 3), so counting out singles reaches 5 too.
    expect(spec(5)).toEqual({ kind: 'quantity', targets: [5], extra: 3, handles: [3] });
    expect(spec(6)).toMatchObject({ kind: 'quantity_shape', target: 4, sequence: true });
    expect(spec(7)).toMatchObject({ kind: 'quantity_shape', target: 6 });
    expect(spec(8)).toMatchObject({ kind: 'quantity_shape', target: 8, handles: [4, 4], decoys: [3] });
    expect(ch(1).nodes.find((x) => x.id === 'ch1-n8')!.role).toBe('boss');
    expect(spec(9)).toEqual({ kind: 'quantity', targets: [9], extra: 2, handles: [5, 4], decoys: [3] });
    // The 4 is a square first, then a line: two steps on the same blocks.
    const four = materializeFor('ch1-n6');
    expect(four.steps).toHaveLength(2);
    expect(four.steps!.map((s) => (s.kind === 'quantity_shape' ? s.template.cells.length : 0))).toEqual([4, 4]);
  });

  test('2026-10-15 review L: no stop asks for more than six single blocks; a stop of single blocks takes at most SINGLES_DRAG_CAP drags, changes included', () => {
    expect(SINGLES_DRAG_CAP).toBe(6);
    for (const chapter of CHAPTERS) {
      for (const node of chapter.nodes) {
        const p = materializeFor(node.id);
        const singles = p.solution.filter((c) => c.type === 'take').length;
        expect(`${node.id} ${singles <= 6}`).toBe(`${node.id} true`);
        if (node.spec.kind === 'quantity_shape' && node.spec.handles === undefined) {
          expect(`${node.id} ${p.solution.length <= SINGLES_DRAG_CAP}`).toBe(`${node.id} true`);
        }
      }
    }
  });

  test('Phase 23a: six new pictures among the old stops, the old ones as they were; shape stops 7 → 13 of 38', () => {
    const at = (id: string) => CHAPTERS.flatMap((c) => c.nodes).find((n) => n.id === id)!;
    expect(ch(1).nodes.map((n) => n.id)).toEqual(['ch1-n1', 'ch1-n2', 'ch1-n3', 'ch1-n4', 'ch1-n5', 'ch1-n6', 'ch1-n13', 'ch1-n7', 'ch1-n14', 'ch1-n8', 'ch1-n15', 'ch1-n9', 'ch1-n16', 'ch1-n10', 'ch1-n17', 'ch1-n11', 'ch1-n12']);
    expect(ch(2).nodes.map((n) => n.id).slice(8, 10)).toEqual(['ch2-n11', 'ch2-n13']);
    const both = { rotation: true, mirror: true };
    expect(at('ch1-n13').spec).toEqual({ kind: 'quantity_shape', target: 4, templates: [T_4, S_4, L_4], symmetry: both, extra: 2, sequence: true });
    expect(at('ch1-n14').spec).toEqual({ kind: 'quantity_shape', target: 5, templates: [PLUS_5], extra: 2 });
    expect(at('ch1-n15').spec).toEqual({ kind: 'quantity_shape', target: 8, templates: [RING_8], extra: 1, handles: [3, 3, 1, 1], decoys: [2] });
    expect(at('ch1-n16').spec).toEqual({ kind: 'quantity_shape', target: 9, templates: [SQUARE_3X3], extra: 1, handles: [3, 3, 3], decoys: [4] });
    expect(at('ch1-n17').spec).toEqual({ kind: 'quantity_shape', target: 10, templates: [TEN_STANDING], symmetry: { rotation: false, mirror: false }, extra: 1, handles: [2, 2, 2, 2, 2], decoys: [3] });
    expect(at('ch1-n17').bounds).toEqual({ cols: 6, rows: 5 });
    expect(at('ch2-n13').spec).toEqual({ kind: 'quantity_shape', target: 10, templates: [STAIRS_10], extra: 1, handles: [1, 2, 3, 4], decoys: [5] });
    for (const id of ['ch1-n13', 'ch1-n14', 'ch1-n15', 'ch1-n16', 'ch1-n17', 'ch2-n13']) {
      expect(at(id).role).toBe('normal');
    }
    // (Shape Island's eight, Phase 23b, left out.)
    const all = CHAPTERS.filter((c) => c.id !== 'ch5').flatMap((c) => c.nodes);
    expect(all).toHaveLength(38);
    expect(all.filter((n) => n.spec.kind === 'quantity_shape')).toHaveLength(13);
    // Three faces of 4: one block moved for each new picture (4 + 1 + 1 drags).
    const faces = materializeFor('ch1-n13');
    expect(faces.steps).toHaveLength(3);
    expect(faces.solution.map((c) => c.type)).toEqual(['take', 'take', 'take', 'take', 'move', 'move']);
    // The standing ten is not the lying one: turned, it is refused.
    const ten = materializeFor('ch1-n17');
    expect(variants(TEN_STANDING, { rotation: false, mirror: false }).map((v) => v.map((c) => `${c.x},${c.y}`).sort().join(' '))).not.toContain(TEN_2X5.cells.map((c) => `${c.x},${c.y}`).sort().join(' '));
    expect(ten.initial.bounds).toEqual({ cols: 6, rows: 5 });
  });

  test('Phase 23a: of the partners alone, a set with a decoy that makes the number never makes the picture; only the handles do', () => {
    const expected: Record<string, ReadonlyArray<string>> = { 'ch1-n15': ['2+3+3'], 'ch1-n16': [], 'ch1-n17': [], 'ch2-n13': ['1+4+5', '2+3+5'] };
    for (const [id, traps] of Object.entries(expected)) {
      const s = CHAPTERS.flatMap((c) => c.nodes).find((n) => n.id === id)!.spec;
      if (s.kind !== 'quantity_shape') {
        throw new Error(id);
      }
      const decoyAt = s.handles!.length;
      const partners = [...s.handles!, ...s.decoys!];
      const indexed = subsets(partners.map((_, i) => i)).filter((set) => set.reduce((a, i) => a + partners[i]!, 0) === s.target);
      const withDecoy = indexed.filter((set) => set.some((i) => i >= decoyAt)).map((set) => set.map((i) => partners[i]!));
      const names = [...new Set(withDecoy.map((set) => [...set].sort((a, b) => a - b).join('+')))].sort();
      expect(`${id} ${names.join(' ')}`).toBe(`${id} ${traps.join(' ')}`);
      for (const set of withDecoy) {
        expect(`${id} ${set.join('+')} ${coversWithBars(set, s.templates[0]!, s.symmetry)}`).toBe(`${id} ${set.join('+')} false`);
      }
      expect(coversWithBars(s.handles!, s.templates[0]!, s.symmetry)).toBe(true);
    }
  });
});

describe('Phase 23b: Shape Island', () => {
  const at = (id: string) => ch(5).nodes.find((n) => n.id === id)!;

  test('eight stops after Number Island, numbers 4 to 7, a mini boss and a boss; every stop a named picture with a shadow; 21 of 46 stops are pictures', () => {
    expect(SHAPE_ISLAND_POSITION).toBe('after-ch1');
    expect(SHAPE_ISLAND_GATE).toBe('none');
    expect(SIDE_ISLANDS).toEqual(new Set(['ch5']));
    expect(ch(5).title).toBe('chapter.ch5.title');
    expect(ch(5).nodes.map((n) => n.id)).toEqual(['ch5-n1', 'ch5-n2', 'ch5-n3', 'ch5-n4', 'ch5-n5', 'ch5-n6', 'ch5-n7', 'ch5-n8']);
    expect(ch(5).nodes.filter((n) => n.role === 'boss').map((n) => n.id)).toEqual(['ch5-n4', 'ch5-n8']);
    const specs = ch(5).nodes.map((n) => n.spec);
    expect(specs.map((s) => (s.kind === 'quantity_shape' ? [s.target, s.picture, s.handles ?? 'singles', s.decoys ?? []] : s.kind))).toEqual([
      [4, 'mushroom', [3, 1], [2]],
      [5, 'duck', [4, 1], [2]],
      [5, 'tree', [3, 1, 1], [2]],
      [5, 'boat', [3, 1, 1], [2, 4]],
      [7, 'house', [1, 3, 3], [2]],
      [5, 'boat', 'singles', []],
      [6, 'dog', [3, 1, 1, 1], [2]],
      [6, 'rocket', [3, 1, 1, 1], [2]],
    ]);
    // SHADOW_POLICY: there from the start on n1 – n6; on the first ask on n7, the second on n8.
    expect(SHADOW_POLICY).toEqual({ n1: 'always', n2: 'always', n3: 'always', n4: 'always', n5: 'always', n6: 'always', n7: { onHelp: 1 }, n8: { onHelp: 2 } });
    expect(specs.map((s) => (s.kind === 'quantity_shape' ? s.shadow : null))).toEqual(['always', 'always', 'always', 'always', 'always', 'always', { onHelp: 1 }, { onHelp: 2 }]);
    // PICTURE_SYMMETRY: the duck and the dog face either way, never upside down; the rest turn.
    expect(at('ch5-n2').spec).toMatchObject({ symmetry: { rotation: false, mirror: true } });
    expect(at('ch5-n7').spec).toMatchObject({ symmetry: { rotation: false, mirror: true } });
    for (const id of ['ch5-n1', 'ch5-n3', 'ch5-n4', 'ch5-n5', 'ch5-n6', 'ch5-n8']) {
      expect(at(id).spec).not.toHaveProperty('symmetry');
    }
    expect(BOSS_ENTRANCE.has(nodeId('ch5-n8'))).toBe(false);
    const all = CHAPTERS.flatMap((c) => c.nodes);
    expect(all).toHaveLength(46);
    expect(all.filter((n) => n.spec.kind === 'quantity_shape')).toHaveLength(21);
    // Every mat is six columns or fewer.
    for (const n of ch(5).nodes) {
      expect(benchFor(ch(5), n).cols).toBeLessThanOrEqual(6);
    }
  });

  test('the tasks name the pictures; the reference answers take 2, 2, 3, 3, 3, 6, 4 and 4 drags', () => {
    expect(ch(5).nodes.map((n) => materializeFor(n.id).prompt)).toEqual([
      'prompt.picture.mushroom', 'prompt.picture.duck', 'prompt.picture.tree', 'prompt.picture.boat', 'prompt.picture.house', 'prompt.quantity_shape', 'prompt.picture.dog', 'prompt.picture.rocket',
    ]);
    expect(ch(5).nodes.map((n) => materializeFor(n.id).solution.length)).toEqual([2, 2, 3, 3, 3, 6, 4, 4]);
    expect(materializeFor('ch5-n8')).toMatchObject({ picture: 'rocket', shadow: { onHelp: 2 } });
  });

  test('of the partners alone, a set with a decoy that makes the number never makes the picture (n3 3+2, n4 3+2 / 4+1, n7 3+2+1, n8 3+2+1); n1 and n2\'s decoy only makes the count wrong', () => {
    const expected: Record<string, ReadonlyArray<string>> = { 'ch5-n1': [], 'ch5-n2': [], 'ch5-n3': ['2+3'], 'ch5-n4': ['1+4', '2+3'], 'ch5-n5': [], 'ch5-n7': ['1+2+3'], 'ch5-n8': ['1+2+3'] };
    for (const [id, traps] of Object.entries(expected)) {
      const s = at(id).spec;
      if (s.kind !== 'quantity_shape') {
        throw new Error(id);
      }
      const decoyAt = s.handles!.length;
      const partners = [...s.handles!, ...s.decoys!];
      const indexed = subsets(partners.map((_, i) => i)).filter((set) => set.reduce((a, i) => a + partners[i]!, 0) === s.target);
      const withDecoy = indexed.filter((set) => set.some((i) => i >= decoyAt)).map((set) => set.map((i) => partners[i]!));
      const names = [...new Set(withDecoy.map((set) => [...set].sort((a, b) => a - b).join('+')))].sort();
      expect(`${id} ${names.join(' ')}`).toBe(`${id} ${traps.join(' ')}`);
      for (const set of withDecoy) {
        expect(`${id} ${set.join('+')} ${coversWithBars(set, s.templates[0]!, s.symmetry)}`).toBe(`${id} ${set.join('+')} false`);
      }
      expect(coversWithBars(s.handles!, s.templates[0]!, s.symmetry)).toBe(true);
    }
  });

  test('the duck and the dog: mirrored they count, turned half round they do not; turned, 3 + 2 + 1 would make the dog', () => {
    const cells = (c: ReadonlyArray<{ x: number; y: number }>) => c.map((p) => `${p.x},${p.y}`).sort().join(' ');
    for (const [id, picture] of [['ch5-n2', DUCK_5], ['ch5-n7', DOG_6]] as const) {
      const sym = { rotation: false, mirror: true };
      expect(`${id} ${matchesTemplate(mirrorX(picture.cells), picture, sym)}`).toBe(`${id} true`);
      expect(`${id} ${matchesTemplate(rotate90(rotate90(picture.cells)), picture, sym)}`).toBe(`${id} false`);
      expect(cells(variants(picture, sym)[0]!)).toBe(cells(picture.cells));
    }
    expect(coversWithBars([3, 2, 1], DOG_6, { rotation: true, mirror: true })).toBe(true);
    expect(coversWithBars([3, 2, 1], DOG_6, { rotation: false, mirror: true })).toBe(false);
  });

  test('n6: the corner turns into the boat a quarter round by one block (the same boat to the judge, a shadow of its own)', () => {
    const p = materializeFor('ch5-n6');
    expect(p.steps?.map((q) => (q.kind === 'quantity_shape' ? q.template : null))).toEqual([CORNER_5, BOAT_5_C]);
    expect(p.solution.map((c) => c.type)).toEqual(['take', 'take', 'take', 'take', 'take', 'move']);
    expect(matchesTemplate(BOAT_5_C.cells, BOAT_5)).toBe(true);
    expect(BOAT_5_C.cells).not.toEqual(BOAT_5.cells);
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
