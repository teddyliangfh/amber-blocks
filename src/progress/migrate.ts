import type { BenchState, Bounds } from '../core';
import { CHAPTERS, CONTENT_CHANGES, CONTENT_VERSION, materialize } from '../content';
import type { Chapter, NodeId } from '../content';
import { sameMaterial } from './sanitize';
import type { NodeProgress, ProgressState } from './schema';
import { mapOrder } from './unlock';

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
// no stop's material (review O). Whatever is still wrong after this is damage,
// and sanitize reports it.
export function migrate(
  stored: ProgressState,
  contentVersion: number = CONTENT_VERSION,
  chapters: ReadonlyArray<Chapter> = CHAPTERS,
  changes: Readonly<Record<number, ReadonlyArray<NodeId>>> = CONTENT_CHANGES,
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
  const nodes = new Map<NodeId, NodeProgress>();
  const setAside: NodeId[] = [];
  for (const [id, node] of stored.nodes) {
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
  return { state: { ...stored, contentVersion, completedNodeIds, nodes, current: onwardFrom(stored.current, completedNodeIds, chapters) }, setAside };
}

// After an upgrade, a map resting on a finished stop whose next stop is not
// finished moves on to that next stop, as "next" would have. This is how a
// finished Join Island reaches ch2-n8, the boss version 6 added after its old
// last stop (Phase 19). Anywhere else, `current` stays as it was.
function onwardFrom(current: NodeId | null, completed: ReadonlySet<NodeId>, chapters: ReadonlyArray<Chapter>): NodeId | null {
  if (current === null || !completed.has(current)) {
    return current;
  }
  const order = mapOrder(chapters);
  const next = order[order.findIndex((e) => e.nodeId === current) + 1];
  return next !== undefined && !completed.has(next.nodeId) ? next.nodeId : current;
}
