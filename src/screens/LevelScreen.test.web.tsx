/**
 * The real level screen and progress provider, rendered in jsdom with
 * react-native-web. Only the gesture layer (Stage) is replaced by a probe that
 * commits the same core commands a finished drag or tap would.
 */
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { StageProps } from '../blocks-ui';
import { CONTENT_VERSION, chapterId, materialize, nodeId } from '../content';
import type { Command, GroupId } from '../core';
import { STORAGE_KEY, UPGRADE_BACKUP_KEY, createInitialState, deserialize, memoryStorage, reduce, serialize } from '../progress';
import n10Unfinished from '../progress/__fixtures__/archive-v1-phase11-n10-unfinished.json';
import type { ProgressState, ProgressStorage } from '../progress';
import { COUNT_UP_STEP_MS, LevelScreen, SOLVE_SETTLE_MS } from './LevelScreen';
import { ProgressProvider, useProgress } from './progress-store';
import { PARENT_HINT_MS } from './ui';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

const mockSaid: string[] = [];
// Every voice call in order, with whether it cut off what was being said.
const mockVoice: string[] = [];
jest.mock('./voice', () => {
  const { format } = jest.requireActual('../content');
  return {
    say: (lang: 'zh' | 'en', key: string, params: Record<string, number> = {}, interrupt = true) => {
      const text = format(key, lang, params, { numbers: 'digit' });
      mockSaid.push(text);
      mockVoice.push(`${interrupt ? 'say' : 'queue'} ${text}`);
    },
    voice: { say: () => undefined, stop: () => mockVoice.push('stop'), isSupported: () => false },
  };
});

// These tests pin the voice machinery (timing, queueing, help levels) with
// every automatic line switched on; the shipping policy, sounds first and
// speech when asked, is LevelScreen.sound.test.web.tsx.
jest.mock('./speech-policy', () => ({ AUTO_SPEECH: { prompt: true, success: true, correction: true, countTotal: true, countNumbers: true } }));

const mockStage: { current: StageProps | null } = { current: null };

// Lets one test make the next materialize call fail, as a ref this build cannot play would.
const mockMaterialize = { failNext: false };
// COUNT_TO_PASS ships empty (a decision for Ted); one test fills it.
const mockCountToPass = new Set<string>();
jest.mock('../content', () => {
  const actual = jest.requireActual('../content');
  return {
    ...actual,
    get COUNT_TO_PASS() {
      return mockCountToPass;
    },
    materialize: (...args: Parameters<typeof actual.materialize>) => {
      if (mockMaterialize.failNext) {
        mockMaterialize.failNext = false;
        throw new Error('content: ref is for content version 999');
      }
      return actual.materialize(...args);
    },
  };
});
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
  // Timers run in step with the clock, so a test can also skip ahead (beat).
  jest.useFakeTimers({ advanceTimers: 1 });
  mockSaid.length = 0;
  mockVoice.length = 0;
  mockStage.current = null;
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

// Promises, then one macrotask (layout measurement is async on the web).
async function settle() {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

// Fake-timer tests commit inside synchronous act() calls; the saves those
// commits start settle on microtasks. Run them inside act before the test ends,
// so the provider's save result is never applied outside act.
async function flushSaves() {
  await act(async () => {
    await Promise.resolve();
  });
}

// The language switch lives in the parents' area (2026-10-15 review K); this
// probe flips it through the same provider while a stop is open.
const mockLanguage: { set: ((language: 'zh' | 'en') => void) | null } = { set: null };
function LanguageProbe() {
  const { dispatch } = useProgress();
  useEffect(() => {
    mockLanguage.set = (language) => dispatch({ type: 'setLanguage', language });
  }, [dispatch]);
  return null;
}

async function open(storage: ProgressStorage, id: string) {
  await act(async () => {
    root.render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ProgressProvider storage={storage}>
          <LevelScreen nodeId={id} />
          <LanguageProbe />
        </ProgressProvider>
      </SafeAreaProvider>,
    );
  });
  await settle();
}

async function command(cmd: Command): Promise<boolean> {
  let ok = false;
  await act(async () => {
    ok = mockStage.current!.onCommand(cmd);
  });
  await settle();
  return ok;
}

// The second beat of a solve (Phase 20 Q2): the paper, the number's own move
// and the way on come SOLVE_SETTLE_MS after the drop that made it right.
async function beat() {
  act(() => jest.advanceTimersByTime(SOLVE_SETTLE_MS));
  await settle();
}

async function press(testID: string) {
  const el = container.querySelector(`[data-testid="${testID}"]`) as HTMLElement | null;
  if (el === null) {
    throw new Error(`no ${testID}`);
  }
  await act(async () => {
    el.click();
  });
  await settle();
}

function has(testID: string): boolean {
  return container.querySelector(`[data-testid="${testID}"]`) !== null;
}

function badge(): string {
  return container.querySelector('[data-testid="prompt"]')?.textContent ?? '';
}

// Every stop up to (not including) `upTo` is finished; the stop itself not yet entered.
function unlockedTo(upTo: string, seed = 5): ProgressState {
  let s = createInitialState(seed);
  const order = ['ch1-n1', 'ch1-n2', 'ch1-n3', 'ch1-n4', 'ch1-n5', 'ch1-n6', 'ch1-n7', 'ch1-n8', 'ch1-n9', 'ch1-n10', 'ch1-n11', 'ch1-n12', 'ch2-n1', 'ch2-n2', 'ch2-n3', 'ch2-n4', 'ch2-n5', 'ch2-n6', 'ch2-n7', 'ch2-n8'];
  for (const id of order.slice(0, order.indexOf(upTo))) {
    const e = reduce(s, { type: 'enter', nodeId: nodeId(id) });
    const c = e.ok ? reduce(e.value, { type: 'complete', nodeId: nodeId(id), verdict: { matched: true, benchCount: 1, reason: 'matched' } }) : e;
    if (!c.ok) {
      throw new Error(c.reason);
    }
    s = c.value;
  }
  return { ...s, current: null };
}

function puzzleFor(id: string, seed = 5) {
  return materialize({ contentVersion: CONTENT_VERSION, chapterId: chapterId(id.slice(0, 3)), nodeId: nodeId(id), attemptVariant: 0, seed });
}

function partnerOf(id: string, size: number): GroupId {
  return [...puzzleFor(id).initial.groups.values()].find((g) => g.unitIds.length === size)!.id;
}

describe('LevelScreen integration (review P2 / teaching feedback)', () => {
  test('3 + 4 (ch2-n7: the 3 starts on the mat since Phase 19): one success per solve, the sum shown, rearranging stays quiet, counting walks both partners', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch2-n7')) });
    await open(storage, 'ch2-n7');
    expect(badge()).toBe('7');
    expect(mockSaid).toEqual(['已经有 3 了，再找一个伙伴，拼成 7']);
    // The 3 keeps its outline in the tray, beside the 4, 2 and 5.
    expect(mockStage.current?.trayObjects).toHaveLength(4);
    mockSaid.length = 0;

    expect(has('next')).toBe(false);
    const y = [...mockStage.current!.state.bench.values()][0]!.y;
    expect(await command({ type: 'takeGroup', groupId: partnerOf('ch2-n7', 4), origin: { x: 3, y } })).toBe(true);
    expect(mockSaid).toEqual(['3 加 4，一共 7']);
    expect(badge()).toBe('3 + 4 = 7');
    // Phase 20 Q2: the first beat is the sound and the smiles; the paper, the move and "next" follow.
    expect(mockStage.current?.mood).toBe('happy');
    expect(has('next')).toBe(false);
    expect(mockStage.current!.celebrateTick).toBe(0);
    await beat();
    expect(has('next')).toBe(true);
    expect(container.querySelector('[data-testid="feedback-title"]')?.textContent).toBe('拼对啦！');
    // The badge shows 3 + 4 = 7; the card says what comes next.
    expect(container.querySelector('[data-testid="feedback-detail"]')?.textContent).toBe('可以去下一站啦');
    expect(mockStage.current?.matched).toBe(true);
    const tick = mockStage.current!.celebrateTick;
    expect(tick).toBeGreaterThan(0);

    // Rearranging the right answer (the 3 tucks under the 4 and back): still right, no second
    // celebration, and the solve event is over, so moved or re-mounted blocks cannot replay the hop.
    expect(await command({ type: 'moveGroup', groupId: partnerOf('ch2-n7', 3), delta: { x: 3, y: 1 } })).toBe(true);
    expect(mockStage.current?.matched).toBe(true);
    expect(mockStage.current!.celebrateTick).toBe(0);
    expect(await command({ type: 'moveGroup', groupId: partnerOf('ch2-n7', 3), delta: { x: -3, y: -1 } })).toBe(true);
    expect(mockSaid).toEqual(['3 加 4，一共 7']);
    expect(mockStage.current!.celebrateTick).toBe(0);

    // Count all seven blocks through the partners; an eighth tap is ignored.
    mockSaid.length = 0;
    const bench = [...deserialize((await storage.getItem(STORAGE_KEY))!)!.nodes.get(nodeId('ch2-n7'))!.work!.bench.keys()];
    for (const u of bench) {
      await act(async () => mockStage.current!.onTapUnit(u));
    }
    await act(async () => mockStage.current!.onTapUnit(bench[0]!));
    expect(mockSaid).toEqual(['一', '二', '三', '四', '五', '六', '七', '一共 7 块']);
    expect(mockStage.current!.countOrder.get(bench[6]!)).toBe(7);
    expect(has('recount')).toBe(true);
    await press('recount');
    expect(mockStage.current!.countOrder.size).toBe(0);
    expect(has('recount')).toBe(false);
  });

  test('breaking a right answer turns the badge back and hides play again; next stays (2026-10-15); history still unlocks the map', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) });
    await open(storage, 'ch1-n2');
    const units = [...puzzleFor('ch1-n2').initial.units.keys()];
    expect(has('next')).toBe(false);
    await command({ type: 'take', unitId: units[0]!, to: { x: 0, y: 0 } });
    // Building towards the first solve: no way on yet.
    expect(has('next')).toBe(false);
    await command({ type: 'take', unitId: units[1]!, to: { x: 1, y: 0 } });
    await beat();
    expect(has('next')).toBe(true);
    expect(has('again')).toBe(true);
    await command({ type: 'take', unitId: units[2]!, to: { x: 2, y: 0 } });
    // One more block after solving: the card says what is there, the way on stays.
    expect(has('next')).toBe(true);
    expect(has('again')).toBe(false);
    expect(container.querySelector('[data-testid="feedback-title"]')?.textContent).toBe('多了 1 块');
    expect(mockStage.current?.matched).toBe(false);
    const saved = deserialize((await storage.getItem(STORAGE_KEY))!)!;
    expect(saved.completedNodeIds.has(nodeId('ch1-n2'))).toBe(true);
    // Building it right again is a new solve and speaks again.
    mockSaid.length = 0;
    await command({ type: 'return', unitId: units[2]! });
    expect(mockSaid).toEqual(['2，就是 2 块']);
  });

  test('review B: a finished stop keeps next after one more block, after a reload too, and next still moves on', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) });
    await open(storage, 'ch1-n2');
    const units = [...puzzleFor('ch1-n2').initial.units.keys()];
    await command({ type: 'take', unitId: units[0]!, to: { x: 0, y: 0 } });
    await command({ type: 'take', unitId: units[1]!, to: { x: 1, y: 0 } });
    await command({ type: 'take', unitId: units[2]!, to: { x: 2, y: 0 } });
    expect(has('next')).toBe(true);
    // Reload: the saved over-built work comes back, and so does the way on.
    act(() => root.unmount());
    root = createRoot(container);
    await open(storage, 'ch1-n2');
    expect(mockStage.current!.state.bench.size).toBe(3);
    expect(container.querySelector('[data-testid="feedback-title"]')?.textContent).toBe('多了 1 块');
    expect(has('next')).toBe(true);
    expect(has('again')).toBe(false);
    mockRouter.replace.mockClear();
    mockRouter.push.mockClear();
    // 2026-10-16 review: a wrong mat is not carried on. The button says "back
    // to the map" and goes there, with no hop to the next stop.
    expect(container.querySelector('[data-testid="next"]')?.textContent).toBe('回地图');
    await press('next');
    expect([...mockRouter.replace.mock.calls, ...mockRouter.push.mock.calls]).toEqual([['/']]);
    // Right again: the way on is the next stop once more.
    act(() => root.unmount());
    root = createRoot(container);
    await open(storage, 'ch1-n2');
    await command({ type: 'return', unitId: units[2]! });
    await beat();
    expect(container.querySelector('[data-testid="next"]')?.textContent).toBe('下一站');
    mockRouter.replace.mockClear();
    await press('next');
    expect(mockRouter.replace).toHaveBeenLastCalledWith({ pathname: '/', params: { from: 'ch1-n2', to: 'ch1-n3' } });
  });

  test('2026-10-16 review: on a finished island\'s last stop a wrong mat goes back to the map, not to the island page', async () => {
    mockRouter.replace.mockClear();
    // Join Island ends at ch2-n8 since Phase 19 (7 made two ways).
    const s = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch2-n8')) });
    await open(s, 'ch2-n8');
    const p = puzzleFor('ch2-n8');
    for (const cmd of p.solution) {
      expect(await command(cmd)).toBe(true);
    }
    await beat();
    expect(container.querySelector('[data-testid="next"]')?.textContent).toBe('合体岛完成了');
    // Send one partner back: wrong now.
    const partner = [...p.initial.groups.keys()].find((g) => mockStage.current!.state.bench.has(p.initial.groups.get(g)!.unitIds[0]!))!;
    expect(await command({ type: 'returnGroup', groupId: partner })).toBe(true);
    expect(container.querySelector('[data-testid="next"]')?.textContent).toBe('回地图');
    await press('next');
    expect(mockRouter.replace).toHaveBeenLastCalledWith('/');
  });

  test('review G: the faces on the mat agree with the card: calm while building, puzzled for a tip, happy when right', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) });
    await open(storage, 'ch1-n2');
    const units = [...puzzleFor('ch1-n2').initial.units.keys()];
    expect(mockStage.current!.mood).toBe('calm');
    await command({ type: 'take', unitId: units[0]!, to: { x: 0, y: 0 } });
    expect(mockStage.current!.mood).toBe('calm');
    await command({ type: 'take', unitId: units[1]!, to: { x: 1, y: 0 } });
    expect(mockStage.current!.mood).toBe('happy');
    await command({ type: 'take', unitId: units[2]!, to: { x: 2, y: 0 } });
    expect(container.querySelector('[data-testid="feedback-title"]')?.textContent).toBe('多了 1 块');
    expect(mockStage.current!.mood).toBe('puzzled');
    // Taking blocks back: right again, then still building.
    await command({ type: 'return', unitId: units[2]! });
    expect(mockStage.current!.mood).toBe('happy');
    await command({ type: 'return', unitId: units[1]! });
    expect(mockStage.current!.mood).toBe('calm');
  });

  test('COUNT_TO_PASS (2026-10-16 review A-1; ships empty): a listed stop solved the first time shows its way on once every block is counted', async () => {
    expect(jest.requireActual('../content').COUNT_TO_PASS.size).toBe(0);
    mockCountToPass.add('ch1-n2');
    try {
      const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) });
      await open(storage, 'ch1-n2');
      const units = [...puzzleFor('ch1-n2').initial.units.keys()];
      await command({ type: 'take', unitId: units[0]!, to: { x: 0, y: 0 } });
      await command({ type: 'take', unitId: units[1]!, to: { x: 1, y: 0 } });
      await beat();
      expect(mockStage.current!.matched).toBe(true);
      // Solved and recorded, but the way on waits for the count.
      expect(deserialize((await storage.getItem(STORAGE_KEY))!)!.completedNodeIds.has(nodeId('ch1-n2'))).toBe(true);
      expect(has('next')).toBe(false);
      expect(has('again')).toBe(false);
      await act(async () => mockStage.current!.onTapUnit(units[0]!));
      expect(has('next')).toBe(false);
      await act(async () => mockStage.current!.onTapUnit(units[1]!));
      expect(has('next')).toBe(true);
      expect(has('again')).toBe(true);
      // Finished before this visit: as before (D-038), no count asked.
      act(() => root.unmount());
      root = createRoot(container);
      await open(storage, 'ch1-n2');
      expect(mockStage.current!.matched).toBe(true);
      expect(has('next')).toBe(true);
    } finally {
      mockCountToPass.clear();
    }
  });

  test('review H / I: next goes through the map; the last stop of a finished island opens the island page', async () => {
    mockRouter.replace.mockClear();
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) });
    await open(storage, 'ch1-n2');
    const units = [...puzzleFor('ch1-n2').initial.units.keys()];
    await command({ type: 'take', unitId: units[0]!, to: { x: 0, y: 0 } });
    await command({ type: 'take', unitId: units[1]!, to: { x: 1, y: 0 } });
    await beat();
    expect(container.querySelector('[data-testid="next"]')?.textContent).toBe('下一站');
    await press('next');
    expect(mockRouter.replace).toHaveBeenLastCalledWith({ pathname: '/', params: { from: 'ch1-n2', to: 'ch1-n3' } });

    for (const [id, title, chapter] of [['ch1-n12', '数字岛完成了', 'ch1'], ['ch2-n8', '合体岛完成了', 'ch2']] as const) {
      act(() => root.unmount());
      root = createRoot(container);
      mockRouter.replace.mockClear();
      const s = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo(id)) });
      await open(s, id);
      for (const cmd of puzzleFor(id).solution) {
        expect(await command(cmd)).toBe(true);
      }
      await beat();
      expect(container.querySelector('[data-testid="next"]')?.textContent).toBe(title);
      await press('next');
      expect(mockRouter.replace).toHaveBeenLastCalledWith({ pathname: '/island/[chapterId]', params: { chapterId: chapter } });
    }
  });

  test('review L: the same 4 twice — the square hops and shows the line to make next; the line is the solve; a reload keeps it', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n6')) });
    await open(storage, 'ch1-n6');
    const p = puzzleFor('ch1-n6');
    const cells = () => [...container.querySelectorAll('[data-testid="template-preview"] > div')].length;
    const previewWidth = () => (container.querySelector('[data-testid="template-preview"]') as HTMLElement).style.width;
    const squareWidth = previewWidth();
    expect(cells()).toBeGreaterThanOrEqual(4);
    for (const cmd of p.solution.slice(0, 4)) {
      expect(await command(cmd)).toBe(true);
    }
    // One picture made: a hop, no paper, no way on yet; the line is the next thing to build and lights up.
    expect(mockStage.current!.celebrateTick).toBeGreaterThan(0);
    expect(mockStage.current!.matched).toBe(false);
    expect(mockStage.current!.mood).toBe('calm');
    expect(has('next')).toBe(false);
    expect(container.querySelector('[data-testid="feedback-title"]')?.textContent).toBe('变个样子！');
    expect(previewWidth()).not.toBe(squareWidth);
    expect(container.querySelector('[data-testid="template-preview"] [data-testid="spotlight"]')).not.toBeNull();
    expect(deserialize((await storage.getItem(STORAGE_KEY))!)!.completedNodeIds.has(nodeId('ch1-n6'))).toBe(false);
    for (const cmd of p.solution.slice(4)) {
      expect(await command(cmd)).toBe(true);
    }
    await beat();
    expect(container.querySelector('[data-testid="feedback-title"]')?.textContent).toBe('拼对啦！');
    expect(has('next')).toBe(true);
    expect(deserialize((await storage.getItem(STORAGE_KEY))!)!.completedNodeIds.has(nodeId('ch1-n6'))).toBe(true);
    // Reload: the line is still right, and the picture is the line's.
    act(() => root.unmount());
    root = createRoot(container);
    await open(storage, 'ch1-n6');
    expect(container.querySelector('[data-testid="feedback-title"]')?.textContent).toBe('拼对啦！');
    expect(previewWidth()).not.toBe(squareWidth);
  });

  test('review J: each stop hands the stage its own move; the bosses transform', async () => {
    for (const [id, move] of [['ch1-n1', 'spin'], ['ch1-n2', 'pair'], ['ch1-n10', 'stand'], ['ch1-n8', 'car'], ['ch1-n12', 'tall-wave'], ['ch2-n1', 'pair'], ['ch2-n7', 'spin']] as const) {
      act(() => root.unmount());
      root = createRoot(container);
      await open(memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo(id)) }), id);
      expect(`${id} ${mockStage.current!.cheer}`).toBe(`${id} ${move}`);
    }
  });

  test('play again: work cleared, answer feedback restarts, completion and later unlocks stay', async () => {
    const state = unlockedTo('ch1-n3');
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(state) });
    await open(storage, 'ch1-n1');
    const [u] = [...puzzleFor('ch1-n1').initial.units.keys()];
    await command({ type: 'take', unitId: u!, to: { x: 2, y: 2 } });
    await beat();
    expect(has('again')).toBe(true);
    mockSaid.length = 0;
    await press('again');
    // A finished stop played again keeps its way on (2026-10-15), plain until solved again.
    expect(has('next')).toBe(true);
    expect(has('again')).toBe(false);
    expect(mockStage.current!.state.bench.size).toBe(0);
    expect(mockSaid).toEqual(['拼出 1 块']);
    const saved = deserialize((await storage.getItem(STORAGE_KEY))!)!;
    expect(saved.nodes.get(nodeId('ch1-n1'))?.work).toBeNull();
    expect(saved.completedNodeIds.has(nodeId('ch1-n1'))).toBe(true);
    expect(saved.completedNodeIds.has(nodeId('ch1-n2'))).toBe(true);
    expect(mockStage.current!.celebrateTick).toBe(0);
    // And solving it again celebrates again, as a new event.
    mockSaid.length = 0;
    await command({ type: 'take', unitId: u!, to: { x: 0, y: 0 } });
    expect(mockSaid).toEqual(['1，就是 1 块']);
    expect(mockStage.current!.celebrateTick).toBe(0);
    await beat();
    expect(mockStage.current!.celebrateTick).toBeGreaterThan(0);
  });

  test('resuming right work shows it right without celebrating; switching language keeps the work', async () => {
    let state = unlockedTo('ch1-n2');
    const e = reduce(state, { type: 'enter', nodeId: nodeId('ch1-n1') });
    if (!e.ok) {
      throw new Error(e.reason);
    }
    state = e.value;
    const p = materialize(state.nodes.get(nodeId('ch1-n1'))!.ref);
    const [u] = [...p.initial.units.keys()];
    const work = { ...p.initial, bench: new Map([[u!, { x: 1, y: 1 }]]), tray: p.initial.tray.map((t) => (t.unitId === u ? { ...t, unitId: null } : t)) };
    const w = reduce(state, { type: 'saveWork', nodeId: nodeId('ch1-n1'), work });
    if (!w.ok) {
      throw new Error(w.reason);
    }
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(w.value) });
    await open(storage, 'ch1-n1');
    expect(has('next')).toBe(true);
    expect(mockSaid).toEqual(['拼出 1 块']);
    expect(mockStage.current!.celebrateTick).toBe(0);
    await act(async () => mockLanguage.set!('en'));
    await settle();
    expect(container.querySelector('[data-testid="feedback-title"]')?.textContent).toBe('You did it!');
    expect(mockStage.current!.state.bench.get(u!)).toEqual({ x: 1, y: 1 });
    expect(deserialize((await storage.getItem(STORAGE_KEY))!)!.language).toBe('en');
  });

  test('help on a partner stop never asks for a single block that cannot be taken', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch2-n4')) });
    await open(storage, 'ch2-n4');
    mockSaid.length = 0;
    await press('menu');
    await press('menu-help');
    expect(mockSaid).toEqual(['找两个伙伴，拼出 5']);
  });

  test('a stop that cannot be built shows the recovery view; starting again plays a fresh stop', async () => {
    mockMaterialize.failNext = true;
    try {
      // A fresh archive: nothing is built at load, so the screen's own build is the one that fails.
      const storage = memoryStorage({ [STORAGE_KEY]: serialize({ ...createInitialState(5), language: 'zh' }) });
      await open(storage, 'ch1-n1');
      expect(has('level-recovery')).toBe(true);
      await press('recovery-restart');
      expect(has('level-recovery')).toBe(false);
      expect(badge()).toBe('1');
      expect(deserialize((await storage.getItem(STORAGE_KEY))!)!.nodes.get(nodeId('ch1-n1'))?.ref.contentVersion).toBe(CONTENT_VERSION);
    } finally {
      mockMaterialize.failNext = false;
    }
  });

  test('wrong answers show and speak a useful correction; a quick fix cancels stale speech', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) });
    await open(storage, 'ch1-n2');
    const units = [...puzzleFor('ch1-n2').initial.units.keys()];
    jest.useFakeTimers();
    try {
      const take = (i: number) => act(() => { mockStage.current!.onCommand({ type: 'take', unitId: units[i]!, to: { x: i, y: 0 } }); });
      take(0);
      mockSaid.length = 0;
      act(() => jest.advanceTimersByTime(1000));
      expect(mockSaid).toEqual([]); // An unfinished build is not a wrong-answer announcement.
      take(1);
      take(2);
      expect(container.querySelector('[data-testid="feedback-title"]')?.textContent).toBe('多了 1 块');
      mockSaid.length = 0;
      act(() => jest.advanceTimersByTime(900));
      expect(mockSaid).toEqual(['比 2 多了，放回一块']);
      await act(async () => { mockStage.current!.onCommand({ type: 'return', unitId: units[2]! }); });
      take(2);
      await act(async () => { mockStage.current!.onCommand({ type: 'return', unitId: units[2]! }); });
      mockSaid.length = 0;
      act(() => jest.advanceTimersByTime(1000));
      expect(mockSaid).toEqual([]);
      expect(container.querySelector('[data-testid="feedback-title"]')?.textContent).toBe('拼对啦！');
      // The visible feedback is also an accessible repeat-hint button.
      await act(async () => { (container.querySelector('[data-testid="answer-feedback"]') as HTMLElement).click(); });
      // Phase 20 Q6: what was built, then what the card says.
      expect(mockSaid).toEqual(['2，就是 2 块', '可以去下一站啦']);
      await flushSaves();
    } finally {
      jest.useRealTimers();
    }
  });

  // Synchronous variants for fake-timer tests (settle() waits on real timers).
  function tapNow(testID: string) {
    const el = container.querySelector(`[data-testid="${testID}"]`) as HTMLElement | null;
    if (el === null) {
      throw new Error(`no ${testID}`);
    }
    act(() => el.click());
  }

  test('counting is never cut off: the correction waits for the last tap and queues behind the numbers', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) });
    await open(storage, 'ch1-n2');
    const units = [...puzzleFor('ch1-n2').initial.units.keys()];
    jest.useFakeTimers();
    try {
      for (let i = 0; i < 3; i += 1) {
        act(() => { mockStage.current!.onCommand({ type: 'take', unitId: units[i]!, to: { x: i, y: 0 } }); });
      }
      mockVoice.length = 0;
      // The child starts counting right away, one block every 600ms.
      for (let i = 0; i < 3; i += 1) {
        act(() => jest.advanceTimersByTime(600));
        act(() => mockStage.current!.onTapUnit(units[i]!));
      }
      act(() => jest.advanceTimersByTime(899));
      expect(mockVoice).toEqual(['queue 一', 'queue 二', 'queue 三', 'queue 一共 3 块']);
      act(() => jest.advanceTimersByTime(1));
      expect(mockVoice).toEqual(['queue 一', 'queue 二', 'queue 三', 'queue 一共 3 块', 'queue 比 2 多了，放回一块']);
      // Fixing it stops the correction that may still be queued, before the success line.
      act(() => { mockStage.current!.onCommand({ type: 'return', unitId: units[2]! }); });
      expect(mockVoice.slice(-2)).toEqual(['stop', 'say 2，就是 2 块']);
      await flushSaves();
    } finally {
      jest.useRealTimers();
    }
  });

  test('menu: holds the correction, help counts as hearing it, a language switch does not repeat it, outside tap closes', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) });
    await open(storage, 'ch1-n2');
    const units = [...puzzleFor('ch1-n2').initial.units.keys()];
    jest.useFakeTimers();
    try {
      for (let i = 0; i < 3; i += 1) {
        act(() => { mockStage.current!.onCommand({ type: 'take', unitId: units[i]!, to: { x: i, y: 0 } }); });
      }
      mockSaid.length = 0;
      tapNow('menu');
      act(() => jest.advanceTimersByTime(5000));
      expect(mockSaid).toEqual([]);
      tapNow('menu-help');
      expect(mockSaid).toEqual(['比 2 多了，放回一块']);
      act(() => mockLanguage.set!('en'));
      act(() => jest.advanceTimersByTime(5000));
      expect(mockSaid).toEqual(['比 2 多了，放回一块']);
      expect(container.querySelector('[data-testid="feedback-title"]')?.textContent).toBe('1 block too many');
      tapNow('menu');
      expect(has('menu-card')).toBe(true);
      tapNow('menu-backdrop');
      expect(has('menu-card')).toBe(false);
      await flushSaves();
    } finally {
      jest.useRealTimers();
    }
  });

  test('review K + D-072: the child menu has its things and the map; the gear opens the parents\' area only when held', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n3')) });
    await open(storage, 'ch1-n2');
    await press('menu');
    const items = [...container.querySelectorAll('[data-testid^="menu-"]')].map((e) => e.getAttribute('data-testid'));
    expect(items.filter((i) => i !== 'menu-backdrop' && i !== 'menu-card')).toEqual(['menu-close', 'menu-help', 'menu-undo', 'menu-restart', 'menu-map', 'menu-parent']);
    mockRouter.push.mockClear();
    const gear = container.querySelector('[data-testid="menu-parent"]') as HTMLElement;
    jest.useFakeTimers();
    try {
      // A tap: the menu stays open and only the hold hint shows, for PARENT_HINT_MS (D-073).
      act(() => {
        gear.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        jest.advanceTimersByTime(150);
        gear.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        gear.click();
      });
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(has('menu-card')).toBe(true);
      expect(container.querySelector('[data-testid="menu-parent-hint"]')?.textContent).toBe('按住进入家长区');
      act(() => jest.advanceTimersByTime(PARENT_HINT_MS));
      expect(has('menu-parent-hint')).toBe(false);
      expect(has('menu-card')).toBe(true);
      // Held for 600ms: the parents' area.
      act(() => {
        gear.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        jest.advanceTimersByTime(650);
        gear.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      });
      expect(mockRouter.push).toHaveBeenCalledWith('/parent');
      expect(has('menu-card')).toBe(false);
      await flushSaves();
    } finally {
      jest.useRealTimers();
    }
  });

  test('D-072: the menu goes back to the map from an unfinished stop too, and stops the voice first', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n3')) });
    await open(storage, 'ch1-n3');
    await press('menu');
    const items = [...container.querySelectorAll('[data-testid^="menu-"]')].map((e) => e.getAttribute('data-testid'));
    expect(items.filter((i) => i !== 'menu-backdrop' && i !== 'menu-card')).toEqual(['menu-close', 'menu-help', 'menu-undo', 'menu-map', 'menu-parent']);
    expect(container.querySelector('[data-testid="menu-map"]')?.textContent).toBe('回地图');
    mockRouter.dismissTo.mockClear();
    mockRouter.replace.mockClear();
    mockVoice.length = 0;
    await press('menu-map');
    expect(mockVoice).toEqual(['stop']);
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(has('menu-card')).toBe(false);
    await flushSaves();
  });

  test('the feedback card says what it shows: the task on an empty bench', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) });
    await open(storage, 'ch1-n2');
    mockSaid.length = 0;
    await press('answer-feedback');
    expect(container.querySelector('[data-testid="feedback-detail"]')?.textContent).toBe('拼出 2 块');
    expect(mockSaid).toEqual(['拼出 2 块']);
  });

  function detail(): string {
    return container.querySelector('[data-testid="feedback-detail"]')?.textContent ?? '';
  }

  test('review: asked-for help names the partner and lights it; the line said on its own does not; any move clears it', async () => {
    // ch2-n7 (3 + ? = 7 since Phase 19): the 3 goes back, a 4 and a 2 come out instead.
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch2-n7')) });
    await open(storage, 'ch2-n7');
    jest.useFakeTimers();
    try {
      act(() => { mockStage.current!.onCommand({ type: 'returnGroup', groupId: partnerOf('ch2-n7', 3) }); });
      act(() => { mockStage.current!.onCommand({ type: 'takeGroup', groupId: partnerOf('ch2-n7', 4), origin: { x: 0, y: 0 } }); });
      act(() => { mockStage.current!.onCommand({ type: 'takeGroup', groupId: partnerOf('ch2-n7', 2), origin: { x: 4, y: 0 } }); });
      expect(detail()).toBe('找两个伙伴，拼出 7');
      mockSaid.length = 0;
      act(() => jest.advanceTimersByTime(900));
      expect(mockSaid).toEqual(['找两个伙伴，拼出 7']);
      expect(mockStage.current!.spotlight ?? []).toEqual([]);
      // Phase 20 Q3, the help ladder. The first tap: the card's own line again,
      // and the six blocks on the mat get their numbers one by one, no words.
      tapNow('answer-feedback');
      expect(mockSaid).toEqual(['找两个伙伴，拼出 7', '找两个伙伴，拼出 7']);
      expect(detail()).toBe('找两个伙伴，拼出 7');
      expect(mockStage.current!.countOrder.size).toBe(0);
      for (let i = 1; i <= 6; i += 1) {
        act(() => jest.advanceTimersByTime(COUNT_UP_STEP_MS));
        expect(mockStage.current!.countOrder.size).toBe(i);
      }
      expect([...mockStage.current!.countOrder.values()]).toEqual([1, 2, 3, 4, 5, 6]);
      expect(mockSaid).toHaveLength(2);
      // The second: only what to send back.
      tapNow('answer-feedback');
      expect(detail()).toBe('把 2 送回去');
      expect(mockStage.current!.spotlight).toEqual([partnerOf('ch2-n7', 2)]);
      // The third: the whole help, the 2 to send back and the 3 to bring lit and named.
      tapNow('answer-feedback');
      expect(mockSaid.slice(2)).toEqual(['把 2 送回去', '把 2 送回去，换 3 过来']);
      expect(detail()).toBe('把 2 送回去，换 3 过来');
      expect(mockStage.current!.spotlight).toEqual([partnerOf('ch2-n7', 2), partnerOf('ch2-n7', 3)]);
      // Doing it: the 3 to bring stays lit until the next move (Q4); the numbers
      // are gone; the card goes back to describing the bench, and never says how
      // many are missing (that is the answer, Phase 19).
      act(() => { mockStage.current!.onCommand({ type: 'returnGroup', groupId: partnerOf('ch2-n7', 2) }); });
      expect(mockStage.current!.spotlight).toEqual([partnerOf('ch2-n7', 3)]);
      expect(mockStage.current!.countOrder.size).toBe(0);
      expect(container.querySelector('[data-testid="feedback-title"]')?.textContent).toBe('还不到 7');
      expect(detail()).toBe('找两个伙伴，拼出 7');
      act(() => { mockStage.current!.onCommand({ type: 'takeGroup', groupId: partnerOf('ch2-n7', 3), origin: { x: 0, y: 1 } }); });
      expect(container.querySelector('[data-testid="feedback-title"]')?.textContent).toBe('拼对啦！');
      expect(mockStage.current!.spotlight).toEqual([]);
      await flushSaves();
    } finally {
      jest.useRealTimers();
    }
  });

  test('review: a slow drag holds the correction until the finger lets go', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) });
    await open(storage, 'ch1-n2');
    const units = [...puzzleFor('ch1-n2').initial.units.keys()];
    jest.useFakeTimers();
    try {
      for (let i = 0; i < 3; i += 1) {
        act(() => { mockStage.current!.onCommand({ type: 'take', unitId: units[i]!, to: { x: i, y: 0 } }); });
      }
      mockSaid.length = 0;
      act(() => mockStage.current!.onDragActive!(true));
      act(() => jest.advanceTimersByTime(4000));
      expect(mockSaid).toEqual([]);
      act(() => mockStage.current!.onDragActive!(false));
      act(() => jest.advanceTimersByTime(899));
      expect(mockSaid).toEqual([]);
      act(() => jest.advanceTimersByTime(1));
      expect(mockSaid).toEqual(['比 2 多了，放回一块']);
      await flushSaves();
    } finally {
      jest.useRealTimers();
    }
  });

  test('review: on a shape stop the little picture lights up with the correction', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n3')) });
    await open(storage, 'ch1-n3');
    const units = [...puzzleFor('ch1-n3').initial.units.keys()];
    const picture = () => container.querySelector('[data-testid="template-preview"] [data-testid="spotlight"]');
    jest.useFakeTimers();
    try {
      for (let i = 0; i < 4; i += 1) {
        act(() => { mockStage.current!.onCommand({ type: 'take', unitId: units[i]!, to: { x: i, y: 0 } }); });
      }
      expect(container.querySelector('[data-testid="feedback-title"]')?.textContent).toBe('数量对了，再看看形状');
      expect(detail()).toBe('照着小图摆一摆');
      expect(picture()).toBeNull();
      act(() => jest.advanceTimersByTime(900));
      expect(picture()).not.toBeNull();
      await flushSaves();
    } finally {
      jest.useRealTimers();
    }
  });

  test('review: an old save from before the decoys opens 10 fresh with the new material; finished stops stay finished', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(n10Unfinished) });
    await open(storage, 'ch1-n10');
    expect(has('level-recovery')).toBe(false);
    expect(badge()).toBe('10');
    // Three partners (5, 5 and the decoy 4) and two spares; nothing left over from the old work.
    expect(mockStage.current!.trayObjects).toHaveLength(5);
    expect(mockStage.current!.state.bench.size).toBe(0);
    expect(container.querySelector('[data-testid="feedback-title"]')?.textContent).toBe('动手试试看');
    const five = [...mockStage.current!.state.groups.values()].find((g) => g.unitIds.length === 5)!;
    expect(await command({ type: 'takeGroup', groupId: five.id, origin: { x: 0, y: 0 } })).toBe(true);
    const saved = deserialize((await storage.getItem(STORAGE_KEY))!)!;
    expect(saved.contentVersion).toBe(CONTENT_VERSION);
    expect(saved.completedNodeIds.size).toBe(9);
    expect(await storage.getItem(UPGRADE_BACKUP_KEY)).toBe(JSON.stringify(n10Unfinished));
  });

  test('the static export renders this route with a placeholder id before progress loads: nothing throws', async () => {
    // A read that never answers keeps the provider loading, as during the static render.
    const pending: ProgressStorage = { ...memoryStorage(), getItem: () => new Promise<string | null>(() => undefined) };
    await open(pending, '[nodeId]');
    expect(container.querySelector('[data-testid="stage"]')).toBeNull();
    expect(mockStage.current).toBeNull();
  });
});

describe("Phase 19: who's missing (ch2-n5) and 7 made two ways (ch2-n8)", () => {
  const title = () => container.querySelector('[data-testid="feedback-title"]')?.textContent ?? '';
  const detailText = () => container.querySelector('[data-testid="feedback-detail"]')?.textContent ?? '';
  const nextText = () => container.querySelector('[data-testid="next"]')?.textContent ?? null;

  test('ch2-n5 opens with the 2 on the mat: the cloud says 5, the card gives the task, the hand carries the 3 to beside the 2', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch2-n5')) });
    await open(storage, 'ch2-n5');
    const p = puzzleFor('ch2-n5');
    expect(badge()).toBe('5');
    expect(title()).toBe('动手试试看');
    expect(detailText()).toBe('已经有 2 了，再找一个伙伴，拼成 5');
    // (Every automatic line is switched on in this file; the shipping policy is the sound test's.)
    expect(mockSaid).toEqual(['已经有 2 了，再找一个伙伴，拼成 5']);
    expect([...mockStage.current!.state.bench.keys()].sort()).toEqual([...p.initial.groups.get(p.given!)!.unitIds].sort());
    expect(mockStage.current!.mood).toBe('calm');
    expect(has('next')).toBe(false);
    // The hand: the missing 3, put down right beside the 2.
    const y = [...p.initial.bench.values()][0]!.y;
    expect(mockStage.current!.demoPiece).toBe(partnerOf('ch2-n5', 3));
    expect(mockStage.current!.demoTo).toEqual({ x: 2, y });
    jest.useFakeTimers();
    try {
      // A touch restarts the wait (under the fake clock); five quiet seconds bring the hand.
      act(() => {
        mockStage.current!.onDragActive!(true);
        mockStage.current!.onDragActive!(false);
      });
      expect(mockStage.current!.demo).toBe(0);
      act(() => jest.advanceTimersByTime(5000));
      expect(mockStage.current!.demo).toBe(1);
      // The drag that brings the other half puts the hand away, and it does not come back.
      act(() => {
        mockStage.current!.onDragActive!(true);
        mockStage.current!.onCommand(p.solution[0]!);
        mockStage.current!.onDragActive!(false);
      });
      act(() => jest.advanceTimersByTime(10000));
      expect(mockStage.current!.demo).toBe(0);
      await flushSaves();
    } finally {
      jest.useRealTimers();
    }
  });

  test('one move solves it, celebrated once: 2 + 3 = 5; rearranging stays quiet', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch2-n5')) });
    await open(storage, 'ch2-n5');
    mockSaid.length = 0;
    expect(await command(puzzleFor('ch2-n5').solution[0]!)).toBe(true);
    expect(badge()).toBe('2 + 3 = 5');
    expect(title()).toBe('拼对啦！');
    expect(mockSaid).toEqual(['2 加 3，一共 5']);
    await beat();
    expect(mockStage.current!.celebrateTick).toBeGreaterThan(0);
    expect(nextText()).toBe('下一站');
    expect(await command({ type: 'moveGroup', groupId: partnerOf('ch2-n5', 3), delta: { x: -2, y: 1 } })).toBe(true);
    expect(mockStage.current!.matched).toBe(true);
    expect(mockStage.current!.celebrateTick).toBe(0);
    expect(mockSaid).toEqual(['2 加 3，一共 5']);
    const saved = deserialize((await storage.getItem(STORAGE_KEY))!)!;
    expect(saved.completedNodeIds.has(nodeId('ch2-n5'))).toBe(true);
    expect(saved.album.get(nodeId('ch2-n5'))!.bench.size).toBe(5);
  });

  test('short of 5 the card never says by how much; asked-for help names and lights; a 4 too many; 1 + 4 is 5 too', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch2-n5')) });
    await open(storage, 'ch2-n5');
    const two = puzzleFor('ch2-n5').given!;
    const y = [...mockStage.current!.state.bench.values()][0]!.y;
    const of = (n: number) => partnerOf('ch2-n5', n);
    // The 4 beside the 2: one too many.
    await command({ type: 'takeGroup', groupId: of(4), origin: { x: 2, y } });
    expect(title()).toBe('多了 1 块');
    mockSaid.length = 0;
    // The help ladder (Phase 20 Q3): the card's line, then what to send back, then all of it.
    await press('answer-feedback');
    expect(detailText()).toBe('比 5 多了，把一个伙伴送回去');
    await press('answer-feedback');
    expect(detailText()).toBe('把 4 送回去');
    expect(mockStage.current!.spotlight).toEqual([of(4)]);
    await press('answer-feedback');
    expect(detailText()).toBe('把 4 送回去，换 3 过来');
    expect(mockSaid).toEqual(['比 5 多了，把一个伙伴送回去', '把 4 送回去', '把 4 送回去，换 3 过来']);
    expect(mockStage.current!.spotlight).toEqual([of(4), of(3)]);
    // The 4 and the 2 go back, the 3 comes alone: not 5 yet, never "3 more" or "2 more".
    await command({ type: 'returnGroup', groupId: of(4) });
    await command({ type: 'returnGroup', groupId: two });
    expect(title()).toBe('动手试试看');
    expect(detailText()).toBe('找两个伙伴，拼出 5');
    await command({ type: 'takeGroup', groupId: of(3), origin: { x: 0, y: 0 } });
    expect(title()).toBe('还不到 5');
    expect(container.textContent).not.toContain('还差');
    await press('answer-feedback');
    expect(detailText()).toBe('找两个伙伴，拼出 5');
    // Nothing to send back: the second ask is the whole help.
    await press('answer-feedback');
    expect(detailText()).toBe('把 2 搬过来');
    expect(mockStage.current!.spotlight).toEqual([two]);
    // 1 + 4 instead: right count, other partners, and it says so.
    await command({ type: 'returnGroup', groupId: of(3) });
    await command({ type: 'takeGroup', groupId: of(1), origin: { x: 0, y: 0 } });
    await command({ type: 'takeGroup', groupId: of(4), origin: { x: 1, y: 0 } });
    // Phase 20 F5: a discovery, on a blue card, with the small celebration.
    expect(title()).toBe('1 加 4 也是 5！');
    expect(detailText()).toBe('再找 2 和 3');
    expect(mockStage.current!.mood).toBe('calm');
    expect(mockStage.current!.cheer).toBe('hop');
    expect(mockStage.current!.celebrateTick).toBeGreaterThan(0);
    mockSaid.length = 0;
    await press('answer-feedback');
    expect(mockStage.current!.spotlight).toEqual([of(1), of(4)]);
    await press('answer-feedback');
    expect(detailText()).toBe('把 1 送回去');
    await press('answer-feedback');
    expect(detailText()).toBe('1 加 4 也是 5！再找 2 和 3');
    expect(mockSaid).toEqual(['再找 2 和 3', '把 1 送回去', '1 加 4 也是 5！再找 2 和 3']);
    expect(mockStage.current!.spotlight).toEqual([of(1), of(4), two, of(3)]);
  });

  test('7 made two ways: the first way hops (no paper, no next); moving it is not a second way; a reload carries on; the other way is the solve; the album keeps it', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch2-n8')) });
    await open(storage, 'ch2-n8');
    const of = (n: number) => partnerOf('ch2-n8', n);
    expect(badge()).toBe('7');
    expect(detailText()).toBe('找两个伙伴，拼出 7');
    mockSaid.length = 0;
    await command({ type: 'takeGroup', groupId: of(3), origin: { x: 0, y: 0 } });
    await command({ type: 'takeGroup', groupId: of(4), origin: { x: 3, y: 0 } });
    // A small celebration: the hop and the cloud, no success line, no way on.
    expect(mockStage.current!.cheer).toBe('hop');
    expect(mockStage.current!.celebrateTick).toBeGreaterThan(0);
    expect(mockStage.current!.matched).toBe(false);
    expect(has('next')).toBe(false);
    expect(has('again')).toBe(false);
    expect(mockSaid).toEqual([]);
    expect(badge()).toBe('7');
    expect(title()).toBe('换一种拼法！');
    expect(detailText()).toBe('再用另外两个伙伴拼出 7');
    expect(mockStage.current!.mood).toBe('calm');
    expect(deserialize((await storage.getItem(STORAGE_KEY))!)!.completedNodeIds.has(nodeId('ch2-n8'))).toBe(false);
    // The 3 tucks under the 4 and back: still the first way.
    await command({ type: 'moveGroup', groupId: of(3), delta: { x: 3, y: 1 } });
    await command({ type: 'moveGroup', groupId: of(3), delta: { x: -3, y: -1 } });
    expect(title()).toBe('换一种拼法！');
    expect(mockStage.current!.celebrateTick).toBe(0);
    expect(has('next')).toBe(false);
    // Asked for help: first the card's line, the 3 and the 4 lit; then (nothing to
    // send back) make another 7 beside them, the 5 and the 2 lit (Phase 20 Q1).
    await press('answer-feedback');
    expect(detailText()).toBe('再用另外两个伙伴拼出 7');
    expect(mockStage.current!.spotlight).toEqual([of(3), of(4)]);
    await press('answer-feedback');
    expect(detailText()).toBe('在旁边再拼一个 7');
    expect(mockStage.current!.spotlight).toEqual([of(5), of(2)]);
    // A reload carries on at the second way.
    act(() => root.unmount());
    root = createRoot(container);
    await open(storage, 'ch2-n8');
    expect(title()).toBe('换一种拼法！');
    expect(has('next')).toBe(false);
    // The other way: the solve, once, with the island's way on.
    mockSaid.length = 0;
    await command({ type: 'returnGroup', groupId: of(3) });
    expect(title()).toBe('换一种拼法！');
    await command({ type: 'returnGroup', groupId: of(4) });
    await command({ type: 'takeGroup', groupId: of(5), origin: { x: 0, y: 0 } });
    await command({ type: 'takeGroup', groupId: of(2), origin: { x: 5, y: 0 } });
    expect(mockSaid.filter((t) => t.includes('一共'))).toEqual(['5 加 2，一共 7']);
    expect(badge()).toBe('5 + 2 = 7');
    expect(mockStage.current!.matched).toBe(true);
    expect(mockStage.current!.cheer).not.toBe('hop');
    await beat();
    expect(mockStage.current!.celebrateTick).toBeGreaterThan(0);
    expect(nextText()).toBe('合体岛完成了');
    const saved = deserialize((await storage.getItem(STORAGE_KEY))!)!;
    expect(saved.completedNodeIds.has(nodeId('ch2-n8'))).toBe(true);
    const picture = saved.album.get(nodeId('ch2-n8'))!;
    expect([...picture.groups.values()].filter((g) => g.unitIds.every((u) => picture.bench.has(u))).map((g) => g.unitIds.length).sort()).toEqual([2, 5]);
  });
});

describe('Phase 20: two beats, two ways side by side, the 17 boss on an empty mat', () => {
  const title = () => container.querySelector('[data-testid="feedback-title"]')?.textContent ?? '';
  const detailText = () => container.querySelector('[data-testid="feedback-detail"]')?.textContent ?? '';

  test('Q2: a finger down holds the second beat; one block too many before it comes means it never comes', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) });
    await open(storage, 'ch1-n2');
    const units = [...puzzleFor('ch1-n2').initial.units.keys()];
    await command({ type: 'take', unitId: units[0]!, to: { x: 0, y: 0 } });
    await command({ type: 'take', unitId: units[1]!, to: { x: 1, y: 0 } });
    // Right: smiles and the card at once; recorded at once.
    expect(title()).toBe('拼对啦！');
    expect(mockStage.current!.mood).toBe('happy');
    expect(deserialize((await storage.getItem(STORAGE_KEY))!)!.completedNodeIds.has(nodeId('ch1-n2'))).toBe(true);
    // The child picks up the third block before the second beat: it waits.
    act(() => mockStage.current!.onDragActive!(true));
    await beat();
    await beat();
    expect(mockStage.current!.celebrateTick).toBe(0);
    expect(has('again')).toBe(false);
    // and puts it down: one too many. The paper never flies; the way on is the plain one.
    await command({ type: 'take', unitId: units[2]!, to: { x: 2, y: 0 } });
    act(() => mockStage.current!.onDragActive!(false));
    await beat();
    expect(title()).toBe('多了 1 块');
    expect(mockStage.current!.celebrateTick).toBe(0);
    expect(container.querySelector('[data-testid="next"]')?.textContent).toBe('回地图');
    // Back to right: a new solve. A finger lifted and let go without a change waits again, then it comes.
    await command({ type: 'return', unitId: units[2]! });
    act(() => mockStage.current!.onDragActive!(true));
    act(() => mockStage.current!.onDragActive!(false));
    act(() => jest.advanceTimersByTime(SOLVE_SETTLE_MS - 1));
    expect(mockStage.current!.celebrateTick).toBe(0);
    await beat();
    expect(mockStage.current!.celebrateTick).toBeGreaterThan(0);
    expect(container.querySelector('[data-testid="next"]')?.textContent).toBe('下一站');
  });

  test('Q1: 7 made two ways side by side: the cloud shows both, the stop is done, the album keeps both', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch2-n8')) });
    await open(storage, 'ch2-n8');
    const of = (n: number) => partnerOf('ch2-n8', n);
    await command({ type: 'takeGroup', groupId: of(3), origin: { x: 0, y: 0 } });
    await command({ type: 'takeGroup', groupId: of(4), origin: { x: 3, y: 0 } });
    expect(title()).toBe('换一种拼法！');
    await command({ type: 'takeGroup', groupId: of(5), origin: { x: 0, y: 2 } });
    // Beside the first way, the 5 alone is short of 7, not "7 too many".
    expect(title()).toBe('还不到 7');
    await command({ type: 'takeGroup', groupId: of(2), origin: { x: 5, y: 2 } });
    expect(title()).toBe('拼对啦！');
    expect(badge()).toBe('3 + 4 = 7\n5 + 2 = 7');
    await beat();
    expect(container.querySelector('[data-testid="next"]')?.textContent).toBe('合体岛完成了');
    const saved = deserialize((await storage.getItem(STORAGE_KEY))!)!;
    expect(saved.completedNodeIds.has(nodeId('ch2-n8'))).toBe(true);
    expect(saved.album.get(nodeId('ch2-n8'))!.bench.size).toBe(14);
    // Reopened: still right, still both.
    act(() => root.unmount());
    root = createRoot(container);
    await open(storage, 'ch2-n8');
    expect(title()).toBe('拼对啦！');
    expect(badge()).toBe('3 + 4 = 7\n5 + 2 = 7');
  });

  test('Q8: "play again" on a right mat can be undone: the mat comes back, right, without a second celebration; Q15: the menu is "菜单"', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n3')) });
    await open(storage, 'ch1-n1');
    const [u] = [...puzzleFor('ch1-n1').initial.units.keys()];
    await command({ type: 'take', unitId: u!, to: { x: 2, y: 2 } });
    await beat();
    await press('again');
    expect(mockStage.current!.state.bench.size).toBe(0);
    expect(container.querySelector('[data-testid="menu"]')?.getAttribute('aria-label')).toBe('菜单');
    await press('menu');
    await press('menu-undo');
    expect(mockStage.current!.state.bench.size).toBe(1);
    expect(title()).toBe('拼对啦！');
    expect(mockStage.current!.celebrateTick).toBe(0);
    expect(deserialize((await storage.getItem(STORAGE_KEY))!)!.nodes.get(nodeId('ch1-n1'))!.work!.bench.size).toBe(1);
    // Undo goes on from there, as before "play again": the block goes back.
    await press('menu');
    await press('menu-undo');
    expect(mockStage.current!.state.bench.size).toBe(0);
  });

  test('Q3: asking on the 17 boss\'s empty mat says the task, then to bring the biggest partner first, and lights the 10', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n12')) });
    await open(storage, 'ch1-n12');
    mockSaid.length = 0;
    await press('answer-feedback');
    expect(mockSaid).toEqual(['拼出 17 块', '先搬最大的伙伴']);
    expect(mockVoice.slice(-1)).toEqual(['queue 先搬最大的伙伴']);
    expect(mockStage.current!.spotlight).toEqual([partnerOf('ch1-n12', 10)]);
    expect(detailText()).toBe('拼出 17 块');
    // Phase 20 Q11: a partner tapped in the tray says its own number; no count, no change, no answer.
    mockSaid.length = 0;
    await act(async () => mockStage.current!.onTapTray!(10));
    expect(mockSaid).toEqual(['十']);
    expect(mockStage.current!.state.bench.size).toBe(0);
    expect(mockStage.current!.countOrder.size).toBe(0);
    // Not on an ordinary stop.
    act(() => root.unmount());
    root = createRoot(container);
    await open(memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n11')) }), 'ch1-n11');
    mockSaid.length = 0;
    await press('answer-feedback');
    expect(mockSaid).toEqual(['拼出 12 块']);
  });
});

describe('album (2026-10-15 review Q)', () => {
  // Every archive the provider writes, in order.
  function recording(initial: Readonly<Record<string, string>>) {
    const base = memoryStorage(initial);
    const writes: string[] = [];
    const storage: ProgressStorage = {
      ...base,
      setItem: (key, value) => {
        if (key === STORAGE_KEY) {
          writes.push(value);
        }
        return base.setItem(key, value);
      },
    };
    const last = () => deserialize(writes[writes.length - 1]!)!;
    return { storage, writes, last };
  }

  test('a right mat goes into the album in the same single write as the work and the completion; rearranged right replaces it; one block too many, undo and play again keep it', async () => {
    const { storage, writes, last } = recording({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) });
    await open(storage, 'ch1-n2');
    const [a, b, c] = [...puzzleFor('ch1-n2').initial.units.keys()];
    await command({ type: 'take', unitId: a!, to: { x: 0, y: 0 } });
    expect(last().album.size).toBe(0);
    let before = writes.length;
    await command({ type: 'take', unitId: b!, to: { x: 1, y: 0 } });
    expect(writes.length - before).toBe(1);
    const solved = last();
    expect(solved.completedNodeIds.has(nodeId('ch1-n2'))).toBe(true);
    expect([...solved.album.get(nodeId('ch1-n2'))!.bench.values()]).toEqual([{ x: 0, y: 0 }, { x: 1, y: 0 }]);
    expect(solved.album.get(nodeId('ch1-n2'))).toEqual(solved.nodes.get(nodeId('ch1-n2'))!.work);

    // Still right after moving: the new arrangement replaces the picture, still one write.
    before = writes.length;
    await command({ type: 'move', unitId: b!, to: { x: 0, y: 1 } });
    expect(writes.length - before).toBe(1);
    expect([...last().album.get(nodeId('ch1-n2'))!.bench.values()]).toEqual([{ x: 0, y: 0 }, { x: 0, y: 1 }]);
    const upright = last().album.get(nodeId('ch1-n2'));

    // One block too many: the work moves on, the picture stays.
    await command({ type: 'take', unitId: c!, to: { x: 2, y: 2 } });
    expect(last().nodes.get(nodeId('ch1-n2'))!.work!.bench.size).toBe(3);
    expect(last().album.get(nodeId('ch1-n2'))).toEqual(upright);
    // Undo back to the right mat: the same picture, nothing new.
    await press('menu');
    await press('menu-undo');
    expect(last().nodes.get(nodeId('ch1-n2'))!.work!.bench.size).toBe(2);
    expect(last().album.get(nodeId('ch1-n2'))).toEqual(upright);
    // Play again clears the mat, not the picture.
    await press('again');
    expect(mockStage.current!.state.bench.size).toBe(0);
    expect(last().nodes.get(nodeId('ch1-n2'))!.work).toBeNull();
    expect(last().album.get(nodeId('ch1-n2'))).toEqual(upright);
  });

  test('the same 4 twice: the square is not kept, the line is', async () => {
    const { storage, last } = recording({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n6')) });
    await open(storage, 'ch1-n6');
    const p = puzzleFor('ch1-n6');
    for (const cmd of p.solution.slice(0, 4)) {
      expect(await command(cmd)).toBe(true);
    }
    expect(container.querySelector('[data-testid="feedback-title"]')?.textContent).toBe('变个样子！');
    expect(last().nodes.get(nodeId('ch1-n6'))!.work!.bench.size).toBe(4);
    expect(last().album.has(nodeId('ch1-n6'))).toBe(false);
    for (const cmd of p.solution.slice(4)) {
      expect(await command(cmd)).toBe(true);
    }
    const kept = last().album.get(nodeId('ch1-n6'))!;
    const cells = [...kept.bench.values()];
    // A line: four blocks in one row or one column.
    expect(cells).toHaveLength(4);
    expect(new Set(cells.map((q) => q.y)).size === 1 || new Set(cells.map((q) => q.x)).size === 1).toBe(true);
    expect(kept).toEqual(last().nodes.get(nodeId('ch1-n6'))!.work);
  });

  test('a stop saved right before the album existed fills its picture in on the next visit, once', async () => {
    let state = unlockedTo('ch1-n3');
    const p = materialize(state.nodes.get(nodeId('ch1-n2'))!.ref);
    const [a, b] = [...p.initial.units.keys()];
    const work = { ...p.initial, bench: new Map([[a!, { x: 1, y: 1 }], [b!, { x: 2, y: 1 }]]), tray: p.initial.tray.map((t) => (t.unitId === a || t.unitId === b ? { ...t, unitId: null } : t)) };
    const w = reduce(state, { type: 'saveWork', nodeId: nodeId('ch1-n2'), work });
    state = w.ok ? w.value : state;
    expect(state.album.size).toBe(0);
    const { storage, writes, last } = recording({ [STORAGE_KEY]: serialize(state) });
    await open(storage, 'ch1-n2');
    expect(writes).toHaveLength(1);
    expect(last().album.get(nodeId('ch1-n2'))).toEqual(work);
    expect(mockStage.current!.celebrateTick).toBe(0);
    // Again: already kept, nothing to write.
    act(() => root.unmount());
    root = createRoot(container);
    await open(storage, 'ch1-n2');
    expect(writes).toHaveLength(1);
  });
});
