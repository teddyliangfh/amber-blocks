import type { CopyKey } from './ids';

// The single source of every child-facing sentence, in both languages. Build-time
// TTS reads this table; the UI formats it at runtime. One key, one meaning (AC-17).

export type Lang = 'zh' | 'en';

export interface CopyEntry {
  readonly zh: string;
  readonly en: string;
  // Placeholder names that must appear as {name} in both texts.
  readonly params: ReadonlyArray<string>;
}

const NUMBER_WORDS_ZH = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七'] as const;
const NUMBER_WORDS_EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen'] as const;

export const MAX_NUMBER_WORD = NUMBER_WORDS_ZH.length - 1;

function numberEntries(): Record<string, CopyEntry> {
  const out: Record<string, CopyEntry> = {};
  for (let n = 1; n <= MAX_NUMBER_WORD; n += 1) {
    out[`number.${n}`] = { zh: NUMBER_WORDS_ZH[n] as string, en: NUMBER_WORDS_EN[n] as string, params: [] };
  }
  return out;
}

export const COPY: Readonly<Record<string, CopyEntry>> = {
  'chapter.ch1.title': { zh: '数字岛', en: 'Number Island', params: [] },
  'chapter.ch2.title': { zh: '合体岛', en: 'Join Island', params: [] },

  'prompt.quantity': { zh: '拼出 {n} 块', en: 'Make {n}', params: ['n'] },
  'prompt.quantity_shape': { zh: '用 {n} 块拼成这个样子', en: 'Build this with {n}', params: ['n'] },
  'prompt.addition_exact': { zh: '把 {a} 和 {b} 合起来', en: 'Put {a} and {b} together', params: ['a', 'b'] },
  // The judge accepts two partners from the stop's allowed pairs, so the prompt promises exactly that.
  'prompt.sum_composition': { zh: '找两个伙伴，拼出 {n}', en: 'Find two partners that make {n}', params: ['n'] },
  // A partner is already on the mat (Phase 19 "who's missing?"): find the other half.
  'prompt.missing_part': { zh: '已经有 {a} 了，再找一个伙伴，拼成 {n}', en: 'Here is {a}. Find one more partner to make {n}', params: ['a', 'n'] },

  'feedback.matched.quantity': { zh: '{n}，就是 {n} 块', en: '{n}. {n} blocks', params: ['n'] },
  'feedback.matched.shape': { zh: '拼好了，{n} 块', en: 'Done. {n} blocks', params: ['n'] },
  'feedback.matched.addition': { zh: '{a} 加 {b}，一共 {n}', en: '{a} plus {b} makes {n}', params: ['a', 'b', 'n'] },
  'feedback.start': { zh: '动手试试看', en: 'Give it a try', params: [] },
  'feedback.success': { zh: '拼对啦！', en: 'You did it!', params: [] },
  'feedback.fewer': { zh: '还差 {n} 块', en: '{n} more blocks to go', params: ['n'] },
  'feedback.fewer.one': { zh: '还差 {n} 块', en: '{n} more block to go', params: ['n'] },
  'feedback.more': { zh: '多了 {n} 块', en: '{n} blocks too many', params: ['n'] },
  'feedback.more.one': { zh: '多了 {n} 块', en: '{n} block too many', params: ['n'] },
  'feedback.shape': { zh: '数量对了，再看看形状', en: 'Right count. Now the shape', params: [] },
  // A stop in steps: one picture made, the same blocks now make the next.
  'feedback.change': { zh: '变个样子！', en: 'Now a new shape!', params: [] },
  // A sum asked two ways (Phase 19): one way made, the mat still shows it.
  'feedback.another': { zh: '换一种拼法！', en: 'Another way!', params: [] },
  // Short of the sum on a stop that starts with a partner on the mat: how many
  // blocks are missing is the answer itself, so the title does not say (Phase 19).
  'feedback.notyet': { zh: '还不到 {n}', en: 'Not {n} yet', params: ['n'] },
  'feedback.join': { zh: '数量对了，再接起来', en: 'Right count. Now join up', params: [] },
  // Card titles stay short: one line on a 375px phone in either language.
  'feedback.partners': { zh: '数量够了，再找对伙伴', en: 'Right count. Swap partners', params: [] },
  'feedback.swap': { zh: '换个伙伴试试看', en: 'Try a different partner', params: [] },
  // Short of the target, and nothing left in the tray adds up to the gap.
  'feedback.stuck': { zh: '这样拼不到 {n}', en: "Can't make {n} this way", params: ['n'] },
  'feedback.listen': { zh: '听提示', en: 'Hear the hint', params: [] },
  // A right answer: the badge already shows what was built, so the card says what comes next.
  'feedback.next': { zh: '可以去下一站啦', en: 'On to the next stop', params: [] },
  'feedback.done': { zh: '回地图看看吧', en: 'Head back to the map', params: [] },

  // Hints name only moves the child can make with what is in front of them:
  // single blocks for loose material, whole partners for partner material.
  'hint.count-mismatch.fewer': { zh: '还不到 {n}，再拿一块', en: 'Not {n} yet. Take one more', params: ['n'] },
  'hint.count-mismatch.more': { zh: '比 {n} 多了，放回一块', en: 'More than {n}. Put one back', params: ['n'] },
  'hint.fewer.partner': { zh: '还不到 {n}，再搬一个伙伴过来', en: 'Not {n} yet. Bring another partner', params: ['n'] },
  'hint.more.partner': { zh: '比 {n} 多了，把一个伙伴送回去', en: 'More than {n}. Send a partner back', params: ['n'] },
  'hint.swap.partner': { zh: '还不到 {n}，换一个伙伴试试', en: 'Not {n} yet. Try a different partner', params: ['n'] },
  'hint.stuck.block': { zh: '先放回一些，再把伙伴搬过来', en: 'Put some back, then bring a partner', params: [] },
  'hint.sum-pair': { zh: '找两个伙伴，拼出 {n}', en: 'Find two partners that make {n}', params: ['n'] },
  'hint.another-way': { zh: '再用另外两个伙伴拼出 {n}', en: 'Make {n} with two other partners', params: ['n'] },
  // Said while the stray blocks / the little shape picture light up.
  'hint.not-one-cluster': { zh: '把分开的积木推到一起', en: 'Push the blocks together', params: [] },
  'hint.shape-mismatch': { zh: '照着小图摆一摆', en: 'Build it like the little picture', params: [] },
  'hint.groups-mismatch': { zh: '我们先找 {a} 和 {b}', en: 'Let us find {a} and {b}', params: ['a', 'b'] },
  'hint.not-merged': { zh: '把 {a} 和 {b} 推到一起', en: 'Push {a} and {b} together', params: ['a', 'b'] },
  // Asked-for help (the card or the help button): names the partner and lights it up.
  'hint.send': { zh: '把 {a} 送回去', en: 'Send the {a} back', params: ['a'] },
  'hint.swap.pair': { zh: '把 {a} 送回去，换 {b} 过来', en: 'Send the {a} back, bring the {b}', params: ['a', 'b'] },
  // Only the other half is missing: asked-for help names it (Phase 19).
  'hint.bring': { zh: '把 {a} 搬过来', en: 'Bring the {a}', params: ['a'] },
  'hint.stuck.named': { zh: '先放回 {k} 块，再把 {a} 搬过来', en: 'Put {k} back, then bring the {a}', params: ['k', 'a'] },
  // Two other partners that make the same total: right first, then which two to find (2026-10-16 review A-4).
  'hint.same-sum': { zh: '{x} 加 {y} 也是 {n}！再找 {a} 和 {b}', en: '{x} plus {y} is {n} too! Now find {a} and {b}', params: ['x', 'y', 'n', 'a', 'b'] },

  // The end of an island (2026-10-15): the button on its last stop, the line
  // on the island page (said when tapped, never on its own) and its button.
  'island.done': { zh: '{island}完成了', en: '{island} done!', params: ['island'] },
  // The same button in the narrow landscape side column, where the long one
  // wrapped onto two lines and ran off the screen (2026-10-16 review #1).
  'island.done.short': { zh: '完成！', en: 'Done!', params: [] },
  'island.onward': { zh: '{island}完成了，去{next}吧', en: '{island} is done. On to {next}!', params: ['island', 'next'] },
  'island.all': { zh: '所有的岛都完成了！', en: 'Every island is done!', params: [] },
  'island.go': { zh: '去{next}', en: 'On to {next}', params: ['next'] },

  'count.progress': { zh: '已数 {k} 块', en: '{k} so far', params: ['k'] },
  'count.total': { zh: '一共 {n} 块', en: '{n} in all', params: ['n'] },

  ...numberEntries(),
};

export function copyKey(name: string): CopyKey {
  if (!(name in COPY)) {
    throw new Error(`copy: unknown key ${name}`);
  }
  return name as CopyKey;
}

export interface FormatOptions {
  // How numeric params render: digits for the screen, words for speech.
  readonly numbers: 'digit' | 'word';
}

export function numberWord(n: number, lang: Lang): string {
  const entry = COPY[`number.${n}`];
  if (entry === undefined) {
    throw new Error(`copy: no number word for ${n}`);
  }
  return entry[lang];
}

export function format(
  key: CopyKey,
  lang: Lang,
  params: Readonly<Record<string, string | number>> = {},
  options: FormatOptions = { numbers: 'digit' },
): string {
  const entry = COPY[key];
  if (entry === undefined) {
    throw new Error(`copy: unknown key ${key}`);
  }
  let text = entry[lang];
  for (const name of entry.params) {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`copy: ${key} needs param ${name}`);
    }
    const rendered = typeof value === 'number' && options.numbers === 'word' ? numberWord(value, lang) : String(value);
    // Spoken Chinese counts two of something as 两: "一共 两 块", not "二 块"
    // (heard once "n in all" began speaking itself, 2026-10-15). The bare
    // number stays 二: "二，就是 两 块".
    const pieces = text.split(`{${name}}`);
    text = pieces.reduce((out, next) => out + (value === 2 && lang === 'zh' && options.numbers === 'word' && MEASURE_ZH.test(next) ? '两' : rendered) + next);
  }
  return text;
}

// A Chinese measure word right after a number.
const MEASURE_ZH = /^\s*[块个]/;
