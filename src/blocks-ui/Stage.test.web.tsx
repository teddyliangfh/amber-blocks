/**
 * The real stage (gestures, faces, demo hand) rendered with react-native-web in jsdom.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CONTENT_VERSION, chapterId, materialize, nodeId } from '../content';
import { apply } from '../core';
import { bossOutlineCells } from './BossOutline';
import { computeGeometry } from './layout';
import { MERGE_BLINK_MS, MERGE_SEAM_MS } from './merge';
import { Stage } from './Stage';
import type { StageProps } from './Stage';
import { trayObjects } from './tray';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function puzzleOf(id: string) {
  return materialize({ contentVersion: CONTENT_VERSION, chapterId: chapterId(id.slice(0, 3)), nodeId: nodeId(id), attemptVariant: 0, seed: 11 });
}

function render(id: string, extra: Partial<StageProps> = {}) {
  const puzzle = puzzleOf(id);
  const objects = trayObjects(puzzle.initial);
  const geometry = computeGeometry(390, 576, puzzle.initial.bounds, objects.map((o) => o.footprint));
  const props: StageProps = {
    state: puzzle.initial,
    geometry,
    trayObjects: objects,
    enabled: true,
    countOrder: new Map(),
    matched: false,
    celebrateTick: 0,
    onCommand: () => true,
    onPreview: () => true,
    onTapUnit: () => undefined,
    ...extra,
  };
  act(() =>
    root.render(
      <GestureHandlerRootView>
        <Stage {...props} />
      </GestureHandlerRootView>,
    ),
  );
  return puzzle;
}

const all = (id: string) => container.querySelectorAll(`[data-testid="${id}"]`);

describe('Stage (2026-10-15 review D: the first partner stop showed one block)', () => {
  test('ch1-n10: the hand carries a whole 5, the first piece of the answer, never the decoy 4', () => {
    const puzzle = puzzleOf('ch1-n10');
    const first = puzzle.solution[0]!;
    expect(first.type).toBe('takeGroup');
    const groupId = first.type === 'takeGroup' ? (first.groupId as string) : '';
    expect(puzzle.initial.groups.get(first.type === 'takeGroup' ? first.groupId : ('' as never))!.unitIds).toHaveLength(5);
    render('ch1-n10', { demo: 1, demoPiece: groupId });
    expect(all('demo-hand')).toHaveLength(1);
    expect(all('demo-ghost')).toHaveLength(5);
  });

  test('Phase 21 ch2-n10: the hand carries the 2 from the mat back to the tray; without demoBack a piece on the mat is not carried', () => {
    const puzzle = puzzleOf('ch2-n10');
    const two = puzzle.onMat![2]! as string;
    // Nothing waits in the tray at the start: every partner is on the mat.
    render('ch2-n10', { demo: 1, demoPiece: two, demoBack: true });
    expect(all('demo-hand')).toHaveLength(1);
    expect(all('demo-ghost')).toHaveLength(2);
    render('ch2-n10', { demo: 1, demoPiece: two });
    expect(all('demo-hand')).toHaveLength(0);
  });

  test('Phase 22: the hand pulls a block of the row aside (a block on the mat with demoTo), or carries one home (demoBack); nothing without either', () => {
    const split = puzzleOf('ch3-n1');
    const last = [...split.initial.bench.entries()].sort(([, a], [, b]) => b.x - a.x)[0]![0] as string;
    render('ch3-n1', { demo: 1, demoPiece: last, demoTo: { x: 3, y: 1 } });
    expect(all('demo-hand')).toHaveLength(1);
    expect(all('demo-ghost')).toHaveLength(1);
    render('ch3-n1', { demo: 1, demoPiece: last });
    expect(all('demo-hand')).toHaveLength(0);
    const away = puzzleOf('ch3-n5');
    const right = [...away.initial.bench.entries()].sort(([, a], [, b]) => b.x - a.x)[0]![0] as string;
    render('ch3-n5', { demo: 1, demoPiece: right, demoBack: true });
    expect(all('demo-hand')).toHaveLength(1);
    expect(all('demo-ghost')).toHaveLength(1);
    // Five empty beds in the tray at the opening.
    expect(container.querySelectorAll('[data-testid="tray"]').length).toBe(1);
  });

  test('Phase 21 boss entrance: a row of n dashed cells across the middle with a sleeping face, the first lit ones filled; none without the prop', () => {
    render('ch2-n4', { outline: { n: 5, lit: 2 } });
    expect(all('boss-outline')).toHaveLength(1);
    expect(all('boss-cell-lit')).toHaveLength(2);
    expect(all('boss-cell')).toHaveLength(3);
    expect(all('boss-face')).toHaveLength(1);
    render('ch2-n4');
    expect(all('boss-outline')).toHaveLength(0);
    // In a row across the middle of the mat, wrapping only when too long.
    expect(bossOutlineCells({ cols: 6, rows: 3 }, 5)).toEqual([0, 1, 2, 3, 4].map((x) => ({ x, y: 1 })));
    expect(bossOutlineCells({ cols: 8, rows: 3 }, 7)).toEqual([0, 1, 2, 3, 4, 5, 6].map((x) => ({ x, y: 1 })));
    expect(bossOutlineCells({ cols: 3, rows: 4 }, 5)).toEqual([{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 0, y: 2 }, { x: 1, y: 2 }]);
  });

  test('D-097: past a first way, the outline lies off the way made: a free row not touching it, else the free row below, else above', () => {
    const row = (y: number) => [0, 1, 2, 3, 4, 5, 6].map((x) => ({ x, y }));
    const bounds = { cols: 8, rows: 3 };
    // Made on the middle row (the outline): both other rows touch it; the one below.
    expect(bossOutlineCells(bounds, 7, row(1))).toEqual(row(2));
    // Made on the top row: the bottom row does not touch it.
    expect(bossOutlineCells(bounds, 7, row(0))).toEqual(row(2));
    // Made on the bottom row: the top row.
    expect(bossOutlineCells(bounds, 7, row(2))).toEqual(row(0));
    // A 3 on the top row and a 4 under its end: only the bottom row is free.
    expect(bossOutlineCells(bounds, 7, [...row(0).slice(0, 3), ...[2, 3, 4, 5].map((x) => ({ x, y: 1 }))])).toEqual(row(2));
    render('ch2-n8', { outline: { n: 7, lit: 0, made: row(1) } });
    expect(all('boss-outline')).toHaveLength(1);
    expect(all('boss-cell')).toHaveLength(7);
  });

  test('a loose stop still shows one block; no demo number, no hand', () => {
    const puzzle = render('ch1-n2', { demo: 1 });
    expect(all('demo-ghost')).toHaveLength(1);
    void puzzle;
    render('ch1-n2', { demo: 0 });
    expect(all('demo-hand')).toHaveLength(0);
  });

  test('every partner wears its grip plate and its number; single blocks do not', () => {
    render('ch1-n10');
    expect(all('partner-grip')).toHaveLength(3);
    expect(all('partner-label')).toHaveLength(3);
    expect(all('block').length).toBe(2);
  });

  test('faces on the mat follow the mood; tray blocks doze', () => {
    const puzzle = puzzleOf('ch1-n2');
    const [a, b, c] = [...puzzle.initial.units.keys()];
    const state = {
      ...puzzle.initial,
      bench: new Map([[a!, { x: 0, y: 0 }], [b!, { x: 1, y: 0 }], [c!, { x: 2, y: 0 }]]),
      tray: puzzle.initial.tray.map((t) => ([a, b, c].includes(t.unitId!) ? { ...t, unitId: null } : t)),
    };
    render('ch1-n2', { state, mood: 'puzzled' });
    expect(all('face-puzzled')).toHaveLength(1);
    expect(all('face-sleepy')).toHaveLength(1);
    render('ch1-n2', { state });
    expect(all('face-puzzled')).toHaveLength(0);
    expect(all('face-calm')).toHaveLength(1);
  });

  test('review J: the 8 brick gets wheels for its drive on a solve; other moves do not', () => {
    const puzzle = puzzleOf('ch1-n8');
    const solved = puzzle.solution.reduce((st, cmd) => {
      const r = apply(st, cmd);
      return r.ok ? r.value : st;
    }, puzzle.initial);
    render('ch1-n8', { state: solved, matched: true, celebrateTick: 1, cheer: 'car' });
    expect(all('car-wheels')).toHaveLength(1);
    render('ch1-n8', { state: solved, matched: true, celebrateTick: 1, cheer: 'wave' });
    expect(all('car-wheels')).toHaveLength(0);
    // No solve event, no wheels.
    render('ch1-n8', { state: solved, matched: true, celebrateTick: 0, cheer: 'car' });
    expect(all('car-wheels')).toHaveLength(0);
  });
});

describe('Phase 20 F1: joined into one character', () => {
  const solved = (id: string) => {
    const puzzle = puzzleOf(id);
    return puzzle.solution.reduce((st, cmd) => {
      const r = apply(st, cmd);
      return r.ok ? r.value : st;
    }, puzzle.initial);
  };
  // Every badge on the stage, the tray's decoys too, in number order.
  const labels = () => [...all('partner-label')].map((l) => l.textContent).sort();
  const faces = () => all('face-happy').length;

  test('a right 1 + 1 opened already right is one 2 at once: one face, one badge, no seams', () => {
    render('ch2-n1', { state: solved('ch2-n1'), matched: true, mood: 'happy', merge: true });
    expect(labels()).toEqual(['2', '3']);
    expect(faces()).toBe(1);
    expect(all('merge-seam')).toHaveLength(0);
    // Not joined: two 1s, two faces, two badges.
    render('ch2-n1', { state: solved('ch2-n1'), matched: true, mood: 'happy', merge: false });
    expect(labels()).toEqual(['1', '1', '3']);
    expect(faces()).toBe(2);
  });

  test('the solve: seams light, then the faces turn and blink with the join sound, then one character makes the move', () => {
    jest.useFakeTimers();
    try {
      const joins: string[] = [];
      const onJoin = (parts: ReadonlyArray<number>, total: number) => joins.push(`${parts.join('+')}=${total}`);
      const state = solved('ch1-n8');
      render('ch1-n8', { state, matched: true, mood: 'happy', merge: false, onJoin, cheer: 'car' });
      expect(labels()).toEqual(['3', '4', '4']);
      render('ch1-n8', { state, matched: true, mood: 'happy', merge: true, celebrateTick: 1, onJoin, cheer: 'car' });
      act(() => jest.advanceTimersByTime(0));
      expect(all('merge-seam')).toHaveLength(4);
      expect(labels()).toEqual(['3', '4', '4']);
      // The wheels wait for the brick.
      expect(all('car-wheels')).toHaveLength(0);
      act(() => jest.advanceTimersByTime(MERGE_SEAM_MS));
      expect(all('merge-seam')).toHaveLength(0);
      expect(joins).toEqual(['4+4=8']);
      act(() => jest.advanceTimersByTime(MERGE_BLINK_MS));
      // One cyan 8 (the decoy 3 still waits in the tray), one face on the mat.
      expect(labels()).toEqual(['3', '8']);
      expect(faces()).toBe(1);
      expect(all('car-wheels')).toHaveLength(1);
      // Not again for the same solve: split and joined again, just the colour.
      render('ch1-n8', { state, matched: true, mood: 'happy', merge: false, celebrateTick: 1, onJoin, cheer: 'car' });
      act(() => jest.advanceTimersByTime(0));
      expect(labels()).toEqual(['3', '4', '4']);
      render('ch1-n8', { state, matched: true, mood: 'happy', merge: true, celebrateTick: 1, onJoin, cheer: 'car' });
      act(() => jest.advanceTimersByTime(0));
      expect(all('merge-seam')).toHaveLength(0);
      expect(labels()).toEqual(['3', '8']);
      expect(joins).toEqual(['4+4=8']);
    } finally {
      jest.useRealTimers();
    }
  });

  test('free play: a number pops up over a block; the bubble wears the badge\'s look', () => {
    render('ch1-n2', { bubbles: [{ at: { x: 1, y: 1 }, n: 3, tick: 1 }] });
    expect(all('number-bubble')).toHaveLength(1);
    expect(all('number-bubble-3')[0]!.textContent).toBe('3');
  });
});

