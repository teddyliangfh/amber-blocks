/**
 * The block faces, rendered with react-native-web in jsdom.
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';

import { Face } from './Face';
import type { Mood } from './Face';

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

function render(mood: Mood) {
  act(() => root.render(<Face size={60} mood={mood} blush="pink" />));
  return container.querySelector(`[data-testid="face-${mood}"]`) as HTMLElement | null;
}

describe('Face moods (2026-10-15 review G: a wrong answer kept smiling)', () => {
  test('puzzled is its own face: tilted a little, more marks than calm (the brows), never the happy one', () => {
    const calm = render('calm');
    expect(calm).not.toBeNull();
    const calmMarks = calm!.querySelectorAll('div').length;
    const puzzled = render('puzzled');
    expect(puzzled).not.toBeNull();
    expect(container.querySelector('[data-testid="face-calm"]')).toBeNull();
    expect(getComputedStyle(puzzled!).transform).toContain('rotate(-7deg)');
    // Two brows on top of what calm has (calm's blinking lids wrapper aside).
    expect(puzzled!.querySelectorAll('div').length).toBeGreaterThan(calmMarks);
  });

  test('every mood renders', () => {
    for (const mood of ['calm', 'happy', 'sleepy', 'puzzled'] as const) {
      expect(render(mood)).not.toBeNull();
    }
  });
});
