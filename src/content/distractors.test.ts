import { assertDistractors, partnerSizesFor, solutionSizes } from './distractors';

describe('distractors', () => {
  test('solution sizes cover every allowed pair, counting repeats within a pair', () => {
    expect(solutionSizes({ kind: 'addition_exact', operands: [3, 4] })).toEqual([3, 4]);
    expect(solutionSizes({ kind: 'addition_exact', operands: [2, 2] })).toEqual([2, 2]);
    expect(solutionSizes({ kind: 'sum_composition', sum: 7, allowed: [[3, 4], [5, 2]] })).toEqual([2, 3, 4, 5]);
    expect(solutionSizes({ kind: 'sum_composition', sum: 4, allowed: [[2, 2], [3, 1]] })).toEqual([1, 2, 2, 3]);
    expect(solutionSizes({ kind: 'quantity', target: 3 })).toEqual([]);
  });

  test('a distractor the size of an operand is refused; other sizes pass through', () => {
    expect(partnerSizesFor({ kind: 'addition_exact', operands: [3, 4] }, [5, 2])).toEqual([3, 4, 5, 2]);
    expect(() => assertDistractors({ kind: 'addition_exact', operands: [3, 4] }, [4])).toThrow(/same size as an operand/);
    expect(() => assertDistractors({ kind: 'sum_composition', sum: 7, allowed: [[3, 4], [5, 2]] }, [2])).toThrow(/same size/);
    expect(() => assertDistractors({ kind: 'addition_exact', operands: [3, 4] }, [0])).toThrow(/positive integer/);
    expect(() => assertDistractors({ kind: 'quantity', target: 3 }, [3])).not.toThrow();
  });
});
