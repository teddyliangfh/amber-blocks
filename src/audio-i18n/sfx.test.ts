import { COMPARE_STEP, JOIN_STEP, LOOK_AT, countPitch, createAudioSfx, createSilentSfx, notesFor } from './sfx';
import type { SfxName } from './sfx';

const NAMES: ReadonlyArray<SfxName> = ['pickup', 'drop', 'return', 'blocked', 'count', 'counted', 'adjust', 'success', 'fanfare', 'arrive', 'tap', 'join', 'launch', 'look', 'compare', 'boss-arrive'];

function fakeContext(state = 'suspended') {
  const started: { f: number; at: number }[] = [];
  const ctx = {
    currentTime: 1,
    state,
    destination: {},
    resumed: 0,
    resume() {
      this.resumed += 1;
      this.state = 'running';
      return Promise.resolve();
    },
    createOscillator() {
      let f = 0;
      return {
        type: 'sine' as OscillatorType,
        frequency: { setValueAtTime: (v: number) => (f = v), exponentialRampToValueAtTime: () => undefined },
        connect: () => undefined,
        start: (t: number) => started.push({ f, at: t }),
        stop: () => undefined,
      };
    },
    createGain() {
      return { gain: { setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined, exponentialRampToValueAtTime: () => undefined }, connect: () => undefined };
    },
  };
  return { ctx, started };
}

test('every sound is short, audible and different from the others', () => {
  const shapes = new Set<string>();
  for (const name of NAMES) {
    const notes = notesFor(name);
    expect(notes.length).toBeGreaterThan(0);
    const end = Math.max(...notes.map((n) => n.at + n.dur));
    expect(end).toBeLessThanOrEqual(1.3);
    for (const n of notes) {
      expect(n.f).toBeGreaterThan(100);
      expect(n.dur).toBeGreaterThan(0);
    }
    shapes.add(JSON.stringify(notes));
  }
  expect(shapes.size).toBe(NAMES.length);
});

test('success and adjust never sound alike: success climbs and ends high, adjust stays low', () => {
  const success = notesFor('success');
  const adjust = notesFor('adjust');
  expect(success[success.length - 1]!.f).toBeGreaterThan(1000);
  expect(Math.max(...adjust.map((n) => n.to ?? n.f))).toBeLessThan(500);
  // Pick-up rises, putting back falls.
  expect(notesFor('pickup')[0]!.to!).toBeGreaterThan(notesFor('pickup')[0]!.f);
  expect(notesFor('return')[0]!.to!).toBeLessThan(notesFor('return')[0]!.f);
});

test('the cloud\'s chime (Phase 23-0): two notes going up, under the success sound and shorter; it waits for the pop, the reminder does not and is quieter', () => {
  const open = notesFor('look');
  const again = notesFor('look', 2);
  expect(open[0]!.at).toBe(LOOK_AT);
  expect(again[0]!.at).toBe(0);
  expect(open[1]!.f).toBeGreaterThan(open[0]!.f);
  expect(open[0]!.f).toBeLessThan(notesFor('success')[0]!.f);
  const length = (ns: ReturnType<typeof notesFor>) => Math.max(...ns.map((n) => n.at + n.dur)) - Math.min(...ns.map((n) => n.at));
  expect(length(open)).toBeLessThan(length(notesFor('success')));
  expect(again[0]!.gain!).toBeLessThan(open[0]!.gain!);
});

test('counting climbs a major scale note by note and stays in a comfortable range up to 17', () => {
  let last = 0;
  for (let step = 1; step <= 17; step += 1) {
    const f = countPitch(step);
    expect(f).toBeGreaterThan(last);
    expect(f).toBeLessThan(1400);
    last = f;
  }
  expect(notesFor('count', 3)[0]!.f).toBe(countPitch(3));
});

test('plays through the context, resumes a suspended one, and respects mute', () => {
  const { ctx, started } = fakeContext();
  const sfx = createAudioSfx(() => ctx);
  // Nothing before the first touch wakes the player.
  sfx.play('success');
  expect(started.length).toBe(0);
  sfx.unlock();
  ctx.state = 'suspended';
  sfx.play('success');
  expect(ctx.resumed).toBe(2);
  expect(started.length).toBe(notesFor('success').length);
  sfx.setMuted(true);
  expect(sfx.isMuted()).toBe(true);
  sfx.play('drop');
  expect(started.length).toBe(notesFor('success').length);
  sfx.setMuted(false);
  sfx.play('drop');
  expect(started.length).toBe(notesFor('success').length + notesFor('drop').length);
});

test('no audio, a refused context or a throwing node is silence, never an error', () => {
  const none = createAudioSfx(() => null);
  none.unlock();
  expect(() => none.play('tap')).not.toThrow();
  const refused = createAudioSfx(() => {
    throw new Error('blocked');
  });
  refused.unlock();
  expect(() => refused.play('tap')).not.toThrow();
  const { ctx } = fakeContext('running');
  const broken = createAudioSfx(() => ({ ...ctx, createOscillator: () => { throw new Error('nope'); } }));
  broken.unlock();
  expect(() => broken.play('fanfare')).not.toThrow();
  const silent = createSilentSfx();
  silent.play('tap');
  silent.unlock();
  silent.setMuted(true);
  expect(silent.isMuted()).toBe(true);
});

test('unlock creates the context once and resumes it only when needed', () => {
  const { ctx } = fakeContext();
  let made = 0;
  const sfx = createAudioSfx(() => {
    made += 1;
    return ctx;
  });
  sfx.unlock();
  sfx.unlock();
  expect(made).toBe(1);
  expect(ctx.resumed).toBe(1);
});

test('Phase 20 F1: a join plays each part\'s counting note in turn, then the total\'s, longer, with its octave on top', () => {
  const notes = notesFor('join', 7, [3, 4]);
  expect(notes.map((n) => n.f)).toEqual([countPitch(3), countPitch(4), countPitch(7), countPitch(7) * 2]);
  expect(notes[1]!.at).toBeCloseTo(JOIN_STEP);
  expect(notes[2]!.at).toBeCloseTo(2 * JOIN_STEP);
  expect(notes[2]!.dur).toBeGreaterThan(notes[0]!.dur);
  // The total is the last thing heard.
  expect(Math.max(...notes.map((n) => n.at))).toBeGreaterThanOrEqual(notes[2]!.at);
  // Three parts (17 = 10 + 5 + 2): three notes, then 17.
  expect(notesFor('join', 17, [10, 5, 2]).map((n) => n.f).slice(0, 3)).toEqual([countPitch(10), countPitch(5), countPitch(2)]);
  // Played with its parts.
  const { ctx, started } = fakeContext('running');
  const sfx = createAudioSfx(() => ctx);
  sfx.unlock();
  sfx.play('join', 2, [1, 1]);
  expect(started.map((n) => n.f)).toEqual([countPitch(1), countPitch(1), countPitch(2), countPitch(2) * 2]);
});


test('Phase 22: the launch runs up the counting scale, note after note, and ends higher than it began', () => {
  const notes = notesFor('launch');
  const run = notes.slice(0, 8).map((n) => n.f);
  expect(run).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map(countPitch));
  for (let i = 1; i < run.length; i += 1) {
    expect(run[i]!).toBeGreaterThan(run[i - 1]!);
    expect(notes[i]!.at).toBeGreaterThan(notes[i - 1]!.at);
  }
  const last = notes[notes.length - 1]!;
  expect(last.to).toBeGreaterThan(last.f);
});

test('Phase 23c: a compare is the child\'s note then the rail\'s, a beat apart: high-low for more, low-high for fewer, one note twice for the same; a line-up its three going up', () => {
  const more = notesFor('compare', 2, [4]);
  expect(more.map((n) => n.f)).toEqual([countPitch(4), countPitch(2)]);
  expect(more.map((n) => n.at)).toEqual([0, COMPARE_STEP]);
  expect(notesFor('compare', 4, [2]).map((n) => n.f)).toEqual([countPitch(2), countPitch(4)]);
  const same = notesFor('compare', 3, [3]);
  expect(same[0]!.f).toBe(same[1]!.f);
  expect(notesFor('compare', 4, [1, 3]).map((n) => n.f)).toEqual([1, 3, 4].map(countPitch));
});

test('Phase 24: a boss\'s arrival is the fanfare\'s motif, three notes up and a long one, within 0.6 s and higher than the plain arrive', () => {
  const notes = notesFor('boss-arrive');
  const [a, b, c, d] = notes;
  expect(a!.f).toBeLessThan(b!.f);
  expect(b!.f).toBeLessThan(c!.f);
  expect(c!.f).toBeLessThan(d!.f);
  expect(d!.dur).toBeGreaterThanOrEqual(0.25);
  expect(Math.max(...notes.map((n) => n.at + n.dur))).toBeLessThanOrEqual(0.66);
  // The same first three notes as the boss's fanfare, in the same order.
  expect(notesFor('fanfare').slice(0, 4).map((n) => n.f)).toEqual([523.25, 523.25, 659.25, 783.99]);
  expect([a!.f, b!.f, c!.f]).toEqual([523.25, 659.25, 783.99]);
  expect(Math.max(...notesFor('arrive').map((n) => n.f))).toBeLessThan(d!.f);
});
