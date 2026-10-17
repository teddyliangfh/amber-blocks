import type { BenchState } from '../core';
import type { Lang, NodeId, PuzzleRef } from '../content';

export type NodeStatus = 'locked' | 'available' | 'in-progress' | 'completed';

export interface NodeProgress {
  // Fixed when the stop is first entered; language switches and map visits keep it.
  readonly ref: PuzzleRef;
  // The stable state after the last committed command; null until the child acts.
  readonly work: BenchState | null;
}

export interface ProgressState {
  readonly schemaVersion: 1;
  readonly contentVersion: number;
  // Device-level, handed in once at creation.
  readonly seed: number;
  readonly language: Lang;
  readonly completedNodeIds: ReadonlySet<NodeId>;
  readonly current: NodeId | null;
  // Only stops that were entered at least once.
  readonly nodes: ReadonlyMap<NodeId, NodeProgress>;
  // The album (2026-10-15 review Q): each stop's mat as the child last had it
  // right (on a stop in steps, the last step). Mistakes, undo, "play again",
  // a new variant and content upgrades never clear it; a new right answer
  // replaces it; only resetting the progress empties it. History, not play
  // state: a snapshot carries its own mat size, colours and partners and is
  // drawn on its own, never checked against the stop's current material.
  readonly album: ReadonlyMap<NodeId, BenchState>;
  // Free play (2026-10-15 review O): the sandbox mat as the child left it, null
  // until they first move something there. Not a stop: it never counts as a
  // completion, never unlocks anything and never moves `current`. Always the
  // fixed sandbox material (content/sandbox.ts); only resetting the progress clears it.
  readonly sandbox: BenchState | null;
}

// Same shape as AsyncStorage, so `screens` can hand the real one straight in.
export interface ProgressStorage {
  readonly getItem: (key: string) => Promise<string | null>;
  readonly setItem: (key: string, value: string) => Promise<void>;
  readonly removeItem: (key: string) => Promise<void>;
}

export type ProgressReject = 'locked' | 'not-entered' | 'not-matched' | 'not-completed' | 'unknown-node';

export type ProgressResult<T> = { ok: true; value: T } | { ok: false; reason: ProgressReject };

export function reject<T>(reason: ProgressReject): ProgressResult<T> {
  return { ok: false, reason };
}
