import { areTouching, groupSize } from '../core';
import type { Command, Group } from '../core';
import { CHAPTERS, CONTENT_VERSION, chapterId, format, materialize, materializeNode, nodeId } from '../content';
import type { Puzzle } from '../content';
import { asksForHelp, cardFor, feedbackFor, guidanceFor, hintFor, promptParams } from './hints';
import { commitCommand, startSession } from './level-session';
import type { LevelSession } from './level-session';

function puzzleOf(nodeId: string): Puzzle {
  const chapter = CHAPTERS.find((c) => c.nodes.some((n) => n.id === nodeId))!;
  return materialize({ contentVersion: CONTENT_VERSION, chapterId: chapter.id, nodeId: chapter.nodes.find((n) => n.id === nodeId)!.id, attemptVariant: 0, seed: 5 });
}

// The exact 3 + 4 join: ch2-n7 up to content version 5, a "who's missing?"
// stop since Phase 19. The addition hints are the same code that 1 + 1, 2 + 1
// and 2 + 2 use, so they stay pinned on the old spec.
function exactJoin(): Puzzle {
  const spec = { kind: 'addition_exact', pairs: [[3, 4]], distractors: [5, 2] } as const;
  return materializeNode({ id: nodeId('ch2-n7'), role: 'boss', spec }, { cols: 8, rows: 3 }, { contentVersion: CONTENT_VERSION, chapterId: chapterId('ch2'), nodeId: nodeId('ch2-n7'), attemptVariant: 0, seed: 5 });
}

function play(puzzle: Puzzle, cmds: ReadonlyArray<Command>): LevelSession {
  return cmds.reduce((s, cmd) => {
    const r = commitCommand(s, cmd);
    if (!r.ok) {
      throw new Error(`${cmd.type}: ${r.reason}`);
    }
    return r.session;
  }, startSession(puzzle, null));
}

function say(s: LevelSession): string {
  const h = hintFor(s);
  return format(h.key, 'zh', h.params);
}

function partner(puzzle: Puzzle, size: number, skip = 0): Group {
  return [...puzzle.initial.groups.values()].filter((g) => groupSize(g) === size)[skip]!;
}

function spares(puzzle: Puzzle) {
  const inGroup = new Set([...puzzle.initial.groups.values()].flatMap((g) => g.unitIds));
  return [...puzzle.initial.units.keys()].filter((u) => !inGroup.has(u));
}

describe('the first partner stop, 5 (2026-10-16 review A-6)', () => {
  test('counting out singles reaches 5 and is right; four singles is still building, never "can\'t make 5"; the 3 and two singles also work', () => {
    const p = puzzleOf('ch1-n5');
    const singles = spares(p);
    expect(singles).toHaveLength(5);
    const take = (n: number): Command[] => singles.slice(0, n).map((u, i) => ({ type: 'take', unitId: u, to: { x: i, y: 0 } }));
    const four = play(p, take(4));
    expect(feedbackFor(four).tone).toBe('building');
    expect(say(four)).toBe('还不到 5，再拿一块');
    expect(play(p, take(5)).verdict.matched).toBe(true);
    expect(play(p, p.solution).verdict.matched).toBe(true);
  });
});

describe('help hints follow the material (review: no "take one more" when only partners can move)', () => {
  test('visible feedback separates incomplete builds, excess blocks and success', () => {
    const p = puzzleOf('ch1-n2');
    const units = [...p.initial.units.keys()];
    const describe = (s: LevelSession) => {
      const f = feedbackFor(s);
      return { tone: f.tone, title: format(f.title.key, 'zh', f.title.params), en: format(f.title.key, 'en', f.title.params) };
    };
    expect(describe(play(p, []))).toEqual({ tone: 'start', title: '动手试试看', en: 'Give it a try' });
    expect(describe(play(p, [{ type: 'take', unitId: units[0]!, to: { x: 0, y: 0 } }]))).toEqual({ tone: 'building', title: '还差 1 块', en: '1 more block to go' });
    expect(describe(play(p, p.solution)).tone).toBe('success');
    const extra = play(p, units.slice(0, 3).map((u, i) => ({ type: 'take', unitId: u, to: { x: i, y: 0 } })));
    expect(describe(extra).title).toBe('多了 1 块');
  });

  test('right count does not claim success for a wrong shape or the wrong partners', () => {
    const shape = puzzleOf('ch1-n3');
    const units = [...shape.initial.units.keys()];
    const line = play(shape, units.slice(0, 4).map((u, i) => ({ type: 'take', unitId: u, to: { x: i, y: 0 } })));
    const shapeFeedback = feedbackFor(line);
    expect(shapeFeedback.tone).toBe('adjust');
    expect(format(shapeFeedback.title.key, 'zh')).toBe('数量对了，再看看形状');
    const p = exactJoin();
    const wrong = play(p, [
      { type: 'takeGroup', groupId: partner(p, 5).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: partner(p, 2).id, origin: { x: 5, y: 0 } },
    ]);
    const f = feedbackFor(wrong);
    expect(f.tone).toBe('adjust');
    expect(format(f.title.key, 'zh')).toBe('数量够了，再找对伙伴');
    expect(format(f.detail.key, 'zh', f.detail.params)).toBe('我们先找 3 和 4');
    const partialWrong = play(p, [
      { type: 'takeGroup', groupId: partner(p, 4).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: partner(p, 2).id, origin: { x: 0, y: 2 } },
    ]);
    const partial = feedbackFor(partialWrong);
    expect(partialWrong.verdict.benchCount).toBe(6);
    expect(partial.tone).toBe('adjust');
    expect(format(partial.title.key, 'zh')).toBe('换个伙伴试试看');
  });
  test('loose stops keep the single-block hints', () => {
    const p = puzzleOf('ch1-n2');
    const units = [...p.initial.units.keys()];
    expect(say(play(p, []))).toBe('还不到 2，再拿一块');
    expect(say(play(p, units.slice(0, 3).map((u, i) => ({ type: 'take', unitId: u, to: { x: i, y: 0 } }))))).toBe('比 2 多了，放回一块');
  });

  test('shape stops: join up, then look at the shape', () => {
    const p = puzzleOf('ch1-n3');
    const units = [...p.initial.units.keys()];
    const spots = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 2 }];
    const apart = play(p, units.slice(0, 4).map((u, i) => ({ type: 'take', unitId: u, to: spots[i]! })));
    expect(say(apart)).toBe('把分开的积木推到一起');
    const line = play(p, units.slice(0, 4).map((u, i) => ({ type: 'take', unitId: u, to: { x: i, y: 0 } })));
    expect(say(line)).toBe('照着小图摆一摆');
  });

  test('12 with partners: an empty bench asks for a partner; one spare short asks for a block', () => {
    const p = puzzleOf('ch1-n11');
    expect(say(play(p, []))).toBe('还不到 12，再搬一个伙伴过来');
    const ten = partner(p, 10);
    const [a] = spares(p);
    const eleven = play(p, [
      { type: 'takeGroup', groupId: ten.id, origin: { x: 0, y: 0 } },
      { type: 'take', unitId: a!, to: { x: 0, y: 3 } },
    ]);
    // The 2 no longer fits in what is missing; a spare block does.
    expect(say(eleven)).toBe('还不到 12，再拿一块');
  });

  test('17: too many with spares on the bench says put one back; too many partners says send one back', () => {
    const p = puzzleOf('ch1-n12');
    const [a, b] = spares(p);
    const all = play(p, [
      { type: 'takeGroup', groupId: partner(p, 10).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: partner(p, 5).id, origin: { x: 0, y: 2 } },
      { type: 'takeGroup', groupId: partner(p, 2).id, origin: { x: 0, y: 3 } },
      { type: 'take', unitId: a!, to: { x: 0, y: 4 } },
      { type: 'take', unitId: b!, to: { x: 1, y: 4 } },
    ]);
    expect(say(all)).toBe('比 17 多了，放回一块');
    const n10 = puzzleOf('ch1-n10');
    expect(say(play(n10, [{ type: 'takeGroup', groupId: partner(n10, 5).id, origin: { x: 0, y: 0 } }]))).toBe('还不到 10，再搬一个伙伴过来');
  });

  test('a partner that does not fit and no spares left: make room for it', () => {
    const p = puzzleOf('ch1-n12');
    const [a, b] = spares(p);
    const s = play(p, [
      { type: 'takeGroup', groupId: partner(p, 10).id, origin: { x: 0, y: 0 } },
      { type: 'take', unitId: a!, to: { x: 0, y: 2 } },
      { type: 'take', unitId: b!, to: { x: 1, y: 2 } },
      { type: 'takeGroup', groupId: partner(p, 2).id, origin: { x: 0, y: 3 } },
    ]);
    // 14 on the bench, 3 missing, only the 5 is left. Putting the two spares back
    // makes room for it (10 + 2 + 5).
    expect(say(s)).toBe('先放回一些，再把伙伴搬过来');
    // Adding cannot finish it, so the card asks for a change instead of "3 more to go".
    const f = feedbackFor(s);
    expect(f.tone).toBe('adjust');
    expect(format(f.title.key, 'zh', f.title.params)).toBe('这样拼不到 17');
    // Seen in play (ch1-n10): a 5 and both spares is 7; neither the other 5 nor the 4
    // fits the 3 still missing, and trading the 5 for the 5 changes nothing, so the
    // hint is to put blocks back (then 5 + 4 + 1).
    const ten = puzzleOf('ch1-n10');
    const [x, y] = spares(ten);
    const seven = play(ten, [
      { type: 'takeGroup', groupId: partner(ten, 5).id, origin: { x: 0, y: 0 } },
      { type: 'take', unitId: x!, to: { x: 0, y: 2 } },
      { type: 'take', unitId: y!, to: { x: 1, y: 2 } },
    ]);
    expect(say(seven)).toBe('先放回一些，再把伙伴搬过来');
    expect(feedbackFor(seven).tone).toBe('adjust');
    // A 5 and one spare (6) can still finish with the 4: ordinary building.
    const n10 = puzzleOf('ch1-n10');
    const [c] = spares(n10);
    const six = play(n10, [
      { type: 'takeGroup', groupId: partner(n10, 5).id, origin: { x: 0, y: 0 } },
      { type: 'take', unitId: c!, to: { x: 0, y: 2 } },
    ]);
    expect(feedbackFor(six).tone).toBe('building');
    expect(say(six)).toBe('还不到 10，再搬一个伙伴过来');
  });

  // A child who only ever does what the hint says, starting from any muddle,
  // must get to the answer: a hint that leads into a dead end fails this. The
  // hint never names which partner (that is the child's thinking), so the
  // simulated child behaves like a learner: asked to swap, it sends back its
  // latest pick, and it does not bring back a partner it already sent away.
  test('following the hints from a random muddle always finishes the partner stops', () => {
    const commitFirst = (s: LevelSession, cmds: ReadonlyArray<Command>): LevelSession | null => {
      for (const cmd of cmds) {
        const r = commitCommand(s, cmd);
        if (r.ok) {
          return r.session;
        }
      }
      return null;
    };
    const cells = (p: Puzzle) => {
      const out: { x: number; y: number }[] = [];
      for (let y = 0; y < p.initial.bounds.rows; y += 1) {
        for (let x = 0; x < p.initial.bounds.cols; x += 1) {
          out.push({ x, y });
        }
      }
      return out;
    };
    const pick = <T,>(items: ReadonlyArray<T>, rnd: () => number): T | undefined => items[rnd() % Math.max(1, items.length)];
    const material = (s: LevelSession) => {
      const state = s.history.state;
      const groups = [...state.groups.values()];
      const inGroup = new Set(groups.flatMap((g) => g.unitIds));
      const loose = [...state.units.keys()].filter((u) => !inGroup.has(u));
      return {
        trayPartners: groups.filter((g) => g.unitIds.every((u) => !state.bench.has(u))),
        benchPartners: groups.filter((g) => g.unitIds.every((u) => state.bench.has(u))),
        trayLoose: loose.filter((u) => !state.bench.has(u)),
        benchLoose: loose.filter((u) => state.bench.has(u)),
      };
    };
    const take = (s: LevelSession, unitId: Puzzle['initial']['units'] extends ReadonlyMap<infer U, unknown> ? U : never) =>
      commitFirst(s, cells(s.puzzle).map((to) => ({ type: 'take', unitId, to })));
    const takeGroup = (s: LevelSession, g: Group) => commitFirst(s, cells(s.puzzle).map((origin) => ({ type: 'takeGroup', groupId: g.id, origin })));
    for (const id of ['ch1-n10', 'ch1-n11', 'ch1-n12']) {
      const p = puzzleOf(id);
      const target = p.question.kind === 'quantity' ? p.question.target : 0;
      for (let seed = 1; seed <= 80; seed += 1) {
        let r = seed;
        const rnd = () => (r = (r * 16807) % 2147483647);
        let s = startSession(p, null);
        for (let i = rnd() % 6; i > 0; i -= 1) {
          const m = material(s);
          const moves = [
            () => (m.trayLoose.length > 0 ? take(s, pick(m.trayLoose, rnd)!) : null),
            () => (m.trayPartners.length > 0 ? takeGroup(s, pick(m.trayPartners, rnd)!) : null),
            () => (m.benchLoose.length > 0 ? commitFirst(s, [{ type: 'return', unitId: pick(m.benchLoose, rnd)! }]) : null),
            () => (m.benchPartners.length > 0 ? commitFirst(s, [{ type: 'returnGroup', groupId: pick(m.benchPartners, rnd)!.id }]) : null),
          ];
          s = pick(moves, rnd)!() ?? s;
        }
        const trail: string[] = [];
        const brought: Group[] = [];
        const sentBack = new Set<string>();
        for (let step = 0; step < 16 && !s.verdict.matched; step += 1) {
          const m = material(s);
          const key = hintFor(s).key as string;
          trail.push(`${s.verdict.benchCount}:${key}`);
          const missing = target - s.verdict.benchCount;
          const fitting = m.trayPartners.filter((g) => groupSize(g) <= missing);
          const fresh = fitting.filter((g) => !sentBack.has(g.id));
          const latest = [...brought].reverse().find((g) => m.benchPartners.includes(g)) ?? pick(m.benchPartners, rnd);
          let next: LevelSession | null = null;
          if (key === 'hint.fewer.partner') {
            const g = pick(fresh.length > 0 ? fresh : fitting, rnd)!;
            brought.push(g);
            next = takeGroup(s, g);
          } else if (key === 'hint.count-mismatch.fewer') {
            next = take(s, pick(m.trayLoose, rnd)!);
          } else if (key === 'hint.stuck.block' || key === 'hint.count-mismatch.more') {
            next = commitFirst(s, [{ type: 'return', unitId: pick(m.benchLoose, rnd)! }]);
          } else if ((key === 'hint.swap.partner' || key === 'hint.more.partner') && latest !== undefined) {
            sentBack.add(latest.id);
            next = commitFirst(s, [{ type: 'returnGroup', groupId: latest.id }]);
          }
          if (next === null) {
            throw new Error(`${id} seed ${seed}: hint ${key} names no possible move (${trail.join(' > ')})`);
          }
          s = next;
        }
        expect({ id, seed, solved: s.verdict.matched, trail }).toMatchObject({ id, seed, solved: true });
      }
    }
  });

  test('addition: find a and b; too many partners; join them', () => {
    const p = exactJoin();
    expect(say(play(p, []))).toBe('我们先找 3 和 4');
    const wrong = play(p, [
      { type: 'takeGroup', groupId: partner(p, 5).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: partner(p, 2).id, origin: { x: 5, y: 0 } },
    ]);
    expect(say(wrong)).toBe('我们先找 3 和 4');
    const many = play(p, [
      { type: 'takeGroup', groupId: partner(p, 5).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: partner(p, 4).id, origin: { x: 0, y: 2 } },
    ]);
    expect(say(many)).toBe('比 7 多了，把一个伙伴送回去');
    const apart = play(p, [
      // A gap at x = 3 keeps them apart on the 8 × 3 mat.
      { type: 'takeGroup', groupId: partner(p, 3).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: partner(p, 4).id, origin: { x: 4, y: 0 } },
    ]);
    expect(say(apart)).toBe('把 3 和 4 推到一起');
    const done = play(p, [
      { type: 'takeGroup', groupId: partner(p, 3).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: partner(p, 4).id, origin: { x: 3, y: 0 } },
    ]);
    expect(say(done)).toBe('3 加 4，一共 7');
  });

  test('free sum: the hint and the prompt promise two partners, as the judge requires', () => {
    const p = puzzleOf('ch2-n4');
    expect(format(p.prompt, 'zh', { n: 5 })).toBe('找两个伙伴，拼出 5');
    expect(format(p.prompt, 'en', { n: 5 })).toBe('Find two partners that make 5');
    expect(say(play(p, []))).toBe('找两个伙伴，拼出 5');
    // The single 5 has the right count but is not two partners.
    const alone = play(p, [{ type: 'takeGroup', groupId: partner(p, 5).id, origin: { x: 0, y: 0 } }]);
    expect(alone.verdict.reason).toBe('groups-mismatch');
    expect(say(alone)).toBe('找两个伙伴，拼出 5');
    const tooMany = play(p, [
      { type: 'takeGroup', groupId: partner(p, 5).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: partner(p, 1).id, origin: { x: 5, y: 0 } },
    ]);
    expect(say(tooMany)).toBe('比 5 多了，把一个伙伴送回去');
    const apart = play(p, [
      { type: 'takeGroup', groupId: partner(p, 2).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: partner(p, 3).id, origin: { x: 0, y: 2 } },
    ]);
    expect(say(apart)).toBe('把 2 和 3 推到一起');
    // Right: the card and voice name the pair the child chose, as the badge does.
    const joined = play(p, [
      { type: 'takeGroup', groupId: partner(p, 3).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: partner(p, 2).id, origin: { x: 3, y: 0 } },
    ]);
    expect(say(joined)).toBe('3 加 2，一共 5');
    expect(format(feedbackFor(joined).detail.key, 'en', feedbackFor(joined).detail.params)).toBe('3 plus 2 makes 5');
  });

  test('a right answer repeats the success line', () => {
    const p = puzzleOf('ch1-n1');
    const [u] = [...p.initial.units.keys()];
    expect(say(play(p, [{ type: 'take', unitId: u!, to: { x: 0, y: 0 } }]))).toBe('1，就是 1 块');
    const shape = puzzleOf('ch1-n3');
    expect(say(play(shape, shape.solution))).toBe('拼好了，4 块');
  });
});

// Help levels (2026-10-14 child / game / UI review): the line said on its own
// names the move but never the partner; asked-for help names it and lights it
// up, and only what the line names is lit.
describe('asked-for help points at the blocks (review: hints must point at objects)', () => {
  const text = (g: { line: { key: string; params: Readonly<Record<string, number>> } }) => format(g.line.key as never, 'zh', g.line.params);

  test('3 + 4 with a 4 and a 2: level 1 says what to find, level 2 names the 2 to send back and the 3 to bring', () => {
    const p = exactJoin();
    const s = play(p, [
      { type: 'takeGroup', groupId: partner(p, 4).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: partner(p, 2).id, origin: { x: 4, y: 0 } },
    ]);
    expect(feedbackFor(s).tone).toBe('adjust');
    expect(text(guidanceFor(s, 1))).toBe('我们先找 3 和 4');
    expect(guidanceFor(s, 1).focus).toEqual({ objects: [], template: false });
    const help = guidanceFor(s, 2);
    expect(text(help)).toBe('把 2 送回去，换 3 过来');
    expect(format(help.line.key, 'en', help.line.params)).toBe('Send the 2 back, bring the 3');
    expect(help.focus.objects).toEqual([partner(p, 2).id, partner(p, 3).id]);
    // The card shows what was said once the child asked; before that, the level 1 line.
    expect(format(cardFor(s, 0, true).detail.key, 'zh', cardFor(s, 0, true).detail.params)).toBe('我们先找 3 和 4');
    expect(format(cardFor(s, 2, true).detail.key, 'zh', cardFor(s, 2, true).detail.params)).toBe('把 2 送回去，换 3 过来');
    // Two right partners apart: level 1 already lights both (nothing to give away).
    const apart = play(p, [
      // A gap at x = 3 keeps them apart on the 8 × 3 mat.
      { type: 'takeGroup', groupId: partner(p, 3).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: partner(p, 4).id, origin: { x: 4, y: 0 } },
    ]);
    expect([...guidanceFor(apart, 1).focus.objects].sort()).toEqual([partner(p, 3).id, partner(p, 4).id].sort());
    expect(text(guidanceFor(apart, 2))).toBe('把 3 和 4 推到一起');
  });

  test('2026-10-16 review A-4: 3 + 4 built as 5 + 2: asked-for help says it is 7 too, names 3 and 4, and lights all four', () => {
    const p = exactJoin();
    const s = play(p, [
      { type: 'takeGroup', groupId: partner(p, 5).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: partner(p, 2).id, origin: { x: 5, y: 0 } },
    ]);
    expect(s.verdict.reason).toBe('groups-mismatch');
    expect(feedbackFor(s).tone).toBe('adjust');
    // Level 1 is unchanged: what to find, nothing lit.
    expect(text(guidanceFor(s, 1))).toBe('我们先找 3 和 4');
    expect(guidanceFor(s, 1).focus.objects).toEqual([]);
    const help = guidanceFor(s, 2);
    expect(text(help)).toBe('5 加 2 也是 7！再找 3 和 4');
    expect(format(help.line.key, 'en', help.line.params)).toBe('5 plus 2 is 7 too! Now find 3 and 4');
    expect(help.focus.objects).toEqual([partner(p, 5).id, partner(p, 2).id, partner(p, 3).id, partner(p, 4).id]);
    // The 2 on the left reads 2 + 5.
    const flipped = play(p, [
      { type: 'takeGroup', groupId: partner(p, 2).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: partner(p, 5).id, origin: { x: 2, y: 0 } },
    ]);
    expect(text(guidanceFor(flipped, 2))).toBe('2 加 5 也是 7！再找 3 和 4');
    expect(format(cardFor(flipped, 2, true).detail.key, 'zh', cardFor(flipped, 2, true).detail.params)).toBe('2 加 5 也是 7！再找 3 和 4');
  });

  test('big numbers: the decoy that overshoots is named; a swap when no partner is the excess; stuck blocks are counted out', () => {
    const ten = puzzleOf('ch1-n10');
    const fourteen = play(ten, [
      { type: 'takeGroup', groupId: partner(ten, 5).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: partner(ten, 4).id, origin: { x: 0, y: 1 } },
      { type: 'takeGroup', groupId: partner(ten, 5, 1).id, origin: { x: 0, y: 2 } },
    ]);
    expect(say(fourteen)).toBe('比 10 多了，把一个伙伴送回去');
    expect(text(guidanceFor(fourteen, 2))).toBe('把 4 送回去');
    expect(guidanceFor(fourteen, 2).focus.objects).toEqual([partner(ten, 4).id]);

    const seventeen = puzzleOf('ch1-n12');
    const nineteen = play(seventeen, [
      { type: 'takeGroup', groupId: partner(seventeen, 10).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: partner(seventeen, 5).id, origin: { x: 0, y: 2 } },
      { type: 'takeGroup', groupId: partner(seventeen, 4).id, origin: { x: 0, y: 3 } },
    ]);
    expect(text(guidanceFor(nineteen, 2))).toBe('把 4 送回去，换 2 过来');
    expect(guidanceFor(nineteen, 2).focus.objects).toEqual([partner(seventeen, 4).id, partner(seventeen, 2).id]);

    // 5 + both spares = 7: put one spare back so the 4 fits (5 + 4 + 1).
    const [x, y] = spares(ten);
    const seven = play(ten, [
      { type: 'takeGroup', groupId: partner(ten, 5).id, origin: { x: 0, y: 0 } },
      { type: 'take', unitId: x!, to: { x: 0, y: 2 } },
      { type: 'take', unitId: y!, to: { x: 1, y: 2 } },
    ]);
    expect(text(guidanceFor(seven, 2))).toBe('先放回 1 块，再把 4 搬过来');
    expect(guidanceFor(seven, 2).focus.objects).toEqual([y, partner(ten, 4).id]);
    // Level 1 never names a partner.
    expect(say(seven)).toBe('先放回一些，再把伙伴搬过来');
  });

  test('shape stops light up the little picture; building, a fresh bench and a right answer are never corrected', () => {
    const p = puzzleOf('ch1-n3');
    expect(guidanceFor(play(p, []), 1).focus.template).toBe(true);
    const units = [...p.initial.units.keys()];
    const line = play(p, units.slice(0, 4).map((u, i) => ({ type: 'take', unitId: u, to: { x: i, y: 0 } })));
    expect(guidanceFor(line, 2)).toEqual({ line: { key: 'hint.shape-mismatch', params: {} }, focus: { objects: [], template: true } });
    // The stray block in the far corner of the 5 × 3 mat.
    const spots = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 4, y: 2 }];
    const stray = play(p, units.slice(0, 4).map((u, i) => ({ type: 'take', unitId: u, to: spots[i]! })));
    expect(guidanceFor(stray, 1).focus.objects).toEqual([units[3]]);
    const one = play(p, [{ type: 'take', unitId: units[0]!, to: { x: 0, y: 0 } }]);
    expect(feedbackFor(one).tone).toBe('building');
    expect(guidanceFor(one, 2)).toEqual(guidanceFor(one, 1));
    const done = play(p, p.solution);
    expect(guidanceFor(done, 2).focus).toEqual({ objects: [], template: false });
  });

  test('a right answer: the card says what comes next instead of repeating the badge; the voice line is unchanged', () => {
    const p = exactJoin();
    const done = play(p, [
      { type: 'takeGroup', groupId: partner(p, 3).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: partner(p, 4).id, origin: { x: 3, y: 0 } },
    ]);
    expect(format(cardFor(done, 0, true).detail.key, 'zh')).toBe('可以去下一站啦');
    expect(format(cardFor(done, 2, false).detail.key, 'en')).toBe('Head back to the map');
    expect(format(cardFor(done, 0, true).title.key, 'zh')).toBe('拼对啦！');
    expect(say(done)).toBe('3 加 4，一共 7');
  });

  // Doing exactly what asked-for help says, from any muddle, always finishes.
  test('following level 2 help literally always finishes the big-number stops', () => {
    const cells = (p: Puzzle) => Array.from({ length: p.initial.bounds.rows * p.initial.bounds.cols }, (_, i) => ({ x: i % p.initial.bounds.cols, y: Math.floor(i / p.initial.bounds.cols) }));
    const commitFirst = (s: LevelSession, cmds: ReadonlyArray<Command>): LevelSession | null => {
      for (const cmd of cmds) {
        const r = commitCommand(s, cmd);
        if (r.ok) {
          return r.session;
        }
      }
      return null;
    };
    for (const id of ['ch1-n10', 'ch1-n11', 'ch1-n12']) {
      const p = puzzleOf(id);
      const target = p.question.kind === 'quantity' ? p.question.target : 0;
      for (let seed = 1; seed <= 60; seed += 1) {
        let r = seed;
        const rnd = () => (r = (r * 16807) % 2147483647);
        let s = startSession(p, null);
        // A muddle: a few partners and spares carried over at random.
        const groups = [...p.initial.groups.values()];
        for (const g of groups) {
          if (rnd() % 2 === 0) {
            s = commitFirst(s, cells(p).map((origin) => ({ type: 'takeGroup', groupId: g.id, origin }))) ?? s;
          }
        }
        for (const u of spares(p)) {
          if (rnd() % 2 === 0) {
            s = commitFirst(s, cells(p).map((to) => ({ type: 'take', unitId: u, to }))) ?? s;
          }
        }
        const trail: string[] = [];
        for (let step = 0; step < 12 && !s.verdict.matched; step += 1) {
          const state = s.history.state;
          const help = guidanceFor(s, 2);
          trail.push(`${s.verdict.benchCount}:${help.line.key}`);
          const lit = help.focus.objects;
          let next: LevelSession | null = s;
          // Lit things on the bench go back; lit things in the tray come over.
          for (const id of lit) {
            const g = state.groups.get(id as never);
            if (g !== undefined) {
              const onBench = g.unitIds.every((u) => state.bench.has(u));
              next = next && (onBench ? commitFirst(next, [{ type: 'returnGroup', groupId: g.id }]) : commitFirst(next, cells(p).map((origin) => ({ type: 'takeGroup', groupId: g.id, origin }))));
            } else {
              next = next && commitFirst(next, [{ type: 'return', unitId: id as never }]);
            }
          }
          if (lit.length === 0) {
            // Nothing named: an ordinary building step, as a learner would take it.
            const missing = target - s.verdict.benchCount;
            const inGroup = new Set(groups.flatMap((g) => g.unitIds));
            const fit = groups.find((g) => g.unitIds.every((u) => !state.bench.has(u)) && g.unitIds.length <= missing);
            const spare = [...state.units.keys()].find((u) => !inGroup.has(u) && !state.bench.has(u));
            next = fit !== undefined && help.line.key === 'hint.fewer.partner'
              ? commitFirst(s, cells(p).map((origin) => ({ type: 'takeGroup', groupId: fit.id, origin })))
              : spare !== undefined && missing > 0 ? commitFirst(s, cells(p).map((to) => ({ type: 'take', unitId: spare, to }))) : null;
          }
          if (next === null || next === s) {
            throw new Error(`${id} seed ${seed}: help ${help.line.key} named no possible move (${trail.join(' > ')})`);
          }
          s = next;
        }
        expect({ id, seed, solved: s.verdict.matched, trail }).toMatchObject({ id, seed, solved: true });
      }
    }
  });

  // Phase 19: the same for the Join Island sums, the "who's missing?" stops (a
  // partner starts on the mat) and the boss asked two ways included. The child
  // asks for help whenever the card has something to name and does what is
  // lit: lit partners on the mat go back, lit partners in the tray come over
  // touching one on the mat; told to push two together, it does. Half the time
  // it stops after the first lit thing and asks again, so the states halfway
  // through a swap are asked too. With nothing lit (the start, building) it
  // brings a partner from the tray, one it has not sent back if it can; told
  // there are too many, it sends back its latest pick. A run not done in 24
  // moves is listed with its trail (step:partners on the mat:line, * = lit).
  // It found three partners on the mat (2 + 3 + 1 on make-6) with help naming
  // nothing: "find two partners", a fourth brought, the right one sent back.
  test('Phase 19: following help from a random muddle always finishes the Join Island sums, the boss both ways', () => {
    const commitFirst = (s: LevelSession, cmds: ReadonlyArray<Command>): LevelSession | null => {
      for (const cmd of cmds) {
        const r = commitCommand(s, cmd);
        if (r.ok) {
          return r.session;
        }
      }
      return null;
    };
    const onBench = (s: LevelSession) => [...s.history.state.groups.values()].filter((g) => g.unitIds.every((u) => s.history.state.bench.has(u)));
    const inTray = (s: LevelSession) => [...s.history.state.groups.values()].filter((g) => g.unitIds.every((u) => !s.history.state.bench.has(u)));
    const stuck: string[] = [];
    for (const id of ['ch2-n4', 'ch2-n5', 'ch2-n6', 'ch2-n7', 'ch2-n8']) {
      const p = puzzleOf(id);
      const { cols, rows } = p.initial.bounds;
      for (let seed = 1; seed <= 80; seed += 1) {
        let r = seed;
        const rnd = () => (r = (r * 16807) % 2147483647);
        const pick = <T,>(items: ReadonlyArray<T>): T | undefined => items[rnd() % Math.max(1, items.length)];
        // Every cell of the mat, and every push across it, from a random one on.
        const spin = <T,>(items: ReadonlyArray<T>): T[] => {
          const from = rnd() % items.length;
          return [...items.slice(from), ...items.slice(0, from)];
        };
        const cells = () => spin(Array.from({ length: cols * rows }, (_, i) => ({ x: i % cols, y: Math.floor(i / cols) })));
        const deltas = () => spin(Array.from({ length: (2 * cols - 1) * (2 * rows - 1) }, (_, i) => ({ x: (i % (2 * cols - 1)) - cols + 1, y: Math.floor(i / (2 * cols - 1)) - rows + 1 })));
        // The first allowed move of `g` that, when `touching`, leaves it touching another partner on the mat.
        const place = (s: LevelSession, g: Group, cmds: ReadonlyArray<Command>, touching: boolean): LevelSession | null => {
          for (const cmd of cmds) {
            const out = commitCommand(s, cmd);
            if (!out.ok) {
              continue;
            }
            const state = out.session.history.state;
            const moved = state.groups.get(g.id)!;
            if (!touching || onBench(out.session).some((o) => o.id !== g.id && areTouching(state, moved, o))) {
              return out.session;
            }
          }
          return null;
        };
        const takes = (g: Group): Command[] => cells().map((origin) => ({ type: 'takeGroup', groupId: g.id, origin }));
        const bring = (s: LevelSession, g: Group) => (onBench(s).length > 0 ? place(s, g, takes(g), true) : null) ?? place(s, g, takes(g), false);
        const push = (s: LevelSession) => {
          const [a, b] = onBench(s);
          const moves = (g: Group): Command[] => deltas().map((delta) => ({ type: 'moveGroup', groupId: g.id, delta }));
          return a === undefined || b === undefined ? null : (place(s, b, moves(b), true) ?? place(s, a, moves(a), true));
        };
        // A muddle: a few partners brought or sent back at random.
        let s = startSession(p, null);
        for (let i = rnd() % 6; i > 0; i -= 1) {
          const tray = inTray(s);
          const bench = onBench(s);
          const g = rnd() % 2 === 0 ? pick(tray) : undefined;
          const back = pick(bench);
          s = (g !== undefined ? place(s, g, takes(g), false) : back !== undefined ? commitFirst(s, [{ type: 'returnGroup', groupId: back.id }]) : null) ?? s;
        }
        const trail: string[] = [];
        const brought: string[] = [];
        const sentBack = new Set<string>();
        let moves = 0;
        while (moves < 24 && !s.verdict.matched) {
          const help = guidanceFor(s, asksForHelp(s) ? 2 : 1);
          const key = help.line.key as string;
          const lit = help.focus.objects;
          trail.push(`${s.step}:${onBench(s).map(groupSize).join('+') || 0}:${key}${lit.length > 0 ? '*' : ''}`);
          let next: LevelSession | null = null;
          if (key === 'hint.not-merged') {
            next = push(s);
            moves += 1;
          } else if (lit.length > 0) {
            next = s;
            for (const object of rnd() % 2 === 0 ? lit : lit.slice(0, 1)) {
              const g: Group | undefined = next.history.state.groups.get(object as never);
              if (g === undefined) {
                next = null;
              } else if (g.unitIds.every((u) => next!.history.state.bench.has(u))) {
                sentBack.add(g.id);
                next = commitFirst(next, [{ type: 'returnGroup', groupId: g.id }]);
              } else {
                brought.push(g.id);
                next = bring(next, g);
              }
              moves += 1;
              if (next === null) {
                break;
              }
            }
          } else if (key === 'hint.more.partner') {
            const bench = onBench(s);
            const latest = [...brought].reverse().find((b) => bench.some((g) => g.id === b)) ?? pick(bench)?.id;
            if (latest !== undefined) {
              sentBack.add(latest);
              next = commitFirst(s, [{ type: 'returnGroup', groupId: latest as never }]);
            }
            moves += 1;
          } else {
            const tray = inTray(s);
            const fresh = tray.filter((g) => !sentBack.has(g.id));
            const g = pick(fresh.length > 0 ? fresh : tray);
            if (g !== undefined) {
              brought.push(g.id);
              next = place(s, g, takes(g), false);
            }
            moves += 1;
          }
          if (next === null) {
            trail.push('no possible move');
            break;
          }
          s = next;
        }
        // Solved on the last step: for the boss, both ways made.
        if (!s.verdict.matched || s.step !== (p.ways ?? 1) - 1) {
          stuck.push(`${id} seed ${seed}: ${trail.join(' > ')}`);
        }
      }
    }
    expect(stuck).toEqual([]);
  });

  test('2026-10-15 review L: the next picture of a stop in steps is the next thing to build, not a mistake', () => {
    const p = puzzleOf('ch1-n6');
    const square = play(p, p.solution.slice(0, 4));
    expect(square.step).toBe(1);
    const f = feedbackFor(square);
    expect(f.tone).toBe('building');
    expect(format(f.title.key, 'zh', f.title.params)).toBe('变个样子！');
    expect(format(f.detail.key, 'en', f.detail.params)).toBe('Build it like the little picture');
    expect(guidanceFor(square, 1).focus.template).toBe(true);
    // Breaking the count on the second step is the usual feedback.
    const fewer = play(p, [...p.solution.slice(0, 4), { type: 'return', unitId: [...p.initial.units.keys()][0]! }]);
    expect(feedbackFor(fewer).tone).toBe('building');
    expect(format(feedbackFor(fewer).title.key, 'zh', feedbackFor(fewer).title.params)).toBe('还差 1 块');
  });
});

describe("Phase 19: who's missing (ch2-n5: the 2 is on the mat, find its other half)", () => {
  const text = (l: { key: string; params: Readonly<Record<string, number>> }, lang: 'zh' | 'en' = 'zh') => format(l.key as never, lang, l.params);
  const p = puzzleOf('ch2-n5');
  const two = p.given!;
  const of = (size: number) => partner(p, size).id;
  const y = [...p.initial.bench.values()][0]!.y;
  const card = (s: LevelSession, level: 0 | 1 | 2 = 0) => {
    const c = cardFor(s, level, true);
    return { tone: c.tone, title: text(c.title), detail: text(c.detail) };
  };

  test('the opening is the start: the task, which names the 2 and the 5; still so with the 2 moved; once the 2 is back, two partners', () => {
    expect(promptParams(p)).toEqual({ a: 2, n: 5 });
    expect(card(play(p, []))).toEqual({ tone: 'start', title: '动手试试看', detail: '已经有 2 了，再找一个伙伴，拼成 5' });
    expect(text(feedbackFor(play(p, [])).detail, 'en')).toBe('Here is 2. Find one more partner to make 5');
    expect(card(play(p, [{ type: 'moveGroup', groupId: two, delta: { x: 1, y: -1 } }])).tone).toBe('start');
    expect(card(play(p, [{ type: 'returnGroup', groupId: two }]))).toEqual({ tone: 'start', title: '动手试试看', detail: '找两个伙伴，拼出 5' });
    // Nothing lit at the start.
    expect(guidanceFor(play(p, []), 2).focus.objects).toEqual([]);
  });

  test('short of 5 the title never says how many are missing (that is the answer); asked-for help names the partner and lights it', () => {
    const three = play(p, [{ type: 'returnGroup', groupId: two }, { type: 'takeGroup', groupId: of(3), origin: { x: 0, y: 0 } }]);
    const f = feedbackFor(three);
    expect(f.tone).toBe('building');
    expect(text(f.title)).toBe('还不到 5');
    expect(text(f.title, 'en')).toBe('Not 5 yet');
    expect(text(f.title)).not.toMatch(/2/);
    expect(guidanceFor(three, 1).focus.objects).toEqual([]);
    const help = guidanceFor(three, 2);
    expect(text(help.line)).toBe('把 2 搬过来');
    expect(text(help.line, 'en')).toBe('Bring the 2');
    expect(help.focus.objects).toEqual([two]);
    expect(card(three, 2).detail).toBe('把 2 搬过来');
  });

  test('one too many (the 4 beside the 2): asked-for help says send the 4 back, bring the 3, and lights both', () => {
    const s = play(p, [{ type: 'takeGroup', groupId: of(4), origin: { x: 2, y } }]);
    expect(card(s)).toEqual({ tone: 'adjust', title: '多了 1 块', detail: '比 5 多了，把一个伙伴送回去' });
    const help = guidanceFor(s, 2);
    expect(text(help.line)).toBe('把 4 送回去，换 3 过来');
    expect(help.focus.objects).toEqual([of(4), of(3)]);
    // A 1 beside the 2 cannot become 5 by adding: swap, then the same named help.
    const one = play(p, [{ type: 'takeGroup', groupId: of(1), origin: { x: 2, y } }]);
    expect(card(one).title).toBe('换个伙伴试试看');
    expect(text(guidanceFor(one, 2).line)).toBe('把 1 送回去，换 3 过来');
  });

  test('the 2 sent back and 1 + 4 built: it is 5 too, then find 2 and 3, all four lit (D-063)', () => {
    const s = play(p, [
      { type: 'returnGroup', groupId: two },
      { type: 'takeGroup', groupId: of(1), origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: of(4), origin: { x: 1, y: 0 } },
    ]);
    expect(s.verdict.reason).toBe('groups-mismatch');
    expect(card(s).title).toBe('数量够了，再找对伙伴');
    const help = guidanceFor(s, 2);
    expect(text(help.line)).toBe('1 加 4 也是 5！再找 2 和 3');
    expect(help.focus.objects).toEqual([of(1), of(4), two, of(3)]);
  });

  test('three partners on the mat (the 4 sent back, 2 + 3 + 1 on make-6): asked-for help names one to send back, then the swap', () => {
    const q = puzzleOf('ch2-n6');
    const three: Command[] = [
      { type: 'returnGroup', groupId: q.given! },
      { type: 'takeGroup', groupId: partner(q, 2).id, origin: { x: 0, y: 0 } },
      { type: 'takeGroup', groupId: partner(q, 3).id, origin: { x: 2, y: 0 } },
      { type: 'takeGroup', groupId: partner(q, 1).id, origin: { x: 5, y: 0 } },
    ];
    const s = play(q, three);
    expect(card(s)).toEqual({ tone: 'adjust', title: '数量够了，再找对伙伴', detail: '找两个伙伴，拼出 6' });
    // Asked for, it used to say the same and light nothing (Phase 19 property test).
    const help = guidanceFor(s, 2);
    expect(text(help.line)).toBe('把 3 送回去');
    expect(help.focus.objects).toEqual([partner(q, 3).id]);
    const two = play(q, [...three, { type: 'returnGroup', groupId: partner(q, 3).id }]);
    expect(text(guidanceFor(two, 2).line)).toBe('把 1 送回去，换 4 过来');
    expect(guidanceFor(two, 2).focus.objects).toEqual([partner(q, 1).id, q.given]);
  });

  test('right: 2 + 3 = 5, the success line names it', () => {
    const s = play(p, p.solution);
    expect(s.verdict.matched).toBe(true);
    expect(card(s)).toEqual({ tone: 'success', title: '拼对啦！', detail: '可以去下一站啦' });
    expect(say(s)).toBe('2 加 3，一共 5');
  });

  test('every "who\'s missing?" stop: the opening asks for the other half by name of what is there', () => {
    for (const [id, a, n] of [['ch2-n5', 2, 5], ['ch2-n6', 4, 6], ['ch2-n7', 3, 7]] as const) {
      const q = puzzleOf(id);
      expect(promptParams(q)).toEqual({ a, n });
      expect(feedbackFor(play(q, [])).tone).toBe('start');
      expect(play(q, q.solution).verdict.matched).toBe(true);
    }
  });
});

describe('Phase 19: 7 made two ways (ch2-n8): the second way', () => {
  const text = (l: { key: string; params: Readonly<Record<string, number>> }, lang: 'zh' | 'en' = 'zh') => format(l.key as never, lang, l.params);
  const p = puzzleOf('ch2-n8');
  const of = (size: number) => partner(p, size).id;
  const first: Command[] = [
    { type: 'takeGroup', groupId: of(3), origin: { x: 0, y: 0 } },
    { type: 'takeGroup', groupId: of(4), origin: { x: 3, y: 0 } },
  ];

  test('the first way still on the mat: build another way (not a mistake); asked-for help: it is 7 too, find 5 and 2, all four lit', () => {
    const s = play(p, first);
    expect(s.step).toBe(1);
    const f = feedbackFor(s);
    expect(f.tone).toBe('building');
    expect(text(f.title)).toBe('换一种拼法！');
    expect(text(f.title, 'en')).toBe('Another way!');
    expect(text(f.detail)).toBe('再用另外两个伙伴拼出 7');
    expect(text(f.detail, 'en')).toBe('Make 7 with two other partners');
    expect(guidanceFor(s, 1).focus.objects).toEqual([]);
    const help = guidanceFor(s, 2);
    expect(text(help.line)).toBe('3 加 4 也是 7！再找 5 和 2');
    expect(help.focus.objects).toEqual([of(3), of(4), of(5), of(2)]);
    expect(text(cardFor(s, 2, true).detail)).toBe('3 加 4 也是 7！再找 5 和 2');
    expect(text(cardFor(s, 0, true).detail)).toBe('再用另外两个伙伴拼出 7');
  });

  test('half of the first way sent back is still "another way"; help names the one left to send back', () => {
    const s = play(p, [...first, { type: 'returnGroup', groupId: of(3) }]);
    expect(feedbackFor(s).tone).toBe('building');
    expect(text(feedbackFor(s).title)).toBe('换一种拼法！');
    expect(text(guidanceFor(s, 2).line)).toBe('把 4 送回去');
    expect(guidanceFor(s, 2).focus.objects).toEqual([of(4)]);
  });

  test('the other way is right; the first step of a fresh stop is just a free sum', () => {
    const s = play(p, [...first, { type: 'returnGroup', groupId: of(3) }, { type: 'returnGroup', groupId: of(4) }, { type: 'takeGroup', groupId: of(5), origin: { x: 0, y: 0 } }, { type: 'takeGroup', groupId: of(2), origin: { x: 5, y: 0 } }]);
    expect(s.verdict.matched).toBe(true);
    expect(say(s)).toBe('5 加 2，一共 7');
    expect(text(feedbackFor(play(p, [])).detail)).toBe('找两个伙伴，拼出 7');
  });
});
