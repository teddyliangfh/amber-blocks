import { decodeArchive, serialize } from './codec';
import { createInitialState, migrate } from './migrate';
import { sanitize } from './sanitize';
import type { NodeId } from '../content';
import type { ProgressStorage, ProgressState } from './schema';

export const STORAGE_KEY = 'amber-blocks/progress';
export const BACKUP_KEY = 'amber-blocks/progress.corrupt';
// The archive as it was before a content upgrade set unfinished work aside, so
// that work is never destroyed outright.
export const UPGRADE_BACKUP_KEY = 'amber-blocks/progress.before-upgrade';
// The archive as it was before a parent cleared it (Phase 20, play review Q10:
// clearing took the album with it and left nothing to go back to).
export const RESET_BACKUP_KEY = 'amber-blocks/progress.before-reset';

export function memoryStorage(initial: Readonly<Record<string, string>> = {}): ProgressStorage {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key) => Promise.resolve(items.get(key) ?? null),
    setItem: (key, value) => {
      items.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key) => {
      items.delete(key);
      return Promise.resolve();
    },
  };
}

// What loading found, for the parent area. The child never sees it.
//   read-failed: storage threw; play continues in memory and nothing is written,
//                so a passing glitch cannot overwrite a good archive.
//   corrupt:     the archive was unreadable; it was backed up and play starts fresh.
//   repaired:    some stops were dropped or lost their work; the rest is kept.
//   upgraded:    the puzzles changed since the archive was saved and some
//                stops' unfinished work was set aside (listed in `upgraded`);
//                every completion is kept. Expected, not damage.
export type LoadIssue = 'read-failed' | 'corrupt' | 'repaired' | 'upgraded';

export interface Loaded {
  readonly state: ProgressState;
  readonly issue: LoadIssue | null;
  readonly repairs: ReadonlyArray<string>;
  // Stops whose unfinished work a content upgrade set aside.
  readonly upgraded: ReadonlyArray<NodeId>;
  // False when writing could destroy an archive that was never read.
  readonly persist: boolean;
}

async function backup(storage: ProgressStorage, raw: string, key: string = BACKUP_KEY): Promise<void> {
  try {
    await storage.setItem(key, raw);
  } catch {
    // A failed backup must not stop the child from playing.
  }
}

export async function loadArchive(storage: ProgressStorage, seed: number): Promise<Loaded> {
  let raw: string | null;
  try {
    raw = await storage.getItem(STORAGE_KEY);
  } catch {
    return { state: createInitialState(seed), issue: 'read-failed', repairs: [], upgraded: [], persist: false };
  }
  if (raw === null) {
    return { state: createInitialState(seed), issue: null, repairs: [], upgraded: [], persist: true };
  }
  const decoded = decodeArchive(raw);
  if (decoded === null) {
    await backup(storage, raw);
    return { state: createInitialState(seed), issue: 'corrupt', repairs: [], upgraded: [], persist: true };
  }
  const migrated = migrate(decoded.state);
  const checked = sanitize(migrated.state);
  const repairs = [...decoded.repairs, ...checked.repairs];
  if (repairs.length > 0) {
    await backup(storage, raw);
  }
  if (migrated.setAside.length > 0) {
    await backup(storage, raw, UPGRADE_BACKUP_KEY);
  }
  const issue = repairs.length > 0 ? 'repaired' : migrated.setAside.length > 0 ? 'upgraded' : null;
  return { state: checked.state, issue, repairs, upgraded: migrated.setAside, persist: true };
}

// Missing archive: start fresh. Corrupt archive: keep the bytes for inspection,
// then start fresh. Good archive: migrate to the running content version stop
// by stop, then drop whatever is damaged. Never rejects.
export async function load(storage: ProgressStorage, seed: number): Promise<ProgressState> {
  return (await loadArchive(storage, seed)).state;
}

export async function save(storage: ProgressStorage, state: ProgressState): Promise<void> {
  await storage.setItem(STORAGE_KEY, serialize(state));
}

export type SaveResult = { readonly ok: true } | { readonly ok: false; readonly error: unknown };

export interface Saver {
  // Queue the latest state. Never rejects; only the newest pending state is written.
  readonly save: (state: ProgressState) => void;
  // Clear the archive and write `fresh` after anything already in flight, and
  // drop queued writes of older states so they cannot land afterwards. The
  // archive as stored is first copied to RESET_BACKUP_KEY.
  readonly reset: (fresh: ProgressState) => Promise<SaveResult>;
  // Resolves once every queued operation has finished.
  readonly idle: () => Promise<void>;
}

type Op = { readonly kind: 'write' } | { readonly kind: 'reset'; readonly fresh: ProgressState; readonly done: (r: SaveResult) => void };

// One writer, strictly in order. Consecutive saves collapse into one write of
// the newest state, so an older state can never be written after a newer one.
export function createSaver(storage: ProgressStorage, onResult: (r: SaveResult) => void = () => undefined): Saver {
  let pending: ProgressState | null = null;
  const queue: Op[] = [];
  let running: Promise<void> | null = null;

  const runOp = async (op: Op): Promise<void> => {
    if (op.kind === 'write') {
      const state = pending;
      pending = null;
      if (state === null) {
        return;
      }
      try {
        await save(storage, state);
        onResult({ ok: true });
      } catch (error) {
        onResult({ ok: false, error });
      }
      return;
    }
    let result: SaveResult = { ok: true };
    try {
      const before = await storage.getItem(STORAGE_KEY);
      if (before !== null) {
        await backup(storage, before, RESET_BACKUP_KEY);
      }
      await storage.removeItem(STORAGE_KEY);
      await save(storage, op.fresh);
    } catch (error) {
      result = { ok: false, error };
    }
    onResult(result);
    op.done(result);
  };

  const drain = (): Promise<void> => {
    if (running === null) {
      running = (async () => {
        for (let op = queue.shift(); op !== undefined; op = queue.shift()) {
          await runOp(op);
        }
        running = null;
      })();
    }
    return running;
  };

  return {
    save: (state) => {
      pending = state;
      if (queue[queue.length - 1]?.kind !== 'write') {
        queue.push({ kind: 'write' });
      }
      void drain();
    },
    reset: (fresh) =>
      new Promise<SaveResult>((done) => {
        pending = null;
        for (let i = queue.length - 1; i >= 0; i -= 1) {
          if (queue[i]?.kind === 'write') {
            queue.splice(i, 1);
          }
        }
        queue.push({ kind: 'reset', fresh, done });
        void drain();
      }),
    idle: async () => {
      while (running !== null) {
        await running;
      }
    },
  };
}
