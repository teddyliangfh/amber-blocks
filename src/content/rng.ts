import type { PuzzleRef } from './schema';

// Deterministic randomness only. A puzzle is a pure function of its ref, so the
// same child sees the same tray after a reload or a language switch (AC-44).

export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export interface Rng {
  // Uniform in [0, 1).
  readonly next: () => number;
  // Uniform integer in [0, maxExclusive).
  readonly int: (maxExclusive: number) => number;
  readonly pick: <T>(items: ReadonlyArray<T>) => T;
  // Fisher-Yates; returns a new array.
  readonly shuffle: <T>(items: ReadonlyArray<T>) => ReadonlyArray<T>;
}

export function mulberry32(seed: number): Rng {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (maxExclusive: number): number => {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error(`rng.int: maxExclusive must be a positive integer, got ${maxExclusive}`);
    }
    return Math.floor(next() * maxExclusive);
  };
  const pick = <T>(items: ReadonlyArray<T>): T => {
    if (items.length === 0) {
      throw new Error('rng.pick: empty list');
    }
    return items[int(items.length)] as T;
  };
  const shuffle = <T>(items: ReadonlyArray<T>): ReadonlyArray<T> => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = int(i + 1);
      const a = out[i] as T;
      out[i] = out[j] as T;
      out[j] = a;
    }
    return out;
  };
  return { next, int, pick, shuffle };
}

// Trays are dealt with the content version they were first dealt in, not the
// running one: a version bump changes only the stops it lists (CONTENT_CHANGES)
// and must not, by itself, reshuffle every tray and orphan unfinished work on
// stops that did not change. Frozen at 1, the version every current tray was
// dealt in (2026-10-14 review).
const DEAL_SALT = 1;

export function seedOf(ref: PuzzleRef): number {
  return fnv1a(`${DEAL_SALT}|${ref.chapterId}|${ref.nodeId}|${ref.attemptVariant}|${ref.seed}`);
}

export function seeded(ref: PuzzleRef): Rng {
  return mulberry32(seedOf(ref));
}
