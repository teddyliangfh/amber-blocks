import { apply, judge } from '../core';
import type { BenchState } from '../core';
import { CHAPTERS, CONTENT_VERSION, materialize, validate } from './index';
import type { PuzzleRef } from './index';

// The M2 map, start to finish, through the public API: every stop materializes,
// its reference solution replays through the core, and the judge agrees.
describe('M2 map via the public API', () => {
  const refs: PuzzleRef[] = CHAPTERS.flatMap((chapter) =>
    chapter.nodes.map((node) => ({ contentVersion: CONTENT_VERSION, chapterId: chapter.id, nodeId: node.id, attemptVariant: 0, seed: 2026 })),
  );

  test('fifty-six stops (Phase 23d: Compare Island\'s ten for the old eight), eleven of them bosses', () => {
    expect(refs).toHaveLength(56);
    expect(CHAPTERS.flatMap((c) => c.nodes).filter((n) => n.role === 'boss')).toHaveLength(11);
  });

  test('every stop at variants 0 to 4 validates and its solution passes the judge', () => {
    for (const base of refs) {
      for (let attemptVariant = 0; attemptVariant < 5; attemptVariant += 1) {
        const ref = { ...base, attemptVariant };
        const puzzle = materialize(ref);
        const { node } = CHAPTERS.flatMap((c) => c.nodes.map((n) => ({ node: n }))).find(({ node: n }) => n.id === ref.nodeId)!;
        expect(() => validate(puzzle, node.spec)).not.toThrow();
        const final = puzzle.solution.reduce<BenchState>((s, cmd) => {
          const r = apply(s, cmd);
          if (!r.ok) {
            throw new Error(`${ref.nodeId} v${attemptVariant}: ${cmd.type} ${r.reason}`);
          }
          return r.value;
        }, puzzle.initial);
        // A stop asked in steps is solved by its last step.
        const steps = puzzle.steps ?? [puzzle.question];
        expect(judge(final, steps[steps.length - 1]!).matched).toBe(true);
      }
    }
  });
});
