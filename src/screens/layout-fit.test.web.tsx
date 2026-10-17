/**
 * The way on is on the screen, on every device in blocks-ui/devices.ts
 * (2026-10-16 review #1: the island page's only button sat below the fold on
 * a 375 × 553 phone; the landscape island button wrapped off the side column;
 * the stage's sand dune covered "next" on an iPad in landscape).
 *
 * jsdom has no layout engine, so this renders the real screens at each
 * device's size and checks what their layout rests on: the fixed rows of a
 * portrait level screen (from their computed styles) leave the stage exactly
 * what devices.ts says and hold the button; the button sits in a fixed row,
 * never in the stage or a scroll view; landscape uses the short label; the
 * dune takes no touches. The pixels are checked in a browser (tasks/todo.md
 * Phase 18).
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LEVEL_CHROME } from '../blocks-ui';
// Test-only device table (not part of the module's API).
import { PHONES, isCompact, stageSizeOf } from '../blocks-ui/devices';
import type { DeviceCase } from '../blocks-ui/devices';
import { apply } from '../core';
import type { BenchState } from '../core';
import { CHAPTERS, copyKey, format, materialize, nodeId } from '../content';
import { STORAGE_KEY, createInitialState, mapOrder, memoryStorage, reduce, serialize } from '../progress';
import type { ProgressState } from '../progress';
import { IslandDoneScreen } from './IslandDoneScreen';
import { LevelScreen } from './LevelScreen';
import { ProgressProvider } from './progress-store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => ({}) }));
jest.mock('./voice', () => ({ say: () => undefined, voice: { say: () => undefined, stop: () => undefined, isSupported: () => false } }));
jest.mock('./sound', () => ({ play: () => undefined, setSoundMuted: () => undefined, sfx: { isMuted: () => false } }));
// The gesture layer is not what is measured here.
jest.mock('../blocks-ui', () => ({ ...jest.requireActual('../blocks-ui'), Stage: () => null }));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

// The window react-native-web reports (no visualViewport in jsdom: it reads the root element).
function setWindow(width: number, height: number) {
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: width });
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: height });
  window.dispatchEvent(new Event('resize'));
}

function solved(ref: Parameters<typeof materialize>[0]): BenchState {
  const p = materialize(ref);
  return p.solution.reduce<BenchState>((w, cmd) => {
    const r = apply(w, cmd);
    return r.ok ? r.value : w;
  }, p.initial);
}

// Every stop finished; the two island-ending stops hold a right answer, the
// tallest finished state of the screen (play again + the island's button).
function everything(language: 'zh' | 'en'): ProgressState {
  let s: ProgressState = { ...createInitialState(5), language };
  for (const { nodeId: id } of mapOrder(CHAPTERS)) {
    const e = reduce(s, { type: 'enter', nodeId: id });
    if (!e.ok) {
      throw new Error(e.reason);
    }
    // Join Island ends at ch2-n8 since Phase 19.
    const work = id === 'ch1-n12' || id === 'ch2-n8' ? solved(e.value.nodes.get(id)!.ref) : undefined;
    const c = reduce(e.value, { type: 'complete', nodeId: id, verdict: { matched: true, benchCount: 1, reason: 'matched' }, work });
    if (!c.ok) {
      throw new Error(c.reason);
    }
    s = c.value;
  }
  return s;
}

const insetsOf = (d: DeviceCase) => d.insets ?? { top: 0, bottom: 0, left: 0, right: 0 };

async function render(d: DeviceCase, state: ProgressState, screen: React.ReactElement) {
  setWindow(d.width, d.height);
  await act(async () => {
    root.render(
      <GestureHandlerRootView>
        <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: d.width, height: d.height }, insets: insetsOf(d) }}>
          <ProgressProvider storage={memoryStorage({ [STORAGE_KEY]: serialize(state) })}>{screen}</ProgressProvider>
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
const px = (v: string) => (v === '' || v === 'auto' ? 0 : parseFloat(v));
const style = (el: Element) => getComputedStyle(el);
const height = (el: Element) => px(style(el).height);

// A pill button's height from its own styles: padding, border and one line of
// its label (Fredoka's normal line is 1.21 × the size; 1.25 to be safe).
function pillHeight(button: Element): number {
  const s = style(button);
  const label = button.querySelector('div[dir], div') ?? button;
  const fontSize = px(style(label).fontSize) || 19;
  return px(s.paddingTop) + px(s.paddingBottom) + px(s.borderTopWidth) + px(s.borderBottomWidth) + fontSize * 1.25;
}

function insideScroll(el: Element): boolean {
  for (let p = el.parentElement; p !== null; p = p.parentElement) {
    const o = style(p).overflowY;
    if (o === 'auto' || o === 'scroll') {
      return true;
    }
  }
  return false;
}

const LANGS = ['zh', 'en'] as const;
const STATES = { zh: everything('zh'), en: everything('en') };

describe.each(PHONES.map((d) => [d.name, d] as const))('%s', (_, d) => {
  const landscape = d.width > d.height;

  test.each(LANGS)('level page, island just finished (%s): the way on fits in a fixed row', async (lang) => {
    for (const stop of ['ch1-n12', 'ch2-n8']) {
      await render(d, STATES[lang], <LevelScreen nodeId={stop} />);
      const next = q('next')!;
      expect(next).not.toBeNull();
      expect(q('again')).not.toBeNull();
      expect(insideScroll(next)).toBe(false);
      expect(q('stage')!.contains(next)).toBe(false);
      if (landscape) {
        // The side column's short label, never the island's long name.
        expect(q('level-side')!.contains(next)).toBe(true);
        expect(next.textContent).toBe(format(copyKey('island.done.short'), lang));
      } else {
        const footer = q('level-footer')!;
        expect(footer.contains(next)).toBe(true);
        const c = isCompact(d) ? LEVEL_CHROME.compact : LEVEL_CHROME.regular;
        expect(height(q('level-header')!)).toBe(c.header);
        expect(height(footer)).toBe(c.footer);
        const card = q('answer-feedback')!;
        const fixed = height(q('level-header')!) + height(card) + px(style(card).marginBottom) + height(footer);
        const i = insetsOf(d);
        // What is left is the stage the layout tests size (devices.ts), and it is there.
        expect(d.height - i.top - i.bottom - fixed).toBe(stageSizeOf(d).height);
        expect(stageSizeOf(d).height).toBeGreaterThan(200);
        // The button (and the row it sits in) fits the footer.
        expect(pillHeight(next)).toBeLessThanOrEqual(height(footer));
      }
      // Scenery never takes a touch.
      const ground = q('ground');
      if (ground !== null) {
        expect(style(ground).pointerEvents).toBe('none');
      }
      act(() => root.unmount());
      root = createRoot(container);
    }
  });

  test.each(LANGS)('island page (%s): the button is fixed, never below a scroll', async (lang) => {
    for (const chapter of ['ch1', 'ch2']) {
      await render(d, STATES[lang], <IslandDoneScreen chapterId={chapter} />);
      const go = q('island-go')!;
      expect(go).not.toBeNull();
      if (landscape) {
        // Beside the line, at the top of the left column.
        expect(insideScroll(go)).toBe(true);
      } else {
        const footer = q('island-footer')!;
        expect(footer.contains(go)).toBe(true);
        expect(insideScroll(go)).toBe(false);
        expect(footer.parentElement).toBe(q('island-done'));
      }
      act(() => root.unmount());
      root = createRoot(container);
    }
  });
});

test('every device case is used: portrait and landscape, compact and not', () => {
  expect(PHONES.some((d) => d.width > d.height)).toBe(true);
  expect(PHONES.some(isCompact)).toBe(true);
  expect(PHONES.some((d) => d.width <= d.height && !isCompact(d))).toBe(true);
  expect(nodeId('ch1-n12')).toBe('ch1-n12');
});
