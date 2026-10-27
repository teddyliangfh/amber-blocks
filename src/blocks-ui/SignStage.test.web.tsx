/**
 * Compare Island's real stage (Phase 23d) rendered with react-native-web in jsdom:
 * the plates, the sides, the slot, the sign blocks, help's marks.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { roundOf } from '../content';
import type { SignRoundSpec } from '../content';
import { SignBlock, signBars } from './SignBlock';
import { SignStage } from './SignStage';
import type { SignStageProps } from './SignStage';
import { placeRound, signGeometry } from './sign-layout';

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

const all = (testID: string) => [...container.querySelectorAll(`[data-testid="${testID}"]`)];

function render(spec: SignRoundSpec, extra: Partial<SignStageProps> = {}) {
  const round = roundOf(spec);
  const geometry = signGeometry(375, 532, [round], 3, 'regular');
  const calls: string[] = [];
  const props: SignStageProps = {
    geometry,
    place: placeRound(geometry, round),
    roundKey: '0-0',
    signs: ['>', '<', '='],
    placed: null,
    verdict: null,
    enabled: true,
    moods: { left: 'calm', right: 'calm' },
    looks: { left: 0, right: 0 },
    cheer: { tick: 0, left: null, right: null },
    joined: false,
    counts: { left: new Map(), right: new Map() },
    spotlight: [],
    demo: null,
    shake: 0,
    onTapSign: (s) => calls.push(`tap ${s}`),
    onDropSign: (s) => calls.push(`drop ${s}`),
    onTakeOut: (s) => calls.push(`out ${s}`),
    onLift: (a) => calls.push(`lift ${a}`),
    onTapBlock: (side, i) => calls.push(`block ${side} ${i}`),
    onTapPlate: (side) => calls.push(`plate ${side}`),
    ...extra,
  };
  act(() =>
    root.render(
      <GestureHandlerRootView>
        <SignStage {...props} />
      </GestureHandlerRootView>,
    ),
  );
  return calls;
}

describe('SignStage (Phase 23d)', () => {
  test('two plates with the numbers, a block per unit, three sign blocks, an empty slot with its "?"', () => {
    render({ left: 4, right: 1 });
    expect(all('sign-plate-left')[0]!.textContent).toBe('4');
    expect(all('sign-plate-right')[0]!.textContent).toBe('1');
    expect(container.querySelectorAll('[data-testid^="sign-cell-left-"]')).toHaveLength(4);
    expect(container.querySelectorAll('[data-testid^="sign-cell-right-"]')).toHaveLength(1);
    expect(['>', '<', '='].map((s) => all(`sign-piece-${s}`).length)).toEqual([1, 1, 1]);
    expect(all('sign-slot')[0]!.textContent).toBe('?');
    // One face per number: the top block of each tower.
    expect(container.querySelectorAll('[data-testid="sign-side-left"] [data-testid^="face-"]')).toHaveLength(1);
  });

  test('partners wear their own colours and badges; once right they join into the number, but only up to 10 (JOIN_UP_TO)', () => {
    render({ left: { n: 3, parts: [2, 1] }, right: 3 });
    expect(all('sign-badge-left').map((b) => b.textContent)).toEqual(['2', '1']);
    expect(container.querySelectorAll('[data-testid="sign-side-left"] [data-testid^="face-"]')).toHaveLength(2);
    render({ left: { n: 3, parts: [2, 1] }, right: 3 }, { joined: true });
    expect(all('sign-badge-left')).toHaveLength(0);
    expect(container.querySelectorAll('[data-testid="sign-side-left"] [data-testid^="face-"]')).toHaveLength(1);
    // 12 as two 6s stays two 6s: joined, it would be 10's lilac like the 10 beside it.
    render({ left: { n: 12, parts: [6, 6], beside: true }, right: 10 }, { joined: true });
    expect(all('sign-badge-left').map((b) => b.textContent)).toEqual(['6', '6']);
  });

  test('a sign in the slot: the slot glows green when right; the faces say how it went; help lights a side and a sign; the hand comes', () => {
    render({ left: 2, right: 5 }, { placed: '<', verdict: 'right' });
    expect(all('sign-slot-right')).toHaveLength(1);
    expect(all('sign-slot-right')[0]!.textContent).toBe('');
    expect(container.querySelector('[data-testid="sign-piece-<"] [data-testid="sign-face-happy"]')).not.toBeNull();
    render({ left: 2, right: 5 }, { placed: '>', verdict: 'wrong', shake: 1 });
    expect(container.querySelector('[data-testid="sign-piece->"] [data-testid="sign-face-puzzled"]')).not.toBeNull();
    render({ left: 2, right: 5 }, { spotlight: ['right', '<'], demo: { sign: '<', tick: 1 } });
    expect(all('spotlight')).toHaveLength(2);
    expect(all('sign-demo')).toHaveLength(1);
  });

  test('counting numbers sit on the blocks; tapping a block or a plate tells the screen', () => {
    const calls = render({ left: 3, right: 1 }, { counts: { left: new Map([[0, 1], [1, 2]]), right: new Map() } });
    expect(all('sign-side-left')[0]!.textContent).toBe('12');
    expect(all('sign-side-right')[0]!.textContent).toBe('');
    act(() => (all('sign-cell-left-2')[0] as HTMLElement).click());
    act(() => (all('sign-plate-right')[0] as HTMLElement).click());
    expect(calls).toEqual(['block left 2', 'plate right']);
  });

  test('the glyphs: > and < are mirrored chevrons, = two level bars', () => {
    const gt = signBars('>');
    const lt = signBars('<');
    expect(gt.map((b) => b.deg)).toEqual(lt.map((b) => -b.deg));
    expect(signBars('=').map((b) => b.deg)).toEqual([0, 0]);
    act(() =>
      root.render(
        <GestureHandlerRootView>
          <SignBlock size={68} sign="=" ghost />
        </GestureHandlerRootView>,
      ),
    );
    expect(all('sign-block-=')).toHaveLength(1);
    expect(all('sign-face-calm')).toHaveLength(0);
  });
});
