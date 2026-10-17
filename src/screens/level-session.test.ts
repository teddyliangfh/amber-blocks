import { cell, unitIds } from '../core';
import { CONTENT_VERSION, chapterId, materialize, nodeId } from '../content';
import { atStart, commitCommand, countOrder, countProgress, countTap, countWordsStale, demoMove, givenPartner, isCounted, matOf, onlyGiven, previewCommand, recount, roomBeside, sameWayAgain, solvedEquation, solvedParts, startSession, undoCommand, wayAside } from './level-session';

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

  test('Phase 20: the two ways touching are one 14-block cluster, too many; sending the first back still works', () => {
    const touching = run(run(startSession(boss, null), threeFour).session, [
      { type: 'takeGroup', groupId: of(5), origin: cell(0, 1) },
      { type: 'takeGroup', groupId: of(2), origin: cell(5, 1) },
    ]);
    expect(touching.solvedNow).toBe(false);
    expect(touching.session.verdict).toMatchObject({ matched: false, benchCount: 14, reason: 'count-mismatch' });
    const sentBack = run(run(startSession(boss, null), threeFour).session, [...back(3, 4), ...fiveTwo]);
    expect(sentBack.solvedNow).toBe(true);
    expect(solvedEquation(sentBack.session)).toBe('5 + 2 = 7');
    // A first way that is not joined is not left out: it is what is on the mat.
    const apart = run(startSession(boss, null), [threeFour[0], { type: 'takeGroup', groupId: of(4), origin: cell(4, 0) }]);
    expect(apart.session.step).toBe(0);
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
    // Room beside it: on the top row there is; across the middle row there is not.
    expect(roomBeside(startSession(boss, firstOnly))).toBe(true);
    const middle = run(startSession(boss, null), threeFour.map((c) => ({ ...c, origin: cell(c.origin.x, 1) }))).session;
    expect(sameWayAgain(middle)).toBe(true);
    expect(roomBeside(middle)).toBe(false);
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
