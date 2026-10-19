import { copyKey } from '../copy';
import { chapterId, nodeId } from '../ids';
import type { Chapter } from '../schema';

// Take-away Island (Phase 22, docs/take-away-and-compare-design.md §3.1): the
// partners have played on the mat and go home to sleep; the tray is home. One
// new move, learnt with numbers up to 5 first: pull a row apart (3, 4), send
// one home (4 − 1), the mini boss splits 5 two ways, send two home (5 − 2),
// then choose which partner goes (6 − 2 from a 4 and a 2; 7 − 3 from 3 + 2 + 2,
// where the two 2s are 4 blocks, not 3), and the boss counts 5 down to 1 one
// block at a time and launches it. Numbers and order are defaults for Ted
// (design §9 #3); the boss is the countdown rocket (design §9 #10).
export const CHAPTER_3: Chapter = {
  id: chapterId('ch3'),
  title: copyKey('chapter.ch3.title'),
  nodes: [
    { id: nodeId('ch3-n1'), role: 'normal', spec: { kind: 'split', total: 3, parts: 2 } },
    { id: nodeId('ch3-n2'), role: 'normal', spec: { kind: 'split', total: 4, parts: 2 } },
    { id: nodeId('ch3-n3'), role: 'normal', spec: { kind: 'take_away', start: 4, take: 1 } },
    // Two different splits of 5 (1 + 4 or 2 + 3, in either order; the same one twice is not two).
    { id: nodeId('ch3-n4'), role: 'boss', spec: { kind: 'split', total: 5, parts: 2, ways: 2 } },
    { id: nodeId('ch3-n5'), role: 'normal', spec: { kind: 'take_away', start: 5, take: 2 } },
    // Which partner goes: only the 2 leaves 4; only the 3 leaves 4 (the two 2s leave 3).
    { id: nodeId('ch3-n6'), role: 'normal', spec: { kind: 'take_away', start: 6, take: 2, onMat: [4, 2] } },
    { id: nodeId('ch3-n7'), role: 'normal', spec: { kind: 'take_away', start: 7, take: 3, onMat: [3, 2, 2] } },
    // The countdown rocket: 5, 4, 3, 2, 1, then the last one launches.
    { id: nodeId('ch3-n8'), role: 'boss', spec: { kind: 'take_away', start: 5, take: 4, steps: [1, 1, 1, 1] } },
  ],
};
