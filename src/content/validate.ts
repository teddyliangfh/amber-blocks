import { DEFAULT_SYMMETRY, apply, areTouching, assertInvariants, clusters, groupSize, judge, variants } from '../core';
import type { BenchState, Bounds, Cell, Group } from '../core';
import { holdsMaterial } from './bench';
import { assertDistractors } from './distractors';
import type { Puzzle, QuestionSpec } from './schema';
import { benchPair, questionAt, samePair, stepCount } from './steps';
import type { Pair } from './steps';

// Refuses any puzzle a child could not finish. Every failure throws: a content
// bug must surface in tests, never degrade into a skipped stop.

function fits(cells: ReadonlyArray<Cell>, bounds: Bounds): boolean {
  return cells.every((c) => c.x >= 0 && c.y >= 0 && c.x < bounds.cols && c.y < bounds.rows);
}

function assertPartnersFit(state: BenchState): void {
  for (const group of state.groups.values()) {
    if (!fits(group.shape, state.bounds)) {
      throw new Error(`content: partner ${group.id} does not fit the bench`);
    }
  }
}

function assertDistinctPartners(groups: ReadonlyArray<Group>, sizes: ReadonlyArray<number>): void {
  const pool = [...groups];
  for (const size of sizes) {
    const index = pool.findIndex((g) => groupSize(g) === size);
    if (index === -1) {
      throw new Error(`content: no distinct partner of size ${size} for the answer`);
    }
    pool.splice(index, 1);
  }
}

// A sum asked several ways: as many allowed pairs as ways, and no other pair
// in the tray makes the sum, so "two ways" means exactly the allowed two.
function assertWays(spec: Extract<QuestionSpec, { kind: 'sum_composition' }>, puzzle: Puzzle, groups: ReadonlyArray<Group>): void {
  const ways = spec.ways ?? 1;
  if (!Number.isInteger(ways) || ways < 1 || (puzzle.ways ?? 1) !== ways) {
    throw new Error(`content: ways must be a positive integer the puzzle carries, got ${spec.ways}`);
  }
  if (spec.allowed.length < ways) {
    throw new Error(`content: ${ways} ways to make ${spec.sum} need at least ${ways} allowed pairs`);
  }
  if (ways === 1) {
    return;
  }
  groups.forEach((a, i) => {
    for (const b of groups.slice(i + 1)) {
      const pair = [groupSize(a), groupSize(b)] as const;
      if (pair[0] + pair[1] === spec.sum && !spec.allowed.some((p) => samePair(p, pair))) {
        throw new Error(`content: ${pair[0]} + ${pair[1]} also make ${spec.sum} but is not one of the ways`);
      }
    }
  });
}

// "Who's missing?": the given partner is the only thing on the mat, the
// allowed pair is exactly it and its other half, and only one partner in the
// tray finishes it.
function assertGiven(spec: Extract<QuestionSpec, { kind: 'sum_composition' }>, puzzle: Puzzle): void {
  const { initial } = puzzle;
  const given = spec.given;
  if (given === undefined) {
    if (puzzle.given !== undefined || (initial.bench.size !== 0 && spec.onMat === undefined)) {
      throw new Error('content: material must start in the tray');
    }
    return;
  }
  const allowed = spec.allowed[0];
  if (spec.allowed.length !== 1 || allowed === undefined || !samePair(allowed, [given, spec.sum - given])) {
    throw new Error(`content: with ${given} given, the only allowed pair is ${given} + ${spec.sum - given}`);
  }
  if ((spec.ways ?? 1) !== 1) {
    throw new Error('content: a given partner is asked one way');
  }
  const group = puzzle.given === undefined ? undefined : initial.groups.get(puzzle.given);
  if (group === undefined || groupSize(group) !== given || initial.bench.size !== given || !group.unitIds.every((u) => initial.bench.has(u))) {
    throw new Error(`content: the given ${given} must be all there is on the mat at the start`);
  }
  const finishers = [...initial.groups.values()].filter((g) => g.id !== group.id && groupSize(g) === spec.sum - given);
  if (finishers.length !== 1) {
    throw new Error(`content: ${finishers.length} partners in the tray finish ${given} + ? = ${spec.sum}`);
  }
}

// "Send the extra away" (Phase 21): the partners on the mat, more than the
// sum, are all there is on the mat, in one joined row; exactly one pair of
// them makes the sum, it is the one allowed pair and its two sit side by side
// (the extras are at the ends, so sending them back is the only move needed);
// and no other two partners anywhere make the sum, so there is one way to
// send back and nothing else to build.
function assertOnMat(spec: Extract<QuestionSpec, { kind: 'sum_composition' }>, puzzle: Puzzle, groups: ReadonlyArray<Group>): void {
  const row = spec.onMat;
  if (row === undefined) {
    if (puzzle.onMat !== undefined) {
      throw new Error('content: partners on the mat come from a sum spec with `onMat`');
    }
    return;
  }
  if (spec.given !== undefined || (spec.ways ?? 1) !== 1) {
    throw new Error('content: partners on the mat are asked alone: no given partner, one way');
  }
  const total = row.reduce((a, b) => a + b, 0);
  if (total <= spec.sum) {
    throw new Error(`content: ${row.join(' + ')} on the mat is not more than ${spec.sum}`);
  }
  const allowed = spec.allowed[0];
  if (spec.allowed.length !== 1 || allowed === undefined) {
    throw new Error('content: with partners on the mat, there is one allowed pair');
  }
  const making: (readonly [number, number])[] = [];
  row.forEach((a, i) => row.forEach((b, j) => {
    if (j > i && a + b === spec.sum) {
      making.push([i, j]);
    }
  }));
  const [only] = making;
  if (making.length !== 1 || only === undefined) {
    throw new Error(`content: ${making.length} pairs on the mat make ${spec.sum}`);
  }
  const [i, j] = only;
  if (!samePair(allowed, [row[i]!, row[j]!])) {
    throw new Error(`content: ${row[i]} + ${row[j]} on the mat is not the allowed ${allowed[0]} + ${allowed[1]}`);
  }
  if (j !== i + 1) {
    throw new Error(`content: ${row[i]} and ${row[j]} are not next to each other on the mat`);
  }
  groups.forEach((a, k) => {
    for (const b of groups.slice(k + 1)) {
      const pair = [groupSize(a), groupSize(b)] as const;
      const isTheOne = puzzle.onMat?.[i] !== undefined && [a.id, b.id].includes(puzzle.onMat[i]!) && [a.id, b.id].includes(puzzle.onMat[j]!);
      if (pair[0] + pair[1] === spec.sum && !isTheOne) {
        throw new Error(`content: ${pair[0]} + ${pair[1]} also make ${spec.sum}`);
      }
    }
  });
  const { initial } = puzzle;
  const ids = puzzle.onMat ?? [];
  const placed = ids.map((id) => initial.groups.get(id));
  if (ids.length !== row.length || initial.bench.size !== total || placed.some((g, k) => g === undefined || groupSize(g) !== row[k] || !g.unitIds.every((u) => initial.bench.has(u)))) {
    throw new Error(`content: ${row.join(', ')} must be all there is on the mat at the start`);
  }
  assertJoinedRow(initial, placed as ReadonlyArray<Group>);
}

// The partners on the mat start in one joined row, left to right.
function assertJoinedRow(initial: BenchState, parts: ReadonlyArray<Group>): void {
  const left = (g: Group) => Math.min(...g.unitIds.map((u) => initial.bench.get(u)!.x));
  if (clusters(initial).length !== 1 || parts.some((g, k) => k > 0 && (!areTouching(initial, parts[k - 1]!, g) || left(parts[k - 1]!) >= left(g)))) {
    throw new Error('content: the partners on the mat must start in one joined row, left to right');
  }
}

// Pull apart (Phase 22): exactly the blocks to split, all on the mat in one
// row, nothing else; two parts this round; no more ways than there are
// different splits (1 + 4 and 4 + 1 are one).
function assertSplit(spec: Extract<QuestionSpec, { kind: 'split' }>, puzzle: Puzzle): void {
  const { question, initial } = puzzle;
  if (question.kind !== 'split' || question.total !== spec.total || question.parts !== spec.parts || question.except !== undefined) {
    throw new Error('content: a split question does not match its spec');
  }
  if (!Number.isInteger(spec.total) || spec.total < 2) {
    throw new Error(`content: a split needs at least 2 blocks, got ${spec.total}`);
  }
  if (spec.parts !== 2) {
    throw new Error(`content: a split is into two parts this round (design §1.1), not ${spec.parts}`);
  }
  const ways = spec.ways ?? 1;
  if (!Number.isInteger(ways) || ways < 1 || (puzzle.ways ?? 1) !== ways) {
    throw new Error(`content: ways must be a positive integer the puzzle carries, got ${spec.ways}`);
  }
  if (ways > Math.floor(spec.total / 2)) {
    throw new Error(`content: ${spec.total} splits in two only ${Math.floor(spec.total / 2)} way(s), not ${ways}`);
  }
  if (initial.units.size !== spec.total || initial.bench.size !== spec.total) {
    throw new Error(`content: a split of ${spec.total} starts with exactly ${spec.total} blocks, all on the mat`);
  }
  if (initial.groups.size > 0) {
    throw new Error('content: a split is of single blocks');
  }
  if (clusters(initial).length !== 1) {
    throw new Error('content: a split starts as one row');
  }
}

// Take away (Phase 22): exactly the blocks it starts with, all on the mat,
// and at least one left when the taking is done (never down to nothing,
// design §1.1). From partners: they make the start, start in one joined row,
// and exactly one set of them (by sizes) adds up to what goes, so there is one
// right thing to send home. A countdown is of single blocks.
function assertTakeAway(spec: Extract<QuestionSpec, { kind: 'take_away' }>, puzzle: Puzzle): void {
  const { question, initial } = puzzle;
  if (!Number.isInteger(spec.start) || !Number.isInteger(spec.take) || spec.take < 1 || spec.start - spec.take < 1) {
    throw new Error(`content: taking ${spec.take} from ${spec.start} leaves nothing to count`);
  }
  if (puzzle.takeAway === undefined || puzzle.takeAway.start !== spec.start || puzzle.takeAway.take !== spec.take) {
    throw new Error('content: a take-away puzzle carries its start and take');
  }
  const first = spec.steps?.[0] ?? spec.take;
  if (question.kind !== 'quantity' || question.target !== spec.start - first) {
    throw new Error(`content: a take-away is judged as the count left, ${spec.start - first}`);
  }
  if (initial.units.size !== spec.start || initial.bench.size !== spec.start) {
    throw new Error(`content: taking away from ${spec.start} starts with exactly ${spec.start} blocks, all on the mat`);
  }
  const row = spec.onMat;
  if (row === undefined) {
    if (initial.groups.size > 0 || puzzle.onMat !== undefined) {
      throw new Error('content: a take-away without `onMat` is of single blocks');
    }
    return;
  }
  if (spec.steps !== undefined) {
    throw new Error('content: a countdown is of single blocks');
  }
  if (row.reduce((a, b) => a + b, 0) !== spec.start) {
    throw new Error(`content: ${row.join(' + ')} on the mat is not ${spec.start}`);
  }
  const ids = puzzle.onMat ?? [];
  const placed = ids.map((id) => initial.groups.get(id));
  if (ids.length !== row.length || initial.groups.size !== row.length || placed.some((g, k) => g === undefined || groupSize(g) !== row[k] || !g.unitIds.every((u) => initial.bench.has(u)))) {
    throw new Error(`content: ${row.join(', ')} must be all there is on the mat at the start`);
  }
  assertJoinedRow(initial, placed as ReadonlyArray<Group>);
  const sets = new Set(
    row
      .reduce<ReadonlyArray<ReadonlyArray<number>>>((all, n) => [...all, ...all.map((set) => [...set, n])], [[]])
      .filter((set) => set.reduce((a, b) => a + b, 0) === spec.take)
      .map((set) => [...set].sort((a, b) => a - b).join('+')),
  );
  if (sets.size !== 1) {
    throw new Error(`content: ${sets.size} ways to take ${spec.take} from ${row.join(' + ')}`);
  }
}

export function validate(puzzle: Puzzle, spec: QuestionSpec): void {
  const { question, initial, solution } = puzzle;
  assertInvariants(initial);
  // Only a given partner, partners to send back, or a take-away / split stop's
  // blocks start on the mat (each checked with its spec below).
  const preset = spec.kind === 'split' || spec.kind === 'take_away';
  if (initial.bench.size !== 0 && !preset && !(spec.kind === 'sum_composition' && (spec.given !== undefined || spec.onMat !== undefined))) {
    throw new Error('content: material must start in the tray');
  }

  switch (question.kind) {
    case 'split': {
      if (spec.kind !== 'split') {
        throw new Error(`content: question ${question.kind} does not match spec ${spec.kind}`);
      }
      assertSplit(spec, puzzle);
      break;
    }
    case 'quantity':
    case 'quantity_shape': {
      if (spec.kind === 'take_away') {
        assertTakeAway(spec, puzzle);
        break;
      }
      if (spec.kind !== 'quantity' && spec.kind !== 'quantity_shape') {
        throw new Error(`content: question ${question.kind} does not match spec ${spec.kind}`);
      }
      if (spec.extra < 1) {
        throw new Error('content: extra must be at least 1');
      }
      const decoys = spec.decoys ?? [];
      if (spec.handles === undefined && decoys.length > 0) {
        throw new Error('content: decoys come with handles');
      }
      const expected = question.target + spec.extra + decoys.reduce((a, b) => a + b, 0);
      if (initial.units.size !== expected) {
        throw new Error(`content: expected ${expected} units, got ${initial.units.size}`);
      }
      if (spec.handles !== undefined) {
        if (spec.kind === 'quantity' && spec.targets.length !== 1) {
          throw new Error('content: handles need a single-target pool');
        }
        const sum = spec.handles.reduce((a, b) => a + b, 0);
        if (spec.kind === 'quantity_shape' && sum !== question.target) {
          throw new Error(`content: a shape's handles must make ${question.target}, not ${sum}`);
        }
        assertPartnersFit(initial);
        // Otherwise the tray's partners are exactly the answer and need no thought.
        if (sum === question.target && decoys.length === 0) {
          throw new Error('content: handles need at least one decoy partner');
        }
      }
      if (question.kind === 'quantity_shape') {
        if (question.template.cells.length !== question.target) {
          throw new Error(`content: template has ${question.template.cells.length} cells for target ${question.target}`);
        }
        for (const variant of variants(question.template, question.symmetry ?? DEFAULT_SYMMETRY)) {
          if (!fits(variant, initial.bounds)) {
            throw new Error('content: a template variant does not fit the bench');
          }
        }
      }
      break;
    }
    case 'addition_exact':
    case 'sum_composition': {
      if (spec.kind !== 'addition_exact' && spec.kind !== 'sum_composition') {
        throw new Error(`content: question ${question.kind} does not match spec ${spec.kind}`);
      }
      assertDistractors(question, spec.distractors);
      assertPartnersFit(initial);
      const groups = [...initial.groups.values()];
      if (question.kind === 'addition_exact') {
        assertDistinctPartners(groups, question.operands);
      } else {
        for (const pair of question.allowed) {
          assertDistinctPartners(groups, pair);
        }
      }
      if (spec.kind === 'sum_composition') {
        assertWays(spec, puzzle, groups);
        assertGiven(spec, puzzle);
        assertOnMat(spec, puzzle, groups);
      }
      break;
    }
  }
  if (puzzle.given !== undefined && !(spec.kind === 'sum_composition' && spec.given !== undefined)) {
    throw new Error('content: a given partner comes from a sum spec with `given`');
  }
  if (puzzle.ways !== undefined && spec.kind !== 'sum_composition' && spec.kind !== 'split') {
    throw new Error('content: ways come from a sum or split spec');
  }
  if (puzzle.onMat !== undefined && spec.kind !== 'sum_composition' && spec.kind !== 'take_away') {
    throw new Error('content: partners on the mat come from a sum or take-away spec');
  }
  if ((puzzle.takeAway !== undefined) !== (spec.kind === 'take_away')) {
    throw new Error('content: a take-away puzzle comes from a take-away spec');
  }

  // Putting everything out is how a child finds "too many": it must never bounce.
  if (!holdsMaterial(initial)) {
    throw new Error('content: the material does not fit the bench all at once');
  }

  // A sequence: every step is a shape of the same count, and the reference
  // answer passes each one in turn on the way to the last.
  const steps = puzzle.steps ?? [question];
  if (spec.kind === 'quantity_shape' && spec.sequence === true) {
    if (steps.length !== spec.templates.length || steps.length < 2) {
      throw new Error('content: a sequence asks every template, at least two');
    }
    for (const step of steps) {
      if (step.kind !== 'quantity_shape' || step.template.cells.length !== spec.target) {
        throw new Error('content: every step of a sequence is a shape of the same count');
      }
    }
  } else if (spec.kind === 'take_away' && spec.steps !== undefined) {
    // A countdown: the counts left after each amount, at least two, adding up to the take.
    if (steps.length !== spec.steps.length || steps.length < 2) {
      throw new Error('content: a countdown takes away in at least two steps');
    }
    if (spec.steps.some((k) => !Number.isInteger(k) || k < 1) || spec.steps.reduce((a, b) => a + b, 0) !== spec.take) {
      throw new Error(`content: steps ${spec.steps.join(' + ')} do not add up to ${spec.take}`);
    }
    let left = spec.start;
    steps.forEach((step, i) => {
      left -= spec.steps![i]!;
      if (step.kind !== 'quantity' || step.target !== left) {
        throw new Error('content: every step of a countdown is the count left');
      }
    });
  } else if (puzzle.steps !== undefined) {
    throw new Error('content: steps come from a sequence or countdown spec');
  }

  // A sum asked several ways: each way passes once, with a pair the earlier
  // ways did not use.
  const last = stepCount(puzzle) - 1;
  const used: Pair[] = [];
  let state = initial;
  let reached = 0;
  solution.forEach((cmd, index) => {
    const r = apply(state, cmd);
    if (!r.ok) {
      throw new Error(`content: reference solution step ${index} (${cmd.type}) rejected: ${r.reason}`);
    }
    state = r.value;
    if (reached < last && judge(state, questionAt(puzzle, reached, used)).matched) {
      if (puzzle.ways !== undefined) {
        used.push(benchPair(state)!);
      }
      reached += 1;
    }
  });
  const verdict = judge(state, questionAt(puzzle, last, used));
  if (reached !== last || !verdict.matched) {
    throw new Error(`content: reference solution does not pass: ${verdict.matched ? 'a step was skipped' : verdict.reason}`);
  }
}
