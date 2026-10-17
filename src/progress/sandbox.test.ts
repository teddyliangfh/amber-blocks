import { apply, cell, groupId } from '../core';
import type { BenchState, Command } from '../core';
import { CONTENT_VERSION, materialize, nodeId, sandboxMaterial } from '../content';
import type { NodeId } from '../content';
import { decodeArchive, deserialize, serialize } from './codec';
import { createInitialState, migrate } from './migrate';
import { reduce } from './reducer';
import type { ProgressCommand } from './reducer';
import { sanitize } from './sanitize';
import type { ProgressState } from './schema';
import { BACKUP_KEY, STORAGE_KEY, loadArchive, memoryStorage } from './store';
import { defaultCurrent, statusOf } from './unlock';
// Frozen archives from before free play (see upgrade.test.ts). Never regenerate.
import ch1Finished from './__fixtures__/archive-v1-phase11-ch1-finished.json';
import n10Unfinished from './__fixtures__/archive-v1-phase11-n10-unfinished.json';

// Free play (2026-10-15 review O): the sandbox mat is kept as the child left
// it, as one optional field of schema 1 (the album's way, D-047).

const ok = { matched: true, benchCount: 1, reason: 'matched' } as const;
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

const box = sandboxMaterial();
const [a, b, c] = [...box.units.keys()];
// A 2 and a 1 apart, as a child leaves it.
const built = play(box, [
  { type: 'take', unitId: a!, to: cell(1, 1) },
  { type: 'take', unitId: b!, to: cell(2, 1) },
  { type: 'take', unitId: c!, to: cell(4, 3) },
]);

// Two stops finished (one with its picture), a third entered, then free play.
function played(): ProgressState {
  const s = run(createInitialState(9), [{ type: 'enter', nodeId: id('ch1-n1') }]);
  const p = materialize(s.nodes.get(id('ch1-n1'))!.ref);
  const work = play(p.initial, p.solution);
  return run(s, [
    { type: 'complete', nodeId: id('ch1-n1'), verdict: ok, work },
    { type: 'enter', nodeId: id('ch1-n2') },
    { type: 'complete', nodeId: id('ch1-n2'), verdict: ok },
    { type: 'enter', nodeId: id('ch1-n3') },
    { type: 'saveSandbox', work: built },
  ]);
}

describe('sandbox: what the reducer keeps', () => {
  test('a fresh progress has no sandbox; saving one needs no stop and changes nothing else', () => {
    const fresh = createInitialState(9);
    expect(fresh.sandbox).toBeNull();
    const s = run(fresh, [{ type: 'saveSandbox', work: built }]);
    expect(s.sandbox).toBe(built);
    expect({ ...s, sandbox: null }).toEqual(fresh);
    expect(s.current).toBeNull();
    expect(defaultCurrent(s)).toBe('ch1-n1');
  });

  test('free play never counts as a completion, unlocks nothing and never moves current', () => {
    const before = run(played(), [{ type: 'saveSandbox', work: box }]);
    const after = run(before, [{ type: 'saveSandbox', work: built }]);
    expect(after.completedNodeIds).toBe(before.completedNodeIds);
    expect(after.current).toBe(before.current);
    expect(after.current).toBe('ch1-n3');
    expect(after.nodes).toBe(before.nodes);
    expect(after.album).toBe(before.album);
    expect(statusOf(after, id('ch1-n4'))).toBe('locked');
    // All ten out on the mat is still only a sandbox.
    const all = play(box, [...box.units.keys()].map((u, i) => ({ type: 'take', unitId: u, to: cell(i % 5, Math.floor(i / 5)) }) as const));
    const ten = run(after, [{ type: 'saveSandbox', work: all }]);
    expect(ten.completedNodeIds).toBe(before.completedNodeIds);
  });

  test('the same mat again, even as a copy read back from storage, is no change (nothing to write)', () => {
    const s = played();
    const copy = deserialize(serialize(s))!.sandbox!;
    expect(copy).not.toBe(built);
    const again = reduce(s, { type: 'saveSandbox', work: copy });
    expect(again.ok && again.value).toBe(s);
  });

  test('every other command keeps it; only resetting the progress (a fresh state) clears it', () => {
    let s = played();
    const p = materialize(s.nodes.get(id('ch1-n3'))!.ref);
    const steps: ReadonlyArray<ProgressCommand> = [
      { type: 'saveWork', nodeId: id('ch1-n3'), work: p.initial },
      { type: 'complete', nodeId: id('ch1-n3'), verdict: ok, work: play(p.initial, p.solution) },
      { type: 'replay', nodeId: id('ch1-n3') },
      { type: 'newVariant', nodeId: id('ch1-n3') },
      { type: 'resetNode', nodeId: id('ch1-n3') },
      { type: 'enter', nodeId: id('ch1-n4') },
      { type: 'setLanguage', language: 'en' },
      { type: 'startAt', nodeId: id('ch2-n1') },
    ];
    for (const cmd of steps) {
      s = run(s, [cmd]);
      expect([cmd.type, s.sandbox]).toEqual([cmd.type, built]);
    }
    expect(createInitialState(9).sandbox).toBeNull();
  });
});

describe('sandbox: archive format', () => {
  test('round-trips deterministically, as the last field; none is null; an empty mat (all put back) round-trips too', () => {
    const s = played();
    const json = serialize(s);
    const back = deserialize(json)!;
    expect(back).toEqual(s);
    expect(serialize(back)).toBe(json);
    expect(Object.keys(JSON.parse(json) as object).slice(-2)).toEqual(['album', 'sandbox']);
    const none = createInitialState(9);
    expect((JSON.parse(serialize(none)) as { sandbox: unknown }).sandbox).toBeNull();
    expect(deserialize(serialize(none))).toEqual(none);
    const tidy = run(s, [{ type: 'saveSandbox', work: box }]);
    expect(deserialize(serialize(tidy))!.sandbox).toEqual(box);
  });

  test('purely additive: still schema 1, and the rest of the archive reads the same without it (what an older build sees)', () => {
    const s = played();
    const json = JSON.parse(serialize(s)) as Record<string, unknown>;
    expect(json['schemaVersion']).toBe(1);
    const { sandbox: _sandbox, ...older } = json;
    const decoded = decodeArchive(JSON.stringify(older))!;
    expect(decoded.repairs).toEqual([]);
    expect(decoded.state).toEqual({ ...s, sandbox: null });
    // An older build reads by key and passes over a field it does not know:
    // the same reader with one more unknown field reads everything else alike.
    const later = decodeArchive(JSON.stringify({ ...json, somethingNewer: { x: 1 } }))!;
    expect(later.repairs).toEqual([]);
    expect(later.state).toEqual(s);
  });

  test('the frozen archives from before free play load with no sandbox and nothing to repair because of it', async () => {
    for (const fixture of [ch1Finished, n10Unfinished]) {
      const raw = JSON.stringify(fixture);
      expect(raw).not.toContain('"sandbox"');
      const decoded = decodeArchive(raw)!;
      expect(decoded.state.sandbox).toBeNull();
      expect(decoded.repairs).toEqual([]);
      const r = await loadArchive(memoryStorage({ [STORAGE_KEY]: raw }), 1);
      expect(r.state.sandbox).toBeNull();
      expect(r.repairs).toEqual([]);
      expect(r.issue).toBe('upgraded');
      // And free play on top of one does not touch what it kept.
      const after = run(r.state, [{ type: 'saveSandbox', work: built }]);
      expect(after.completedNodeIds).toBe(r.state.completedNodeIds);
      expect(after.current).toBe(r.state.current);
    }
  });

  test('a broken sandbox is dropped on its own, listed as a repair; completions, stops and the album stay', async () => {
    const s = played();
    type Json = { sandbox: unknown };
    const damaged = (mutate: (j: Json) => void) => {
      const j = JSON.parse(serialize(s)) as Json;
      mutate(j);
      return JSON.stringify(j);
    };
    const cases: ReadonlyArray<readonly [string, (j: Json) => void]> = [
      ['not an object', (j) => (j.sandbox = 'mat')],
      ['a list', (j) => (j.sandbox = [1, 2])],
      ['a block in two places', (j) => (j.sandbox as { bench: unknown[] }).bench.push([(j.sandbox as { tray: (string | null)[] }).tray.find((t) => t !== null), 0, 0])],
      ['two blocks in one cell', (j) => ((j.sandbox as { bench: [string, number, number][] }).bench[0]![1] = 2)],
      ['a block off the mat', (j) => ((j.sandbox as { bench: [string, number, number][] }).bench[0]![1] = 6)],
      ['no bounds', (j) => delete (j.sandbox as { bounds?: unknown }).bounds],
    ];
    for (const [name, mutate] of cases) {
      const raw = damaged(mutate);
      const d = decodeArchive(raw)!;
      expect([name, d.repairs]).toEqual([name, ['sandbox']]);
      expect(d.state.sandbox).toBeNull();
      expect(d.state.completedNodeIds).toEqual(s.completedNodeIds);
      expect(d.state.nodes).toEqual(s.nodes);
      expect(d.state.album).toEqual(s.album);
      expect(d.state.current).toBe(s.current);
      const storage = memoryStorage({ [STORAGE_KEY]: raw });
      const r = await loadArchive(storage, 1);
      expect(r.issue).toBe('repaired');
      expect(r.state.sandbox).toBeNull();
      expect(r.state.completedNodeIds).toEqual(s.completedNodeIds);
      expect(await storage.getItem(BACKUP_KEY)).toBe(raw);
    }
  });
});

describe('sandbox: sanitize and content upgrades', () => {
  test('the sandbox\'s own material is kept as it is, empty or built; anything else is dropped as damage', () => {
    const s = played();
    expect(sanitize(s).state).toBe(s);
    const empty = run(s, [{ type: 'saveSandbox', work: box }]);
    expect(sanitize(empty).repairs).toEqual([]);
    const level = materialize(s.nodes.get(id('ch1-n3'))!.ref).initial;
    const wrong: ReadonlyArray<readonly [string, BenchState]> = [
      ['a stop\'s material', level],
      ['another mat size', { ...built, bounds: { cols: 7, rows: 5 } }],
      ['another colour', { ...built, units: new Map([...built.units].map(([u, unit]) => [u, { ...unit, hue: 'n3' }])) }],
      ['a partner', { ...built, groups: new Map([[groupId('g'), { id: groupId('g'), unitIds: [a!, b!], shape: [cell(0, 0), cell(1, 0)], source: [] }]]) }],
      ['a block in two places', { ...built, tray: built.tray.map((t, i) => (i === 9 ? { ...t, unitId: a! } : t)) }],
    ];
    for (const [name, sandbox] of wrong) {
      const r = sanitize({ ...s, sandbox });
      expect([name, r.repairs]).toEqual([name, ['sandbox']]);
      expect(r.state.sandbox).toBeNull();
      expect(r.state.completedNodeIds).toEqual(s.completedNodeIds);
      expect(r.state.current).toBe(s.current);
      expect(r.state.nodes).toEqual(s.nodes);
      expect(r.state.album).toEqual(s.album);
    }
  });

  test('migrate keeps it exactly as it was: a known upgrade, and an archive from a newer build', () => {
    const s = played();
    const relabel = (v: number): ProgressState => ({ ...s, contentVersion: v, nodes: new Map([...s.nodes].map(([k, n]) => [k, { ...n, ref: { ...n.ref, contentVersion: v } }])) });
    expect(migrate(relabel(CONTENT_VERSION - 1), CONTENT_VERSION, undefined, { [CONTENT_VERSION]: [id('ch1-n3')] }).state.sandbox).toBe(built);
    const newer = migrate(relabel(CONTENT_VERSION + 1), CONTENT_VERSION);
    expect(newer.state.nodes.size).toBe(0);
    expect(newer.state.sandbox).toBe(built);
  });
});
