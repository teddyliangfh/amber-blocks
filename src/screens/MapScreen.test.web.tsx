/**
 * The map with the real progress provider, rendered with react-native-web in jsdom.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { materialize, nodeId } from '../content';
import { STORAGE_KEY, createInitialState, memoryStorage, reduce, serialize } from '../progress';
import type { ProgressState } from '../progress';
import { ADVANCE, MapScreen, SKIP_AFTER_MS, advanceOf } from './MapScreen';
import { ProgressProvider } from './progress-store';
import { PARENT_HINT_MS } from './ui';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
const mockParams: { current: Record<string, string> } = { current: {} };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams.current }));

const mockSounds: string[] = [];
jest.mock('./sound', () => ({ play: (name: string) => mockSounds.push(name), setSoundMuted: () => undefined, sfx: { isMuted: () => false } }));

let container: HTMLDivElement;
let root: Root;
const sizes = ['offsetWidth', 'offsetHeight'] as const;
const real = Object.fromEntries(sizes.map((k) => [k, Object.getOwnPropertyDescriptor(HTMLElement.prototype, k)]));

beforeEach(() => {
  mockSounds.length = 0;
  mockRouter.replace.mockClear();
  mockRouter.push.mockClear();
  // jsdom lays nothing out: give every view a phone-sized box so the map draws its stops.
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 390 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 844 });
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
});

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

function finishedUpTo(upTo: string): ProgressState {
  let s = createInitialState(5);
  const order = ['ch1-n1', 'ch1-n2', 'ch1-n3', 'ch1-n4', 'ch1-n5', 'ch1-n6', 'ch1-n7', 'ch1-n8', 'ch1-n9', 'ch1-n10', 'ch1-n11', 'ch1-n12', 'ch2-n1', 'ch2-n2', 'ch2-n3', 'ch2-n4', 'ch2-n5', 'ch2-n6', 'ch2-n7', 'ch2-n8'];
  for (const id of order.slice(0, order.indexOf(upTo))) {
    const e = reduce(s, { type: 'enter', nodeId: nodeId(id) });
    const c = e.ok ? reduce(e.value, { type: 'complete', nodeId: nodeId(id), verdict: { matched: true, benchCount: 1, reason: 'matched' } }) : e;
    if (!c.ok) {
      throw new Error(c.reason);
    }
    s = c.value;
  }
  return s;
}

async function open(state: ProgressState, params: Record<string, string>) {
  mockParams.current = params;
  await act(async () => {
    root.render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ProgressProvider storage={memoryStorage({ [STORAGE_KEY]: serialize(state) })}>
          <MapScreen />
        </ProgressProvider>
      </SafeAreaProvider>,
    );
  });
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });
  }
}

const face = (id: string) => container.querySelector(`[data-testid="stop-${id}"] [data-testid^="face-"]`)?.getAttribute('data-testid');

describe('the way on (2026-10-15 review H)', () => {
  test('advanceOf accepts two known stops with the second one open, nothing else', () => {
    const s = finishedUpTo('ch1-n3');
    expect(advanceOf({ from: 'ch1-n2', to: 'ch1-n3' }, s)).toEqual({ from: 'ch1-n2', to: 'ch1-n3' });
    expect(advanceOf({ from: ['ch1-n2'], to: ['ch1-n3'] }, s)).toEqual({ from: 'ch1-n2', to: 'ch1-n3' });
    expect(advanceOf({ from: 'ch1-n2', to: 'ch1-n5' }, s)).toBeNull();
    expect(advanceOf({ from: 'ch1-n2', to: 'nope' }, s)).toBeNull();
    expect(advanceOf({}, s)).toBeNull();
    expect(advanceOf({ from: 'ch1-n2', to: 'ch1-n3' }, null)).toBeNull();
  });

  test('the marker hops, the next stop wakes with a light tick (the stop plays the arrival jingle, once), then it opens by itself', async () => {
    jest.useFakeTimers();
    try {
      await open(finishedUpTo('ch1-n3'), { from: 'ch1-n2', to: 'ch1-n3' });
      expect(container.querySelector('[data-testid="travel-marker"]')).not.toBeNull();
      expect(face('ch1-n3')).toBe('face-sleepy');
      expect(mockSounds).toEqual([]);
      const landAt = ADVANCE.startMs + ADVANCE.hops * ADVANCE.hopMs;
      act(() => jest.advanceTimersByTime(landAt));
      expect(face('ch1-n3')).toBe('face-calm');
      expect(mockSounds).toEqual(['tap']);
      expect(mockRouter.replace).not.toHaveBeenCalled();
      act(() => jest.advanceTimersByTime(ADVANCE.enterMs));
      expect(mockRouter.replace).toHaveBeenCalledTimes(1);
      expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/play/[nodeId]', params: { nodeId: 'ch1-n3' } });
    } finally {
      jest.useRealTimers();
    }
  });

  test('a tap goes straight in, once; review D-1: not a second tap of "next" right as the map opens', async () => {
    jest.useFakeTimers();
    try {
      await open(finishedUpTo('ch1-n3'), { from: 'ch1-n2', to: 'ch1-n3' });
      const skip = () => act(() => (container.querySelector('[data-testid="advance-skip"]') as HTMLElement).click());
      // The child's double tap lands within the first moments: the hop still plays.
      skip();
      expect(mockRouter.replace).not.toHaveBeenCalled();
      expect(container.querySelector('[data-testid="travel-marker"]')).not.toBeNull();
      act(() => jest.advanceTimersByTime(SKIP_AFTER_MS));
      skip();
      expect(mockRouter.replace).toHaveBeenCalledTimes(1);
      expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/play/[nodeId]', params: { nodeId: 'ch1-n3' } });
      act(() => jest.advanceTimersByTime(5000));
      expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('a plain visit is the plain map: no hop, no skip layer, nothing opens by itself', async () => {
    jest.useFakeTimers();
    try {
      await open(finishedUpTo('ch1-n3'), {});
      expect(container.querySelector('[data-testid="travel-marker"]')).toBeNull();
      expect(container.querySelector('[data-testid="advance-skip"]')).toBeNull();
      expect(face('ch1-n3')).toBe('face-calm');
      act(() => jest.advanceTimersByTime(5000));
      expect(mockRouter.replace).not.toHaveBeenCalled();
      expect(mockSounds).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  test('review I: bunting and a cup only once every island is done', async () => {
    jest.useFakeTimers();
    try {
      // Join Island ends at ch2-n8 since Phase 19: everything up to it finished is not yet every island.
      await open(finishedUpTo('ch2-n8'), {});
      expect(container.querySelector('[data-testid="map-trophy"]')).toBeNull();
      act(() => root.unmount());
      root = createRoot(container);
      const all = finishedUpTo('ch2-n8');
      const e = reduce(all, { type: 'enter', nodeId: nodeId('ch2-n8') });
      const c = e.ok ? reduce(e.value, { type: 'complete', nodeId: nodeId('ch2-n8'), verdict: { matched: true, benchCount: 7, reason: 'matched' } }) : e;
      await open(c.ok ? c.value : all, {});
      expect(container.querySelector('[data-testid="map-trophy"]')).not.toBeNull();
      // Phase 20 Q9: the cup opens the last island's page again.
      mockRouter.replace.mockClear();
      act(() => (container.querySelector('[data-testid="map-trophy"]') as HTMLElement).click());
      expect(mockRouter.replace).toHaveBeenLastCalledWith({ pathname: '/island/[chapterId]', params: { chapterId: 'ch2' } });
      expect(container.querySelector('[data-testid="map-trophy"]')?.getAttribute('aria-label')).toBe('奖杯');
    } finally {
      jest.useRealTimers();
    }
  });

  test('review K: the parents\' gear opens only when held for 600ms; a tap only clicks and shows the hold hint (2026-10-16 review I-3, D-073)', async () => {
    jest.useFakeTimers();
    try {
      await open(finishedUpTo('ch1-n3'), {});
      const gear = container.querySelector('[data-testid="parent"]') as HTMLElement;
      const hint = () => container.querySelector('[data-testid="parent-hint"]')?.textContent ?? null;
      const tap = () =>
        act(() => {
          gear.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
          jest.advanceTimersByTime(200);
          gear.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
          gear.click();
        });
      mockSounds.length = 0;
      expect(hint()).toBeNull();
      tap();
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(mockSounds).toEqual(['tap']);
      expect(hint()).toBe('按住进入家长区');
      // A second tap keeps it up for another PARENT_HINT_MS from then.
      act(() => jest.advanceTimersByTime(PARENT_HINT_MS - 500));
      tap();
      act(() => jest.advanceTimersByTime(PARENT_HINT_MS - 300));
      expect(hint()).toBe('按住进入家长区');
      act(() => jest.advanceTimersByTime(300));
      expect(hint()).toBeNull();
      // Held: the parents' area, and no bubble left behind.
      tap();
      act(() => {
        gear.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        jest.advanceTimersByTime(650);
        gear.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      });
      expect(mockRouter.push).toHaveBeenCalledWith('/parent');
      expect(hint()).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('album entry (2026-10-15 review Q)', () => {
  test('no album button until something is in the album; then a plain tap opens it', async () => {
    jest.useFakeTimers();
    try {
      // Stops finished without a picture (as before the album) and a fresh map: no button.
      await open(finishedUpTo('ch1-n3'), {});
      expect(container.querySelector('[data-testid="album"]')).toBeNull();
      act(() => root.unmount());
      root = createRoot(container);
      const s = finishedUpTo('ch1-n2');
      const e = reduce(s, { type: 'enter', nodeId: nodeId('ch1-n2') });
      if (!e.ok) {
        throw new Error(e.reason);
      }
      const p = materialize(e.value.nodes.get(nodeId('ch1-n2'))!.ref);
      const [a, b] = [...p.initial.units.keys()];
      const work = { ...p.initial, bench: new Map([[a!, { x: 0, y: 0 }], [b!, { x: 1, y: 0 }]]), tray: p.initial.tray.map((t) => (t.unitId === a || t.unitId === b ? { ...t, unitId: null } : t)) };
      const c = reduce(e.value, { type: 'complete', nodeId: nodeId('ch1-n2'), verdict: { matched: true, benchCount: 2, reason: 'matched' }, work });
      if (!c.ok) {
        throw new Error(c.reason);
      }
      await open(c.value, {});
      const button = container.querySelector('[data-testid="album"]') as HTMLElement;
      expect(button).not.toBeNull();
      act(() => button.click());
      expect(mockRouter.push).toHaveBeenCalledWith('/album');
    } finally {
      jest.useRealTimers();
    }
  });
});


describe('free play entry (2026-10-15 review O)', () => {
  test('always there, nothing to finish first: a fresh map, a map halfway and a finished one; a plain tap opens it', async () => {
    jest.useFakeTimers();
    try {
      await open(createInitialState(5), {});
      const button = container.querySelector('[data-testid="sandbox"]') as HTMLElement;
      expect(button).not.toBeNull();
      expect(button.getAttribute('aria-label')).toBe('自由玩');
      act(() => button.click());
      expect(mockRouter.push).toHaveBeenCalledWith('/sandbox');
      for (const upTo of ['ch1-n5', 'ch2-n7']) {
        act(() => root.unmount());
        root = createRoot(container);
        await open(finishedUpTo(upTo), {});
        expect(container.querySelector('[data-testid="sandbox"]')).not.toBeNull();
      }
      // Beside play, in the right-hand group; the gear and the album keep the left.
      const play = container.querySelector('[data-testid="play"]') as HTMLElement;
      const sandbox = container.querySelector('[data-testid="sandbox"]') as HTMLElement;
      expect(play.parentElement).toBe(sandbox.parentElement);
      expect(sandbox.nextElementSibling).toBe(play);
    } finally {
      jest.useRealTimers();
    }
  });
});
