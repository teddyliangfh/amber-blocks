/**
 * The real stage (gestures, faces, demo hand) rendered with react-native-web in jsdom.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { CONTENT_VERSION, chapterId, materialize, nodeId } from '../content';
import { apply } from '../core';
import { computeGeometry } from './layout';
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
