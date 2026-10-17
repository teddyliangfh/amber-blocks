import { apply, judge } from '../core';
import type { BenchState } from '../core';
import { CONTENT_VERSION, materialize, nodeId } from '../content';
import { createInitialState } from './migrate';
import { reduce } from './reducer';
import type { ProgressState } from './schema';
import { statusOf } from './unlock';

const ok = { matched: true, benchCount: 1, reason: 'matched' } as const;
const no = { matched: false, benchCount: 0, reason: 'count-mismatch' } as const;
const n1 = nodeId('ch1-n1');
const n2 = nodeId('ch1-n2');

function run(state: ProgressState, cmds: ReadonlyArray<Parameters<typeof reduce>[1]>): ProgressState {
  return cmds.reduce((s, cmd) => {
    const r = reduce(s, cmd);
    if (!r.ok) {
      throw new Error(`${cmd.type}: ${r.reason}`);
    }
    return r.value;
  }, state);
}

function someWork(state: ProgressState): BenchState {
  const node = state.nodes.get(n1);
  if (node === undefined) {
    throw new Error('not entered');
  }
  const puzzle = materialize(node.ref);
  const first = puzzle.solution[0];
  const r = first === undefined ? undefined : apply(puzzle.initial, first);
  if (r === undefined || !r.ok) {
    throw new Error('no work');
  }
  return r.value;
}

describe('reducer', () => {
  test('enter: builds a ref at variant 0 once, sets current, refuses locked and unknown stops', () => {
    const fresh = createInitialState(42);
    expect(reduce(fresh, { type: 'enter', nodeId: n2 })).toEqual({ ok: false, reason: 'locked' });
    expect(reduce(fresh, { type: 'enter', nodeId: nodeId('nope') })).toEqual({ ok: false, reason: 'unknown-node' });
    const s1 = run(fresh, [{ type: 'enter', nodeId: n1 }]);
    expect(s1.current).toBe(n1);
    expect(s1.nodes.get(n1)).toEqual({ ref: { contentVersion: CONTENT_VERSION, chapterId: 'ch1', nodeId: n1, attemptVariant: 0, seed: 42 }, work: null });
    const again = run(s1, [{ type: 'enter', nodeId: n1 }]);
    expect(again.nodes.get(n1)).toBe(s1.nodes.get(n1));
  });

  test('AC-42: work and ref survive leaving, coming back and switching language', () => {
    const s1 = run(createInitialState(42), [{ type: 'enter', nodeId: n1 }]);
    const work = someWork(s1);
    const s2 = run(s1, [{ type: 'saveWork', nodeId: n1, work }, { type: 'complete', nodeId: n1, verdict: ok }, { type: 'enter', nodeId: n2 }, { type: 'setLanguage', language: 'en' }, { type: 'enter', nodeId: n1 }]);
    expect(s2.nodes.get(n1)?.work).toBe(work);
    expect(s2.nodes.get(n1)?.ref).toBe(s1.nodes.get(n1)?.ref);
    expect(s2.language).toBe('en');
    expect(s2.current).toBe(n1);
    expect(judge(work, materialize(s2.nodes.get(n1)!.ref).question).benchCount).toBe(1);
    expect(reduce(createInitialState(1), { type: 'saveWork', nodeId: n1, work })).toEqual({ ok: false, reason: 'not-entered' });
  });

  test('AC-41: completion needs a matched verdict, happens once, and never regresses on replay', () => {
    const s1 = run(createInitialState(42), [{ type: 'enter', nodeId: n1 }]);
    expect(reduce(s1, { type: 'complete', nodeId: n1, verdict: no })).toEqual({ ok: false, reason: 'not-matched' });
    expect(reduce(createInitialState(42), { type: 'complete', nodeId: n1, verdict: ok })).toEqual({ ok: false, reason: 'not-entered' });
    const done = run(s1, [{ type: 'complete', nodeId: n1, verdict: ok }]);
    const twice = reduce(done, { type: 'complete', nodeId: n1, verdict: ok });
    expect(twice.ok && twice.value).toBe(done);
    expect(reduce(done, { type: 'replay', nodeId: n2 })).toEqual({ ok: false, reason: 'not-completed' });
    const withWork = run(done, [{ type: 'saveWork', nodeId: n1, work: someWork(done) }, { type: 'enter', nodeId: n2 }, { type: 'complete', nodeId: n2, verdict: ok }]);
    const replayed = run(withWork, [{ type: 'replay', nodeId: n1 }]);
    expect(statusOf(replayed, n1)).toBe('completed');
    expect(statusOf(replayed, n2)).toBe('completed');
    expect(replayed.nodes.get(n1)?.work).toBeNull();
    expect(replayed.current).toBe(n1);
  });

  test('newVariant bumps the attempt and clears work; completion set untouched', () => {
    const s1 = run(createInitialState(42), [{ type: 'enter', nodeId: n1 }]);
    const s2 = run(s1, [{ type: 'saveWork', nodeId: n1, work: someWork(s1) }, { type: 'complete', nodeId: n1, verdict: ok }, { type: 'newVariant', nodeId: n1 }]);
    expect(s2.nodes.get(n1)?.ref.attemptVariant).toBe(1);
    expect(s2.nodes.get(n1)?.work).toBeNull();
    expect(s2.completedNodeIds.has(n1)).toBe(true);
    expect(reduce(createInitialState(1), { type: 'newVariant', nodeId: n1 })).toEqual({ ok: false, reason: 'not-entered' });
    expect(() => materialize(s2.nodes.get(n1)!.ref)).not.toThrow();
  });

  test('rejections leave the input untouched', () => {
    const fresh = createInitialState(42);
    const nodes = fresh.nodes;
    reduce(fresh, { type: 'enter', nodeId: n2 });
    reduce(fresh, { type: 'complete', nodeId: n1, verdict: ok });
    expect(fresh.nodes).toBe(nodes);
    expect(fresh.current).toBeNull();
  });
});
