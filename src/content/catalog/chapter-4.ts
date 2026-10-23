import { copyKey } from '../copy';
import { chapterId, nodeId } from '../ids';
import type { Chapter } from '../schema';

// Compare Island (Phase 23c, docs/take-away-and-compare-design.md §3.2): the
// partners line up to see who is longer, who has more. The partner on the
// rail above the mat is "the other one"; the child puts out a row under it.
// One new move, learnt by building first: as many as it (3), more than it
// (2), then picking a partner with fewer (4: try them, the numbers say it);
// the mini boss builds one more three times while the rail grows (3 → 4 → 5);
// pick the same (4), pick more (3: 1 + 2 makes 3, the same, a discovery);
// build one fewer (5); the boss lines up 1, 3 and 4, three compared at once.
// "Fewer" is never built: the first block is fewer already, nothing compared
// (design §3.2). Numbers and order are defaults for Ted (design §9 #3, #11).
export const CHAPTER_4: Chapter = {
  id: chapterId('ch4'),
  title: copyKey('chapter.ch4.title'),
  nodes: [
    { id: nodeId('ch4-n1'), role: 'normal', spec: { kind: 'compare', given: 3, relation: 'same', singles: 5 } },
    { id: nodeId('ch4-n2'), role: 'normal', spec: { kind: 'compare', given: 2, relation: 'more', singles: 4 } },
    { id: nodeId('ch4-n3'), role: 'normal', spec: { kind: 'compare', given: 4, relation: 'fewer', partners: [2, 5, 4] } },
    // One more, three times: build 4, the rail grows to 4; build 5; build 6.
    { id: nodeId('ch4-n4'), role: 'boss', spec: { kind: 'compare', given: 3, relation: 'one_more', steps: 3, singles: 6 } },
    { id: nodeId('ch4-n5'), role: 'normal', spec: { kind: 'compare', given: 4, relation: 'same', partners: [4, 2, 5] } },
    // Only the 5 is more alone; the 1 and the 2 together are 3, the same.
    { id: nodeId('ch4-n6'), role: 'normal', spec: { kind: 'compare', given: 3, relation: 'more', partners: [1, 5, 2] } },
    { id: nodeId('ch4-n7'), role: 'normal', spec: { kind: 'compare', given: 5, relation: 'one_fewer', singles: 6 } },
    // Smallest first, side by side: 1 < 3 < 4 (dealt shuffled).
    { id: nodeId('ch4-n8'), role: 'boss', spec: { kind: 'order', sizes: [1, 3, 4] } },
  ],
};
