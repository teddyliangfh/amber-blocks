import { copyKey } from '../copy';
import { chapterId, nodeId } from '../ids';
import type { Chapter } from '../schema';
import { STAIRS_10, STAIRS_6, TEN_2X5 } from './shapes';

// The ten of ch2-n9 is judged lying down only (no turns). A default for Ted:
// `{ rotation: true, mirror: false }` (the usual) accepts it standing too and
// fits a 6 × 6 mat around it.
const TEN_LYING = { rotation: false, mirror: false } as const;

// Join Island (level-progression §5): small sums first, a free-sum mini boss,
// then "who's missing?": a partner is already on the mat and the child finds
// its other half (Phase 19), and the chapter boss, the same 7 made two ways.
// Distractors never share a size with an operand, and never finish a given partner.
// Phase 21 put a new kind of move every two or three stops (new ids, in map
// order; the eight before are unchanged): two 5s stacked into a ten, sending
// the extra 2 back from 3 + 4 + 2, stairs from 1 + 2 + 3, and 10 + ? = 13.
// Which numbers, and where, are defaults for Ted (brief 21 §4).
export const CHAPTER_2: Chapter = {
  id: chapterId('ch2'),
  title: copyKey('chapter.ch2.title'),
  nodes: [
    { id: nodeId('ch2-n1'), role: 'normal', spec: { kind: 'addition_exact', pairs: [[1, 1]], distractors: [3] } },
    { id: nodeId('ch2-n2'), role: 'normal', spec: { kind: 'addition_exact', pairs: [[2, 1]], distractors: [4] } },
    { id: nodeId('ch2-n3'), role: 'normal', spec: { kind: 'addition_exact', pairs: [[2, 2]], distractors: [3, 1] } },
    // Twins again, as a shape: two 5s stacked into a ten (a decoy 4). Lying
    // down only: two lying 5s cannot stand it on end anyway, and room for a
    // standing ten made the mat 6 × 6 and the blocks 34px on small phones.
    { id: nodeId('ch2-n9'), role: 'normal', spec: { kind: 'quantity_shape', target: 10, templates: [TEN_2X5], symmetry: TEN_LYING, extra: 1, handles: [5, 5], decoys: [4] } },
    { id: nodeId('ch2-n4'), role: 'boss', spec: { kind: 'sum_composition', sum: 5, allowed: [[2, 3], [4, 1]], distractors: [5] } },
    // Too many on the mat: send the 2 back to leave 3 + 4.
    { id: nodeId('ch2-n10'), role: 'normal', spec: { kind: 'sum_composition', sum: 7, onMat: [3, 4, 2], allowed: [[3, 4]], distractors: [] } },
    { id: nodeId('ch2-n5'), role: 'normal', spec: { kind: 'sum_composition', sum: 5, given: 2, allowed: [[2, 3]], distractors: [1, 4] } },
    { id: nodeId('ch2-n6'), role: 'normal', spec: { kind: 'sum_composition', sum: 6, given: 4, allowed: [[4, 2]], distractors: [1, 3] } },
    // Three partners: stairs of 1, 2 and 3 (a decoy 4).
    { id: nodeId('ch2-n11'), role: 'normal', spec: { kind: 'quantity_shape', target: 6, templates: [STAIRS_6], extra: 1, handles: [1, 2, 3], decoys: [4] } },
    // Phase 23a: the big stairs, 1 + 2 + 3 + 4 = 10, four partners to put in
    // order (a decoy 5: 5 + 4 + 1 makes 10 but no stairs).
    { id: nodeId('ch2-n13'), role: 'normal', spec: { kind: 'quantity_shape', target: 10, templates: [STAIRS_10], extra: 1, handles: [1, 2, 3, 4], decoys: [5] } },
    { id: nodeId('ch2-n7'), role: 'normal', spec: { kind: 'sum_composition', sum: 7, given: 3, allowed: [[3, 4]], distractors: [2, 5] } },
    // A teen: a ten on the mat, which one makes 13? (2 and 4 cannot.)
    { id: nodeId('ch2-n12'), role: 'normal', spec: { kind: 'sum_composition', sum: 13, given: 10, allowed: [[10, 3]], distractors: [2, 4] } },
    { id: nodeId('ch2-n8'), role: 'boss', spec: { kind: 'sum_composition', sum: 7, allowed: [[3, 4], [5, 2]], ways: 2, distractors: [1] } },
  ],
};
