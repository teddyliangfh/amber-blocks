// Public surface of the content module. Everything else in this directory is internal.

export type { ChapterId, CopyKey, NodeId } from './ids';
export { chapterId, nodeId } from './ids';

export type { Chapter, NodeSpec, Puzzle, PuzzleDisplay, PuzzleRef, QuestionSpec } from './schema';

export { CHAPTERS, CONTENT_CHANGES, CONTENT_VERSION, COUNT_TO_PASS, findChapter, findNode } from './catalog';

export { materialize, materializeNode } from './generate';
export { validate } from './validate';

export type { Pair } from './steps';
export { benchPair, questionAt, samePair, stepCount } from './steps';

export type { CopyEntry, FormatOptions, Lang } from './copy';
export { COPY, MAX_NUMBER_WORD, copyKey, format, numberWord } from './copy';

export { bodyOf, handlesFor, hueFor } from './material';

export { BENCH_MARGIN, MIN_BENCH, benchFor, fitBench } from './bench';

export { SANDBOX, sandboxMaterial } from './sandbox';
