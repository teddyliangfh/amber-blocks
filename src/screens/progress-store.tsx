import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { createInitialState, createSaver, loadArchive, reduce } from '../progress';
import type { NodeId } from '../content';
import type { LoadIssue, Loaded, ProgressCommand, ProgressResult, ProgressState, ProgressStorage, SaveResult, Saver } from '../progress';

// The one place the app touches storage. AsyncStorage falls back to
// localStorage on the web, so the same adapter serves both targets.
const defaultStorage: ProgressStorage = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

// The device seed is drawn once, outside the pure modules, and then saved.
function drawSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

// A read that never answers must not hold the child on a blank page.
export const LOAD_TIMEOUT_MS = 6000;

// How saving is going, for the parent area only. The child keeps playing in
// every case; 'memory' means this session's progress will not be kept.
export interface StorageHealth {
  readonly mode: 'loading' | 'saving' | 'memory';
  readonly issue: LoadIssue | 'read-timeout' | 'write-failed' | 'reset-failed' | null;
  // Stops whose unfinished work a content upgrade set aside at load.
  readonly upgraded?: ReadonlyArray<NodeId>;
}

interface ProgressContextValue {
  readonly state: ProgressState | null;
  readonly dispatch: (cmd: ProgressCommand) => ProgressResult<ProgressState>;
  readonly reset: () => Promise<void>;
  // Parent action, right after a reset: bring back what was cleared (Phase 20
  // Q10). False when there is nothing to bring back.
  readonly undoReset: () => boolean;
  readonly health: StorageHealth;
  // Parent action: read the archive again, e.g. after a private-mode or permission glitch.
  readonly retryLoad: () => Promise<void>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children, storage = defaultStorage }: { readonly children: ReactNode; readonly storage?: ProgressStorage }) {
  const [state, setState] = useState<ProgressState | null>(null);
  const [health, setHealth] = useState<StorageHealth>({ mode: 'loading', issue: null });
  const latest = useRef<ProgressState | null>(null);
  const persist = useRef(false);

  const onResult = useCallback((r: SaveResult) => {
    setHealth((h) => {
      if (!r.ok) {
        return { ...h, issue: 'write-failed' };
      }
      return h.issue === 'write-failed' || h.issue === 'reset-failed' ? { ...h, issue: null } : h;
    });
  }, []);
  const saver = useRef<Saver | null>(null);
  if (saver.current === null) {
    saver.current = createSaver(storage, onResult);
  }

  const adopt = useCallback((r: Loaded) => {
    latest.current = r.state;
    persist.current = r.persist;
    setState(r.state);
    setHealth({ mode: r.persist ? 'saving' : 'memory', issue: r.issue, upgraded: r.upgraded });
    // An upgraded or repaired archive is written back once, through the same
    // saver, as this build now reads it (2026-10-16 review K-1: it stayed on
    // the old version, was migrated again on every start, and the parents'
    // area kept reporting the same upgrade until the child changed something).
    // The original is already backed up by loadArchive.
    if (r.persist && (r.issue === 'upgraded' || r.issue === 'repaired')) {
      saver.current?.save(r.state);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      if (alive && latest.current === null) {
        adopt({ state: createInitialState(drawSeed()), issue: null, repairs: [], upgraded: [], persist: false });
        setHealth({ mode: 'memory', issue: 'read-timeout' });
      }
    }, LOAD_TIMEOUT_MS);
    loadArchive(storage, drawSeed())
      .catch((): Loaded => ({ state: createInitialState(drawSeed()), issue: 'read-failed', repairs: [], upgraded: [], persist: false }))
      .then((r) => {
        // A late answer after the timeout is ignored: the child is already playing.
        if (alive && latest.current === null) {
          adopt(r);
        }
      });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [storage, adopt]);

  // Synchronous against the latest state so consecutive dispatches compose.
  const dispatch = useCallback((cmd: ProgressCommand): ProgressResult<ProgressState> => {
    const current = latest.current;
    if (current === null) {
      return { ok: false, reason: 'not-entered' };
    }
    const r = reduce(current, cmd);
    if (r.ok && r.value !== current) {
      latest.current = r.value;
      setState(r.value);
      if (persist.current) {
        saver.current?.save(r.value);
      }
    }
    return r;
  }, []);

  // What the last reset cleared, until it is brought back or the app closes.
  const cleared = useRef<ProgressState | null>(null);
  const reset = useCallback(async () => {
    // Progress starts over; the parent's language choice stays (2026-10-16 review L-3).
    cleared.current = latest.current;
    const fresh = { ...createInitialState(drawSeed()), language: latest.current?.language ?? 'zh' };
    latest.current = fresh;
    setState(fresh);
    // Nothing is left of the stops an upgrade restarted.
    setHealth((h) => ({ ...h, upgraded: [] }));
    if (!persist.current || saver.current === null) {
      return;
    }
    const r = await saver.current.reset(fresh);
    if (!r.ok) {
      setHealth((h) => ({ ...h, issue: 'reset-failed' }));
    }
  }, []);

  const undoReset = useCallback((): boolean => {
    const back = cleared.current;
    if (back === null) {
      return false;
    }
    cleared.current = null;
    latest.current = back;
    setState(back);
    if (persist.current) {
      saver.current?.save(back);
    }
    return true;
  }, []);

  const retryLoad = useCallback(async () => {
    const r = await loadArchive(storage, drawSeed());
    if (r.persist) {
      adopt(r);
    } else {
      setHealth({ mode: 'memory', issue: r.issue });
    }
  }, [storage, adopt]);

  const value = useMemo(() => ({ state, dispatch, reset, undoReset, health, retryLoad }), [state, dispatch, reset, undoReset, health, retryLoad]);
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const ctx = useContext(ProgressContext);
  if (ctx === null) {
    throw new Error('useProgress must be used inside ProgressProvider');
  }
  return ctx;
}
