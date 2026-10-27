import { copyKey } from '../content';
import type { QuestionSpec, SignRound } from '../content';
import type { Sign } from '../core';
import type { AnswerFeedback, Line } from './hints';

// Compare Island (Phase 23d, PRD §3 – §6): what the card says and what help
// points at, round by round. Pure, like hints.ts; SignPlay plays it.

// The open choices (PRD §11), each a default for Ted:
// The right sign said by its name ("4 大于 1", Ted: she knows the signs);
// false says what it means instead ("4 比 1 多"). (#3)
export const SAY_SYMBOL_NAMES = true;
// A wrong sign shakes its head and floats back to the tray ('bounce'); 'stay'
// leaves it in the slot for the child to take out. (#4)
export const WRONG_SIGN: 'bounce' | 'stay' = 'bounce';
// Tapping a sign block flies it into the slot, for hands that cannot drag it
// there yet (PRD §1.3, D-129: the one exception to "move by dragging"). (#5)
export const TAP_TO_PLACE = true;
// A side made of partners turns into its number once the round is right (the
// 2 and the 1 become a yellow 3, as on Join Island). Proposed in the 23d
// design; Ted took the designer's call. false keeps the partners as they were.
export const PARTS_JOIN_ON_PASS = true;

const line = (key: string, params: Readonly<Record<string, number>> = {}): Line => ({ key: copyKey(key), params });

const NAME = { '>': 'gt', '<': 'lt', '=': 'eq' } as const;
const FACT = { '>': 'more', '<': 'fewer', '=': 'same' } as const;

function pair(round: SignRound): Record<string, number> {
  return { a: round.left.n, b: round.right.n };
}

// "4 和 1，选一个符号": the round asked (the cloud, and help's first step).
export function signTask(round: SignRound): Line {
  return line('prompt.sign.pair', pair(round));
}

// "4 比 1 多" / "3 和 3 一样多" / "2 比 5 少": a fact, never "wrong".
export function signFact(round: SignRound): Line {
  return line(`feedback.sign.${FACT[round.answer]}`, pair(round));
}

// The right sign said aloud and on the card (SAY_SYMBOL_NAMES).
export function signPass(round: SignRound, names: boolean = SAY_SYMBOL_NAMES): Line {
  return names ? line(`feedback.matched.sign.${NAME[round.answer]}`, pair(round)) : signFact(round);
}

export function signStartCard(): AnswerFeedback {
  return { tone: 'start', title: line('feedback.start'), detail: line('prompt.sign') };
}

// A wrong sign: the fact about the two numbers, and "try another sign".
export function signWrongCard(round: SignRound): AnswerFeedback {
  return { tone: 'adjust', title: signFact(round), detail: line('hint.sign.try') };
}

// A right sign: its name; under it "next pair!", or the host's line on the last round.
export function signRightCard(round: SignRound, last: boolean, next: Line): AnswerFeedback {
  return { tone: 'success', title: signPass(round), detail: last ? next : line('feedback.sign.next') };
}

export interface SignHelp {
  readonly card: AnswerFeedback;
  // Said in order when it is asked for.
  readonly said: ReadonlyArray<Line>;
  // The blocks numbered one by one, the left side's then the right side's.
  readonly countUp: boolean;
  // What lights up: a side ('left' / 'right') or a sign block.
  readonly spotlight: ReadonlyArray<'left' | 'right' | Sign>;
  // The hand carries the right sign into the slot.
  readonly demo: boolean;
}

// The three steps of help (PRD §3.3, as D-076): 1 says the round again and
// numbers both sides' blocks; 2 says which side has more and lights it (both
// when they are the same); 3 says it and names the sign, lights the sign and
// the hand carries it in. Asked again after 3, 3 again. The tone stays amber
// once the round has had a wrong sign.
export function signHelp(round: SignRound, asked: number, wrongBefore: boolean): SignHelp {
  const tone = wrongBefore ? 'adjust' : 'start';
  if (asked <= 1) {
    return { card: { tone, title: signTask(round), detail: line('prompt.sign') }, said: [signTask(round)], countUp: true, spotlight: [], demo: false };
  }
  const more = round.answer === '=' ? (['left', 'right'] as const) : round.answer === '>' ? (['left'] as const) : (['right'] as const);
  if (asked === 2) {
    return { card: { tone: 'adjust', title: signFact(round), detail: line('prompt.sign') }, said: [signFact(round)], countUp: false, spotlight: more, demo: false };
  }
  const use = line(`hint.sign.use.${NAME[round.answer]}`);
  return { card: { tone: 'adjust', title: signFact(round), detail: use }, said: [signFact(round), use], countUp: false, spotlight: [round.answer], demo: true };
}

// The map's label for a sign stop (PRD §5.4, MAP_SIGN_LABEL): the first round
// and its sign ("4>1"), coloured by its bigger number; or the signs the stop's
// tray holds ("><=").
export function signLabel(spec: Extract<QuestionSpec, { kind: 'sign' }>, how: 'first-pair' | 'signs'): { readonly label: string; readonly number: number } {
  const [first] = spec.rounds;
  const n = (s: (typeof spec.rounds)[number]['left']) => (typeof s === 'number' ? s : s.n);
  const a = first === undefined ? 1 : n(first.left);
  const b = first === undefined ? 1 : n(first.right);
  const sign: Sign = a > b ? '>' : a < b ? '<' : '=';
  return how === 'signs' ? { label: (spec.signs ?? ['>', '<', '=']).join(''), number: Math.max(a, b) } : { label: `${a}${sign}${b}`, number: Math.max(a, b) };
}
