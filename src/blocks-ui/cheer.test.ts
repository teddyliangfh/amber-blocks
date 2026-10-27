import { BOSS_PICTURE_CHEER, cheerFor } from './cheer';

describe('cheer moves (2026-10-15 review J)', () => {
  test('each number has its own move', () => {
    expect([1, 2, 3, 4, 5, 10].map((n) => cheerFor(n))).toEqual(['spin', 'pair', 'stack', 'wiggle', 'wave', 'stand']);
    expect(cheerFor(15)).toBe('hop');
  });

  test('bosses transform: the 8 brick drives, 17 stands up and waves; otherwise a boss does its number move', () => {
    expect(cheerFor(8, { boss: true, shape: { w: 4, h: 2 } })).toBe('car');
    expect(cheerFor(8, { boss: true, shape: { w: 2, h: 4 } })).toBe('car');
    expect(cheerFor(8, { boss: false, shape: { w: 4, h: 2 } })).toBe('wave');
    expect(cheerFor(8, { boss: true })).toBe('wave');
    expect(cheerFor(17, { boss: true })).toBe('tall-wave');
    expect(cheerFor(17)).toBe('hop');
    expect(cheerFor(3, { boss: true, shape: { w: 2, h: 2 } })).toBe('stack');
  });

  test('Phase 22: the countdown boss launches what is left; a countdown that is no boss, or a boss that is no countdown, does not', () => {
    expect(cheerFor(1, { boss: true, countdown: true })).toBe('launch');
    expect(cheerFor(1, { boss: false, countdown: true })).toBe('spin');
    expect(cheerFor(1, { boss: true })).toBe('spin');
    expect(cheerFor(5, { boss: true, countdown: false })).toBe('wave');
  });

  test('Phase 23b: Shape Island pictures move as what they are; the boat boss waves, the rocket launches', () => {
    expect(BOSS_PICTURE_CHEER).toBe(true);
    expect(cheerFor(4, { picture: 'mushroom' })).toBe('hop');
    expect(cheerFor(5, { picture: 'duck' })).toBe('wiggle');
    expect(cheerFor(5, { picture: 'tree' })).toBe('wiggle');
    expect(cheerFor(5, { picture: 'boat' })).toBe('wiggle');
    expect(cheerFor(5, { picture: 'boat', boss: true })).toBe('wave');
    expect(cheerFor(7, { picture: 'house' })).toBe('stand');
    expect(cheerFor(6, { picture: 'dog' })).toBe('hop');
    expect(cheerFor(6, { picture: 'rocket', boss: true })).toBe('launch');
    // No picture, or one with no move of its own: the number's move.
    expect(cheerFor(6, { picture: null })).toBe('stack');
    expect(cheerFor(6, { picture: 'kite' })).toBe('stack');
  });
});
