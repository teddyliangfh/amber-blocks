import { nodeId } from '../ids';
import type { ChapterId, NodeId } from '../ids';
import type { Chapter, NodeSpec, PuzzleRef } from '../schema';
import { CHAPTER_1 } from './chapter-1';
import { CHAPTER_2 } from './chapter-2';

// Bump whenever a stop deals different material or asks a different question
// for the same ref, and list the stops in CONTENT_CHANGES. Saved progress carries
// the version it was made with; `progress` decides how to migrate, content only
// refuses mismatches (AC-47). The archive format is versioned separately
// (`schemaVersion`, progress/codec.ts). fingerprint.test.ts fails when material
// changes without a bump.
export const CONTENT_VERSION = 6;

// The stops each version changed, keyed by the version that changed them. Saved
// unfinished work on a listed stop may no longer fit its material; on every
// other stop it must still fit exactly.
export const CONTENT_CHANGES: Readonly<Record<number, ReadonlyArray<NodeId>>> = {
  // 2026-10-14: decoy partners, shuffled partner order and one-coloured spares
  // on the big-number stops 10, 12 and 17.
  2: [nodeId('ch1-n10'), nodeId('ch1-n11'), nodeId('ch1-n12')],
  // 2026-10-15: every mat fitted to its stop's material (D-037). 8 and 17
  // keep their 6 × 5. Saved work moves onto the new mat when it fits.
  3: [
    ...['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n9', 'n10', 'n11'].map((n) => nodeId(`ch1-${n}`)),
    ...['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7'].map((n) => nodeId(`ch2-${n}`)),
  ],
  // 2026-10-15: Number Island 5–9 reordered (D-044): 5 = a 3 + singles, the
  // square-then-line 4, the 8 brick from two 4s, 9 = 5 + 4. The 6 tower stays.
  4: [nodeId('ch1-n5'), nodeId('ch1-n6'), nodeId('ch1-n8'), nodeId('ch1-n9')],
  // 2026-10-16: 5 deals five singles beside its 3, not four (review A-6), so
  // counting out singles reaches 5 too.
  5: [nodeId('ch1-n5')],
  // 2026-10-16 (Phase 19): Join Island 5–7 start with a partner on the mat
  // ("who's missing?": 2 + ? = 5, 4 + ? = 6, 3 + ? = 7). The new boss ch2-n8
  // (7 made two ways) is not listed: no archive from an earlier version can
  // hold work for a stop it did not have, so there is nothing of it to migrate.
  6: [nodeId('ch2-n5'), nodeId('ch2-n6'), nodeId('ch2-n7')],
};

export const CHAPTERS: ReadonlyArray<Chapter> = [CHAPTER_1, CHAPTER_2];

// Stops where, the first time they are solved, "next" waits until the child
// has counted every block on the mat (2026-10-16 review A-1: no stop asks for
// counting, the heart of the lesson). Counting is tapping, so this keeps "you
// move on by tapping" (PRD §5); a stop finished before stays as it is (D-038).
// EMPTY ON PURPOSE: whether to turn it on, and for which stops, is Ted's call.
// The review suggests "the four bosses"; there are five: ch1-n4 (3 corner),
// ch1-n8 (8 brick), ch1-n12 (17), ch2-n4 (free sum 5), ch2-n8 (7 made two
// ways; ch2-n7, the old 3 + 4, is a "who's missing?" stop since Phase 19).
export const COUNT_TO_PASS: ReadonlySet<NodeId> = new Set<NodeId>();

export function findChapter(id: ChapterId): Chapter {
  const chapter = CHAPTERS.find((c) => c.id === id);
  if (chapter === undefined) {
    throw new Error(`content: unknown chapter ${id}`);
  }
  return chapter;
}

export function findNode(ref: PuzzleRef): { readonly chapter: Chapter; readonly node: NodeSpec } {
  if (ref.contentVersion !== CONTENT_VERSION) {
    throw new Error(`content: ref is for content version ${ref.contentVersion}, this build is ${CONTENT_VERSION}`);
  }
  const chapter = findChapter(ref.chapterId);
  const node = chapter.nodes.find((n) => n.id === ref.nodeId);
  if (node === undefined) {
    throw new Error(`content: unknown node ${ref.nodeId} in chapter ${ref.chapterId}`);
  }
  return { chapter, node };
}
