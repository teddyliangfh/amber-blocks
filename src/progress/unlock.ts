import { CHAPTERS } from '../content';
import type { Chapter, ChapterId, NodeId } from '../content';
import type { NodeStatus, ProgressState } from './schema';

export interface MapEntry {
  readonly chapterId: ChapterId;
  readonly nodeId: NodeId;
}

// The map as one ordered list: chapters in order, stops in order within each.
export function mapOrder(chapters: ReadonlyArray<Chapter> = CHAPTERS): ReadonlyArray<MapEntry> {
  return chapters.flatMap((c) => c.nodes.map((n) => ({ chapterId: c.id, nodeId: n.id })));
}

function indexOf(nodeId: NodeId, chapters: ReadonlyArray<Chapter>): number {
  const index = mapOrder(chapters).findIndex((e) => e.nodeId === nodeId);
  if (index === -1) {
    throw new Error(`progress: unknown node ${nodeId}`);
  }
  return index;
}

// Unlocking looks at completed stops only. Previews, animations and half-built
// work never open the next stop (AC-46). Two exceptions keep a parent's choice
// playable (2026-10-15 review M): the stop play starts at (`current`) is open,
// and a stop once entered stays open (in normal play it was open to enter).
export function isUnlocked(state: ProgressState, nodeId: NodeId, chapters: ReadonlyArray<Chapter> = CHAPTERS): boolean {
  const index = indexOf(nodeId, chapters);
  if (index === 0 || state.current === nodeId || state.nodes.has(nodeId)) {
    return true;
  }
  const previous = mapOrder(chapters)[index - 1] as MapEntry;
  return state.completedNodeIds.has(previous.nodeId);
}

export function statusOf(state: ProgressState, nodeId: NodeId, chapters: ReadonlyArray<Chapter> = CHAPTERS): NodeStatus {
  if (state.completedNodeIds.has(nodeId)) {
    return 'completed';
  }
  if (state.nodes.has(nodeId)) {
    return 'in-progress';
  }
  return isUnlocked(state, nodeId, chapters) ? 'available' : 'locked';
}

export function nextNodeOf(nodeId: NodeId, chapters: ReadonlyArray<Chapter> = CHAPTERS): NodeId | null {
  const order = mapOrder(chapters);
  const next = order[indexOf(nodeId, chapters) + 1];
  return next === undefined ? null : next.nodeId;
}

export function chapterOf(nodeId: NodeId, chapters: ReadonlyArray<Chapter> = CHAPTERS): Chapter {
  const chapter = chapters.find((c) => c.nodes.some((n) => n.id === nodeId));
  if (chapter === undefined) {
    throw new Error(`progress: unknown node ${nodeId}`);
  }
  return chapter;
}

export function chapterCompletion(
  state: ProgressState,
  chapterId: ChapterId,
  chapters: ReadonlyArray<Chapter> = CHAPTERS,
): { readonly done: number; readonly total: number } {
  const chapter = chapters.find((c) => c.id === chapterId);
  if (chapter === undefined) {
    throw new Error(`progress: unknown chapter ${chapterId}`);
  }
  const done = chapter.nodes.filter((n) => state.completedNodeIds.has(n.id)).length;
  return { done, total: chapter.nodes.length };
}

// Where the map should rest: the stop the child is on, else the first stop that
// can be played, else the last stop when everything is done.
export function defaultCurrent(state: ProgressState, chapters: ReadonlyArray<Chapter> = CHAPTERS): NodeId {
  if (state.current !== null) {
    return state.current;
  }
  const order = mapOrder(chapters);
  const open = order.find((e) => {
    const status = statusOf(state, e.nodeId, chapters);
    return status === 'available' || status === 'in-progress';
  });
  return (open ?? (order[order.length - 1] as MapEntry)).nodeId;
}
