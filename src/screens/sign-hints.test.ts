import { format, roundOf } from '../content';
import type { QuestionSpec } from '../content';
import type { Line } from './hints';
import { PARTS_JOIN_ON_PASS, SAY_SYMBOL_NAMES, TAP_TO_PLACE, WRONG_SIGN, signFact, signHelp, signLabel, signPass, signRightCard, signStartCard, signTask, signWrongCard } from './sign-hints';

const zh = (l: Line) => format(l.key, 'zh', l.params);
const en = (l: Line) => format(l.key, 'en', l.params);

describe('Compare Island cards and help (Phase 23d, PRD §3.3, §3.4, §6)', () => {
  const more = roundOf({ left: 4, right: 1 });
  const fewer = roundOf({ left: 2, right: 5 });
  const same = roundOf({ left: { n: 3, parts: [2, 1] }, right: 3 });

  test('the defaults Ted took (PRD §11): names said, a wrong sign bounces home, a tap places, partners join', () => {
    expect([SAY_SYMBOL_NAMES, WRONG_SIGN, TAP_TO_PLACE, PARTS_JOIN_ON_PASS]).toEqual([true, 'bounce', true, true]);
  });

  test('the task, the facts and the names, in both languages', () => {
    expect(zh(signTask(more))).toBe('4 和 1，选一个符号');
    expect(en(signTask(more))).toBe('4 and 1. Pick a sign');
    expect([more, fewer, same].map((r) => zh(signFact(r)))).toEqual(['4 比 1 多', '2 比 5 少', '3 和 3 一样多']);
    expect([more, fewer, same].map((r) => zh(signPass(r)))).toEqual(['4 大于 1', '2 小于 5', '3 等于 3']);
    expect([more, fewer, same].map((r) => en(signPass(r)))).toEqual(['4 is greater than 1', '2 is less than 5', '3 equals 3']);
    // SAY_SYMBOL_NAMES false: the meaning instead.
    expect(zh(signPass(more, false))).toBe('4 比 1 多');
  });

  test('cards: the opening, a wrong sign (amber, a fact), a right one (next pair, or the host\'s line on the last)', () => {
    const start = signStartCard();
    expect([start.tone, zh(start.title), zh(start.detail)]).toEqual(['start', '动手试试看', '选一个符号放进中间']);
    const wrong = signWrongCard(fewer);
    expect([wrong.tone, zh(wrong.title), zh(wrong.detail)]).toEqual(['adjust', '2 比 5 少', '换一个符号试试']);
    const next = { key: 'feedback.next', params: {} } as unknown as Line;
    expect(zh(signRightCard(more, false, next).detail)).toBe('下一对！');
    expect(zh(signRightCard(more, true, next).detail)).toBe('可以去下一站啦');
  });

  test('help: 1 the round and the count-up; 2 the fact and the bigger side lit (both when the same); 3 the sign named, lit, the hand; never past 3', () => {
    const one = signHelp(more, 1, false);
    expect([one.card.tone, zh(one.card.title), one.countUp, one.spotlight, one.demo]).toEqual(['start', '4 和 1，选一个符号', true, [], false]);
    expect(signHelp(more, 1, true).card.tone).toBe('adjust');
    expect(signHelp(more, 2, false).spotlight).toEqual(['left']);
    expect(signHelp(fewer, 2, false).spotlight).toEqual(['right']);
    expect(signHelp(same, 2, false).spotlight).toEqual(['left', 'right']);
    const three = signHelp(fewer, 3, false);
    expect([zh(three.card.title), zh(three.card.detail), three.spotlight, three.demo]).toEqual(['2 比 5 少', '用小于号', ['<'], true]);
    expect(three.said.map(zh)).toEqual(['2 比 5 少', '用小于号']);
    expect(en(signHelp(same, 3, false).card.detail)).toBe('Use equals');
    expect(signHelp(more, 7, false).spotlight).toEqual(['>']);
  });

  test('map labels: the first round and its sign, coloured by the bigger number; or the signs in the tray', () => {
    const spec: Extract<QuestionSpec, { kind: 'sign' }> = { kind: 'sign', rounds: [{ left: { n: 12, parts: [6, 6], beside: true }, right: 10 }], signs: ['>', '<'] };
    expect(signLabel(spec, 'first-pair')).toEqual({ label: '12>10', number: 12 });
    expect(signLabel(spec, 'signs')).toEqual({ label: '><', number: 12 });
    expect(signLabel({ kind: 'sign', rounds: [{ left: 2, right: 2 }] }, 'signs')).toEqual({ label: '><=', number: 2 });
    expect(signLabel({ kind: 'sign', rounds: [] }, 'first-pair')).toEqual({ label: '1=1', number: 1 });
  });
});
