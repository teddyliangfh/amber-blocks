import { groupId } from '../core';
import { CONTENT_VERSION, materialize, nodeId } from '../content';
import { deserialize, serialize } from './codec';
import { createInitialState } from './migrate';
import { reduce } from './reducer';
import { sanitize } from './sanitize';
import type { ProgressState, ProgressStorage } from './schema';
import { BACKUP_KEY, RESET_BACKUP_KEY, STORAGE_KEY, createSaver, loadArchive, memoryStorage } from './store';
import type { SaveResult } from './store';

const ok = { matched: true, benchCount: 1, reason: 'matched' } as const;

function must(r: ReturnType<typeof reduce>): ProgressState {
  if (!r.ok) {
    throw new Error(r.reason);
  }
  return r.value;
}

// n1 and n2 completed, n3 entered with some work on the bench, English.
function played(): ProgressState {
  let s = createInitialState(4);
  for (const id of ['ch1-n1', 'ch1-n2']) {
    s = must(reduce(must(reduce(s, { type: 'enter', nodeId: nodeId(id) })), { type: 'complete', nodeId: nodeId(id), verdict: ok }));
  }
  s = must(reduce(s, { type: 'enter', nodeId: nodeId('ch1-n3') }));
  const puzzle = materialize(s.nodes.get(nodeId('ch1-n3'))!.ref);
  const unit = [...puzzle.initial.units.keys()][0]!;
  const work = { ...puzzle.initial, bench: new Map([[unit, { x: 0, y: 0 }]]), tray: puzzle.initial.tray.map((t) => (t.unitId === unit ? { ...t, unitId: null } : t)) };
  s = must(reduce(s, { type: 'saveWork', nodeId: nodeId('ch1-n3'), work }));
  return must(reduce(s, { type: 'setLanguage', language: 'en' }));
}

function unlockedThrough(last: string): ProgressState {
  let s = createInitialState(4);
  const order = ['ch1-n1', 'ch1-n2', 'ch1-n3', 'ch1-n4', 'ch1-n5', 'ch1-n6', 'ch1-n7', 'ch1-n8', 'ch1-n9', 'ch1-n10', 'ch1-n11', 'ch1-n12', 'ch2-n1', 'ch2-n2', 'ch2-n3'];
  for (const id of order.slice(0, order.indexOf(last))) {
    s = must(reduce(must(reduce(s, { type: 'enter', nodeId: nodeId(id) })), { type: 'complete', nodeId: nodeId(id), verdict: ok }));
  }
  return s;
}

// Storage whose writes wait until the test lets them through, in any order.
function gatedStorage() {
  const items = new Map<string, string>();
  const writes: (string | null)[] = [];
  const gates: { key: string; value: string | null; release: () => void; fail: (e: unknown) => void }[] = [];
  const storage: ProgressStorage = {
    getItem: (key) => Promise.resolve(items.get(key) ?? null),
    setItem: (key, value) =>
      new Promise<void>((resolve, reject) => {
        gates.push({ key, value, release: () => { items.set(key, value); writes.push(value); resolve(); }, fail: reject });
      }),
    removeItem: (key) =>
      new Promise<void>((resolve, reject) => {
        gates.push({ key, value: null, release: () => { items.delete(key); writes.push(null); resolve(); }, fail: reject });
      }),
  };
  const flush = async () => {
    // Let queued microtasks run, then release whatever is waiting, until quiet.
    for (let round = 0; round < 50; round += 1) {
      await Promise.resolve();
      const gate = gates.shift();
      if (gate !== undefined) {
        gate.release();
      }
    }
  };
  return { storage, items, writes, gates, flush };
}

function languageOf(raw: string | undefined): string | undefined {
  return raw === undefined ? undefined : deserialize(raw)?.language;
}

describe('load (review P2: storage failures never leave a blank page)', () => {
  test('a read that rejects gives a playable fresh state that will not be written', async () => {
    const storage: ProgressStorage = { ...memoryStorage(), getItem: () => Promise.reject(new Error('denied')) };
    const r = await loadArchive(storage, 9);
    expect(r).toEqual({ state: createInitialState(9), issue: 'read-failed', repairs: [], upgraded: [], persist: false });
  });

  test('a read that throws synchronously is handled the same way', async () => {
    const storage: ProgressStorage = {
      ...memoryStorage(),
      getItem: () => {
        throw new Error('SecurityError');
      },
    };
    expect((await loadArchive(storage, 2)).issue).toBe('read-failed');
  });

  test('a corrupt archive whose backup cannot be written still loads fresh', async () => {
    const storage: ProgressStorage = { ...memoryStorage({ [STORAGE_KEY]: '{oops' }), setItem: () => Promise.reject(new Error('quota')) };
    const r = await loadArchive(storage, 3);
    expect(r.issue).toBe('corrupt');
    expect(r.state).toEqual(createInitialState(3));
    expect(r.persist).toBe(true);
  });
});

describe('sanitize (review P2: refs and work must fit the running catalog)', () => {
  test('review repro: one node with ref.contentVersion 999 is dropped; completions, language and other work stay', async () => {
    const good = played();
    const json = JSON.parse(serialize(good));
    const n3 = json.nodes.find(([id]: [string]) => id === 'ch1-n3');
    n3[1].ref.contentVersion = 999;
    const raw = JSON.stringify(json);
    const storage = memoryStorage({ [STORAGE_KEY]: raw });
    const r = await loadArchive(storage, 1);
    expect(r.issue).toBe('repaired');
    expect(r.repairs).toEqual(['ref:ch1-n3']);
    expect(r.state.nodes.has(nodeId('ch1-n3'))).toBe(false);
    expect([...r.state.completedNodeIds].sort()).toEqual(['ch1-n1', 'ch1-n2']);
    expect(r.state.language).toBe('en');
    expect(r.state.nodes.has(nodeId('ch1-n1'))).toBe(true);
    // The original bytes are kept for inspection.
    expect(await storage.getItem(BACKUP_KEY)).toBe(raw);
    // And every remaining ref materializes.
    for (const node of r.state.nodes.values()) {
      expect(() => materialize(node.ref)).not.toThrow();
    }
  });

  test('a key that disagrees with ref.nodeId or ref.chapterId drops that stop only', () => {
    const good = played();
    const n1 = good.nodes.get(nodeId('ch1-n1'))!;
    const n2 = good.nodes.get(nodeId('ch1-n2'))!;
    const nodes = new Map(good.nodes)
      .set(nodeId('ch1-n1'), { ...n1, ref: { ...n1.ref, nodeId: nodeId('ch1-n2') } })
      .set(nodeId('ch1-n2'), { ...n2, ref: { ...n2.ref, chapterId: n2.ref.chapterId.replace('1', '2') as typeof n2.ref.chapterId } });
    const r = sanitize({ ...good, nodes });
    expect(r.repairs).toEqual(['ref:ch1-n1', 'ref:ch1-n2']);
    expect([...r.state.nodes.keys()]).toEqual(['ch1-n3']);
    expect(r.state.completedNodeIds.size).toBe(2);
  });

  test('work made from another stop keeps the ref and loses the work', () => {
    const good = played();
    const n3 = good.nodes.get(nodeId('ch1-n3'))!;
    const foreign = materialize({ ...n3.ref, nodeId: nodeId('ch1-n5') }).initial;
    const r = sanitize({ ...good, nodes: new Map(good.nodes).set(nodeId('ch1-n3'), { ...n3, work: foreign }) });
    expect(r.repairs).toEqual(['work:ch1-n3']);
    expect(r.state.nodes.get(nodeId('ch1-n3'))).toEqual({ ref: n3.ref, work: null });
  });

  test('work whose material differs in any way is dropped, the ref kept', () => {
    let s = unlockedThrough('ch2-n3');
    s = must(reduce(s, { type: 'enter', nodeId: nodeId('ch2-n3') }));
    const node = s.nodes.get(nodeId('ch2-n3'))!;
    const initial = materialize(node.ref).initial;
    const [first, second] = [...initial.groups.values()];
    const unit = [...initial.units.values()][0]!;
    const variants = {
      bounds: { ...initial, bounds: { cols: initial.bounds.cols + 1, rows: initial.bounds.rows } },
      hue: { ...initial, units: new Map(initial.units).set(unit.id, { ...unit, hue: 'n9' }) },
      group: { ...initial, groups: new Map(initial.groups).set(groupId('stranger'), { ...first!, id: groupId('stranger') }) },
      member: { ...initial, groups: new Map(initial.groups).set(first!.id, { ...first!, unitIds: [...first!.unitIds.slice(1), second!.unitIds[0]!] }) },
    };
    for (const [name, work] of Object.entries(variants)) {
      const r = sanitize({ ...s, nodes: new Map(s.nodes).set(nodeId('ch2-n3'), { ...node, work }) });
      expect([name, r.repairs]).toEqual([name, ['work:ch2-n3']]);
      expect(r.state.nodes.get(nodeId('ch2-n3'))).toEqual({ ref: node.ref, work: null });
    }
    // Its own material, untouched, is kept as is.
    expect(sanitize({ ...s, nodes: new Map(s.nodes).set(nodeId('ch2-n3'), { ...node, work: initial }) }).repairs).toEqual([]);
  });

  test('unknown stops, unknown completions and an unknown current are dropped', () => {
    const good = played();
    const r = sanitize({
      ...good,
      completedNodeIds: new Set([...good.completedNodeIds, nodeId('ch9-n1')]),
      current: nodeId('ch9-n1'),
      nodes: new Map(good.nodes).set(nodeId('ch9-n1'), good.nodes.get(nodeId('ch1-n1'))!),
    });
    expect(r.repairs).toEqual(['completed', 'current', 'node:ch9-n1']);
    expect(r.state.current).toBeNull();
    expect(r.state.completedNodeIds.size).toBe(2);
    const untouched = sanitize(good);
    expect(untouched.state).toBe(good);
  });

  test('a ref with a bad variant is dropped', () => {
    const good = played();
    const n1 = good.nodes.get(nodeId('ch1-n1'))!;
    expect(sanitize({ ...good, nodes: new Map([[nodeId('ch1-n1'), { ...n1, ref: { ...n1.ref, attemptVariant: -1 } }]]) }).repairs).toEqual(['ref:ch1-n1']);
    expect(CONTENT_VERSION).toBe(good.contentVersion);
  });
});

describe('saver (review P2: one ordered writer)', () => {
  test('writes never land out of order: the newest state is always the last one stored', async () => {
    const g = gatedStorage();
    const saver = createSaver(g.storage);
    const a = played();
    const b = must(reduce(a, { type: 'setLanguage', language: 'zh' }));
    const c = must(reduce(b, { type: 'setLanguage', language: 'en' }));
    saver.save(a);
    saver.save(b);
    saver.save(c);
    // a is in flight; b was replaced by c before it was written.
    await Promise.resolve();
    expect(g.gates).toHaveLength(1);
    await g.flush();
    await saver.idle();
    expect(g.items.get(STORAGE_KEY)).toBe(serialize(c));
  });

  test('a failed write is reported, never rejects, and the next save still goes through', async () => {
    let fail = true;
    const items = new Map<string, string>();
    const storage: ProgressStorage = {
      getItem: (key) => Promise.resolve(items.get(key) ?? null),
      setItem: (key, value) => {
        if (fail) {
          return Promise.reject(new Error('quota'));
        }
        items.set(key, value);
        return Promise.resolve();
      },
      removeItem: () => Promise.resolve(),
    };
    const results: SaveResult[] = [];
    const saver = createSaver(storage, (r) => results.push(r));
    saver.save(played());
    await saver.idle();
    expect(results).toEqual([{ ok: false, error: new Error('quota') }]);
    fail = false;
    const later = must(reduce(played(), { type: 'setLanguage', language: 'zh' }));
    saver.save(later);
    await saver.idle();
    expect(results[1]).toEqual({ ok: true });
    expect(items.get(STORAGE_KEY)).toBe(serialize(later));
  });

  test('reset waits for the write in flight and drops queued old states, so old progress never comes back', async () => {
    const g = gatedStorage();
    const saver = createSaver(g.storage);
    const old = played();
    const older = must(reduce(old, { type: 'setLanguage', language: 'zh' }));
    saver.save(old);
    await Promise.resolve();
    saver.save(older);
    const fresh = createInitialState(77);
    const done = saver.reset(fresh);
    for (let i = 0; i < 5; i += 1) {
      await Promise.resolve();
    }
    // Nothing touches the archive while the old write is still in flight.
    expect(g.gates.map((x) => x.value)).toEqual([serialize(old)]);
    await g.flush();
    expect(await done).toEqual({ ok: true });
    await saver.idle();
    expect(g.items.get(STORAGE_KEY)).toBe(serialize(fresh));
    // The queued older state was dropped, not written before the reset; the
    // stored archive was copied aside first (Phase 20 Q10).
    expect(g.writes).toEqual([serialize(old), serialize(old), null, serialize(fresh)]);
    expect(g.items.get(RESET_BACKUP_KEY)).toBe(serialize(old));
  });

  test('a save made right after reset is written after the reset, not swallowed by it', async () => {
    const g = gatedStorage();
    const saver = createSaver(g.storage);
    saver.save(played());
    const fresh = createInitialState(5);
    const done = saver.reset(fresh);
    const next = must(reduce(fresh, { type: 'setLanguage', language: 'en' }));
    saver.save(next);
    await g.flush();
    await done;
    await saver.idle();
    expect(languageOf(g.items.get(STORAGE_KEY))).toBe('en');
    expect(g.items.get(STORAGE_KEY)).toBe(serialize(next));
  });

  test('Phase 20 Q10: a reset keeps the archive it clears under its own key; with no archive there is nothing to keep', async () => {
    const before = serialize(played());
    const storage = memoryStorage({ [STORAGE_KEY]: before });
    const saver = createSaver(storage);
    const fresh = createInitialState(9);
    expect((await saver.reset(fresh)).ok).toBe(true);
    expect(await storage.getItem(RESET_BACKUP_KEY)).toBe(before);
    expect(await storage.getItem(STORAGE_KEY)).toBe(serialize(fresh));
    const empty = memoryStorage();
    expect((await createSaver(empty).reset(fresh)).ok).toBe(true);
    expect(await empty.getItem(RESET_BACKUP_KEY)).toBeNull();
    // A backup that cannot be written does not stop the reset.
    const stubborn: ProgressStorage = { ...memoryStorage({ [STORAGE_KEY]: before }), setItem: (key, value) => (key === RESET_BACKUP_KEY ? Promise.reject(new Error('full')) : storage.setItem(key, value)) };
    expect((await createSaver(stubborn).reset(fresh)).ok).toBe(true);
  });

  test('a reset that cannot reach storage reports the failure', async () => {
    const storage: ProgressStorage = { ...memoryStorage(), removeItem: () => Promise.reject(new Error('gone')) };
    const results: SaveResult[] = [];
    const saver = createSaver(storage, (r) => results.push(r));
    expect((await saver.reset(createInitialState(1))).ok).toBe(false);
    expect(results).toHaveLength(1);
    await saver.idle();
  });
});

describe('resetNode (recovery entry)', () => {
  test('forgets the stop ref and work, keeps completion; a stop never entered is a no-op', () => {
    const s = played();
    const r = must(reduce(s, { type: 'resetNode', nodeId: nodeId('ch1-n2') }));
    expect(r.nodes.has(nodeId('ch1-n2'))).toBe(false);
    expect(r.completedNodeIds.has(nodeId('ch1-n2'))).toBe(true);
    expect(must(reduce(s, { type: 'resetNode', nodeId: nodeId('ch1-n9') }))).toBe(s);
    expect(reduce(s, { type: 'resetNode', nodeId: nodeId('nope') })).toEqual({ ok: false, reason: 'unknown-node' });
  });
});
