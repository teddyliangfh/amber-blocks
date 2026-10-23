// Short synthesized sound effects (Web Audio): no files, no network, nothing to
// load. Every sound is a few oscillator notes with a fast envelope, quiet enough
// to sit under the voice. A missing or refused AudioContext is silence, never an
// error (AC-16), and native is silent until it gets its own player.

export type SfxName =
  // A finger lifts a block or partner.
  | 'pickup'
  // It lands on the bench.
  | 'drop'
  // It goes back into the tray.
  | 'return'
  // Released where it cannot go: a soft bonk, not a "wrong".
  | 'blocked'
  // One counting tap; `step` is the counting number, the pitch climbs with it.
  | 'count'
  // The last block of a full count.
  | 'counted'
  // The answer on the bench needs changing.
  | 'adjust'
  // The answer is right.
  | 'success'
  // A boss stop is right.
  | 'fanfare'
  // A stop opens.
  | 'arrive'
  // A button press.
  | 'tap'
  // Pieces joining into one number (Phase 20 F1, and free play's groups
  // changing size): each part's counting note, then the total's with a
  // shimmer on top. `step` is the total, `parts` the parts.
  | 'join'
  // The countdown's last block launches (Phase 22): a run of notes going up.
  | 'launch'
  // "Look up here" (Phase 23-0): a soft two-note chime as the cloud pops at a
  // stop's opening, LOOK_AT seconds in. `step` 2: the cloud's later reminder,
  // at once and a little quieter.
  | 'look'
  // A compare solved (Phase 23c, design §5.3): each number's counting note, a
  // beat apart, the child's first (`parts`), the rail's last (`step`), so
  // "more" is heard high to low, "fewer" low to high, "the same" one note
  // twice. A line-up: its partners' notes, smallest first.
  | 'compare';

export interface Sfx {
  readonly play: (name: SfxName, step?: number, parts?: ReadonlyArray<number>) => void;
  // Creates or resumes the audio context; call it from inside a touch or click
  // handler (iOS Safari only starts audio from one). Nothing plays before it.
  readonly unlock: () => void;
  readonly setMuted: (muted: boolean) => void;
  readonly isMuted: () => boolean;
}

interface Note {
  // Hz at the start, and optionally where it glides to.
  readonly f: number;
  readonly to?: number;
  // Seconds after the sound starts.
  readonly at: number;
  readonly dur: number;
  readonly type?: OscillatorType;
  readonly gain?: number;
}

// Do re mi from middle C: each counting tap is the next note, so counting to
// 17 climbs about two and a half octaves and never repeats a pitch.
const MAJOR = [261.63, 293.66, 329.63, 349.23, 392.0, 440.0, 493.88];

export function countPitch(step: number): number {
  const i = Math.max(0, Math.floor(step) - 1);
  return (MAJOR[i % MAJOR.length] as number) * 2 ** Math.floor(i / MAJOR.length);
}

// Seconds the solve sounds wait so the drop's "clack" comes first.
export const SOLVE_AFTER = 0.1;

// Seconds into a stop's opening the cloud's chime sounds: as its pop peaks.
export const LOOK_AT = 0.45;

// Seconds between the notes of a join.
export const JOIN_STEP = 0.11;
// The beat between a compare's notes (Phase 23c): slow enough to hear two numbers.
export const COMPARE_STEP = 0.28;

export function notesFor(name: SfxName, step = 1, parts: ReadonlyArray<number> = []): ReadonlyArray<Note> {
  switch (name) {
    case 'join': {
      // 3 + 4: the note of 3, the note of 4, then the note of 7, longer, with
      // its octave above as a shimmer. The total is the last thing heard.
      const end = parts.length * JOIN_STEP;
      const total = countPitch(step);
      return [
        ...parts.map((n, i) => ({ f: countPitch(n), at: i * JOIN_STEP, dur: 0.1, type: 'sine' as const, gain: 0.4 })),
        { f: total, at: end, dur: 0.3, type: 'triangle', gain: 0.5 },
        { f: total * 2, at: end + 0.02, dur: 0.26, type: 'sine', gain: 0.18 },
      ];
    }
    case 'compare':
      return [...parts, step].map((n, i) => ({ f: countPitch(n), at: i * COMPARE_STEP, dur: 0.2, type: 'sine' as const, gain: 0.45 }));
    case 'launch':
      // Do re mi fa so la ti do, fast and rising, then a long high note as it flies.
      return [
        ...[1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => ({ f: countPitch(n), at: i * 0.07, dur: 0.09, type: 'triangle' as const, gain: 0.4 })),
        { f: countPitch(8), to: countPitch(15), at: 0.56, dur: 0.5, type: 'sine', gain: 0.3 },
      ];
    case 'pickup':
      return [{ f: 420, to: 760, at: 0, dur: 0.09, type: 'sine', gain: 0.5 }];
    case 'drop':
      return [
        { f: 330, to: 220, at: 0, dur: 0.08, type: 'triangle', gain: 0.7 },
        { f: 1320, at: 0, dur: 0.03, type: 'sine', gain: 0.18 },
      ];
    case 'return':
      return [{ f: 660, to: 330, at: 0, dur: 0.14, type: 'sine', gain: 0.45 }];
    case 'blocked':
      return [
        { f: 200, to: 160, at: 0, dur: 0.1, type: 'triangle', gain: 0.6 },
        { f: 180, to: 140, at: 0.11, dur: 0.12, type: 'triangle', gain: 0.5 },
      ];
    case 'count': {
      const f = countPitch(step);
      return [
        { f, at: 0, dur: 0.18, type: 'sine', gain: 0.5 },
        // The octave above carries the note on a small phone speaker.
        { f: f * 2, at: 0, dur: 0.1, type: 'triangle', gain: 0.3 },
      ];
    }
    case 'counted':
      // The last counting note, then a little "ta-da" on top.
      return [
        ...notesFor('count', step),
        { f: 783.99, at: 0.16, dur: 0.1, type: 'triangle', gain: 0.4 },
        { f: 1046.5, at: 0.25, dur: 0.24, type: 'triangle', gain: 0.45 },
      ];
    case 'adjust':
      // "Hmm?": two soft notes that lean up, a question rather than a buzzer.
      return [
        { f: 392.0, at: 0, dur: 0.13, type: 'sine', gain: 0.45 },
        { f: 349.23, to: 440, at: 0.15, dur: 0.2, type: 'sine', gain: 0.4 },
      ];
    // Both wait SOLVE_AFTER for the drop that made the answer to land first:
    // played in the same millisecond, the loudest sound in the set (drop) hid
    // the first "right" note (2026-10-16 review H-1).
    case 'success':
      return [
        { f: 523.25, at: SOLVE_AFTER, dur: 0.12, type: 'triangle', gain: 0.45 },
        { f: 659.25, at: SOLVE_AFTER + 0.09, dur: 0.12, type: 'triangle', gain: 0.45 },
        { f: 783.99, at: SOLVE_AFTER + 0.18, dur: 0.12, type: 'triangle', gain: 0.45 },
        { f: 1046.5, at: SOLVE_AFTER + 0.27, dur: 0.38, type: 'triangle', gain: 0.5 },
        { f: 2093, at: SOLVE_AFTER + 0.3, dur: 0.25, type: 'sine', gain: 0.1 },
      ];
    case 'fanfare':
      return [
        { f: 523.25, at: SOLVE_AFTER, dur: 0.1, type: 'triangle', gain: 0.45 },
        { f: 523.25, at: SOLVE_AFTER + 0.12, dur: 0.1, type: 'triangle', gain: 0.45 },
        { f: 659.25, at: SOLVE_AFTER + 0.24, dur: 0.1, type: 'triangle', gain: 0.45 },
        { f: 783.99, at: SOLVE_AFTER + 0.36, dur: 0.16, type: 'triangle', gain: 0.5 },
        { f: 659.25, at: SOLVE_AFTER + 0.54, dur: 0.1, type: 'triangle', gain: 0.4 },
        { f: 1046.5, at: SOLVE_AFTER + 0.66, dur: 0.5, type: 'triangle', gain: 0.55 },
        { f: 1568, at: SOLVE_AFTER + 0.7, dur: 0.4, type: 'sine', gain: 0.12 },
        { f: 2093, at: SOLVE_AFTER + 0.82, dur: 0.35, type: 'sine', gain: 0.1 },
      ];
    case 'arrive':
      return [
        { f: 659.25, at: 0, dur: 0.08, type: 'sine', gain: 0.35 },
        { f: 987.77, at: 0.08, dur: 0.14, type: 'sine', gain: 0.35 },
      ];
    case 'tap':
      return [{ f: 880, to: 990, at: 0, dur: 0.04, type: 'sine', gain: 0.25 }];
    case 'look': {
      // Half a step under the success sound's first note and shorter: B, then
      // the F sharp above, rising, so it never sounds like "right".
      const at = step >= 2 ? 0 : LOOK_AT;
      const k = step >= 2 ? 0.7 : 1;
      return [
        { f: 493.88, at, dur: 0.1, type: 'sine', gain: 0.4 * k },
        { f: 739.99, at: at + 0.1, dur: 0.18, type: 'sine', gain: 0.4 * k },
        { f: 1479.98, at: at + 0.11, dur: 0.12, type: 'sine', gain: 0.08 * k },
      ];
    }
  }
}

// Under the voice: the loudest note peaks well below full scale.
const MASTER = 0.22;

interface AudioLike {
  readonly currentTime: number;
  readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>;
  createOscillator(): {
    type: OscillatorType;
    frequency: { setValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime(v: number, t: number): void };
    connect(n: unknown): void;
    start(t: number): void;
    stop(t: number): void;
  };
  createGain(): {
    gain: { setValueAtTime(v: number, t: number): void; linearRampToValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime(v: number, t: number): void };
    connect(n: unknown): void;
  };
}

export function createAudioSfx(make: () => AudioLike | null, initiallyMuted = false): Sfx {
  let ctx: AudioLike | null = null;
  let muted = initiallyMuted;
  const context = (): AudioLike | null => {
    if (ctx === null) {
      try {
        ctx = make();
      } catch {
        ctx = null;
      }
    }
    return ctx;
  };
  const unlock = () => {
    const c = context();
    if (c !== null && c.state !== 'running') {
      c.resume().catch(() => undefined);
    }
  };
  return {
    play: (name, step, parts) => {
      // Before the first touch there is no context yet (browsers refuse to start
      // audio without one): the sound is skipped rather than queued.
      const c = ctx;
      if (muted || c === null) {
        return;
      }
      try {
        if (c.state !== 'running') {
          c.resume().catch(() => undefined);
        }
        const t0 = c.currentTime + 0.005;
        for (const n of notesFor(name, step, parts)) {
          const osc = c.createOscillator();
          const amp = c.createGain();
          const start = t0 + n.at;
          const end = start + n.dur;
          osc.type = n.type ?? 'sine';
          osc.frequency.setValueAtTime(n.f, start);
          if (n.to !== undefined) {
            osc.frequency.exponentialRampToValueAtTime(n.to, end);
          }
          const peak = MASTER * (n.gain ?? 0.5);
          amp.gain.setValueAtTime(0.0001, start);
          amp.gain.linearRampToValueAtTime(peak, start + 0.008);
          amp.gain.exponentialRampToValueAtTime(0.0001, end);
          osc.connect(amp);
          amp.connect(c.destination);
          osc.start(start);
          osc.stop(end + 0.02);
        }
      } catch {
        // A broken audio stack must never break play.
      }
    },
    unlock,
    setMuted: (m) => {
      muted = m;
    },
    isMuted: () => muted,
  };
}

export function createSilentSfx(): Sfx {
  let muted = false;
  return {
    play: () => undefined,
    unlock: () => undefined,
    setMuted: (m) => {
      muted = m;
    },
    isMuted: () => muted,
  };
}

// The browser's AudioContext when there is one, else silence.
export function createWebSfx(initiallyMuted = false): Sfx {
  const g = globalThis as { AudioContext?: new () => AudioLike; webkitAudioContext?: new () => AudioLike };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (Ctor === undefined) {
    return createSilentSfx();
  }
  return createAudioSfx(() => new Ctor(), initiallyMuted);
}
