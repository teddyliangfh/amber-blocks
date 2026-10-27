import type { BenchState, Bounds, Command, GroupId, Question, ShapeTemplate, Sign, Symmetry } from '../core';
import type { ChapterId, CopyKey, NodeId } from './ids';

export interface Chapter {
  readonly id: ChapterId;
  readonly title: CopyKey;
  // A fixed bench for every node in the chapter. Left out, each stop gets a
  // mat fitted to its own material (bench.ts fitBench, 2026-10-15).
  readonly bounds?: Bounds;
  // Map order.
  readonly nodes: ReadonlyArray<NodeSpec>;
}

export interface NodeSpec {
  readonly id: NodeId;
  readonly role: 'normal' | 'boss';
  readonly spec: QuestionSpec;
  // A fixed bench for this stop, over the chapter's and the fitted one.
  readonly bounds?: Bounds;
}

// A node describes the questions it may pose, not one fixed question. In M2
// every pool has a single entry, so the map is fixed while the schema is not.
export type QuestionSpec =
  | {
      readonly kind: 'quantity';
      readonly targets: ReadonlyArray<number>;
      // Spare units in the tray beyond the target, so that emptying the tray is
      // never automatically the answer. Must be at least 1.
      readonly extra: number;
      // Big numbers come as a few partners to carry instead of many single blocks
      // (17 = 10 + 5 + 2, AC-46). Sizes add up to the target, or to less and
      // single blocks make up the rest (5 = a 3 + two singles, 2026-10-15);
      // only for a single-target pool.
      readonly handles?: ReadonlyArray<number>;
      // Partners dealt alongside the handles that the reference answer does not
      // use, so carrying every partner over is never the answer and the child
      // has to choose (2026-10-14 play test). Required when the handles alone
      // make the target.
      readonly decoys?: ReadonlyArray<number>;
    }
  | {
      readonly kind: 'quantity_shape';
      readonly target: number;
      readonly templates: ReadonlyArray<ShapeTemplate>;
      readonly symmetry?: Symmetry;
      readonly extra: number;
      // The shape built from partners (8 brick = 4 + 4, 2026-10-15). Sizes add
      // up to the target; decoys as for quantity.
      readonly handles?: ReadonlyArray<number>;
      readonly decoys?: ReadonlyArray<number>;
      // Every template in order, on the same blocks, instead of one picked at
      // random: "the same 4, a new shape" (2026-10-15). Each step must be built;
      // the stop is solved when the last one is.
      readonly sequence?: boolean;
      // Shape Island (Phase 23b, PRD §4.2): what the picture is (its name in
      // the task and the success line, its own move when solved) and its
      // shadow on the mat (ShadowSpec). Old shape stops have neither.
      readonly picture?: PictureId;
      readonly shadow?: ShadowSpec;
    }
  | {
      readonly kind: 'addition_exact';
      readonly pairs: ReadonlyArray<readonly [number, number]>;
      // Sizes of partners that are in the tray but not part of the answer.
      readonly distractors: ReadonlyArray<number>;
    }
  | {
      readonly kind: 'sum_composition';
      readonly sum: number;
      readonly allowed: ReadonlyArray<readonly [number, number]>;
      readonly distractors: ReadonlyArray<number>;
      // "Who's missing?" (Phase 19): a partner of this size is already on the
      // mat when the stop opens, and it is part of the answer; the child finds
      // the other half. `allowed` is then exactly [[given, sum - given]].
      readonly given?: number;
      // "Two ways to make 7" (Phase 19): the stop is asked this many times on
      // the same tray, each time accepting any allowed pair not used yet; it is
      // solved once every way has been built. 1 when left out.
      readonly ways?: number;
      // "Send the extra away" (Phase 21): partners of these sizes are already
      // on the mat when the stop opens, joined in one row from the left, and
      // they make more than the sum. The child sends back what is too many.
      // `allowed` is then the one pair left, side by side in the row.
      readonly onMat?: ReadonlyArray<number>;
    }
  // Pull a number apart (Phase 22, Take-away Island): `total` single blocks
  // start joined in one row on the mat and the tray holds only their empty
  // beds; the child pulls them into `parts` piles (two, this round), any
  // sizes. `ways`: asked this many times on the same blocks, each time a split
  // not made yet (part sizes as a multiset: 1 + 4 and 4 + 1 are one). 1 when
  // left out.
  | {
      readonly kind: 'split';
      readonly total: number;
      readonly parts: number;
      readonly ways?: number;
    }
  // Take away (Phase 22): `start` blocks start on the mat and the tray holds
  // only their empty beds; the child sends `take` of them home. Judged as a
  // plain quantity of `start − take`: the subtraction is in the opening
  // material and in the cloud's notation, not in the judge (design §2.2).
  // `onMat`: the start dealt as partners of these sizes, joined in a row, so
  // the child picks which partner goes (6 − 2 from a 4 and a 2). `steps`: taken
  // in these amounts one step at a time, the count left after each being a
  // step (the countdown boss: 5, steps [1, 1, 1, 1]); they add up to `take`.
  | {
      readonly kind: 'take_away';
      readonly start: number;
      readonly take: number;
      readonly onMat?: ReadonlyArray<number>;
      readonly steps?: ReadonlyArray<number>;
    }
  // Compare Island (Phase 23d, D-129): rounds of two numbers, each with its
  // own blocks to look at and count, and a slot between them for a sign. The
  // child answers each round with a sign block (signOf, never the mat); the
  // last right sign finishes the stop. `signs`: the sign blocks in the tray
  // (all three when left out).
  | {
      readonly kind: 'sign';
      readonly rounds: ReadonlyArray<SignRoundSpec>;
      readonly signs?: ReadonlyArray<Sign>;
    };

// One side of a round: a number (a tower), or a number laid out another way
// (`layout`), or made of partners (`parts`, adding up to `n`), stacked into
// one tower or standing side by side (`beside`). sign.ts draws them.
export type SignLayout = 'tower' | 'row' | 'square';
export type SignSide = number | { readonly n: number; readonly layout?: SignLayout; readonly parts?: ReadonlyArray<number>; readonly beside?: boolean };
export interface SignRoundSpec {
  readonly left: SignSide;
  readonly right: SignSide;
}

// The same, read once (sign.ts roundOf): every side spelled out, and the sign that fits.
export interface SignSideView {
  readonly n: number;
  readonly layout: SignLayout;
  readonly parts: ReadonlyArray<number> | null;
  readonly beside: boolean;
}
export interface SignRound {
  readonly left: SignSideView;
  readonly right: SignSideView;
  readonly answer: Sign;
}

// The pictures Shape Island names (copy `picture.<id>`).
export type PictureId = 'mushroom' | 'duck' | 'tree' | 'boat' | 'house' | 'corner' | 'dog' | 'rocket';

// A picture's shadow on the mat (PRD §4.2.3, SHADOW_POLICY): there from the
// start ('always'), or only once help is asked for that many times on the
// empty mat. Scenery: never judged, nothing snaps to it.
export type ShadowSpec = 'always' | { readonly onHelp: 1 | 2 };

export interface PuzzleRef {
  readonly contentVersion: number;
  readonly chapterId: ChapterId;
  readonly nodeId: NodeId;
  // 0 on first entry. Only an explicit "play a new one" bumps it.
  readonly attemptVariant: number;
  // Device-level, generated once by `progress` and stored.
  readonly seed: number;
}

export interface PuzzleDisplay {
  // The big number on screen; null for addition, which shows the operands.
  readonly target: number | null;
  readonly operands: readonly [number, number] | null;
  // Shape reference for the small preview and the large outline.
  readonly template: ShapeTemplate | null;
  // Tray partners in shuffled display order. Their number label is groupSize().
  readonly partnerIds: ReadonlyArray<GroupId>;
}

export interface Puzzle {
  readonly ref: PuzzleRef;
  // The question, or the first of several steps.
  readonly question: Question;
  // A stop asked in steps on the same blocks (a sequence spec); absent for one question.
  readonly steps?: ReadonlyArray<Question>;
  // A stop asked several ways (a sum with `ways`): how many different allowed
  // pairs it takes. Which pairs the earlier steps used is the level's to track.
  readonly ways?: number;
  // The partner already on the mat at the start (a sum with `given`). It keeps
  // its home slot in the tray, so taking it back is always possible.
  readonly given?: GroupId;
  // The partners already on the mat at the start, left to right (a sum with
  // `onMat`, or a take-away from partners). Each keeps its home slot in the
  // tray, so any can go back.
  readonly onMat?: ReadonlyArray<GroupId>;
  // A take-away stop (Phase 22): how many it starts with on the mat and how
  // many go home in all. The question itself is the count left; a countdown's
  // steps are the counts left after each block goes.
  readonly takeAway?: { readonly start: number; readonly take: number };
  // A Shape Island picture and its shadow (Phase 23b), from the spec.
  readonly picture?: PictureId;
  readonly shadow?: ShadowSpec;
  // A Compare Island stop (Phase 23d): its rounds in the order this visit asks
  // them, and the sign blocks in the tray. The material is then the last
  // round's two sides already on the mat (the finished picture, saved as the
  // work), and `question` asks for exactly those blocks on the mat, so the
  // picture is always right: the rounds are judged by their signs instead.
  readonly sign?: { readonly rounds: ReadonlyArray<SignRound>; readonly signs: ReadonlyArray<Sign> };
  // All material, in the tray except a given partner, the partners on the mat
  // or a take-away / split stop's blocks (all on the mat); partners already defined with their shapes.
  readonly initial: BenchState;
  readonly display: PuzzleDisplay;
  readonly prompt: CopyKey;
  // A reference solution in core commands. Used by validate(); never shown.
  readonly solution: ReadonlyArray<Command>;
}
