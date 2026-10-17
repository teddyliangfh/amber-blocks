import { copyKey } from '../content';
import { CORRECTION_QUIET_MS, createCorrectionVoice } from './correction-voice';
import type { Line } from './hints';

const MORE: Line = { key: copyKey('hint.count-mismatch.more'), params: { n: 2 } };
const JOIN: Line = { key: copyKey('hint.not-one-cluster'), params: {} };

function setup() {
  const log: string[] = [];
  const cv = createCorrectionVoice({ stop: () => log.push('stop') });
  cv.setSpeaker((l) => {
    log.push(`say ${l.key}`);
    return true;
  });
  return { cv, log };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('correction voice timing', () => {
  test('speaks once, after the child has been still, and not again while the answer stays wrong', () => {
    const { cv, log } = setup();
    cv.answer(MORE);
    jest.advanceTimersByTime(CORRECTION_QUIET_MS - 1);
    expect(log).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(log).toEqual(['say hint.count-mismatch.more']);
    // Moving blocks around without changing what is wrong: nothing more.
    cv.answer(MORE);
    cv.activity();
    jest.advanceTimersByTime(5000);
    expect(log).toEqual(['say hint.count-mismatch.more']);
  });

  test('counting and further moves push the correction back instead of cutting in', () => {
    const { cv, log } = setup();
    cv.answer(MORE);
    for (let i = 0; i < 5; i += 1) {
      jest.advanceTimersByTime(600);
      cv.activity(); // a count tap every 600ms
    }
    expect(log).toEqual([]);
    jest.advanceTimersByTime(CORRECTION_QUIET_MS);
    expect(log).toEqual(['say hint.count-mismatch.more']);
  });

  test('a quick fix cancels the pending line; a fix after it was spoken stops it', () => {
    const { cv, log } = setup();
    cv.answer(MORE);
    jest.advanceTimersByTime(500);
    cv.answer(null);
    jest.advanceTimersByTime(5000);
    expect(log).toEqual([]);
    cv.answer(MORE);
    jest.advanceTimersByTime(CORRECTION_QUIET_MS);
    cv.answer(JOIN);
    expect(log).toEqual(['say hint.count-mismatch.more', 'stop']);
    jest.advanceTimersByTime(CORRECTION_QUIET_MS);
    expect(log).toEqual(['say hint.count-mismatch.more', 'stop', 'say hint.not-one-cluster']);
  });

  test('asking for the hint counts as hearing it; leaving the wrong answer and coming back is new', () => {
    const { cv, log } = setup();
    cv.answer(MORE);
    cv.heard(MORE);
    jest.advanceTimersByTime(5000);
    expect(log).toEqual([]);
    cv.answer(null);
    cv.answer(MORE);
    jest.advanceTimersByTime(CORRECTION_QUIET_MS);
    expect(log).toEqual(['say hint.count-mismatch.more']);
    // A line that is not the current correction does not silence it.
    cv.answer(JOIN);
    cv.heard(MORE);
    jest.advanceTimersByTime(CORRECTION_QUIET_MS);
    expect(log).toEqual(['say hint.count-mismatch.more', 'stop', 'say hint.not-one-cluster']);
  });

  test('an open menu holds the correction; closing it waits for quiet again; dispose cancels', () => {
    const { cv, log } = setup();
    cv.answer(MORE);
    jest.advanceTimersByTime(800);
    cv.pause(true);
    jest.advanceTimersByTime(5000);
    expect(log).toEqual([]);
    cv.pause(false);
    jest.advanceTimersByTime(CORRECTION_QUIET_MS - 1);
    expect(log).toEqual([]);
    cv.dispose();
    jest.advanceTimersByTime(5000);
    expect(log).toEqual([]);
  });

  test('review: a slow drag holds the correction until the finger lets go, menu and drag hold independently', () => {
    const { cv, log } = setup();
    cv.answer(MORE);
    jest.advanceTimersByTime(400);
    cv.pause(true, 'drag'); // the child picks a block up and moves it slowly
    jest.advanceTimersByTime(3000);
    expect(log).toEqual([]);
    cv.pause(true, 'menu');
    cv.pause(false, 'drag'); // still held: the menu is open
    jest.advanceTimersByTime(3000);
    expect(log).toEqual([]);
    cv.pause(false, 'menu');
    jest.advanceTimersByTime(CORRECTION_QUIET_MS - 1);
    expect(log).toEqual([]);
    jest.advanceTimersByTime(1);
    expect(log).toEqual(['say hint.count-mismatch.more']);
    // Letting go of a drag that was never held changes nothing.
    cv.answer(JOIN);
    cv.pause(false, 'drag');
    jest.advanceTimersByTime(CORRECTION_QUIET_MS);
    expect(log).toEqual(['say hint.count-mismatch.more', 'stop', 'say hint.not-one-cluster']);
  });

  test('Phase 20 Q4: a correction the speaker did not say out loud never stops what comes after it', () => {
    const log: string[] = [];
    const cv = createCorrectionVoice({ stop: () => log.push('stop') });
    // The shipping policy: automatic corrections are silent (AUTO_SPEECH.correction false).
    cv.setSpeaker(() => false);
    cv.answer(MORE);
    jest.advanceTimersByTime(CORRECTION_QUIET_MS);
    // The child asks, hears the help, and does its first step: the answer changes.
    cv.heard(MORE);
    cv.answer(JOIN);
    cv.answer(null);
    expect(log).toEqual([]);
  });
});
