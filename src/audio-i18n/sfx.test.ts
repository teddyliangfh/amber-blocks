import { countPitch, createAudioSfx, createSilentSfx, notesFor } from './sfx';
import type { SfxName } from './sfx';

const NAMES: ReadonlyArray<SfxName> = ['pickup', 'drop', 'return', 'blocked', 'count', 'counted', 'adjust', 'success', 'fanfare', 'arrive', 'tap'];

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
