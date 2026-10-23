import { CHAPTERS, copyKey, nodeId } from '../content';
import type { CopyKey, NodeId, Puzzle } from '../content';
import { DEFAULT_SYMMETRY, areTouching, clusters, compares, variants } from '../core';
import type { BenchState, Cell, Command, CompareRelation, Group, GroupId, Question, UnitId } from '../core';
import { demoMove, lineUp, matOf, onlyGiven, onlyOnMat, onlyPreset, roomBeside, sameWayAgain, shadowView, solvedParts, takeAwayAt } from './level-session';
import type { LevelSession } from './level-session';
import { fill } from './shadow';
import type { Piece, Placement } from './shadow';

// On a take-away of single blocks, the card says how many more to send home
// ("1 more to go home") up to and including this stop in map order; after it
// (and on every take-away from partners) only "not 2 gone yet", as the free
// sums do not say the gap (D-078). Phase 22, design §9 #8; a default for Ted.
export const GAP_TOLD_UNTIL: NodeId = nodeId('ch3-n5');

function gapTold(session: LevelSession): boolean {
  const order = CHAPTERS.flatMap((c) => c.nodes.map((n) => n.id as string));
  const at = order.indexOf(session.whole.ref.nodeId);
  return at === -1 || at <= order.indexOf(GAP_TOLD_UNTIL);
}

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
// partner already on the mat and the sum (Phase 19), the start and how many go
// home (a take-away, Phase 22: its first step), a split's whole, or the number to make.
export function promptParams(puzzle: Puzzle): Record<string, number> {
  const q = puzzle.question;
  if (q.kind === 'addition_exact') {
    return { a: q.operands[0], b: q.operands[1] };
  }
  const away = puzzle.takeAway;
  if (away !== undefined) {
    const first = puzzle.steps?.[0];
    return { n: away.start, k: first?.kind === 'quantity' ? away.start - first.target : away.take };
  }
  const given = puzzle.given === undefined ? undefined : puzzle.initial.groups.get(puzzle.given);
  if (q.kind === 'sum_composition' && given !== undefined) {
    return { a: given.unitIds.length, n: q.sum };
  }
  // Compare Island (Phase 23c): the rail's number ("find a partner with fewer than 4"); a line-up none.
  if (q.kind === 'compare') {
    return { a: q.given };
  }
  if (q.kind === 'order') {
    return {};
  }
  return { n: q.kind === 'sum_composition' ? q.sum : q.kind === 'split' ? q.total : q.target };
}

// The task as the cloud says it now: on a countdown, this step's start and
// take ("4 here. Send 1 home"); elsewhere the stop's own line.
export function promptLine(session: LevelSession): Line {
  const { whole } = session;
  const away = takeAwayAt(session);
  return { key: whole.prompt, params: away === null ? promptParams(whole) : { n: away.start, k: away.take } };
}

// The answer set of a take-away from partners (Phase 22): the sizes that go
// home (validate() makes sure one set of sizes is the take), matched against
// the partners now in the tray. `wrong`: partners sent home that are not of
// those sizes; `due`: sizes still to send, with a partner of each on the mat.
function partnerTakeAway(session: LevelSession): { readonly wrong: ReadonlyArray<Group>; readonly due: ReadonlyArray<Group> } | null {
  const { whole } = session;
  const away = whole.takeAway;
  if (away === undefined || whole.onMat === undefined) {
    return null;
  }
  const state = session.history.state;
  const dealt = whole.onMat.map((id) => state.groups.get(id)!);
  const sizes = dealt.map(size);
  const sets = sizes.reduce<ReadonlyArray<ReadonlyArray<number>>>((all, n) => [...all, ...all.map((set) => [...set, n])], [[]]);
  const answer = [...(sets.find((set) => set.reduce((a, b) => a + b, 0) === away.take) ?? [])];
  const wrong: Group[] = [];
  for (const g of dealt.filter((x) => !x.unitIds.every((u) => state.bench.has(u)))) {
    const i = answer.indexOf(size(g));
    if (i === -1) {
      wrong.push(g);
    } else {
      answer.splice(i, 1);
    }
  }
  const onMat = dealt.filter((x) => x.unitIds.every((u) => state.bench.has(u)));
  const taken = new Set<string>();
  const due = answer.flatMap((n) => {
    const g = onMat.find((x) => size(x) === n && !taken.has(x.id));
    if (g === undefined) {
      return [];
    }
    taken.add(g.id);
    return [g];
  });
  return { wrong, due };
}

// The full help on a take-away from partners: bring the wrong one back and
// send the right one; or just the one of those that is left to do.
function partnerTakeAwayLine(session: LevelSession): Guidance | null {
  const plan = partnerTakeAway(session);
  if (plan === null) {
    return null;
  }
  const [wrong] = plan.wrong;
  const [due] = plan.due;
  if (wrong !== undefined && due !== undefined) {
    return { line: { key: copyKey('hint.call.back'), params: { a: size(wrong), b: size(due) } }, focus: { objects: [wrong.id, due.id], template: false } };
  }
  if (wrong !== undefined) {
    return { line: { key: copyKey('hint.call.back.one'), params: { a: size(wrong) } }, focus: { objects: [wrong.id], template: false } };
  }
  if (due !== undefined) {
    return { line: { key: copyKey('hint.send'), params: { a: size(due) } }, focus: { objects: [due.id], template: false } };
  }
  return null;
}

// The cards of a split (Phase 22, design §5.1): the task while the row is
// whole; "split it another way" past a split made; blocks in the tray are a
// correction (keep them all here); more than two piles is building.
function splitFeedback(session: LevelSession, line: (name: string, params?: Readonly<Record<string, number>>) => Line): AnswerFeedback {
  const { verdict } = session;
  const q = session.puzzle.question;
  const total = q.kind === 'split' ? q.total : 0;
  const again = { tone: 'building' as const, title: line('prompt.split.again'), detail: line('hint.split.another') };
  if (onlyPreset(session)) {
    return session.used.length > 0 ? again : { tone: 'start', title: line('feedback.start'), detail: line('prompt.split', { n: total }) };
  }
  if (verdict.reason === 'split-used') {
    return again;
  }
  if (verdict.reason === 'count-mismatch') {
    return { tone: 'adjust', title: line('feedback.split.keep'), detail: line('hint.bring.back', { k: total - verdict.benchCount }) };
  }
  return { tone: 'building', title: line('feedback.split.three', { k: clusters(session.history.state).length }), detail: line('hint.split.two') };
}

// The cards of a take-away (Phase 22, design §5.2): the task while nothing has
// gone; a countdown's next step; more to send (the gap told on the first
// stops, GAP_TOLD_UNTIL; from partners never); too many sent (bring some
// back), or the wrong partner sent (bring it back, send the right one).
function takeAwayFeedback(session: LevelSession, line: (name: string, params?: Readonly<Record<string, number>>) => Line): AnswerFeedback {
  const { verdict } = session;
  const away = takeAwayAt(session)!;
  const left = away.start - away.take;
  const count = verdict.benchCount;
  const partners = session.whole.onMat !== undefined;
  const task = promptLine(session);
  if (onlyPreset(session) || onlyOnMat(session)) {
    return { tone: 'start', title: line('feedback.start'), detail: task };
  }
  if (session.step > 0 && count === away.start) {
    return { tone: 'building', title: line('prompt.countdown'), detail: task };
  }
  if (count > left) {
    if (partners) {
      return { tone: 'building', title: line('feedback.send.notyet', { k: away.take }), detail: partnerTakeAwayLine(session)?.line ?? task };
    }
    const gap = count - left;
    return gapTold(session)
      ? { tone: 'building', title: line('feedback.send.more', { k: gap }), detail: line('hint.send.home', { k: gap }) }
      : { tone: 'building', title: line('feedback.send.notyet', { k: away.take }), detail: task };
  }
  if (partners) {
    return { tone: 'adjust', title: line('feedback.send.wrong', { x: away.start - count, k: away.take }), detail: partnerTakeAwayLine(session)?.line ?? task };
  }
  return { tone: 'adjust', title: line('feedback.send.toomany', { k: left - count }), detail: line('hint.bring.back', { k: left - count }) };
}

// What lights up for the partner on the rail above a compare's mat (Phase
// 23c): the rail is scenery, not material, so it has no id of its own; the
// screen lights it when the focus holds this.
export const RAIL_SPOT = 'compare-rail';

// The counts a compare accepts, from `lo` to `hi` (Infinity: no top).
function compareRange(given: number, relation: CompareRelation): { readonly lo: number; readonly hi: number } {
  switch (relation) {
    case 'same':
      return { lo: given, hi: given };
    case 'more':
      return { lo: given + 1, hi: Infinity };
    case 'fewer':
      return { lo: 1, hi: given - 1 };
    case 'one_more':
      return { lo: given + 1, hi: given + 1 };
    case 'one_fewer':
      return { lo: given - 1, hi: given - 1 };
  }
}

// The whole help for a row too short: as long as it, longer, one longer, shorter, one shorter.
const ROW_HINT: Readonly<Record<CompareRelation, string>> = {
  same: 'hint.as-long',
  more: 'hint.longer',
  fewer: 'hint.shorter',
  one_more: 'hint.one-longer',
  one_fewer: 'hint.one-shorter',
};

// How a count stands to the rail's: the word the cards say it with.
function relationOf(count: number, given: number): 'more' | 'fewer' | 'same' {
  return count > given ? 'more' : count < given ? 'fewer' : 'same';
}

// A compare built from partners (the tray deals partners, not single blocks).
function picksPartners(session: LevelSession): boolean {
  return session.whole.initial.groups.size > 0;
}

// The cards of a compare (Phase 23c, design §5.3). An empty mat is the task.
// The rail just grown ("one more" in steps): it is the child's size now, one
// more to go. Picking: two partners that make the rail's number are a
// discovery; one that does not do is said as a fact ("2 is fewer than 3"),
// amber, never a cross: the lesson itself, not giving the answer away.
// Building: short of it is building (never how many short, D-078); past it
// (or the same, when one fewer is asked) is a correction that says how many
// to take away.
function compareFeedback(session: LevelSession, line: (name: string, params?: Readonly<Record<string, number>>) => Line): AnswerFeedback {
  const q = session.puzzle.question;
  if (q.kind !== 'compare') {
    throw new Error('hints: not a compare');
  }
  const count = session.verdict.benchCount;
  const a = q.given;
  if (count === 0) {
    return { tone: 'start', title: line('feedback.start'), detail: promptLine(session) };
  }
  if (session.step > 0 && q.relation === 'one_more' && count === a) {
    return { tone: 'building', title: line('feedback.grow', { a }), detail: line('hint.under') };
  }
  if (picksPartners(session)) {
    const parts = lineUp(session.history.state);
    if (parts.length === 2 && count === a && q.relation !== 'same') {
      return { tone: 'building', title: line('feedback.compare.found-same', { x: parts[0]!, y: parts[1]!, a }), detail: promptLine(session) };
    }
    return { tone: 'adjust', title: line(`feedback.compare.is.${relationOf(count, a)}`, { x: count, a }), detail: line('hint.try.another') };
  }
  const { lo, hi } = compareRange(a, q.relation);
  if (count < lo) {
    const title = q.relation === 'more' ? 'feedback.compare.notmore' : q.relation === 'one_more' && count === a ? 'feedback.compare.same-now' : q.relation === 'one_fewer' ? 'feedback.compare.bit-more' : 'feedback.compare.fewer';
    return { tone: 'building', title: line(title), detail: line('hint.under') };
  }
  if (q.relation === 'one_fewer' && count === a) {
    return { tone: 'adjust', title: line('feedback.compare.same-back'), detail: line('hint.send.home', { k: 1 }) };
  }
  return { tone: 'adjust', title: line('feedback.compare.over', { k: count - hi }), detail: line(ROW_HINT[q.relation]) };
}

// A line-up as it stands (Phase 23c): its partners left (then top) first, and
// whether any two share a column (one on top of another).
function lineUpOf(state: BenchState): { readonly sizes: ReadonlyArray<number>; readonly stacked: boolean } {
  const spans = benchPartners(state)
    .map((g) => {
      const cells = g.unitIds.map((u) => state.bench.get(u)!);
      return { left: Math.min(...cells.map((c) => c.x)), right: Math.max(...cells.map((c) => c.x)) };
    })
    .sort((x, y) => x.left - y.left);
  return { sizes: lineUp(state), stacked: spans.some((sp, i) => i > 0 && spans[i - 1]!.right >= sp.left) };
}

// The cards of a line-up (Phase 23c, design §5.3): the task on an empty mat;
// two the wrong way round: which goes first; all three there but not smallest
// first: start with the smallest, and which goes first; one on top of
// another: side by side; otherwise one more to bring.
function orderFeedback(session: LevelSession, line: (name: string, params?: Readonly<Record<string, number>>) => Line): AnswerFeedback {
  const q = session.puzzle.question;
  const all = q.kind === 'order' ? q.sizes.length : 0;
  const { sizes, stacked } = lineUpOf(session.history.state);
  if (sizes.length === 0) {
    return { tone: 'start', title: line('feedback.start'), detail: promptLine(session) };
  }
  const i = sizes.findIndex((n, k) => k > 0 && sizes[k - 1]! > n);
  const first = i === -1 ? null : line('feedback.order.first', { x: sizes[i - 1]!, y: sizes[i]! });
  if (sizes.length === all) {
    if (first !== null) {
      return { tone: 'adjust', title: line('feedback.order.smallest'), detail: first };
    }
    return { tone: 'adjust', title: line('hint.side-by-side'), detail: promptLine(session) };
  }
  if (first !== null && !stacked) {
    return { tone: 'adjust', title: first, detail: line('hint.smallest-first') };
  }
  return { tone: 'building', title: line('feedback.order.one-more'), detail: promptLine(session) };
}

// Feedback describes a committed answer, not an in-flight drag. An incomplete
// collection is encouragement; enough blocks in the wrong arrangement gets an
// actionable correction. Colours alone never carry the verdict.
export function feedbackFor(session: LevelSession): AnswerFeedback {
  const { puzzle, verdict } = session;
  const q = puzzle.question;
  const line = (name: string, params: Readonly<Record<string, number>> = {}): Line => ({ key: copyKey(name), params });
  if (verdict.matched) {
    return { tone: 'success', title: line('feedback.success'), detail: matchedFeedback(session) };
  }
  // Compare Island (Phase 23c) has its own cards.
  if (q.kind === 'compare') {
    return compareFeedback(session, line);
  }
  if (q.kind === 'order') {
    return orderFeedback(session, line);
  }
  const target = q.kind === 'addition_exact' ? q.operands[0] + q.operands[1] : q.kind === 'sum_composition' ? q.sum : q.kind === 'split' ? q.total : q.target;
  // Take-away Island (Phase 22) has its own cards.
  if (q.kind === 'split') {
    return splitFeedback(session, line);
  }
  if (session.whole.takeAway !== undefined) {
    return takeAwayFeedback(session, line);
  }
  // One way made on a stop asked two ways, still on the mat (alone, or left
  // standing while the next way is built beside it): build another (like "now
  // a new shape!" for a stop in steps, review L).
  if (sameWayAgain(session)) {
    return { tone: 'building', title: line('feedback.another'), detail: line('hint.another-way', { n: target }) };
  }
  // A "who's missing?" stop opens with a partner on the mat, and a "send the
  // extra away" stop with too many (Phase 21): that is the start too. Once they
  // have gone back, "here is 2" (or "too many") is no longer true, so an empty
  // mat there asks for two partners.
  const opening = onlyGiven(session) || onlyOnMat(session);
  if (verdict.benchCount === 0 || opening) {
    const dealt = puzzle.given !== undefined || puzzle.onMat !== undefined;
    // A Shape Island picture (Phase 23b): into the shadow, or, with no shadow
    // yet, like the little picture.
    const picture = pictureOpening(session);
    return {
      tone: 'start',
      title: line('feedback.start'),
      detail: picture ?? (dealt && !opening ? line('prompt.sum_composition', { n: target }) : { key: puzzle.prompt, params: promptParams(puzzle) }),
    };
  }
  // A picture's shadow on the mat (Phase 23b, PRD §4.2.5): part of it still
  // empty, or a piece sticking out of it. Building, not mistakes: the judge
  // takes the picture anywhere, so neither sounds the "hmm".
  const inShadow = shadowCard(session);
  if (inShadow !== null) {
    return inShadow;
  }
  // Two other partners joined that make the same total (3 + 1 on a 2 + 2 stop):
  // a discovery, said as one (Phase 20, play review F5), then which two to find.
  const found = verdict.reason === 'groups-mismatch' ? sameSum(session) : null;
  if (found !== null) {
    const { x, y, n, a, b } = found.line.params as Readonly<Record<'x' | 'y' | 'n' | 'a' | 'b', number>>;
    return { tone: 'building', title: line('feedback.same-sum', { x, y, n }), detail: line('hint.find', { a, b }) };
  }
  const detail = hintFor(session);
  if (verdict.reason === 'count-mismatch') {
    const fewer = verdict.benchCount < target;
    if (fewer && (q.kind === 'addition_exact' || q.kind === 'sum_composition')) {
      const mat = matOf(session);
      const selected = [...mat.groups.values()]
        .filter((g) => g.unitIds.every((u) => mat.bench.has(u)))
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
    // "3 more blocks to go" beside a 2 on a make-5 stop is the answer: say only
    // "not 5 yet". So it is on every free sum (Phase 20, play review Q5: a 1 on
    // the make-5 boss said "4 more to go" beside a 4 in the tray).
    if (fewer && (puzzle.given !== undefined || q.kind === 'sum_composition')) {
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
  // Right count, but partners that cannot make the picture however they are
  // moved (2 + 4 on the stairs, Phase 21): the partners need changing, not the shape.
  const key = verdict.reason === 'shape-mismatch' ? (shapeInReach(session) ? 'feedback.shape' : 'feedback.partners')
    : verdict.reason === 'groups-mismatch' ? 'feedback.partners' : 'feedback.join';
  return { tone: 'adjust', title: line(key), detail };
}

// The card's line on an empty mat at a Shape Island picture: into the shadow
// while it is drawn; else build it like the little picture (n7, n8 before
// help brings the shadow). Null on every other stop, and on a picture in steps.
function pictureOpening(session: LevelSession): Line | null {
  const { whole, shadow } = session;
  if (shadow === null) {
    return null;
  }
  if (shadow.shown) {
    return { key: copyKey('hint.shadow.start'), params: {} };
  }
  return whole.picture === undefined ? null : { key: copyKey(`hint.picture.look.${whole.picture}`), params: {} };
}

// What is on the mat against the shadow: the pieces (partners whole, single
// blocks one by one) with a block outside it, and how many lie inside.
interface ShadowMat {
  readonly cells: ReadonlyArray<Cell>;
  readonly gap: ReadonlyArray<Cell>;
  readonly out: ReadonlyArray<Piece>;
  readonly inside: number;
}

function shadowMat(session: LevelSession): ShadowMat | null {
  const view = shadowView(session);
  if (view === null || session.verdict.matched) {
    return null;
  }
  const state = matOf(session);
  const shadow = new Set(view.cells.map((c) => `${c.x},${c.y}`));
  const inGroup = grouped(state);
  const pieces: Piece[] = [
    ...benchPartners(state).map((g) => ({ id: g.id as string, shape: g.unitIds.map((u) => state.bench.get(u)!) })),
    ...[...state.bench.entries()].filter(([u]) => !inGroup.has(u)).map(([u, c]) => ({ id: u as string, shape: [c] })),
  ];
  const isIn = (p: Piece) => p.shape.every((c) => shadow.has(`${c.x},${c.y}`));
  const filled = new Set([...state.bench.values()].map((c) => `${c.x},${c.y}`));
  return { cells: view.cells, gap: view.cells.filter((c) => !filled.has(`${c.x},${c.y}`)), out: pieces.filter((p) => !isIn(p)), inside: pieces.filter(isIn).length };
}

// The shadow's cards (PRD §4.2.5). Too many, or the right count of partners
// that cannot make the picture, keep their own cards (a decoy to send back).
function shadowCard(session: LevelSession): AnswerFeedback | null {
  const mat = shadowMat(session);
  const q = session.puzzle.question;
  // (Past a step, the right count on the last picture's blocks is "now a new shape!".)
  if (mat === null || q.kind !== 'quantity_shape' || session.verdict.benchCount > q.target || (session.verdict.benchCount === q.target && (!shapeInReach(session) || session.step > 0))) {
    return null;
  }
  if (mat.out.length > 0 && mat.inside > 0) {
    return { tone: 'building', title: { key: copyKey('feedback.shadow.out'), params: {} }, detail: { key: copyKey('hint.shadow.move'), params: {} } };
  }
  if (mat.out.length === 0 && session.verdict.benchCount < q.target) {
    return { tone: 'building', title: { key: copyKey('feedback.shadow.gap'), params: {} }, detail: { key: copyKey('hint.shadow.here'), params: {} } };
  }
  return null;
}

// What is still in the tray, as pieces to fill the shadow with: each partner
// (its shape from its top-left) and each single block.
function trayPieces(state: BenchState): ReadonlyArray<Piece> {
  const inGroup = grouped(state);
  return [
    ...trayPartners(state).map((g) => ({ id: g.id as string, shape: g.shape })),
    ...state.tray.flatMap((t) => (t.unitId === null || inGroup.has(t.unitId) ? [] : [{ id: t.unitId as string, shape: [{ x: 0, y: 0 }] }])),
  ];
}

// The next piece into the shadow, and where (PRD §4.2.5 "put the 3 in the
// shadow", "put the 1 here"): the biggest piece of a way to fill what is empty
// with what is in the tray; with a piece sticking out, that piece, back into
// the shadow. Null when nothing fills it (a decoy in the way: its own help).
export function shadowNext(session: LevelSession): Placement | null {
  const mat = shadowMat(session);
  if (mat === null) {
    return null;
  }
  const state = session.history.state;
  const [stray] = mat.out;
  if (stray !== undefined && mat.inside > 0) {
    const left = Math.min(...stray.shape.map((c) => c.x));
    const top = Math.min(...stray.shape.map((c) => c.y));
    // What is empty, and what the stray piece covers now: free once it moves.
    const free = new Set([...mat.gap, ...stray.shape].map((c) => `${c.x},${c.y}`));
    const gap = mat.cells.filter((c) => free.has(`${c.x},${c.y}`));
    const plan = fill(gap, trayPieces(state), { id: stray.id, shape: stray.shape.map((c) => ({ x: c.x - left, y: c.y - top })) });
    return plan?.[0] ?? null;
  }
  // The biggest piece of the way first: the rocket's fins before the 1s on top.
  const plan = fill(mat.gap, trayPieces(state));
  return plan === null ? null : plan.reduce((best, p) => (p.cells.length > best.cells.length ? p : best));
}

// Can these pieces cover an accepted turn of the picture exactly, moved but
// never turned (a partner is rigid, and its shape is the one it was dealt
// with): every partner inside, single blocks on the cells left? A shape stop
// built from partners can have the right count and no way to the picture
// (Phase 21: 2 + 4 is 6 blocks, and no stairs).
export function covers(shapes: ReadonlyArray<ReadonlyArray<Cell>>, loose: number, q: Extract<Question, { kind: 'quantity_shape' }>): boolean {
  if (shapes.reduce((a, x) => a + x.length, loose) !== q.template.cells.length) {
    return false;
  }
  const key = (c: Cell) => `${c.x},${c.y}`;
  return variants(q.template, q.symmetry ?? DEFAULT_SYMMETRY).some((cells) => {
    const inside = new Set(cells.map(key));
    const place = (left: ReadonlyArray<ReadonlyArray<Cell>>, taken: ReadonlySet<string>): boolean => {
      const [shape, ...rest] = left;
      if (shape === undefined) {
        return true;
      }
      const head = shape[0]!;
      return cells.some((c) => {
        const mine = shape.map((x) => key({ x: x.x - head.x + c.x, y: x.y - head.y + c.y }));
        return mine.every((k) => inside.has(k) && !taken.has(k)) && place(rest, new Set([...taken, ...mine]));
      });
    };
    return place(shapes, new Set());
  });
}

// The mat as it is could make the picture, if moved about.
function shapeInReach(session: LevelSession): boolean {
  const q = session.puzzle.question;
  if (q.kind !== 'quantity_shape') {
    return true;
  }
  const state = matOf(session);
  const partners = benchPartners(state);
  const inGroup = grouped(state);
  return covers(partners.map((g) => g.shape), [...state.bench.keys()].filter((u) => !inGroup.has(u)).length, q);
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
  // A take-away reads as it happened (Phase 22): "5 take away 2 leaves 3"; a split names its piles.
  const away = takeAwayAt(session);
  if (away !== null) {
    return { key: copyKey('feedback.matched.take_away'), params: { n: away.start, k: away.take, r: away.start - away.take } };
  }
  // Compare Island (Phase 23c): "4 is more than 2", the child's number first
  // (design §9 #5), never "greater than"; a line-up names its three in order.
  if (q.kind === 'compare') {
    const x = session.verdict.benchCount;
    return { key: copyKey(`feedback.matched.compare.${relationOf(x, q.given)}`), params: { x, a: q.given } };
  }
  if (q.kind === 'order') {
    const [a, b, c] = lineUp(session.history.state);
    return q.sizes.length === 3 ? { key: copyKey('feedback.matched.order'), params: { a: a!, b: b!, c: c! } } : { key: copyKey('feedback.matched.quantity'), params: { n: q.sizes.reduce((m, n) => m + n, 0) } };
  }
  if (q.kind === 'split') {
    const parts = solvedParts(session);
    return parts === null ? { key: copyKey('feedback.matched.quantity'), params: { n: q.total } } : { key: copyKey('feedback.matched.split'), params: { n: q.total, a: parts[0], b: parts[1] } };
  }
  if (q.kind === 'quantity' || q.kind === 'quantity_shape') {
    // The last picture of a stop in steps: the same blocks, a new shape (Phase 20, F5).
    if (session.step > 0 && session.whole.steps !== undefined) {
      return { key: copyKey('feedback.matched.same'), params: { n: q.target } };
    }
    // A Shape Island picture says what it is (Phase 23b): "A mushroom!"; the
    // rocket blasts off. Its parts are said when the card is tapped (partsLine).
    const picture = session.whole.picture;
    if (picture !== undefined) {
      return { key: copyKey(picture === 'rocket' ? 'feedback.launch' : `feedback.matched.picture.${picture}`), params: {} };
    }
    // Made of parts (a 5, a 3 and a 1): name them, left to right (Phase 20, F5).
    const parts = partsOf(session.history.state);
    if (parts.length >= 2 && parts.length <= MAX_PARTS) {
      const names = ['a', 'b', 'c', 'd', 'e'];
      return { key: copyKey(`feedback.matched.parts.${parts.length}`), params: Object.fromEntries([...parts.map((n, i) => [names[i]!, n]), ['n', q.target]]) };
    }
    if (q.kind === 'quantity_shape') {
      return { key: copyKey('feedback.matched.shape'), params: { n: q.target } };
    }
    return { key: copyKey(q.target === 1 ? 'feedback.matched.quantity.one' : 'feedback.matched.quantity'), params: { n: q.target } };
  }
  const total = q.kind === 'sum_composition' ? q.sum : q.operands[0] + q.operands[1];
  const parts = solvedParts(session);
  return parts === null
    ? { key: copyKey('feedback.matched.quantity'), params: { n: total } }
    : { key: copyKey('feedback.matched.addition'), params: { a: parts[0], b: parts[1], n: total } };
}

// What a right picture is made of, said when the card is tapped (PRD §4.2.6,
// SHAPE_CLOUD_ON_PASS 'count'): "3, 1, 1 and 1, 6 in all"; null for one piece
// or more than MAX_PARTS.
export function partsLine(session: LevelSession): Line | null {
  const q = session.puzzle.question;
  const parts = partsOf(session.history.state);
  if (q.kind !== 'quantity_shape' || parts.length < 2 || parts.length > MAX_PARTS) {
    return null;
  }
  const names = ['a', 'b', 'c', 'd', 'e'];
  return { key: copyKey(`feedback.matched.parts.${parts.length}`), params: Object.fromEntries([...parts.map((n, i) => [names[i]!, n]), ['n', q.target]]) };
}

// The longest list of parts a success line names (feedback.matched.parts.2 … 5).
const MAX_PARTS = 5;

// The parts of a right quantity: each partner on the mat, and each group of
// touching single blocks, left (then top) first.
export function partsOf(state: BenchState): ReadonlyArray<number> {
  const inGroup = grouped(state);
  const at = (units: ReadonlyArray<UnitId>) => {
    const cells = units.map((u) => state.bench.get(u)!);
    return { x: Math.min(...cells.map((c) => c.x)), y: Math.min(...cells.map((c) => c.y)) };
  };
  const partners = benchPartners(state).map((g) => ({ n: size(g), ...at(g.unitIds) }));
  const loose = clusters(state)
    .map((c) => c.unitIds.filter((u) => !inGroup.has(u)))
    .filter((units) => units.length > 0)
    .map((units) => ({ n: units.length, ...at(units) }));
  return [...partners, ...loose].sort((a, b) => a.x - b.x || a.y - b.y).map((p) => p.n);
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
    // Single blocks only: as many as the title says are missing (Phase 20, Q6).
    return partnerStep
      ? { key: copyKey('hint.fewer.partner'), params: { n: target } }
      : missing === 1
        ? { key: copyKey('hint.count-mismatch.fewer'), params: { n: target } }
        : { key: copyKey('hint.fewer.blocks'), params: { n: target, k: missing } };
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
  const state = matOf(session);
  const q = puzzle.question;
  if (verdict.matched) {
    return matchedFeedback(session);
  }
  // Take-away Island's cards carry their own line (Phase 22), and Compare Island's (Phase 23c).
  if (q.kind === 'split' || session.whole.takeAway !== undefined || q.kind === 'compare' || q.kind === 'order') {
    return feedbackFor(session).detail;
  }
  switch (q.kind) {
    case 'quantity':
    case 'quantity_shape':
      if (verdict.reason === 'count-mismatch') {
        return countHint(state, q.target, verdict.benchCount);
      }
      // Partners that cannot make the picture: change one (asked-for help names which).
      if (verdict.reason === 'shape-mismatch' && !shapeInReach(session)) {
        return { key: copyKey('feedback.swap'), params: {} };
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
  // Cells of a picture's shadow to glow (Phase 23b: "this bit is missing").
  readonly cells?: ReadonlyArray<Cell>;
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
  const state = matOf(session);
  if (verdict.matched) {
    return NO_FOCUS;
  }
  const template = puzzle.question.kind === 'quantity_shape' && (verdict.benchCount === 0 || (verdict.reason === 'shape-mismatch' && shapeInReach(session)));
  // A split (Phase 22): the whole row while it is whole; the smallest pile when
  // there are too many; the blocks in the tray when some went home. A take-away
  // from partners: the partners on the mat (and their badges).
  if (puzzle.question.kind === 'split') {
    if (onlyPreset(session)) {
      return { objects: [...state.bench.keys()], template: false };
    }
    if (verdict.reason === 'parts-mismatch') {
      const smallest = clusters(state).reduce((a, b) => (b.unitIds.length < a.unitIds.length ? b : a));
      return { objects: [...smallest.unitIds], template: false };
    }
    if (verdict.reason === 'count-mismatch') {
      return { objects: state.tray.flatMap((t) => (t.unitId === null ? [] : [t.unitId])), template: false };
    }
    return NO_FOCUS;
  }
  if (session.whole.takeAway !== undefined && session.whole.onMat !== undefined) {
    return { objects: benchPartners(state).map((g) => g.id), template: false };
  }
  // Compare Island (Phase 23c, design §5.5): the partner on the rail (and,
  // picking, the partners in the tray); a line-up: its three, wherever they are.
  if (puzzle.question.kind === 'compare') {
    return { objects: [RAIL_SPOT, ...(picksPartners(session) ? trayPartners(state).map((g) => g.id) : [])], template: false };
  }
  if (puzzle.question.kind === 'order') {
    return { objects: [...state.groups.values()].map((g) => g.id), template: false };
  }
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
// `accepts`: whether the partners and single blocks of an end state could
// make what the stop asks (a shape stop: cover its picture); every count is
// fine for a quantity stop.
function quantityPlan(state: BenchState, target: number, accepts: (shapes: ReadonlyArray<ReadonlyArray<Cell>>, loose: number) => boolean = () => true): Guidance | null {
  const groups = [...state.groups.values()];
  const onBench = groups.map((g) => g.unitIds.every((u) => state.bench.has(u)));
  const loose = benchLoose(state);
  const totalLoose = loose.length + trayLooseCount(state);
  type Move = { readonly kind: 'send' | 'bring'; readonly i: number } | { readonly kind: 'return' | 'take' };
  const key = (mask: number, k: number) => mask * 64 + k;
  const startMask = onBench.reduce((m, on, i) => (on ? m | (1 << i) : m), 0);
  const total = (mask: number, k: number) => groups.reduce((sum, g, i) => (mask & (1 << i) ? sum + size(g) : sum), 0) + k;
  const done = (mask: number, k: number) => total(mask, k) === target && accepts(groups.filter((_, i) => mask & (1 << i)).map((g) => g.shape), k);
  const seen = new Map<number, ReadonlyArray<Move>>([[key(startMask, loose.length), []]]);
  const queue: [number, number][] = [[startMask, loose.length]];
  let path: ReadonlyArray<Move> | null = done(startMask, loose.length) ? [] : null;
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
      if (done(m, kk)) {
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

// Two other partners joined that make the stop's total (5 + 2 on a 3 + 4
// stop, 3 + 1 on a 2 + 2 stop): the same-sum help line, naming the two to
// find, with all four lit. Null when the mat is anything else.
function sameSum(session: LevelSession): Guidance | null {
  const q = session.puzzle.question;
  const state = matOf(session);
  const bench = benchPartners(state);
  if (q.kind === 'quantity' || q.kind === 'quantity_shape' || q.kind === 'split' || q.kind === 'compare' || q.kind === 'order' || bench.length !== 2 || !areTouching(state, bench[0]!, bench[1]!)) {
    return null;
  }
  const plan = pairPlan(state, q.kind === 'addition_exact' ? [q.operands] : q.allowed);
  return plan !== null && plan.line.key === copyKey('hint.same-sum') ? plan : null;
}

// Whether asked-for help (level 2) has something to name: a mistake, and
// building states where naming is the help (Phase 19): one way made on a stop
// asked two ways, the other half not there yet on a "who's missing?" stop
// (whose card title no longer says how many are missing), and two other
// partners that make the total too (Phase 20).
// The opening of a "send the extra away" stop asks too (Phase 21): it is too
// many, and the help climbs to which one to send back.
// A split's and a take-away's openings and building states ask too (Phase
// 22): the help climbs from the task to the move (pull the last block away;
// send 2 home, 3 stay; bring the 4 back, send the 2).
export function asksForHelp(session: LevelSession, f: AnswerFeedback = feedbackFor(session)): boolean {
  const takeAwayIsland = session.puzzle.question.kind === 'split' || session.whole.takeAway !== undefined;
  // Compare Island (Phase 23c): its openings and building states ask too (as long as it; the smallest first).
  const compareIsland = session.puzzle.question.kind === 'compare' || session.puzzle.question.kind === 'order';
  // A Shape Island picture (Phase 23b): its opening, and its shadow's cards.
  const shadowAsks = session.shadow !== null && f.tone !== 'success' && (f.tone === 'start' || [copyKey('feedback.shadow.gap'), copyKey('feedback.shadow.out'), copyKey('feedback.change')].includes(f.title.key));
  return (
    shadowAsks ||
    f.tone === 'adjust' ||
    (compareIsland && f.tone !== 'success') ||
    onlyOnMat(session) ||
    onlyPreset(session) ||
    (f.tone === 'building' && (takeAwayIsland || sameWayAgain(session) || session.whole.given !== undefined || session.whole.onMat !== undefined || f.title.key === copyKey('feedback.same-sum')))
  );
}

// The whole help on a split (Phase 22): the last block to pull away; past a
// split made, the block whose move makes a new one; a pile too many: push the
// smallest back; blocks in the tray: how many to bring back.
function splitPlan(session: LevelSession): Guidance | null {
  const q = session.puzzle.question;
  const { verdict } = session;
  const state = session.history.state;
  if (q.kind !== 'split') {
    return null;
  }
  const move = demoMove(session);
  const mover = move?.type === 'move' ? [move.unitId as string] : [];
  if (onlyPreset(session)) {
    return session.used.length > 0
      ? { line: { key: copyKey('hint.split.another'), params: {} }, focus: { objects: mover, template: false } }
      : { line: { key: copyKey('hint.pull.right'), params: {} }, focus: { objects: mover, template: false } };
  }
  if (verdict.reason === 'split-used') {
    return { line: { key: copyKey('hint.split.another'), params: {} }, focus: { objects: [], template: false } };
  }
  if (verdict.reason === 'count-mismatch') {
    return { line: { key: copyKey('hint.bring.back'), params: { k: q.total - verdict.benchCount } }, focus: { objects: state.tray.flatMap((t) => (t.unitId === null ? [] : [t.unitId])), template: false } };
  }
  const smallest = clusters(state).reduce((a, b) => (b.unitIds.length < a.unitIds.length ? b : a));
  return { line: { key: copyKey('hint.split.two'), params: {} }, focus: { objects: [...smallest.unitIds], template: false } };
}

// The whole help on a take-away (Phase 22): of single blocks, how many to send
// and how many stay (lighting the blocks to send, from the right), or how many
// to bring back (lighting them in the tray); from partners, partnerTakeAwayLine.
function takeAwayPlan(session: LevelSession): Guidance | null {
  const away = takeAwayAt(session);
  if (away === null) {
    return null;
  }
  if (session.whole.onMat !== undefined) {
    return partnerTakeAwayLine(session);
  }
  const state = session.history.state;
  const left = away.start - away.take;
  const count = state.bench.size;
  if (count > left) {
    const k = count - left;
    const fromRight = [...state.bench.entries()].sort(([, a], [, b]) => b.x - a.x || b.y - a.y).map(([u]) => u as string);
    return { line: { key: copyKey('hint.send.home.left'), params: { k, r: left } }, focus: { objects: fromRight.slice(0, k), template: false } };
  }
  if (count < left) {
    const k = left - count;
    const inTray = state.tray.flatMap((t) => (t.unitId === null ? [] : [t.unitId as string]));
    return { line: { key: copyKey('hint.bring.back'), params: { k } }, focus: { objects: inTray.slice(-k), template: false } };
  }
  return null;
}

// The way made stands on its own and nothing else is on the mat: make the
// next one beside it, lighting the two to bring (Phase 20, play review Q1: "it
// is 7 too, find 5 and 2" led the child to stack them on the first way). With
// no room beside it, the help sends the first way back as before.
function besidePlan(session: LevelSession): Guidance | null {
  const q = session.puzzle.question;
  if (q.kind !== 'sum_composition' || matOf(session).bench.size > 0 || !roomBeside(session)) {
    return null;
  }
  const state = session.history.state;
  const tray = trayPartners(state);
  for (const [a, b] of q.allowed) {
    const first = tray.find((g) => size(g) === a);
    const second = tray.find((g) => g !== first && size(g) === b);
    if (first !== undefined && second !== undefined) {
      return { line: { key: copyKey('hint.beside'), params: { n: q.sum } }, focus: { objects: [first.id, second.id], template: false } };
    }
  }
  return null;
}

// The whole help on a compare (Phase 23c, design §5.5). Picking: the partner
// on the mat to send back and the right one to bring (the middle rung sends
// back only); with nothing on the mat, the task with the rail lit. Building:
// short of it, how long the row must be, the rail lit (the middle rung: one
// more under it); past it, how many to send home, the ones at the right end lit.
function comparePlan(session: LevelSession): Guidance | null {
  const q = session.puzzle.question;
  if (q.kind !== 'compare') {
    return null;
  }
  const state = session.history.state;
  const count = session.verdict.benchCount;
  const rail: AnswerFocus = { objects: [RAIL_SPOT], template: false };
  if (picksPartners(session)) {
    const right = trayPartners(state).find((g) => compares(size(g), q.given, q.relation));
    const [wrong] = leftToRight(state, benchPartners(state));
    if (wrong === undefined || right === undefined) {
      return wrong === undefined ? { line: promptLine(session), focus: rail } : { line: { key: copyKey('hint.send'), params: { a: size(wrong) } }, focus: { objects: [wrong.id], template: false } };
    }
    return { line: { key: copyKey('hint.swap.pair'), params: { a: size(wrong), b: size(right) } }, focus: { objects: [wrong.id, right.id], template: false } };
  }
  const { hi } = compareRange(q.given, q.relation);
  if (count > hi) {
    const k = count - hi;
    const fromRight = [...state.bench.entries()].sort(([, a], [, b]) => b.x - a.x || b.y - a.y).map(([u]) => u as string);
    return { line: { key: copyKey('hint.send.home'), params: { k } }, focus: { objects: fromRight.slice(0, k), template: false } };
  }
  return { line: { key: copyKey(ROW_HINT[q.relation]), params: {} }, focus: rail };
}

// The whole help on a line-up (Phase 23c): where each of the three goes, the
// smallest lit (the middle rung: only that the smallest goes first).
function orderPlan(session: LevelSession): Guidance | null {
  const q = session.puzzle.question;
  if (q.kind !== 'order' || q.sizes.length !== 3) {
    return null;
  }
  const smallest = [...session.history.state.groups.values()].find((g) => size(g) === q.sizes[0]);
  const [a, b, c] = q.sizes;
  return { line: { key: copyKey('hint.order.line'), params: { a: a!, b: b!, c: c! } }, focus: { objects: smallest === undefined ? [] : [smallest.id], template: false } };
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
  const state = matOf(session);
  const aside = sameWayAgain(session) && state.bench.size === 0;
  // A shape from partners plans towards partners that can make the picture.
  const accepts = q.kind === 'quantity_shape' ? (shapes: ReadonlyArray<ReadonlyArray<Cell>>, loose: number) => covers(shapes, loose, q) : undefined;
  const plan =
    q.kind === 'compare'
      ? comparePlan(session)
      : q.kind === 'order'
        ? orderPlan(session)
        : q.kind === 'split'
      ? splitPlan(session)
      : session.whole.takeAway !== undefined
        ? takeAwayPlan(session)
        : q.kind === 'quantity' || q.kind === 'quantity_shape'
      ? verdict.reason === 'count-mismatch' || (verdict.reason === 'shape-mismatch' && !shapeInReach(session))
        ? quantityPlan(state, q.target, accepts)
        : null
      : verdict.reason === 'not-merged'
        ? null
        : q.kind === 'sum_composition' && aside
          ? (besidePlan(session) ?? pairPlan(session.history.state, q.allowed))
          : pairPlan(state, q.kind === 'addition_exact' ? [q.operands] : q.allowed);
  return plan === null ? first : { line: plan.line, focus: { objects: plan.focus.objects, template: first.focus.template } };
}

// How many times asking for help on the same answer it takes to hear all of
// it (Phase 20, play review Q3: the first ask gave the whole answer away).
// Each ask climbs a rung: the card's own line, lighting what it is about (and
// numbering the blocks on the mat one by one when the count is off); then only
// what to send back; then everything (send this back, bring that). A change
// to the answer starts again at the bottom. 1 is the old help: everything on
// the first ask.
export const HELP_LADDER_STEPS: number = 3;

export type HelpRung = 'look' | 'send' | 'full';
const RUNGS: ReadonlyArray<HelpRung> = ['look', 'send', 'full'];

// The rung the `asks`-th ask reaches, on a ladder of `steps` rungs (the top ones).
export function rungOf(asks: number, steps: number = HELP_LADDER_STEPS): HelpRung {
  const ladder = RUNGS.slice(RUNGS.length - Math.min(Math.max(Math.trunc(steps), 1), RUNGS.length));
  return ladder[Math.min(Math.max(Math.trunc(asks), 1), ladder.length) - 1]!;
}

export interface AskedHelp extends Guidance {
  // Number the blocks on the mat one by one (with the counting sound, no words):
  // the first ask when the count is off.
  readonly countUp: boolean;
  // Shape Island (Phase 23b): the shadow comes to help now (its spec's ask),
  // and the "like this" hand shows the piece the line names.
  readonly reveal?: boolean;
  readonly demo?: boolean;
}

// The help ladder at a Shape Island picture (PRD §4.2.5). On the empty mat:
// with no shadow yet, "build it like the little picture" (the picture lit),
// then, on the ask the spec names, "here comes the shadow"; with the shadow,
// "put partners in the shadow" (the shadow and the picture lit), then "put the
// 3 in the shadow" (the 3 and its cells lit), then that again with the hand.
// Part filled: "this bit is missing" (the empty cells lit), then "put the 1
// here", then with the hand. A piece sticking out: the empty cells, then "move
// the 4 into the shadow" (it and where it goes lit). Null where the shadow has
// nothing to say: the stop's own ladder goes on.
function shadowHelp(session: LevelSession, asks: number): AskedHelp | null {
  const { whole, shadow, verdict } = session;
  if (shadow === null || whole.shadow === undefined || whole.picture === undefined || verdict.matched) {
    return null;
  }
  const n = Math.max(1, Math.trunc(asks));
  const line = (name: string, params: Readonly<Record<string, number>> = {}): Line => ({ key: copyKey(name), params });
  const help = (l: Line, focus: AnswerFocus, more: { readonly reveal?: boolean; readonly demo?: boolean } = {}): AskedHelp => ({ line: l, focus, countUp: false, ...more });
  const named = (demo: boolean, out = false): AskedHelp | null => {
    const next = shadowNext(session);
    return next === null ? null : help(line(out ? 'hint.shadow.in' : session.history.state.bench.size === 0 ? 'hint.shadow.piece' : 'hint.shadow.put', { a: next.cells.length }), { objects: [next.id], template: false, cells: next.cells }, { demo });
  };
  if (matOf(session).bench.size === 0) {
    // (The ask that brings it says so, also once it has come: the card shows it.)
    const due = whole.shadow === 'always' ? 0 : whole.shadow.onHelp;
    if (n === due || (!shadow.shown && n > due)) {
      return help(line('hint.shadow.reveal'), { objects: [], template: false }, { reveal: true });
    }
    if (!shadow.shown) {
      return help(line(`hint.picture.look.${whole.picture}`), { objects: [], template: true });
    }
    const view = shadowView(session)!;
    return n === 1 ? help(line('hint.shadow.start'), { objects: [], template: true, cells: view.cells }) : named(n >= HELP_LADDER_STEPS);
  }
  const card = shadowCard(session);
  const mat = shadowMat(session);
  // The next picture of a stop in steps, on the blocks of the one before:
  // its card says "now a new shape!", its help is the stray block's.
  const changing = card === null && mat !== null && session.step > 0 && mat.out.length > 0 && verdict.reason === 'shape-mismatch';
  if (mat === null || (card === null && !changing)) {
    return null;
  }
  const out = changing || card?.title.key === copyKey('feedback.shadow.out');
  if (n === 1) {
    return help(card?.detail ?? feedbackFor(session).detail, { objects: [], template: false, cells: mat.gap });
  }
  return named(!out && n >= HELP_LADDER_STEPS, out);
}

// The hand's move at a picture with its shadow drawn: the next piece into the
// shadow (shadowNext), from the tray to its place, or a single block moved
// into it; undefined when there is none (the stop's own first move then).
export function shadowDemo(session: LevelSession): Command | undefined {
  if (session.shadow?.shown !== true) {
    return undefined;
  }
  const next = shadowNext(session);
  const state = session.history.state;
  if (next === null) {
    return undefined;
  }
  const group = state.groups.get(next.id as GroupId);
  if (group !== undefined) {
    return group.unitIds.some((u) => state.bench.has(u)) ? undefined : { type: 'takeGroup', groupId: group.id, origin: next.origin };
  }
  return state.bench.has(next.id as UnitId) ? { type: 'move', unitId: next.id as UnitId, to: next.origin } : { type: 'take', unitId: next.id as UnitId, to: next.origin };
}

// The middle rung: of a whole correction, only the part that sends back.
function sendOnly(full: Guidance): Guidance | null {
  const { key, params } = full.line;
  const [first] = full.focus.objects;
  if (first !== undefined && (key === copyKey('hint.swap.pair') || key === copyKey('hint.same-sum'))) {
    return { line: { key: copyKey('hint.send'), params: { a: key === copyKey('hint.same-sum') ? params.x! : params.a! } }, focus: { objects: [first], template: full.focus.template } };
  }
  if (key === copyKey('hint.stuck.named')) {
    return { line: { key: copyKey('hint.stuck.block'), params: {} }, focus: { objects: full.focus.objects.slice(0, -1), template: full.focus.template } };
  }
  // Take-away Island (Phase 22, design §5.5): "send 2 home" before "send 2
  // home, 3 stay"; "bring the 4 back" before "bring the 4 back, send the 2";
  // "pull one block away" before "pull the last block away".
  if (key === copyKey('hint.send.home.left')) {
    return { line: { key: copyKey('hint.send.home'), params: { k: params.k! } }, focus: full.focus };
  }
  if (key === copyKey('hint.call.back') && first !== undefined) {
    return { line: { key: copyKey('hint.call.back.one'), params: { a: params.a! } }, focus: { objects: [first], template: full.focus.template } };
  }
  if (key === copyKey('hint.pull.right')) {
    return { line: { key: copyKey('hint.pull'), params: {} }, focus: full.focus };
  }
  // Compare Island (Phase 23c, design §5.5): "one more under it" before "as
  // long as it"; "the smallest goes first" before where all three go.
  if (Object.values(ROW_HINT).some((h) => key === copyKey(h))) {
    return { line: { key: copyKey('hint.under'), params: {} }, focus: full.focus };
  }
  if (key === copyKey('hint.order.line')) {
    return { line: { key: copyKey('hint.smallest-first'), params: {} }, focus: full.focus };
  }
  return null;
}

// Help the child asked for, the `asks`-th time on this answer (see HELP_LADDER_STEPS).
export function helpAt(session: LevelSession, asks: number, steps: number = HELP_LADDER_STEPS): AskedHelp {
  const inShadow = shadowHelp(session, asks);
  if (inShadow !== null) {
    return inShadow;
  }
  const f = feedbackFor(session);
  if (!asksForHelp(session, f)) {
    return { ...guidanceFor(session, 1), countUp: false };
  }
  const rung = rungOf(asks, steps);
  if (rung === 'full') {
    return { ...guidanceFor(session, 2), countUp: false };
  }
  if (rung === 'send') {
    const full = guidanceFor(session, 2);
    return { ...(sendOnly(full) ?? full), countUp: false };
  }
  // The bottom rung lights what the line is about, never the answer: what
  // stands apart, the two to join, else the partners on the mat.
  const look = guidanceFor(session, 1);
  // (Past a way made that stands aside, the count is not what is off.)
  // (Past a way made that stands aside, the count is not what is off; on a
  // take-away from partners the partners light up instead, Phase 22.)
  const count = session.verdict.reason === 'count-mismatch' && !sameWayAgain(session) && !(session.whole.takeAway !== undefined && session.whole.onMat !== undefined) && session.puzzle.question.kind !== 'order';
  const objects = look.focus.objects.length > 0 || count ? look.focus.objects : benchPartners(session.history.state).map((g) => g.id);
  return { line: look.line, focus: { objects, template: look.focus.template }, countUp: count && session.history.state.bench.size > 0 };
}

// A big number on an empty mat (the 17 boss, Phase 20 Q3): after the task,
// "bring the biggest partner first", with the biggest one in the tray lit.
// Null where there is no partner to carry.
export function biggestFirst(session: LevelSession): Guidance | null {
  const q = session.puzzle.question;
  const state = session.history.state;
  if (q.kind !== 'quantity' || state.bench.size > 0) {
    return null;
  }
  const biggest = trayPartners(state).reduce<Group | null>((best, g) => (best === null || size(g) > size(best) ? g : best), null);
  return biggest === null ? null : { line: { key: copyKey('hint.biggest'), params: {} }, focus: { objects: [biggest.id], template: false } };
}

// The card the child sees. A right answer shows what comes next (the badge
// already shows what was built); asked-for help shows the line it said
// (`asked`, the help ladder's; else the whole help).
export function cardFor(session: LevelSession, helpLevel: 0 | 1 | 2, hasNext: boolean, asked?: Line): AnswerFeedback {
  const f = feedbackFor(session);
  if (f.tone === 'success') {
    return { ...f, detail: { key: copyKey(hasNext ? 'feedback.next' : 'feedback.done'), params: {} } };
  }
  if (helpLevel === 2 && asksForHelp(session, f)) {
    return { ...f, detail: asked ?? guidanceFor(session, 2).line };
  }
  return f;
}
