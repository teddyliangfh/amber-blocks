// What the blocks do when a stop is solved (2026-10-15 review J): every number
// has its own move, so the twelfth solve is not the first one again. Bosses
// transform: the 8 brick becomes a little car that drives off and comes back,
// 17's big partner stands up and waves, and the countdown's last 1 is a rocket
// that launches and lands again (Phase 22). Pure: the stage plays the move.
export type CheerMove = 'hop' | 'spin' | 'pair' | 'stack' | 'wiggle' | 'wave' | 'stand' | 'car' | 'tall-wave' | 'launch';

const BY_NUMBER: Readonly<Record<number, CheerMove>> = {
  1: 'spin',
  2: 'pair',
  3: 'stack',
  4: 'wiggle',
  5: 'wave',
  6: 'stack',
  7: 'spin',
  8: 'wave',
  9: 'wave',
  10: 'stand',
  12: 'stand',
};

// `shape`: the solved picture, when the stop asked for one (an 8 brick drives).
// `countdown`: the stop counted down to this number one block at a time (the
// Take-away Island boss): what is left launches.
export function cheerFor(
  target: number,
  { boss = false, shape = null, countdown = false }: { readonly boss?: boolean; readonly shape?: { readonly w: number; readonly h: number } | null; readonly countdown?: boolean } = {},
): CheerMove {
  if (boss && countdown) {
    return 'launch';
  }
  if (boss && target === 8 && shape !== null && Math.max(shape.w, shape.h) === 4 && Math.min(shape.w, shape.h) === 2) {
    return 'car';
  }
  if (boss && target === 17) {
    return 'tall-wave';
  }
  return BY_NUMBER[target] ?? 'hop';
}
