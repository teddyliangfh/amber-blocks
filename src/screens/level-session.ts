import { apply, areTouching, benchCount, clusters, commit, countUnit, createHistory, groupSize, judge, reconcile, startRound, undo } from '../core';
import type { BenchState, Command, CountRound, Group, GroupId, History, RejectReason, UnitId, Verdict } from '../core';
import { benchPair, questionAt, samePair, stepCount } from '../content';
import type { Pair, Puzzle } from '../content';

// Everything a level screen needs to know between gestures, kept pure so the
// rules can be tested without rendering: committed history, the current verdict
// and the counting round. Saving and audio are the screen's job.

export interface LevelSession {
  // The stop as it is asked right now: for a stop asked in steps (the same 4,
  // a square and then a line), the current step's question and picture.
  readonly puzzle: Puzzle;
  readonly history: History;
  readonly verdict: Verdict;
  readonly round: CountRound;
  // Which step (always 0 for a one-question stop), and the stop's whole puzzle.
  readonly step: number;
  readonly whole: Puzzle;
  // A sum asked several ways ("two ways to make 7", Phase 19): the pairs the
  // steps before this one were made with, which this step no longer accepts.
  // Empty for every other stop. Screen state only: the judge never sees it, and
  // nothing new is saved (a reload works it out again from the saved mat).
  readonly used: ReadonlyArray<Pair>;
}

function lastStep(whole: Puzzle): number {
  return stepCount(whole) - 1;
}

// The puzzle as step `step` asks it, after the ways in `used`.
export function stepView(whole: Puzzle, step: number, used: ReadonlyArray<Pair> = []): Puzzle {
  const q = questionAt(whole, step, used);
  if (q === whole.question) {
    return whole;
  }
  return { ...whole, question: q, display: { ...whole.display, template: q.kind === 'quantity_shape' ? q.template : null } };
}

// One step done on this mat: the next step, and for a sum asked several ways
// the pair that made it, which the steps after it no longer accept.
function advance(whole: Puzzle, state: BenchState, step: number, used: ReadonlyArray<Pair>): { readonly step: number; readonly used: ReadonlyArray<Pair> } {
  const pair = whole.ways === undefined ? null : benchPair(state);
  return { step: step + 1, used: pair === null ? used : [...used, pair] };
}

// A way made on a sum asked several ways that stands on its own on the mat:
// one cluster that is exactly two partners, joined, making one of `pairs`
// (each pair once). Its sizes left (then top) first.
interface StandingWay {
  readonly parts: Pair;
  readonly units: ReadonlySet<UnitId>;
  readonly groups: ReadonlySet<GroupId>;
}

function corner(state: BenchState, unitIds: ReadonlyArray<UnitId>): { readonly x: number; readonly y: number } {
  const cells = unitIds.map((u) => state.bench.get(u)!);
  return { x: Math.min(...cells.map((c) => c.x)), y: Math.min(...cells.map((c) => c.y)) };
}

// In mat order: the top one first, then the left one.
function standingWays(state: BenchState, pairs: ReadonlyArray<Pair>): ReadonlyArray<StandingWay> {
  const left = [...pairs];
  const partners = [...state.groups.values()].filter((g) => g.unitIds.every((u) => state.bench.has(u)));
  const out: StandingWay[] = [];
  const parts = clusters(state)
    .map((c) => ({ units: new Set(c.unitIds), at: corner(state, c.unitIds) }))
    .sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x);
  for (const c of parts) {
    const inside = partners.filter((g) => c.units.has(g.unitIds[0]!));
    const [a, b] = inside;
    if (inside.length !== 2 || groupSize(a!) + groupSize(b!) !== c.units.size) {
      continue;
    }
    const [x, y] = [a!, b!].sort((p, q) => corner(state, p.unitIds).x - corner(state, q.unitIds).x || corner(state, p.unitIds).y - corner(state, q.unitIds).y);
    const sizes: Pair = [groupSize(x!), groupSize(y!)];
    const i = left.findIndex((p) => samePair(p, sizes));
    if (i === -1) {
      continue;
    }
    left.splice(i, 1);
    out.push({ parts: sizes, units: c.units, groups: new Set([a!.id, b!.id]) });
  }
  return out;
}

// The mat less the ways in `ways`: what is left to judge.
function without(state: BenchState, ways: ReadonlyArray<StandingWay>): BenchState {
  if (ways.length === 0) {
    return state;
  }
  const units = new Set(ways.flatMap((w) => [...w.units]));
  const groups = new Set(ways.flatMap((w) => [...w.groups]));
  return {
    ...state,
    bench: new Map([...state.bench].filter(([u]) => !units.has(u))),
    groups: new Map([...state.groups].filter(([id]) => !groups.has(id))),
  };
}

// The part of the mat a step judges (Phase 20, play review Q1). Past the first
// way of a sum asked several ways, a way already made may stay on the mat
// beside the next one: each used way that stands on its own (its two partners
// joined, nothing else touching them) is left out and the rest is judged.
// Sending the first way back still works: then nothing is left out. The core
// judge is unchanged; this only chooses what it is shown.
export function judgedMat(state: BenchState, used: ReadonlyArray<Pair>): BenchState {
  return used.length === 0 ? state : without(state, standingWays(state, used));
}

// The session's own judged part of the mat (see judgedMat).
export function matOf(session: LevelSession): BenchState {
  return judgedMat(session.history.state, session.used);
}

// Whether a used way stands on the mat, left out of the judging.
export function wayAside(session: LevelSession): boolean {
  return matOf(session) !== session.history.state;
}

// The steps this mat has done, from `at` on. A step is done when what is left
// to judge answers it; on a sum asked several ways also when a way it accepts
// stands on its own beside more blocks (made first, the next way beside it, as
// a reload in the middle of the second way finds it). `byJudge` false: only
// the second kind (a finished stop is not asked again).
function walk(whole: Puzzle, state: BenchState, from: { readonly step: number; readonly used: ReadonlyArray<Pair> }, byJudge: boolean): { readonly step: number; readonly used: ReadonlyArray<Pair> } {
  let at = from;
  while (at.step < lastStep(whole)) {
    const view = judgedMat(state, at.used);
    const q = stepView(whole, at.step, at.used).question;
    if (byJudge && judge(view, q).matched) {
      at = advance(whole, view, at.step, at.used);
      continue;
    }
    const beside = whole.ways !== undefined && q.kind === 'sum_composition' ? standingWays(view, q.allowed)[0] : undefined;
    if (beside === undefined || beside.units.size === view.bench.size) {
      break;
    }
    at = { step: at.step + 1, used: [...at.used, beside.parts] };
  }
  return at;
}

// A finished stop opens on its last step, every way accepted again (a finished
// stop is not asked again: any allowed pair on the mat is right), less a way
// that stands beside another (two ways of a finished boss side by side);
// otherwise saved work that already passed a step carries on from the next
// one, quietly (a right pair on a two-ways stop counts as the first way).
export function startSession(whole: Puzzle, work: BenchState | null, finished = false): LevelSession {
  const history = createHistory(work ?? whole.initial);
  const walked = walk(whole, history.state, { step: 0, used: [] }, !finished);
  const at = finished ? { step: lastStep(whole), used: walked.used } : walked;
  const puzzle = stepView(whole, at.step, at.used);
  return { puzzle, history, verdict: judge(judgedMat(history.state, at.used), puzzle.question), round: startRound(history.state), step: at.step, whole, used: at.used };
}

// `solvedNow` is the one success event: a committed move that turns a wrong
// answer into a right one. Rearranging a right answer, undoing into one or
// resuming saved work never fires it, so celebration plays once per solve.
// `stepDone`: the move finished a step that is not the last; the session has
// moved on to the next picture, on the same blocks. Steps only go forward.
export type CommitOutcome =
  | { readonly ok: true; readonly session: LevelSession; readonly solvedNow: boolean; readonly stepDone: boolean }
  | { readonly ok: false; readonly reason: RejectReason };

export function commitCommand(session: LevelSession, cmd: Command): CommitOutcome {
  const r = commit(session.history, cmd);
  if (!r.ok) {
    return { ok: false, reason: r.reason };
  }
  const state = r.value.state;
  const at = walk(session.whole, state, { step: session.step, used: session.used }, true);
  const puzzle = at.step === session.step ? session.puzzle : stepView(session.whole, at.step, at.used);
  const verdict = judge(judgedMat(state, at.used), puzzle.question);
  const step = at.step;
  return {
    ok: true,
    session: { puzzle, history: r.value, verdict, round: reconcile(session.round, state), step, whole: session.whole, used: at.used },
    solvedNow: verdict.matched && !session.verdict.matched,
    stepDone: step !== session.step,
  };
}

export function undoCommand(session: LevelSession): LevelSession | null {
  const r = undo(session.history);
  if (!r.ok) {
    return null;
  }
  const state = r.value.state;
  return { ...session, history: r.value, verdict: judge(judgedMat(state, session.used), session.puzzle.question), round: reconcile(session.round, state) };
}

// Would this command be accepted? Used for the snap preview; nothing is committed.
export function previewCommand(session: LevelSession, cmd: Command): boolean {
  return apply(session.history.state, cmd).ok;
}

export type CountOutcome =
  | { readonly kind: 'counted'; readonly index: number; readonly complete: boolean; readonly total: number }
  | { readonly kind: 'ignored' };

// What counting needs from a session: the mat and the round. A level and the
// sandbox (sandbox-session.ts) count the same way.
export interface Counting {
  readonly history: History;
  readonly round: CountRound;
}

export function countTap<S extends Counting>(session: S, unitId: UnitId): { readonly session: S; readonly outcome: CountOutcome } {
  const state = session.history.state;
  const before = reconcile(session.round, state);
  const round = countUnit(before, state, unitId);
  if (round === before || round.counted.length === before.counted.length) {
    return { session: { ...session, round }, outcome: { kind: 'ignored' } };
  }
  const total = benchCount(state);
  return {
    session: { ...session, round },
    outcome: { kind: 'counted', index: round.counted.length, complete: round.counted.length === total, total },
  };
}

export function isCounted(session: Counting, unitId: UnitId): boolean {
  return reconcile(session.round, session.history.state).counted.includes(unitId);
}

// Counting numbers of the round that applies to the current bench: 1 for the
// first block touched, and so on.
export function countOrder(session: Counting): ReadonlyMap<UnitId, number> {
  const round = reconcile(session.round, session.history.state);
  return new Map(round.counted.map((u, i) => [u, i + 1]));
}

export interface CountProgress {
  readonly counted: number;
  readonly total: number;
  // Every block on the bench has its number; more taps are ignored until a recount.
  readonly complete: boolean;
}

export function countProgress(session: Counting): CountProgress {
  const state = session.history.state;
  const counted = reconcile(session.round, state).counted.length;
  const total = benchCount(state);
  return { counted, total, complete: total > 0 && counted === total };
}

// A change that takes blocks off or puts blocks on the bench ends the round's
// numbers; when that round had numbers (some may still be waiting to be said,
// or "n in all"), they are stale and the screen stops the voice (2026-10-16
// review H-3). Moving blocks around keeps the round.
export function countWordsStale(before: Counting, after: Counting): boolean {
  if (countProgress(before).counted === 0) {
    return false;
  }
  const a = before.history.state.bench;
  const b = after.history.state.bench;
  return a.size !== b.size || [...a.keys()].some((u) => !b.has(u));
}

// "Count again": a new round over the same blocks. Nothing on the bench moves.
export function recount<S extends Counting>(session: S): S {
  return { ...session, round: startRound(session.history.state) };
}

// The two parts of a right addition: the operands, or for a free sum the pair
// actually used, left to right as it sits on the bench (beside a way already
// made, the pair just judged).
export function solvedParts(session: LevelSession): readonly [number, number] | null {
  const { puzzle, verdict } = session;
  const q = puzzle.question;
  if (!verdict.matched) {
    return null;
  }
  if (q.kind === 'addition_exact') {
    return q.operands;
  }
  if (q.kind !== 'sum_composition') {
    return null;
  }
  const state = matOf(session);
  const parts = [...state.groups.values()]
    .filter((g) => g.unitIds.every((u) => state.bench.has(u)))
    .map((g) => ({ size: g.unitIds.length, ...corner(state, g.unitIds) }))
    .sort((a, b) => a.x - b.x || a.y - b.y);
  return parts.length === 2 ? [parts[0]!.size, parts[1]!.size] : null;
}

// The partner a "who's missing?" stop starts with on the mat (Phase 19), wherever it is now.
export function givenPartner(session: LevelSession): Group | null {
  const id = session.whole.given;
  return id === undefined ? null : (session.history.state.groups.get(id) ?? null);
}

// Nothing on the mat but the partner the stop started with (anywhere on it):
// the opening of a "who's missing?" stop.
export function onlyGiven(session: LevelSession): boolean {
  const given = givenPartner(session);
  const bench = session.history.state.bench;
  return given !== null && bench.size === given.unitIds.length && given.unitIds.every((u) => bench.has(u));
}

// Nothing on the mat but the partners a "send the extra away" stop starts
// with, all of them (anywhere on it): its opening (Phase 21). Too many is the
// task here, not a mistake yet.
export function onlyOnMat(session: LevelSession): boolean {
  const ids = session.whole.onMat;
  if (ids === undefined) {
    return false;
  }
  const state = session.history.state;
  const units = ids.flatMap((id) => state.groups.get(id)?.unitIds ?? []);
  return state.bench.size === units.length && units.every((u) => state.bench.has(u));
}

// The stop as it opens: an empty mat, or only the partner a "who's missing?"
// stop starts with, or the row a "send the extra away" stop starts with. The
// card gives the task and the hand may show the first move.
export function atStart(session: LevelSession): boolean {
  return session.history.state.bench.size === 0 || onlyGiven(session) || onlyOnMat(session);
}

// A sum asked several ways, past its first way, with the mat still showing a
// way already made, or what is left of it while it goes back to the tray: the
// next thing to build is another way, not a mistake. A way made that stands on
// its own with nothing else on the mat is this too (build the next one beside it).
export function sameWayAgain(session: LevelSession): boolean {
  if (session.used.length === 0) {
    return false;
  }
  const state = matOf(session);
  if (state.bench.size === 0) {
    return state !== session.history.state;
  }
  const sizes = [...state.groups.values()].filter((g) => g.unitIds.every((u) => state.bench.has(u))).map(groupSize);
  if (sizes.length === 0 || sizes.length > 2 || state.bench.size !== sizes.reduce((a, b) => a + b, 0)) {
    return false;
  }
  return session.used.some((pair) => {
    const left: number[] = [...pair];
    return sizes.every((n) => left.includes(n) && left.splice(left.indexOf(n), 1).length === 1);
  });
}

// Is there room to make the next way beside the ways made, without touching
// them: a pair the step still accepts, from the tray, put down joined and clear
// of every way standing aside? The help says "make another 7 beside it" only
// then; a way made across the middle of a 3-row mat leaves no such room.
export function roomBeside(session: LevelSession): boolean {
  const state = session.history.state;
  const aside = new Set([...state.bench.keys()].filter((u) => !matOf(session).bench.has(u)));
  const q = session.puzzle.question;
  if (aside.size === 0 || q.kind !== 'sum_composition') {
    return false;
  }
  const { cols, rows } = state.bounds;
  const origins = Array.from({ length: cols * rows }, (_, i) => ({ x: i % cols, y: Math.floor(i / cols) }));
  const inTray = [...state.groups.values()].filter((g) => g.unitIds.every((u) => !state.bench.has(u)));
  const clear = (s: BenchState, g: Group) => !g.unitIds.some((u) => [...aside].some((a) => {
    const c = s.bench.get(u)!;
    const d = s.bench.get(a)!;
    return Math.abs(c.x - d.x) + Math.abs(c.y - d.y) === 1;
  }));
  return q.allowed.some(([a, b]) => {
    const first = inTray.find((g) => groupSize(g) === a);
    const second = inTray.find((g) => g !== first && groupSize(g) === b);
    if (first === undefined || second === undefined) {
      return false;
    }
    return origins.some((o) => {
      const one = apply(state, { type: 'takeGroup', groupId: first.id, origin: o });
      if (!one.ok || !clear(one.value, first)) {
        return false;
      }
      return origins.some((p) => {
        const two = apply(one.value, { type: 'takeGroup', groupId: second.id, origin: p });
        return two.ok && clear(two.value, second) && areTouching(two.value, two.value.groups.get(first.id)!, two.value.groups.get(second.id)!);
      });
    });
  });
}

// What the "like this" hand shows: the first move of the reference answer.
// Past the first way of a sum asked several ways, a partner of a way not made
// yet; on a "who's missing?" stop the other half lands beside the given
// partner wherever it sits now: on its right, else on its left where there is
// no room on the right. On a "send the extra away" stop the first move takes
// the extra from the mat back to the tray (Phase 21).
export function demoMove(session: LevelSession): Command | undefined {
  const { whole, puzzle } = session;
  const state = session.history.state;
  const q = puzzle.question;
  if (session.used.length > 0 && q.kind === 'sum_composition') {
    const sizes = new Set(q.allowed.flat());
    return whole.solution.find((c) => c.type === 'takeGroup' && sizes.has(groupSize(state.groups.get(c.groupId)!)));
  }
  // A "send the extra away" stop with everything sent back: a partner of the
  // pair left comes over, as on any free sum (the hand puts it mid-mat).
  if (whole.onMat !== undefined && !onlyOnMat(session) && q.kind === 'sum_composition') {
    const sizes: ReadonlyArray<number> = q.allowed[0] ?? [];
    const g = [...state.groups.values()].find((x) => sizes.includes(groupSize(x)) && x.unitIds.every((u) => !state.bench.has(u)));
    return g === undefined ? undefined : { type: 'takeGroup', groupId: g.id, origin: { x: 0, y: 0 } };
  }
  const first = whole.solution[0];
  const given = givenPartner(session);
  if (first?.type !== 'takeGroup' || given === null || !onlyGiven(session)) {
    return first;
  }
  const cells = given.unitIds.map((u) => state.bench.get(u)!);
  const y = Math.min(...cells.map((c) => c.y));
  const width = Math.max(...(state.groups.get(first.groupId)?.shape ?? []).map((c) => c.x)) + 1;
  const sides: Command[] = [
    { ...first, origin: { x: Math.max(...cells.map((c) => c.x)) + 1, y } },
    { ...first, origin: { x: Math.min(...cells.map((c) => c.x)) - width, y } },
  ];
  return sides.find((c) => apply(state, c).ok) ?? first;
}

// The sum to show once an addition is right, e.g. 3 + 4 = 7. With a way made
// standing beside the one just judged, both, one a line, in the order they
// were made: 3 + 4 = 7 / 5 + 2 = 7.
export function solvedEquation(session: LevelSession): string | null {
  const parts = solvedParts(session);
  if (parts === null) {
    return null;
  }
  const line = ([a, b]: readonly [number, number]) => `${a} + ${b} = ${a + b}`;
  const made = standingWays(session.history.state, session.used);
  const order = (w: StandingWay) => session.used.findIndex((p) => samePair(p, w.parts));
  return [...[...made].sort((a, b) => order(a) - order(b)).map((w) => line(w.parts)), line(parts)].join('\n');
}
