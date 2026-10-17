import { cheerFor } from './cheer';

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
});
