/**
 * The island page with the real progress provider and the real stage, in jsdom.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { apply } from '../core';
import type { BenchState } from '../core';
import { materialize, nodeId } from '../content';
import { STORAGE_KEY, createInitialState, memoryStorage, reduce, serialize } from '../progress';
import type { ProgressState } from '../progress';
import { IslandDoneScreen } from './IslandDoneScreen';
import { ProgressProvider } from './progress-store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
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
jest.mock('./sound', () => ({ play: (name: string) => mockSounds.push(name), setSoundMuted: () => undefined, sfx: { isMuted: () => false } }));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mockSaid.length = 0;
  mockSounds.length = 0;
  mockRouter.replace.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const ORDER = ['ch1-n1', 'ch1-n2', 'ch1-n3', 'ch1-n4', 'ch1-n5', 'ch1-n6', 'ch1-n7', 'ch1-n8', 'ch1-n9', 'ch1-n10', 'ch1-n11', 'ch1-n12', 'ch2-n1', 'ch2-n2', 'ch2-n3', 'ch2-n4', 'ch2-n5', 'ch2-n6', 'ch2-n7', 'ch2-n8'];

function finished(count: number, language: 'zh' | 'en' = 'zh'): ProgressState {
  let s = { ...createInitialState(5), language };
  for (const id of ORDER.slice(0, count)) {
    const e = reduce(s, { type: 'enter', nodeId: nodeId(id) });
    const c = e.ok ? reduce(e.value, { type: 'complete', nodeId: nodeId(id), verdict: { matched: true, benchCount: 1, reason: 'matched' } }) : e;
    if (!c.ok) {
      throw new Error(c.reason);
    }
    s = c.value;
  }
  return s;
}

async function open(state: ProgressState, chapterId: string) {
  await act(async () => {
    root.render(
      <GestureHandlerRootView>
        <SafeAreaProvider initialMetrics={metrics}>
          <ProgressProvider storage={memoryStorage({ [STORAGE_KEY]: serialize(state) })}>
            <IslandDoneScreen chapterId={chapterId} />
          </ProgressProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>,
    );
  });
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

const q = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

describe('island page (2026-10-15 review I)', () => {
  test('Number Island done: everyone cheers, the boss work is on show, the line speaks only when tapped, the button hops on to Join Island', async () => {
    await open(finished(12), 'ch1');
    expect(q('island-done')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="island-cheer"]')).toHaveLength(12);
    expect(container.querySelectorAll('[data-testid="island-cheer"] [data-testid="face-happy"]')).toHaveLength(12);
    // 17 = 10 + 5 + 2 on the mat, read only: no sandbox.
    expect(q('island-work')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="island-work"] [data-testid^="partner-"]').length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector('[data-testid="island-work"] [data-testid="tray"]')).toBeNull();
    expect(q('island-line')?.textContent).toBe('数字岛完成了，去合体岛吧');
    expect(mockSounds).toEqual(['fanfare']);
    expect(mockSaid).toEqual([]);
    await act(async () => q('island-line')!.click());
    expect(mockSaid).toEqual(['数字岛完成了，去合体岛吧']);
    expect(q('island-go')?.textContent).toBe('去合体岛');
    await act(async () => q('island-go')!.click());
    expect(mockRouter.replace).toHaveBeenLastCalledWith({ pathname: '/', params: { from: 'ch1-n12', to: 'ch2-n1' } });
  });

  test('the last island: every island done, back to the map; its boss is 7 made two ways, drawn as the last way when there is no picture', async () => {
    await open(finished(20, 'en'), 'ch2');
    expect(container.querySelectorAll('[data-testid="island-cheer"]')).toHaveLength(8);
    // No album picture and no saved work: the reference answer's end, the second way (5 + 2, Phase 19).
    expect([...container.querySelectorAll('[data-testid="island-work"] [data-testid^="partner-"]')].map((p) => p.getAttribute('data-testid')).filter((t) => /^partner-\d+$/.test(t!)).sort()).toEqual(['partner-2', 'partner-5']);
    expect(q('island-line')?.textContent).toBe('Every island is done!');
    expect(q('island-go')?.textContent).toBe('Back to map');
    await act(async () => q('island-go')!.click());
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/');
  });

  test('an unfinished or unknown island has no page: back to the map, nothing thrown', async () => {
    await open(finished(5), 'ch1');
    expect(q('island-done')).toBeNull();
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/');
    // Join Island with everything but its new boss done (a version 5 archive after the upgrade, Phase 19).
    mockRouter.replace.mockClear();
    act(() => root.unmount());
    root = createRoot(container);
    await open(finished(19), 'ch2');
    expect(q('island-done')).toBeNull();
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/');
    mockRouter.replace.mockClear();
    act(() => root.unmount());
    root = createRoot(container);
    await open(finished(20), '[chapterId]');
    expect(q('island-done')).toBeNull();
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/');
  });

  test('review Q: the boss shown is the album picture, on its own mat, before the saved work or the reference answer', async () => {
    const state = finished(12);
    const p = materialize(state.nodes.get(nodeId('ch1-n12'))!.ref);
    const solved = p.solution.reduce<BenchState>((w, cmd) => {
      const r = apply(w, cmd);
      return r.ok ? r.value : w;
    }, p.initial);
    const benchWidth = () => (container.querySelector('[data-testid="island-work"] [data-testid="bench"]') as HTMLElement).style.width;
    await open(state, 'ch1');
    const reference = benchWidth();
    // The same 17, two columns further right on a wider (older) mat: only the picture can draw that.
    const picture: BenchState = { ...solved, bounds: { cols: solved.bounds.cols + 2, rows: solved.bounds.rows }, bench: new Map([...solved.bench].map(([u, c]) => [u, { x: c.x + 2, y: c.y }])) };
    act(() => root.unmount());
    root = createRoot(container);
    await open({ ...state, album: new Map([[nodeId('ch1-n12'), picture]]) }, 'ch1');
    expect(benchWidth()).not.toBe(reference);
    expect(parseFloat(benchWidth()) / parseFloat(reference)).toBeCloseTo((solved.bounds.cols + 2) / solved.bounds.cols, 1);
    expect(container.querySelectorAll('[data-testid="island-work"] [data-testid^="partner-"]').length).toBeGreaterThanOrEqual(3);
  });
});
