import { groupId, questionId, unitIds } from './ids';
import type { UnitId } from './ids';

describe('ids', () => {
  test('brands are distinct at the type level', () => {
    const g = groupId('g1');
    const q = questionId('q1');
    // @ts-expect-error a GroupId is not a UnitId even though both are strings at runtime
    const wrong: UnitId = g;
    expect(wrong).toBe('g1');
    expect(q).toBe('q1');
  });

  test('unitIds is deterministic and sequential', () => {
    expect(unitIds('q1', 3)).toEqual(['q1-u0', 'q1-u1', 'q1-u2']);
    expect(unitIds('q1', 3)).toEqual(unitIds('q1', 3));
    expect(unitIds('q1', 0)).toEqual([]);
  });
});
