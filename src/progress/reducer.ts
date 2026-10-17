import type { BenchState, Verdict } from '../core';
import { CHAPTERS } from '../content';
import type { Chapter, Lang, NodeId } from '../content';
import { sameWork } from './codec';
import { reject } from './schema';
import type { NodeProgress, ProgressResult, ProgressState } from './schema';
import { chapterOf, isUnlocked, mapOrder } from './unlock';

export type ProgressCommand =
  | { readonly type: 'enter'; readonly nodeId: NodeId }
  | { readonly type: 'saveWork'; readonly nodeId: NodeId; readonly work: BenchState }
  // `work`: the right mat itself. Saved as the stop's work and kept as its album
  // picture in the same step, so a solve is one write (2026-10-15 review Q).
  | { readonly type: 'complete'; readonly nodeId: NodeId; readonly verdict: Verdict; readonly work?: BenchState }
  | { readonly type: 'replay'; readonly nodeId: NodeId }
  | { readonly type: 'newVariant'; readonly nodeId: NodeId }
  // Recovery only: forget a stop's ref and work so the next entry starts clean.
  // Completion and the rest of the map are untouched.
  | { readonly type: 'resetNode'; readonly nodeId: NodeId }
  // Parents only (2026-10-15 review M): play starts at this stop. Only `current`
  // moves; nothing counts as finished and the rest of the map unlocks in order.
  | { readonly type: 'startAt'; readonly nodeId: NodeId }
  | { readonly type: 'setLanguage'; readonly language: Lang }
  // Free play (2026-10-15 review O): the sandbox mat after a change. Only the
  // sandbox changes; completions, unlocks and `current` never do.
  | { readonly type: 'saveSandbox'; readonly work: BenchState };

function known(nodeId: NodeId, chapters: ReadonlyArray<Chapter>): boolean {
  return mapOrder(chapters).some((e) => e.nodeId === nodeId);
}

function withNode(state: ProgressState, nodeId: NodeId, node: NodeProgress): ReadonlyMap<NodeId, NodeProgress> {
  return new Map(state.nodes).set(nodeId, node);
}

export function reduce(state: ProgressState, cmd: ProgressCommand, chapters: ReadonlyArray<Chapter> = CHAPTERS): ProgressResult<ProgressState> {
  if (cmd.type === 'setLanguage') {
    // Language is the only thing that changes: work, refs and the map stay put (AC-18, AC-42).
    return { ok: true, value: { ...state, language: cmd.language } };
  }
  if (cmd.type === 'saveSandbox') {
    // A mat equal to the saved one (say, a copy read back from storage) writes nothing.
    return { ok: true, value: sameWork(state.sandbox, cmd.work) ? state : { ...state, sandbox: cmd.work } };
  }
  if (!known(cmd.nodeId, chapters)) {
    return reject('unknown-node');
  }
  const existing = state.nodes.get(cmd.nodeId);

  switch (cmd.type) {
    case 'enter': {
      if (!isUnlocked(state, cmd.nodeId, chapters)) {
        return reject('locked');
      }
      if (existing !== undefined) {
        return { ok: true, value: { ...state, current: cmd.nodeId } };
      }
      const node: NodeProgress = {
        ref: {
          contentVersion: state.contentVersion,
          chapterId: chapterOf(cmd.nodeId, chapters).id,
          nodeId: cmd.nodeId,
          attemptVariant: 0,
          seed: state.seed,
        },
        work: null,
      };
      return { ok: true, value: { ...state, current: cmd.nodeId, nodes: withNode(state, cmd.nodeId, node) } };
    }
    case 'saveWork': {
      if (existing === undefined) {
        return reject('not-entered');
      }
      return { ok: true, value: { ...state, nodes: withNode(state, cmd.nodeId, { ...existing, work: cmd.work }) } };
    }
    case 'complete': {
      if (!cmd.verdict.matched) {
        return reject('not-matched');
      }
      if (existing === undefined) {
        return reject('not-entered');
      }
      const work = cmd.work;
      const nodes = work === undefined || sameWork(existing.work, work) ? state.nodes : withNode(state, cmd.nodeId, { ...existing, work });
      const album = work === undefined || sameWork(state.album.get(cmd.nodeId), work) ? state.album : new Map(state.album).set(cmd.nodeId, work);
      const completedNodeIds = state.completedNodeIds.has(cmd.nodeId) ? state.completedNodeIds : new Set(state.completedNodeIds).add(cmd.nodeId);
      if (nodes === state.nodes && album === state.album && completedNodeIds === state.completedNodeIds) {
        // Idempotent: replaying a finished stop never counts twice (AC-41), and
        // a picture already kept is not written again.
        return { ok: true, value: state };
      }
      return { ok: true, value: { ...state, completedNodeIds, nodes, album } };
    }
    case 'replay': {
      if (!state.completedNodeIds.has(cmd.nodeId) || existing === undefined) {
        return reject('not-completed');
      }
      return { ok: true, value: { ...state, current: cmd.nodeId, nodes: withNode(state, cmd.nodeId, { ...existing, work: null }) } };
    }
    case 'startAt': {
      return { ok: true, value: { ...state, current: cmd.nodeId } };
    }
    case 'resetNode': {
      if (existing === undefined) {
        return { ok: true, value: state };
      }
      const nodes = new Map(state.nodes);
      nodes.delete(cmd.nodeId);
      return { ok: true, value: { ...state, nodes } };
    }
    case 'newVariant': {
      if (existing === undefined) {
        return reject('not-entered');
      }
      const ref = { ...existing.ref, attemptVariant: existing.ref.attemptVariant + 1 };
      return { ok: true, value: { ...state, nodes: withNode(state, cmd.nodeId, { ref, work: null }) } };
    }
  }
}
