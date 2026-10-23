/**
 * Free play's random puzzle (Phase 21): the real page and the real level play
 * (LevelPlay) on the real progress provider, in jsdom. Only the gesture layer
 * (Stage) is replaced by a probe, as in the level tests.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { StageProps } from '../blocks-ui';
import type { Challenge } from '../content';
import { nodeId, sandboxMaterial } from '../content';
import type { Command } from '../core';
import { STORAGE_KEY, createInitialState, memoryStorage, reduce, serialize } from '../progress';
import type { ProgressState, ProgressStorage } from '../progress';
import { ChallengeScreen } from './ChallengeScreen';
import { SOLVE_SETTLE_MS } from './LevelScreen';
import { ProgressProvider } from './progress-store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

const mockSaid: string[] = [];
jest.mock('./voice', () => {
  const { format } = jest.requireActual('../content');
  return {
    say: (lang: 'zh' | 'en', key: string, params: Record<string, number> = {}) => mockSaid.push(format(key, lang, params, { numbers: 'digit' })),
    voice: { say: () => undefined, stop: () => undefined, isSupported: () => false },
  };
});
const mockSounds: string[] = [];
jest.mock('./sound', () => ({ play: (name: string) => mockSounds.push(name), setSoundMuted: () => undefined, sfx: { isMuted: () => false } }));

// Every puzzle the page deals, and the progress it was dealt for.
const mockDealt: { done: ReadonlySet<string>; challenge: Challenge }[] = [];
jest.mock('../content', () => {
  const actual = jest.requireActual('../content');
  return {
    ...actual,
    nextChallenge: (...args: Parameters<typeof actual.nextChallenge>) => {
      const challenge = actual.nextChallenge(...args);
      mockDealt.push({ done: args[0] as ReadonlySet<string>, challenge });
      return challenge;
    },
  };
});
const mockStage: { current: StageProps | null } = { current: null };
jest.mock('../blocks-ui', () => {
  const actual = jest.requireActual('../blocks-ui');
  return {
    ...actual,
    Stage: (props: StageProps) => {
      mockStage.current = props;
      return null;
    },
  };
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  jest.useFakeTimers({ advanceTimers: 1 });
  mockSaid.length = 0;
  mockSounds.length = 0;
  mockDealt.length = 0;
  mockStage.current = null;
  mockRouter.dismissTo.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.useRealTimers();
});

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

async function settle() {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

// Storage that keeps every write of the archive.
function counted(initial: Readonly<Record<string, string>>): ProgressStorage & { writes: string[] } {
  const inner = memoryStorage(initial);
  const writes: string[] = [];
  return {
    ...inner,
    setItem: (key, value) => {
      if (key === STORAGE_KEY) {
        writes.push(value);
      }
      return inner.setItem(key, value);
    },
    writes,
  };
}

async function open(storage: ProgressStorage) {
  await act(async () => {
    root.render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ProgressProvider storage={storage}>
          <ChallengeScreen />
        </ProgressProvider>
      </SafeAreaProvider>,
    );
  });
  await settle();
}

async function command(cmd: Command) {
  await act(async () => {
    mockStage.current!.onCommand(cmd);
  });
  await settle();
}

async function solve() {
  for (const cmd of mockDealt[mockDealt.length - 1]!.challenge.puzzle.solution) {
    await command(cmd);
  }
  act(() => jest.advanceTimersByTime(SOLVE_SETTLE_MS));
  await settle();
}

async function press(testID: string) {
  await act(async () => (container.querySelector(`[data-testid="${testID}"]`) as HTMLElement).click());
  await settle();
}

const has = (testID: string) => container.querySelector(`[data-testid="${testID}"]`) !== null;
const text = (testID: string) => container.querySelector(`[data-testid="${testID}"]`)?.textContent ?? '';

function finished(ids: ReadonlyArray<string>, base: ProgressState = createInitialState(7)): ProgressState {
  return ids.reduce((s, id) => {
    const e = reduce(s, { type: 'enter', nodeId: nodeId(id) });
    const c = e.ok ? reduce(e.value, { type: 'complete', nodeId: nodeId(id), verdict: { matched: true, benchCount: 1, reason: 'matched' } }) : e;
    if (!c.ok) {
      throw new Error(c.reason);
    }
    return c.value;
  }, base);
}

describe('free play random puzzle page (Phase 21)', () => {
  test('a fresh archive: a number from 1 to 3, played like a stop: the cloud, the task card, the arrive sound', async () => {
    await open(memoryStorage({ [STORAGE_KEY]: serialize(createInitialState(7)) }));
    expect(mockDealt).toHaveLength(1);
    const c = mockDealt[0]!.challenge;
    expect(c.kind).toBe('quantity');
    expect([1, 2, 3]).toContain(c.n);
    expect(text('prompt')).toBe(String(c.n));
    expect(text('feedback-title')).toBe('动手试试看');
    expect(text('feedback-detail')).toBe(`拼出 ${c.n} 块`);
    expect(mockSounds).toEqual(['arrive', 'look']);
    expect(mockStage.current!.state).toBe(c.puzzle.initial);
  });

  test('right: "back to free play" and "one more"; one more deals another puzzle; back goes to free play; nothing is ever written', async () => {
    let s = finished(['ch1-n1', 'ch1-n2', 'ch1-n3']);
    const box = sandboxMaterial();
    const unit = [...box.units.keys()][0]!;
    const r = reduce(s, { type: 'saveSandbox', work: { ...box, bench: new Map([[unit, { x: 2, y: 2 }]]), tray: box.tray.map((t) => (t.unitId === unit ? { ...t, unitId: null } : t)) } });
    s = r.ok ? r.value : s;
    const raw = serialize(s);
    const storage = counted({ [STORAGE_KEY]: raw });
    await open(storage);
    expect(has('challenge-more')).toBe(false);
    await solve();
    expect(text('feedback-title')).toBe('拼对啦！');
    // The card says what was built (no next stop here).
    expect(text('feedback-detail')).not.toBe('可以去下一站啦');
    expect(has('next')).toBe(false);
    expect(text('challenge-more')).toContain('再来一题');
    expect(text('challenge-back')).toContain('回自由玩');
    const first = mockDealt[0]!.challenge;
    await press('challenge-more');
    expect(mockDealt).toHaveLength(2);
    const second = mockDealt[1]!.challenge;
    expect(`${second.kind}:${second.n}`).not.toBe(`${first.kind}:${first.n}`);
    expect(mockStage.current!.state).toBe(second.puzzle.initial);
    expect(has('challenge-more')).toBe(false);
    expect(text('feedback-title')).toBe('动手试试看');
    await solve();
    await press('challenge-back');
    expect(mockRouter.dismissTo).toHaveBeenLastCalledWith('/sandbox');
    // No progress command at all: the archive, free play's mat included, is as it was.
    expect(storage.writes).toEqual([]);
    expect(await storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  test('it follows progress: dealt for the stops the child has finished', async () => {
    const all = ['ch1-n1', 'ch1-n2', 'ch1-n3', 'ch1-n4', 'ch1-n5', 'ch1-n6', 'ch1-n13', 'ch1-n7', 'ch1-n14', 'ch1-n8', 'ch1-n15', 'ch1-n9', 'ch1-n16', 'ch1-n10', 'ch1-n17', 'ch1-n11', 'ch1-n12', 'ch2-n1'];
    await open(memoryStorage({ [STORAGE_KEY]: serialize(finished(all)) }));
    expect([...mockDealt[0]!.done].sort()).toEqual([...all].sort());
  });

  test('the menu: keep playing, help, undo and back to free play (no start over); English', async () => {
    await open(memoryStorage({ [STORAGE_KEY]: serialize({ ...createInitialState(7), language: 'en' }) }));
    await press('menu');
    expect(has('menu-close')).toBe(true);
    expect(has('menu-help')).toBe(true);
    expect(has('menu-undo')).toBe(true);
    expect(has('menu-restart')).toBe(false);
    expect(has('menu-map')).toBe(false);
    expect(text('menu-sandbox')).toContain('Back to free play');
    await press('menu-sandbox');
    expect(mockRouter.dismissTo).toHaveBeenLastCalledWith('/sandbox');
    await solve();
    expect(text('challenge-more')).toContain('One more');
    // English: the way back is the round free-play icon, so the row fits a phone.
    expect(container.querySelector('[data-testid="challenge-back"]')?.getAttribute('aria-label')).toBe('Back to free play');
    expect(text('challenge-back')).toBe('');
  });

  test('before progress loads nothing is drawn and nothing is dealt', async () => {
    const never: ProgressStorage = { getItem: () => new Promise(() => undefined), setItem: async () => undefined, removeItem: async () => undefined };
    await open(never);
    expect(mockDealt).toHaveLength(0);
    expect(has('prompt')).toBe(false);
  });
});
