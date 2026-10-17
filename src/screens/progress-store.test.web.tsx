/**
 * Rendered in jsdom with react-native-web: the provider as the screens use it.
 */
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Text } from 'react-native';

import { CONTENT_VERSION, nodeId } from '../content';
import { BACKUP_KEY, STORAGE_KEY, UPGRADE_BACKUP_KEY, createInitialState, deserialize, memoryStorage, serialize } from '../progress';
import v1Finished from '../progress/__fixtures__/archive-v1-phase11-ch1-finished.json';
import type { ProgressStorage } from '../progress';
import { LOAD_TIMEOUT_MS, ProgressProvider, useProgress } from './progress-store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let api: ReturnType<typeof useProgress> | null = null;

function Probe() {
  const value = useProgress();
  // Hand the context to the test after commit, not during render.
  useEffect(() => {
    api = value;
  });
  return <Text testID="probe">{value.state === null ? 'loading' : `${value.health.mode}:${value.health.issue ?? 'ok'}:${value.state.completedNodeIds.size}`}</Text>;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  api = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function mount(storage: ProgressStorage) {
  await act(async () => {
    root.render(
      <ProgressProvider storage={storage}>
        <Probe />
      </ProgressProvider>,
    );
  });
  // Let the load promise settle.
  await act(async () => {
    await Promise.resolve();
  });
}

function shown(): string {
  return container.textContent ?? '';
}

describe('ProgressProvider (review P2: storage failures)', () => {
  test('a read that rejects leaves a playable game in memory mode, never a blank page', async () => {
    const writes: string[] = [];
    const storage: ProgressStorage = {
      getItem: () => Promise.reject(new Error('SecurityError')),
      setItem: (_k, v) => {
        writes.push(v);
        return Promise.resolve();
      },
      removeItem: () => Promise.resolve(),
    };
    await mount(storage);
    expect(shown()).toBe('memory:read-failed:0');
    // Playing works, and nothing is written over an archive that was never read.
    await act(async () => {
      expect(api!.dispatch({ type: 'enter', nodeId: nodeId('ch1-n1') }).ok).toBe(true);
    });
    expect(api!.state!.nodes.size).toBe(1);
    expect(writes).toEqual([]);
  });

  test('a read that never answers falls back to memory mode after the timeout', async () => {
    jest.useFakeTimers();
    try {
      await mount({ ...memoryStorage(), getItem: () => new Promise<string | null>(() => undefined) });
      expect(shown()).toBe('loading');
      await act(async () => {
        jest.advanceTimersByTime(LOAD_TIMEOUT_MS + 1);
      });
      expect(shown()).toBe('memory:read-timeout:0');
    } finally {
      jest.useRealTimers();
    }
  });

  test('write failures are reported to the parent area and never reject; the next write recovers', async () => {
    let fail = true;
    const items = new Map<string, string>();
    const rejections: unknown[] = [];
    const onRejection = (e: PromiseRejectionEvent) => rejections.push(e.reason);
    window.addEventListener('unhandledrejection', onRejection);
    const storage: ProgressStorage = {
      getItem: (k) => Promise.resolve(items.get(k) ?? null),
      setItem: (k, v) => {
        if (fail) {
          return Promise.reject(new Error('QuotaExceededError'));
        }
        items.set(k, v);
        return Promise.resolve();
      },
      removeItem: (k) => {
        items.delete(k);
        return Promise.resolve();
      },
    };
    await mount(storage);
    await act(async () => {
      api!.dispatch({ type: 'enter', nodeId: nodeId('ch1-n1') });
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(shown()).toBe('saving:write-failed:0');
    fail = false;
    await act(async () => {
      api!.dispatch({ type: 'setLanguage', language: 'en' });
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(shown()).toBe('saving:ok:0');
    expect(deserialize(items.get(STORAGE_KEY)!)?.language).toBe('en');
    window.removeEventListener('unhandledrejection', onRejection);
    expect(rejections).toEqual([]);
  });

  test('review K-1: an upgraded archive is written back once at load, so the next start reads it as it is (no second upgrade)', async () => {
    const raw = JSON.stringify(v1Finished);
    const storage = memoryStorage({ [STORAGE_KEY]: raw });
    await mount(storage);
    expect(shown()).toBe(`saving:upgraded:${v1Finished.completedNodeIds.length}`);
    expect(api!.health.upgraded?.length).toBeGreaterThan(0);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    // Nothing touched, yet the archive is on this build's version; the original is the backup.
    const stored = await storage.getItem(STORAGE_KEY);
    expect(JSON.parse(stored!).contentVersion).toBe(CONTENT_VERSION);
    expect(deserialize(stored!)?.completedNodeIds.size).toBe(v1Finished.completedNodeIds.length);
    expect(await storage.getItem(UPGRADE_BACKUP_KEY)).toBe(raw);
    act(() => root.unmount());
    root = createRoot(container);
    await mount(storage);
    expect(shown()).toBe(`saving:ok:${v1Finished.completedNodeIds.length}`);
    expect(api!.health.upgraded).toEqual([]);
  });

  test('a repaired archive is written back once too: the repair is not reported again on the next start', async () => {
    const good = { ...createInitialState(3), completedNodeIds: new Set([nodeId('ch1-n1')]) };
    const damaged = JSON.parse(serialize(good));
    damaged.album = 'not a list';
    const raw = JSON.stringify(damaged);
    const storage = memoryStorage({ [STORAGE_KEY]: raw });
    await mount(storage);
    expect(shown()).toBe('saving:repaired:1');
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(await storage.getItem(BACKUP_KEY)).toBe(raw);
    act(() => root.unmount());
    root = createRoot(container);
    await mount(storage);
    expect(shown()).toBe('saving:ok:1');
  });

  test('a clean archive is not rewritten at load', async () => {
    const raw = serialize({ ...createInitialState(3), completedNodeIds: new Set([nodeId('ch1-n1')]) });
    const writes: string[] = [];
    const base = memoryStorage({ [STORAGE_KEY]: raw });
    await mount({ ...base, setItem: (k, v) => { writes.push(k); return base.setItem(k, v); } });
    await act(async () => {
      await Promise.resolve();
    });
    expect(shown()).toBe('saving:ok:1');
    expect(writes).toEqual([]);
  });

  test('reset while an old write is still in flight: the old progress does not come back', async () => {
    const items = new Map<string, string>();
    const pending: (() => void)[] = [];
    const storage: ProgressStorage = {
      getItem: (k) => Promise.resolve(items.get(k) ?? null),
      // Every write waits until the test releases it, like a slow native adapter.
      setItem: (k, v) =>
        new Promise<void>((resolve) => {
          pending.push(() => {
            items.set(k, v);
            resolve();
          });
        }),
      removeItem: (k) => {
        items.delete(k);
        return Promise.resolve();
      },
    };
    const saved = createInitialState(3);
    const withDone = { ...saved, completedNodeIds: new Set([nodeId('ch1-n1')]) };
    items.set(STORAGE_KEY, serialize(withDone));
    await mount(storage);
    expect(shown()).toBe('saving:ok:1');
    await act(async () => {
      api!.dispatch({ type: 'enter', nodeId: nodeId('ch1-n2') });
    });
    let resetDone = false;
    await act(async () => {
      void api!.reset().then(() => {
        resetDone = true;
      });
    });
    // Release the newest pending write first, as a reordering adapter might.
    // The saver never has two writes in flight, so order cannot be inverted.
    let mostInFlight = 0;
    for (let i = 0; i < 10 && pending.length > 0; i += 1) {
      mostInFlight = Math.max(mostInFlight, pending.length);
      await act(async () => {
        pending.pop()!();
        await Promise.resolve();
        await Promise.resolve();
      });
    }
    expect(mostInFlight).toBe(1);
    expect(resetDone).toBe(true);
    const stored = deserialize(items.get(STORAGE_KEY)!);
    expect(stored?.completedNodeIds.size).toBe(0);
    expect(stored?.nodes.size).toBe(0);
    expect(shown()).toBe('saving:ok:0');
  });
});
