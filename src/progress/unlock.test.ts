import { CHAPTERS, chapterId, nodeId } from '../content';
import { createInitialState } from './migrate';
import { reduce } from './reducer';
import type { ProgressState } from './schema';
import { chapterCompletion, chapterOf, defaultCurrent, isUnlocked, mapOrder, nextNodeOf, openerOf, statusOf } from './unlock';

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
    expect(mapOrder()).toHaveLength(56);
    // Phase 23a: the new pictures sit between the old ones.
    expect(nextNodeOf(nodeId('ch1-n6'))).toBe('ch1-n13');
    expect(nextNodeOf(nodeId('ch1-n17'))).toBe('ch1-n11');
    expect(nextNodeOf(nodeId('ch2-n11'))).toBe('ch2-n13');
    expect(nextNodeOf(nodeId('ch2-n13'))).toBe('ch2-n7');
    // Phase 23b: Shape Island comes second; its boss leads on to Join Island.
    expect(nextNodeOf(nodeId('ch1-n12'))).toBe('ch5-n1');
    expect(nextNodeOf(nodeId('ch5-n8'))).toBe('ch2-n1');
    expect(chapterOf(nodeId('ch5-n3')).id).toBe('ch5');
    // Phase 21: the new stops sit between the old ones.
    expect(nextNodeOf(nodeId('ch2-n3'))).toBe('ch2-n9');
    expect(nextNodeOf(nodeId('ch2-n7'))).toBe('ch2-n12');
    expect(nextNodeOf(nodeId('ch2-n12'))).toBe('ch2-n8');
    // Phase 22: Take-away Island follows Join Island.
    expect(nextNodeOf(nodeId('ch2-n8'))).toBe('ch3-n1');
    // Phase 23c: Compare Island follows Take-away Island, last on the map.
    expect(nextNodeOf(nodeId('ch3-n8'))).toBe('ch6-n1');
    expect(nextNodeOf(nodeId('ch6-n10'))).toBeNull();
    expect(chapterOf(nodeId('ch6-n4')).id).toBe('ch6');
    expect(chapterOf(nodeId('ch2-n1')).id).toBe('ch2');
    expect(chapterOf(nodeId('ch3-n5')).id).toBe('ch3');
    expect(() => nextNodeOf(nodeId('nope'))).toThrow(/unknown node/);
    expect(() => chapterOf(nodeId('nope'))).toThrow(/unknown node/);
  });

  test('AC-41: a fresh archive opens the first stop only', () => {
    const fresh = createInitialState(1);
    expect(statusOf(fresh, nodeId('ch1-n1'))).toBe('available');
    expect(statusOf(fresh, nodeId('ch1-n2'))).toBe('locked');
    expect(statusOf(fresh, nodeId('ch2-n1'))).toBe('locked');
    expect(defaultCurrent(fresh)).toBe('ch1-n1');
    expect(chapterCompletion(fresh, chapterId('ch1'))).toEqual({ done: 0, total: 17 });
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
    const island = completeAll(boss, ['ch1-n5', 'ch1-n6', 'ch1-n13', 'ch1-n7', 'ch1-n14', 'ch1-n8', 'ch1-n15', 'ch1-n9', 'ch1-n16', 'ch1-n10', 'ch1-n17', 'ch1-n11', 'ch1-n12']);
    expect(statusOf(island, nodeId('ch2-n1'))).toBe('available');
    expect(chapterCompletion(island, chapterId('ch1'))).toEqual({ done: 17, total: 17 });
    // Phase 23b: Number Island's boss opens Shape Island and Join Island both
    // (SHAPE_ISLAND_GATE 'none'); the map offers Shape Island first.
    expect(statusOf(island, nodeId('ch5-n1'))).toBe('available');
    expect(statusOf(island, nodeId('ch5-n2'))).toBe('locked');
    expect(defaultCurrent({ ...island, current: null })).toBe('ch5-n1');
    const joined = completeAll(island, ['ch2-n1', 'ch2-n2', 'ch2-n3', 'ch2-n9', 'ch2-n4', 'ch2-n10', 'ch2-n5', 'ch2-n6', 'ch2-n11', 'ch2-n13', 'ch2-n7', 'ch2-n12', 'ch2-n8']);
    // Phase 22: Join Island's boss opens Take-away Island.
    expect(statusOf(joined, nodeId('ch3-n1'))).toBe('available');
    expect(statusOf(joined, nodeId('ch3-n2'))).toBe('locked');
    // (Shape Island, open and skipped, comes first in map order.)
    expect(defaultCurrent({ ...joined, current: null })).toBe('ch5-n1');
    const all = completeAll(joined, ['ch3-n1', 'ch3-n2', 'ch3-n3', 'ch3-n4', 'ch3-n5', 'ch3-n6', 'ch3-n7', 'ch3-n8']);
    expect(chapterCompletion(all, chapterId('ch3'))).toEqual({ done: 8, total: 8 });
    // Shape Island skipped: still open, the map rests there.
    expect(defaultCurrent({ ...all, current: null })).toBe('ch5-n1');
    const shapes = completeAll(all, ['ch5-n1', 'ch5-n2', 'ch5-n3', 'ch5-n4', 'ch5-n5', 'ch5-n6', 'ch5-n7', 'ch5-n8']);
    expect(chapterCompletion(shapes, chapterId('ch5'))).toEqual({ done: 8, total: 8 });
    // Phase 23c: Take-away Island's boss opens Compare Island (on the way); the map rests there.
    expect(statusOf(shapes, nodeId('ch6-n1'))).toBe('available');
    expect(statusOf(shapes, nodeId('ch6-n2'))).toBe('locked');
    expect(openerOf(nodeId('ch6-n1'))).toBe('ch3-n8');
    expect(defaultCurrent({ ...shapes, current: null })).toBe('ch6-n1');
    const compared = completeAll(shapes, ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10'].map((n) => `ch6-${n}`));
    expect(chapterCompletion(compared, chapterId('ch6'))).toEqual({ done: 10, total: 10 });
    expect(defaultCurrent({ ...compared, current: null })).toBe('ch6-n10');
  });

  test('Phase 23b: Shape Island is off the way (SIDE_ISLANDS): its stops open one by one from Number Island\'s boss, Join Island\'s first stop opens from that boss too', () => {
    expect(openerOf(nodeId('ch1-n1'))).toBeUndefined();
    expect(openerOf(nodeId('ch5-n1'))).toBe('ch1-n12');
    expect(openerOf(nodeId('ch5-n2'))).toBe('ch5-n1');
    expect(openerOf(nodeId('ch2-n1'))).toBe('ch1-n12');
    expect(openerOf(nodeId('ch2-n2'))).toBe('ch2-n1');
    const shapesFirst = completeAll(createInitialState(1), mapOrder().slice(0, 17 + 3).map((e) => e.nodeId));
    expect(statusOf(shapesFirst, nodeId('ch5-n4'))).toBe('available');
    expect(statusOf(shapesFirst, nodeId('ch5-n5'))).toBe('locked');
    expect(statusOf(shapesFirst, nodeId('ch2-n1'))).toBe('available');
    expect(statusOf(shapesFirst, nodeId('ch2-n2'))).toBe('locked');
    // An island list without Shape Island opens as before.
    const noShapes = CHAPTERS.filter((c) => c.id !== 'ch5');
    expect(openerOf(nodeId('ch2-n1'), noShapes)).toBe('ch1-n12');
    expect(openerOf(nodeId('ch3-n1'), noShapes)).toBe('ch2-n8');
    expect(openerOf(nodeId('ch6-n1'), noShapes)).toBe('ch3-n8');
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
    expect(CHAPTERS).toHaveLength(5);
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
    expect(done.ok && statusOf(done.value, nodeId('ch2-n9'))).toBe('available');
    // An unknown stop is refused.
    expect(reduce(fresh, { type: 'startAt', nodeId: nodeId('ch9-n1') })).toEqual({ ok: false, reason: 'unknown-node' });
  });
});
