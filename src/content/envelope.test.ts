import { template, cell } from '../core';
import { pickPair, pickTarget, pickTemplate } from './envelope';
import { mulberry32 } from './rng';

describe('envelope', () => {
  test('avoids the last two targets when the pool allows it', () => {
    const pool = [1, 2, 4, 6, 9];
    for (let seed = 0; seed < 50; seed += 1) {
      const t = pickTarget(pool, mulberry32(seed), [9, 4, 6]);
      expect([1, 2, 9]).toContain(t);
    }
  });

  test('relaxes for tiny pools or when everything recent fills the pool', () => {
    expect(pickTarget([1], mulberry32(3), [1])).toBe(1);
    expect([1, 2]).toContain(pickTarget([1, 2], mulberry32(3), [1, 2]));
    expect([3, 4, 5]).toContain(pickTarget([3, 4, 5], mulberry32(3), [3, 4, 5]));
    expect(() => pickTarget([], mulberry32(1))).toThrow(/empty target pool/);
  });

  test('template and pair pools pick deterministically and reject empties', () => {
    const a = template([cell(0, 0)]);
    const b = template([cell(0, 0), cell(1, 0)]);
    expect(pickTemplate([a, b], mulberry32(5))).toBe(pickTemplate([a, b], mulberry32(5)));
    expect(() => pickTemplate([], mulberry32(5))).toThrow(/empty template pool/);
    expect(pickPair([[3, 4]], mulberry32(1))).toEqual([3, 4]);
    expect(() => pickPair([], mulberry32(1))).toThrow(/empty pair pool/);
  });
});
