import { apply, judge } from '../core';
import type { BenchState, Command } from '../core';
import { CONTENT_VERSION, materialize, nodeId } from '../content';
import type { NodeId } from '../content';
import { decodeArchive, deserialize, sameWork, serialize } from './codec';
import { createInitialState, migrate } from './migrate';
import { reduce } from './reducer';
import type { ProgressCommand } from './reducer';
import { sanitize } from './sanitize';
import type { ProgressState } from './schema';
import { BACKUP_KEY, STORAGE_KEY, loadArchive, memoryStorage } from './store';
// Frozen archives from before the album existed (see upgrade.test.ts). Never regenerate.
import ch1Finished from './__fixtures__/archive-v1-phase11-ch1-finished.json';
import n10Unfinished from './__fixtures__/archive-v1-phase11-n10-unfinished.json';

// The album (2026-10-15 review Q): each stop's mat as the child last had it
// right. These tests use rearranged answers, not the reference solution, so a
// snapshot that silently fell back to the reference would not pass.

const ok = { matched: true, benchCount: 1, reason: 'matched' } as const;
const no = { matched: false, benchCount: 3, reason: 'count-mismatch' } as const;
const id = (raw: string): NodeId => nodeId(raw);

function run(state: ProgressState, cmds: ReadonlyArray<ProgressCommand>): ProgressState {
  return cmds.reduce((s, cmd) => {
    const r = reduce(s, cmd);
    if (!r.ok) {
      throw new Error(`${cmd.type}: ${r.reason}`);
    }
    return r.value;
  }, state);
}

function play(work: BenchState, cmds: ReadonlyArray<Command>): BenchState {
  return cmds.reduce((w, cmd) => {
    const r = apply(w, cmd);
    if (!r.ok) {
      throw new Error(`${cmd.type}: ${r.reason}`);
    }
    return r.value;
  }, work);
}

function puzzleOf(state: ProgressState, stop: string) {
  return materialize(state.nodes.get(id(stop))!.ref);
}

// ch1-n2 entered: its units, and three mats made from them.
function two() {
  const s = run(createInitialState(11), [{ type: 'enter', nodeId: id('ch1-n1') }, { type: 'complete', nodeId: id('ch1-n1'), verdict: ok }, { type: 'enter', nodeId: id('ch1-n2') }]);
  const p = puzzleOf(s, 'ch1-n2');
  const [a, b, c] = [...p.initial.units.keys()];
  const side = play(p.initial, [{ type: 'take', unitId: a!, to: { x: 0, y: 1 } }, { type: 'take', unitId: b!, to: { x: 1, y: 1 } }]);
  const tall = play(side, [{ type: 'move', unitId: b!, to: { x: 0, y: 2 } }]);
  const three = play(tall, [{ type: 'take', unitId: c!, to: { x: 2, y: 2 } }]);
  expect(judge(side, p.question).matched).toBe(true);
  expect(judge(tall, p.question).matched).toBe(true);
  expect(judge(three, p.question).matched).toBe(false);
  return { s, side, tall, three };
}

describe('album: what the reducer keeps (2026-10-15 review Q)', () => {
  test('a right mat is saved, completed and kept in one step', () => {
    const { s, side } = two();
    const done = run(s, [{ type: 'complete', nodeId: id('ch1-n2'), verdict: ok, work: side }]);
    expect(done.album.get(id('ch1-n2'))).toBe(side);
    expect(done.nodes.get(id('ch1-n2'))!.work).toBe(side);
    expect(done.completedNodeIds.has(id('ch1-n2'))).toBe(true);
    // ch1-n1 was completed without a mat (a caller that has none): no picture for it.
    expect([...done.album.keys()]).toEqual(['ch1-n2']);
  });

  test('rearranged and still right replaces the picture; the same mat again changes nothing, even as a copy', () => {
    const { s, side, tall } = two();
    const first = run(s, [{ type: 'complete', nodeId: id('ch1-n2'), verdict: ok, work: side }]);
    const moved = run(first, [{ type: 'complete', nodeId: id('ch1-n2'), verdict: ok, work: tall }]);
    expect(moved.album.get(id('ch1-n2'))).toBe(tall);
    expect(moved.nodes.get(id('ch1-n2'))!.work).toBe(tall);
    // An equal mat read back from storage is the same picture: same state, nothing to write.
    const copy = deserialize(serialize(moved))!.album.get(id('ch1-n2'))!;
    expect(copy).not.toBe(tall);
    const again = reduce(moved, { type: 'complete', nodeId: id('ch1-n2'), verdict: ok, work: copy });
    expect(again.ok && again.value).toBe(moved);
  });

  test('mistakes, undo, play again, a new variant, recovery, the language and the start stop never clear it', () => {
    const { s, side, three } = two();
    const kept = run(s, [{ type: 'complete', nodeId: id('ch1-n2'), verdict: ok, work: side }]);
    const steps: ReadonlyArray<ProgressCommand> = [
      { type: 'saveWork', nodeId: id('ch1-n2'), work: three },
      { type: 'saveWork', nodeId: id('ch1-n2'), work: puzzleOf(kept, 'ch1-n2').initial },
      { type: 'replay', nodeId: id('ch1-n2') },
      { type: 'newVariant', nodeId: id('ch1-n2') },
      { type: 'resetNode', nodeId: id('ch1-n2') },
      { type: 'enter', nodeId: id('ch1-n2') },
      { type: 'setLanguage', language: 'en' },
      { type: 'startAt', nodeId: id('ch1-n1') },
    ];
    let state = kept;
    for (const cmd of steps) {
      state = run(state, [cmd]);
      expect([cmd.type, state.album.get(id('ch1-n2'))]).toEqual([cmd.type, side]);
    }
    expect(state.nodes.get(id('ch1-n2'))!.work).toBeNull();
    // Resetting the progress is a fresh state: nothing kept.
    expect(createInitialState(11).album.size).toBe(0);
  });

  test('a wrong verdict or a stop never entered is refused and keeps nothing', () => {
    const { s, three } = two();
    expect(reduce(s, { type: 'complete', nodeId: id('ch1-n2'), verdict: no, work: three })).toEqual({ ok: false, reason: 'not-matched' });
    expect(reduce(s, { type: 'complete', nodeId: id('ch1-n3'), verdict: ok, work: three })).toEqual({ ok: false, reason: 'not-entered' });
    expect(s.album.size).toBe(0);
  });
});

describe('album: archive format', () => {
  // ch1-n2 (single blocks) and ch2-n1 (two partners), both rearranged after solving, plus unfinished work elsewhere.
  function withAlbum(): ProgressState {
    const { s, tall } = two();
    let state = run(s, [{ type: 'complete', nodeId: id('ch1-n2'), verdict: ok, work: tall }]);
    for (const stop of ['ch1-n3', 'ch1-n4', 'ch1-n5', 'ch1-n6', 'ch1-n13', 'ch1-n7', 'ch1-n14', 'ch1-n8', 'ch1-n15', 'ch1-n9', 'ch1-n16', 'ch1-n10', 'ch1-n17', 'ch1-n11', 'ch1-n12']) {
      state = run(state, [{ type: 'enter', nodeId: id(stop) }, { type: 'complete', nodeId: id(stop), verdict: ok }]);
    }
    state = run(state, [{ type: 'enter', nodeId: id('ch2-n1') }]);
    const p = puzzleOf(state, 'ch2-n1');
    const solved = play(p.initial, p.solution);
    // Both partners one row down: still joined, still right, not the reference mat.
    const groups = [...solved.groups.values()].filter((g) => g.unitIds.every((u) => solved.bench.has(u)));
    const [first] = groups;
    const work = play(solved, groups.map((g) => ({ type: 'moveGroup', groupId: g.id, delta: { x: 0, y: 1 } }) as const));
    expect(judge(work, p.question).matched).toBe(true);
    expect(sameWork(work, solved)).toBe(false);
    state = run(state, [{ type: 'complete', nodeId: id('ch2-n1'), verdict: ok, work }]);
    // A wrong mat after solving: the saved work moves on, the picture does not.
    const broken = play(work, [{ type: 'returnGroup', groupId: first!.id }]);
    return run(state, [{ type: 'saveWork', nodeId: id('ch2-n1'), work: broken }, { type: 'setLanguage', language: 'en' }]);
  }

  test('round-trips with partners, deterministically and in a fixed order', () => {
    const state = withAlbum();
    expect(state.album.get(id('ch2-n1'))!.groups.size).toBeGreaterThan(0);
    expect(sameWork(state.album.get(id('ch2-n1')), state.nodes.get(id('ch2-n1'))!.work!)).toBe(false);
    const json = serialize(state);
    const back = deserialize(json)!;
    expect(back).toEqual(state);
    expect(serialize(back)).toBe(json);
    // Insertion order does not leak into the bytes.
    const reversed = { ...state, album: new Map([...state.album].reverse()) };
    expect(serialize(reversed)).toBe(json);
    expect((JSON.parse(json) as { album: [string][] }).album.map(([k]) => k)).toEqual(['ch1-n2', 'ch2-n1']);
  });

  test('purely additive: still schema 1, and the rest of the archive reads the same without it (what an older build sees)', () => {
    const state = withAlbum();
    const json = JSON.parse(serialize(state)) as Record<string, unknown>;
    expect(json['schemaVersion']).toBe(1);
    const { album: _album, ...older } = json;
    const decoded = decodeArchive(JSON.stringify(older))!;
    expect(decoded.repairs).toEqual([]);
    expect(decoded.state).toEqual({ ...state, album: new Map() });
  });

  test('the frozen archives from before the album load with an empty album and nothing to repair because of it', async () => {
    for (const fixture of [ch1Finished, n10Unfinished]) {
      const raw = JSON.stringify(fixture);
      expect(raw).not.toContain('"album"');
      const decoded = decodeArchive(raw)!;
      expect(decoded.state.album.size).toBe(0);
      expect(decoded.repairs).toEqual([]);
      const r = await loadArchive(memoryStorage({ [STORAGE_KEY]: raw }), 1);
      expect(r.state.album.size).toBe(0);
      expect(r.repairs).toEqual([]);
      expect(r.issue).toBe('upgraded');
    }
  });

  test('a broken picture is dropped on its own, listed as a repair; the rest of the album and the archive stay', async () => {
    const state = withAlbum();
    type Json = { album: unknown; nodes: unknown[]; completedNodeIds: string[] };
    const damaged = (mutate: (j: Json) => void) => {
      const j = JSON.parse(serialize(state)) as Json;
      mutate(j);
      return JSON.stringify(j);
    };
    const cases: ReadonlyArray<readonly [string, (j: Json) => void, ReadonlyArray<string>, ReadonlyArray<string>]> = [
      ['not a list', (j) => (j.album = { 'ch1-n2': 1 }), ['album'], []],
      ['an entry that is not a pair', (j) => (j.album as unknown[]).unshift('x'), ['album#0'], ['ch1-n2', 'ch2-n1']],
      ['an id that is not a string', (j) => (j.album as unknown[]).push([7, {}]), ['album#2'], ['ch1-n2', 'ch2-n1']],
      ['a mat with a unit in two places', (j) => ((j.album as [string, { bench: unknown[]; tray: unknown[] }][])[0]![1].bench.push([(j.album as [string, { tray: string[] }][])[0]![1].tray.find((t) => t !== null), 0, 0])), ['album:ch1-n2'], ['ch2-n1']],
      ['a mat that is not an object', (j) => ((j.album as unknown[][])[1]![1] = 'mat'), ['album:ch2-n1'], ['ch1-n2']],
    ];
    for (const [name, mutate, repairs, kept] of cases) {
      const raw = damaged(mutate);
      const d = decodeArchive(raw)!;
      expect([name, d.repairs]).toEqual([name, repairs]);
      expect([name, [...d.state.album.keys()]]).toEqual([name, kept]);
      expect(d.state.completedNodeIds).toEqual(state.completedNodeIds);
      expect(d.state.nodes).toEqual(state.nodes);
      for (const k of kept) {
        expect(d.state.album.get(id(k))).toEqual(state.album.get(id(k)));
      }
      // Loading keeps the original bytes for inspection, like any other repair.
      const storage = memoryStorage({ [STORAGE_KEY]: raw });
      const r = await loadArchive(storage, 1);
      expect(r.issue).toBe('repaired');
      expect(await storage.getItem(BACKUP_KEY)).toBe(raw);
      expect(r.state.completedNodeIds).toEqual(state.completedNodeIds);
    }
  });
});

describe('album: sanitize and content upgrades', () => {
  test('sanitize drops pictures of unknown stops, empty mats and mats that break the rules; an old-material picture stays', () => {
    const { s, side } = two();
    const state = run(s, [{ type: 'complete', nodeId: id('ch1-n2'), verdict: ok, work: side }]);
    const untouched = sanitize(state);
    expect(untouched.repairs).toEqual([]);
    expect(untouched.state).toBe(state);
    // History, not play state: material this build would no longer deal (old 6 × 5 mat, other colours) is fine.
    const oldMaterial: BenchState = { ...side, bounds: { cols: 6, rows: 5 }, units: new Map([...side.units].map(([u, unit]) => [u, { ...unit, hue: 'n9' }])) };
    const [unit] = [...side.bench.keys()];
    const twice: BenchState = { ...side, tray: side.tray.map((t, i) => (i === 0 ? { ...t, unitId: unit! } : t)) };
    const album = new Map(state.album)
      .set(id('ch1-n3'), oldMaterial)
      .set(id('ch9-n1'), side)
      .set(id('ch1-n4'), puzzleOf(state, 'ch1-n2').initial)
      .set(id('ch1-n5'), twice);
    const r = sanitize({ ...state, album });
    expect(r.repairs).toEqual(['album:ch9-n1', 'album:ch1-n4', 'album:ch1-n5']);
    expect([...r.state.album.keys()]).toEqual(['ch1-n2', 'ch1-n3']);
    expect(r.state.album.get(id('ch1-n3'))).toBe(oldMaterial);
    expect(r.state.completedNodeIds).toEqual(state.completedNodeIds);
  });

  test('migrate keeps the album exactly as it was: a known upgrade, and an archive from a newer build', () => {
    const { s, side } = two();
    const state = run(s, [{ type: 'complete', nodeId: id('ch1-n2'), verdict: ok, work: side }]);
    const relabel = (v: number): ProgressState => ({ ...state, contentVersion: v, nodes: new Map([...state.nodes].map(([k, n]) => [k, { ...n, ref: { ...n.ref, contentVersion: v } }])) });
    const known = migrate(relabel(CONTENT_VERSION - 1), CONTENT_VERSION, undefined, { [CONTENT_VERSION]: [id('ch1-n2')] });
    expect(known.state.album).toBe(state.album);
    const newer = migrate(relabel(CONTENT_VERSION + 1), CONTENT_VERSION);
    expect(newer.state.nodes.size).toBe(0);
    expect(newer.state.album).toBe(state.album);
  });

  test('an upgrade that sets a stop\'s work aside keeps its picture: the old 9 singles stay in the album', async () => {
    // The Phase 11 archive with a picture added for 9 (nine single blocks, the
    // version 1 material that version 4 replaced with a 5 and a 4).
    const raw = JSON.parse(JSON.stringify(n10Unfinished)) as { nodes: [string, { work: unknown }][]; album?: unknown };
    const nine = raw.nodes.find(([k]) => k === 'ch1-n9')![1].work;
    raw.album = [['ch1-n9', nine]];
    const r = await loadArchive(memoryStorage({ [STORAGE_KEY]: JSON.stringify(raw) }), 1);
    expect(r.issue).toBe('upgraded');
    expect(r.repairs).toEqual([]);
    expect(r.upgraded).toEqual(['ch1-n10', 'ch1-n9']);
    expect(r.state.nodes.get(id('ch1-n9'))!.work).toBeNull();
    const picture = r.state.album.get(id('ch1-n9'))!;
    expect(picture.bench.size).toBe(9);
    expect(picture.groups.size).toBe(0);
    expect(picture).toEqual(deserialize(JSON.stringify(raw))!.nodes.get(id('ch1-n9'))!.work);
  });
});
