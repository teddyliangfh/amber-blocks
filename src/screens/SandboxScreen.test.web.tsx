/**
 * Free play (2026-10-15 review O) with the real progress provider and the real
 * stage in jsdom. The stage is wrapped only to hand its props to the test, so
 * a finished drag or a counting tap commits exactly what the gesture would.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { StageProps } from '../blocks-ui';
import { cell } from '../core';
import { nodeId, sandboxMaterial } from '../content';
import { STORAGE_KEY, createInitialState, deserialize, memoryStorage, reduce, serialize } from '../progress';
import type { ProgressState, ProgressStorage } from '../progress';
import ch1Finished from '../progress/__fixtures__/archive-v1-phase11-ch1-finished.json';
import { ProgressProvider } from './progress-store';
import { SandboxScreen } from './SandboxScreen';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}) }));
const mockSaid: string[] = [];
jest.mock('./voice', () => {
  const { format } = jest.requireActual('../content');
  return {
    say: (lang: 'zh' | 'en', key: string, params: Record<string, string | number> = {}) => mockSaid.push(format(key, lang, params)),
    voice: { say: () => undefined, stop: () => undefined, isSupported: () => false },
  };
});
const mockSounds: string[] = [];
jest.mock('./sound', () => ({ play: (name: string, step?: number) => mockSounds.push(step === undefined ? name : `${name}:${step}`), setSoundMuted: () => undefined, sfx: { isMuted: () => false } }));
// The real stage, with its latest props kept for the test.
const mockStage: { current: StageProps | null } = { current: null };
jest.mock('../blocks-ui', () => {
  const actual = jest.requireActual('../blocks-ui');
  const { createElement } = jest.requireActual('react');
  return {
    ...actual,
    Stage: (props: StageProps) => {
      mockStage.current = props;
      return createElement(actual.Stage, props);
    },
  };
});

let container: HTMLDivElement;
let root: Root;
const sizes = ['offsetWidth', 'offsetHeight'] as const;
const real = Object.fromEntries(sizes.map((k) => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)]));

beforeEach(() => {
  jest.useFakeTimers();
  mockSaid.length = 0;
  mockSounds.length = 0;
  mockStage.current = null;
  mockRouter.dismissTo.mockClear();
  // jsdom lays nothing out: give the stage a phone's room so it draws.
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 390 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 672 });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  for (const k of sizes) {
    Object.defineProperty(HTMLElement.prototype, k, real[k]!);
  }
  jest.useRealTimers();
});

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

// Storage that counts writes of the archive.
function counted(initial: Readonly<Record<string, string>> = {}): ProgressStorage & { writes: () => number } {
  const inner = memoryStorage(initial);
  let n = 0;
  return {
    ...inner,
    setItem: (key, value) => {
      if (key === STORAGE_KEY) {
        n += 1;
      }
      return inner.setItem(key, value);
    },
    writes: () => n,
  };
}

async function flush() {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });
  }
}

async function open(storage: ProgressStorage) {
  await act(async () => {
    root.render(
      <GestureHandlerRootView>
        <SafeAreaProvider initialMetrics={metrics}>
          <ProgressProvider storage={storage}>
            <SandboxScreen />
          </ProgressProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>,
    );
  });
  await flush();
}

const q = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
// Put-away and undo are dimmed (and take no touch) when there is nothing for them to do.
const dimmed = (id: string) => getComputedStyle(q(`${id}-wrap`)!).opacity === '0.4';
const all = (id: string) => [...container.querySelectorAll(`[data-testid="${id}"]`)] as HTMLElement[];
const box = sandboxMaterial();
const ids = [...box.units.keys()];

async function drag(cmd: Parameters<StageProps['onCommand']>[0]): Promise<boolean> {
  let ok = false;
  await act(async () => {
    ok = mockStage.current!.onCommand(cmd);
  });
  await flush();
  return ok;
}

async function tap(unit: string) {
  await act(async () => mockStage.current!.onTapUnit(unit as never));
  await flush();
}

async function press(id: string) {
  await act(async () => q(id)!.click());
  await flush();
}

async function saved(storage: ProgressStorage): Promise<ProgressState> {
  return deserialize((await storage.getItem(STORAGE_KEY))!)!;
}

// Three in a row along the top.
async function buildRow() {
  for (const [i, u] of ids.slice(0, 3).entries()) {
    expect(await drag({ type: 'take', unitId: u, to: cell(i, 0) })).toBe(true);
  }
}

describe('free play page (2026-10-15 review O)', () => {
  test('a fresh box: ten dozing blocks in the tray, an empty 6 × 5 mat, no question, nothing said or played', async () => {
    await open(memoryStorage());
    expect(q('sandbox-screen')).not.toBeNull();
    expect(q('sandbox-sign')!.textContent).toBe('自由玩');
    expect(q('tray')).not.toBeNull();
    expect(q('bench')).not.toBeNull();
    expect(all('block')).toHaveLength(10);
    expect(all('face-sleepy')).toHaveLength(10);
    expect(mockStage.current!.state.bench.size).toBe(0);
    expect(mockStage.current!.state.bounds).toEqual({ cols: 6, rows: 5 });
    // Nothing to answer: no number to make, no card, no way on.
    for (const id of ['prompt', 'next', 'again', 'feedback', 'confetti', 'count-chip', 'recount', 'menu']) {
      expect([id, q(id)]).toEqual([id, null]);
    }
    expect(mockStage.current!.matched).toBe(false);
    expect(mockStage.current!.celebrateTick).toBe(0);
    // Nothing on the mat: nothing to put back or undo yet.
    expect(dimmed('sandbox-tidy')).toBe(true);
    expect(dimmed('sandbox-undo')).toBe(true);
    expect(mockSaid).toEqual([]);
    expect(mockSounds).toEqual([]);
    // Phase 20 Q11: a block tapped in the box says "one"; nothing moves.
    await act(async () => mockStage.current!.onTapTray!(1));
    expect(mockSaid).toEqual(['一']);
    expect(mockStage.current!.state.bench.size).toBe(0);
  });

  test('three in a row are one 3 with one face; pulled apart they are a 2 and a 1; never a verdict, never a right or wrong sound', async () => {
    const storage = counted();
    await open(storage);
    await buildRow();
    expect(all('face-calm')).toHaveLength(1);
    expect(all('face-sleepy')).toHaveLength(7);
    expect((await saved(storage)).sandbox!.bench.size).toBe(3);
    expect(await drag({ type: 'move', unitId: ids[2]!, to: cell(4, 3) })).toBe(true);
    expect(all('face-calm')).toHaveLength(2);
    // A cell that is taken shows no snap preview and bounces; nothing is committed or written.
    expect(mockStage.current!.onPreview({ type: 'take', unitId: ids[3]!, to: cell(0, 0) })).toBe(false);
    expect(mockStage.current!.onPreview({ type: 'take', unitId: ids[3]!, to: cell(5, 4) })).toBe(true);
    const writes = storage.writes();
    expect(await drag({ type: 'take', unitId: ids[3]!, to: cell(0, 0) })).toBe(false);
    expect(storage.writes()).toBe(writes);
    expect(mockStage.current!.matched).toBe(false);
    expect(mockStage.current!.celebrateTick).toBe(0);
    expect(mockStage.current!.mood).toBe('calm');
    expect(q('confetti')).toBeNull();
    expect(q('next')).toBeNull();
    expect(mockSounds.filter((s) => ['success', 'fanfare', 'adjust', 'arrive'].includes(s))).toEqual([]);
    expect(mockSaid).toEqual([]);
  });

  test('one write per change: each drag, the put-away and the undo write the archive once', async () => {
    const storage = counted();
    await open(storage);
    const start = storage.writes();
    await drag({ type: 'take', unitId: ids[0]!, to: cell(0, 0) });
    expect(storage.writes()).toBe(start + 1);
    await drag({ type: 'take', unitId: ids[1]!, to: cell(1, 0) });
    expect(storage.writes()).toBe(start + 2);
    await press('sandbox-tidy');
    expect(storage.writes()).toBe(start + 3);
    await press('sandbox-undo');
    expect(storage.writes()).toBe(start + 4);
  });

  test('counting says the numbers and the total once, the only speech; a recount starts over; a change voids the count', async () => {
    await open(memoryStorage());
    await buildRow();
    await tap(ids[0]!);
    expect(q('count-chip')!.textContent).toBe('1');
    await tap(ids[0]!);
    await tap(ids[1]!);
    await tap(ids[2]!);
    expect(mockSaid).toEqual(['一', '二', '三', '一共 3 块']);
    // Phase 20 F6: building the row joined its groups, each time with the join sound.
    expect(mockSounds.filter((x) => x.startsWith('join'))).toEqual(['join:1', 'join:2', 'join:3']);
    expect(mockSounds.filter((x) => !x.startsWith('join'))).toEqual(['count:1', 'count:2', 'counted:3']);
    expect(q('count-chip')).toBeNull();
    expect(q('recount')).not.toBeNull();
    expect(mockStage.current!.wink).toBe(1);
    await press('recount');
    expect(q('recount')).toBeNull();
    expect(mockStage.current!.countOrder.size).toBe(0);
    await tap(ids[0]!);
    expect(q('count-chip')!.textContent).toBe('1');
    // Another block: the old count is void.
    await drag({ type: 'take', unitId: ids[3]!, to: cell(0, 1) });
    expect(q('count-chip')).toBeNull();
    expect(mockStage.current!.countOrder.size).toBe(0);
    expect(mockSaid).toEqual(['一', '二', '三', '一共 3 块', '一']);
  });

  test('put all back empties the mat in one go; undo brings the whole build back; both write what is on the mat', async () => {
    const storage = memoryStorage();
    await open(storage);
    await buildRow();
    await drag({ type: 'move', unitId: ids[2]!, to: cell(4, 3) });
    const before = mockStage.current!.state;
    mockSounds.length = 0;
    await press('sandbox-tidy');
    expect(mockStage.current!.state.bench.size).toBe(0);
    expect(all('face-sleepy')).toHaveLength(10);
    expect(mockSounds).toEqual(['return']);
    expect((await saved(storage)).sandbox!.bench.size).toBe(0);
    expect(dimmed('sandbox-tidy')).toBe(true);
    await press('sandbox-undo');
    expect(mockStage.current!.state).toBe(before);
    expect((await saved(storage)).sandbox!.bench.get(ids[2]!)).toEqual(cell(4, 3));
    // Undo walks back one drag at a time, down to the empty box, and then stops.
    for (let i = 0; i < 4; i += 1) {
      await press('sandbox-undo');
    }
    expect(mockStage.current!.state.bench.size).toBe(0);
    expect(dimmed('sandbox-undo')).toBe(true);
    await press('sandbox-undo');
    await press('sandbox-tidy');
    expect(mockStage.current!.state.bench.size).toBe(0);
    expect(mockSaid).toEqual([]);
  });

  test('back to the map; coming back (or a refresh) finds the mat as it was left; completions and the current stop never move', async () => {
    let s = createInitialState(4);
    for (const id of ['ch1-n1', 'ch1-n2']) {
      const e = reduce(s, { type: 'enter', nodeId: nodeId(id) });
      const c = e.ok ? reduce(e.value, { type: 'complete', nodeId: nodeId(id), verdict: { matched: true, benchCount: 1, reason: 'matched' } }) : e;
      s = c.ok ? c.value : s;
    }
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(s) });
    await open(storage);
    await buildRow();
    await press('sandbox-map');
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/');
    act(() => root.unmount());
    root = createRoot(container);
    await open(storage);
    expect(mockStage.current!.state.bench.size).toBe(3);
    expect(all('block')).toHaveLength(10);
    expect(all('face-calm')).toHaveLength(1);
    // A fresh visit has nothing to undo; the build is still there to put away.
    expect(dimmed('sandbox-undo')).toBe(true);
    expect(dimmed('sandbox-tidy')).toBe(false);
    const after = await saved(storage);
    expect(after.completedNodeIds).toEqual(s.completedNodeIds);
    expect(after.current).toBe(s.current);
    expect(after.nodes).toEqual(s.nodes);
  });

  test('the empty mat gets the "like this" hand after a quiet while, twice a visit at most; a touch puts it away', async () => {
    await open(memoryStorage());
    expect(q('demo-hand')).toBeNull();
    act(() => jest.advanceTimersByTime(5000));
    expect(q('demo-hand')).not.toBeNull();
    act(() => jest.advanceTimersByTime(4200));
    expect(q('demo-hand')).toBeNull();
    // Shown once; it waits for the next quiet while after a touch.
    act(() => jest.advanceTimersByTime(20000));
    expect(q('demo-hand')).toBeNull();
    act(() => mockStage.current!.onDragActive!(true));
    act(() => jest.advanceTimersByTime(5000));
    expect(q('demo-hand')).not.toBeNull();
    act(() => mockStage.current!.onDragActive!(true));
    expect(q('demo-hand')).toBeNull();
    act(() => jest.advanceTimersByTime(20000));
    expect(q('demo-hand')).toBeNull();
    expect(mockSaid).toEqual([]);
  });

  test('Phase 21: the die opens a random puzzle on its own page; this page and its mat stay as they are (nothing written)', async () => {
    const storage = counted();
    await open(storage);
    await buildRow();
    const before = storage.writes();
    expect(q('sandbox-random')!.getAttribute('aria-label')).toBe('随机题');
    expect(dimmed('sandbox-random')).toBe(false);
    await press('sandbox-random');
    expect(mockRouter.push).toHaveBeenLastCalledWith('/challenge');
    expect(storage.writes()).toBe(before);
    expect(mockStage.current!.state.bench.size).toBe(3);
  });

  test('English: the sign and the button names', async () => {
    await open(memoryStorage({ [STORAGE_KEY]: serialize({ ...createInitialState(2), language: 'en' }) }));
    expect(q('sandbox-sign')!.textContent).toBe('Free play');
    expect(container.textContent).toContain('Put all back');
    expect(q('sandbox-random')!.getAttribute('aria-label')).toBe('Random');
    expect(q('sandbox-map')!.getAttribute('aria-label')).toBe('Map');
  });

  test('a frozen archive from before free play opens an empty box and keeps everything it had', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(ch1Finished) });
    await open(storage);
    expect(all('block')).toHaveLength(10);
    expect(mockStage.current!.state.bench.size).toBe(0);
    await drag({ type: 'take', unitId: ids[0]!, to: cell(2, 2) });
    const after = await saved(storage);
    expect(after.sandbox!.bench.size).toBe(1);
    expect(after.completedNodeIds).toEqual(deserialize(JSON.stringify(ch1Finished))!.completedNodeIds);
    expect(after.current).toBe(deserialize(JSON.stringify(ch1Finished))!.current);
  });

  test('before progress loads (the static export renders it so) nothing is drawn and nothing throws', async () => {
    const pending: ProgressStorage = { ...memoryStorage(), getItem: () => new Promise<string | null>(() => undefined) };
    await open(pending);
    expect(q('sandbox-screen')).toBeNull();
    expect(mockStage.current).toBeNull();
  });
});
