import { SIGNS, signOf } from './sign';

describe('signOf (Phase 23d, Compare Island)', () => {
  test('the sign opens towards the bigger number; the same number is =', () => {
    expect(signOf(4, 1)).toBe('>');
    expect(signOf(1, 3)).toBe('<');
    expect(signOf(3, 3)).toBe('=');
    expect(signOf(8, 9)).toBe('<');
    expect(signOf(9, 8)).toBe('>');
  });

  test('exactly one sign fits every pair from 1 to 10', () => {
    for (let a = 1; a <= 10; a += 1) {
      for (let b = 1; b <= 10; b += 1) {
        const fits = SIGNS.filter((s) => (s === '>' ? a > b : s === '<' ? a < b : a === b));
        expect(fits).toEqual([signOf(a, b)]);
      }
    }
  });

  test('the tray order is > < =', () => {
    expect(SIGNS).toEqual(['>', '<', '=']);
  });
});
