import { apply, areTouching, benchCount, clusters, commit, countUnit, createHistory, groupSize, judge, reconcile, startRound, undo } from '../core';
import type { BenchState, Cell, Command, CountRound, Group, GroupId, History, RejectReason, UnitId, Verdict } from '../core';
import { benchPair, questionAt, samePair, stepCount } from '../content';
import type { NodeSpec, Pair, Puzzle } from '../content';

// How a split's cloud reads once it is right (Phase 22, design §9 #4):
// 'whole-first' writes `3 = 1 + 2` (Numberblocks and ACARA say "3 is 1 and
// 2"); 'none' leaves the cloud at `3` and lets the card say the parts. A
// default for Ted; one word to change.
export const SPLIT_EQUATION: 'whole-first' | 'none' = 'whole-first';
// The minus sign the cloud writes (U+2212, the same width as +).
export const MINUS = '−';

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

// A way made on a sum asked several ways: two partners on the mat, joined,
// making one of the pairs. Its sizes left (then top) first.
interface MadeWay {
  readonly parts: Pair;
  readonly units: ReadonlySet<UnitId>;
  readonly groups: ReadonlySet<GroupId>;
}

function corner(state: BenchState, unitIds: ReadonlyArray<UnitId>): { readonly x: number; readonly y: number } {
  const cells = unitIds.map((u) => state.bench.get(u)!);
  return { x: Math.min(...cells.map((c) => c.x)), y: Math.min(...cells.map((c) => c.y)) };
}

function wayOf(state: BenchState, a: Group, b: Group): MadeWay {
  const [x, y] = [a, b].sort((p, q) => corner(state, p.unitIds).x - corner(state, q.unitIds).x || corner(state, p.unitIds).y - corner(state, q.unitIds).y);
  return { parts: [groupSize(x!), groupSize(y!)], units: new Set([...a.unitIds, ...b.unitIds]), groups: new Set([a.id, b.id]) };
}

function benchPartners(state: BenchState): ReadonlyArray<Group> {
  return [...state.groups.values()].filter((g) => g.unitIds.every((u) => state.bench.has(u)));
}

// Ways in `pairs` that stand on their own on the mat: a cluster that is
// exactly two partners (each pair once). In mat order: the top one first,
// then the left one.
function standingWays(state: BenchState, pairs: ReadonlyArray<Pair>): ReadonlyArray<MadeWay> {
  const left = [...pairs];
  const partners = benchPartners(state);
  const out: MadeWay[] = [];
  const parts = clusters(state)
    .map((c) => ({ units: new Set(c.unitIds), at: corner(state, c.unitIds) }))
    .sort((a, b) => a.at.y - b.at.y || a.at.x - b.at.x);
  for (const c of parts) {
    const inside = partners.filter((g) => c.units.has(g.unitIds[0]!));
    const [a, b] = inside;
    if (inside.length !== 2 || groupSize(a!) + groupSize(b!) !== c.units.size) {
      continue;
    }
    const way = wayOf(state, a!, b!);
    const i = left.findIndex((p) => samePair(p, way.parts));
    if (i === -1) {
      continue;
    }
    left.splice(i, 1);
    out.push(way);
  }
  return out;
}

// Ways in `pairs` made on the mat, known by their partners (D-097): for each
// pair, in order, two partners of its sizes, whole on the mat and joined to
// each other, whatever else touches them (the next way built on the row above
// or below, the only rows left on a 3-row mat). Each partner in one way; with
// a choice, the top (then left) one.
function madeWays(state: BenchState, pairs: ReadonlyArray<Pair>): ReadonlyArray<MadeWay> {
  const partners = [...benchPartners(state)].sort((p, q) => corner(state, p.unitIds).y - corner(state, q.unitIds).y || corner(state, p.unitIds).x - corner(state, q.unitIds).x);
  const taken = new Set<GroupId>();
  const out: MadeWay[] = [];
  for (const [n, m] of pairs) {
    const free = partners.filter((g) => !taken.has(g.id));
    const match = free.flatMap((a) => free.filter((b) => b !== a && groupSize(a) === n && groupSize(b) === m && areTouching(state, a, b)).map((b) => [a, b] as const))[0];
    if (match === undefined) {
      continue;
    }
    taken.add(match[0].id);
    taken.add(match[1].id);
    out.push(wayOf(state, match[0], match[1]));
  }
  return out;
}

// Only whole partners on the mat, one or two, their sizes all in one of
// `pairs` (each size once): a pair, or a pair on its way.
function partOfPair(state: BenchState, pairs: ReadonlyArray<Pair>): boolean {
  const sizes = benchPartners(state).map(groupSize);
  if (sizes.length === 0 || sizes.length > 2 || state.bench.size !== sizes.reduce((a, b) => a + b, 0)) {
    return false;
  }
  return pairs.some((pair) => {
    const left: number[] = [...pair];
    return sizes.every((n) => left.includes(n) && left.splice(left.indexOf(n), 1).length === 1);
  });
}

// The mat less the ways in `ways`: what is left to judge.
function without(state: BenchState, ways: ReadonlyArray<MadeWay>): BenchState {
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
// beside the next one: each used way still made (its two partners joined) is
// left out and the rest is judged, touching it or not (D-097: on the boss's
// 3-row mat a way across the middle row leaves no row clear of it). Sending
// the first way back still works: then nothing is left out. The core judge is
// unchanged; this only chooses what it is shown.
export function judgedMat(state: BenchState, used: ReadonlyArray<Pair>): BenchState {
  return used.length === 0 ? state : without(state, madeWays(state, used));
}

// The session's own judged part of the mat (see judgedMat).
export function matOf(session: LevelSession): BenchState {
  return judgedMat(session.history.state, session.used);
}

// Whether a used way stands on the mat, left out of the judging.
export function wayAside(session: LevelSession): boolean {
  return matOf(session) !== session.history.state;
}

type At = { readonly step: number; readonly used: ReadonlyArray<Pair> };

// A way step `at` accepts, made beside more blocks: one that stands on its own
// (made first, the next way beside it, as a reload in the middle of the second
// way finds it), or one joined to what is left, when what is left is the next
// way or a way on its way to it (D-097: the next way built touching the first,
// reloaded halfway or finished; both made at once). Its sizes.
function madeBeside(whole: Puzzle, state: BenchState, at: At, allowed: ReadonlyArray<Pair>): Pair | undefined {
  const view = judgedMat(state, at.used);
  const standing = standingWays(view, allowed)[0];
  if (standing !== undefined && standing.units.size !== view.bench.size) {
    return standing.parts;
  }
  return allowed.find((pair) => {
    const used = [...at.used, pair];
    const rest = judgedMat(state, used);
    const next = questionAt(whole, at.step + 1, used);
    return rest.bench.size < view.bench.size && next.kind === 'sum_composition' && partOfPair(rest, next.allowed);
  });
}

// The steps this mat has done, from `at` on. A step is done when what is left
// to judge answers it; on a sum asked several ways also when a way it accepts
// is made beside more blocks (madeBeside). `byJudge` false: only the second
// kind (a finished stop is not asked again).
function walk(whole: Puzzle, state: BenchState, from: At, byJudge: boolean): At {
  let at = from;
  while (at.step < lastStep(whole)) {
    const view = judgedMat(state, at.used);
    const q = stepView(whole, at.step, at.used).question;
    // A countdown's count only goes down (Phase 22): fewer blocks than a step
    // asks means that step is behind us (two sent at once; saved work resumed).
    const passed = whole.takeAway !== undefined && q.kind === 'quantity' && view.bench.size < q.target;
    if (byJudge && (judge(view, q).matched || passed)) {
      at = advance(whole, view, at.step, at.used);
      continue;
    }
    const beside = whole.ways !== undefined && q.kind === 'sum_composition' ? madeBeside(whole, state, at, q.allowed) : undefined;
    if (beside === undefined) {
      break;
    }
    at = { step: at.step + 1, used: [...at.used, beside] };
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
  // A split (Phase 22): its two piles, left (then top) first.
  if (q.kind === 'split') {
    const piles = clusters(session.history.state)
      .map((c) => ({ size: c.unitIds.length, ...corner(session.history.state, c.unitIds) }))
      .sort((a, b) => a.x - b.x || a.y - b.y);
    return piles.length === 2 ? [piles[0]!.size, piles[1]!.size] : null;
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

// A split, or a take-away of single blocks (Phase 22): the stop's blocks start
// on the mat and the tray holds only their beds.
function isPreset(whole: Puzzle): boolean {
  return whole.onMat === undefined && (whole.question.kind === 'split' || whole.takeAway !== undefined);
}

// Every block a split / take-away stop starts with still on the mat, nothing
// gone home (anywhere on the mat); on a split, still in one piece: its opening
// (Phase 22). Pulled apart is judged; pushed back together is the opening again.
export function onlyPreset(session: LevelSession): boolean {
  const { whole } = session;
  if (!isPreset(whole)) {
    return false;
  }
  const state = session.history.state;
  const units = [...whole.initial.bench.keys()];
  if (state.bench.size !== units.length || !units.every((u) => state.bench.has(u))) {
    return false;
  }
  return whole.question.kind !== 'split' || clusters(state).length === 1;
}

// The stop as it opens: an empty mat, or only the partner a "who's missing?"
// stop starts with, or the row a "send the extra away" stop starts with, or a
// split's / take-away's blocks as dealt. The card gives the task and the hand
// may show the first move.
export function atStart(session: LevelSession): boolean {
  return session.history.state.bench.size === 0 || onlyGiven(session) || onlyOnMat(session) || onlyPreset(session);
}

// A take-away stop's current step (Phase 22): how many it starts with and how
// many go home. A countdown's later steps start with what the step before left.
export function takeAwayAt(session: LevelSession): { readonly start: number; readonly take: number } | null {
  const { whole, step } = session;
  const away = whole.takeAway;
  if (away === undefined) {
    return null;
  }
  const steps = whole.steps;
  if (steps === undefined) {
    return away;
  }
  const left = (i: number): number => {
    const q = steps[i];
    return q?.kind === 'quantity' ? q.target : away.start;
  };
  const start = step === 0 ? away.start : left(step - 1);
  return { start, take: start - left(step) };
}

// The first move that makes a new split of the row (Phase 22): the last block
// pulled one cell to the right (1 and the rest); asked another way, the k-th
// block from the right put under the last one (k and the rest), skipping the
// splits made. Only from the row as dealt; undefined once it is apart.
function splitDemo(session: LevelSession): Command | undefined {
  const state = session.history.state;
  const q = session.puzzle.question;
  if (q.kind !== 'split' || !onlyPreset(session)) {
    return undefined;
  }
  const row = [...state.bench.entries()].sort(([, a], [, b]) => a.x - b.x || a.y - b.y);
  const last = row[row.length - 1];
  if (last === undefined) {
    return undefined;
  }
  const { rows } = state.bounds;
  const below = last[1].y + 1 < rows ? last[1].y + 1 : last[1].y - 1;
  for (let k = 1; k <= Math.floor(q.total / 2); k += 1) {
    if (session.used.some((u) => samePair(u, [k, q.total - k]))) {
      continue;
    }
    const [unitId, at] = row[row.length - k]!;
    const to = k === 1 ? { x: at.x + 1, y: at.y } : { x: last[1].x, y: below };
    const cmd: Command = { type: 'move', unitId, to };
    if (apply(state, cmd).ok) {
      return cmd;
    }
  }
  return undefined;
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
  return partOfPair(state, session.used);
}

// The ways made on a mat of a sum asked several ways, each as its units: the
// join shows each as its own character, so two ways that touch are two 7s,
// not one 14 (D-097). Empty for any other stop.
export function waysApart(session: LevelSession): ReadonlyArray<ReadonlyArray<UnitId>> {
  const q = session.whole.question;
  return session.whole.ways === undefined || q.kind !== 'sum_composition' ? [] : madeWays(session.history.state, q.allowed).map((w) => [...w.units]);
}

// The same for a stop's finished work, from its catalog entry (the album, the island page).
export function workWaysApart(node: NodeSpec, work: BenchState): ReadonlyArray<ReadonlyArray<UnitId>> {
  return node.spec.kind !== 'sum_composition' || node.spec.ways === undefined ? [] : madeWays(work, node.spec.allowed).map((w) => [...w.units]);
}

// The cells of the ways made that stand on the mat, left out of the judging
// (none before the first way is made).
export function asideCells(session: LevelSession): ReadonlyArray<Cell> {
  const mat = matOf(session).bench;
  return [...session.history.state.bench].filter(([u]) => !mat.has(u)).map(([, c]) => c);
}

// Is there room to make the next way beside the ways made: a pair the step
// still accepts, from the tray, put down joined in the cells they leave free?
// Touching them is fine (D-097). The help says "make another 7 beside it" only
// then, never "send back" a way already made while there is room.
export function roomBeside(session: LevelSession): boolean {
  const state = session.history.state;
  const q = session.puzzle.question;
  if (asideCells(session).length === 0 || q.kind !== 'sum_composition') {
    return false;
  }
  const { cols, rows } = state.bounds;
  const origins = Array.from({ length: cols * rows }, (_, i) => ({ x: i % cols, y: Math.floor(i / cols) }));
  const inTray = [...state.groups.values()].filter((g) => g.unitIds.every((u) => !state.bench.has(u)));
  return q.allowed.some(([a, b]) => {
    const first = inTray.find((g) => groupSize(g) === a);
    const second = inTray.find((g) => g !== first && groupSize(g) === b);
    if (first === undefined || second === undefined) {
      return false;
    }
    return origins.some((o) => {
      const one = apply(state, { type: 'takeGroup', groupId: first.id, origin: o });
      if (!one.ok) {
        return false;
      }
      return origins.some((p) => {
        const two = apply(one.value, { type: 'takeGroup', groupId: second.id, origin: p });
        return two.ok && areTouching(two.value, two.value.groups.get(first.id)!, two.value.groups.get(second.id)!);
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
  // A split: pull one block away (Phase 22). A take-away of single blocks: the
  // first of the answer's blocks still on the mat goes home.
  if (q.kind === 'split') {
    return splitDemo(session);
  }
  if (isPreset(whole)) {
    return whole.solution.find((c) => apply(state, c).ok);
  }
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
  const q = session.puzzle.question;
  // A take-away (Phase 22): `5 − 2 = 3`, this step's.
  const away = takeAwayAt(session);
  if (away !== null) {
    return session.verdict.matched ? `${away.start} ${MINUS} ${away.take} = ${away.start - away.take}` : null;
  }
  const parts = solvedParts(session);
  if (parts === null) {
    return null;
  }
  // A split (Phase 22): `3 = 1 + 2` (SPLIT_EQUATION), the splits made before it
  // each a line, in the order they were made.
  if (q.kind === 'split') {
    if (SPLIT_EQUATION === 'none') {
      return null;
    }
    const split = ([a, b]: readonly [number, number]) => `${q.total} = ${a} + ${b}`;
    return [...session.used.map(split), split(parts)].join('\n');
  }
  const line = ([a, b]: readonly [number, number]) => `${a} + ${b} = ${a + b}`;
  const made = madeWays(session.history.state, session.used);
  const order = (w: MadeWay) => session.used.findIndex((p) => samePair(p, w.parts));
  return [...[...made].sort((a, b) => order(a) - order(b)).map((w) => line(w.parts)), line(parts)].join('\n');
}

// What the cloud shows before the answer is right: the number to make, the
// sum to put together (`3 + 4`), a split's whole, or a take-away as it reads
// (`5 − 2`; a countdown's current step, Phase 22). solvedEquation() takes over
// once it is right.
export function cloudTitle(session: LevelSession): string {
  const q = session.puzzle.question;
  const away = takeAwayAt(session);
  if (away !== null) {
    return `${away.start} ${MINUS} ${away.take}`;
  }
  switch (q.kind) {
    case 'addition_exact':
      return `${q.operands[0]} + ${q.operands[1]}`;
    case 'sum_composition':
      return String(q.sum);
    case 'split':
      return String(q.total);
    default:
      return String(q.target);
  }
}

// The number the stop is about, for colour and the solve's move: the count to
// make, the sum, a split's whole, or what a take-away leaves (the character
// the child ends with, design §4.2).
export function targetNumberOf(session: LevelSession): number {
  const q = session.puzzle.question;
  switch (q.kind) {
    case 'addition_exact':
      return q.operands[0] + q.operands[1];
    case 'sum_composition':
      return q.sum;
    case 'split':
      return q.total;
    default:
      return q.target;
  }
}
