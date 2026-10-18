import { apply, judge } from '../core';
import type { BenchState } from '../core';
import { chapterId, mapOrder as contentOrder, materialize } from './demo-helpers';
import { chapterCompletion, deserialize, memoryStorage, reduce, save, serialize, statusOf, createInitialState, load, nextNodeOf, defaultCurrent } from './index';
import type { ProgressState } from './index';

// The whole M2 map, driven the way screens will drive it: enter, play the
// reference solution one commit at a time (saving work), judge, complete, move on.
describe('M2 map through progress', () => {
  test('five stops in a row, with a save / load and a language switch in the middle', async () => {
    const storage = memoryStorage();
    let state: ProgressState = createInitialState(2026);
    const order = contentOrder();
    for (const entry of order) {
      expect(defaultCurrent(state)).toBe(entry.nodeId);
      const entered = reduce(state, { type: 'enter', nodeId: entry.nodeId });
      if (!entered.ok) {
        throw new Error(entered.reason);
      }
      state = entered.value;
      const puzzle = materialize(state.nodes.get(entry.nodeId)!.ref);
      let work: BenchState = puzzle.initial;
      for (const cmd of puzzle.solution) {
        const r = apply(work, cmd);
        if (!r.ok) {
          throw new Error(r.reason);
        }
        work = r.value;
        const saved = reduce(state, { type: 'saveWork', nodeId: entry.nodeId, work });
        if (!saved.ok) {
          throw new Error(saved.reason);
        }
        state = saved.value;
      }
      // A stop asked in steps is finished by its last step.
      const verdict = judge(work, (puzzle.steps ?? [puzzle.question])[(puzzle.steps?.length ?? 1) - 1]!);
      expect(verdict.matched).toBe(true);
      const done = reduce(state, { type: 'complete', nodeId: entry.nodeId, verdict });
      if (!done.ok) {
        throw new Error(done.reason);
      }
      state = done.value;
      if (entry.nodeId === 'ch1-n2') {
        await save(storage, state);
        state = await load(storage, 0);
        const lang = reduce(state, { type: 'setLanguage', language: 'en' });
        if (!lang.ok) {
          throw new Error(lang.reason);
        }
        state = lang.value;
      }
      const next = nextNodeOf(entry.nodeId);
      if (next !== null) {
        expect(statusOf(state, next)).toBe('available');
      }
      state = { ...state, current: null };
    }
    expect(statusOf(state, order[order.length - 1]!.nodeId)).toBe('completed');
    expect(chapterCompletion(state, chapterId('ch1'))).toEqual({ done: 12, total: 12 });
    expect(chapterCompletion(state, chapterId('ch2'))).toEqual({ done: 12, total: 12 });
    expect(state.language).toBe('en');
    expect(deserialize(serialize(state))).toEqual(state);
  });
});
