/**
 * The shipping sound policy (D-036): sounds carry pick-up, drop, right and
 * wrong; the voice speaks only when the child asks, plus one number word per
 * counting tap. Same harness as LevelScreen.test.web.tsx: the real screen and
 * progress provider, the gesture layer replaced by a probe.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { StageProps } from '../blocks-ui';
import { CONTENT_VERSION, chapterId, materialize, nodeId } from '../content';
import type { GroupId } from '../core';
import { STORAGE_KEY, createInitialState, deserialize, memoryStorage, reduce, serialize } from '../progress';
import type { ProgressState, ProgressStorage } from '../progress';
import { CORRECTION_QUIET_MS } from './correction-voice';
import { CLOUD_NUDGE_MAX, CLOUD_NUDGE_MS, LevelScreen, NUDGE_AFTER_MS, SOLVE_SETTLE_MS } from './LevelScreen';
import { ParentScreen } from './ParentScreen';
import { ProgressProvider } from './progress-store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));

const mockSaid: string[] = [];
// Each voice.stop(), as how many lines had been said by then.
const mockStops: number[] = [];
jest.mock('./voice', () => {
  const { format } = jest.requireActual('../content');
  return {
    say: (lang: 'zh' | 'en', key: string, params: Record<string, number> = {}) => {
      mockSaid.push(format(key, lang, params, { numbers: 'digit' }));
    },
    voice: { say: () => undefined, stop: () => mockStops.push(mockSaid.length), isSupported: () => false },
  };
});

const mockSounds: string[] = [];
const mockMuted = { value: false };
jest.mock('./sound', () => ({
  play: (name: string, step?: number) => mockSounds.push(step === undefined ? name : `${name}:${step}`),
  setSoundMuted: (m: boolean) => {
    mockMuted.value = m;
  },
  sfx: { isMuted: () => mockMuted.value },
}));

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
  // Timers run in step with the clock, so a test can also skip ahead (beat).
  jest.useFakeTimers({ advanceTimers: 1 });
  mockSaid.length = 0;
  mockStops.length = 0;
  mockSounds.length = 0;
  mockMuted.value = false;
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

async function settle() {
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function open(storage: ProgressStorage, id: string) {
  await act(async () => {
    root.render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ProgressProvider storage={storage}>
          <LevelScreen nodeId={id} />
        </ProgressProvider>
      </SafeAreaProvider>,
    );
  });
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

// The second beat of a solve (Phase 20 Q2): the paper, the move and the way on.
async function beat() {
  act(() => jest.advanceTimersByTime(SOLVE_SETTLE_MS));
  await settle();
}

function text(testID: string): string {
  return container.querySelector(`[data-testid="${testID}"]`)?.textContent ?? '';
}

function puzzleFor(id: string, seed = 5) {
  return materialize({ contentVersion: CONTENT_VERSION, chapterId: chapterId(id.slice(0, 3)), nodeId: nodeId(id), attemptVariant: 0, seed });
}

function partnerOf(id: string, size: number): GroupId {
  return [...puzzleFor(id).initial.groups.values()].find((g) => g.unitIds.length === size)!.id;
}

function unlockedTo(upTo: string, seed = 5): ProgressState {
  let s = createInitialState(seed);
  const order = ['ch1-n1', 'ch1-n2', 'ch1-n3', 'ch1-n4', 'ch1-n5', 'ch1-n6', 'ch1-n13', 'ch1-n7', 'ch1-n14', 'ch1-n8', 'ch1-n15', 'ch1-n9', 'ch1-n16', 'ch1-n10', 'ch1-n17', 'ch1-n11', 'ch1-n12', 'ch2-n1', 'ch2-n2', 'ch2-n3', 'ch2-n9', 'ch2-n4', 'ch2-n10', 'ch2-n5', 'ch2-n6', 'ch2-n11', 'ch2-n13', 'ch2-n7', 'ch2-n12', 'ch2-n8', 'ch3-n1', 'ch3-n2', 'ch3-n3', 'ch3-n4', 'ch3-n5', 'ch3-n6', 'ch3-n7', 'ch3-n8'];
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

async function command(cmd: Parameters<StageProps['onCommand']>[0]): Promise<boolean> {
  let ok = false;
  await act(async () => {
    ok = mockStage.current!.onCommand(cmd);
  });
  await settle();
  return ok;
}

describe('LevelScreen sounds (D-036: sounds first, speech when asked)', () => {
  test('a stop opens with a sound, not a sentence; tapping the number says the task', async () => {
    await open(memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) }), 'ch1-n2');
    expect(mockSounds).toEqual(['arrive', 'look']);
    expect(mockSaid).toEqual([]);
    await press('prompt');
    expect(mockSaid).toEqual(['拼出 2 块']);
  });

  test("Phase 19: who's missing and two ways add no automatic speech; their new lines are said only when asked", async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch2-n8')) });
    await open(storage, 'ch2-n5');
    expect(mockSounds).toEqual(['arrive', 'look']);
    expect(mockSaid).toEqual([]);
    const four = partnerOf('ch2-n5', 4);
    const y = [...mockStage.current!.state.bench.values()][0]!.y;
    await command({ type: 'takeGroup', groupId: four, origin: { x: 2, y } });
    expect(mockSounds).toEqual(['arrive', 'look', 'adjust']);
    await command({ type: 'returnGroup', groupId: four });
    mockSounds.length = 0;
    await command(puzzleFor('ch2-n5').solution[0]!);
    expect(mockSounds).toEqual(['success']);
    expect(mockSaid).toEqual([]);
    await press('prompt');
    expect(mockSaid).toEqual(['已经有 2 了，再找一个伙伴，拼成 5']);

    act(() => root.unmount());
    root = createRoot(container);
    mockSaid.length = 0;
    mockSounds.length = 0;
    await open(storage, 'ch2-n8');
    await command({ type: 'takeGroup', groupId: partnerOf('ch2-n8', 3), origin: { x: 0, y: 0 } });
    await command({ type: 'takeGroup', groupId: partnerOf('ch2-n8', 4), origin: { x: 3, y: 0 } });
    // One way made: the success sound, the card says "another way", nothing spoken.
    expect(mockSounds).toEqual(['arrive', 'look', 'success']);
    expect(text('feedback-title')).toBe('换一种拼法！');
    // Sending the first way back is no mistake: no "hmm".
    await command({ type: 'returnGroup', groupId: partnerOf('ch2-n8', 3) });
    expect(mockSounds).toEqual(['arrive', 'look', 'success']);
    expect(mockSaid).toEqual([]);
    // The help ladder (Phase 20 Q3): the card's line first, then what to send back.
    await press('answer-feedback');
    expect(mockSaid).toEqual(['再用另外两个伙伴拼出 7']);
    await press('answer-feedback');
    expect(mockSaid).toEqual(['再用另外两个伙伴拼出 7', '把 4 送回去']);
  });

  test('Phase 21: the opening of "send the extra away" is no mistake: no "hmm"; sending the wrong one back is; the 2 back is the success', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch2-n10')) });
    await open(storage, 'ch2-n10');
    const p = puzzleFor('ch2-n10');
    const [, four, two] = p.onMat!;
    expect(mockSounds).toEqual(['arrive', 'look']);
    expect(mockSaid).toEqual([]);
    // Moving the 2 about on the mat is still the opening.
    await command({ type: 'moveGroup', groupId: two!, delta: { x: 0, y: -1 } });
    expect(mockSounds).toEqual(['arrive', 'look']);
    await command({ type: 'moveGroup', groupId: two!, delta: { x: 0, y: 1 } });
    await command({ type: 'returnGroup', groupId: four! });
    expect(mockSounds).toEqual(['arrive', 'look', 'adjust']);
    await command({ type: 'takeGroup', groupId: four!, origin: { x: 3, y: 1 } });
    mockSounds.length = 0;
    await command({ type: 'returnGroup', groupId: two! });
    expect(mockSounds).toEqual(['success']);
    expect(mockSaid).toEqual([]);
  });

  test('Phase 20 Q4: the shipping policy says no correction on its own, so doing the first step of asked-for help never cuts the help off', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch2-n5')) });
    await open(storage, 'ch2-n5');
    const four = partnerOf('ch2-n5', 4);
    const y = [...mockStage.current!.state.bench.values()][0]!.y;
    await command({ type: 'takeGroup', groupId: four, origin: { x: 2, y } });
    // The silent correction timer runs out while the child waits.
    act(() => jest.advanceTimersByTime(CORRECTION_QUIET_MS));
    expect(mockSaid).toEqual([]);
    for (let i = 0; i < 3; i += 1) {
      await press('answer-feedback');
    }
    expect(mockSaid[mockSaid.length - 1]).toBe('把 4 送回去，换 3 过来');
    // Sending the 4 back: the voice is not stopped, and the 3 stays lit.
    await command({ type: 'returnGroup', groupId: four });
    expect(mockStops).toEqual([]);
    expect(mockStage.current!.spotlight).toEqual([partnerOf('ch2-n5', 3)]);
  });

  test('right and wrong sound different; a wrong answer is not said, and its "hmm" plays once while it stays wrong', async () => {
    jest.useFakeTimers();
    try {
      const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) });
      await act(async () => {
        root.render(
          <SafeAreaProvider initialMetrics={metrics}>
            <ProgressProvider storage={storage}>
              <LevelScreen nodeId="ch1-n2" />
            </ProgressProvider>
          </SafeAreaProvider>,
        );
      });
      for (let i = 0; i < 5; i += 1) {
        await act(async () => {
          jest.advanceTimersByTime(1);
          await Promise.resolve();
        });
      }
      const units = [...puzzleFor('ch1-n2').initial.units.keys()];
      const take = (i: number, x = i, y = 0) => act(() => { mockStage.current!.onCommand({ type: 'take', unitId: units[i]!, to: { x, y } }); });
      mockSounds.length = 0;
      take(0);
      expect(mockSounds).toEqual([]); // Building towards the answer is not wrong.
      take(1);
      expect(mockSounds).toEqual(['success']);
      take(2);
      expect(text('feedback-title')).toBe('多了 1 块');
      expect(mockSounds).toEqual(['success', 'adjust']);
      // A fourth block (on the next row of the 3 × 3 mat): still wrong, no second "hmm".
      take(3, 0, 1);
      expect(text('feedback-title')).toBe('多了 2 块');
      expect(mockSounds).toEqual(['success', 'adjust']);
      // After the quiet wait the shape-free nudge happens, but nothing is said.
      act(() => jest.advanceTimersByTime(1500));
      expect(mockSaid).toEqual([]);
      // Asking (the card) still speaks the named help.
      act(() => (container.querySelector('[data-testid="answer-feedback"]') as HTMLElement).click());
      expect(mockSaid.length).toBe(1);
      await act(async () => {
        await Promise.resolve();
      });
    } finally {
      jest.useRealTimers();
    }
  });

  test('a boss plays the fanfare; counting climbs note by note, says each number, ends with a ta-da and says the total once (2026-10-15)', async () => {
    // The Join Island boss is 7 made two ways since Phase 19 (ch2-n8).
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch2-n8')) });
    await open(storage, 'ch2-n8');
    mockSounds.length = 0;
    await command({ type: 'takeGroup', groupId: partnerOf('ch2-n8', 3), origin: { x: 0, y: 0 } });
    await command({ type: 'takeGroup', groupId: partnerOf('ch2-n8', 4), origin: { x: 3, y: 0 } });
    // The first way is a step: the success sound, not yet the fanfare.
    expect(mockSounds).toEqual(['success']);
    await command({ type: 'returnGroup', groupId: partnerOf('ch2-n8', 3) });
    await command({ type: 'returnGroup', groupId: partnerOf('ch2-n8', 4) });
    await command({ type: 'takeGroup', groupId: partnerOf('ch2-n8', 5), origin: { x: 0, y: 0 } });
    mockSounds.length = 0;
    await command({ type: 'takeGroup', groupId: partnerOf('ch2-n8', 2), origin: { x: 5, y: 0 } });
    expect(mockSounds).toEqual(['fanfare']);
    expect(mockSaid).toEqual([]);
    mockSounds.length = 0;
    const bench = [...deserialize((await storage.getItem(STORAGE_KEY))!)!.nodes.get(nodeId('ch2-n8'))!.work!.bench.keys()];
    for (const u of bench) {
      await act(async () => mockStage.current!.onTapUnit(u));
    }
    expect(mockSounds).toEqual(['count:1', 'count:2', 'count:3', 'count:4', 'count:5', 'count:6', 'counted:7']);
    // The number words are unchanged; the total follows the last one, once.
    expect(mockSaid).toEqual(['一', '二', '三', '四', '五', '六', '七', '一共 7 块']);
    // Every counted block blinks together; more taps change nothing and say nothing.
    const wink = mockStage.current!.wink!;
    expect(wink).toBeGreaterThan(0);
    await act(async () => mockStage.current!.onTapUnit(bench[0]!));
    expect(mockSaid).toEqual(['一', '二', '三', '四', '五', '六', '七', '一共 7 块']);
    expect(mockStage.current!.wink).toBe(wink);
    // Counting again blinks on a new round only when it is finished again.
    await press('recount');
    expect(mockStage.current!.wink).toBe(0);
    for (const u of bench.slice(0, 6)) {
      await act(async () => mockStage.current!.onTapUnit(u));
    }
    expect(mockStage.current!.wink).toBe(0);
    await act(async () => mockStage.current!.onTapUnit(bench[6]!));
    expect(mockStage.current!.wink).toBeGreaterThan(wink);
    expect(mockSaid.filter((t) => t === '一共 7 块')).toHaveLength(2);
  });

  test('2026-10-16 review H-3: "count again" stops the old numbers at once; blocks taken off mid-count stop them too', async () => {
    // ch2-n7 opens with the 3 on the mat (Phase 19): the 4 joins it.
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch2-n7')) });
    await open(storage, 'ch2-n7');
    const row = [...mockStage.current!.state.bench.values()][0]!.y;
    expect(await command({ type: 'takeGroup', groupId: partnerOf('ch2-n7', 4), origin: { x: 3, y: row } })).toBe(true);
    const three = [...puzzleFor('ch2-n7').initial.groups.get(partnerOf('ch2-n7', 3))!.unitIds];
    const bench = [...mockStage.current!.state.bench.keys()];
    for (const u of bench) {
      await act(async () => mockStage.current!.onTapUnit(u));
    }
    expect(mockSaid).toEqual(['一', '二', '三', '四', '五', '六', '七', '一共 7 块']);
    mockStops.length = 0;
    await press('recount');
    // Stopped right then: nothing of the old round is left to say over the new one.
    expect(mockStops).toEqual([8]);
    // A new round: two numbers, then the 4 goes back to the tray.
    await act(async () => mockStage.current!.onTapUnit(three[0]!));
    await act(async () => mockStage.current!.onTapUnit(three[1]!));
    expect(mockSaid.slice(8)).toEqual(['一', '二']);
    mockStops.length = 0;
    await command({ type: 'returnGroup', groupId: partnerOf('ch2-n7', 4) });
    expect(mockStops[0]).toBe(10);
    // The mat changed, so counting starts over.
    await act(async () => mockStage.current!.onTapUnit(three[2]!));
    expect(mockSaid.slice(10)).toEqual(['一']);
  });

  test('2026-10-16 review B-3: a tip left alone for 3s makes the card\'s speaker pulse, once a visit, without a word', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) });
    await open(storage, 'ch1-n2');
    const units = [...puzzleFor('ch1-n2').initial.units.keys()];
    const speaker = () => container.querySelector('[data-testid^="feedback-speaker"]')?.getAttribute('data-testid');
    jest.useFakeTimers();
    try {
      for (let i = 0; i < 3; i += 1) {
        act(() => { mockStage.current!.onCommand({ type: 'take', unitId: units[i]!, to: { x: i, y: 0 } }); });
      }
      expect(text('feedback-title')).toBe('多了 1 块');
      act(() => jest.advanceTimersByTime(NUDGE_AFTER_MS - 100));
      expect(speaker()).toBe('feedback-speaker');
      // A counting tap is the child doing something: the wait starts again.
      act(() => mockStage.current!.onTapUnit(units[0]!));
      act(() => jest.advanceTimersByTime(NUDGE_AFTER_MS - 100));
      expect(speaker()).toBe('feedback-speaker');
      act(() => jest.advanceTimersByTime(100));
      expect(speaker()).toBe('feedback-speaker-nudge-1');
      // No words with it (the count word is the only line).
      expect(mockSaid).toEqual(['一']);
      // Put right, then wrong again: no second nudge this visit.
      act(() => { mockStage.current!.onCommand({ type: 'return', unitId: units[2]! }); });
      act(() => { mockStage.current!.onCommand({ type: 'take', unitId: units[2]!, to: { x: 2, y: 0 } }); });
      act(() => jest.advanceTimersByTime(10 * NUDGE_AFTER_MS));
      expect(speaker()).toBe('feedback-speaker-nudge-1');
      expect(mockSaid).toEqual(['一']);
      await act(async () => {
        await Promise.resolve();
      });
    } finally {
      jest.useRealTimers();
    }
  });

  test('a child who already asked the card for help gets no nudge', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) });
    await open(storage, 'ch1-n2');
    const units = [...puzzleFor('ch1-n2').initial.units.keys()];
    jest.useFakeTimers();
    try {
      for (let i = 0; i < 3; i += 1) {
        act(() => { mockStage.current!.onCommand({ type: 'take', unitId: units[i]!, to: { x: i, y: 0 } }); });
      }
      act(() => (container.querySelector('[data-testid="answer-feedback"]') as HTMLElement).click());
      act(() => jest.advanceTimersByTime(10 * NUDGE_AFTER_MS));
      expect(container.querySelector('[data-testid="feedback-speaker"]')).not.toBeNull();
      await act(async () => {
        await Promise.resolve();
      });
    } finally {
      jest.useRealTimers();
    }
  });

  test('the shipping policy: only counting numbers and the total speak on their own', async () => {
    const { AUTO_SPEECH } = jest.requireActual('./speech-policy');
    expect(AUTO_SPEECH).toEqual({ prompt: false, success: false, correction: false, countTotal: true, countNumbers: true });
  });

  test('the stage reports what a hand felt and it plays as a sound', async () => {
    await open(memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) }), 'ch1-n2');
    mockSounds.length = 0;
    act(() => {
      mockStage.current!.onFeel?.('pickup');
      mockStage.current!.onFeel?.('blocked');
    });
    expect(mockSounds).toEqual(['pickup', 'blocked']);
  });

  test('sounds switch off and on in the parents\' area; the child menu has no switch (2026-10-15 review K)', async () => {
    await open(memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) }), 'ch1-n2');
    await press('menu');
    expect(container.querySelector('[data-testid="menu-sound"]')).toBeNull();
    act(() => root.unmount());
    root = createRoot(container);
    await act(async () => {
      root.render(
        <SafeAreaProvider initialMetrics={metrics}>
          <ProgressProvider storage={memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n2')) })}>
            <ParentScreen />
          </ProgressProvider>
        </SafeAreaProvider>,
      );
    });
    await settle();
    expect(text('sound')).toBe('音效：开');
    await press('sound');
    expect(mockMuted.value).toBe(true);
    expect(text('sound')).toBe('音效：关');
    await press('sound');
    expect(mockMuted.value).toBe(false);
  });

  test('play again opens with the arrive sound and no sentence', async () => {
    await open(memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n3')) }), 'ch1-n1');
    const [u] = [...puzzleFor('ch1-n1').initial.units.keys()];
    await command({ type: 'take', unitId: u!, to: { x: 2, y: 2 } });
    await beat();
    mockSounds.length = 0;
    mockSaid.length = 0;
    await press('again');
    expect(mockSounds).toEqual(['arrive', 'look']);
    expect(mockSaid).toEqual([]);
  });
});

describe('Phase 22: Take-away Island sounds', () => {
  const row = (id: string) => [...puzzleFor(id).initial.bench.entries()].sort(([, a], [, b]) => a.x - b.x).map(([u]) => u);

  test('a split opens quietly; pulled apart is the success sound; the countdown sounds the count left at each step, the fanfare at the last and the launch on the second beat', async () => {
    await open(memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch3-n1')) }), 'ch3-n1');
    expect(mockSounds).toEqual(['arrive', 'look']);
    const three = row('ch3-n1');
    await command({ type: 'move', unitId: three[2]!, to: { x: 3, y: 1 } });
    expect(mockSounds).toEqual(['arrive', 'look', 'success']);
    expect(mockSaid).toEqual([]);
    act(() => root.unmount());
    root = createRoot(container);
    mockSounds.length = 0;
    await open(memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch3-n8')) }), 'ch3-n8');
    const five = row('ch3-n8');
    for (const u of [five[4], five[3], five[2]]) {
      await command({ type: 'return', unitId: u! });
    }
    expect(mockSounds).toEqual(['arrive', 'look', 'count:4', 'count:3', 'count:2']);
    await command({ type: 'return', unitId: five[1]! });
    expect(mockSounds.slice(5)).toEqual(['fanfare']);
    await beat();
    expect(mockSounds.slice(6)).toEqual(['launch']);
    expect(mockSaid).toEqual([]);
  });

  test('a take-away from partners: the wrong one sent home is the adjust sound once; the right one is success', async () => {
    await open(memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch3-n6')) }), 'ch3-n6');
    const [four, two] = puzzleFor('ch3-n6').onMat!;
    expect(mockSounds).toEqual(['arrive', 'look']);
    await command({ type: 'moveGroup', groupId: two!, delta: { x: 0, y: -1 } });
    expect(mockSounds).toEqual(['arrive', 'look']);
    await command({ type: 'returnGroup', groupId: four! });
    expect(mockSounds).toEqual(['arrive', 'look', 'adjust']);
    await command({ type: 'takeGroup', groupId: four!, origin: { x: 0, y: 1 } });
    await command({ type: 'returnGroup', groupId: two! });
    expect(mockSounds).toEqual(['arrive', 'look', 'adjust', 'success']);
  });
});

describe('Phase 23-0: the cloud says "look here"', () => {
  const nudgeMs = CLOUD_NUDGE_MS!;
  const reminders = () => mockSounds.filter((x) => x === 'look:2').length;
  const looksAt = () => container.querySelector('[data-testid^="cloud-look-"]')!.getAttribute('data-testid');
  const wait = async (ms: number) => {
    act(() => jest.advanceTimersByTime(ms));
    await settle();
  };

  test('each opening pops the cloud with the chime, once; untouched, it reminds before the hand and never with it, at most twice a visit', async () => {
    expect(nudgeMs).toBeLessThan(5000);
    await open(memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n3')) }), 'ch1-n3');
    expect(mockSounds).toEqual(['arrive', 'look']);
    expect(looksAt()).toBe('cloud-look-1-0');
    await wait(nudgeMs - 100);
    expect(reminders()).toBe(0);
    await wait(100);
    expect(reminders()).toBe(1);
    expect(looksAt()).toBe('cloud-look-1-1');
    expect(mockStage.current!.demo).toBe(0);
    // The hand comes at 5 s; the next reminder (due at 7 s) waits while it shows.
    await wait(5000 - nudgeMs);
    expect(mockStage.current!.demo).toBeGreaterThan(0);
    await wait(3000);
    expect(reminders()).toBe(1);
    // The hand gone, the wait starts again; then no more this visit.
    await wait(5000);
    expect(mockStage.current!.demo).toBe(0);
    await wait(nudgeMs);
    expect(reminders()).toBe(CLOUD_NUDGE_MAX);
    await wait(10 * nudgeMs);
    expect(reminders()).toBe(CLOUD_NUDGE_MAX);
    expect(mockSounds.filter((x) => x === 'look')).toEqual(['look']);
    expect(mockSaid).toEqual([]);
  });

  test('the first touch ends the reminders: a block put down, a drag begun, the cloud or the card tapped', async () => {
    const touches: ReadonlyArray<() => Promise<unknown>> = [
      () => command({ type: 'take', unitId: [...puzzleFor('ch1-n3').initial.units.keys()][0]!, to: { x: 1, y: 1 } }),
      async () => act(() => mockStage.current!.onDragActive!(true)),
      () => press('prompt'),
      () => press('answer-feedback'),
    ];
    for (const touch of touches) {
      act(() => root.unmount());
      root = createRoot(container);
      mockSounds.length = 0;
      await open(memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n3')) }), 'ch1-n3');
      await wait(1000);
      await touch();
      await wait(20 * nudgeMs);
      expect(reminders()).toBe(0);
      expect(looksAt()).toMatch(/-0$/);
    }
  });

  test('play again is a new opening: the chime again and the reminders start over; a stop opened already right reminds nothing', async () => {
    await open(memoryStorage({ [STORAGE_KEY]: serialize(unlockedTo('ch1-n3')) }), 'ch1-n1');
    for (const cmd of puzzleFor('ch1-n1').solution) {
      await command(cmd);
    }
    await beat();
    // Right now: nothing to point at.
    await wait(3 * nudgeMs);
    expect(reminders()).toBe(0);
    mockSounds.length = 0;
    await press('again');
    expect(mockSounds).toEqual(['arrive', 'look']);
    expect(looksAt()).toBe('cloud-look-2-0');
    await wait(nudgeMs);
    expect(reminders()).toBe(1);
  });
});
