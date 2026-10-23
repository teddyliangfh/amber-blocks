import { copyKey } from '../copy';
import { chapterId, nodeId } from '../ids';
import type { Chapter } from '../schema';
import { BRICK_2X4, CORNER_3, L_4, LINE_4, PLUS_5, RING_8, SQUARE_2X2, SQUARE_3X3, S_4, TEN_STANDING, TOWER_2X3, T_4 } from './shapes';

// Number Island (level-progression §3): three legs, each ending in a boss.
// Targets do not climb in order on purpose (D-018). Every tray holds spare
// blocks (or a decoy partner) so that emptying it is never the answer by itself.
// No stop asks for more than six single blocks: bigger numbers come as
// partners to carry (2026-10-15 review: 9 was nine drags of grey blocks).
// SINGLES_DRAG_CAP: the most drags a stop of single blocks may take, the
// first picture and every change after it (catalog.test.ts checks every
// stop). A default for Ted (PRD §8 #15): at 7, a tree turning into a plus
// (5 + 2 drags) would fit too.
export const SINGLES_DRAG_CAP = 6;

// Phase 23a (content v9, PRD §4.1): six new pictures among the old stops (new
// ids, in map order; the old stops unchanged), five here and one on Join
// Island. Which pictures and where are defaults for Ted (PRD §8 #6).
// The zigzag and the boot have a left and a right hand; a four-year-old does
// not tell them apart (PRD §4.2.4), so either way round counts.
const MIRROR_FOR_CHIRAL = { rotation: true, mirror: true } as const;
// The standing ten stays standing: lying down it is ch2-n9's ten.
const TEN_UPRIGHT = { rotation: false, mirror: false } as const;
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
    // "Three faces of 4": a mushroom, a zigzag, a boot, one block moved each time.
    { id: nodeId('ch1-n13'), role: 'normal', spec: { kind: 'quantity_shape', target: 4, templates: [T_4, S_4, L_4], symmetry: MIRROR_FOR_CHIRAL, extra: 2, sequence: true } },
    { id: nodeId('ch1-n7'), role: 'normal', spec: { kind: 'quantity_shape', target: 6, templates: [TOWER_2X3], extra: 2 } },
    // A plus of 5 single blocks.
    { id: nodeId('ch1-n14'), role: 'normal', spec: { kind: 'quantity_shape', target: 5, templates: [PLUS_5], extra: 2 } },
    { id: nodeId('ch1-n8'), role: 'boss', spec: { kind: 'quantity_shape', target: 8, templates: [BRICK_2X4], extra: 1, handles: [4, 4], decoys: [3] } },
    // 8 another way: a ring of 3 + 3 + 1 + 1. The decoy 2 makes 8 too (3 + 3 + 2) but leaves no hole.
    { id: nodeId('ch1-n15'), role: 'normal', spec: { kind: 'quantity_shape', target: 8, templates: [RING_8], extra: 1, handles: [3, 3, 1, 1], decoys: [2] } },
    // Leg 3: big partner mountain, carried by handles. Each tray also holds a
    // decoy partner, so the partners are never simply the answer (2026-10-14).
    // 9 is a 5 and a 4, the way a 9 is drawn.
    { id: nodeId('ch1-n9'), role: 'normal', spec: { kind: 'quantity', targets: [9], extra: 2, handles: [5, 4], decoys: [3] } },
    // 9 as a square: three 3s stacked (a decoy 4).
    { id: nodeId('ch1-n16'), role: 'normal', spec: { kind: 'quantity_shape', target: 9, templates: [SQUARE_3X3], extra: 1, handles: [3, 3, 3], decoys: [4] } },
    { id: nodeId('ch1-n10'), role: 'normal', spec: { kind: 'quantity', targets: [10], extra: 2, handles: [5, 5], decoys: [4] } },
    // 10 standing: five 2s, one on another (a decoy 3). Its mat is set at 6 × 5:
    // fitted, it would be 6 × 6 and the blocks 37px on a short phone (D-090).
    { id: nodeId('ch1-n17'), role: 'normal', bounds: { cols: 6, rows: 5 }, spec: { kind: 'quantity_shape', target: 10, templates: [TEN_STANDING], symmetry: TEN_UPRIGHT, extra: 1, handles: [2, 2, 2, 2, 2], decoys: [3] } },
    { id: nodeId('ch1-n11'), role: 'normal', spec: { kind: 'quantity', targets: [12], extra: 2, handles: [10, 2], decoys: [3] } },
    { id: nodeId('ch1-n12'), role: 'boss', spec: { kind: 'quantity', targets: [17], extra: 2, handles: [10, 5, 2], decoys: [4] } },
  ],
};
