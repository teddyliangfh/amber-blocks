import type { BenchState, Bounds, Command, GroupId, Question, ShapeTemplate, Symmetry } from '../core';
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
    };

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
  // All material, in the tray except a given partner; partners already defined with their shapes.
  readonly initial: BenchState;
  readonly display: PuzzleDisplay;
  readonly prompt: CopyKey;
  // A reference solution in core commands. Used by validate(); never shown.
  readonly solution: ReadonlyArray<Command>;
}
