/**
 * The map with the real progress provider, rendered with react-native-web in jsdom.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CHAPTERS, chapterId, findChapter, materialize, nodeId } from '../content';
import { STORAGE_KEY, createInitialState, memoryStorage, reduce, serialize } from '../progress';
import type { ProgressState } from '../progress';
import { ADVANCE, MAP_SHAPE_LABEL, MAP_SIGN_LABEL, MapScreen, SKIP_AFTER_MS, advanceOf, labelOf, mapPictureOf } from './MapScreen';
import v6AllFinished from '../progress/__fixtures__/archive-v6-phase20-all-finished.json';
import v7AllFinished from '../progress/__fixtures__/archive-v7-phase21-all-finished.json';
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
  const order = ['ch1-n1', 'ch1-n2', 'ch1-n3', 'ch1-n4', 'ch1-n5', 'ch1-n6', 'ch1-n13', 'ch1-n7', 'ch1-n14', 'ch1-n8', 'ch1-n15', 'ch1-n9', 'ch1-n16', 'ch1-n10', 'ch1-n17', 'ch1-n11', 'ch1-n12', 'ch2-n1', 'ch2-n2', 'ch2-n3', 'ch2-n9', 'ch2-n4', 'ch2-n10', 'ch2-n5', 'ch2-n6', 'ch2-n11', 'ch2-n13', 'ch2-n7', 'ch2-n12', 'ch2-n8', 'ch3-n1', 'ch3-n2', 'ch3-n3', 'ch3-n4', 'ch3-n5', 'ch3-n6', 'ch3-n7', 'ch3-n8'];
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
      // Take-away Island ends at ch3-n8 since Phase 22: everything up to it finished is not yet every island.
      await open(finishedUpTo('ch3-n8'), {});
      expect(container.querySelector('[data-testid="map-trophy"]')).toBeNull();
      act(() => root.unmount());
      root = createRoot(container);
      const all = finishedUpTo('ch3-n8');
      const e = reduce(all, { type: 'enter', nodeId: nodeId('ch3-n8') });
      const c = e.ok ? reduce(e.value, { type: 'complete', nodeId: nodeId('ch3-n8'), verdict: { matched: true, benchCount: 1, reason: 'matched' } }) : e;
      // Phase 23b: Shape Island, off the way, is one of every island too.
      await open(c.ok ? c.value : all, {});
      expect(container.querySelector('[data-testid="map-trophy"]')).toBeNull();
      act(() => root.unmount());
      root = createRoot(container);
      let withShapes = c.ok ? c.value : all;
      for (const id of ['ch5-n1', 'ch5-n2', 'ch5-n3', 'ch5-n4', 'ch5-n5', 'ch5-n6', 'ch5-n7', 'ch5-n8']) {
        const r = reduce(withShapes, { type: 'enter', nodeId: nodeId(id) });
        const d = r.ok ? reduce(r.value, { type: 'complete', nodeId: nodeId(id), verdict: { matched: true, benchCount: 1, reason: 'matched' } }) : r;
        withShapes = d.ok ? d.value : withShapes;
      }
      // Phase 23d: Compare Island (ch6), last on the map, too.
      await open(withShapes, {});
      expect(container.querySelector('[data-testid="map-trophy"]')).toBeNull();
      act(() => root.unmount());
      root = createRoot(container);
      for (const id of ['ch6-n1', 'ch6-n2', 'ch6-n3', 'ch6-n4', 'ch6-n5', 'ch6-n6', 'ch6-n7', 'ch6-n8', 'ch6-n9', 'ch6-n10']) {
        const r = reduce(withShapes, { type: 'enter', nodeId: nodeId(id) });
        const d = r.ok ? reduce(r.value, { type: 'complete', nodeId: nodeId(id), verdict: { matched: true, benchCount: 1, reason: 'matched' } }) : r;
        withShapes = d.ok ? d.value : withShapes;
      }
      await open(withShapes, {});
      expect(container.querySelector('[data-testid="map-trophy"]')).not.toBeNull();
      // Phase 20 Q9: the cup opens the last island's page again.
      mockRouter.replace.mockClear();
      act(() => (container.querySelector('[data-testid="map-trophy"]') as HTMLElement).click());
      expect(mockRouter.replace).toHaveBeenLastCalledWith({ pathname: '/island/[chapterId]', params: { chapterId: 'ch6' } });
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

describe('Phase 23b: Shape Island on the map', () => {
  test('MAP_SHAPE_LABEL: its stops show their pictures (the boat for the corner-then-boat stop); every other stop, Number Island\'s pictures too, its number', () => {
    expect(MAP_SHAPE_LABEL).toBe('picture');
    const shapes = findChapter(chapterId('ch5')).nodes;
    expect(shapes.map((n) => mapPictureOf(n)?.length)).toEqual([4, 5, 5, 5, 7, 5, 6, 6]);
    expect(mapPictureOf(shapes[5]!)).toBe(shapes[5]!.spec.kind === 'quantity_shape' ? shapes[5]!.spec.templates[1]!.cells : null);
    expect(shapes.map((n) => labelOf(n).label)).toEqual(['4', '5', '5', '5', '7', '5', '6', '6']);
    expect(CHAPTERS.filter((c) => c.id !== 'ch5').flatMap((c) => c.nodes).filter((n) => mapPictureOf(n) !== null)).toEqual([]);
  });

  test('second on the map: open with Number Island done, the marker on its first stop, drawn as pictures; Join Island open beside it', async () => {
    jest.useFakeTimers();
    try {
      await open(finishedUpTo('ch2-n1'), {});
      expect(container.querySelector('[data-testid="stop-ch5-n1"]')?.getAttribute('aria-label')).toBe('ch5-n1 available');
      expect(container.querySelector('[data-testid="stop-ch5-n2"]')?.getAttribute('aria-label')).toBe('ch5-n2 locked');
      expect(container.querySelector('[data-testid="stop-ch2-n1"]')?.getAttribute('aria-label')).toBe('ch2-n1 available');
      expect(container.querySelectorAll('[data-testid="stop-picture"]')).toHaveLength(8);
      expect(container.querySelector('[data-testid="stop-ch5-n1"] [data-testid="stop-picture"]')).not.toBeNull();
      const islands = [...container.querySelectorAll('[data-testid^="stop-ch"]')].map((e) => e.getAttribute('data-testid')!.slice(5, 8));
      expect([...new Set(islands)]).toEqual(['ch1', 'ch5', 'ch2', 'ch3', 'ch6']);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('Phase 21: Join Island has twelve stops', () => {
  test('each new stop is labelled with its number: the ten 10, the send-away 7, the stairs 6, the teen 13', () => {
    const labels = findChapter(chapterId('ch2')).nodes.map((n) => labelOf(n).label);
    // Phase 23a: the big stairs (10) after the stairs.
    expect(labels).toEqual(['1+1', '2+1', '2+2', '10', '5', '7', '5', '6', '6', '10', '7', '13', '7']);
    expect(labelOf(findChapter(chapterId('ch2')).nodes[11]!).number).toBe(13);
    // Number Island's new pictures are labelled with their numbers too (PRD §8 #13: 4 4, 8 8, 9 9, 10 10 side by side).
    expect(findChapter(chapterId('ch1')).nodes.map((n) => labelOf(n).label)).toEqual(['1', '2', '4', '3', '5', '4', '4', '6', '5', '8', '8', '9', '9', '10', '10', '12', '17']);
  });

  test('Phase 22: Take-away Island\'s stops read as splits (the whole), take-aways (4−1, in the colour of what is left) and the countdown 5', () => {
    const stops = findChapter(chapterId('ch3')).nodes.map((n) => labelOf(n));
    expect(stops.map((s) => s.label)).toEqual(['3', '4', '4−1', '5', '5−2', '6−2', '7−3', '5']);
    expect(stops.map((s) => s.number)).toEqual([3, 4, 3, 5, 3, 4, 4, 5]);
  });

  test('Phase 23d: Compare Island\'s stops read as their first round and its sign, in the colour of the bigger number (MAP_SIGN_LABEL)', () => {
    const stops = findChapter(chapterId('ch6')).nodes.map((n) => labelOf(n));
    expect(MAP_SIGN_LABEL).toBe('first-pair');
    expect(stops.map((s) => s.label)).toEqual(['4>1', '2=2', '4<5', '6>2', '3<4', '3=3', '7<9', '10>9', '12>10', '6<9']);
    expect(stops.map((s) => s.number)).toEqual([4, 2, 5, 6, 4, 3, 9, 10, 12, 9]);
  });

  test('Phase 22: a finished version 7 archive draws the third island with its first stop awake and the marker on it, the rest asleep, no cup', async () => {
    jest.useFakeTimers();
    try {
      mockParams.current = {};
      await act(async () => {
        root.render(
          <SafeAreaProvider initialMetrics={metrics}>
            <ProgressProvider storage={memoryStorage({ [STORAGE_KEY]: JSON.stringify(v7AllFinished) })}>
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
      expect(container.querySelector('[data-testid="stop-ch3-n1"]')?.getAttribute('aria-label')).toBe('ch3-n1 available');
      for (const id of ['ch3-n2', 'ch3-n3', 'ch3-n4', 'ch3-n5', 'ch3-n6', 'ch3-n7', 'ch3-n8']) {
        expect(container.querySelector(`[data-testid="stop-${id}"]`)?.getAttribute('aria-label')).toBe(`${id} locked`);
      }
      expect(container.querySelector('[data-testid="stop-ch2-n8"]')?.getAttribute('aria-label')).toBe('ch2-n8 completed');
      expect(container.querySelector('[data-testid="map-trophy"]')).toBeNull();
      expect(container.textContent).toContain('拿走岛');
      mockRouter.push.mockClear();
      // ▶ plays where the map rests: ch3-n1 before version 9, Phase 23a's ch1-n13 (the first open new stop) since.
      act(() => (container.querySelector('[data-testid="play"]') as HTMLElement).click());
      expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/play/[nodeId]', params: { nodeId: 'ch1-n13' } });
    } finally {
      jest.useRealTimers();
    }
  });

  test('a finished version 6 archive: all twelve drawn, the marker on the first new stop, the four new ones awake, no cup', async () => {
    jest.useFakeTimers();
    try {
      mockParams.current = {};
      await act(async () => {
        root.render(
          <SafeAreaProvider initialMetrics={metrics}>
            <ProgressProvider storage={memoryStorage({ [STORAGE_KEY]: JSON.stringify(v6AllFinished) })}>
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
      for (const n of findChapter(chapterId('ch2')).nodes) {
        expect(container.querySelector(`[data-testid="stop-${n.id}"]`)).not.toBeNull();
      }
      for (const id of ['ch2-n9', 'ch2-n10', 'ch2-n11', 'ch2-n12']) {
        expect(container.querySelector(`[data-testid="stop-${id}"]`)?.getAttribute('aria-label')).toBe(`${id} available`);
      }
      expect(container.querySelector('[data-testid="stop-ch2-n8"]')?.getAttribute('aria-label')).toBe('ch2-n8 completed');
      expect(container.querySelector('[data-testid="map-trophy"]')).toBeNull();
      // ▶ plays where the map rests: ch2-n9 before version 9, Phase 23a's ch1-n13 since.
      mockRouter.push.mockClear();
      act(() => (container.querySelector('[data-testid="play"]') as HTMLElement).click());
      expect(mockRouter.push).toHaveBeenLastCalledWith({ pathname: '/play/[nodeId]', params: { nodeId: 'ch1-n13' } });
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
