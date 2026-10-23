import { groupSize, template } from '../core';
import type { Cell, Command, Group } from '../core';
import { CHAPTERS, CONTENT_VERSION, format, materialize } from '../content';
import type { Puzzle } from '../content';
import { asksForHelp, cardFor, feedbackFor, helpAt, matchedFeedback, partsLine, shadowDemo, shadowNext } from './hints';
import { commitCommand, revealShadow, shadowView, startSession } from './level-session';
import type { LevelSession } from './level-session';
import { SHADOW_LIT, centred, cornerOf, fill, follow, litCells, shadowCells } from './shadow';

function puzzleOf(id: string): Puzzle {
  const chapter = CHAPTERS.find((c) => c.nodes.some((n) => n.id === id))!;
  return materialize({ contentVersion: CONTENT_VERSION, chapterId: chapter.id, nodeId: chapter.nodes.find((n) => n.id === id)!.id, attemptVariant: 0, seed: 5 });
}

function play(puzzle: Puzzle, cmds: ReadonlyArray<Command>, from: LevelSession = startSession(puzzle, null)): LevelSession {
  return cmds.reduce((s, cmd) => {
    const r = commitCommand(s, cmd);
    if (!r.ok) {
      throw new Error(`${cmd.type}: ${r.reason}`);
    }
    return r.session;
  }, from);
}

const partner = (p: Puzzle, size: number): Group => [...p.initial.groups.values()].find((g) => groupSize(g) === size)!;
const take = (g: Group, x: number, y: number): Command => ({ type: 'takeGroup', groupId: g.id, origin: { x, y } });
const zh = (l: { key: string; params: Readonly<Record<string, number>> }) => format(l.key as never, 'zh', l.params);
const cells = (list: ReadonlyArray<Cell> | undefined) => (list ?? []).map((c) => `${c.x},${c.y}`).join(' ');

describe('the shadow\'s place (shadow.ts, PRD §4.2.3)', () => {
  const T = template([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }]);
  const mat = { cols: 5, rows: 4 };

  test('it starts in the middle; it lies as written', () => {
    expect(SHADOW_LIT).toBe('covered');
    expect(centred(mat, T)).toEqual({ x: 1, y: 1 });
    expect(centred({ cols: 2, rows: 1 }, T)).toEqual({ x: 0, y: 0 });
    expect(cells(shadowCells(T, { x: 1, y: 1 }))).toBe('1,1 2,1 3,1 2,2');
  });

  test('the first piece outside brings it over, the piece inside it; a piece inside, or a place off the mat, leaves it', () => {
    // A 3 along the top-left: the shadow's top row on it.
    expect(follow(mat, T, { x: 1, y: 1 }, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }])).toEqual({ x: 0, y: 0 });
    // A lone block at the right: the shadow's earliest cell that keeps it on the mat holds it; in the corner, none does.
    expect(follow(mat, T, { x: 1, y: 1 }, [{ x: 4, y: 2 }])).toEqual({ x: 2, y: 2 });
    expect(follow(mat, T, { x: 1, y: 1 }, [{ x: 4, y: 3 }])).toEqual({ x: 1, y: 1 });
    // Already inside: no move.
    expect(follow(mat, T, { x: 1, y: 1 }, [{ x: 2, y: 2 }])).toEqual({ x: 1, y: 1 });
    // A 3 down the right edge can lie in no place of the shadow: its first block on the shadow's first, if that fits; it does not.
    expect(follow(mat, T, { x: 1, y: 1 }, [{ x: 4, y: 0 }, { x: 4, y: 1 }, { x: 4, y: 2 }])).toEqual({ x: 1, y: 1 });
    expect(follow(mat, T, { x: 1, y: 1 }, [])).toEqual({ x: 1, y: 1 });
  });

  test('the corner of what was built; the cells a block is on; filling a gap with what is left', () => {
    const p = puzzleOf('ch5-n1');
    expect(cornerOf(p.initial)).toBeNull();
    const s = play(p, [take(partner(p, 3), 1, 1)]);
    expect(cornerOf(s.history.state)).toEqual({ x: 1, y: 1 });
    expect(litCells(shadowCells(T, { x: 1, y: 1 }), s.history.state)).toEqual([true, true, true, false]);
    expect(litCells(shadowCells(T, { x: 1, y: 1 }), s.history.state, () => false)).toEqual([false, false, false, false]);
    // Bigger pieces first, then single blocks; a piece of the same shape is the same move.
    const gap = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }];
    const one = [{ x: 0, y: 0 }];
    expect(fill(gap, [{ id: 'a', shape: one }, { id: 'b', shape: one }, { id: 'three', shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }] }])?.map((p2) => p2.id)).toEqual(['three', 'a']);
    expect(fill(gap, [{ id: 'two', shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }, { id: 'a', shape: one }])).toBeNull();
    // A piece that must go in goes first, wherever it fits.
    expect(fill(gap, [{ id: 'a', shape: one }, { id: 'b', shape: one }], { id: 'two', shape: [{ x: 0, y: 0 }, { x: 1, y: 0 }] })?.map((p2) => [p2.id, cells(p2.cells)])).toEqual([
      ['two', '0,0 1,0'],
      ['a', '2,0'],
      ['b', '1,1'],
    ]);
    expect(fill(gap, [], { id: 'two', shape: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }] })).toBeNull();
  });
});

describe('Shape Island\'s shadow in play (Phase 23b, PRD §4.2.3 – §4.2.5)', () => {
  test('n1: the shadow is there from the start, in the middle; the card and the ladder: into the shadow, the 3 and its cells, then the hand', () => {
    const p = puzzleOf('ch5-n1');
    const s = startSession(p, null);
    expect(s.shadow).toEqual({ origin: { x: 1, y: 1 }, shown: true });
    expect(cells(shadowView(s)?.cells)).toBe('1,1 2,1 3,1 2,2');
    expect(shadowView(s)?.lit).toEqual([false, false, false, false]);
    expect(zh(feedbackFor(s).detail)).toBe('把伙伴放进影子里');
    expect(asksForHelp(s)).toBe(true);
    const one = helpAt(s, 1);
    expect(zh(one.line)).toBe('把伙伴放进影子里');
    expect(one.focus.template).toBe(true);
    expect(one.focus.cells).toHaveLength(4);
    const two = helpAt(s, 2);
    expect(zh(two.line)).toBe('把 3 放进影子里');
    expect(two.focus.objects).toEqual([partner(p, 3).id]);
    expect(cells(two.focus.cells)).toBe('1,1 2,1 3,1');
    expect(two.demo).toBe(false);
    expect(helpAt(s, 3).demo).toBe(true);
    expect(shadowDemo(s)).toEqual({ type: 'takeGroup', groupId: partner(p, 3).id, origin: { x: 1, y: 1 } });
    // The card shows what the ladder said.
    expect(zh(cardFor(s, 2, true, two.line).detail)).toBe('把 3 放进影子里');
  });

  test('n1: the 3 outside the shadow brings the shadow over; part filled: "this bit is missing", then "put the 1 here", then the hand; right: "A mushroom!", its parts when tapped', () => {
    const p = puzzleOf('ch5-n1');
    const s = play(p, [take(partner(p, 3), 0, 0)]);
    expect(s.shadow?.origin).toEqual({ x: 0, y: 0 });
    expect(shadowView(s)?.lit).toEqual([true, true, true, false]);
    const f = feedbackFor(s);
    expect([f.tone, zh(f.title), zh(f.detail)]).toEqual(['building', '影子还没填满', '还差这里']);
    expect(asksForHelp(s)).toBe(true);
    expect(cells(helpAt(s, 1).focus.cells)).toBe('1,1');
    const two = helpAt(s, 2);
    expect(zh(two.line)).toBe('把 1 放到这里');
    expect(two.focus.objects).toEqual([partner(p, 1).id]);
    expect([two.demo, helpAt(s, 3).demo]).toEqual([false, true]);
    expect(shadowDemo(s)).toEqual({ type: 'takeGroup', groupId: partner(p, 1).id, origin: { x: 1, y: 1 } });
    const done = play(p, [take(partner(p, 1), 1, 1)], s);
    expect(done.verdict.matched).toBe(true);
    expect(zh(matchedFeedback(done))).toBe('蘑菇拼好了！');
    expect(zh(partsLine(done)!)).toBe('3 和 1，一共 4 块');
    expect(shadowView(done)?.lit).toEqual([true, true, true, true]);
    expect(helpAt(done, 1).reveal).toBeUndefined();
    expect(shadowNext(done)).toBeNull();
  });

  test('n1: a piece sticking out of the shadow is building, not a mistake; help names it and where it goes; built outside the shadow, the picture is right all the same', () => {
    const p = puzzleOf('ch5-n1');
    const s = play(p, [take(partner(p, 3), 1, 1), take(partner(p, 1), 4, 3)]);
    expect(s.shadow?.origin).toEqual({ x: 1, y: 1 });
    const f = feedbackFor(s);
    expect([f.tone, zh(f.title), zh(f.detail)]).toEqual(['building', '伸出影子了', '把它挪进影子里']);
    expect(cells(helpAt(s, 1).focus.cells)).toBe('2,2');
    const two = helpAt(s, 2);
    expect([zh(two.line), cells(two.focus.cells), two.demo]).toEqual(['把 1 挪进影子里', '2,2', false]);
    // A partner already on the mat is not carried by the hand.
    expect(shadowDemo(s)).toBeUndefined();
    // The judge does not see the shadow: a 3 along the bottom (no place in the
    // shadow for it there, so it stays) and the 1 on it, upside down, is right.
    const elsewhere = play(p, [take(partner(p, 3), 2, 3)]);
    expect(elsewhere.shadow?.origin).toEqual({ x: 1, y: 1 });
    expect(play(p, [take(partner(p, 1), 3, 2)], elsewhere).verdict.matched).toBe(true);
  });

  test('n3: the decoy 2 in the shadow with the 3: "right count, swap partners" and its own help, not the shadow\'s', () => {
    const p = puzzleOf('ch5-n3');
    const origin = startSession(p, null).shadow!.origin;
    const s = play(p, [take(partner(p, 3), origin.x, origin.y), take(partner(p, 2), origin.x + 1, origin.y + 1)]);
    expect(s.verdict.matched).toBe(false);
    expect(zh(feedbackFor(s).title)).toBe('数量够了，再找对伙伴');
    expect(zh(helpAt(s, 2).line)).toBe('把 2 送回去');
  });

  test('n7: no shadow at the start: "build the dog like the little picture"; the first ask brings it, then the ladder goes on', () => {
    const p = puzzleOf('ch5-n7');
    const s = startSession(p, null);
    expect(s.shadow?.shown).toBe(false);
    expect(shadowView(s)).toBeNull();
    expect(shadowDemo(s)).toBeUndefined();
    expect(zh(feedbackFor(s).detail)).toBe('照着小图拼小狗');
    const one = helpAt(s, 1);
    expect([zh(one.line), one.reveal]).toEqual(['影子来帮忙啦', true]);
    const shown = revealShadow(s);
    expect(shown.shadow?.shown).toBe(true);
    expect(revealShadow(shown)).toBe(shown);
    // The biggest piece first: the dog's body.
    expect(zh(helpAt(shown, 2).line)).toBe('把 3 放进影子里');
    expect(helpAt(shown, 3).demo).toBe(true);
  });

  test('n8: the boss: the first ask lights the little picture, the second brings the shadow, the third names the 3 with the hand; it blasts off', () => {
    const p = puzzleOf('ch5-n8');
    const s = startSession(p, null);
    const one = helpAt(s, 1);
    expect([zh(one.line), one.focus.template, one.reveal]).toEqual(['照着小图拼小火箭', true, undefined]);
    expect(helpAt(s, 2).reveal).toBe(true);
    const three = helpAt(revealShadow(s), 3);
    expect([zh(three.line), three.demo]).toEqual(['把 3 放进影子里', true]);
    // No shadow, blocks on the mat: Number Island's shape help, as on any picture.
    const built = play(p, [take(partner(p, 3), 0, 0)]);
    expect(zh(feedbackFor(built).title)).not.toBe('影子还没填满');
    expect(zh(matchedFeedback(play(p, p.solution)))).toBe('小火箭，发射！');
  });

  test('n6: the corner, then the boat\'s shadow on the corner\'s top-left; "now a new shape!", and help names the block to move and where', () => {
    const p = puzzleOf('ch5-n6');
    const start = startSession(p, null);
    expect(start.shadow?.origin).toEqual({ x: 1, y: 0 });
    const corner = play(p, p.solution.slice(0, 5));
    expect(corner.step).toBe(1);
    expect(corner.shadow?.origin).toEqual({ x: 0, y: 0 });
    expect(cells(shadowView(corner)?.cells)).toBe('0,0 1,0 0,1 0,2 1,2');
    expect(zh(feedbackFor(corner).title)).toBe('变个样子！');
    expect(asksForHelp(corner)).toBe(true);
    expect(cells(helpAt(corner, 1).focus.cells)).toBe('1,0');
    const two = helpAt(corner, 2);
    expect(zh(two.line)).toBe('把 1 挪进影子里');
    expect(shadowDemo(corner)).toMatchObject({ type: 'move', to: { x: 1, y: 0 } });
    const boat = play(p, p.solution.slice(5), corner);
    expect(boat.verdict.matched).toBe(true);
    expect(zh(matchedFeedback(boat))).toBe('变了样子，还是 5 块');
  });

  test('saved work: the shadow takes in what is there; past a step, it lies on the corner of what was built; a stop with no shadow has none', () => {
    const p = puzzleOf('ch5-n1');
    const work = play(p, [take(partner(p, 3), 0, 0)]).history.state;
    expect(startSession(p, work).shadow).toEqual({ origin: { x: 0, y: 0 }, shown: true });
    const six = puzzleOf('ch5-n6');
    expect(startSession(six, play(six, six.solution.slice(0, 5)).history.state).shadow?.origin).toEqual({ x: 0, y: 0 });
    expect(startSession(puzzleOf('ch1-n13'), null).shadow).toBeNull();
    expect(shadowView(startSession(puzzleOf('ch1-n3'), null))).toBeNull();
    expect(helpAt(startSession(puzzleOf('ch1-n3'), null), 1).reveal).toBeUndefined();
  });
});
