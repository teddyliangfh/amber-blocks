import { copyKey } from '../copy';
import { chapterId, nodeId } from '../ids';
import type { Chapter, SignSide } from '../schema';

// Compare Island, redone (Phase 23d, D-129, docs/compare-island-prd.md §4):
// two numbers, each with its own blocks, and a slot between them for > < =.
// A stop is a few rounds (pairs); each round is answered with a sign block.
// The difficulty is in the knobs, not in moving blocks: how big the numbers
// are, how far apart (far, 1, the same), which signs the tray holds (only
// > < on the first stop), how a number's blocks are laid out (a tower, a row,
// a square: "4 lying down is still 4"), and whether a side is made of partners
// (stacked into one tower, or standing side by side). Stops 8 – 10 are Ted's
// two-digit stops (2026-10-27, after the design): 10 and the teens, then
// layouts that mislead (12 as two 6s side by side is lower than a 10 standing
// alone, and more). The ids are ch6: Compare Island's first version, ch4, is
// retired (RETIRED_STOPS) and its ids are never used again. Numbers, rounds
// and order are defaults for Ted (PRD §11 #1, #2).

const tower = (n: number): SignSide => n;
const row = (n: number): SignSide => ({ n, layout: 'row' });
const square = (n: number): SignSide => ({ n, layout: 'square' });
// Partners stacked into one tower, the first at the bottom.
const stacked = (...parts: ReadonlyArray<number>): SignSide => ({ n: parts.reduce((a, b) => a + b, 0), parts });
// Partners standing side by side, from the left.
const beside = (...parts: ReadonlyArray<number>): SignSide => ({ n: parts.reduce((a, b) => a + b, 0), parts, beside: true });
const r = (left: SignSide, right: SignSide) => ({ left, right });

export const CHAPTER_6: Chapter = {
  id: chapterId('ch6'),
  title: copyKey('chapter.ch6.title'),
  nodes: [
    // Put a sign in the slot; far apart, up to 5, only > and <.
    { id: nodeId('ch6-n1'), role: 'normal', spec: { kind: 'sign', rounds: [r(4, 1), r(1, 3), r(5, 2)], signs: ['>', '<'] } },
    // = comes in.
    { id: nodeId('ch6-n2'), role: 'normal', spec: { kind: 'sign', rounds: [r(2, 2), r(1, 4), r(3, 3)] } },
    // Only one apart.
    { id: nodeId('ch6-n3'), role: 'normal', spec: { kind: 'sign', rounds: [r(4, 5), r(3, 2), r(5, 5)] } },
    // Four rounds, and 6 for the first time on this island.
    { id: nodeId('ch6-n4'), role: 'boss', spec: { kind: 'sign', rounds: [r(6, 2), r(3, 4), r(5, 5), r(6, 5)] } },
    // Laid out differently: the taller one is not always more.
    { id: nodeId('ch6-n5'), role: 'normal', spec: { kind: 'sign', rounds: [r(tower(3), square(4)), r(row(4), tower(4)), r(row(5), tower(3))] } },
    // One side is two partners in one tower (its plate says the total).
    { id: nodeId('ch6-n6'), role: 'normal', spec: { kind: 'sign', rounds: [r(stacked(2, 1), 3), r(stacked(2, 2), 3), r(stacked(1, 3), 5)] } },
    // Big numbers, 6 – 9.
    { id: nodeId('ch6-n7'), role: 'normal', spec: { kind: 'sign', rounds: [r(7, 9), r(8, 6), r(9, 9)] } },
    // 10, and the teens as a 10 with a few beside it.
    { id: nodeId('ch6-n8'), role: 'normal', spec: { kind: 'sign', rounds: [r(10, 9), r(beside(10, 2), 10), r(beside(10, 1), beside(10, 3))] } },
    // Two-digit numbers laid out to mislead: the lower side is more, or the same.
    { id: nodeId('ch6-n9'), role: 'normal', spec: { kind: 'sign', rounds: [r(beside(6, 6), 10), r(beside(7, 7), beside(10, 4)), r(beside(10, 3), beside(5, 5, 5))] } },
    // Five rounds, every knob, two of them two-digit; the last one misleads.
    { id: nodeId('ch6-n10'), role: 'boss', spec: { kind: 'sign', rounds: [r(6, 9), r(square(4), tower(3)), r(stacked(2, 3), 5), r(10, beside(4, 4, 4)), r(beside(7, 7), beside(10, 3))] } },
  ],
};
