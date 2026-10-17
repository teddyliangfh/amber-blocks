import { copyKey } from '../copy';
import { chapterId, nodeId } from '../ids';
import type { Chapter } from '../schema';

// Join Island (level-progression §5): small sums first, a free-sum mini boss,
// then "who's missing?": a partner is already on the mat and the child finds
// its other half (Phase 19), and the chapter boss, the same 7 made two ways.
// Distractors never share a size with an operand, and never finish a given partner.
export const CHAPTER_2: Chapter = {
  id: chapterId('ch2'),
  title: copyKey('chapter.ch2.title'),
  nodes: [
    { id: nodeId('ch2-n1'), role: 'normal', spec: { kind: 'addition_exact', pairs: [[1, 1]], distractors: [3] } },
    { id: nodeId('ch2-n2'), role: 'normal', spec: { kind: 'addition_exact', pairs: [[2, 1]], distractors: [4] } },
    { id: nodeId('ch2-n3'), role: 'normal', spec: { kind: 'addition_exact', pairs: [[2, 2]], distractors: [3, 1] } },
    { id: nodeId('ch2-n4'), role: 'boss', spec: { kind: 'sum_composition', sum: 5, allowed: [[2, 3], [4, 1]], distractors: [5] } },
    { id: nodeId('ch2-n5'), role: 'normal', spec: { kind: 'sum_composition', sum: 5, given: 2, allowed: [[2, 3]], distractors: [1, 4] } },
    { id: nodeId('ch2-n6'), role: 'normal', spec: { kind: 'sum_composition', sum: 6, given: 4, allowed: [[4, 2]], distractors: [1, 3] } },
    { id: nodeId('ch2-n7'), role: 'normal', spec: { kind: 'sum_composition', sum: 7, given: 3, allowed: [[3, 4]], distractors: [2, 5] } },
    { id: nodeId('ch2-n8'), role: 'boss', spec: { kind: 'sum_composition', sum: 7, allowed: [[3, 4], [5, 2]], ways: 2, distractors: [1] } },
  ],
};
