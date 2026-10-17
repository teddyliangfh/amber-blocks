import { cell, template } from '../core';
import { CONTENT_VERSION } from './catalog';
import { materialize, materializeNode } from './generate';
import { chapterId, nodeId } from './ids';
import type { Puzzle, QuestionSpec } from './schema';
import { validate } from './validate';

const ref = { contentVersion: CONTENT_VERSION, chapterId: chapterId('ch1'), nodeId: nodeId('ch1-n3'), attemptVariant: 0, seed: 3 };

describe('validate', () => {
  test('a generated puzzle passes; tampering with it fails loudly', () => {
    const p = materialize(ref);
    const spec: QuestionSpec = { kind: 'quantity_shape', target: 4, templates: [p.display.template!], extra: 2 };
    expect(() => validate(p, spec)).not.toThrow();

    const wrongSpecKind: QuestionSpec = { kind: 'addition_exact', pairs: [[1, 1]], distractors: [] };
    expect(() => validate(p, wrongSpecKind)).toThrow(/does not match spec/);
    expect(() => validate(p, { ...spec, extra: 0 })).toThrow(/extra must be at least 1/);
    expect(() => validate(p, { ...spec, extra: 3 })).toThrow(/expected 7 units/);

    const truncated: Puzzle = { ...p, solution: p.solution.slice(0, 3) };
    expect(() => validate(truncated, spec)).toThrow(/does not pass: count-mismatch/);
    const clash: Puzzle = { ...p, solution: [p.solution[0]!, p.solution[0]!] };
    expect(() => validate(clash, spec)).toThrow(/step 1 \(take\) rejected: not-in-tray/);
    const onBench: Puzzle = { ...p, initial: { ...p.initial, bench: new Map([[p.initial.tray[0]!.unitId!, cell(0, 0)]]), tray: p.initial.tray.map((s, i) => (i === 0 ? { ...s, unitId: null } : s)) } };
    expect(() => validate(onBench, spec)).toThrow(/start in the tray/);
  });

  test('addition puzzles are checked against their spec kind and partner fit', () => {
    // The exact 3 + 4 join (ch2-n7 up to content version 5, a "who's missing?" stop since Phase 19), from its old spec.
    const spec: QuestionSpec = { kind: 'addition_exact', pairs: [[3, 4]], distractors: [5, 2] };
    const join = materializeNode({ id: nodeId('ch2-n7'), role: 'boss', spec }, { cols: 8, rows: 3 }, { ...ref, chapterId: chapterId('ch2'), nodeId: nodeId('ch2-n7') });
    expect(() => validate(join, spec)).not.toThrow();
    expect(() => validate(join, { kind: 'quantity', targets: [7], extra: 1 })).toThrow(/does not match spec/);
    const missingPartner: Puzzle = { ...join, question: { kind: 'addition_exact', operands: [3, 6] } };
    expect(() => validate(missingPartner, spec)).toThrow(/no distinct partner of size 6/);
    const sumSpec: QuestionSpec = { kind: 'sum_composition', sum: 7, allowed: [[3, 4]], distractors: [5, 2] };
    const asSum: Puzzle = { ...join, question: { kind: 'sum_composition', sum: 7, allowed: [[3, 4], [1, 6]] } };
    expect(() => validate(asSum, sumSpec)).toThrow(/no distinct partner of size 1/);
    const shrunk: Puzzle = { ...join, initial: { ...join.initial, bounds: { cols: 3, rows: 2 } } };
    expect(() => validate(shrunk, spec)).toThrow(/does not fit the bench/);
    expect(template([cell(0, 0)]).cells).toHaveLength(1);
  });
});
