import { apply, judge } from '../core';
import type { BenchState } from '../core';
import { CHAPTERS, CONTENT_CHANGES, CONTENT_VERSION, chapterId, fitBench, materialize, materializeNode, nodeId } from '../content';
import type { Puzzle, PuzzleRef, QuestionSpec } from '../content';
import { deserialize, serialize } from './codec';
import { UPGRADE_CURRENT, createInitialState, migrate, onMat, onwardFrom } from './migrate';
import { reduce } from './reducer';
import type { ProgressState } from './schema';
import { BACKUP_KEY, STORAGE_KEY, UPGRADE_BACKUP_KEY, loadArchive, memoryStorage, save } from './store';
import { sameMaterial } from './sanitize';
import { chapterCompletion, defaultCurrent, mapOrder, statusOf } from './unlock';
// Archives as the Phase 11 build wrote them (content version 1, before decoys):
// ch1-n10 dealt as two 5s in catalog order (h0, h1) plus two spares in the 10's
// colour, 12 blocks; ch1-n12 as 10 + 5 + 2 plus two spares, 19 blocks. Unit ids,
// hues and home slots match a real localStorage dump of that build. Frozen:
// never regenerate these from current code.
import ch1Finished from './__fixtures__/archive-v1-phase11-ch1-finished.json';
import n10Unfinished from './__fixtures__/archive-v1-phase11-n10-unfinished.json';
// Archives as the Phase 20 build (content version 6) wrote them, generated with
// that build's code before Phase 21 touched the catalog, seed 4242: everything
// finished (map on ch2-n8, three blocks in free play), Join Island 1–4 finished
// with the 4 put beside the given 2 on 5 (map on 5), Number Island 1–6
// finished with three blocks out on 7 (map on 7). Frozen: never regenerate.
import v6AllFinished from './__fixtures__/archive-v6-phase20-all-finished.json';
import v6Ch1Half from './__fixtures__/archive-v6-phase20-ch1-half.json';
import v6Ch2Half from './__fixtures__/archive-v6-phase20-ch2-half.json';

const ok = { matched: true, benchCount: 1, reason: 'matched' } as const;

function must(r: ReturnType<typeof reduce>): ProgressState {
  if (!r.ok) {
    throw new Error(r.reason);
  }
  return r.value;
}

function solved(state: ProgressState, id: string, steps?: number): BenchState {
  const puzzle = materialize(state.nodes.get(nodeId(id))!.ref);
  return puzzle.solution.slice(0, steps).reduce((w, cmd) => {
    const r = apply(w, cmd);
    if (!r.ok) {
      throw new Error(r.reason);
    }
    return r.value;
  }, puzzle.initial);
}

describe('content upgrade v1 → v2 (review P2: changed stops, old saves)', () => {
  test('the stops version 2 changed really deal different material than the Phase 11 archive holds', () => {
    const old = deserialize(JSON.stringify(n10Unfinished))!;
    const work = old.nodes.get(nodeId('ch1-n10'))!.work!;
    const now = materialize({ ...old.nodes.get(nodeId('ch1-n10'))!.ref, contentVersion: CONTENT_VERSION }).initial;
    expect(work.units.size).toBe(12);
    expect(now.units.size).toBe(16);
  });

  test('an unfinished 10 from the old build: completions kept, the work set aside as an upgrade (not damage), backed up', async () => {
    const raw = JSON.stringify(n10Unfinished);
    const storage = memoryStorage({ [STORAGE_KEY]: raw });
    const r = await loadArchive(storage, 1);
    expect(r.issue).toBe('upgraded');
    expect(r.repairs).toEqual([]);
    // 9 changed too since (version 4: a 5, a 4 and a decoy 3 instead of nine singles).
    expect(r.upgraded).toEqual(['ch1-n10', 'ch1-n9']);
    expect(r.state.contentVersion).toBe(CONTENT_VERSION);
    expect([...r.state.completedNodeIds].sort()).toEqual(['ch1-n1', 'ch1-n2', 'ch1-n3', 'ch1-n4', 'ch1-n5', 'ch1-n6', 'ch1-n7', 'ch1-n8', 'ch1-n9']);
    // The stop stays entered and current; the next visit deals the new material.
    const n10 = r.state.nodes.get(nodeId('ch1-n10'))!;
    expect(n10.work).toBeNull();
    expect(n10.ref).toEqual({ contentVersion: CONTENT_VERSION, chapterId: 'ch1', nodeId: 'ch1-n10', attemptVariant: 0, seed: 4242 });
    expect(materialize(n10.ref).initial.units.size).toBe(16);
    expect(r.state.current).toBe('ch1-n10');
    expect(statusOf(r.state, nodeId('ch1-n10'))).toBe('in-progress');
    // 9's nine singles do not match its new material: put away, still finished.
    // (Work on a stop whose material is unchanged survives: see the join stop below
    // and the version 3 tests.)
    const n9 = r.state.nodes.get(nodeId('ch1-n9'))!;
    expect(n9.ref.contentVersion).toBe(CONTENT_VERSION);
    expect(n9.work).toBeNull();
    expect(deserialize(raw)!.nodes.get(nodeId('ch1-n9'))!.work!.bench.size).toBe(9);
    expect(statusOf(r.state, nodeId('ch1-n9'))).toBe('completed');
    // The old bytes are kept under their own key, not as a corrupt archive.
    expect(await storage.getItem(UPGRADE_BACKUP_KEY)).toBe(raw);
    expect(await storage.getItem(BACKUP_KEY)).toBeNull();
  });

  test('a finished first island from the old build: every stop stays finished, 10 and 17 start fresh, an unchanged join stop keeps its half-built work', async () => {
    const raw = JSON.stringify(ch1Finished);
    const before = deserialize(raw)!;
    const r = await loadArchive(memoryStorage({ [STORAGE_KEY]: raw }), 1);
    expect(r.issue).toBe('upgraded');
    expect(r.upgraded).toEqual(['ch1-n10', 'ch1-n12']);
    expect(r.state.completedNodeIds).toEqual(before.completedNodeIds);
    expect(r.state.completedNodeIds.size).toBe(15);
    for (const id of ['ch1-n10', 'ch1-n11', 'ch1-n12']) {
      expect(statusOf(r.state, nodeId(id))).toBe('completed');
      expect(r.state.nodes.get(nodeId(id))!.work).toBeNull();
    }
    // The join stop did not change; its tray order (seeded) and saved partner survive the bump.
    expect(r.state.current).toBe('ch2-n4');
    expect(statusOf(r.state, nodeId('ch2-n4'))).toBe('in-progress');
    const join = r.state.nodes.get(nodeId('ch2-n4'))!;
    // On its fitted mat (8 × 6 → 6 × 3): the same partner in the same cells.
    expect(join.work).toEqual({ ...before.nodes.get(nodeId('ch2-n4'))!.work!, bounds: { cols: 6, rows: 3 } });
    expect(join.work!.bench.size).toBeGreaterThan(0);
    expect(materialize(join.ref).initial).toEqual(materialize({ ...join.ref, contentVersion: CONTENT_VERSION }).initial);
  });

  test('a save from the build that already dealt decoys (still labelled version 1) keeps its 10 and 17 work', async () => {
    let s = createInitialState(77);
    const order = ['ch1-n1', 'ch1-n2', 'ch1-n3', 'ch1-n4', 'ch1-n5', 'ch1-n6', 'ch1-n7', 'ch1-n8', 'ch1-n9', 'ch1-n10', 'ch1-n11'];
    for (const id of order) {
      s = must(reduce(s, { type: 'enter', nodeId: nodeId(id) }));
      s = must(reduce(s, { type: 'complete', nodeId: nodeId(id), verdict: ok }));
    }
    // 10 solved once and then taken apart again; 17 half built.
    s = must(reduce(s, { type: 'saveWork', nodeId: nodeId('ch1-n10'), work: solved(s, 'ch1-n10', 1) }));
    s = must(reduce(s, { type: 'enter', nodeId: nodeId('ch1-n12') }));
    s = must(reduce(s, { type: 'saveWork', nodeId: nodeId('ch1-n12'), work: solved(s, 'ch1-n12', 2) }));
    // Exactly what that build wrote: today's material, every ref and the header saying 1.
    const relabel = (v: number): ProgressState => ({ ...s, contentVersion: v, nodes: new Map([...s.nodes].map(([id, n]) => [id, { ...n, ref: { ...n.ref, contentVersion: v } }])) });
    const r = await loadArchive(memoryStorage({ [STORAGE_KEY]: serialize(relabel(1)) }), 1);
    expect(r.issue).toBeNull();
    expect(r.upgraded).toEqual([]);
    expect(r.state).toEqual(relabel(CONTENT_VERSION));
  });

  test('upgrading is one step: once saved, loading again reports nothing and changes nothing', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(n10Unfinished) });
    const first = await loadArchive(storage, 1);
    await save(storage, first.state);
    const second = await loadArchive(storage, 1);
    expect(second.issue).toBeNull();
    expect(second.upgraded).toEqual([]);
    expect(second.state).toEqual(first.state);
  });

  test('an archive from a newer build keeps its completions and starts every stop fresh', async () => {
    const future = { ...n10Unfinished, contentVersion: CONTENT_VERSION + 1 };
    const r = await loadArchive(memoryStorage({ [STORAGE_KEY]: JSON.stringify(future) }), 1);
    expect(r.issue).toBe('upgraded');
    expect([...r.upgraded].sort()).toEqual(['ch1-n10', 'ch1-n9']);
    expect(r.state.completedNodeIds.size).toBe(9);
    expect(r.state.nodes.size).toBe(0);
    expect(r.state.current).toBeNull();
  });

  test('damage is still damage: a ref that disagrees with its own old archive is dropped as a repair', async () => {
    const tampered = JSON.parse(JSON.stringify(n10Unfinished)) as { nodes: [string, { ref: { contentVersion: number } }][] };
    expect(tampered.nodes[0]![0]).toBe('ch1-n1');
    tampered.nodes[0]![1].ref.contentVersion = 999;
    const r = await loadArchive(memoryStorage({ [STORAGE_KEY]: JSON.stringify(tampered) }), 1);
    expect(r.issue).toBe('repaired');
    expect(r.repairs).toEqual(['ref:ch1-n1']);
    expect(r.upgraded).toEqual(['ch1-n10', 'ch1-n9']);
    expect(r.state.completedNodeIds.size).toBe(9);
  });
});

describe('content upgrade v2 → v3 (2026-10-15: mats fitted to each stop)', () => {
  // A version 2 save: today's material, on the old fixed mats.
  function v2(state: ProgressState): ProgressState {
    const nodes = new Map(
      [...state.nodes].map(([id, n]) => {
        const bounds = id.startsWith('ch1') ? { cols: 6, rows: 5 } : { cols: 8, rows: 6 };
        return [id, { ref: { ...n.ref, contentVersion: 2 }, work: n.work === null ? null : { ...n.work, bounds } }];
      }),
    );
    return { ...state, contentVersion: 2, nodes };
  }

  test('work that fits the new mat stays; work off its edge slides to the corner; work too big is set aside', () => {
    let s = createInitialState(3);
    for (const id of ['ch1-n1', 'ch1-n2', 'ch1-n3']) {
      s = must(reduce(s, { type: 'enter', nodeId: nodeId(id) }));
      s = must(reduce(s, { type: 'complete', nodeId: nodeId(id), verdict: ok }));
    }
    const units = (id: string) => [...materialize(s.nodes.get(nodeId(id))!.ref).initial.units.keys()];
    const placed = (id: string, cells: ReadonlyArray<{ x: number; y: number }>): BenchState => {
      const initial = materialize(s.nodes.get(nodeId(id))!.ref).initial;
      const us = units(id).slice(0, cells.length);
      return { ...initial, bench: new Map(us.map((u, i) => [u, cells[i]!])), tray: initial.tray.map((t) => (us.includes(t.unitId!) ? { ...t, unitId: null } : t)) };
    };
    // 1: one block at (1, 1), inside 3 × 3. 2: a pair at the far right of 6 × 5. 3: a row of five.
    s = must(reduce(s, { type: 'saveWork', nodeId: nodeId('ch1-n1'), work: placed('ch1-n1', [{ x: 1, y: 1 }]) }));
    s = must(reduce(s, { type: 'saveWork', nodeId: nodeId('ch1-n2'), work: placed('ch1-n2', [{ x: 4, y: 3 }, { x: 5, y: 3 }]) }));
    s = must(reduce(s, { type: 'saveWork', nodeId: nodeId('ch1-n3'), work: placed('ch1-n3', [0, 1, 2, 3, 4, 5].map((x) => ({ x, y: 0 }))) }));
    const r = migrate(v2(s));
    expect(r.state.contentVersion).toBe(CONTENT_VERSION);
    expect(r.state.nodes.get(nodeId('ch1-n1'))!.work!.bench).toEqual(placed('ch1-n1', [{ x: 1, y: 1 }]).bench);
    expect(r.state.nodes.get(nodeId('ch1-n2'))!.work!.bench).toEqual(placed('ch1-n2', [{ x: 0, y: 0 }, { x: 1, y: 0 }]).bench);
    expect(r.state.nodes.get(nodeId('ch1-n2'))!.work!.bounds).toEqual({ cols: 3, rows: 3 });
    // Six in a row cannot lie on 3's 5-wide mat: put away, listed for the parents, still entered.
    expect(r.setAside).toEqual(['ch1-n3']);
    expect(r.state.nodes.get(nodeId('ch1-n3'))).toEqual({ ref: { ...s.nodes.get(nodeId('ch1-n3'))!.ref }, work: null });
  });

  test('onMat: unchanged size is the same object; an empty bench just takes the new size', () => {
    const initial = materialize({ contentVersion: CONTENT_VERSION, chapterId: 'ch1' as never, nodeId: nodeId('ch1-n1'), attemptVariant: 0, seed: 1 }).initial;
    expect(onMat(initial, initial.bounds)).toBe(initial);
    expect(onMat({ ...initial, bounds: { cols: 6, rows: 5 } }, initial.bounds)).toEqual(initial);
  });
});

describe('content upgrade v4 → v5 (2026-10-16: 5 deals five singles beside its 3, review A-6)', () => {
  // A version 4 save: 5 dealt four singles (x-u0 … x-u3), today's deal minus the fifth.
  function v4Material(work: BenchState): BenchState {
    const spare = [...work.units.keys()].find((u) => u.endsWith('-x-u4'))!;
    const units = new Map([...work.units].filter(([u]) => u !== spare));
    const home = new Map([...work.home].filter(([u]) => u !== spare));
    // The spare waits in the tray's last slot (the solution never takes it).
    expect(work.tray[work.tray.length - 1]!.unitId).toBe(spare);
    return { ...work, units, home, tray: work.tray.slice(0, -1) };
  }
  function v4(state: ProgressState, five: BenchState | null): ProgressState {
    const nodes = new Map([...state.nodes].map(([id, n]) => [id, { ref: { ...n.ref, contentVersion: 4 }, work: id === 'ch1-n5' ? five : n.work }]));
    return { ...state, contentVersion: 4, nodes };
  }
  function upTo5(): ProgressState {
    let s = createInitialState(3);
    for (const id of ['ch1-n1', 'ch1-n2', 'ch1-n3', 'ch1-n4', 'ch1-n5']) {
      s = must(reduce(s, { type: 'enter', nodeId: nodeId(id) }));
      s = must(reduce(s, { type: 'complete', nodeId: nodeId(id), verdict: ok, work: solved(s, id) }));
    }
    return s;
  }

  test('the 5 deals one more single than version 4 did, and nothing else changed', () => {
    const s = upTo5();
    const now = materialize(s.nodes.get(nodeId('ch1-n5'))!.ref).initial;
    const singles = [...now.units.keys()].filter((u) => u.includes('-x-'));
    expect(singles).toHaveLength(5);
    expect(v4Material(now).units.size).toBe(now.units.size - 1);
    expect([...now.groups.values()].map((g) => g.unitIds.length)).toEqual([3]);
  });

  test('old work on 5 no longer matches its material: set aside, completion and album picture kept; other stops untouched', () => {
    const s = upTo5();
    const five = v4Material(solved(s, 'ch1-n5'));
    const old = v4(s, five);
    const r = migrate(old);
    expect(r.state.contentVersion).toBe(CONTENT_VERSION);
    expect(r.setAside).toEqual(['ch1-n5']);
    expect(r.state.completedNodeIds).toEqual(old.completedNodeIds);
    expect(r.state.nodes.get(nodeId('ch1-n5'))).toEqual({ ref: { ...s.nodes.get(nodeId('ch1-n5'))!.ref }, work: null });
    expect(r.state.nodes.get(nodeId('ch1-n1'))!.work).toEqual(s.nodes.get(nodeId('ch1-n1'))!.work);
    expect(r.state.nodes.get(nodeId('ch1-n1'))!.ref.contentVersion).toBe(CONTENT_VERSION);
    // The album is history (D-048): the old picture of 5 stays.
    expect(r.state.album.get(nodeId('ch1-n5'))).toBe(old.album.get(nodeId('ch1-n5')));
    expect(statusOf(r.state, nodeId('ch1-n6'))).not.toBe('locked');
  });

  test('a version 4 save with nothing on 5 upgrades quietly; through the store it is backed up once and reported as an upgrade', async () => {
    const s = upTo5();
    expect(migrate(v4(s, null)).setAside).toEqual([]);
    const raw = serialize(v4(s, v4Material(solved(s, 'ch1-n5'))));
    const storage = memoryStorage({ [STORAGE_KEY]: raw });
    const loaded = await loadArchive(storage, 1);
    expect(loaded.issue).toBe('upgraded');
    expect(loaded.upgraded).toEqual(['ch1-n5']);
    expect(await storage.getItem(UPGRADE_BACKUP_KEY)).toBe(raw);
    expect(loaded.state.completedNodeIds.size).toBe(5);
  });
});

describe('content upgrade v5 → v6 → v7 (Phase 19: Join Island 5–7 start with a partner on the mat; ch2-n8 is new; Phase 21 adds n9 – n12)', () => {
  // What version 5 dealt on 5, 6 and 7: exact joins. Exact joins are dealt by
  // code version 6 did not touch, so these specs deal exactly the version 5
  // material (its fingerprints were 3c13c51e, 16fc254e and 419c1740).
  const V5: Readonly<Record<string, QuestionSpec>> = {
    'ch2-n5': { kind: 'addition_exact', pairs: [[3, 2]], distractors: [1, 4] },
    'ch2-n6': { kind: 'addition_exact', pairs: [[4, 1]], distractors: [2, 3] },
    'ch2-n7': { kind: 'addition_exact', pairs: [[3, 4]], distractors: [5, 2] },
  };
  const CHANGED = ['ch2-n5', 'ch2-n6', 'ch2-n7'];
  const v5Puzzle = (id: string, ref: PuzzleRef): Puzzle => materializeNode({ id: nodeId(id), role: 'normal', spec: V5[id]! }, fitBench(V5[id]!), ref);
  const replay = (p: Puzzle): BenchState =>
    p.solution.reduce((w, cmd) => {
      const r = apply(w, cmd);
      if (!r.ok) {
        throw new Error(r.reason);
      }
      return r.value;
    }, p.initial);

  // Version 5's map: Number Island and Join Island 1–7 (unlocking in that order).
  const V5_CHAPTERS = CHAPTERS.map((c) => (c.id === 'ch2' ? { ...c, nodes: c.nodes.filter((n) => ['ch2-n1', 'ch2-n2', 'ch2-n3', 'ch2-n4', 'ch2-n5', 'ch2-n6', 'ch2-n7'].includes(n.id)) } : c));
  // Every stop version 5 had, finished by its reference answer, with its work
  // and album picture as version 5 dealt them; the map rests on ch2-n7, the
  // last stop entered.
  // Seed 5 deals 5, 6 and 7 differently from version 5 (see below for seeds
  // where an old tray happens to be dealt again).
  function v5Finished(seed = 5): ProgressState {
    let s = createInitialState(seed);
    for (const e of mapOrder(V5_CHAPTERS)) {
      s = must(reduce(s, { type: 'enter', nodeId: e.nodeId }, V5_CHAPTERS));
      const ref = s.nodes.get(e.nodeId)!.ref;
      const work = replay(e.nodeId in V5 ? v5Puzzle(e.nodeId, ref) : materialize(ref));
      s = must(reduce(s, { type: 'complete', nodeId: e.nodeId, verdict: ok, work }, V5_CHAPTERS));
    }
    return { ...s, contentVersion: 5, nodes: new Map([...s.nodes].map(([id, n]) => [id, { ...n, ref: { ...n.ref, contentVersion: 5 } }])) };
  }

  test('version 6 changed the material of 5, 6 and 7 only, and 8 is new', () => {
    expect(CONTENT_CHANGES[6]).toEqual(CHANGED);
    const old = v5Finished();
    expect(old.completedNodeIds.size).toBe(19);
    expect(old.nodes.has(nodeId('ch2-n8'))).toBe(false);
    for (const id of CHANGED) {
      const ref = { ...old.nodes.get(nodeId(id))!.ref, contentVersion: CONTENT_VERSION };
      const now = materialize(ref);
      expect(`${id} ${sameMaterial(v5Puzzle(id, ref).initial, now.initial)}`).toBe(`${id} false`);
      // A partner is on the mat from the start now.
      expect(now.initial.bench.size).toBeGreaterThan(0);
    }
    // Every other stop's version 5 work fits its version 6 material as it is.
    const r = migrate(old);
    for (const [id, n] of old.nodes) {
      if (!CHANGED.includes(id)) {
        expect(r.state.nodes.get(id)).toEqual({ ref: { ...n.ref, contentVersion: CONTENT_VERSION }, work: n.work });
      }
    }
  });

  test('old work on 5–7 no longer matches: put away; completions and album pictures stay', () => {
    const old = v5Finished();
    const r = migrate(old);
    expect(r.setAside).toEqual(CHANGED);
    expect(r.state.completedNodeIds).toEqual(old.completedNodeIds);
    for (const id of CHANGED) {
      expect(r.state.nodes.get(nodeId(id))).toEqual({ ref: { ...old.nodes.get(nodeId(id))!.ref, contentVersion: CONTENT_VERSION }, work: null });
      // The album is history (D-048): the old 3 + 2, 4 + 1 and 3 + 4 stay.
      expect(r.state.album.get(nodeId(id))).toBe(old.album.get(nodeId(id)));
    }
    expect(r.state.album.size).toBe(19);
  });

  test('a finished version 5 archive: the stops added since open in map order, the map rests on the first; Join Island is not finished until they are; loading it is an upgrade', async () => {
    const old = v5Finished();
    expect(old.current).toBe('ch2-n7');
    const r = migrate(old);
    // Version 7 (Phase 21): ch2-n9 is the first stop past a finished one.
    expect(r.state.current).toBe('ch2-n9');
    expect(defaultCurrent(r.state)).toBe('ch2-n9');
    for (const id of ['ch2-n9', 'ch2-n10', 'ch2-n11', 'ch2-n12']) {
      expect(`${id} ${statusOf(r.state, nodeId(id))}`).toBe(`${id} available`);
    }
    // 8 comes after 12 now.
    expect(statusOf(r.state, nodeId('ch2-n8'))).toBe('locked');
    expect(chapterCompletion(r.state, chapterId('ch2'))).toEqual({ done: 7, total: 12 });
    expect(mapOrder().every((e) => r.state.completedNodeIds.has(e.nodeId))).toBe(false);
    // Playing the five finishes the island (and so every island) again.
    let s = r.state;
    for (const id of ['ch2-n9', 'ch2-n10', 'ch2-n11', 'ch2-n12', 'ch2-n8']) {
      s = must(reduce(s, { type: 'enter', nodeId: nodeId(id) }));
      s = must(reduce(s, { type: 'complete', nodeId: nodeId(id), verdict: ok, work: solved(s, id) }));
    }
    expect(chapterCompletion(s, chapterId('ch2'))).toEqual({ done: 12, total: 12 });
    expect(mapOrder().every((e) => s.completedNodeIds.has(e.nodeId))).toBe(true);

    const raw = serialize(old);
    const storage = memoryStorage({ [STORAGE_KEY]: raw });
    const loaded = await loadArchive(storage, 1);
    expect(loaded.issue).toBe('upgraded');
    expect(loaded.upgraded).toEqual(CHANGED);
    expect(loaded.state.contentVersion).toBe(CONTENT_VERSION);
    expect(loaded.state.current).toBe('ch2-n9');
    expect(await storage.getItem(UPGRADE_BACKUP_KEY)).toBe(raw);
  });

  test('where version 6 happens to deal an old tray again, the old work still fits and is kept (D-034): 7\'s 3 + 4 is still right, 6\'s 4 + 1 is not', () => {
    // Seed 4242 (the browser seeds' seed): 7's tray is the 3 last, then 4, 5, 2 as before.
    const old = v5Finished(4242);
    const r = migrate(old);
    expect(r.setAside).toEqual(['ch2-n5', 'ch2-n6']);
    const seven = r.state.nodes.get(nodeId('ch2-n7'))!;
    expect(seven.work).toBe(old.nodes.get(nodeId('ch2-n7'))!.work);
    expect(sameMaterial(seven.work!, materialize(seven.ref).initial)).toBe(true);
    expect(judge(seven.work!, materialize(seven.ref).question).matched).toBe(true);
    // Seed 3: 6's old tray again, on the wider mat (onMat). The stop stays finished; the mat shows 4 + 1, which is not 6.
    const three = migrate(v5Finished(3));
    expect(three.setAside).toEqual(['ch2-n5', 'ch2-n7']);
    const six = three.state.nodes.get(nodeId('ch2-n6'))!;
    expect(six.work!.bounds).toEqual({ cols: 7, rows: 3 });
    expect(judge(six.work!, materialize(six.ref).question).matched).toBe(false);
    expect(three.state.completedNodeIds.has(nodeId('ch2-n6'))).toBe(true);
  });

  test('the map only moves on from a finished stop, to the first stop finishing opened that is not finished', () => {
    const old = v5Finished();
    // Resting on an unfinished stop: it stays.
    const midway = { ...old, completedNodeIds: new Set([...old.completedNodeIds].filter((id) => id !== 'ch1-n5')), current: nodeId('ch1-n5') };
    expect(migrate(midway).state.current).toBe('ch1-n5');
    // Resting on a finished one, wherever it is: the first open unfinished stop (Phase 21; Phase 19 moved only to the very next).
    expect(migrate({ ...old, current: nodeId('ch1-n3') }).state.current).toBe('ch2-n9');
    expect(migrate({ ...old, current: null }).state.current).toBeNull();
    // Unchanged version: nothing moves.
    const now = migrate(old).state;
    expect(migrate({ ...now, current: nodeId('ch2-n7') }).state.current).toBe('ch2-n7');
  });
});

describe('content upgrade v6 → v7 (Phase 21: Join Island 8 → 12 stops, the new ones between the old)', () => {
  const NEW = ['ch2-n9', 'ch2-n10', 'ch2-n11', 'ch2-n12'];
  const fixtures = { all: v6AllFinished, ch2Half: v6Ch2Half, ch1Half: v6Ch1Half };
  const old = (name: keyof typeof fixtures) => deserialize(JSON.stringify(fixtures[name]))!;

  test('version 7 changed no stop: every completion, every piece of work, the album and free play are kept as they were', () => {
    expect(CONTENT_VERSION).toBe(7);
    expect(CONTENT_CHANGES[7]).toEqual([]);
    for (const name of ['all', 'ch2Half', 'ch1Half'] as const) {
      const before = old(name);
      expect(before.contentVersion).toBe(6);
      const r = migrate(before);
      expect(r.setAside).toEqual([]);
      expect(r.state.contentVersion).toBe(7);
      expect(r.state.completedNodeIds).toEqual(before.completedNodeIds);
      for (const [id, n] of before.nodes) {
        const now = r.state.nodes.get(id)!;
        expect(now.work).toBe(n.work);
        expect(now.ref).toEqual({ ...n.ref, contentVersion: 7 });
        // The old work fits the stop's version 7 material exactly.
        if (n.work !== null) {
          expect(`${id} ${sameMaterial(n.work, materialize(now.ref).initial)}`).toBe(`${id} true`);
        }
      }
      expect(r.state.album).toBe(before.album);
      expect(r.state.sandbox).toBe(before.sandbox);
      expect(NEW.some((id) => r.state.nodes.has(nodeId(id)) || r.state.completedNodeIds.has(nodeId(id)))).toBe(false);
    }
    // The original eight keep their pictures; free play keeps its three blocks.
    expect(old('all').album.size).toBe(20);
    expect(migrate(old('all')).state.sandbox?.bench.size).toBe(3);
  });

  test('everything finished: the four new stops are open, the map rests on the first; no cup until they are played', () => {
    const before = old('all');
    expect(before.current).toBe('ch2-n8');
    const r = migrate(before).state;
    expect(r.current).toBe('ch2-n9');
    expect(defaultCurrent(r)).toBe('ch2-n9');
    for (const id of NEW) {
      expect(`${id} ${statusOf(r, nodeId(id))}`).toBe(`${id} available`);
    }
    expect(statusOf(r, nodeId('ch2-n8'))).toBe('completed');
    expect(chapterCompletion(r, chapterId('ch2'))).toEqual({ done: 8, total: 12 });
    expect(mapOrder().every((e) => r.completedNodeIds.has(e.nodeId))).toBe(false);
    let s = r;
    for (const id of NEW) {
      s = must(reduce(s, { type: 'enter', nodeId: nodeId(id) }));
      s = must(reduce(s, { type: 'complete', nodeId: nodeId(id), verdict: ok, work: solved(s, id) }));
    }
    expect(chapterCompletion(s, chapterId('ch2'))).toEqual({ done: 12, total: 12 });
    expect(mapOrder().every((e) => s.completedNodeIds.has(e.nodeId))).toBe(true);
    expect(s.album.size).toBe(24);
  });

  test('Join Island half way: the new stops past a finished one open, the map stays on the unfinished 5 with its work', () => {
    const before = old('ch2Half');
    const r = migrate(before).state;
    expect(r.current).toBe('ch2-n5');
    expect(statusOf(r, nodeId('ch2-n9'))).toBe('available');
    expect(statusOf(r, nodeId('ch2-n10'))).toBe('available');
    expect(statusOf(r, nodeId('ch2-n5'))).toBe('in-progress');
    expect(statusOf(r, nodeId('ch2-n11'))).toBe('locked');
    expect(statusOf(r, nodeId('ch2-n12'))).toBe('locked');
    const five = r.nodes.get(nodeId('ch2-n5'))!;
    expect(five.work).toBe(before.nodes.get(nodeId('ch2-n5'))!.work);
    expect(judge(five.work!, materialize(five.ref).question).matched).toBe(false);
    expect(chapterCompletion(r, chapterId('ch2'))).toEqual({ done: 4, total: 12 });
    // Resting on a finished stop past a new one, the map goes back to it.
    expect(migrate({ ...before, current: nodeId('ch2-n4') }).state.current).toBe('ch2-n9');
  });

  test('Number Island half way: nothing changes but the version; Join Island stays shut', () => {
    const before = old('ch1Half');
    const r = migrate(before).state;
    expect(r.current).toBe('ch1-n7');
    expect(r.nodes.get(nodeId('ch1-n7'))!.work).toBe(before.nodes.get(nodeId('ch1-n7'))!.work);
    expect(r.nodes.get(nodeId('ch1-n7'))!.work!.bench.size).toBe(3);
    expect(['ch2-n1', ...NEW].map((id) => statusOf(r, nodeId(id)))).toEqual(['locked', 'locked', 'locked', 'locked', 'locked']);
  });

  test('through the store: nothing set aside is no upgrade to report (no stops listed for the parents), and nothing is backed up', async () => {
    for (const name of ['all', 'ch2Half', 'ch1Half'] as const) {
      const raw = JSON.stringify(fixtures[name]);
      const storage = memoryStorage({ [STORAGE_KEY]: raw });
      const loaded = await loadArchive(storage, 1);
      expect(loaded.issue).toBeNull();
      expect(loaded.upgraded).toEqual([]);
      expect(loaded.repairs).toEqual([]);
      expect(loaded.state.contentVersion).toBe(7);
      expect(await storage.getItem(UPGRADE_BACKUP_KEY)).toBeNull();
      expect(await storage.getItem(BACKUP_KEY)).toBeNull();
    }
    expect((await loadArchive(memoryStorage({ [STORAGE_KEY]: JSON.stringify(v6AllFinished) }), 1)).state.current).toBe('ch2-n9');
  });

  test('UPGRADE_CURRENT: the first open unfinished stop by default; the Phase 19 rule moves only to the very next', () => {
    expect(UPGRADE_CURRENT).toBe('first-open');
    const all = migrate(old('all')).state;
    const done = old('all').completedNodeIds;
    expect(onwardFrom(nodeId('ch2-n8'), done, CHAPTERS, 'first-open')).toBe('ch2-n9');
    expect(onwardFrom(nodeId('ch2-n8'), done, CHAPTERS, 'next')).toBe('ch2-n8');
    expect(onwardFrom(nodeId('ch2-n3'), done, CHAPTERS, 'next')).toBe('ch2-n9');
    expect(onwardFrom(nodeId('ch2-n4'), done, CHAPTERS, 'next')).toBe('ch2-n10');
    // Not finished, or nowhere: it stays.
    expect(onwardFrom(nodeId('ch2-n9'), done, CHAPTERS)).toBe('ch2-n9');
    expect(onwardFrom(null, done, CHAPTERS)).toBeNull();
    // Everything finished: nowhere to move.
    expect(onwardFrom(nodeId('ch2-n8'), new Set(mapOrder().map((e) => e.nodeId)), CHAPTERS)).toBe('ch2-n8');
    // A parent started play on Join Island: finishing there never sends the map back to ch1-n1.
    expect(onwardFrom(nodeId('ch2-n2'), new Set([nodeId('ch2-n1'), nodeId('ch2-n2')]), CHAPTERS)).toBe('ch2-n3');
    expect(all.current).toBe('ch2-n9');
  });
});
