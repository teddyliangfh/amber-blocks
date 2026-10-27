import type { Bounds, ShapeTemplate } from '../core';
import { fitBench } from './bench';
import { CHAPTERS, CONTENT_VERSION } from './catalog';
import { materializeNode } from './generate';
import { chapterId, nodeId } from './ids';
import type { NodeId } from './ids';
import { handlesFor } from './material';
import { fnv1a, mulberry32 } from './rng';
import type { Rng } from './rng';
import type { Puzzle, QuestionSpec } from './schema';

// Free play's random puzzle (Phase 21): a number to make, a sum or a shape,
// none bigger than what the child has already played. Pure: the screen hands
// in the seed (nothing here draws its own randomness) and keeps nothing; the
// puzzle is dealt and checked like any stop's (materializeNode, validate).

export type ChallengeKind = 'quantity' | 'quantity_shape' | 'addition_exact';

export interface Challenge {
  readonly kind: ChallengeKind;
  // What it is about: the count to make, the shape's blocks, the sum.
  readonly n: number;
  readonly spec: QuestionSpec;
  readonly puzzle: Puzzle;
}

// How random puzzles follow progress. Defaults for Ted, one knob each:
export const CHALLENGE_RULES = {
  // The biggest number: the biggest of a finished stop (a number's target, a
  // shape's blocks, a sum), and never under this, which is also the cap with
  // nothing finished.
  startCap: 3,
  // Shapes once this stop is finished (the first shape, the square), and only
  // the pictures of finished shape stops.
  shapesAfter: nodeId('ch1-n3'),
  // Sums once this stop is finished (1 + 1), totals up to this (and the cap).
  sumsAfter: nodeId('ch2-n1'),
  sumMax: 10,
  // A number bigger than this comes as partners to carry (handlesFor) with
  // one decoy, as on Number Island: no puzzle asks for more single blocks.
  maxSingles: 6,
  // Spare single blocks beside every number, so emptying the tray is never the answer.
  extra: 2,
  // Distractor sizes to pick from (never one the answer uses); a number's
  // decoy partner is one of them too, 2 or more.
  spares: [1, 2, 3, 4, 5],
} as const;

// A random puzzle from a Shape Island stop has the shadow the stop had (PRD
// §4.2.6): 'as-stop'; 'never' leaves every random picture without one. A
// default for Ted.
export const CHALLENGE_SHADOW: 'as-stop' | 'never' = 'as-stop';

// The number a stop is about.
function numberOf(spec: QuestionSpec): number {
  switch (spec.kind) {
    case 'quantity':
      return Math.max(...spec.targets);
    case 'quantity_shape':
      return spec.target;
    case 'addition_exact':
      return Math.max(...spec.pairs.map(([a, b]) => a + b));
    case 'sum_composition':
      return spec.sum;
    // Take-away Island (Phase 22): the whole that is split, or the start.
    // Random puzzles do not ask these kinds yet (design §4.6).
    case 'split':
      return spec.total;
    case 'take_away':
      return spec.start;
    // Compare Island (Phase 23d): the biggest number it shows. Random puzzles
    // do not ask signs (PRD §10).
    case 'sign':
      return Math.max(...spec.rounds.flatMap((r) => [r.left, r.right].map((s) => (typeof s === 'number' ? s : s.n))));
  }
}

function finished(done: ReadonlySet<NodeId>) {
  return CHAPTERS.flatMap((c) => c.nodes).filter((n) => done.has(n.id));
}

// The biggest number a random puzzle may ask for.
export function challengeCap(done: ReadonlySet<NodeId>): number {
  return Math.max(CHALLENGE_RULES.startCap, ...finished(done).map((n) => numberOf(n.spec)));
}

interface Candidate {
  readonly kind: ChallengeKind;
  readonly n: number;
  // The spec, given the rng for any decoy or distractor still to pick.
  readonly spec: (rng: Rng) => QuestionSpec;
  // The stop's own mat where it fixes one (Phase 23a: the standing ten's
  // 6 × 5, which fitted would be 6 × 6); else the fitted one.
  readonly bounds?: Bounds;
}

function numbers(cap: number): ReadonlyArray<Candidate> {
  return Array.from({ length: cap }, (_, i) => i + 1).map((n) => ({
    kind: 'quantity' as const,
    n,
    spec: (rng: Rng): QuestionSpec => {
      if (n <= CHALLENGE_RULES.maxSingles) {
        return { kind: 'quantity', targets: [n], extra: CHALLENGE_RULES.extra };
      }
      const handles = handlesFor(n);
      const decoy = rng.pick(CHALLENGE_RULES.spares.filter((d) => !handles.includes(d) && d !== 1));
      return { kind: 'quantity', targets: [n], extra: CHALLENGE_RULES.extra, handles, decoys: [decoy] };
    },
  }));
}

// Every picture of a finished shape stop, as that stop asked it (its partners
// and decoys too), one picture a puzzle; each picture once.
function shapes(done: ReadonlySet<NodeId>, cap: number): ReadonlyArray<Candidate> {
  const seen = new Set<ShapeTemplate>();
  const out: Candidate[] = [];
  for (const node of finished(done)) {
    const s = node.spec;
    if (s.kind !== 'quantity_shape' || s.target > cap) {
      continue;
    }
    for (const template of s.templates.filter((t) => !seen.has(t))) {
      seen.add(template);
      const picture = s.sequence === true && template !== s.templates[s.templates.length - 1] ? undefined : s.picture;
      const spec: QuestionSpec = {
        kind: 'quantity_shape',
        target: s.target,
        templates: [template],
        extra: s.extra,
        ...(s.symmetry === undefined ? {} : { symmetry: s.symmetry }),
        ...(s.handles === undefined ? {} : { handles: s.handles, decoys: s.decoys ?? [] }),
        // A Shape Island picture keeps its name, its move and its shadow
        // (Phase 23b, PRD §4.2.6, CHALLENGE_SHADOW). Of a picture in steps,
        // only the last picture is the stop's: the corner before the boat is
        // a plain shape here, as the three faces of 4 are.
        ...(picture === undefined ? {} : { picture }),
        ...(picture === undefined || s.shadow === undefined || CHALLENGE_SHADOW === 'never' ? {} : { shadow: s.shadow }),
      };
      out.push({ kind: 'quantity_shape', n: s.target, spec: () => spec, ...(node.bounds === undefined ? {} : { bounds: node.bounds }) });
    }
  }
  return out;
}

function sums(cap: number): ReadonlyArray<Candidate> {
  const top = Math.min(cap, CHALLENGE_RULES.sumMax);
  const out: Candidate[] = [];
  for (let a = 1; a < top; a += 1) {
    for (let b = 1; a + b <= top; b += 1) {
      out.push({
        kind: 'addition_exact',
        n: a + b,
        spec: (rng) => ({ kind: 'addition_exact', pairs: [[a, b]], distractors: [rng.pick(CHALLENGE_RULES.spares.filter((d) => d !== a && d !== b))] }),
      });
    }
  }
  return out;
}

// A random puzzle for a child who has finished `done`, from `seed`; never the
// same kind with the same number as `previous`. A kind is picked first (each
// one open to the child equally likely), then one of its puzzles.
export function nextChallenge(done: ReadonlySet<NodeId>, seed: number, previous: Challenge | null = null): Challenge {
  const rng = mulberry32(fnv1a(`challenge|${seed >>> 0}`));
  const cap = challengeCap(done);
  const fresh = (list: ReadonlyArray<Candidate>) => list.filter((c) => previous === null || c.kind !== previous.kind || c.n !== previous.n);
  const kinds = [
    fresh(numbers(cap)),
    done.has(CHALLENGE_RULES.shapesAfter) ? fresh(shapes(done, cap)) : [],
    done.has(CHALLENGE_RULES.sumsAfter) ? fresh(sums(cap)) : [],
  ].filter((list) => list.length > 0);
  const pick = rng.pick(rng.pick(kinds));
  const spec = pick.spec(rng);
  const id = nodeId(`challenge-${pick.kind}-${pick.n}`);
  const puzzle = materializeNode({ id, role: 'normal', spec }, pick.bounds ?? fitBench(spec), { contentVersion: CONTENT_VERSION, chapterId: chapterId('challenge'), nodeId: id, attemptVariant: 0, seed: seed >>> 0 });
  return { kind: pick.kind, n: pick.n, spec, puzzle };
}
