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

// Shape Island's pictures (Phase 23b, PRD §4.2.5): each name, and the lines
// that say it, one key per picture so a line stays one sentence in each
// language (the PRD's `{name}` placeholder, filled here, not at runtime).
const PICTURES: Readonly<Record<string, readonly [string, string]>> = {
  mushroom: ['蘑菇', 'mushroom'],
  duck: ['小鸭', 'duck'],
  tree: ['小树', 'tree'],
  boat: ['小船', 'boat'],
  house: ['小房子', 'house'],
  corner: ['大转角', 'big corner'],
  dog: ['小狗', 'dog'],
  rocket: ['小火箭', 'rocket'],
};

function pictureEntries(): Record<string, CopyEntry> {
  const out: Record<string, CopyEntry> = {};
  for (const [id, [zh, en]] of Object.entries(PICTURES)) {
    out[`picture.${id}`] = { zh, en, params: [] };
    out[`prompt.picture.${id}`] = { zh: `用 {n} 块拼成${zh}`, en: `Build the ${en} with {n}`, params: ['n'] };
    out[`feedback.matched.picture.${id}`] = { zh: `${zh}拼好了！`, en: `A ${en}!`, params: [] };
    // No shadow yet (n7, n8): the little picture on the cloud is the guide.
    out[`hint.picture.look.${id}`] = { zh: `照着小图拼${zh}`, en: `Build the ${en} like the little picture`, params: [] };
  }
  return out;
}

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
  'chapter.ch3.title': { zh: '拿走岛', en: 'Take-away Island', params: [] },
  // Shape Island (Phase 23b). A default for Ted (PRD §8 #8): 影子岛 / Shadow Island.
  'chapter.ch5.title': { zh: '造型岛', en: 'Shape Island', params: [] },
  // Compare Island, redone (Phase 23d, D-129): a new id; ch4 is retired.
  'chapter.ch6.title': { zh: '比一比岛', en: 'Compare Island', params: [] },

  'prompt.quantity': { zh: '拼出 {n} 块', en: 'Make {n}', params: ['n'] },
  'prompt.quantity_shape': { zh: '用 {n} 块拼成这个样子', en: 'Build this with {n}', params: ['n'] },
  'prompt.addition_exact': { zh: '把 {a} 和 {b} 合起来', en: 'Put {a} and {b} together', params: ['a', 'b'] },
  // The judge accepts two partners from the stop's allowed pairs, so the prompt promises exactly that.
  'prompt.sum_composition': { zh: '找两个伙伴，拼出 {n}', en: 'Find two partners that make {n}', params: ['n'] },
  // A partner is already on the mat (Phase 19 "who's missing?"): find the other half.
  'prompt.missing_part': { zh: '已经有 {a} 了，再找一个伙伴，拼成 {n}', en: 'Here is {a}. Find one more partner to make {n}', params: ['a', 'n'] },
  // Partners already on the mat make too many (Phase 21 "send the extra away").
  'prompt.send_away': { zh: '工作台上多了，送走多的，拼成 {n}', en: 'Too many! Send one back to make {n}', params: ['n'] },
  // Take-away Island (Phase 22): pull a row apart; send some home (the tray
  // is home); a countdown's next step. Chinese counts single blocks as 块 and
  // partners as 个 (design §6).
  'prompt.split': { zh: '把 {n} 分成两个伙伴', en: 'Split {n} into two partners', params: ['n'] },
  'prompt.split.again': { zh: '换一种分法！', en: 'Split it another way!', params: [] },
  'prompt.take_away': { zh: '{n} 个伙伴，送 {k} 个回家', en: '{n} here. Send {k} home', params: ['n', 'k'] },
  'prompt.take_away.partner': { zh: '{n} 里送走 {k}，还剩几个？', en: 'Send the {k} home from {n}', params: ['n', 'k'] },
  'prompt.countdown': { zh: '再送一个回家！', en: 'One more goes home!', params: [] },

  'feedback.matched.quantity': { zh: '{n}，就是 {n} 块', en: '{n}. {n} blocks', params: ['n'] },
  // One block: "one. one block", not "one blocks" (Phase 20, play review Q6).
  'feedback.matched.quantity.one': { zh: '{n}，就是 {n} 块', en: '{n}. {n} block', params: ['n'] },
  // A right number made of parts, named left to right (Phase 20, play review F5).
  'feedback.matched.parts.2': { zh: '{a} 和 {b}，一共 {n} 块', en: '{a} and {b}, {n} in all', params: ['a', 'b', 'n'] },
  'feedback.matched.parts.3': { zh: '{a}、{b} 和 {c}，一共 {n} 块', en: '{a}, {b} and {c}, {n} in all', params: ['a', 'b', 'c', 'n'] },
  'feedback.matched.parts.4': { zh: '{a}、{b}、{c} 和 {d}，一共 {n} 块', en: '{a}, {b}, {c} and {d}, {n} in all', params: ['a', 'b', 'c', 'd', 'n'] },
  'feedback.matched.parts.5': { zh: '{a}、{b}、{c}、{d} 和 {e}，一共 {n} 块', en: '{a}, {b}, {c}, {d} and {e}, {n} in all', params: ['a', 'b', 'c', 'd', 'e', 'n'] },
  // The last picture of a stop in steps: the same blocks in a new shape.
  'feedback.matched.same': { zh: '变了样子，还是 {n} 块', en: 'A new shape, still {n} blocks', params: ['n'] },
  'feedback.matched.shape': { zh: '拼好了，{n} 块', en: 'Done. {n} blocks', params: ['n'] },
  'feedback.matched.addition': { zh: '{a} 加 {b}，一共 {n}', en: '{a} plus {b} makes {n}', params: ['a', 'b', 'n'] },
  // Take-away Island (Phase 22): a split named left to right; a take-away as it reads.
  'feedback.matched.split': { zh: '{n} 分成了 {a} 和 {b}', en: '{n} splits into {a} and {b}', params: ['n', 'a', 'b'] },
  'feedback.matched.take_away': { zh: '{n} 拿走 {k}，还剩 {r}', en: '{n} take away {k} leaves {r}', params: ['n', 'k', 'r'] },
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
  // Two other partners that make the total too: a discovery, not a mistake (Phase 20, F5).
  'feedback.same-sum': { zh: '{x} 加 {y} 也是 {n}！', en: '{x} plus {y} is {n} too!', params: ['x', 'y', 'n'] },
  // Card titles stay short: one line on a 375px phone in either language.
  'feedback.partners': { zh: '数量够了，再找对伙伴', en: 'Right count. Swap partners', params: [] },
  'feedback.swap': { zh: '换个伙伴试试看', en: 'Try a different partner', params: [] },
  // Short of the target, and nothing left in the tray adds up to the gap.
  'feedback.stuck': { zh: '这样拼不到 {n}', en: "Can't make {n} this way", params: ['n'] },
  'feedback.listen': { zh: '听提示', en: 'Hear the hint', params: [] },
  // Take-away Island cards (Phase 22, design §5.1–5.2). Pulled into more than
  // two piles; sent to the tray on a split; on a take-away: more to send (the
  // gap told on the first stops, GAP_TOLD_UNTIL), the gap not told, too many
  // sent, the wrong partner sent.
  'feedback.split.three': { zh: '分成了 {k} 堆，要两堆', en: "That's {k} piles. Make two", params: ['k'] },
  'feedback.split.keep': { zh: '都留在工作台上，只要分开', en: 'Keep them all here, just pull apart', params: [] },
  'feedback.send.more': { zh: '还要再送 {k} 个', en: '{k} more to go home', params: ['k'] },
  'feedback.send.notyet': { zh: '还没拿走 {k} 块', en: 'Not {k} gone yet', params: ['k'] },
  'feedback.send.toomany': { zh: '送多了，叫 {k} 个回来', en: 'Too many went home. Bring {k} back', params: ['k'] },
  'feedback.send.wrong': { zh: '拿走的是 {x}，不是 {k}', en: 'That was the {x}, not the {k}', params: ['x', 'k'] },
  // A right answer: the badge already shows what was built, so the card says what comes next.
  'feedback.next': { zh: '可以去下一站啦', en: 'On to the next stop', params: [] },
  'feedback.done': { zh: '回地图看看吧', en: 'Head back to the map', params: [] },

  // Hints name only moves the child can make with what is in front of them:
  // single blocks for loose material, whole partners for partner material.
  'hint.count-mismatch.fewer': { zh: '还不到 {n}，再拿一块', en: 'Not {n} yet. Take one more', params: ['n'] },
  // As many as the card's title says are missing (Phase 20, play review Q6).
  'hint.fewer.blocks': { zh: '还不到 {n}，再拿 {k} 块', en: 'Not {n} yet. Take {k} more', params: ['n', 'k'] },
  'hint.count-mismatch.more': { zh: '比 {n} 多了，放回一块', en: 'More than {n}. Put one back', params: ['n'] },
  'hint.fewer.partner': { zh: '还不到 {n}，再搬一个伙伴过来', en: 'Not {n} yet. Bring another partner', params: ['n'] },
  'hint.more.partner': { zh: '比 {n} 多了，把一个伙伴送回去', en: 'More than {n}. Send a partner back', params: ['n'] },
  'hint.swap.partner': { zh: '还不到 {n}，换一个伙伴试试', en: 'Not {n} yet. Try a different partner', params: ['n'] },
  'hint.stuck.block': { zh: '先放回一些，再把伙伴搬过来', en: 'Put some back, then bring a partner', params: [] },
  'hint.sum-pair': { zh: '找两个伙伴，拼出 {n}', en: 'Find two partners that make {n}', params: ['n'] },
  'hint.another-way': { zh: '再用另外两个伙伴拼出 {n}', en: 'Make {n} with two other partners', params: ['n'] },
  // The first way stays; the next is built beside it (Phase 20, play review Q1).
  'hint.beside': { zh: '在旁边再拼一个 {n}', en: 'Make another {n} beside it', params: ['n'] },
  // After the same-sum title: which two to find.
  'hint.find': { zh: '再找 {a} 和 {b}', en: 'Now find {a} and {b}', params: ['a', 'b'] },
  // A big number on an empty mat, after the task (the 17 boss, Phase 20 Q3).
  'hint.biggest': { zh: '先搬最大的伙伴', en: 'Bring the biggest partner first', params: [] },
  // Said while the stray blocks / the little shape picture light up.
  'hint.not-one-cluster': { zh: '把分开的积木推到一起', en: 'Push the blocks together', params: [] },
  'hint.shape-mismatch': { zh: '照着小图摆一摆', en: 'Build it like the little picture', params: [] },
  'hint.groups-mismatch': { zh: '我们先找 {a} 和 {b}', en: "Let's find {a} and {b}", params: ['a', 'b'] },
  'hint.not-merged': { zh: '把 {a} 和 {b} 推到一起', en: 'Push {a} and {b} together', params: ['a', 'b'] },
  // Asked-for help (the card or the help button): names the partner and lights it up.
  'hint.send': { zh: '把 {a} 送回去', en: 'Send the {a} back', params: ['a'] },
  'hint.swap.pair': { zh: '把 {a} 送回去，换 {b} 过来', en: 'Send the {a} back, bring the {b}', params: ['a', 'b'] },
  // Only the other half is missing: asked-for help names it (Phase 19).
  'hint.bring': { zh: '把 {a} 搬过来', en: 'Bring the {a}', params: ['a'] },
  'hint.stuck.named': { zh: '先放回 {k} 块，再把 {a} 搬过来', en: 'Put {k} back, then bring the {a}', params: ['k', 'a'] },
  // Two other partners that make the same total: right first, then which two to find (2026-10-16 review A-4).
  'hint.same-sum': { zh: '{x} 加 {y} 也是 {n}！再找 {a} 和 {b}', en: '{x} plus {y} is {n} too! Now find {a} and {b}', params: ['x', 'y', 'n', 'a', 'b'] },
  // Take-away Island help (Phase 22, design §5.5), by rung: pull one away /
  // the last one; another split; one pile too many; blocks back from the
  // tray; send k home / and what stays; the partner to bring back, and the
  // one to send instead.
  'hint.pull': { zh: '把一块拉开', en: 'Pull one block away', params: [] },
  'hint.pull.right': { zh: '把最右边的一块拉开', en: 'Pull the last block away', params: [] },
  'hint.split.another': { zh: '再分成另外两个数', en: 'Split it into two other numbers', params: [] },
  'hint.split.two': { zh: '把一块推回去，只留两堆', en: 'Push one back. Just two piles', params: [] },
  'hint.bring.back': { zh: '把 {k} 块叫回来', en: 'Bring {k} back', params: ['k'] },
  'hint.send.home': { zh: '送 {k} 块回家', en: 'Send {k} home', params: ['k'] },
  'hint.send.home.left': { zh: '送 {k} 块回家，剩 {r} 块', en: 'Send {k} home, {r} stay', params: ['k', 'r'] },
  'hint.call.back': { zh: '把 {a} 叫回来，送走 {b}', en: 'Bring the {a} back, send the {b}', params: ['a', 'b'] },
  'hint.call.back.one': { zh: '把 {a} 叫回来', en: 'Bring the {a} back', params: ['a'] },
  // Shape Island's shadow (Phase 23b, PRD §4.2.5): the opening; part filled
  // (the gap lit); a piece sticking out of it (building, not a mistake: the
  // judge takes the picture anywhere); which piece goes in and where; the
  // shadow coming to help. Partners are 个, the shadow's cells 这里 (P-07).
  'hint.shadow.start': { zh: '把伙伴放进影子里', en: 'Put partners in the shadow', params: [] },
  'feedback.shadow.gap': { zh: '影子还没填满', en: "The shadow's not full yet", params: [] },
  'hint.shadow.here': { zh: '还差这里', en: 'This bit is missing', params: [] },
  'feedback.shadow.out': { zh: '伸出影子了', en: 'That sticks out', params: [] },
  'hint.shadow.move': { zh: '把它挪进影子里', en: 'Move it into the shadow', params: [] },
  'hint.shadow.in': { zh: '把 {a} 挪进影子里', en: 'Move the {a} into the shadow', params: ['a'] },
  'hint.shadow.piece': { zh: '把 {a} 放进影子里', en: 'Put the {a} in the shadow', params: ['a'] },
  'hint.shadow.put': { zh: '把 {a} 放到这里', en: 'Put the {a} here', params: ['a'] },
  'hint.shadow.reveal': { zh: '影子来帮忙啦', en: 'Here comes the shadow', params: [] },
  // The rocket's success line (Shape Island's boss, launched).
  'feedback.launch': { zh: '小火箭，发射！', en: 'Rocket, blast off!', params: [] },

  // Compare Island (Phase 23d, PRD §6): two numbers and a sign between them.
  'prompt.sign': { zh: '选一个符号放进中间', en: 'Put a sign in the middle', params: [] },
  'prompt.sign.pair': { zh: '{a} 和 {b}，选一个符号', en: '{a} and {b}. Pick a sign', params: ['a', 'b'] },
  // The right sign, said by name (SAY_SYMBOL_NAMES) ...
  'feedback.matched.sign.gt': { zh: '{a} 大于 {b}', en: '{a} is greater than {b}', params: ['a', 'b'] },
  'feedback.matched.sign.lt': { zh: '{a} 小于 {b}', en: '{a} is less than {b}', params: ['a', 'b'] },
  'feedback.matched.sign.eq': { zh: '{a} 等于 {b}', en: '{a} equals {b}', params: ['a', 'b'] },
  // ... or by what it means; also the card after a wrong sign (a fact, not "wrong").
  'feedback.sign.more': { zh: '{a} 比 {b} 多', en: '{a} is more than {b}', params: ['a', 'b'] },
  'feedback.sign.fewer': { zh: '{a} 比 {b} 少', en: '{a} is fewer than {b}', params: ['a', 'b'] },
  'feedback.sign.same': { zh: '{a} 和 {b} 一样多', en: '{a} and {b} are the same', params: ['a', 'b'] },
  'feedback.sign.next': { zh: '下一对！', en: 'Next pair!', params: [] },
  'hint.sign.try': { zh: '换一个符号试试', en: 'Try another sign', params: [] },
  // Help's third step names the sign under the fact on the card's title
  // (PRD §6 had one line; split so the English title fits a 360px phone).
  'hint.sign.use.gt': { zh: '用大于号', en: 'Use greater than', params: [] },
  'hint.sign.use.lt': { zh: '用小于号', en: 'Use less than', params: [] },
  'hint.sign.use.eq': { zh: '用等于号', en: 'Use equals', params: [] },
  // The sign blocks' names, for screen readers (nothing is said aloud on a tap).
  'sign.gt': { zh: '大于号', en: 'greater than', params: [] },
  'sign.lt': { zh: '小于号', en: 'less than', params: [] },
  'sign.eq': { zh: '等于号', en: 'equals', params: [] },

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

  ...pictureEntries(),
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
