import { cell, unitIds } from '../core';
import { CHAPTERS, CONTENT_VERSION, chapterId, materialize, nodeId } from '../content';
import { COMPARE_ORDER, asideCells, atStart, cloudTitle, commitCommand, countOrder, countProgress, countTap, countWordsStale, demoMove, givenPartner, isCounted, lineUp, matOf, onlyGiven, onlyOnMat, onlyPreset, previewCommand, recount, roomBeside, sameWayAgain, solvedEquation, solvedParts, startSession, takeAwayAt, targetNumberOf, undoCommand, wayAside, waysApart, workWaysApart } from './level-session';

const puzzle = materialize({ contentVersion: CONTENT_VERSION, chapterId: chapterId('ch1'), nodeId: nodeId('ch1-n2'), attemptVariant: 0, seed: 5 });
const ids = [...puzzle.initial.units.keys()];
// ch1-n2's mat is 3 × 3 (fitted, 2026-10-15): (2, 2) is its far corner.

describe('level session', () => {
  test('starts from the puzzle material or from saved work, judged immediately', () => {
    const s = startSession(puzzle, null);
    expect(s.verdict).toEqual({ matched: false, benchCount: 0, reason: 'count-mismatch' });
    const one = commitCommand(s, { type: 'take', unitId: ids[0]!, to: cell(0, 0) });
    if (!one.ok) {
      throw new Error(one.reason);
    }
    const resumed = startSession(puzzle, one.session.history.state);
    expect(resumed.verdict.benchCount).toBe(1);
    expect(resumed.history.past).toHaveLength(0);
  });

  test('commit updates the verdict; rejections report the reason; undo steps back', () => {
    let s = startSession(puzzle, null);
    const a = commitCommand(s, { type: 'take', unitId: ids[0]!, to: cell(0, 0) });
    const b = a.ok ? commitCommand(a.session, { type: 'take', unitId: ids[1]!, to: cell(2, 2) }) : a;
    if (!b.ok) {
      throw new Error(b.reason);
    }
    s = b.session;
    expect(s.verdict.matched).toBe(true);
    expect(commitCommand(s, { type: 'take', unitId: ids[2]!, to: cell(0, 0) })).toEqual({ ok: false, reason: 'occupied' });
    expect(previewCommand(s, { type: 'take', unitId: ids[2]!, to: cell(0, 0) })).toBe(false);
    expect(previewCommand(s, { type: 'take', unitId: ids[2]!, to: cell(1, 0) })).toBe(true);
    const back = undoCommand(s);
    expect(back?.verdict.benchCount).toBe(1);
    expect(undoCommand(startSession(puzzle, null))).toBeNull();
  });

  test('AC-02 / AC-27 / AC-28: counting taps speak the index, finish at the total, and void on change', () => {
    let s = startSession(puzzle, null);
    for (const [i, id] of ids.slice(0, 3).entries()) {
      const r = commitCommand(s, { type: 'take', unitId: id, to: cell(i, 0) });
      if (!r.ok) {
        throw new Error(r.reason);
      }
      s = r.session;
    }
    const first = countTap(s, ids[0]!);
    expect(first.outcome).toEqual({ kind: 'counted', index: 1, complete: false, total: 3 });
    const again = countTap(first.session, ids[0]!);
    expect(again.outcome).toEqual({ kind: 'ignored' });
    expect(isCounted(again.session, ids[0]!)).toBe(true);
    const second = countTap(again.session, ids[1]!);
    const third = countTap(second.session, ids[2]!);
    expect(third.outcome).toEqual({ kind: 'counted', index: 3, complete: true, total: 3 });
    const grown = commitCommand(third.session, { type: 'take', unitId: ids[3]!, to: cell(0, 1) });
    if (!grown.ok) {
      throw new Error(grown.reason);
    }
    expect(isCounted(grown.session, ids[0]!)).toBe(false);
    expect(countTap(grown.session, unitIds('ghost', 1)[0]!).outcome).toEqual({ kind: 'ignored' });
  });
});

describe('success event (review P2: history, current answer and feedback are separate)', () => {
  function step(s: ReturnType<typeof startSession>, cmd: Parameters<typeof commitCommand>[1]) {
    const r = commitCommand(s, cmd);
    if (!r.ok) {
      throw new Error(r.reason);
    }
    return r;
  }

  test('fires once on the move that solves; rearranging a right answer stays quiet', () => {
    const a = step(startSession(puzzle, null), { type: 'take', unitId: ids[0]!, to: cell(0, 0) });
    expect(a.solvedNow).toBe(false);
    const b = step(a.session, { type: 'take', unitId: ids[1]!, to: cell(1, 0) });
    expect(b.solvedNow).toBe(true);
    expect(b.session.verdict.matched).toBe(true);
    const moved = step(b.session, { type: 'move', unitId: ids[0]!, to: cell(2, 2) });
    expect(moved.session.verdict.matched).toBe(true);
    expect(moved.solvedNow).toBe(false);
    const again = step(moved.session, { type: 'move', unitId: ids[1]!, to: cell(0, 2) });
    expect(again.solvedNow).toBe(false);
  });

  test('breaking the answer turns it wrong now; building it again is a new solve', () => {
    const solved = step(step(startSession(puzzle, null), { type: 'take', unitId: ids[0]!, to: cell(0, 0) }).session, { type: 'take', unitId: ids[1]!, to: cell(1, 0) }).session;
    const broken = step(solved, { type: 'take', unitId: ids[2]!, to: cell(2, 0) });
    expect(broken.session.verdict.matched).toBe(false);
    expect(broken.solvedNow).toBe(false);
    const fixed = step(broken.session, { type: 'return', unitId: ids[2]! });
    expect(fixed.solvedNow).toBe(true);
  });

  test('resumed right work and undo back into a right answer are not solve events', () => {
    const solved = step(step(startSession(puzzle, null), { type: 'take', unitId: ids[0]!, to: cell(0, 0) }).session, { type: 'take', unitId: ids[1]!, to: cell(1, 0) }).session;
    const resumed = startSession(puzzle, solved.history.state);
    expect(resumed.verdict.matched).toBe(true);
    // The first rearrangement after resuming is not a solve either.
    expect(step(resumed, { type: 'move', unitId: ids[0]!, to: cell(2, 2) }).solvedNow).toBe(false);
    const broken = step(solved, { type: 'take', unitId: ids[2]!, to: cell(2, 0) }).session;
    const back = undoCommand(broken);
    expect(back?.verdict.matched).toBe(true);
  });
});

describe('counting inside partners, recount, and the visible sum (review: teaching feedback)', () => {
  const add = materialize({ contentVersion: CONTENT_VERSION, chapterId: chapterId('ch2'), nodeId: nodeId('ch2-n7'), attemptVariant: 0, seed: 5 });

  function solved() {
    return add.solution.reduce((s, cmd) => {
      const r = commitCommand(s, cmd);
      if (!r.ok) {
        throw new Error(r.reason);
      }
      return r.session;
    }, startSession(add, null));
  }

  test('every block of both partners can be counted once; the order is the counting number', () => {
    let s = solved();
    expect(s.verdict.matched).toBe(true);
    const blocks = [...s.history.state.bench.keys()];
    expect(blocks).toHaveLength(7);
    for (const [i, u] of blocks.entries()) {
      const r = countTap(s, u);
      expect(r.outcome).toEqual({ kind: 'counted', index: i + 1, complete: i === 6, total: 7 });
      s = r.session;
    }
    expect(countOrder(s).get(blocks[3]!)).toBe(4);
    expect(countProgress(s)).toEqual({ counted: 7, total: 7, complete: true });
    // Tapping again after the round is full is ignored, not a second count.
    expect(countTap(s, blocks[0]!).outcome).toEqual({ kind: 'ignored' });
    const again = recount(s);
    expect(countProgress(again)).toEqual({ counted: 0, total: 7, complete: false });
    expect(again.history).toBe(s.history);
    expect(countTap(again, blocks[5]!).outcome).toEqual({ kind: 'counted', index: 1, complete: false, total: 7 });
  });

  test('a right addition shows its sum; partners keep their own identity and colour source', () => {
    const s = solved();
    expect(solvedEquation(s)).toBe('3 + 4 = 7');
    const groups = [...s.history.state.groups.values()].filter((g) => g.unitIds.every((u) => s.history.state.bench.has(u)));
    expect(groups.map((g) => g.unitIds.length).sort()).toEqual([3, 4]);
    expect(solvedEquation(startSession(add, null))).toBeNull();
    expect(solvedEquation(startSession(puzzle, null))).toBeNull();
  });

  test('a free sum shows the pair actually used, left to right', () => {
    const free = materialize({ contentVersion: CONTENT_VERSION, chapterId: chapterId('ch2'), nodeId: nodeId('ch2-n4'), attemptVariant: 0, seed: 5 });
    const four = [...free.initial.groups.values()].find((g) => g.unitIds.length === 4)!;
    const one = [...free.initial.groups.values()].find((g) => g.unitIds.length === 1)!;
    let s = startSession(free, null);
    for (const cmd of [
      { type: 'takeGroup', groupId: one.id, origin: cell(0, 0) },
      { type: 'takeGroup', groupId: four.id, origin: cell(1, 0) },
    ] as const) {
      const r = commitCommand(s, cmd);
      if (!r.ok) {
        throw new Error(r.reason);
      }
      s = r.session;
    }
    expect(s.verdict.matched).toBe(true);
    expect(solvedEquation(s)).toBe('1 + 4 = 5');
  });
});

describe('stale counting words (2026-10-16 review H-3)', () => {
  test('only blocks on or off during a round with numbers make its words stale; moving them does not', () => {
    const ok = (r: ReturnType<typeof commitCommand>) => {
      if (!r.ok) {
        throw new Error(r.reason);
      }
      return r.session;
    };
    let s = startSession(puzzle, null);
    s = ok(commitCommand(s, { type: 'take', unitId: ids[0]!, to: cell(0, 0) }));
    s = ok(commitCommand(s, { type: 'take', unitId: ids[1]!, to: cell(1, 0) }));
    // Nothing counted yet: nothing to stop.
    expect(countWordsStale(s, ok(commitCommand(s, { type: 'take', unitId: ids[2]!, to: cell(2, 0) })))).toBe(false);
    const counted = countTap(s, ids[0]!).session;
    expect(countWordsStale(counted, ok(commitCommand(counted, { type: 'move', unitId: ids[1]!, to: cell(1, 1) })))).toBe(false);
    expect(countWordsStale(counted, ok(commitCommand(counted, { type: 'take', unitId: ids[2]!, to: cell(2, 0) })))).toBe(true);
    expect(countWordsStale(counted, ok(commitCommand(counted, { type: 'return', unitId: ids[1]! })))).toBe(true);
    // The same blocks swapped for others, same count: still another mat.
    const swapped = ok(commitCommand(ok(commitCommand(counted, { type: 'return', unitId: ids[1]! })), { type: 'take', unitId: ids[2]!, to: cell(1, 0) }));
    expect(countWordsStale(counted, swapped)).toBe(true);
  });
});

describe('a stop asked in steps (2026-10-15 review L: the same 4, a square and then a line)', () => {
  const four = materialize({ contentVersion: CONTENT_VERSION, chapterId: chapterId('ch1'), nodeId: nodeId('ch1-n6'), attemptVariant: 0, seed: 5 });
  const run = (s: ReturnType<typeof startSession>, cmds: ReadonlyArray<Parameters<typeof commitCommand>[1]>) =>
    cmds.reduce(
      (acc, cmd) => {
        const r = commitCommand(acc.session, cmd);
        if (!r.ok) {
          throw new Error(r.reason);
        }
        return { session: r.session, stepDone: acc.stepDone || r.stepDone, solvedNow: acc.solvedNow || r.solvedNow };
      },
      { session: s, stepDone: false, solvedNow: false },
    );

  test('the square is a step, not the solve; the line is the solve; the picture follows the step', () => {
    const start = startSession(four, null);
    expect(start.step).toBe(0);
    expect(start.whole).toBe(four);
    expect(start.puzzle.display.template).toEqual(four.steps![0]!.kind === 'quantity_shape' ? four.steps![0]!.template : null);
    const square = run(start, four.solution.slice(0, 4));
    expect(square.stepDone).toBe(true);
    expect(square.solvedNow).toBe(false);
    expect(square.session.step).toBe(1);
    expect(square.session.verdict).toMatchObject({ matched: false, reason: 'shape-mismatch' });
    expect(square.session.puzzle.display.template).toEqual(four.steps![1]!.kind === 'quantity_shape' ? four.steps![1]!.template : null);
    const line = run(square.session, four.solution.slice(4));
    expect(line.stepDone).toBe(false);
    expect(line.solvedNow).toBe(true);
    expect(line.session.verdict.matched).toBe(true);
    // Undo after a step keeps the step: steps only go forward.
    expect(undoCommand(line.session)?.step).toBe(1);
  });

  test('resuming: a square left on the mat carries on at the line; a finished stop opens on its last step', () => {
    const square = run(startSession(four, null), four.solution.slice(0, 4)).session.history.state;
    expect(startSession(four, square).step).toBe(1);
    const line = run(startSession(four, null), four.solution).session.history.state;
    const done = startSession(four, line, true);
    expect(done.step).toBe(1);
    expect(done.verdict.matched).toBe(true);
    // A one-question stop is always step 0 and its puzzle is the stop's.
    const two = startSession(puzzle, null, true);
    expect(two.step).toBe(0);
    expect(two.puzzle).toBe(puzzle);
  });
});

describe('Phase 19: 7 made two ways (ch2-n8) — the ways used so far are screen state, not the judge\'s', () => {
  const boss = materialize({ contentVersion: CONTENT_VERSION, chapterId: chapterId('ch2'), nodeId: nodeId('ch2-n8'), attemptVariant: 0, seed: 5 });
  const of = (size: number) => [...boss.initial.groups.values()].find((g) => g.unitIds.length === size)!.id;
  const run = (s: ReturnType<typeof startSession>, cmds: ReadonlyArray<Parameters<typeof commitCommand>[1]>) =>
    cmds.reduce(
      (acc, cmd) => {
        const r = commitCommand(acc.session, cmd);
        if (!r.ok) {
          throw new Error(r.reason);
        }
        return { session: r.session, stepDone: acc.stepDone || r.stepDone, solvedNow: acc.solvedNow || r.solvedNow };
      },
      { session: s, stepDone: false, solvedNow: false },
    );
  const threeFour = [
    { type: 'takeGroup', groupId: of(3), origin: cell(0, 0) },
    { type: 'takeGroup', groupId: of(4), origin: cell(3, 0) },
  ] as const;
  const fiveTwo = [
    { type: 'takeGroup', groupId: of(5), origin: cell(0, 0) },
    { type: 'takeGroup', groupId: of(2), origin: cell(5, 0) },
  ] as const;
  const back = (...sizes: number[]) => sizes.map((n) => ({ type: 'returnGroup', groupId: of(n) }) as const);

  test('the first way is a step and is used up; moving it around never counts; the other way is the solve', () => {
    const start = startSession(boss, null);
    expect(start.used).toEqual([]);
    expect(start.puzzle).toBe(boss);
    const first = run(start, threeFour);
    expect(first.stepDone).toBe(true);
    expect(first.solvedNow).toBe(false);
    expect(first.session.step).toBe(1);
    expect(first.session.used).toEqual([[3, 4]]);
    // Phase 20 Q1: the way made stands on its own, so it is left out; nothing is left to judge.
    expect(first.session.verdict).toMatchObject({ matched: false, benchCount: 0, reason: 'count-mismatch' });
    expect(first.session.puzzle.question).toEqual({ kind: 'sum_composition', sum: 7, allowed: [[5, 2]] });
    expect(sameWayAgain(first.session)).toBe(true);
    // The 3 tucks under the 4 and back, then both go back and come out again: still the used way.
    const shuffled = run(first.session, [
      { type: 'moveGroup', groupId: of(3), delta: cell(3, 1) },
      { type: 'moveGroup', groupId: of(3), delta: cell(-3, -1) },
      ...back(3, 4),
      ...threeFour,
    ]);
    expect(shuffled.stepDone || shuffled.solvedNow).toBe(false);
    expect(shuffled.session.step).toBe(1);
    expect(shuffled.session.used).toEqual([[3, 4]]);
    // Half of the used way going back is still "another way", not a mistake.
    expect(sameWayAgain(run(first.session, back(3)).session)).toBe(true);
    expect(sameWayAgain(run(first.session, [...back(3, 4), fiveTwo[0]]).session)).toBe(false);
    const done = run(first.session, [...back(3, 4), ...fiveTwo]);
    expect(done.solvedNow).toBe(true);
    expect(done.stepDone).toBe(false);
    expect(done.session.verdict.matched).toBe(true);
    expect(solvedEquation(done.session)).toBe('5 + 2 = 7');
    // Undo keeps the step and the used way: steps only go forward.
    expect(undoCommand(done.session)?.used).toEqual([[3, 4]]);
    // Either way can come first.
    expect(run(start, fiveTwo).session.used).toEqual([[5, 2]]);
  });

  test('resuming: a saved right way is the first way, used; a finished stop takes any way as right and asks nothing again', () => {
    const firstWay = run(startSession(boss, null), threeFour).session.history.state;
    const resumed = startSession(boss, firstWay);
    expect(resumed.step).toBe(1);
    expect(resumed.used).toEqual([[3, 4]]);
    expect(resumed.verdict.matched).toBe(false);
    const lastWay = run(startSession(boss, null), [...threeFour, ...back(3, 4), ...fiveTwo]).session.history.state;
    // Unfinished, the 5 + 2 on the mat is a first way too.
    expect(startSession(boss, lastWay).used).toEqual([[5, 2]]);
    for (const mat of [firstWay, lastWay]) {
      const finished = startSession(boss, mat, true);
      expect(finished.step).toBe(1);
      expect(finished.used).toEqual([]);
      expect(finished.verdict.matched).toBe(true);
    }
    // A half-built mat starts at the first way.
    expect(startSession(boss, run(startSession(boss, null), [threeFour[0]]).session.history.state).step).toBe(0);
  });

  // Phase 20 Q1: the first way may stay on the mat beside the second.
  const fiveTwoBelow = [
    { type: 'takeGroup', groupId: of(5), origin: cell(0, 2) },
    { type: 'takeGroup', groupId: of(2), origin: cell(5, 2) },
  ] as const;

  test('Phase 20: two ways side by side, not touching, are the solve; the cloud shows both; a reload keeps it right', () => {
    const first = run(startSession(boss, null), threeFour);
    expect(wayAside(first.session)).toBe(true);
    expect(matOf(first.session).bench.size).toBe(0);
    const five = run(first.session, [fiveTwoBelow[0]]);
    // The 5 alone beside the first way: short of 7, not "too many".
    expect(five.session.verdict).toMatchObject({ matched: false, benchCount: 5, reason: 'count-mismatch' });
    expect(sameWayAgain(five.session)).toBe(false);
    const done = run(five.session, [fiveTwoBelow[1]]);
    expect(done.solvedNow).toBe(true);
    expect(done.session.verdict).toMatchObject({ matched: true, benchCount: 7 });
    expect(solvedParts(done.session)).toEqual([5, 2]);
    expect(solvedEquation(done.session)).toBe('3 + 4 = 7\n5 + 2 = 7');
    // Finished and reopened: both ways are on the mat and it is still right.
    const reopened = startSession(boss, done.session.history.state, true);
    expect(reopened.verdict.matched).toBe(true);
    expect(solvedEquation(reopened)).toBe('3 + 4 = 7\n5 + 2 = 7');
    // Either way may be the first.
    const other = run(run(startSession(boss, null), fiveTwo).session, [
      { type: 'takeGroup', groupId: of(3), origin: cell(0, 2) },
      { type: 'takeGroup', groupId: of(4), origin: cell(3, 2) },
    ]);
    expect(other.solvedNow).toBe(true);
    expect(solvedEquation(other.session)).toBe('5 + 2 = 7\n3 + 4 = 7');
  });

  test('D-097: the two ways touching (the second on the row under the first) are the solve; sending the first back still works', () => {
    const touching = run(run(startSession(boss, null), threeFour).session, [
      { type: 'takeGroup', groupId: of(5), origin: cell(0, 1) },
      { type: 'takeGroup', groupId: of(2), origin: cell(5, 1) },
    ]);
    expect(touching.solvedNow).toBe(true);
    expect(touching.session.verdict).toMatchObject({ matched: true, benchCount: 7 });
    expect(solvedEquation(touching.session)).toBe('3 + 4 = 7\n5 + 2 = 7');
    const sentBack = run(run(startSession(boss, null), threeFour).session, [...back(3, 4), ...fiveTwo]);
    expect(sentBack.solvedNow).toBe(true);
    expect(solvedEquation(sentBack.session)).toBe('5 + 2 = 7');
    // A first way that is not joined is not left out: it is what is on the mat.
    const apart = run(startSession(boss, null), [threeFour[0], { type: 'takeGroup', groupId: of(4), origin: cell(4, 0) }]);
    expect(apart.session.step).toBe(0);
  });

  // D-097 (round-6 review L1): the boss outline lies across the middle row, so a
  // first way made on it leaves only the rows above and below, both touching it.
  const onOutline = threeFour.map((c) => ({ ...c, origin: cell(c.origin.x, 1) }));
  const fiveTwoOn = (y: number) => [
    { type: 'takeGroup', groupId: of(5), origin: cell(0, y) },
    { type: 'takeGroup', groupId: of(2), origin: cell(5, y) },
  ] as const;

  test.each([['above', 0], ['below', 2]] as const)('D-097: first way on the outline row, the second %s it, touching: short while half-built, then the solve; reopened, still right', (_, y) => {
    const first = run(startSession(boss, null), onOutline);
    expect(first.stepDone).toBe(true);
    const five = run(first.session, [fiveTwoOn(y)[0]]);
    // The 5 touches the 3 and the 4: still 5 of 7, never "7 too many".
    expect(five.session.verdict).toMatchObject({ matched: false, benchCount: 5, reason: 'count-mismatch' });
    expect(sameWayAgain(five.session)).toBe(false);
    expect(wayAside(five.session)).toBe(true);
    const done = run(five.session, [fiveTwoOn(y)[1]]);
    expect(done.solvedNow).toBe(true);
    expect(done.stepDone).toBe(false);
    expect(solvedParts(done.session)).toEqual([5, 2]);
    expect(solvedEquation(done.session)).toBe('3 + 4 = 7\n5 + 2 = 7');
    // The outline is told the first way's cells (the middle row); the join keeps the two ways apart.
    expect(asideCells(five.session).map((c) => c.y)).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(waysApart(done.session).map((u) => u.length)).toEqual([7, 7]);
    const node = CHAPTERS.flatMap((c) => c.nodes).find((n) => n.id === nodeId('ch2-n8'))!;
    expect(workWaysApart(node, done.session.history.state).map((u) => u.length)).toEqual([7, 7]);
    expect(waysApart(startSession(puzzle, null))).toEqual([]);
    // Finished and reopened: the two ways are one cluster of 14, and right.
    const reopened = startSession(boss, done.session.history.state, true);
    expect(reopened.step).toBe(1);
    expect(reopened.verdict.matched).toBe(true);
    expect(solvedEquation(reopened)).toBe('3 + 4 = 7\n5 + 2 = 7');
    // Reloaded halfway: carries on at the second way, the 5 short of 7.
    const resumed = startSession(boss, five.session.history.state);
    expect(resumed.step).toBe(1);
    expect(resumed.used).toEqual([[3, 4]]);
    expect(resumed.verdict).toMatchObject({ matched: false, benchCount: 5 });
    const after = commitCommand(resumed, fiveTwoOn(y)[1]);
    expect(after.ok && after.solvedNow).toBe(true);
  });

  test('D-097: the second way touching, a stray partner with it: only what is not the first way is judged', () => {
    const first = run(startSession(boss, null), onOutline).session;
    const stray = run(first, [{ type: 'takeGroup', groupId: of(1), origin: cell(7, 1) }, ...fiveTwoOn(0)]);
    // The 1 beside the 4 is too many for the 5 + 2, not the first way's fault.
    expect(stray.session.verdict).toMatchObject({ matched: false, benchCount: 8, reason: 'count-mismatch' });
    expect(run(stray.session, back(1)).solvedNow).toBe(true);
  });

  test('D-097: a way joined to the start of the other way is the first way; joined to a stray partner it is not', () => {
    // A 3 on the middle row, the 5 + 2 made on top of it: the 5 + 2 is a way and the 3 is half the other.
    const atOnce = run(startSession(boss, null), [
      { type: 'takeGroup', groupId: of(3), origin: cell(0, 1) },
      ...fiveTwoOn(0),
    ]);
    expect(atOnce.stepDone).toBe(true);
    expect(atOnce.session.used).toEqual([[5, 2]]);
    expect(atOnce.session.verdict).toMatchObject({ matched: false, benchCount: 3 });
    const done = run(atOnce.session, [{ type: 'takeGroup', groupId: of(4), origin: cell(3, 1) }]);
    expect(done.solvedNow).toBe(true);
    expect(solvedEquation(done.session)).toBe('5 + 2 = 7\n3 + 4 = 7');
    // The 1 is in no way to 7: 3 + 4 + 1 joined is 8, one too many, no way made.
    const extra = run(startSession(boss, null), [
      { type: 'takeGroup', groupId: of(1), origin: cell(0, 0) },
      ...onOutline,
    ]);
    expect(extra.stepDone).toBe(false);
    expect(extra.session.step).toBe(0);
    expect(extra.session.verdict).toMatchObject({ matched: false, benchCount: 8, reason: 'count-mismatch' });
  });

  test('Phase 20: a reload in the middle of the second way, beside the first, carries on at the second way', () => {
    const half = run(run(startSession(boss, null), threeFour).session, [fiveTwoBelow[0]]).session.history.state;
    const resumed = startSession(boss, half);
    expect(resumed.step).toBe(1);
    expect(resumed.used).toEqual([[3, 4]]);
    expect(resumed.verdict).toMatchObject({ matched: false, benchCount: 5 });
    const done = commitCommand(resumed, fiveTwoBelow[1]);
    expect(done.ok && done.solvedNow).toBe(true);
    // The first way alone, reloaded: as before, the second way is next.
    const firstOnly = run(startSession(boss, null), threeFour).session.history.state;
    expect(startSession(boss, firstOnly).step).toBe(1);
    // Room beside it: on the top row there is; across the middle row too, touching it (D-097).
    expect(roomBeside(startSession(boss, firstOnly))).toBe(true);
    const middle = run(startSession(boss, null), threeFour.map((c) => ({ ...c, origin: cell(c.origin.x, 1) }))).session;
    expect(sameWayAgain(middle)).toBe(true);
    expect(roomBeside(middle)).toBe(true);
  });

  test('the hand: past the first way, a partner of the way not made yet', () => {
    expect(demoMove(startSession(boss, null))).toBe(boss.solution[0]);
    const cleared = run(startSession(boss, null), [...threeFour, ...back(3, 4)]).session;
    const move = demoMove(cleared);
    expect(move?.type).toBe('takeGroup');
    expect(move?.type === 'takeGroup' ? [5, 2].includes(boss.initial.groups.get(move.groupId)!.unitIds.length) : false).toBe(true);
  });
});

describe('Phase 19: who\'s missing (ch2-n5, the 2 starts on the mat)', () => {
  const five = materialize({ contentVersion: CONTENT_VERSION, chapterId: chapterId('ch2'), nodeId: nodeId('ch2-n5'), attemptVariant: 0, seed: 5 });
  const given = five.given!;
  const of = (size: number) => [...five.initial.groups.values()].find((g) => g.unitIds.length === size)!.id;
  const commit = (s: ReturnType<typeof startSession>, cmd: Parameters<typeof commitCommand>[1]) => {
    const r = commitCommand(s, cmd);
    if (!r.ok) {
      throw new Error(r.reason);
    }
    return r;
  };

  test('the opening is the start: only the 2 on the mat, wherever it is; one move solves it, once, as 2 + 3 = 5', () => {
    const start = startSession(five, null);
    expect(givenPartner(start)?.id).toBe(given);
    expect(onlyGiven(start)).toBe(true);
    expect(atStart(start)).toBe(true);
    expect(start.verdict).toMatchObject({ matched: false, benchCount: 2 });
    const moved = commit(start, { type: 'moveGroup', groupId: given, delta: cell(1, -1) }).session;
    expect(atStart(moved)).toBe(true);
    const empty = commit(start, { type: 'returnGroup', groupId: given }).session;
    expect(onlyGiven(empty)).toBe(false);
    expect(atStart(empty)).toBe(true);
    const solved = commit(start, five.solution[0]!);
    expect(solved.solvedNow).toBe(true);
    expect(solved.stepDone).toBe(false);
    expect(solvedEquation(solved.session)).toBe('2 + 3 = 5');
    expect(atStart(solved.session)).toBe(false);
    // A stop without a given partner: the empty mat is the start, as before.
    expect(givenPartner(startSession(puzzle, null))).toBeNull();
    expect(atStart(startSession(puzzle, null))).toBe(true);
  });

  test('the hand carries the 3 and puts it down beside the 2, wherever the 2 now sits', () => {
    const start = startSession(five, null);
    const at = (s: ReturnType<typeof startSession>) => {
      const m = demoMove(s);
      return m?.type === 'takeGroup' ? { piece: m.groupId, origin: m.origin } : null;
    };
    const y = [...five.initial.bench.values()][0]!.y;
    expect(at(start)).toEqual({ piece: of(3), origin: { x: 2, y } });
    const moved = commit(start, { type: 'moveGroup', groupId: given, delta: cell(1, -1) }).session;
    expect(at(moved)).toEqual({ piece: of(3), origin: { x: 3, y: y - 1 } });
    // No room on its right (the 2 at the right edge): on its left.
    const edge = commit(start, { type: 'moveGroup', groupId: given, delta: cell(five.initial.bounds.cols - 2, 0) }).session;
    expect(at(edge)).toEqual({ piece: of(3), origin: { x: five.initial.bounds.cols - 5, y } });
    // No room on either side (the 2 in the middle of the 6-wide mat): the reference move, unchanged.
    expect(five.initial.bounds.cols).toBe(6);
    const middle = commit(start, { type: 'moveGroup', groupId: given, delta: cell(2, 0) }).session;
    expect(at(middle)).toEqual({ piece: of(3), origin: { x: 2, y } });
  });
});

describe('Phase 21: send the extra away (ch2-n10, 3 + 4 + 2 on the mat, make 7)', () => {
  const p = materialize({ contentVersion: CONTENT_VERSION, chapterId: chapterId('ch2'), nodeId: nodeId('ch2-n10'), attemptVariant: 0, seed: 5 });
  const [three, four, two] = p.onMat!;
  const run = (cmds: ReadonlyArray<Parameters<typeof commitCommand>[1]>) =>
    cmds.reduce((s, cmd) => {
      const r = commitCommand(s, cmd);
      if (!r.ok) {
        throw new Error(r.reason);
      }
      return r.session;
    }, startSession(p, null));

  test('the opening is the row, wherever its partners are moved; the hand sends the 2 back', () => {
    const s = startSession(p, null);
    expect(onlyOnMat(s)).toBe(true);
    expect(atStart(s)).toBe(true);
    expect(s.verdict).toEqual({ matched: false, benchCount: 9, reason: 'count-mismatch' });
    expect(demoMove(s)).toEqual({ type: 'returnGroup', groupId: two });
    // The 2 moved to the row above: still all three, still the opening.
    const moved = run([{ type: 'moveGroup', groupId: two!, delta: cell(0, -1) }]);
    expect(onlyOnMat(moved)).toBe(true);
    // Other stops have no such opening.
    expect(onlyOnMat(startSession(puzzle, null))).toBe(false);
  });

  test('sending the 2 back is the solve: 3 + 4 = 7, celebrated once', () => {
    const r = commitCommand(startSession(p, null), { type: 'returnGroup', groupId: two! });
    expect(r.ok && r.solvedNow).toBe(true);
    const s = r.ok ? r.session : startSession(p, null);
    expect(s.verdict.matched).toBe(true);
    expect(solvedEquation(s)).toBe('3 + 4 = 7');
    expect(onlyOnMat(s)).toBe(false);
  });

  test('sending another back is no opening; everything back is an empty mat, and the hand brings a partner of the pair', () => {
    const wrong = run([{ type: 'returnGroup', groupId: four! }]);
    expect(onlyOnMat(wrong)).toBe(false);
    expect(atStart(wrong)).toBe(false);
    expect(wrong.verdict.benchCount).toBe(5);
    const empty = run([{ type: 'returnGroup', groupId: four! }, { type: 'returnGroup', groupId: three! }, { type: 'returnGroup', groupId: two! }]);
    expect(atStart(empty)).toBe(true);
    const hand = demoMove(empty);
    expect(hand?.type).toBe('takeGroup');
    expect(hand?.type === 'takeGroup' ? [three, four].includes(hand.groupId) : false).toBe(true);
  });
});

describe('Phase 22: Take-away Island', () => {
  const of = (id: string) => materialize({ contentVersion: CONTENT_VERSION, chapterId: chapterId('ch3'), nodeId: nodeId(id), attemptVariant: 0, seed: 5 });
  const run = (p: ReturnType<typeof of>, cmds: ReadonlyArray<Parameters<typeof commitCommand>[1]>, from = startSession(p, null)) =>
    cmds.reduce((s, cmd) => {
      const r = commitCommand(s, cmd);
      if (!r.ok) {
        throw new Error(`${cmd.type}: ${r.reason}`);
      }
      return r.session;
    }, from);
  const row = (p: ReturnType<typeof of>) => [...p.initial.bench.entries()].sort(([, a], [, b]) => a.x - b.x).map(([u]) => u);

  test('a split (ch3-n1): the row as dealt is the opening, pushed about or not; the hand pulls the last block one cell right; pulled apart it is right and reads 3 = 1 + 2', () => {
    const p = of('ch3-n1');
    const units = row(p);
    const s = startSession(p, null);
    expect(onlyPreset(s)).toBe(true);
    expect(atStart(s)).toBe(true);
    expect(s.verdict).toEqual({ matched: false, benchCount: 3, reason: 'parts-mismatch' });
    expect(cloudTitle(s)).toBe('3');
    expect(solvedEquation(s)).toBeNull();
    expect(demoMove(s)).toEqual({ type: 'move', unitId: units[2], to: { x: 3, y: 1 } });
    // The whole row moved up: still the opening.
    const up = run(p, units.map((u, i) => ({ type: 'move' as const, unitId: u, to: cell(i, 0) })).reverse());
    expect(onlyPreset(up)).toBe(true);
    const r = commitCommand(s, { type: 'move', unitId: units[2]!, to: cell(3, 1) });
    expect(r.ok && r.solvedNow).toBe(true);
    const done = r.ok ? r.session : s;
    expect(solvedParts(done)).toEqual([2, 1]);
    expect(solvedEquation(done)).toBe('3 = 2 + 1');
    expect(onlyPreset(done)).toBe(false);
    expect(demoMove(done)).toBeUndefined();
    // Pulled the other way: 1 + 2.
    const left = run(p, [{ type: 'move', unitId: units[0]!, to: cell(0, 0) }]);
    expect(left.verdict.matched).toBe(true);
    expect(solvedEquation(left)).toBe('3 = 1 + 2');
    // One sent to the tray: no longer the opening, not right.
    const sent = run(p, [{ type: 'return', unitId: units[2]! }]);
    expect(onlyPreset(sent)).toBe(false);
    expect(sent.verdict.reason).toBe('count-mismatch');
    expect(targetNumberOf(s)).toBe(3);
  });

  test('two ways to split 5 (ch3-n4): the first split is a step done, the same split moved about is not another, the second is the solve and the cloud reads both; pushed back together it is the opening again', () => {
    const p = of('ch3-n4');
    const units = row(p);
    const first = commitCommand(startSession(p, null), { type: 'move', unitId: units[4]!, to: cell(5, 1) });
    expect(first.ok && first.stepDone && !first.solvedNow).toBe(true);
    const s1 = first.ok ? first.session : startSession(p, null);
    expect(s1.step).toBe(1);
    expect(s1.used).toEqual([[4, 1]]);
    expect(s1.verdict).toEqual({ matched: false, benchCount: 5, reason: 'split-used' });
    expect(cloudTitle(s1)).toBe('5');
    expect(solvedEquation(s1)).toBeNull();
    // The pulled block moved elsewhere, still 1 and 4: still used.
    const moved = run(p, [{ type: 'move', unitId: units[4]!, to: cell(5, 0) }], s1);
    expect(moved.verdict.reason).toBe('split-used');
    expect(moved.step).toBe(1);
    // Pushed back together: the opening of the second way; the hand shows a move that makes a new split.
    const together = run(p, [{ type: 'move', unitId: units[4]!, to: cell(4, 1) }], s1);
    expect(onlyPreset(together)).toBe(true);
    expect(together.used).toEqual([[4, 1]]);
    const hand = demoMove(together);
    expect(hand).toEqual({ type: 'move', unitId: units[3], to: { x: 4, y: 2 } });
    const viaHand = commitCommand(together, hand!);
    expect(viaHand.ok && viaHand.solvedNow).toBe(true);
    // 2 + 3 from 1 + 4 by moving one more block: the solve, both lines on the cloud.
    const second = commitCommand(s1, { type: 'move', unitId: units[3]!, to: cell(4, 1) });
    expect(second.ok && second.solvedNow && !second.stepDone).toBe(true);
    const done = second.ok ? second.session : s1;
    expect(solvedParts(done)).toEqual([3, 2]);
    expect(solvedEquation(done)).toBe('5 = 4 + 1\n5 = 3 + 2');
    // Reopened finished: any split is right at once, one line.
    const again = startSession(p, done.history.state, true);
    expect(again.verdict.matched).toBe(true);
    expect(again.step).toBe(1);
    expect(solvedEquation(again)).toBe('5 = 3 + 2');
    // Saved work halfway (1 + 4): the first way is counted, the second asked.
    const resumed = startSession(p, s1.history.state);
    expect(resumed.step).toBe(1);
    expect(resumed.used).toEqual([[4, 1]]);
    expect(resumed.verdict.reason).toBe('split-used');
  });

  test('a take-away (ch3-n5): the cloud reads 5 − 2, the row as dealt is the opening, the hand sends the last block home; two home is right and reads 5 − 2 = 3; three home is too many', () => {
    const p = of('ch3-n5');
    const units = row(p);
    const s = startSession(p, null);
    expect(cloudTitle(s)).toBe('5 − 2');
    expect(takeAwayAt(s)).toEqual({ start: 5, take: 2 });
    expect(onlyPreset(s)).toBe(true);
    expect(atStart(s)).toBe(true);
    expect(demoMove(s)).toEqual({ type: 'return', unitId: units[4] });
    expect(targetNumberOf(s)).toBe(3);
    const one = run(p, [{ type: 'return', unitId: units[0]! }]);
    expect(onlyPreset(one)).toBe(false);
    expect(one.verdict).toEqual({ matched: false, benchCount: 4, reason: 'count-mismatch' });
    // The hand now sends a block that is still on the mat.
    expect(demoMove(one)).toEqual({ type: 'return', unitId: units[4] });
    const two = commitCommand(one, { type: 'return', unitId: units[2]! });
    expect(two.ok && two.solvedNow).toBe(true);
    const done = two.ok ? two.session : one;
    expect(solvedEquation(done)).toBe('5 − 2 = 3');
    expect(cloudTitle(done)).toBe('5 − 2');
    const three = run(p, [{ type: 'return', unitId: units[4]! }], done);
    expect(three.verdict).toEqual({ matched: false, benchCount: 2, reason: 'count-mismatch' });
    expect(solvedEquation(three)).toBeNull();
  });

  test('a take-away from partners (ch3-n6): the row is the opening (onlyOnMat), the hand sends the 2 home; the 4 sent is wrong; 7 − 3 from 3 + 2 + 2: both 2s sent is 3 blocks, not 4', () => {
    const p = of('ch3-n6');
    const [four, two] = p.onMat!;
    const s = startSession(p, null);
    expect(onlyOnMat(s)).toBe(true);
    expect(onlyPreset(s)).toBe(false);
    expect(atStart(s)).toBe(true);
    expect(cloudTitle(s)).toBe('6 − 2');
    expect(demoMove(s)).toEqual({ type: 'returnGroup', groupId: two });
    const right = commitCommand(s, { type: 'returnGroup', groupId: two! });
    expect(right.ok && right.solvedNow).toBe(true);
    expect(solvedEquation(right.ok ? right.session : s)).toBe('6 − 2 = 4');
    const wrong = run(p, [{ type: 'returnGroup', groupId: four! }]);
    expect(wrong.verdict).toEqual({ matched: false, benchCount: 2, reason: 'count-mismatch' });
    expect(atStart(wrong)).toBe(false);
    const q = of('ch3-n7');
    const [, a, b] = q.onMat!;
    const both = run(q, [{ type: 'returnGroup', groupId: a! }, { type: 'returnGroup', groupId: b! }]);
    expect(both.verdict).toEqual({ matched: false, benchCount: 3, reason: 'count-mismatch' });
  });

  test('the countdown (ch3-n8): 5 − 1, then 4 − 1, 3 − 1, 2 − 1, each step done as a block goes home, the last the solve; saved work resumes at its step', () => {
    const p = of('ch3-n8');
    const units = row(p);
    let s = startSession(p, null);
    expect(cloudTitle(s)).toBe('5 − 1');
    expect(takeAwayAt(s)).toEqual({ start: 5, take: 1 });
    expect(onlyPreset(s)).toBe(true);
    const seen: string[] = [];
    for (const [i, u] of [units[4], units[3], units[2]].entries()) {
      const r = commitCommand(s, { type: 'return', unitId: u! });
      expect(r.ok && r.stepDone && !r.solvedNow).toBe(true);
      s = r.ok ? r.session : s;
      expect(s.step).toBe(i + 1);
      seen.push(cloudTitle(s));
      expect(takeAwayAt(s)).toEqual({ start: 4 - i, take: 1 });
      expect(onlyPreset(s)).toBe(false);
    }
    expect(seen).toEqual(['4 − 1', '3 − 1', '2 − 1']);
    const last = commitCommand(s, { type: 'return', unitId: units[1]! });
    expect(last.ok && last.solvedNow && !last.stepDone).toBe(true);
    const done = last.ok ? last.session : s;
    expect(solvedEquation(done)).toBe('2 − 1 = 1');
    expect(targetNumberOf(done)).toBe(1);
    // Two blocks sent at once skips nothing: 3 left is step 2 at once.
    const quick = run(p, [{ type: 'return', unitId: units[4]! }, { type: 'return', unitId: units[3]! }]);
    expect(quick.step).toBe(2);
    expect(cloudTitle(quick)).toBe('3 − 1');
    const resumed = startSession(p, quick.history.state);
    expect(resumed.step).toBe(2);
    expect(resumed.verdict).toEqual({ matched: false, benchCount: 3, reason: 'count-mismatch' });
    // Finished and reopened: the last count, right.
    expect(startSession(p, done.history.state, true).verdict.matched).toBe(true);
  });
});

describe('Phase 23c: Compare Island', () => {
  const of = (id: string) => materialize({ contentVersion: CONTENT_VERSION, chapterId: chapterId('ch4'), nodeId: nodeId(id), attemptVariant: 0, seed: 5 });
  const run = (p: ReturnType<typeof of>, cmds: ReadonlyArray<Parameters<typeof commitCommand>[1]>, from = startSession(p, null)) =>
    cmds.reduce((s, cmd) => {
      const r = commitCommand(s, cmd);
      if (!r.ok) {
        throw new Error(`${cmd.type}: ${r.reason}`);
      }
      return r.session;
    }, from);
  const singles = (p: ReturnType<typeof of>, n: number, from = 0) => [...p.initial.units.keys()].slice(from, from + n).map((unitId, i) => ({ type: 'take' as const, unitId, to: cell(from + i, 0) }));
  const partnerOf = (p: ReturnType<typeof of>, n: number) => [...p.initial.groups.values()].find((g) => g.unitIds.length === n)!.id;

  test('as many (ch4-n1): the cloud shows the rail\'s 3; the hand puts the first block right under it; three is right and reads 3 = 3, four is not', () => {
    const p = of('ch4-n1');
    const s = startSession(p, null);
    expect(atStart(s)).toBe(true);
    expect(cloudTitle(s)).toBe('3');
    expect(targetNumberOf(s)).toBe(3);
    expect(solvedEquation(s)).toBeNull();
    expect(demoMove(s)).toMatchObject({ type: 'take', to: { x: 0, y: 0 } });
    expect(COMPARE_ORDER).toBe('child-first');
    const r = commitCommand(run(p, singles(p, 2)), singles(p, 3)[2]!);
    expect(r.ok && r.solvedNow).toBe(true);
    const three = r.ok ? r.session : s;
    expect(solvedEquation(three)).toBe('3 = 3');
    const four = run(p, singles(p, 1, 3), three);
    expect(four.verdict).toEqual({ matched: false, benchCount: 4, reason: 'count-mismatch' });
    expect(solvedEquation(four)).toBeNull();
    // The rail is not on the mat: a row of three anywhere is three.
    expect(run(p, [0, 1, 2].map((i) => ({ type: 'take' as const, unitId: [...p.initial.units.keys()][i]!, to: cell(2 + i, 1) }))).verdict.matched).toBe(true);
  });

  test('more (ch4-n2) reads 3 > 2 and 4 > 2; fewer by picking (ch4-n3) reads 2 < 4; the solved row is the child\'s number', () => {
    const more = of('ch4-n2');
    const three = run(more, singles(more, 3));
    expect(solvedEquation(three)).toBe('3 > 2');
    expect(targetNumberOf(three)).toBe(3);
    expect(solvedEquation(run(more, singles(more, 1, 3), three))).toBe('4 > 2');
    const fewer = of('ch4-n3');
    const two = run(fewer, [{ type: 'takeGroup', groupId: partnerOf(fewer, 2), origin: cell(0, 0) }]);
    expect(solvedEquation(two)).toBe('2 < 4');
    expect(cloudTitle(startSession(fewer, null))).toBe('4');
    expect(demoMove(startSession(fewer, null))).toEqual({ type: 'takeGroup', groupId: partnerOf(fewer, 2), origin: cell(0, 0) });
  });

  test('one more three times (ch4-n4): the rail grows 3 → 4 → 5 as each is built; saved work resumes on the step it reached', () => {
    const p = of('ch4-n4');
    let s = startSession(p, null);
    const steps: number[] = [];
    for (const cmd of singles(p, 6)) {
      const r = commitCommand(s, cmd);
      if (!r.ok) {
        throw new Error(r.reason);
      }
      s = r.session;
      if (r.stepDone) {
        steps.push(s.history.state.bench.size);
      }
      // The cloud shows the rail as it is now (solvedEquation takes over once right).
      expect(cloudTitle(s)).toBe(String(s.puzzle.question.kind === 'compare' ? s.puzzle.question.given : 0));
    }
    expect(steps).toEqual([4, 5]);
    expect(s.step).toBe(2);
    expect(s.verdict.matched).toBe(true);
    expect(solvedEquation(s)).toBe('6 > 5');
    // Reloaded with 5 on the mat: the first two steps are behind it, the rail is 5, one more to go.
    const five = startSession(p, run(p, singles(p, 5)).history.state);
    expect(five.step).toBe(2);
    expect(five.puzzle.question).toEqual({ kind: 'compare', given: 5, relation: 'one_more' });
    expect(five.verdict.matched).toBe(false);
    // With 6: done.
    expect(startSession(p, s.history.state).verdict.matched).toBe(true);
    // Taken back below the rail, the steps stay where they are.
    const back = run(p, [{ type: 'return', unitId: [...p.initial.units.keys()][5]! }, { type: 'return', unitId: [...p.initial.units.keys()][4]! }], s);
    expect(back.step).toBe(2);
    expect(cloudTitle(back)).toBe('5');
  });

  test('the line-up (ch4-n8): no number on the cloud; 1, 3 and 4 side by side are three characters, never one 8; it reads 1 < 3 < 4', () => {
    const p = of('ch4-n8');
    const s = startSession(p, null);
    expect(cloudTitle(s)).toBe('');
    expect(targetNumberOf(s)).toBe(4);
    const done = run(p, p.solution);
    expect(done.verdict.matched).toBe(true);
    expect(solvedEquation(done)).toBe('1 < 3 < 4');
    expect(waysApart(done).map((w) => w.length).sort()).toEqual([1, 3, 4]);
    expect(workWaysApart(CHAPTERS.find((c) => c.id === 'ch4')!.nodes[7]!, done.history.state).map((w) => w.length).sort()).toEqual([1, 3, 4]);
    expect(lineUp(done.history.state)).toEqual([1, 3, 4]);
    expect(solvedEquation(run(p, p.solution.slice(0, 2)))).toBeNull();
  });
});
