import { MAX_UNDO, apply, benchCount, commit, createHistory, reconcile, returnGroup, returnUnit, startRound, undo } from '../core';
import type { BenchState, Command, CountRound, History, RejectReason, Result } from '../core';
import { sandboxMaterial } from '../content';

// Free play (2026-10-15 review O): a level session without a question. The
// same committed history and counting round, no verdict, no steps, nothing to
// solve. Counting is level-session's (countTap, countOrder, countProgress,
// recount work on any session with a history and a round). Kept pure so the
// rules are tested without rendering; saving and audio are the screen's job.

export interface SandboxSession {
  readonly history: History;
  readonly round: CountRound;
}

// Where the child left it, or the box as dealt. The undo history starts empty.
export function startSandbox(saved: BenchState | null, material: BenchState = sandboxMaterial()): SandboxSession {
  const history = createHistory(saved ?? material);
  return { history, round: startRound(history.state) };
}

export type SandboxOutcome = { readonly ok: true; readonly session: SandboxSession } | { readonly ok: false; readonly reason: RejectReason };

export function commitSandbox(session: SandboxSession, cmd: Command): SandboxOutcome {
  const r = commit(session.history, cmd);
  if (!r.ok) {
    return { ok: false, reason: r.reason };
  }
  return { ok: true, session: { history: r.value, round: reconcile(session.round, r.value.state) } };
}

export function undoSandbox(session: SandboxSession): SandboxSession | null {
  const r = undo(session.history);
  if (!r.ok) {
    return null;
  }
  return { history: r.value, round: reconcile(session.round, r.value.state) };
}

export function canUndo(session: SandboxSession): boolean {
  return session.history.past.length > 0;
}

// Would this command be accepted? The snap preview only; nothing is committed.
export function previewSandbox(session: SandboxSession, cmd: Command): boolean {
  return apply(session.history.state, cmd).ok;
}

function must(r: Result<BenchState>): BenchState {
  if (!r.ok) {
    // Everything on the bench can always go home (invariant 1 keeps a slot for it).
    throw new Error(`sandbox: put away failed (${r.reason})`);
  }
  return r.value;
}

// "Put them all back" (PRD P-008: clearing can be undone): every partner whole
// and every block to its own slot, as one step of the history, so one undo
// brings the whole build back. Null when the mat is already empty.
export function tidySandbox(session: SandboxSession): SandboxSession | null {
  const before = session.history.state;
  if (benchCount(before) === 0) {
    return null;
  }
  let state = before;
  for (const group of before.groups.values()) {
    if (group.unitIds.every((u) => state.bench.has(u))) {
      state = must(returnGroup(state, group.id));
    }
  }
  const loose = [...state.bench.keys()].sort((a, b) => (state.home.get(a) ?? 0) - (state.home.get(b) ?? 0));
  for (const unitId of loose) {
    state = must(returnUnit(state, unitId));
  }
  const past = [...session.history.past, before].slice(-MAX_UNDO);
  return { history: { state, past }, round: reconcile(session.round, state) };
}
