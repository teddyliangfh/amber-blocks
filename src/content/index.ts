// Public surface of the content module. Everything else in this directory is internal.

export type { ChapterId, CopyKey, NodeId } from './ids';
export { chapterId, nodeId } from './ids';

export type { Chapter, NodeSpec, PictureId, Puzzle, PuzzleDisplay, PuzzleRef, QuestionSpec, ShadowSpec } from './schema';

export { BOSS_ENTRANCE, CHAPTERS, CONTENT_CHANGES, CONTENT_VERSION, COUNT_TO_PASS, ISLAND_SHOWCASE, SHAPE_ISLAND_GATE, SHAPE_ISLAND_POSITION, SIDE_ISLANDS, findChapter, findNode } from './catalog';

export { materialize, materializeNode } from './generate';
export { validate } from './validate';

export type { Pair } from './steps';
export { benchPair, questionAt, samePair, stepCount } from './steps';

export type { CopyEntry, FormatOptions, Lang } from './copy';
export { COPY, MAX_NUMBER_WORD, copyKey, format, numberWord } from './copy';

export { bodyOf, handlesFor, hueFor } from './material';

export { BENCH_MARGIN, COMPARE_ROWS, MIN_BENCH, benchFor, fitBench } from './bench';

export { SANDBOX, sandboxMaterial } from './sandbox';

export type { Challenge, ChallengeKind } from './challenge';
export { CHALLENGE_RULES, CHALLENGE_SHADOW, challengeCap, nextChallenge } from './challenge';
