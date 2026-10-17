import { copyKey } from '../content';
import type { CopyKey, Puzzle } from '../content';
import { clusters } from '../core';
import type { BenchState, Group, UnitId } from '../core';
import { onlyGiven, sameWayAgain, solvedParts } from './level-session';
import type { LevelSession } from './level-session';

// What the help button says, chosen from the current verdict and from what is
// actually on the bench and in the tray, so a hint never asks for a move the
// material cannot make (no "take one more block" when only partners are left).

export interface Line {
  readonly key: CopyKey;
  readonly params: Readonly<Record<string, number>>;
}

export interface AnswerFeedback {
  readonly tone: 'start' | 'building' | 'adjust' | 'success';
  readonly title: Line;
  readonly detail: Line;
}

// The numbers the stop's task line needs: the two to put together, the
// partner already on the mat and the sum (Phase 19), or the number to make.
export function promptParams(puzzle: Puzzle): Record<string, number> {
  const q = puzzle.question;
  if (q.kind === 'addition_exact') {
    return { a: q.operands[0], b: q.operands[1] };
  }
  const given = puzzle.given === undefined ? undefined : puzzle.initial.groups.get(puzzle.given);
  if (q.kind === 'sum_composition' && given !== undefined) {
    return { a: given.unitIds.length, n: q.sum };
  }
  return { n: q.kind === 'sum_composition' ? q.sum : q.target };
}

// Feedback describes a committed answer, not an in-flight drag. An incomplete
// collection is encouragement; enough blocks in the wrong arrangement gets an
// actionable correction. Colours alone never carry the verdict.
export function feedbackFor(session: LevelSession): AnswerFeedback {
  const { puzzle, verdict } = session;
  const q = puzzle.question;
  const target = q.kind === 'addition_exact' ? q.operands[0] + q.operands[1] : q.kind === 'sum_composition' ? q.sum : q.target;
  const line = (name: string, params: Readonly<Record<string, number>> = {}): Line => ({ key: copyKey(name), params });
  if (verdict.matched) {
    return { tone: 'success', title: line('feedback.success'), detail: matchedFeedback(session) };
  }
  // A "who's missing?" stop opens with a partner on the mat: that is the
  // start too. Once that partner has gone back, "here is 2" is no longer true,
  // so an empty mat there asks for two partners.
  if (verdict.benchCount === 0 || onlyGiven(session)) {
    return {
      tone: 'start',
      title: line('feedback.start'),
      detail: puzzle.given !== undefined && !onlyGiven(session) ? line('prompt.sum_composition', { n: target }) : { key: puzzle.prompt, params: promptParams(puzzle) },
    };
  }
  // One way made on a stop asked two ways, still on the mat: build another
  // (like "now a new shape!" for a stop in steps, review L).
  if (sameWayAgain(session)) {
    return { tone: 'building', title: line('feedback.another'), detail: line('hint.another-way', { n: target }) };
  }
  const detail = hintFor(session);
  if (verdict.reason === 'count-mismatch') {
    const fewer = verdict.benchCount < target;
    if (fewer && (q.kind === 'addition_exact' || q.kind === 'sum_composition')) {
      const selected = [...session.history.state.groups.values()]
        .filter((g) => g.unitIds.every((u) => session.history.state.bench.has(u)))
        .map((g) => g.unitIds.length);
      const pairs = q.kind === 'addition_exact' ? [q.operands] : q.allowed;
      const canFinish = pairs.some((pair) => {
        const remaining: number[] = [...pair];
        return selected.every((size) => {
          const i = remaining.indexOf(size);
          if (i === -1) {
            return false;
          }
          remaining.splice(i, 1);
          return true;
        });
      });
      if (!canFinish) {
        return { tone: 'adjust', title: line('feedback.swap'), detail };
      }
    }
    // A quantity stop can be stuck short too: nothing left in the tray adds up
    // to exactly what is missing, so adding alone cannot finish it.
    if (fewer && (detail.key === 'hint.stuck.block' || detail.key === 'hint.swap.partner')) {
      return { tone: 'adjust', title: line('feedback.stuck', { n: target }), detail };
    }
    // "3 more blocks to go" beside a 2 on a make-5 stop is the answer: say only "not 5 yet".
    if (fewer && puzzle.given !== undefined) {
      return { tone: 'building', title: line('feedback.notyet', { n: target }), detail };
    }
    const difference = Math.abs(target - verdict.benchCount);
    const key = `${fewer ? 'feedback.fewer' : 'feedback.more'}${difference === 1 ? '.one' : ''}`;
    return { tone: fewer ? 'building' : 'adjust', title: line(key, { n: difference }), detail };
  }
  // A step done, the next picture to make with the same blocks: that is the
  // next thing to build, not a mistake.
  if (session.step > 0 && verdict.reason === 'shape-mismatch') {
    return { tone: 'building', title: line('feedback.change'), detail };
  }
  const key = verdict.reason === 'shape-mismatch' ? 'feedback.shape'
    : verdict.reason === 'groups-mismatch' ? 'feedback.partners' : 'feedback.join';
  return { tone: 'adjust', title: line(key), detail };
}

function grouped(state: BenchState): ReadonlySet<UnitId> {
  const out = new Set<UnitId>();
  for (const g of state.groups.values()) {
    for (const u of g.unitIds) {
      out.add(u);
    }
  }
  return out;
}

// The success line names what was built; a free sum names the pair the child chose,
// matching the badge (2 + 3 = 5), not just the total.
export function matchedFeedback(session: LevelSession): Line {
  const q = session.puzzle.question;
  if (q.kind === 'quantity_shape') {
    return { key: copyKey('feedback.matched.shape'), params: { n: q.target } };
  }
  if (q.kind === 'quantity') {
    return { key: copyKey('feedback.matched.quantity'), params: { n: q.target } };
  }
  const total = q.kind === 'sum_composition' ? q.sum : q.operands[0] + q.operands[1];
  const parts = solvedParts(session);
  return parts === null
    ? { key: copyKey('feedback.matched.quantity'), params: { n: total } }
    : { key: copyKey('feedback.matched.addition'), params: { a: parts[0], b: parts[1], n: total } };
}

// Can exactly `gap` more blocks be added from what is left in the tray: some of
// these partners plus at most `loose` single blocks? Trays hold a handful of
// partners, so trying every subset is cheap.
function canFill(gap: number, partners: ReadonlyArray<number>, loose: number): boolean {
  if (gap >= 0 && gap <= loose) {
    return true;
  }
  return partners.some((size, i) => size <= gap && canFill(gap - size, partners.filter((_, j) => j !== i), loose));
}

// Too few or too many for a quantity stop, phrased by the material that can fix it.
// A "keep adding" hint is only given when adding can still reach the target;
// otherwise the hint makes room first, so a hint never leads into a dead end.
function countHint(state: BenchState, target: number, count: number): Line {
  const inGroup = grouped(state);
  const looseOnBench = [...state.bench.keys()].filter((u) => !inGroup.has(u)).length;
  if (count > target) {
    return { key: copyKey(looseOnBench > 0 ? 'hint.count-mismatch.more' : 'hint.more.partner'), params: { n: target } };
  }
  const missing = target - count;
  const inTray = new Set(state.tray.flatMap((s) => (s.unitId === null ? [] : [s.unitId])));
  const partners = [...state.groups.values()].filter((g) => g.unitIds.every((u) => inTray.has(u))).map((g) => g.unitIds.length);
  const loose = [...inTray].filter((u) => !inGroup.has(u)).length;
  if (canFill(missing, partners, loose)) {
    const partnerStep = partners.some((size, i) => size <= missing && canFill(missing - size, partners.filter((_, j) => j !== i), loose));
    return { key: copyKey(partnerStep ? 'hint.fewer.partner' : 'hint.count-mismatch.fewer'), params: { n: target } };
  }
  // Stuck short: put single blocks back when that makes room for a partner
  // (they return to the tray, so they count as loose again); else trade a partner.
  for (let k = 1; k <= looseOnBench; k += 1) {
    if (canFill(missing + k, partners, loose + k)) {
      return { key: copyKey('hint.stuck.block'), params: {} };
    }
  }
  return { key: copyKey('hint.swap.partner'), params: { n: target } };
}

// Partners on the bench, left (then top) first: the order the badge shows them in.
function leftToRight(state: BenchState, groups: ReadonlyArray<Group>): ReadonlyArray<Group> {
  const at = (g: Group) => {
    const cells = g.unitIds.map((u) => state.bench.get(u)!);
    return { x: Math.min(...cells.map((c) => c.x)), y: Math.min(...cells.map((c) => c.y)) };
  };
  return [...groups].sort((a, b) => at(a).x - at(b).x || at(a).y - at(b).y);
}

// Two right partners on the bench that still have to touch: their sizes, left
// (then top) first, the order the badge will show them in.
function apartPair(state: BenchState): readonly [number, number] {
  const parts = leftToRight(state, benchPartners(state));
  return [parts[0]?.unitIds.length ?? 0, parts[1]?.unitIds.length ?? 0];
}

// The line the card shows and the voice says on its own (help level 1). It
// names the move, never which partner: choosing is the child's thinking. It may
// point at what it talks about when that gives nothing away (see guidanceFor).
export function hintFor(session: LevelSession): Line {
  const { verdict, puzzle } = session;
  const state = session.history.state;
  const q = puzzle.question;
  if (verdict.matched) {
    return matchedFeedback(session);
  }
  switch (q.kind) {
    case 'quantity':
    case 'quantity_shape':
      if (verdict.reason === 'count-mismatch') {
        return countHint(state, q.target, verdict.benchCount);
      }
      return { key: copyKey(verdict.reason === 'not-one-cluster' ? 'hint.not-one-cluster' : 'hint.shape-mismatch'), params: {} };
    case 'addition_exact': {
      const [a, b] = q.operands;
      if (verdict.reason === 'count-mismatch' && verdict.benchCount > a + b) {
        return { key: copyKey('hint.more.partner'), params: { n: a + b } };
      }
      if (verdict.reason === 'not-merged') {
        const [x, y] = apartPair(state);
        return { key: copyKey('hint.not-merged'), params: { a: x, b: y } };
      }
      return { key: copyKey('hint.groups-mismatch'), params: { a, b } };
    }
    case 'sum_composition':
      if (verdict.reason === 'count-mismatch' && verdict.benchCount > q.sum) {
        return { key: copyKey('hint.more.partner'), params: { n: q.sum } };
      }
      if (verdict.reason === 'not-merged') {
        const [x, y] = apartPair(state);
        return { key: copyKey('hint.not-merged'), params: { a: x, b: y } };
      }
      return { key: copyKey('hint.sum-pair'), params: { n: q.sum } };
  }
}

// What the screen lights up while a line is said: partners (group ids) and
// single blocks (unit ids) on the bench or in the tray, and the little shape
// picture beside the target.
export interface AnswerFocus {
  readonly objects: ReadonlyArray<string>;
  readonly template: boolean;
}

export interface Guidance {
  readonly line: Line;
  readonly focus: AnswerFocus;
}

const NO_FOCUS: AnswerFocus = { objects: [], template: false };

function benchPartners(state: BenchState): ReadonlyArray<Group> {
  return [...state.groups.values()].filter((g) => g.unitIds.every((u) => state.bench.has(u)));
}

function trayPartners(state: BenchState): ReadonlyArray<Group> {
  return [...state.groups.values()].filter((g) => g.unitIds.every((u) => !state.bench.has(u)));
}

// Loose blocks on the bench, last in reading order first (the likeliest to put back).
function benchLoose(state: BenchState): ReadonlyArray<UnitId> {
  const inGroup = grouped(state);
  return [...state.bench.entries()]
    .filter(([u]) => !inGroup.has(u))
    .sort(([, a], [, b]) => b.y - a.y || b.x - a.x)
    .map(([u]) => u);
}

function trayLooseCount(state: BenchState): number {
  const inGroup = grouped(state);
  return state.tray.filter((t) => t.unitId !== null && !inGroup.has(t.unitId)).length;
}

const size = (g: Group): number => g.unitIds.length;

// Level 1, pointing only where that gives nothing away: the shape picture for
// a shape stop, the blocks that stand apart, the two partners that must touch.
function lookHere(session: LevelSession): AnswerFocus {
  const { puzzle, verdict } = session;
  const state = session.history.state;
  if (verdict.matched) {
    return NO_FOCUS;
  }
  const template = puzzle.question.kind === 'quantity_shape' && (verdict.benchCount === 0 || verdict.reason === 'shape-mismatch');
  if (verdict.reason === 'not-one-cluster') {
    // Everything outside the biggest group of touching blocks.
    const parts = clusters(state).map((c) => c.unitIds);
    const biggest = parts.reduce((a, b) => (b.length > a.length ? b : a), [] as ReadonlyArray<UnitId>);
    return { objects: parts.filter((c) => c !== biggest).flat(), template };
  }
  if (verdict.reason === 'not-merged') {
    return { objects: benchPartners(state).map((g) => g.id), template };
  }
  return { objects: [], template };
}

// A quantity stop: the shortest run of whole moves (send a partner back, bring
// one, put a block back, take one) that makes the count right, found by a
// breadth-first search over what is where (a handful of partners and spares,
// so this is tiny). The help names its first step: what to send back or put
// back, and the partner to bring right after, if that is next. Null when the
// next step is only to keep adding (that is building, not a correction).
function quantityPlan(state: BenchState, target: number): Guidance | null {
  const groups = [...state.groups.values()];
  const onBench = groups.map((g) => g.unitIds.every((u) => state.bench.has(u)));
  const loose = benchLoose(state);
  const totalLoose = loose.length + trayLooseCount(state);
  type Move = { readonly kind: 'send' | 'bring'; readonly i: number } | { readonly kind: 'return' | 'take' };
  const key = (mask: number, k: number) => mask * 64 + k;
  const startMask = onBench.reduce((m, on, i) => (on ? m | (1 << i) : m), 0);
  const total = (mask: number, k: number) => groups.reduce((sum, g, i) => (mask & (1 << i) ? sum + size(g) : sum), 0) + k;
  const seen = new Map<number, ReadonlyArray<Move>>([[key(startMask, loose.length), []]]);
  const queue: [number, number][] = [[startMask, loose.length]];
  let path: ReadonlyArray<Move> | null = total(startMask, loose.length) === target ? [] : null;
  while (path === null && queue.length > 0) {
    const [mask, k] = queue.shift()!;
    const sofar = seen.get(key(mask, k))!;
    // Taking away before adding: among equally short plans the help starts with
    // what to send back, then says what to bring.
    const next: [number, number, Move][] = [];
    groups.forEach((_, i) => {
      if (mask & (1 << i)) {
        next.push([mask & ~(1 << i), k, { kind: 'send', i }]);
      }
    });
    if (k > 0) {
      next.push([mask, k - 1, { kind: 'return' }]);
    }
    groups.forEach((_, i) => {
      if ((mask & (1 << i)) === 0) {
        next.push([mask | (1 << i), k, { kind: 'bring', i }]);
      }
    });
    if (k < totalLoose) {
      next.push([mask, k + 1, { kind: 'take' }]);
    }
    for (const [m, kk, move] of next) {
      if (seen.has(key(m, kk))) {
        continue;
      }
      const moves = [...sofar, move];
      seen.set(key(m, kk), moves);
      if (total(m, kk) === target) {
        path = moves;
        break;
      }
      queue.push([m, kk]);
    }
  }
  if (path === null) {
    return null;
  }
  const removals = path.slice(0, path.findIndex((m) => m.kind === 'bring' || m.kind === 'take') === -1 ? path.length : path.findIndex((m) => m.kind === 'bring' || m.kind === 'take'));
  if (removals.length === 0) {
    return null;
  }
  const sends = removals.flatMap((m) => (m.kind === 'send' ? [groups[m.i]!] : []));
  const returns = removals.filter((m) => m.kind === 'return').length;
  const after = path[removals.length];
  const bring = after?.kind === 'bring' ? groups[after.i]! : null;
  const line = (name: string, params: Readonly<Record<string, number>>): Line => ({ key: copyKey(name), params });
  const focus = (objects: ReadonlyArray<string>): AnswerFocus => ({ objects, template: false });
  if (sends.length === 0) {
    return bring === null
      ? { line: line('hint.count-mismatch.more', { n: target }), focus: focus(loose.slice(0, returns)) }
      : { line: line('hint.stuck.named', { k: returns, a: size(bring) }), focus: focus([...loose.slice(0, returns), bring.id]) };
  }
  const [first] = sends;
  if (sends.length === 1 && returns === 0 && bring !== null) {
    return { line: line('hint.swap.pair', { a: size(first!), b: size(bring) }), focus: focus([first!.id, bring.id]) };
  }
  return { line: line('hint.send', { a: size(first!) }), focus: focus([first!.id]) };
}

// Two-partner stops: the allowed pair the bench is closest to, and the partners
// to send back and bring to reach it.
function pairPlan(state: BenchState, pairs: ReadonlyArray<readonly [number, number]>): Guidance | null {
  const bench = benchPartners(state);
  const tray = trayPartners(state);
  let best: { send: Group[]; bring: Group[] } | null = null;
  for (const pair of pairs) {
    const wanted = [...pair];
    const send: Group[] = [];
    for (const g of bench) {
      const i = wanted.indexOf(size(g));
      if (i === -1) {
        send.push(g);
      } else {
        wanted.splice(i, 1);
      }
    }
    const pool = [...tray];
    const bring: Group[] = [];
    for (const n of wanted) {
      const i = pool.findIndex((g) => size(g) === n);
      if (i === -1) {
        bring.length = 0;
        break;
      }
      bring.push(pool[i]!);
      pool.splice(i, 1);
    }
    if (bring.length !== wanted.length) {
      continue;
    }
    if (best === null || send.length + bring.length < best.send.length + best.bring.length) {
      best = { send, bring };
    }
  }
  if (best === null) {
    return null;
  }
  // Nothing to send back, one partner to bring: only the other half is
  // missing (a "who's missing?" stop that is not there yet). Name it, light it.
  if (best.send.length === 0) {
    const [bring] = best.bring;
    return best.bring.length === 1 ? { line: { key: copyKey('hint.bring'), params: { a: size(bring!) } }, focus: { objects: [bring!.id], template: false } } : null;
  }
  // Two other partners that make the same total (5 + 2 on a 3 + 4 stop): say
  // so, then which two to find, and light all four: the pair to send back on
  // the mat and the pair to bring from the tray (2026-10-16 review A-4 / C-2:
  // the child got the total right and saw nothing lit at all).
  const total = (pairs[0]?.[0] ?? 0) + (pairs[0]?.[1] ?? 0);
  if (best.send.length === 2 && best.bring.length === 2 && best.send.reduce((sum, g) => sum + size(g), 0) === total) {
    const [x, y] = leftToRight(state, best.send);
    const [a, b] = best.bring;
    return {
      line: { key: copyKey('hint.same-sum'), params: { x: size(x!), y: size(y!), n: total, a: size(a!), b: size(b!) } },
      focus: { objects: [x!.id, y!.id, a!.id, b!.id], template: false },
    };
  }
  // What lights up is exactly what the line names.
  const [send] = best.send;
  if (best.send.length === 1 && best.bring.length === 1) {
    return { line: { key: copyKey('hint.swap.pair'), params: { a: size(send!), b: size(best.bring[0]!) } }, focus: { objects: [send!.id, best.bring[0]!.id], template: false } };
  }
  // One to send back, or more (three partners on the mat, as a quantity stop
  // does): name one; asked again, help names the next. Naming nothing here left
  // "find two partners" with three on the mat, and a child adding a fourth.
  return { line: { key: copyKey('hint.send'), params: { a: size(send!) } }, focus: { objects: [send!.id], template: false } };
}

// Whether asked-for help (level 2) has something to name: a mistake, and two
// building states where naming is the help (Phase 19): one way made on a stop
// asked two ways, and the other half not there yet on a "who's missing?" stop
// (whose card title no longer says how many are missing).
export function asksForHelp(session: LevelSession, f: AnswerFeedback = feedbackFor(session)): boolean {
  return f.tone === 'adjust' || (f.tone === 'building' && (sameWayAgain(session) || session.whole.given !== undefined));
}

// What to say and light up. Level 1 is the line said on its own (hintFor) with
// the pointers that give nothing away. Level 2 is help the child asked for (the
// card, the help button): it names the partner to send back or bring and
// lights it up; with nothing to name it stays at level 1. Building towards the
// answer, an empty bench and a right answer are never corrected.
export function guidanceFor(session: LevelSession, level: 1 | 2): Guidance {
  const { puzzle, verdict } = session;
  const q = puzzle.question;
  const f = feedbackFor(session);
  const first: Guidance = { line: f.detail, focus: lookHere(session) };
  if (level === 1 || !asksForHelp(session, f)) {
    return first;
  }
  const state = session.history.state;
  const plan =
    q.kind === 'quantity' || q.kind === 'quantity_shape'
      ? verdict.reason === 'count-mismatch'
        ? quantityPlan(state, q.target)
        : null
      : verdict.reason === 'not-merged'
        ? null
        : pairPlan(state, q.kind === 'addition_exact' ? [q.operands] : q.allowed);
  return plan === null ? first : { line: plan.line, focus: { objects: plan.focus.objects, template: first.focus.template } };
}

// The card the child sees. A right answer shows what comes next (the badge
// already shows what was built); asked-for help shows the line it said.
export function cardFor(session: LevelSession, helpLevel: 0 | 1 | 2, hasNext: boolean): AnswerFeedback {
  const f = feedbackFor(session);
  if (f.tone === 'success') {
    return { ...f, detail: { key: copyKey(hasNext ? 'feedback.next' : 'feedback.done'), params: {} } };
  }
  if (helpLevel === 2 && asksForHelp(session, f)) {
    return { ...f, detail: guidanceFor(session, 2).line };
  }
  return f;
}
