import { apply } from '../core';
import { CONTENT_VERSION, chapterId, materialize, nodeId } from '../content';
import { decodeArchive, deserialize, serialize } from './codec';
import { createInitialState, migrate } from './migrate';
import { reduce } from './reducer';
import type { ProgressState } from './schema';
import { BACKUP_KEY, STORAGE_KEY, load, memoryStorage, save } from './store';

const ok = { matched: true, benchCount: 7, reason: 'matched' } as const;

function richState(): ProgressState {
  let s = createInitialState(9);
  for (const id of ['ch1-n1', 'ch1-n2', 'ch1-n3', 'ch1-n4', 'ch1-n5', 'ch1-n6', 'ch1-n13', 'ch1-n7', 'ch1-n14', 'ch1-n8', 'ch1-n15', 'ch1-n9', 'ch1-n16', 'ch1-n10', 'ch1-n17', 'ch1-n11', 'ch1-n12', 'ch2-n1', 'ch2-n2', 'ch2-n3', 'ch2-n9', 'ch2-n4', 'ch2-n10', 'ch2-n5', 'ch2-n6', 'ch2-n11', 'ch2-n13']) {
    const e = reduce(s, { type: 'enter', nodeId: nodeId(id) });
    const c = e.ok ? reduce(e.value, { type: 'complete', nodeId: nodeId(id), verdict: ok }) : e;
    if (!c.ok) {
      throw new Error(c.reason);
    }
    s = c.value;
  }
  const e = reduce(s, { type: 'enter', nodeId: nodeId('ch2-n7') });
  if (!e.ok) {
    throw new Error(e.reason);
  }
  s = e.value;
  // Half of the reference solution for the join stop: partners on the bench, groups and all.
  const puzzle = materialize(s.nodes.get(nodeId('ch2-n7'))!.ref);
  const work = puzzle.solution.slice(0, 1).reduce((w, cmd) => {
    const r = apply(w, cmd);
    if (!r.ok) {
      throw new Error(r.reason);
    }
    return r.value;
  }, puzzle.initial);
  const w = reduce(s, { type: 'saveWork', nodeId: nodeId('ch2-n7'), work });
  const l = w.ok ? reduce(w.value, { type: 'setLanguage', language: 'en' }) : w;
  if (!l.ok) {
    throw new Error(l.reason);
  }
  return l.value;
}

describe('codec', () => {
  test('AC-47: a real state round-trips and serializes deterministically', () => {
    const state = richState();
    const json = serialize(state);
    expect(serialize(state)).toBe(json);
    const back = deserialize(json);
    expect(back).toEqual(state);
    expect(back?.nodes.get(nodeId('ch2-n7'))?.work?.groups.size).toBe(4);
    expect(serialize(back as ProgressState)).toBe(json);
  });

  test('corrupt archives come back as null, never throw', () => {
    expect(deserialize('not json')).toBeNull();
    expect(deserialize('[]')).toBeNull();
    expect(deserialize(JSON.stringify({ schemaVersion: 2 }))).toBeNull();
    expect(deserialize(JSON.stringify({ schemaVersion: 1, language: 'zh', contentVersion: 'x', seed: 1, completedNodeIds: [], current: null, nodes: [] }))).toBeNull();
    expect(deserialize(JSON.stringify({ schemaVersion: 1, language: 'zh', contentVersion: 1, seed: null, completedNodeIds: [], current: null, nodes: [] }))).toBeNull();
  });

  test('damage below the header stays local: the stop loses its work or its entry, the rest is kept', () => {
    const header = { schemaVersion: 1, contentVersion: 1, seed: 1, completedNodeIds: ['ch1-n1'], current: null };
    const lang = decodeArchive(JSON.stringify({ ...header, language: 'fr', nodes: [] }));
    expect(lang?.state.language).toBe('zh');
    expect(lang?.state.completedNodeIds.has(nodeId('ch1-n1'))).toBe(true);
    expect(lang?.repairs).toEqual(['language']);
    const noRef = decodeArchive(JSON.stringify({ ...header, language: 'en', nodes: [['ch1-n1', { ref: {} }]] }));
    expect(noRef?.state.nodes.size).toBe(0);
    expect(noRef?.state.language).toBe('en');
    expect(noRef?.repairs).toEqual(['node#0']);
    const odd = decodeArchive(JSON.stringify({ ...header, language: 'zh', completedNodeIds: ['ch1-n1', 7], current: 3, nodes: 'x' }));
    expect([...odd!.state.completedNodeIds]).toEqual(['ch1-n1']);
    expect(odd?.state.current).toBeNull();
    expect(odd?.repairs).toEqual(['completed', 'current', 'nodes']);
    const noCompleted = decodeArchive(JSON.stringify({ ...header, language: 'zh', completedNodeIds: 'x', nodes: [] }));
    expect(noCompleted?.state.completedNodeIds.size).toBe(0);
    const badWork = decodeArchive(JSON.stringify({ ...header, language: 'zh', nodes: [['ch1-n1', { ref: { contentVersion: 1, chapterId: 'ch1', nodeId: 'ch1-n1', attemptVariant: 0, seed: 1 }, work: { bounds: {} } }]] }));
    expect(badWork?.state.nodes.get(nodeId('ch1-n1'))?.work).toBeNull();
    expect(badWork?.repairs).toEqual(['work:ch1-n1']);
    type WorkJson = { bench: unknown[]; bounds: unknown; groups: unknown[][] };
    const withWork = (j: { nodes: [string, { work: WorkJson | null }][] }) => j.nodes.find(([, n]) => n.work !== null)![1] as { work: WorkJson };
    const breakWork = (mutate: (w: { work: WorkJson }) => void) => {
      const j = JSON.parse(serialize(richState()));
      mutate(withWork(j));
      const d = decodeArchive(JSON.stringify(j));
      expect(d?.state.nodes.get(nodeId('ch2-n7'))?.work).toBeNull();
      expect(d?.state.nodes.get(nodeId('ch2-n7'))?.ref.nodeId).toBe('ch2-n7');
      expect(d?.state.completedNodeIds.size).toBe(27);
      expect(d?.state.language).toBe('en');
    };
    breakWork((w) => w.work.bench.push(['ghost', 0, 0]));
    breakWork((w) => {
      w.work = 5 as never;
    });
    breakWork((w) => {
      w.work.bounds = 5;
    });
    breakWork((w) => {
      w.work.groups[0]![2] = ['x'];
    });
  });

  test('a fresh state with no nodes also round-trips', () => {
    const fresh = createInitialState(3);
    expect(deserialize(serialize(fresh))).toEqual(fresh);
  });
});

describe('migrate', () => {
  test('same version returns the same reference and sets nothing aside', () => {
    const state = richState();
    expect(migrate(state, CONTENT_VERSION)).toEqual({ state, setAside: [] });
    expect(migrate(state, CONTENT_VERSION).state).toBe(state);
  });

  test('a known older version keeps completions, current and the work of stops it did not change', () => {
    const state = richState();
    const relabel = (v: number): ProgressState => ({ ...state, contentVersion: v, nodes: new Map([...state.nodes].map(([id, n]) => [id, { ...n, ref: { ...n.ref, contentVersion: v } }])) });
    const old: ProgressState = { ...relabel(CONTENT_VERSION - 1), completedNodeIds: new Set([...state.completedNodeIds, nodeId('ch9-n9')]) };
    const { state: next, setAside } = migrate(old, CONTENT_VERSION);
    expect(setAside).toEqual([]);
    expect(next).toEqual(relabel(CONTENT_VERSION));
    expect(next.current).toBe('ch2-n7');
    expect(next.nodes.get(nodeId('ch2-n7'))?.work?.groups.size).toBe(4);
  });

  test('a stop listed as changed loses work that no longer fits; an unknown or unlisted version keeps only completions', () => {
    const state = richState();
    const old: ProgressState = { ...state, contentVersion: CONTENT_VERSION - 1, nodes: new Map([...state.nodes].map(([id, n]) => [id, { ...n, ref: { ...n.ref, contentVersion: CONTENT_VERSION - 1 } }])) };
    // Pretend the next version changes the join stop: materialize refuses the
    // unknown version, so its work cannot be shown to fit and is set aside.
    const changed = migrate(old, CONTENT_VERSION + 1, undefined, { [CONTENT_VERSION]: [], [CONTENT_VERSION + 1]: [nodeId('ch2-n7')] });
    expect(changed.setAside).toEqual(['ch2-n7']);
    expect(changed.state.nodes.get(nodeId('ch2-n7'))).toEqual({ ref: { ...old.nodes.get(nodeId('ch2-n7'))!.ref, contentVersion: CONTENT_VERSION + 1 }, work: null });
    expect(changed.state.completedNodeIds).toEqual(state.completedNodeIds);
    // A step nobody listed, or an archive from a newer build: nothing below completions is trusted.
    for (const unplaced of [migrate(old, CONTENT_VERSION + 1, undefined, {}), migrate({ ...state, contentVersion: CONTENT_VERSION + 1 }, CONTENT_VERSION)]) {
      expect(unplaced.setAside).toEqual(['ch2-n7']);
      expect(unplaced.state.nodes.size).toBe(0);
      expect(unplaced.state.current).toBeNull();
      expect(unplaced.state.completedNodeIds.size).toBe(27);
      expect(unplaced.state.language).toBe('en');
      expect(unplaced.state.seed).toBe(9);
    }
    expect(chapterId('ch1')).toBe('ch1');
  });
});

describe('store', () => {
  test('save then load gives the same state', async () => {
    const storage = memoryStorage();
    const state = richState();
    await save(storage, state);
    expect(await storage.getItem(STORAGE_KEY)).toBe(serialize(state));
    expect(await load(storage, 1)).toEqual(state);
  });

  test('no archive starts fresh with the given seed; a corrupt one is backed up first', async () => {
    const empty = memoryStorage();
    expect(await load(empty, 77)).toEqual(createInitialState(77));
    const corrupt = memoryStorage({ [STORAGE_KEY]: '{oops' });
    expect(await load(corrupt, 5)).toEqual(createInitialState(5));
    expect(await corrupt.getItem(BACKUP_KEY)).toBe('{oops');
    await corrupt.removeItem(BACKUP_KEY);
    expect(await corrupt.getItem(BACKUP_KEY)).toBeNull();
  });

  test('an archive from an older content version is migrated on load', async () => {
    const state = richState();
    const old: ProgressState = { ...state, contentVersion: CONTENT_VERSION - 1, nodes: new Map([...state.nodes].map(([id, n]) => [id, { ...n, ref: { ...n.ref, contentVersion: CONTENT_VERSION - 1 } }])) };
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(old) });
    const loaded = await load(storage, 1);
    expect(loaded).toEqual(state);
  });
});
