import { copyKey } from '../copy';
import { chapterId, nodeId } from '../ids';
import type { Chapter, ShadowSpec } from '../schema';
import { BOAT_5, BOAT_5_C, CORNER_5, DOG_6, DUCK_5, HOUSE_7, ROCKET_6, TREE_5, T_4 } from './shapes';

// Shape Island (Phase 23b, PRD §4.2), the shadow theatre: a picture's shadow
// lies on the mat and the partners walk into it; full, it lights up as the
// picture. One new move: choose the partners that fit the shadow. Numbers 4 to
// 7; the trouble comes from more pieces, decoys and less help, not bigger
// numbers. Numbers, pictures and order are defaults for Ted (PRD §8 #6).
// The id is ch5: ch4 is kept for Compare Island.

// SHADOW_POLICY (PRD §4.2.3, §8 #9): the shadow is there from the start on the
// first six stops; on the seventh it comes the first time help is asked for,
// on the boss the second. A default for Ted: 'always' everywhere, or help
// from n5 on.
export const SHADOW_POLICY: Readonly<Record<'n1' | 'n2' | 'n3' | 'n4' | 'n5' | 'n6' | 'n7' | 'n8', ShadowSpec>> = {
  n1: 'always',
  n2: 'always',
  n3: 'always',
  n4: 'always',
  n5: 'always',
  n6: 'always',
  n7: { onHelp: 1 },
  n8: { onHelp: 2 },
};

// PICTURE_SYMMETRY (PRD §4.2.4, §8 #11): a picture with a head and feet (the
// duck, the dog) faces left or right but never stands on its head: turned,
// the dog's 3 + 2 + 1 would fit and the face would land on its tail. Every
// other picture here turns (the default, mirror off). A default for Ted:
// `{ rotation: true, mirror: false }` for these too.
export const PICTURE_SYMMETRY = { rotation: false, mirror: true } as const;

export const CHAPTER_5: Chapter = {
  id: chapterId('ch5'),
  title: copyKey('chapter.ch5.title'),
  nodes: [
    // A 3 into the shadow, a 1 on top. The decoy 2 only makes the count wrong (3 + 2 = 5).
    { id: nodeId('ch5-n1'), role: 'normal', spec: { kind: 'quantity_shape', target: 4, templates: [T_4], extra: 1, handles: [3, 1], decoys: [2], picture: 'mushroom', shadow: SHADOW_POLICY.n1 } },
    // A picture with a head: the 4 is the body, the 1 the head (the face lands there).
    { id: nodeId('ch5-n2'), role: 'normal', spec: { kind: 'quantity_shape', target: 5, templates: [DUCK_5], symmetry: PICTURE_SYMMETRY, extra: 1, handles: [4, 1], decoys: [2], picture: 'duck', shadow: SHADOW_POLICY.n2 } },
    // Three pieces. The decoy 2 makes 5 with the 3 but no tree: the first "find the right partners".
    { id: nodeId('ch5-n3'), role: 'normal', spec: { kind: 'quantity_shape', target: 5, templates: [TREE_5], extra: 1, handles: [3, 1, 1], decoys: [2], picture: 'tree', shadow: SHADOW_POLICY.n3 } },
    // The mini boss: both decoys make 5 (4 + 1, 3 + 2), neither makes the boat.
    { id: nodeId('ch5-n4'), role: 'boss', spec: { kind: 'quantity_shape', target: 5, templates: [BOAT_5], extra: 1, handles: [3, 1, 1], decoys: [2, 4], picture: 'boat', shadow: SHADOW_POLICY.n4 } },
    // Seven blocks, two 3s alike for the walls, a big shadow.
    { id: nodeId('ch5-n5'), role: 'normal', spec: { kind: 'quantity_shape', target: 7, templates: [HOUSE_7], extra: 1, handles: [1, 3, 3], decoys: [2], picture: 'house', shadow: SHADOW_POLICY.n5 } },
    // Two shadows in turn on the same five blocks: a big corner, then a boat, one block moved.
    { id: nodeId('ch5-n6'), role: 'normal', spec: { kind: 'quantity_shape', target: 5, templates: [CORNER_5, BOAT_5_C], extra: 1, sequence: true, picture: 'boat', shadow: SHADOW_POLICY.n6 } },
    // Four pieces; 3 + 2 + 1 makes 6 but no dog; the first stop with no shadow at the start.
    { id: nodeId('ch5-n7'), role: 'normal', spec: { kind: 'quantity_shape', target: 6, templates: [DOG_6], symmetry: PICTURE_SYMMETRY, extra: 1, handles: [3, 1, 1, 1], decoys: [2], picture: 'dog', shadow: SHADOW_POLICY.n7 } },
    // The boss: built from the little picture alone (the shadow comes on the second ask), then it launches.
    { id: nodeId('ch5-n8'), role: 'boss', spec: { kind: 'quantity_shape', target: 6, templates: [ROCKET_6], extra: 1, handles: [3, 1, 1, 1], decoys: [2], picture: 'rocket', shadow: SHADOW_POLICY.n8 } },
  ],
};
