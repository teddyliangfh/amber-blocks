import type { Question } from '../core';

// Which partners go in the tray for an addition question: everything a solution
// could use, plus the configured distractors. A distractor the same size as an
// operand would be a second answer piece, not a distractor, so that is refused.

function operandSizes(question: Question): ReadonlyArray<number> {
  switch (question.kind) {
    case 'addition_exact':
      return question.operands;
    case 'sum_composition':
      return question.allowed.flat();
    default:
      return [];
  }
}

export function assertDistractors(question: Question, distractors: ReadonlyArray<number>): void {
  const operands = new Set(operandSizes(question));
  for (const size of distractors) {
    if (!Number.isInteger(size) || size < 1) {
      throw new Error(`content: distractor size must be a positive integer, got ${size}`);
    }
    if (operands.has(size)) {
      throw new Error(`content: distractor ${size} is the same size as an operand`);
    }
  }
}

// Sizes needed so that every allowed pair can be built: per size, the most any
// single pair needs (2 + 2 needs two twos; 3 + 4 and 5 + 2 need one of each).
export function solutionSizes(question: Question): ReadonlyArray<number> {
  const pairs: ReadonlyArray<readonly [number, number]> =
    question.kind === 'addition_exact' ? [question.operands] : question.kind === 'sum_composition' ? question.allowed : [];
  const needed = new Map<number, number>();
  for (const pair of pairs) {
    const inPair = new Map<number, number>();
    for (const size of pair) {
      inPair.set(size, (inPair.get(size) ?? 0) + 1);
    }
    for (const [size, count] of inPair) {
      needed.set(size, Math.max(needed.get(size) ?? 0, count));
    }
  }
  const out: number[] = [];
  for (const [size, count] of [...needed].sort(([a], [b]) => a - b)) {
    for (let i = 0; i < count; i += 1) {
      out.push(size);
    }
  }
  return out;
}

export function partnerSizesFor(question: Question, distractors: ReadonlyArray<number>): ReadonlyArray<number> {
  assertDistractors(question, distractors);
  return [...solutionSizes(question), ...distractors];
}
