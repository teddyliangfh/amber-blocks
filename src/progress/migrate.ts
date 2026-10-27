import type { BenchState, Bounds } from '../core';
import { CHAPTERS, CONTENT_CHANGES, CONTENT_VERSION, RETIRED_STOPS, materialize } from '../content';
import type { Chapter, NodeId } from '../content';
import { sameMaterial } from './sanitize';
import type { NodeProgress, ProgressState } from './schema';
import { mapOrder, openerOf } from './unlock';

export function createInitialState(seed: number, contentVersion: number = CONTENT_VERSION): ProgressState {
  return {
    schemaVersion: 1,
    contentVersion,
    seed,
    language: 'zh',
    completedNodeIds: new Set(),
    current: null,
    nodes: new Map(),
    album: new Map(),
    sandbox: null,
  };
}

export interface Migrated {
  readonly state: ProgressState;
  // Stops whose unfinished work was set aside because the stop itself changed
  // (an expected upgrade, not damage). Completions stay; the next visit deals
  // the new material.
  readonly setAside: ReadonlyArray<NodeId>;
}

// The stops changed after `from` up to `to`, or null when this build cannot
// tell (an archive from a newer build, or a version step nobody listed).
function changedBetween(from: number, to: number, changes: Readonly<Record<number, ReadonlyArray<NodeId>>>): ReadonlySet<NodeId> | null {
  if (!Number.isInteger(from) || from < 1 || from > to) {
    return null;
  }
  const out = new Set<NodeId>();
  for (let v = from + 1; v <= to; v += 1) {
    const step = changes[v];
    if (step === undefined) {
      return null;
    }
    step.forEach((id) => out.add(id));
  }
  return out;
}

// Stops taken off the map after `from` up to `to` (RETIRED_STOPS, Phase 23d).
function retiredBetween(from: number, to: number, retired: Readonly<Record<number, ReadonlyArray<NodeId>>>): ReadonlySet<NodeId> {
  const out = new Set<NodeId>();
  for (let v = Math.max(from, 0) + 1; v <= to; v += 1) {
    (retired[v] ?? []).forEach((id) => out.add(id));
  }
  return out;
}

// Work made on a mat of another size (version 3 fitted each stop's mat to its
// material): the same pieces in the same cells when they still fit, else the
// whole arrangement slid to the top-left corner, so shapes and joins survive.
// Null when it is too big for the new mat.
export function onMat(work: BenchState, bounds: Bounds): BenchState | null {
  if (work.bounds.cols === bounds.cols && work.bounds.rows === bounds.rows) {
    return work;
  }
  const cells = [...work.bench.values()];
  const inside = (list: typeof cells) => list.every((c) => c.x < bounds.cols && c.y < bounds.rows);
  if (inside(cells)) {
    return { ...work, bounds };
  }
  const dx = Math.min(...cells.map((c) => c.x));
  const dy = Math.min(...cells.map((c) => c.y));
  const bench = new Map([...work.bench].map(([u, c]) => [u, { x: c.x - dx, y: c.y - dy }]));
  return inside([...bench.values()]) ? { ...work, bench, bounds } : null;
}

// The node's work as it fits the stop's material now, or undefined when it does not.
function refit(node: NodeProgress): BenchState | null | undefined {
  if (node.work === null) {
    return null;
  }
  try {
    const initial = materialize(node.ref).initial;
    const work = onMat(node.work, initial.bounds);
    return work !== null && sameMaterial(work, initial) ? work : undefined;
  } catch {
    return undefined;
  }
}

// Content upgrades keep what is still true, stop by stop (D-029 decision 2,
// refined 2026-10-14). Every known completion stays. A stop the new version did
// not change keeps its ref and work as they are; one it changed keeps its ref,
// and its work only if that still fits the new material (an archive saved by a
// build that already dealt it), moved onto a resized mat where needed (onMat). An archive whose version this build cannot
// place keeps only its completions. The album is history and stays exactly as
// it was, whatever changed (2026-10-15 review Q); so does the sandbox, which is
// no stop's material (review O). Stops a version retired (Phase 23d: the first
// Compare Island) go entirely: completion, work, album picture; a map resting
// on one moves to the first open stop. That is the upgrade Ted asked for, not
// damage, so nothing is set aside or reported. Whatever is still wrong after
// this is damage, and sanitize reports it.
export function migrate(
  stored: ProgressState,
  contentVersion: number = CONTENT_VERSION,
  chapters: ReadonlyArray<Chapter> = CHAPTERS,
  changes: Readonly<Record<number, ReadonlyArray<NodeId>>> = CONTENT_CHANGES,
  retiredStops: Readonly<Record<number, ReadonlyArray<NodeId>>> = RETIRED_STOPS,
): Migrated {
  if (stored.contentVersion === contentVersion) {
    return { state: stored, setAside: [] };
  }
  const known = new Set(mapOrder(chapters).map((e) => e.nodeId));
  const completedNodeIds = new Set([...stored.completedNodeIds].filter((id) => known.has(id)));
  const changed = changedBetween(stored.contentVersion, contentVersion, changes);
  if (changed === null) {
    const setAside = [...stored.nodes].filter(([, n]) => n.work !== null).map(([id]) => id);
    return { state: { ...stored, contentVersion, completedNodeIds, current: null, nodes: new Map() }, setAside };
  }
  const retired = retiredBetween(stored.contentVersion, contentVersion, retiredStops);
  const nodes = new Map<NodeId, NodeProgress>();
  const setAside: NodeId[] = [];
  for (const [id, node] of stored.nodes) {
    if (retired.has(id)) {
      continue;
    }
    // A ref that disagrees with its own archive is damage, not an upgrade.
    if (node.ref.contentVersion !== stored.contentVersion) {
      nodes.set(id, node);
      continue;
    }
    const upgraded: NodeProgress = { ref: { ...node.ref, contentVersion }, work: node.work };
    if (!changed.has(id)) {
      nodes.set(id, upgraded);
      continue;
    }
    const work = refit(upgraded);
    if (work === undefined) {
      setAside.push(id);
      if (known.has(id)) {
        nodes.set(id, { ref: upgraded.ref, work: null });
      }
      continue;
    }
    nodes.set(id, { ...upgraded, work });
  }
  const album = [...stored.album.keys()].some((id) => retired.has(id)) ? new Map([...stored.album].filter(([id]) => !retired.has(id))) : stored.album;
  const current = stored.current !== null && retired.has(stored.current) ? firstOpen(completedNodeIds, chapters) : onwardFrom(stored.current, completedNodeIds, chapters);
  return { state: { ...stored, contentVersion, completedNodeIds, nodes, album, current }, setAside };
}

// The first stop in map order that finishing has opened (the stop before it is
// finished) and that is not finished itself; null when there is none.
function firstOpen(completed: ReadonlySet<NodeId>, chapters: ReadonlyArray<Chapter>): NodeId | null {
  const open = mapOrder(chapters).find((e) => {
    const opener = openerOf(e.nodeId, chapters);
    return opener !== undefined && !completed.has(e.nodeId) && completed.has(opener);
  });
  return open?.nodeId ?? null;
}

// Where the map rests after an upgrade, when it rested on a finished stop.
// 'first-open' (Phase 21, the default; Ted's call): the first stop in map
// order that finishing has opened (the stop before it is finished) and that is
// not finished itself. Version 7 put new stops between the old ones, so a
// finished Join Island rests on ch2-n9, the first of them, and a map resting
// on a finished stop past a new one goes back to it. 'next' (Phase 19, D-070):
// only the very next stop, when it is not finished; a finished Join Island
// would stay on ch2-n8 and show none of the new stops. One line to change.
export const UPGRADE_CURRENT: 'first-open' | 'next' = 'first-open';

// After an upgrade, a map resting on a finished stop moves on (UPGRADE_CURRENT);
// with nothing to move to, or resting anywhere else, `current` stays as it was.
// (ch1-n1, open without finishing anything, is never where it moves to: a
// parent who started play further on keeps that.)
export function onwardFrom(current: NodeId | null, completed: ReadonlySet<NodeId>, chapters: ReadonlyArray<Chapter>, rule: typeof UPGRADE_CURRENT = UPGRADE_CURRENT): NodeId | null {
  if (current === null || !completed.has(current)) {
    return current;
  }
  const order = mapOrder(chapters);
  if (rule === 'first-open') {
    return firstOpen(completed, chapters) ?? current;
  }
  const next = order[order.findIndex((e) => e.nodeId === current) + 1];
  return next !== undefined && !completed.has(next.nodeId) ? next.nodeId : current;
}
