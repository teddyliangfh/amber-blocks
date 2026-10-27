import type { Bounds, GroupId, Question, ShapeTemplate } from '../core';
import { benchFor } from './bench';
import { findNode } from './catalog';
import { copyKey } from './copy';
import { assertDistractors, partnerSizesFor } from './distractors';
import { pickPair, pickTarget, pickTemplate } from './envelope';
import type { CopyKey } from './ids';
import { givenMaterial, handleMaterial, looseMaterial, onMatMaterial, partnerMaterial, partnerOrder, presetMaterial } from './material';
import { seeded } from './rng';
import type { NodeSpec, Puzzle, PuzzleRef, QuestionSpec } from './schema';
import { ALL_SIGNS, roundOf, roundOrder, signMaterial } from './sign';
import { buildSolution } from './solution';
import { validate } from './validate';

function promptFor(question: Question, spec: QuestionSpec): CopyKey {
  if (spec.kind === 'sum_composition' && spec.given !== undefined) {
    return copyKey('prompt.missing_part');
  }
  if (spec.kind === 'sum_composition' && spec.onMat !== undefined) {
    return copyKey('prompt.send_away');
  }
  // A Shape Island picture says what it is (Phase 23b); a picture in steps
  // keeps the plain line, as its pictures change.
  if (spec.kind === 'quantity_shape' && spec.picture !== undefined && spec.sequence !== true) {
    return copyKey(`prompt.picture.${spec.picture}`);
  }
  // Compare Island (Phase 23d): put a sign in the middle.
  if (spec.kind === 'sign') {
    return copyKey('prompt.sign');
  }
  // Take away (Phase 22) is judged as a quantity; its own task line says what to send home.
  if (spec.kind === 'take_away') {
    return copyKey(spec.onMat === undefined ? 'prompt.take_away' : 'prompt.take_away.partner');
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
  let onMat: ReadonlyArray<GroupId> | undefined;
  let takeAway: Puzzle['takeAway'];
  let sign: Puzzle['sign'];

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
      if (spec.onMat !== undefined) {
        // The partners on the mat start there, the distractors in the tray,
        // shuffled as usual (validate checks the row and the one pair left).
        assertDistractors(question, spec.distractors);
        const material = onMatMaterial(spec.onMat, partnerOrder(ref, spec.distractors), bounds, prefix);
        initial = material.state;
        partnerIds = material.partnerIds;
        onMat = material.onMat;
        break;
      }
      const material = partnerMaterial(partnerOrder(ref, partnerSizesFor(question, spec.distractors)), bounds, prefix);
      initial = material.state;
      partnerIds = material.partnerIds;
      break;
    }
    case 'split': {
      // The blocks start joined on the mat; the tray holds only their beds.
      question = { kind: 'split', total: spec.total, parts: spec.parts };
      initial = presetMaterial(spec.total, bounds, prefix);
      break;
    }
    case 'take_away': {
      // Judged as the count left. A countdown asks each count left in turn.
      if (spec.steps !== undefined && spec.steps.length > 0) {
        let left = spec.start;
        steps = spec.steps.map((k): Question => {
          left -= k;
          return { kind: 'quantity', target: left };
        });
        question = steps[0]!;
      } else {
        question = { kind: 'quantity', target: spec.start - spec.take };
      }
      if (spec.onMat !== undefined) {
        // The partners start on the mat in a row (validate checks they make the start).
        const material = onMatMaterial(spec.onMat, [], bounds, prefix);
        initial = material.state;
        partnerIds = material.partnerIds;
        onMat = material.onMat;
      } else {
        initial = presetMaterial(spec.start, bounds, prefix);
      }
      takeAway = { start: spec.start, take: spec.take };
      break;
    }
    case 'sign': {
      // The rounds in this visit's order; the material is the last one's two
      // sides on the mat, which is all the mat ever shows (see Puzzle.sign).
      const rounds = spec.rounds.map(roundOf);
      const played = roundOrder(ref, rounds).map((i) => rounds[i]!);
      const last = played[played.length - 1]!;
      initial = signMaterial(last, bounds, prefix);
      question = { kind: 'quantity', target: last.left.n + last.right.n };
      sign = { rounds: played, signs: spec.signs ?? ALL_SIGNS };
      break;
    }
  }
  const ways = spec.kind === 'sum_composition' || spec.kind === 'split' ? spec.ways : undefined;
  const picture = spec.kind === 'quantity_shape' ? spec.picture : undefined;
  const shadow = spec.kind === 'quantity_shape' ? spec.shadow : undefined;

  const puzzle: Puzzle = {
    ref,
    question,
    ...(steps === undefined ? {} : { steps }),
    ...(ways === undefined ? {} : { ways }),
    ...(given === undefined ? {} : { given }),
    ...(onMat === undefined ? {} : { onMat }),
    ...(takeAway === undefined ? {} : { takeAway }),
    ...(picture === undefined ? {} : { picture }),
    ...(shadow === undefined ? {} : { shadow }),
    ...(sign === undefined ? {} : { sign }),
    initial,
    display: {
      target: sign !== undefined ? null : question.kind === 'quantity' || question.kind === 'quantity_shape' ? question.target : question.kind === 'sum_composition' ? question.sum : question.kind === 'split' ? question.total : null,
      operands: question.kind === 'addition_exact' ? question.operands : null,
      template: question.kind === 'quantity_shape' ? question.template : null,
      partnerIds,
    },
    prompt: promptFor(question, spec),
    // A sign stop's mat is already the finished picture: nothing to do on it.
    solution: sign !== undefined ? [] : buildSolution(question, initial, steps, ways),
  };
  validate(puzzle, spec);
  return puzzle;
}

export function materialize(ref: PuzzleRef, recentTargets: ReadonlyArray<number> = []): Puzzle {
  const { chapter, node } = findNode(ref);
  return materializeNode(node, benchFor(chapter, node), ref, recentTargets);
}
