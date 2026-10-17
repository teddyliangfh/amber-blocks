import { CHAPTERS, chapterId, nodeId } from '../content';
import { createInitialState } from './migrate';
import { reduce } from './reducer';
import type { ProgressState } from './schema';
import { chapterCompletion, chapterOf, defaultCurrent, isUnlocked, mapOrder, nextNodeOf, statusOf } from './unlock';

const ok = { matched: true, benchCount: 1, reason: 'matched' } as const;

function completeAll(state: ProgressState, ids: ReadonlyArray<string>): ProgressState {
  return ids.reduce((s, id) => {
    const entered = reduce(s, { type: 'enter', nodeId: nodeId(id) });
    const done = entered.ok ? reduce(entered.value, { type: 'complete', nodeId: nodeId(id), verdict: ok }) : entered;
    if (!done.ok) {
      throw new Error(done.reason);
    }
    return done.value;
  }, state);
}

describe('unlock', () => {
  test('map order flattens chapters in order', () => {
    expect(mapOrder().map((e) => e.nodeId).slice(0, 5)).toEqual(['ch1-n1', 'ch1-n2', 'ch1-n3', 'ch1-n4', 'ch1-n5']);
    expect(mapOrder()).toHaveLength(20);
    expect(nextNodeOf(nodeId('ch1-n12'))).toBe('ch2-n1');
    expect(nextNodeOf(nodeId('ch2-n7'))).toBe('ch2-n8');
    expect(nextNodeOf(nodeId('ch2-n8'))).toBeNull();
    expect(chapterOf(nodeId('ch2-n1')).id).toBe('ch2');
    expect(() => nextNodeOf(nodeId('nope'))).toThrow(/unknown node/);
    expect(() => chapterOf(nodeId('nope'))).toThrow(/unknown node/);
  });

  test('AC-41: a fresh archive opens the first stop only', () => {
    const fresh = createInitialState(1);
    expect(statusOf(fresh, nodeId('ch1-n1'))).toBe('available');
    expect(statusOf(fresh, nodeId('ch1-n2'))).toBe('locked');
    expect(statusOf(fresh, nodeId('ch2-n1'))).toBe('locked');
    expect(defaultCurrent(fresh)).toBe('ch1-n1');
    expect(chapterCompletion(fresh, chapterId('ch1'))).toEqual({ done: 0, total: 12 });
    expect(() => chapterCompletion(fresh, chapterId('ch9'))).toThrow(/unknown chapter/);
  });

  test('AC-41 / AC-46: stops open one at a time, the boss opens the next chapter', () => {
    const one = completeAll(createInitialState(1), ['ch1-n1']);
    expect(statusOf(one, nodeId('ch1-n2'))).toBe('available');
    expect(statusOf(one, nodeId('ch1-n3'))).toBe('locked');
    expect(isUnlocked(one, nodeId('ch2-n1'))).toBe(false);
    const boss = completeAll(one, ['ch1-n2', 'ch1-n3', 'ch1-n4']);
    expect(statusOf(boss, nodeId('ch1-n5'))).toBe('available');
    expect(statusOf(boss, nodeId('ch2-n1'))).toBe('locked');
    const island = completeAll(boss, ['ch1-n5', 'ch1-n6', 'ch1-n7', 'ch1-n8', 'ch1-n9', 'ch1-n10', 'ch1-n11', 'ch1-n12']);
    expect(statusOf(island, nodeId('ch2-n1'))).toBe('available');
    expect(chapterCompletion(island, chapterId('ch1'))).toEqual({ done: 12, total: 12 });
    expect(defaultCurrent({ ...island, current: null })).toBe('ch2-n1');
    const all = completeAll(island, ['ch2-n1', 'ch2-n2', 'ch2-n3', 'ch2-n4', 'ch2-n5', 'ch2-n6', 'ch2-n7', 'ch2-n8']);
    expect(defaultCurrent({ ...all, current: null })).toBe('ch2-n8');
  });

  test('AC-46: saved work without completion opens nothing; entering marks in-progress', () => {
    const entered = reduce(createInitialState(1), { type: 'enter', nodeId: nodeId('ch1-n1') });
    if (!entered.ok) {
      throw new Error(entered.reason);
    }
    expect(statusOf(entered.value, nodeId('ch1-n1'))).toBe('in-progress');
    expect(statusOf(entered.value, nodeId('ch1-n2'))).toBe('locked');
    expect(defaultCurrent({ ...entered.value, current: null })).toBe('ch1-n1');
    expect(defaultCurrent(entered.value)).toBe('ch1-n1');
    expect(CHAPTERS).toHaveLength(2);
  });

  test('2026-10-15 review M: a parent starts play at a stop: only current moves, nothing is finished, the map still opens in order', () => {
    const fresh = createInitialState(1);
    const r = reduce(fresh, { type: 'startAt', nodeId: nodeId('ch2-n3') });
    if (!r.ok) {
      throw new Error(r.reason);
    }
    const s = r.value;
    expect(s.current).toBe('ch2-n3');
    expect(s.completedNodeIds.size).toBe(0);
    expect(s.nodes.size).toBe(0);
    expect(defaultCurrent(s)).toBe('ch2-n3');
    expect(statusOf(s, nodeId('ch2-n3'))).toBe('available');
    // Its neighbours stay as they were.
    expect(statusOf(s, nodeId('ch2-n2'))).toBe('locked');
    expect(statusOf(s, nodeId('ch2-n4'))).toBe('locked');
    expect(statusOf(s, nodeId('ch1-n2'))).toBe('locked');
    // The child can enter it; once entered it stays open, even after play moves elsewhere.
    const entered = reduce(s, { type: 'enter', nodeId: nodeId('ch2-n3') });
    if (!entered.ok) {
      throw new Error(entered.reason);
    }
    const elsewhere = reduce(entered.value, { type: 'enter', nodeId: nodeId('ch1-n1') });
    if (!elsewhere.ok) {
      throw new Error(elsewhere.reason);
    }
    expect(isUnlocked(elsewhere.value, nodeId('ch2-n3'))).toBe(true);
    expect(reduce(elsewhere.value, { type: 'enter', nodeId: nodeId('ch2-n3') }).ok).toBe(true);
    // Finishing it opens the next stop the usual way.
    const done = reduce(entered.value, { type: 'complete', nodeId: nodeId('ch2-n3'), verdict: { matched: true, benchCount: 4, reason: 'matched' } });
    expect(done.ok && statusOf(done.value, nodeId('ch2-n4'))).toBe('available');
    // An unknown stop is refused.
    expect(reduce(fresh, { type: 'startAt', nodeId: nodeId('ch9-n1') })).toEqual({ ok: false, reason: 'unknown-node' });
  });
});
