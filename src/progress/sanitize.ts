import { assertInvariants } from '../core';
import type { BenchState } from '../core';
import { CHAPTERS, materialize, sandboxMaterial } from '../content';
import type { NodeId, Puzzle } from '../content';
import type { NodeProgress, ProgressState } from './schema';
import { chapterOf, mapOrder } from './unlock';

// A well-formed archive can still point at things this build cannot play: a
// stop that no longer exists, a ref whose fields disagree with its key, a
// content version that is not the running one, or saved work made from other
// material. Each such stop is dropped (or keeps its ref and loses its work) on
// its own; completions and the language stay. So is an album picture of an
// unknown stop or one that breaks the mat's rules. Runs after migrate, so every
// repair it reports is damage; expected content upgrades are migrate's. A
// sandbox that breaks the mat's rules or is not the sandbox's own material is
// dropped too (it is always the same box of blocks, 2026-10-15 review O).

// Saved work belongs to a stop's material: same bench, same units in the same
// colours and home slots, and only the stop's own partners (or what is left of them).
export function sameMaterial(work: BenchState, initial: BenchState): boolean {
  if (work.bounds.cols !== initial.bounds.cols || work.bounds.rows !== initial.bounds.rows) {
    return false;
  }
  if (work.units.size !== initial.units.size || work.tray.length !== initial.tray.length) {
    return false;
  }
  for (const [id, unit] of initial.units) {
    if (work.units.get(id)?.hue !== unit.hue || work.home.get(id) !== initial.home.get(id)) {
      return false;
    }
  }
  // Partners can only be the stop's own partners, or what is left of them.
  for (const [id, group] of work.groups) {
    const original = initial.groups.get(id);
    if (original === undefined || !group.unitIds.every((u) => original.unitIds.includes(u))) {
      return false;
    }
  }
  return true;
}

// An album picture is history: it is never held against the stop's current
// material, only against the rules every mat keeps, and it must show something.
// A sandbox may be empty (everything put back).
function drawable(work: BenchState, emptyIsFine = false): boolean {
  try {
    assertInvariants(work);
  } catch {
    return false;
  }
  return emptyIsFine || work.bench.size > 0;
}

function checkNode(key: NodeId, node: NodeProgress, contentVersion: number): { node: NodeProgress | null; repair: string | null } {
  const ref = node.ref;
  if (
    ref.nodeId !== key ||
    ref.chapterId !== chapterOf(key).id ||
    ref.contentVersion !== contentVersion ||
    !Number.isInteger(ref.attemptVariant) ||
    ref.attemptVariant < 0
  ) {
    return { node: null, repair: `ref:${key}` };
  }
  let puzzle: Puzzle;
  try {
    puzzle = materialize(ref);
  } catch {
    return { node: null, repair: `ref:${key}` };
  }
  if (node.work !== null && !sameMaterial(node.work, puzzle.initial)) {
    return { node: { ref, work: null }, repair: `work:${key}` };
  }
  return { node, repair: null };
}

export function sanitize(state: ProgressState): { readonly state: ProgressState; readonly repairs: ReadonlyArray<string> } {
  const known = new Set(mapOrder(CHAPTERS).map((e) => e.nodeId));
  const repairs: string[] = [];
  const completedNodeIds = new Set([...state.completedNodeIds].filter((id) => known.has(id)));
  if (completedNodeIds.size !== state.completedNodeIds.size) {
    repairs.push('completed');
  }
  const current = state.current !== null && known.has(state.current) ? state.current : null;
  if (current !== state.current) {
    repairs.push('current');
  }
  const nodes = new Map<NodeId, NodeProgress>();
  for (const [key, node] of state.nodes) {
    if (!known.has(key)) {
      repairs.push(`node:${key}`);
      continue;
    }
    const checked = checkNode(key, node, state.contentVersion);
    if (checked.repair !== null) {
      repairs.push(checked.repair);
    }
    if (checked.node !== null) {
      nodes.set(key, checked.node);
    }
  }
  const album = new Map<NodeId, BenchState>();
  for (const [key, work] of state.album) {
    if (!known.has(key) || !drawable(work)) {
      repairs.push(`album:${key}`);
      continue;
    }
    album.set(key, work);
  }
  let sandbox = state.sandbox;
  if (sandbox !== null && !(drawable(sandbox, true) && sameMaterial(sandbox, sandboxMaterial()))) {
    repairs.push('sandbox');
    sandbox = null;
  }
  if (repairs.length === 0) {
    return { state, repairs };
  }
  return { state: { ...state, completedNodeIds, current, nodes, album, sandbox }, repairs };
}
