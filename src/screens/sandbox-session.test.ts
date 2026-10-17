import { MAX_UNDO, assertInvariants, cell, clusters } from '../core';
import type { Command } from '../core';
import { CONTENT_VERSION, chapterId, materialize, nodeId, sandboxMaterial } from '../content';
import { countOrder, countProgress, countTap, isCounted, recount } from './level-session';
import { canUndo, commitSandbox, previewSandbox, startSandbox, tidySandbox, undoSandbox } from './sandbox-session';
import type { SandboxSession } from './sandbox-session';

// Free play (2026-10-15 review O): no question, so nothing here is ever right or wrong.
const material = sandboxMaterial();
const ids = [...material.units.keys()];

function run(session: SandboxSession, cmds: ReadonlyArray<Command>): SandboxSession {
  return cmds.reduce((s, cmd) => {
    const r = commitSandbox(s, cmd);
    if (!r.ok) {
      throw new Error(`${cmd.type}: ${r.reason}`);
    }
    assertInvariants(r.session.history.state);
    return r.session;
  }, session);
}

// Three in a row along the top, as a child might build it first.
const row = (s: SandboxSession) => run(s, ids.slice(0, 3).map((u, i) => ({ type: 'take', unitId: u, to: cell(i, 0) }) as const));

describe('sandbox session', () => {
  test('starts from the box as dealt, or from where the child left it; the undo history starts empty', () => {
    const fresh = startSandbox(null);
    expect(fresh.history.state).toEqual(material);
    expect(fresh.history.past).toEqual([]);
    expect(canUndo(fresh)).toBe(false);
    const built = row(fresh);
    const resumed = startSandbox(built.history.state);
    expect(resumed.history.state).toBe(built.history.state);
    expect(canUndo(resumed)).toBe(false);
    expect(countProgress(resumed)).toEqual({ counted: 0, total: 3, complete: false });
  });

  test('commit, preview, reject and undo; there is no verdict, only the mat', () => {
    let s = row(startSandbox(null));
    expect(s.history.state.bench.size).toBe(3);
    expect(Object.keys(s).sort()).toEqual(['history', 'round']);
    expect(commitSandbox(s, { type: 'take', unitId: ids[3]!, to: cell(0, 0) })).toEqual({ ok: false, reason: 'occupied' });
    expect(commitSandbox(s, { type: 'take', unitId: ids[3]!, to: cell(6, 0) })).toEqual({ ok: false, reason: 'out-of-bounds' });
    expect(previewSandbox(s, { type: 'take', unitId: ids[3]!, to: cell(0, 0) })).toBe(false);
    expect(previewSandbox(s, { type: 'take', unitId: ids[3]!, to: cell(5, 4) })).toBe(true);
    // Pulling the last block away: a 2 and a 1.
    s = run(s, [{ type: 'move', unitId: ids[2]!, to: cell(4, 3) }]);
    expect(clusters(s.history.state).map((c) => c.unitIds.length).sort()).toEqual([1, 2]);
    const back = undoSandbox(s)!;
    expect(back.history.state.bench.get(ids[2]!)).toEqual(cell(2, 0));
    expect(undoSandbox(startSandbox(null))).toBeNull();
  });

  test('putting everything back is one step: the mat empties, the tray is whole, one undo brings the build back', () => {
    const built = run(row(startSandbox(null)), [
      { type: 'take', unitId: ids[7]!, to: cell(3, 3) },
      { type: 'take', unitId: ids[5]!, to: cell(4, 3) },
    ]);
    const tidy = tidySandbox(built)!;
    assertInvariants(tidy.history.state);
    expect(tidy.history.state.bench.size).toBe(0);
    // Every block in its own slot, as dealt.
    expect(tidy.history.state.tray).toEqual(material.tray);
    expect(tidy.history.past).toHaveLength(built.history.past.length + 1);
    expect(canUndo(tidy)).toBe(true);
    const back = undoSandbox(tidy)!;
    expect(back.history.state).toBe(built.history.state);
    // Nothing on the mat: nothing to put back, and no empty step in the history.
    expect(tidySandbox(startSandbox(null))).toBeNull();
    expect(tidySandbox(tidy)).toBeNull();
  });

  test('the history keeps the last MAX_UNDO steps, a put-away counting as one', () => {
    let s = startSandbox(null);
    for (let i = 0; i < MAX_UNDO + 2; i += 1) {
      s = run(s, [{ type: 'take', unitId: ids[i % 10]!, to: cell(i % 6, Math.floor(i / 6)) }]);
    }
    s = tidySandbox(s)!;
    expect(s.history.past).toHaveLength(MAX_UNDO);
    expect(undoSandbox(s)!.history.state.bench.size).toBe(MAX_UNDO + 2);
  });

  test('a partner goes back whole (the material may have partners one day)', () => {
    const withPartners = materialize({ contentVersion: CONTENT_VERSION, chapterId: chapterId('ch1'), nodeId: nodeId('ch1-n10'), attemptVariant: 0, seed: 5 }).initial;
    const partner = [...withPartners.groups.values()][0]!;
    const loose = [...withPartners.units.keys()].find((u) => ![...withPartners.groups.values()].some((g) => g.unitIds.includes(u)))!;
    const s = run(startSandbox(null, withPartners), [
      { type: 'takeGroup', groupId: partner.id, origin: cell(0, 0) },
      { type: 'take', unitId: loose, to: cell(0, withPartners.bounds.rows - 1) },
    ]);
    const tidy = tidySandbox(s)!;
    assertInvariants(tidy.history.state);
    expect(tidy.history.state.bench.size).toBe(0);
    expect(tidy.history.state.groups.get(partner.id)!.unitIds).toEqual(partner.unitIds);
    expect(tidy.history.state.tray).toEqual(withPartners.tray);
  });

  test('counting: the numbers in order, the total, a recount; rearranging keeps the count, changing the set voids it', () => {
    let s = row(startSandbox(null));
    const first = countTap(s, ids[0]!);
    expect(first.outcome).toEqual({ kind: 'counted', index: 1, complete: false, total: 3 });
    expect(countTap(first.session, ids[0]!).outcome).toEqual({ kind: 'ignored' });
    // A block in the tray cannot be counted.
    expect(countTap(first.session, ids[9]!).outcome).toEqual({ kind: 'ignored' });
    const third = countTap(countTap(first.session, ids[1]!).session, ids[2]!);
    expect(third.outcome).toEqual({ kind: 'counted', index: 3, complete: true, total: 3 });
    s = third.session;
    expect(countProgress(s)).toEqual({ counted: 3, total: 3, complete: true });
    expect([...countOrder(s).values()]).toEqual([1, 2, 3]);
    // Same blocks moved about: still counted.
    s = run(s, [{ type: 'move', unitId: ids[0]!, to: cell(5, 4) }]);
    expect(countProgress(s).counted).toBe(3);
    // One more block: the old count is void.
    s = run(s, [{ type: 'take', unitId: ids[3]!, to: cell(0, 2) }]);
    expect(isCounted(s, ids[0]!)).toBe(false);
    expect(countProgress(s)).toEqual({ counted: 0, total: 4, complete: false });
    // Undo back to the counted three: a new round, nothing counted (the set changed twice).
    const counted = countTap(s, ids[3]!).session;
    expect(countProgress(undoSandbox(counted)!).counted).toBe(0);
    // Put away: nothing to count; a recount over the same blocks starts at nothing.
    expect(countProgress(tidySandbox(counted)!)).toEqual({ counted: 0, total: 0, complete: false });
    expect(countProgress(recount(counted))).toEqual({ counted: 0, total: 4, complete: false });
    expect(recount(counted).history).toBe(counted.history);
  });
});
