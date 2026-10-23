// Public surface of the math core. Everything else in this directory is internal.

export type { GroupId, QuestionId, UnitId } from './ids';
export { groupId, questionId, unitId, unitIds } from './ids';

export type { Bounds, Cell } from './grid';
export { cell } from './grid';

export type { BenchState, Group, Hue, TraySlot, Unit } from './inventory';

export type { CreateBenchStateInput } from './state';
export { assertInvariants, assertSameMaterial, benchCount, createBenchState } from './state';

export type { Command, History, RejectReason, Result } from './commands';
export { MAX_UNDO, alignedShape, apply, commit, createHistory, move, moveGroup, returnGroup, returnUnit, take, takeGroup, undo } from './commands';

export { areTouching, defineGroup, groupCells, groupSize, mergedGroup } from './groups';

export type { Cluster } from './clusters';
export { clusterOf, clusters } from './clusters';

export type { ShapeTemplate, Symmetry } from './shapes';
export { DEFAULT_SYMMETRY, matchesTemplate, mirrorX, rotate90, template, variants } from './shapes';

export type { CompareRelation, Question, Verdict, VerdictReason } from './judge';
export { compares, judge } from './judge';

export type { CountRound } from './counting';
export { countUnit, fingerprintOf, isRoundValid, reconcile, startRound } from './counting';
