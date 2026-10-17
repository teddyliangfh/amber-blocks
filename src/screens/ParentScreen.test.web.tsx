/**
 * The parent area after a content upgrade: says plainly what happened and which
 * stops start fresh, so a parent is never surprised by a reset stop.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { materialize, nodeId, sandboxMaterial } from '../content';
import type { ProgressState } from '../progress';
import { RESET_BACKUP_KEY, STORAGE_KEY, createInitialState, deserialize, memoryStorage, reduce, serialize } from '../progress';
import ch1Finished from '../progress/__fixtures__/archive-v1-phase11-ch1-finished.json';
import { ParentScreen } from './ParentScreen';
import { ProgressProvider } from './progress-store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockRouter = { replace: jest.fn(), push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('./voice', () => ({ say: () => undefined, voice: { say: () => undefined, stop: () => undefined, isSupported: () => false } }));

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

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

async function open(raw: string, storage = memoryStorage({ [STORAGE_KEY]: raw })) {
  await act(async () => {
    root.render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ProgressProvider storage={storage}>
          <ParentScreen />
        </ProgressProvider>
      </SafeAreaProvider>,
    );
  });
  for (let i = 0; i < 3; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

const text = (id: string) => container.querySelector(`[data-testid="${id}"]`)?.textContent ?? null;

describe('parent area after a content upgrade', () => {
  test('names the stops that start fresh and says finished stops are kept', async () => {
    await open(JSON.stringify(ch1Finished));
    expect(text('storage-status')).toBe('题库更新过，存档已自动升级，完成记录和语言都保留。');
    expect(text('storage-upgraded')).toBe('这些站更新过，之前摆的作品放不下了，已收起（完成记录还在），下次进去从头摆：数字岛 第 10 站、数字岛 第 12 站');
  });

  test('a save already on the current puzzles says nothing about upgrades', async () => {
    await open(JSON.stringify({ ...ch1Finished, contentVersion: 2, nodes: [] }));
    expect(text('storage-status')).toBe('进度会自动保存在这台设备的浏览器里。');
    expect(text('storage-upgraded')).toBeNull();
  });

  test('review K: the map is reached from here, not from the child menu', async () => {
    await open(JSON.stringify({ ...ch1Finished, contentVersion: 2, nodes: [] }));
    await act(async () => (container.querySelector('[data-testid="to-map"]') as HTMLElement).click());
    expect(mockRouter.dismissTo).toHaveBeenCalledWith('/');
  });

  test('review M: a parent picks an island or a stop to start from; only the current stop moves', async () => {
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(createInitialState(3)) });
    await open('', storage);
    expect(text('start-chosen')).toBe('现在从 数字岛 第 1 站 开始');
    await act(async () => (container.querySelector('[data-testid="start-ch2"]') as HTMLElement).click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(text('start-chosen')).toBe('现在从 合体岛 第 1 站 开始');
    let saved = deserialize((await storage.getItem(STORAGE_KEY))!)!;
    expect(saved.current).toBe('ch2-n1');
    expect(saved.completedNodeIds.size).toBe(0);
    await act(async () => (container.querySelector('[data-testid="start-ch1-n5"]') as HTMLElement).click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    saved = deserialize((await storage.getItem(STORAGE_KEY))!)!;
    expect(saved.current).toBe('ch1-n5');
    expect(saved.completedNodeIds.size).toBe(0);
    expect(text('start-chosen')).toBe('现在从 数字岛 第 5 站 开始');
    expect(container.querySelector('[data-testid="start-ch1-n5"]')?.getAttribute('aria-selected')).toBe('true');
  });
});

describe('reset progress (2026-10-15 review Q)', () => {
  test('clears the album with everything else', async () => {
    let s = createInitialState(3);
    const e = reduce(s, { type: 'enter', nodeId: nodeId('ch1-n1') });
    s = e.ok ? e.value : s;
    const p = materialize(s.nodes.get(nodeId('ch1-n1'))!.ref);
    const [u] = [...p.initial.units.keys()];
    const work = { ...p.initial, bench: new Map([[u!, { x: 1, y: 1 }]]), tray: p.initial.tray.map((t) => (t.unitId === u ? { ...t, unitId: null } : t)) };
    const c = reduce(s, { type: 'complete', nodeId: nodeId('ch1-n1'), verdict: { matched: true, benchCount: 1, reason: 'matched' }, work });
    s = c.ok ? c.value : s;
    expect(s.album.size).toBe(1);
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(s) });
    await open('', storage);
    for (const id of ['reset', 'reset-yes']) {
      await act(async () => (container.querySelector(`[data-testid="${id}"]`) as HTMLElement).click());
    }
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
    const saved = deserialize((await storage.getItem(STORAGE_KEY))!)!;
    expect(saved.album.size).toBe(0);
    expect(saved.completedNodeIds.size).toBe(0);
  });

  test('2026-10-16 review L-3: keeps the language the parent chose; everything else starts over', async () => {
    let s: ProgressState = { ...createInitialState(3), language: 'en' };
    const e = reduce(s, { type: 'enter', nodeId: nodeId('ch1-n1') });
    const c = e.ok ? reduce(e.value, { type: 'complete', nodeId: nodeId('ch1-n1'), verdict: { matched: true, benchCount: 1, reason: 'matched' } }) : e;
    s = c.ok ? c.value : s;
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(s) });
    await open('', storage);
    for (const id of ['reset', 'reset-yes']) {
      await act(async () => (container.querySelector(`[data-testid="${id}"]`) as HTMLElement).click());
    }
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
    const saved = deserialize((await storage.getItem(STORAGE_KEY))!)!;
    expect(saved.language).toBe('en');
    expect(saved.completedNodeIds.size).toBe(0);
    expect(saved.nodes.size).toBe(0);
  });

  test('clears the free-play mat too (2026-10-15 review O)', async () => {
    const box = sandboxMaterial();
    const [u] = [...box.units.keys()];
    const sandbox = { ...box, bench: new Map([[u!, { x: 2, y: 2 }]]), tray: box.tray.map((t) => (t.unitId === u ? { ...t, unitId: null } : t)) };
    const r = reduce(createInitialState(3), { type: 'saveSandbox', work: sandbox });
    const storage = memoryStorage({ [STORAGE_KEY]: serialize(r.ok ? r.value : createInitialState(3)) });
    expect(deserialize((await storage.getItem(STORAGE_KEY))!)!.sandbox!.bench.size).toBe(1);
    await open('', storage);
    for (const id of ['reset', 'reset-yes']) {
      await act(async () => (container.querySelector(`[data-testid="${id}"]`) as HTMLElement).click());
    }
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
    expect(deserialize((await storage.getItem(STORAGE_KEY))!)!.sandbox).toBeNull();
  });

  test('Phase 20 Q10: clearing is the plain button under the question, cancel the bright one; the cleared archive is kept aside and can come back before leaving', async () => {
    let s: ProgressState = createInitialState(3);
    const e = reduce(s, { type: 'enter', nodeId: nodeId('ch1-n1') });
    const c = e.ok ? reduce(e.value, { type: 'complete', nodeId: nodeId('ch1-n1'), verdict: { matched: true, benchCount: 1, reason: 'matched' } }) : e;
    s = c.ok ? c.value : s;
    const before = serialize(s);
    const storage = memoryStorage({ [STORAGE_KEY]: before });
    await open('', storage);
    const click = async (id: string) => act(async () => (container.querySelector(`[data-testid="${id}"]`) as HTMLElement).click());
    const settle = async () => {
      for (let i = 0; i < 3; i += 1) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
        });
      }
    };
    await click('reset');
    const confirm = container.querySelector('[data-testid="reset-confirm"]')!;
    // The question first, then cancel, then clear; cancel is the bright (accent) one.
    expect(confirm.textContent).toBe('确定要清空所有进度？作品册也会一起清空。取消清空');
    const bg = (id: string) => getComputedStyle(container.querySelector(`[data-testid="${id}"]`) as HTMLElement).backgroundColor;
    expect(bg('reset-no')).not.toBe(bg('reset-yes'));
    expect(bg('reset-yes')).toBe('rgb(255, 255, 255)');
    expect(text('reset-undo')).toBeNull();
    await click('reset-yes');
    await settle();
    expect(deserialize((await storage.getItem(STORAGE_KEY))!)!.completedNodeIds.size).toBe(0);
    expect(await storage.getItem(RESET_BACKUP_KEY)).toBe(before);
    expect(text('reset-undo')).toBe('撤销清空');
    expect(text('reset-cleared')).toContain('还可以撤销');
    await click('reset-undo');
    await settle();
    expect(deserialize((await storage.getItem(STORAGE_KEY))!)!.completedNodeIds.has(nodeId('ch1-n1'))).toBe(true);
    expect(text('reset-undo')).toBeNull();
  });
});
