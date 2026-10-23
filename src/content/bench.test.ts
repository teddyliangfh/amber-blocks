import { cell, template } from '../core';
import { BENCH_MARGIN, MIN_BENCH, benchFor, fitBench, holdsAll, holdsMaterial, numberBox } from './bench';
import { CHAPTERS, CONTENT_VERSION } from './catalog';
import { materialize, materializeNode } from './generate';
import { chapterId, nodeId } from './ids';
import type { Chapter, NodeSpec } from './schema';

const node = (spec: NodeSpec['spec'], bounds?: NodeSpec['bounds']): NodeSpec => ({ id: nodeId('x-n1'), role: 'normal', spec, ...(bounds === undefined ? {} : { bounds }) });
const chapter = (bounds?: Chapter['bounds']): Chapter => ({ id: chapterId('x'), title: 'chapter.ch1.title' as Chapter['title'], nodes: [], ...(bounds === undefined ? {} : { bounds }) });

describe('fitted mats (2026-10-15 review: "make 1" faced thirty cells, 1 + 1 had the smallest blocks)', () => {
  test('a number is laid out as its partner is drawn: rows of five', () => {
    expect(numberBox(1)).toEqual({ w: 1, h: 1 });
    expect(numberBox(4)).toEqual({ w: 4, h: 1 });
    expect(numberBox(9)).toEqual({ w: 5, h: 2 });
    expect(numberBox(17)).toEqual({ w: 5, h: 4 });
  });

  test('small numbers get a small mat, never below the minimum', () => {
    expect(fitBench({ kind: 'quantity', targets: [1], extra: 2 })).toEqual(MIN_BENCH);
    expect(fitBench({ kind: 'quantity', targets: [4], extra: 2 })).toEqual({ cols: 4 + BENCH_MARGIN, rows: 3 });
    // A pool leaves room for its biggest target.
    expect(fitBench({ kind: 'quantity', targets: [2, 9], extra: 2 })).toEqual({ cols: 6, rows: 3 });
  });

  test('a shape stop fits every turn of its picture and the plain row', () => {
    const line = template([cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0)]);
    // Upright and lying down: 4 wide and 4 tall, plus the spare row and column.
    expect(fitBench({ kind: 'quantity_shape', target: 4, templates: [line], extra: 2 })).toEqual({ cols: 5, rows: 5 });
    // Without turning, the line only lies down.
    expect(fitBench({ kind: 'quantity_shape', target: 4, templates: [line], symmetry: { rotation: false, mirror: false }, extra: 2 })).toEqual({ cols: 5, rows: 3 });
    const square = template([cell(0, 0), cell(1, 0), cell(0, 1), cell(1, 1)]);
    // The square itself needs 3 × 3, but "right count, now the shape" needs a row of four to be possible.
    expect(fitBench({ kind: 'quantity_shape', target: 4, templates: [square], extra: 2 })).toEqual({ cols: 5, rows: 3 });
  });

  test('a sum leaves room for the two partners side by side, as the sum reads', () => {
    expect(fitBench({ kind: 'addition_exact', pairs: [[3, 4]], distractors: [5, 2] })).toEqual({ cols: 8, rows: 3 });
    expect(fitBench({ kind: 'addition_exact', pairs: [[1, 1]], distractors: [3] })).toEqual({ cols: 4, rows: 3 });
    expect(fitBench({ kind: 'sum_composition', sum: 5, allowed: [[2, 3], [4, 1]], distractors: [5] })).toEqual({ cols: 6, rows: 3 });
    // A two-row partner makes the mat taller.
    expect(fitBench({ kind: 'addition_exact', pairs: [[6, 1]], distractors: [] })).toEqual({ cols: 7, rows: 3 });
    // A pool of pairs: room for the widest pair and the heaviest tray.
    expect(fitBench({ kind: 'addition_exact', pairs: [[1, 1], [5, 4]], distractors: [2] })).toEqual({ cols: 10, rows: 3 });
  });

  test('the mat grows until every piece can sit on it at once', () => {
    // Four 10s: three shelves of 5 × 2 in a 6-wide mat do not fit 3 rows.
    const big = fitBench({ kind: 'quantity', targets: [10], extra: 1, handles: [5, 5], decoys: [10, 10] });
    expect(big.cols).toBe(6);
    expect(holdsAll(big, [10, 10, 5, 5].map((n) => ({ ...numberBox(n), cells: n })), 1)).toBe(true);
    expect(big.rows).toBeGreaterThan(3);
    // Many loose blocks need cells, not width.
    const loose = fitBench({ kind: 'quantity', targets: [2], extra: 12 });
    expect(loose.cols * loose.rows).toBeGreaterThanOrEqual(14);
    expect(loose.cols).toBe(MIN_BENCH.cols);
  });

  test('holdsAll: shelves by height, loose blocks in any free cell', () => {
    const ten = { w: 5, h: 2, cells: 10 };
    const seven = { w: 5, h: 2, cells: 7 };
    expect(holdsAll({ cols: 6, rows: 2 }, [ten], 2)).toBe(true);
    expect(holdsAll({ cols: 6, rows: 2 }, [ten], 3)).toBe(false);
    // The holes in a 7's box take loose blocks too.
    expect(holdsAll({ cols: 5, rows: 2 }, [seven], 3)).toBe(true);
    expect(holdsAll({ cols: 4, rows: 9 }, [ten], 0)).toBe(false);
    expect(holdsAll({ cols: 6, rows: 3 }, [ten, ten], 0)).toBe(false);
  });

  test('a node or chapter can still fix its mat', () => {
    const spec = { kind: 'quantity', targets: [1], extra: 2 } as const;
    expect(benchFor(chapter(), node(spec))).toEqual(MIN_BENCH);
    expect(benchFor(chapter({ cols: 6, rows: 5 }), node(spec))).toEqual({ cols: 6, rows: 5 });
    expect(benchFor(chapter({ cols: 6, rows: 5 }), node(spec, { cols: 4, rows: 4 }))).toEqual({ cols: 4, rows: 4 });
  });

  test('every catalog stop: the dealt mat is the fitted one, holds everything, and fitting it changed nothing but the mat', () => {
    for (const c of CHAPTERS) {
      for (const n of c.nodes) {
        for (const seed of [1, 9]) {
          const ref = { contentVersion: CONTENT_VERSION, chapterId: c.id, nodeId: n.id, attemptVariant: 0, seed };
          const p = materialize(ref);
          // A stop may fix its own mat (Phase 23a: the standing ten's 6 × 5).
          expect(p.initial.bounds).toEqual(n.bounds ?? fitBench(n.spec));
          expect(holdsMaterial(p.initial)).toBe(true);
          // Version 2 dealt every stop on 6 × 5 (Number Island) or 8 × 6 (Join Island).
          // A partner that starts on the mat (Phase 19) sits halfway down its own
          // mat, so only which blocks are on the mat is compared, not where.
          // Stops added since that need more room (Phase 21's nine-column rows)
          // are compared on a mat wide enough for them.
          const fixed = c.id === 'ch1' ? { cols: 6, rows: 5 } : { cols: 8, rows: 6 };
          const before = materializeNode(n, { cols: Math.max(fixed.cols, p.initial.bounds.cols), rows: Math.max(fixed.rows, p.initial.bounds.rows) }, ref);
          const placed = (s: typeof p.initial) => ({ ...s, bounds: null, bench: [...s.bench.keys()] });
          expect(placed(p.initial)).toEqual(placed(before.initial));
          expect(p.display).toEqual(before.display);
        }
      }
    }
  });

  test('validate refuses a mat that cannot take everything at once', () => {
    // Two 6s (5 × 2 each) fit a 5 × 2 mat one at a time, never together.
    expect(() => materializeNode(node({ kind: 'addition_exact', pairs: [[6, 6]], distractors: [] }), { cols: 5, rows: 3 }, { contentVersion: CONTENT_VERSION, chapterId: chapterId('ch2'), nodeId: nodeId('x-n1'), attemptVariant: 0, seed: 1 })).toThrow(
      /does not fit the bench all at once/,
    );
  });
});
