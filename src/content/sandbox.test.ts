import { assertInvariants, benchCount } from '../core';
import { SANDBOX, sandboxMaterial } from './sandbox';

describe('sandbox material (2026-10-15 review O)', () => {
  test('ten single blocks in the tray, no partners, an empty 6 × 5 mat', () => {
    const m = sandboxMaterial();
    assertInvariants(m);
    expect(SANDBOX).toEqual({ blocks: 10, bounds: { cols: 6, rows: 5 } });
    expect(m.units.size).toBe(10);
    expect(m.tray.map((t) => t.unitId)).toEqual([...m.units.keys()]);
    expect(m.groups.size).toBe(0);
    expect(benchCount(m)).toBe(0);
    expect(m.bounds).toEqual({ cols: 6, rows: 5 });
    // Waiting blocks wear the colour of one, whatever they become on the mat.
    expect(new Set([...m.units.values()].map((u) => u.hue))).toEqual(new Set(['n1']));
  });

  test('the same every time: ids and slots are stable, so a saved sandbox stays recognisable', () => {
    expect(sandboxMaterial()).toEqual(sandboxMaterial());
    expect([...sandboxMaterial().home.entries()][9]).toEqual(['sandbox-u9', 9]);
  });
});
