import { assertInvariants, groupId, unitId } from '../core';
import type { BenchState, Cell, Group, TraySlot, Unit } from '../core';
import { chapterId, nodeId } from '../content';
import type { Lang, NodeId } from '../content';
import type { NodeProgress, ProgressState } from './schema';

// Deterministic JSON: keys in a fixed order, sets and maps as sorted arrays, so
// two equal states always serialize to the same string.

type Json = Record<string, unknown>;

function sortedEntries<V>(map: ReadonlyMap<string, V>): ReadonlyArray<readonly [string, V]> {
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

function benchToJson(work: BenchState): Json {
  return {
    bounds: work.bounds,
    units: sortedEntries(work.units).map(([id, u]) => [id, u.hue]),
    tray: work.tray.map((s) => s.unitId),
    bench: sortedEntries(work.bench).map(([id, c]) => [id, c.x, c.y]),
    groups: sortedEntries(work.groups).map(([id, g]) => [id, g.unitIds, g.shape.map((c) => [c.x, c.y]), g.source]),
    home: sortedEntries(work.home),
  };
}

// Same mat, same pieces, same places: two snapshots that would be saved alike.
export function sameWork(a: BenchState | null | undefined, b: BenchState): boolean {
  return a === b || (a != null && JSON.stringify(benchToJson(a)) === JSON.stringify(benchToJson(b)));
}

export function serialize(state: ProgressState): string {
  const nodes = sortedEntries(state.nodes).map(([id, n]) => [
    id,
    {
      ref: {
        contentVersion: n.ref.contentVersion,
        chapterId: n.ref.chapterId,
        nodeId: n.ref.nodeId,
        attemptVariant: n.ref.attemptVariant,
        seed: n.ref.seed,
      },
      work: n.work === null ? null : benchToJson(n.work),
    },
  ]);
  return JSON.stringify({
    schemaVersion: state.schemaVersion,
    contentVersion: state.contentVersion,
    seed: state.seed,
    language: state.language,
    completedNodeIds: [...state.completedNodeIds].sort(),
    current: state.current,
    nodes,
    // A field of its own at the end (2026-10-15 review Q): an older build reads
    // the rest of the archive as before and only drops the album when it saves.
    album: sortedEntries(state.album).map(([id, work]) => [id, benchToJson(work)]),
    // Free play (2026-10-15 review O): added the same way, after the album.
    sandbox: state.sandbox === null ? null : benchToJson(state.sandbox),
  });
}

function isRecord(v: unknown): v is Json {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error('codec: expected a number');
  }
  return v;
}

function str(v: unknown): string {
  if (typeof v !== 'string') {
    throw new Error('codec: expected a string');
  }
  return v;
}

function arr(v: unknown): ReadonlyArray<unknown> {
  if (!Array.isArray(v)) {
    throw new Error('codec: expected an array');
  }
  return v;
}

function cellFrom(v: unknown): Cell {
  const [x, y] = arr(v);
  return { x: num(x), y: num(y) };
}

function benchFromJson(v: unknown): BenchState {
  if (!isRecord(v)) {
    throw new Error('codec: work must be an object');
  }
  const boundsJson = v['bounds'];
  if (!isRecord(boundsJson)) {
    throw new Error('codec: bounds must be an object');
  }
  const units = new Map(arr(v['units']).map((e) => {
    const [id, hue] = arr(e);
    const unit: Unit = { id: unitId(str(id)), hue: str(hue) };
    return [unit.id, unit] as const;
  }));
  const tray: TraySlot[] = arr(v['tray']).map((id, slot) => ({ slot, unitId: id === null ? null : unitId(str(id)) }));
  const bench = new Map(arr(v['bench']).map((e) => {
    const [id, x, y] = arr(e);
    return [unitId(str(id)), { x: num(x), y: num(y) }] as const;
  }));
  const groups = new Map(arr(v['groups']).map((e) => {
    const [id, unitIds, shape, source] = arr(e);
    const group: Group = {
      id: groupId(str(id)),
      unitIds: arr(unitIds).map((u) => unitId(str(u))),
      shape: arr(shape).map(cellFrom),
      source: arr(source).map((s) => groupId(str(s))),
    };
    return [group.id, group] as const;
  }));
  const home = new Map(arr(v['home']).map((e) => {
    const [id, slot] = arr(e);
    return [unitId(str(id)), num(slot)] as const;
  }));
  const work: BenchState = { units, tray, bench, groups, bounds: { cols: num(boundsJson['cols']), rows: num(boundsJson['rows']) }, home };
  assertInvariants(work);
  return work;
}

function refFromJson(v: unknown): NodeProgress['ref'] {
  if (!isRecord(v)) {
    throw new Error('codec: node must have a ref');
  }
  return {
    contentVersion: num(v['contentVersion']),
    chapterId: chapterId(str(v['chapterId'])),
    nodeId: nodeId(str(v['nodeId'])),
    attemptVariant: num(v['attemptVariant']),
    seed: num(v['seed']),
  };
}

export interface Decoded {
  readonly state: ProgressState;
  // What was dropped or defaulted to keep the rest, for the parent area and the backup.
  readonly repairs: ReadonlyArray<string>;
}

// The archive header (format, content version, seed) must be intact or nothing
// is trusted. Below it, damage stays local: a broken stop loses its saved work
// or its whole entry, a broken album picture is dropped on its own, so is a
// broken sandbox, a broken language falls back to Chinese, and every valid
// completion is kept. Shape only; whether refs fit the catalog (and the sandbox
// its material) is sanitize's job.
export function decodeArchive(json: string): Decoded | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isRecord(raw) || raw['schemaVersion'] !== 1) {
    return null;
  }
  const contentVersion = raw['contentVersion'];
  const seed = raw['seed'];
  if (typeof contentVersion !== 'number' || !Number.isFinite(contentVersion) || typeof seed !== 'number' || !Number.isFinite(seed)) {
    return null;
  }
  const repairs: string[] = [];
  const rawLanguage = raw['language'];
  const language: Lang = rawLanguage === 'zh' || rawLanguage === 'en' ? rawLanguage : 'zh';
  if (language !== rawLanguage) {
    repairs.push('language');
  }
  const rawCompleted = Array.isArray(raw['completedNodeIds']) ? (raw['completedNodeIds'] as ReadonlyArray<unknown>) : [];
  const completed = rawCompleted.filter((id): id is string => typeof id === 'string');
  if (!Array.isArray(raw['completedNodeIds']) || completed.length !== rawCompleted.length) {
    repairs.push('completed');
  }
  const rawCurrent = raw['current'];
  const current = typeof rawCurrent === 'string' ? nodeId(rawCurrent) : null;
  if (rawCurrent !== null && typeof rawCurrent !== 'string') {
    repairs.push('current');
  }
  const nodes = new Map<NodeId, NodeProgress>();
  const rawNodes = Array.isArray(raw['nodes']) ? (raw['nodes'] as ReadonlyArray<unknown>) : [];
  if (!Array.isArray(raw['nodes'])) {
    repairs.push('nodes');
  }
  rawNodes.forEach((entry, index) => {
    let id: NodeId;
    let node: unknown;
    let ref: NodeProgress['ref'];
    try {
      const [rawId, rawNode] = arr(entry);
      id = nodeId(str(rawId));
      node = rawNode;
      ref = refFromJson(isRecord(rawNode) ? rawNode['ref'] : undefined);
    } catch {
      repairs.push(`node#${index}`);
      return;
    }
    const rawWork = isRecord(node) ? node['work'] : undefined;
    let work: BenchState | null = null;
    if (rawWork !== null) {
      try {
        work = benchFromJson(rawWork);
      } catch {
        repairs.push(`work:${id}`);
      }
    }
    nodes.set(id, { ref, work });
  });
  // Archives from before the album have none; a broken picture loses only itself.
  const album = new Map<NodeId, BenchState>();
  const rawAlbum = raw['album'];
  if (rawAlbum !== undefined && !Array.isArray(rawAlbum)) {
    repairs.push('album');
  }
  (Array.isArray(rawAlbum) ? (rawAlbum as ReadonlyArray<unknown>) : []).forEach((entry, index) => {
    let id: NodeId;
    let rawWork: unknown;
    try {
      const [rawId, work] = arr(entry);
      id = nodeId(str(rawId));
      rawWork = work;
    } catch {
      repairs.push(`album#${index}`);
      return;
    }
    try {
      album.set(id, benchFromJson(rawWork));
    } catch {
      repairs.push(`album:${id}`);
    }
  });
  // Archives from before free play have none (null); a broken one is dropped on its own.
  let sandbox: BenchState | null = null;
  const rawSandbox = raw['sandbox'];
  if (rawSandbox !== undefined && rawSandbox !== null) {
    try {
      sandbox = benchFromJson(rawSandbox);
    } catch {
      repairs.push('sandbox');
    }
  }
  return {
    state: { schemaVersion: 1, contentVersion, seed, language, completedNodeIds: new Set(completed.map((id) => nodeId(id))), current, nodes, album, sandbox },
    repairs,
  };
}

// Anything without an intact header comes back as null; the caller starts fresh
// rather than crashing a child's session.
export function deserialize(json: string): ProgressState | null {
  return decodeArchive(json)?.state ?? null;
}
