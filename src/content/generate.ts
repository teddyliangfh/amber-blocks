import type { Bounds, GroupId, Question, ShapeTemplate } from '../core';
import { benchFor } from './bench';
import { findNode } from './catalog';
import { copyKey } from './copy';
import { assertDistractors, partnerSizesFor } from './distractors';
import { pickPair, pickTarget, pickTemplate } from './envelope';
import type { CopyKey } from './ids';
import { givenMaterial, handleMaterial, looseMaterial, partnerMaterial, partnerOrder } from './material';
import { seeded } from './rng';
import type { NodeSpec, Puzzle, PuzzleRef, QuestionSpec } from './schema';
import { buildSolution } from './solution';
import { validate } from './validate';

function promptFor(question: Question, spec: QuestionSpec): CopyKey {
  if (spec.kind === 'sum_composition' && spec.given !== undefined) {
    return copyKey('prompt.missing_part');
  }
  return copyKey(`prompt.${question.kind}`);
}

// The puzzle for one stop, built from a node spec rather than the catalog so that
// tests can exercise specs the M2 map does not contain yet.
export function materializeNode(node: NodeSpec, bounds: Bounds, ref: PuzzleRef, recentTargets: ReadonlyArray<number> = []): Puzzle {
  const rng = seeded(ref);
  const prefix = `${ref.nodeId}-v${ref.attemptVariant}`;
  const spec = node.spec;
  let question: Question;
  let initial;
  let partnerIds: ReadonlyArray<GroupId> = [];
  let steps: ReadonlyArray<Question> | undefined;
  let given: GroupId | undefined;

  switch (spec.kind) {
    case 'quantity': {
      question = { kind: 'quantity', target: pickTarget(spec.targets, rng, recentTargets) };
      if (spec.handles !== undefined) {
        const material = handleMaterial(question.target, spec.handles, spec.extra, bounds, prefix, {
          decoys: spec.decoys ?? [],
          order: (sizes) => partnerOrder(ref, sizes),
        });
        initial = material.state;
        partnerIds = material.partnerIds;
      } else {
        initial = looseMaterial(question.target, spec.extra, bounds, prefix);
      }
      break;
    }
    case 'quantity_shape': {
      const shape = (template: ShapeTemplate): Question =>
        spec.symmetry === undefined ? { kind: 'quantity_shape', target: spec.target, template } : { kind: 'quantity_shape', target: spec.target, template, symmetry: spec.symmetry };
      if (spec.sequence === true) {
        steps = spec.templates.map(shape);
        question = steps[0]!;
      } else {
        question = shape(pickTemplate(spec.templates, rng));
      }
      if (spec.handles !== undefined) {
        const material = handleMaterial(spec.target, spec.handles, spec.extra, bounds, prefix, {
          decoys: spec.decoys ?? [],
          order: (sizes) => partnerOrder(ref, sizes),
        });
        initial = material.state;
        partnerIds = material.partnerIds;
      } else {
        initial = looseMaterial(spec.target, spec.extra, bounds, prefix);
      }
      break;
    }
    case 'addition_exact': {
      question = { kind: 'addition_exact', operands: pickPair(spec.pairs, rng) };
      const material = partnerMaterial(partnerOrder(ref, partnerSizesFor(question, spec.distractors)), bounds, prefix);
      initial = material.state;
      partnerIds = material.partnerIds;
      break;
    }
    case 'sum_composition': {
      question = { kind: 'sum_composition', sum: spec.sum, allowed: spec.allowed };
      if (spec.given !== undefined) {
        // The tray deals the missing half and the distractors, shuffled as
        // usual; the given partner starts on the mat (validate checks `allowed`).
        const missing = spec.sum - spec.given;
        if (!Number.isInteger(spec.given) || spec.given < 1 || missing < 1) {
          throw new Error(`content: a given partner of ${spec.given} leaves nothing to find for ${spec.sum}`);
        }
        assertDistractors(question, spec.distractors);
        const material = givenMaterial(spec.given, missing, partnerOrder(ref, [missing, ...spec.distractors]), bounds, prefix);
        initial = material.state;
        partnerIds = material.partnerIds;
        given = material.given;
        break;
      }
      const material = partnerMaterial(partnerOrder(ref, partnerSizesFor(question, spec.distractors)), bounds, prefix);
      initial = material.state;
      partnerIds = material.partnerIds;
      break;
    }
  }
  const ways = spec.kind === 'sum_composition' ? spec.ways : undefined;

  const puzzle: Puzzle = {
    ref,
    question,
    ...(steps === undefined ? {} : { steps }),
    ...(ways === undefined ? {} : { ways }),
    ...(given === undefined ? {} : { given }),
    initial,
    display: {
      target: question.kind === 'quantity' || question.kind === 'quantity_shape' ? question.target : question.kind === 'sum_composition' ? question.sum : null,
      operands: question.kind === 'addition_exact' ? question.operands : null,
      template: question.kind === 'quantity_shape' ? question.template : null,
      partnerIds,
    },
    prompt: promptFor(question, spec),
    solution: buildSolution(question, initial, steps, ways),
  };
  validate(puzzle, spec);
  return puzzle;
}

export function materialize(ref: PuzzleRef, recentTargets: ReadonlyArray<number> = []): Puzzle {
  const { chapter, node } = findNode(ref);
  return materializeNode(node, benchFor(chapter, node), ref, recentTargets);
}
