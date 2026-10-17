/**
 * The album page with the real progress provider, the real pictures and the
 * real stage for an opened work, in jsdom (2026-10-15 review Q).
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CHAPTERS, materialize, nodeId } from '../content';
import { apply, judge } from '../core';
import type { BenchState } from '../core';
import { STORAGE_KEY, createInitialState, memoryStorage, reduce, serialize } from '../progress';
import type { ProgressState, ProgressStorage } from '../progress';
import { AlbumScreen, CHEER_AFTER_MS, albumGroups } from './AlbumScreen';
import { ProgressProvider } from './progress-store';

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
jest.mock('./sound', () => ({ play: (name: string) => mockSounds.push(name), setSoundMuted: () => undefined, sfx: { isMuted: () => false } }));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  mockSaid.length = 0;
  mockSounds.length = 0;
  mockRouter.dismissTo.mockClear();
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

function solvedWork(state: ProgressState, id: string): BenchState {
  const p = materialize(state.nodes.get(nodeId(id))!.ref);
  return p.solution.reduce((w, cmd) => {
    const r = apply(w, cmd);
    if (!r.ok) {
      throw new Error(r.reason);
    }
    return r.value;
  }, p.initial);
}

// Every stop finished; only `pictured` were finished with their mat (the rest as before the album).
function played(pictured: ReadonlyArray<string>, language: 'zh' | 'en' = 'zh'): ProgressState {
  let s = { ...createInitialState(5), language };
  for (const id of ORDER) {
    const e = reduce(s, { type: 'enter', nodeId: nodeId(id) });
    if (!e.ok) {
      throw new Error(e.reason);
    }
    s = e.value;
    const work = pictured.includes(id) ? solvedWork(s, id) : undefined;
    const c = reduce(s, { type: 'complete', nodeId: nodeId(id), verdict: { matched: true, benchCount: 1, reason: 'matched' }, work });
    if (!c.ok) {
      throw new Error(c.reason);
    }
    s = c.value;
  }
  return s;
}

async function open(storage: ProgressStorage) {
  await act(async () => {
    root.render(
      <GestureHandlerRootView>
        <SafeAreaProvider initialMetrics={metrics}>
          <ProgressProvider storage={storage}>
            <AlbumScreen />
          </ProgressProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>,
    );
  });
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });
  }
}

const q = (id: string) => container.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const all = (selector: string) => [...container.querySelectorAll(selector)] as HTMLElement[];

describe('album page (2026-10-15 review Q)', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('albumGroups: islands in map order, stops in map order, an island with nothing in it left out', () => {
    const s = played(['ch2-n7', 'ch1-n12', 'ch1-n2']);
    const groups = albumGroups(s.album);
    expect(groups.map((g) => g.chapter.id)).toEqual(['ch1', 'ch2']);
    expect(groups.map((g) => g.entries.map((e) => e.node.id))).toEqual([['ch1-n2', 'ch1-n12'], ['ch2-n7']]);
    expect(groups[0]!.entries[1]!.work).toBe(s.album.get(nodeId('ch1-n12')));
    expect(albumGroups(played(['ch2-n1']).album).map((g) => g.chapter.id)).toEqual(['ch2']);
    expect(albumGroups(new Map(), CHAPTERS)).toEqual([]);
  });

  test('only what was built is shown, by island: a card per picture with its number, no counts or empty frames', async () => {
    // The Join Island boss is 7 made two ways since Phase 19 (ch2-n8); its picture is the last way.
    await open(memoryStorage({ [STORAGE_KEY]: serialize(played(['ch2-n8', 'ch1-n12', 'ch1-n2'])) }));
    expect(q('album-screen')).not.toBeNull();
    expect(all('[data-testid^="album-group-"]').map((g) => g.dataset.testid)).toEqual(['album-group-ch1', 'album-group-ch2']);
    expect(all('[data-testid^="album-card-"]').map((c) => c.dataset.testid)).toEqual(['album-card-ch1-n2', 'album-card-ch1-n12', 'album-card-ch2-n8']);
    expect(all('[data-testid^="album-card-"]').map((c) => c.textContent)).toEqual(['2', '17★', '7★']);
    // Each picture: one face per character, all smiling (2 singles together; 10 + 5 + 2
    // and 5 + 2 joined into one 17 and one 7, Phase 20 F1).
    const faces = (id: string) => all(`[data-testid="album-card-${id}"] [data-testid^="face-"]`).map((f) => f.dataset.testid);
    expect(faces('ch1-n2')).toEqual(['face-happy']);
    expect(faces('ch1-n12')).toEqual(['face-happy']);
    expect(faces('ch2-n8')).toEqual(['face-happy']);
    // Nothing to collect: no "3 of 19", no frame for a stop not built yet.
    expect(container.textContent).not.toMatch(/\d+\s*\/\s*\d+/);
    expect(q('album-card-ch1-n1')).toBeNull();
    expect(q('album-empty')).toBeNull();
    expect(q('album-zoom')).toBeNull();
    expect(mockSaid).toEqual([]);
    expect(mockSounds).toEqual([]);
  });

  test('nothing yet: a dozing block and a way back to the map', async () => {
    await open(memoryStorage({ [STORAGE_KEY]: serialize(played([], 'en')) }));
    expect(q('album-empty')).not.toBeNull();
    expect(all('[data-testid="album-empty"] [data-testid="face-sleepy"]')).toHaveLength(1);
    expect(all('[data-testid^="album-card-"]')).toHaveLength(0);
    expect(container.textContent).toContain('My builds');
    act(() => q('album-map')!.click());
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/');
  });

  test('a card opens the work big on its own mat; it does its move once with the success sound; the number speaks only when tapped; it closes', async () => {
    // A join that names its sum: 2 + 2 (the 3 + 4 join, ch2-n7, is a "who's missing?" sum since Phase 19).
    const s = played(['ch1-n12', 'ch2-n3']);
    await open(memoryStorage({ [STORAGE_KEY]: serialize(s) }));
    act(() => q('album-card-ch1-n12')!.click());
    expect(q('album-zoom')).not.toBeNull();
    // The real stage, read only: the 10, 5 and 2 on the mat, no sandbox.
    expect(all('[data-testid="album-zoom-work"] [data-testid^="partner-"]').map((p) => p.dataset.testid).filter((t) => /^partner-\d+$/.test(t!)).sort()).toEqual(['partner-10', 'partner-2', 'partner-5']);
    expect(container.querySelector('[data-testid="album-zoom-work"] [data-testid="tray"]')).toBeNull();
    expect(judge(s.album.get(nodeId('ch1-n12'))!, materialize(s.nodes.get(nodeId('ch1-n12'))!.ref).question).matched).toBe(true);
    // (A click has no press-in, so no button tap sound here.)
    expect(mockSounds).toEqual([]);
    act(() => jest.advanceTimersByTime(CHEER_AFTER_MS));
    expect(mockSounds).toEqual(['success']);
    act(() => jest.advanceTimersByTime(5000));
    expect(mockSounds).toEqual(['success']);
    expect(mockSaid).toEqual([]);
    act(() => q('album-zoom-number')!.click());
    expect(mockSaid).toEqual(['十七']);
    act(() => q('album-zoom-close')!.click());
    expect(q('album-zoom')).toBeNull();
    // A join says its sum; the backdrop closes too.
    act(() => q('album-card-ch2-n3')!.click());
    expect(q('album-zoom-number')!.textContent).toContain('2+2');
    act(() => q('album-zoom-number')!.click());
    expect(mockSaid).toEqual(['十七', '2 加 2，一共 4']);
    act(() => q('album-zoom-backdrop')!.click());
    expect(q('album-zoom')).toBeNull();
  });

  test('before progress loads (the static export renders it so) nothing is drawn and nothing throws', async () => {
    const pending: ProgressStorage = { ...memoryStorage(), getItem: () => new Promise<string | null>(() => undefined) };
    await open(pending);
    expect(q('album-screen')).toBeNull();
  });
});
