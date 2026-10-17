import { copyKey } from '../copy';
import { chapterId, nodeId } from '../ids';
import type { Chapter } from '../schema';
import { BRICK_2X4, CORNER_3, LINE_4, SQUARE_2X2, TOWER_2X3 } from './shapes';

// Number Island (level-progression §3): three legs, each ending in a boss.
// Targets do not climb in order on purpose (D-018). Every tray holds spare
// blocks (or a decoy partner) so that emptying it is never the answer by itself.
// No stop asks for more than six single blocks: bigger numbers come as
// partners to carry (2026-10-15 review: 9 was nine drags of grey blocks).
export const CHAPTER_1: Chapter = {
  id: chapterId('ch1'),
  title: copyKey('chapter.ch1.title'),
  nodes: [
    // Leg 1: partners set off
    { id: nodeId('ch1-n1'), role: 'normal', spec: { kind: 'quantity', targets: [1], extra: 2 } },
    { id: nodeId('ch1-n2'), role: 'normal', spec: { kind: 'quantity', targets: [2], extra: 2 } },
    { id: nodeId('ch1-n3'), role: 'normal', spec: { kind: 'quantity_shape', target: 4, templates: [SQUARE_2X2], extra: 2 } },
    { id: nodeId('ch1-n4'), role: 'boss', spec: { kind: 'quantity_shape', target: 3, templates: [CORNER_3], extra: 2 } },
    // Leg 2: shape garden (reordered 2026-10-15, D-044). 5 is the first
    // partner: a 3 to carry and five singles (2026-10-16 review A-6: with four,
    // counting out singles, the natural way, could not reach 5 and the first
    // correction said "can't make 5 this way"; now singles alone work, and the
    // 3 is the shortcut, not the only way). Then the same four blocks twice:
    // a square, then a line. The 6 tower, then the 8 brick built from two 4s.
    { id: nodeId('ch1-n5'), role: 'normal', spec: { kind: 'quantity', targets: [5], extra: 3, handles: [3] } },
    { id: nodeId('ch1-n6'), role: 'normal', spec: { kind: 'quantity_shape', target: 4, templates: [SQUARE_2X2, LINE_4], extra: 2, sequence: true } },
    { id: nodeId('ch1-n7'), role: 'normal', spec: { kind: 'quantity_shape', target: 6, templates: [TOWER_2X3], extra: 2 } },
    { id: nodeId('ch1-n8'), role: 'boss', spec: { kind: 'quantity_shape', target: 8, templates: [BRICK_2X4], extra: 1, handles: [4, 4], decoys: [3] } },
    // Leg 3: big partner mountain, carried by handles. Each tray also holds a
    // decoy partner, so the partners are never simply the answer (2026-10-14).
    // 9 is a 5 and a 4, the way a 9 is drawn.
    { id: nodeId('ch1-n9'), role: 'normal', spec: { kind: 'quantity', targets: [9], extra: 2, handles: [5, 4], decoys: [3] } },
    { id: nodeId('ch1-n10'), role: 'normal', spec: { kind: 'quantity', targets: [10], extra: 2, handles: [5, 5], decoys: [4] } },
    { id: nodeId('ch1-n11'), role: 'normal', spec: { kind: 'quantity', targets: [12], extra: 2, handles: [10, 2], decoys: [3] } },
    { id: nodeId('ch1-n12'), role: 'boss', spec: { kind: 'quantity', targets: [17], extra: 2, handles: [10, 5, 2], decoys: [4] } },
  ],
};
