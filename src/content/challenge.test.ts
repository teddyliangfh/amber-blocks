import { apply, judge } from '../core';
import type { BenchState } from '../core';
import { CHAPTERS } from './catalog';
import { BRICK_2X4, CORNER_3, LINE_4, SQUARE_2X2, STAIRS_6, TEN_2X5, TOWER_2X3 } from './catalog/shapes';
import { CHALLENGE_RULES, challengeCap, nextChallenge } from './challenge';
import type { Challenge } from './challenge';
import { nodeId } from './ids';
import type { NodeId } from './ids';
import { validate } from './validate';

const order = CHAPTERS.flatMap((c) => c.nodes.map((n) => n.id));
// Every stop up to and including `last`, finished.
const upTo = (last: string): ReadonlySet<NodeId> => new Set(order.slice(0, order.indexOf(nodeId(last)) + 1));
const none: ReadonlySet<NodeId> = new Set();
const all: ReadonlySet<NodeId> = new Set(order);

const SHAPES = new Map([
  [SQUARE_2X2, 'square'],
  [CORNER_3, 'corner'],
  [LINE_4, 'line'],
  [TOWER_2X3, 'tower'],
  [BRICK_2X4, 'brick'],
  [TEN_2X5, 'ten'],
  [STAIRS_6, 'stairs'],
]);
const shapeOf = (c: Challenge) => (c.puzzle.question.kind === 'quantity_shape' ? SHAPES.get(c.puzzle.question.template) : undefined);

function many(done: ReadonlySet<NodeId>, count = 300): ReadonlyArray<Challenge> {
  return Array.from({ length: count }, (_, seed) => nextChallenge(done, seed * 7919 + 1));
}

function replay(initial: BenchState, c: Challenge): BenchState {
  return c.puzzle.solution.reduce((s, cmd) => {
    const r = apply(s, cmd);
    if (!r.ok) {
      throw new Error(r.reason);
    }
    return r.value;
  }, initial);
}

describe('free play random puzzles (Phase 21): they follow progress', () => {
  test('the same progress, seed and last puzzle give the same puzzle', () => {
    const last = nextChallenge(all, 5);
    expect(nextChallenge(all, 42, last)).toEqual(nextChallenge(all, 42, last));
    expect(nextChallenge(none, 9)).toEqual(nextChallenge(none, 9));
  });

  test('the cap: the biggest number of a finished stop, never under 3', () => {
    expect(CHALLENGE_RULES.startCap).toBe(3);
    expect(challengeCap(none)).toBe(3);
    expect(challengeCap(upTo('ch1-n1'))).toBe(3);
    expect(challengeCap(upTo('ch1-n3'))).toBe(4);
    expect(challengeCap(upTo('ch1-n8'))).toBe(8);
    expect(challengeCap(upTo('ch1-n12'))).toBe(17);
    // A parent who started on Join Island: only what was finished there counts.
    expect(challengeCap(new Set([nodeId('ch2-n1'), nodeId('ch2-n2')]))).toBe(3);
    expect(challengeCap(new Set([nodeId('ch2-n12')]))).toBe(13);
    // An id this build does not know is ignored.
    expect(challengeCap(new Set([nodeId('ch9-n9')]))).toBe(3);
  });

  test('nothing finished: only numbers 1 to 3, all three of them', () => {
    const got = many(none);
    expect(new Set(got.map((c) => c.kind))).toEqual(new Set(['quantity']));
    expect(new Set(got.map((c) => c.n))).toEqual(new Set([1, 2, 3]));
    for (const c of got) {
      expect(c.puzzle.question).toEqual({ kind: 'quantity', target: c.n });
      expect(c.puzzle.prompt).toBe('prompt.quantity');
    }
  });

  test('after the first shape stop: shapes too, only the square, nothing over 4', () => {
    const got = many(upTo('ch1-n3'));
    expect(new Set(got.map((c) => c.kind))).toEqual(new Set(['quantity', 'quantity_shape']));
    expect(new Set(got.filter((c) => c.kind === 'quantity_shape').map(shapeOf))).toEqual(new Set(['square']));
    expect(Math.max(...got.map((c) => c.n))).toBe(4);
  });

  test('Number Island finished: the five pictures it showed, numbers up to 17 carried as partners past 6, no sums yet', () => {
    const got = many(upTo('ch1-n12'), 600);
    expect(new Set(got.map((c) => c.kind))).toEqual(new Set(['quantity', 'quantity_shape']));
    expect(new Set(got.filter((c) => c.kind === 'quantity_shape').map(shapeOf))).toEqual(new Set(['square', 'corner', 'line', 'tower', 'brick']));
    expect(Math.max(...got.map((c) => c.n))).toBe(17);
    for (const c of got.filter((x) => x.kind === 'quantity')) {
      const singles = c.puzzle.solution.filter((cmd) => cmd.type === 'take').length;
      expect(`${c.n} ${singles <= CHALLENGE_RULES.maxSingles}`).toBe(`${c.n} true`);
      // Past six, the number comes as partners with a decoy, as on Number Island.
      if (c.n > CHALLENGE_RULES.maxSingles) {
        expect(c.spec.kind === 'quantity' && c.spec.handles !== undefined && c.spec.decoys?.length === 1).toBe(true);
      }
    }
  });

  test('after 1 + 1: sums, each partner at least 1, the total no more than 10 and the cap, a distractor of another size', () => {
    const early = many(upTo('ch2-n1'), 600);
    expect(new Set(early.map((c) => c.kind))).toEqual(new Set(['quantity', 'quantity_shape', 'addition_exact']));
    const capped = many(new Set([nodeId('ch2-n1')]), 300).filter((c) => c.kind === 'addition_exact');
    expect(capped.length).toBeGreaterThan(0);
    expect(Math.max(...capped.map((c) => c.n))).toBeLessThanOrEqual(3);
    for (const c of early.filter((x) => x.kind === 'addition_exact')) {
      const q = c.puzzle.question;
      if (q.kind !== 'addition_exact' || c.spec.kind !== 'addition_exact') {
        throw new Error('not a sum');
      }
      const [a, b] = q.operands;
      expect(a).toBeGreaterThanOrEqual(1);
      expect(b).toBeGreaterThanOrEqual(1);
      expect(a + b).toBe(c.n);
      expect(c.n).toBeLessThanOrEqual(CHALLENGE_RULES.sumMax);
      expect(c.spec.distractors).toHaveLength(1);
      expect([a, b]).not.toContain(c.spec.distractors[0]);
      expect(c.puzzle.prompt).toBe('prompt.addition_exact');
    }
    expect(Math.max(...early.filter((c) => c.kind === 'addition_exact').map((c) => c.n))).toBe(10);
  });

  test('everything finished: the ten and the stairs join the pictures', () => {
    const got = many(all, 600);
    expect(new Set(got.filter((c) => c.kind === 'quantity_shape').map(shapeOf))).toEqual(new Set(['square', 'corner', 'line', 'tower', 'brick', 'ten', 'stairs']));
  });

  test('never the same kind of puzzle with the same number twice in a row', () => {
    for (const done of [none, upTo('ch1-n3'), upTo('ch2-n1'), all]) {
      let last: Challenge | null = null;
      for (let seed = 1; seed <= 200; seed += 1) {
        const c: Challenge = nextChallenge(done, seed, last);
        if (last !== null) {
          expect(`${c.kind}:${c.n}`).not.toBe(`${last.kind}:${last.n}`);
        }
        last = c;
      }
    }
  });

  test('every puzzle dealt validates and its reference answer passes the judge', () => {
    for (const done of [none, upTo('ch1-n3'), upTo('ch1-n8'), upTo('ch1-n12'), upTo('ch2-n1'), upTo('ch2-n9'), all]) {
      for (const c of many(done, 150)) {
        expect(() => validate(c.puzzle, c.spec)).not.toThrow();
        expect(judge(replay(c.puzzle.initial, c), c.puzzle.question).matched).toBe(true);
        // Nothing starts on the mat; its own mat holds everything.
        expect(c.puzzle.initial.bench.size).toBe(0);
        expect(c.puzzle.ref.chapterId).toBe('challenge');
      }
    }
  });
});
