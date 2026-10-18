import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Confetti, FONT, LEVEL_CHROME, MERGE_ON, Spotlight, Stage, THEME, cheerFor, colorsFor, computeGeometry, trayObjects, useBreathe, usePop } from '../blocks-ui';
import { BOSS_ENTRANCE, COUNT_TO_PASS, copyKey, format, hueFor, materialize, nodeId as makeNodeId } from '../content';
import type { Lang, NodeId, Puzzle } from '../content';
import type { BenchState, Command, UnitId } from '../core';
import { chapterOf, nextNodeOf, statusOf } from '../progress';
import { createCorrectionVoice } from './correction-voice';
import { asksForHelp, biggestFirst, cardFor, feedbackFor, guidanceFor, helpAt, matchedFeedback, promptParams } from './hints';
import type { AskedHelp, Line } from './hints';
import { AnswerFeedback } from './AnswerFeedback';
import { Cloud, SkyCloud } from './Cloud';
import { Icon } from './icons';
import type { IconName } from './icons';
import { atStart, commitCommand, countOrder, countProgress, countTap, countWordsStale, demoMove, matOf, previewCommand, recount, solvedEquation, startSession, undoCommand } from './level-session';
import type { LevelSession } from './level-session';
import { LevelRecovery } from './LevelRecovery';
import { useProgress } from './progress-store';
import { play } from './sound';
import { AUTO_SPEECH } from './speech-policy';
import { ParentGate, PillButton, RoundButton } from './ui';
import { say, voice } from './voice';

const MENU = {
  zh: { help: '帮助', undo: '撤销', close: '继续', next: '下一站', done: '回地图', again: '再玩一次', restart: '重新挑战', map: '回地图', recount: '再数一遍', parent: '家长区', hold: '按住进入家长区', menu: '菜单' },
  en: { help: 'Help', undo: 'Undo', close: 'Keep playing', next: 'Next stop', done: 'Back to map', again: 'Play again', restart: 'Start over', map: 'Back to map', recount: 'Count again', parent: 'Parents', hold: 'Press and hold for the parents\' area', menu: 'Menu' },
} as const;

// The "like this" hand: after this long with an empty mat and no touch, at
// most DEMO_MAX times a visit. The very first stop shows it sooner: a new
// player has nothing to go on but the pictures.
const DEMO_AFTER_MS = 5000;
const DEMO_FIRST_STOP_MS = 1800;
const DEMO_SHOWN_MS = 4200;
const DEMO_MAX = 2;
const FIRST_STOP = 'ch1-n1';
// The first time a stop needs changing and the tip sits untouched this long,
// the card's speaker pulses twice: the help is in there (2026-10-16 review B-3).
// Once a visit; no sound, no words.
export const NUDGE_AFTER_MS = 3000;
// A solve comes in two beats (Phase 20, play review Q2: the paper flew on the
// second block of three, then the third turned it into "one too many"). The
// drop that makes it right gets the success sound and smiling faces at once;
// the paper, the number's own move and the way on ("next") wait this long, and
// wait again while a finger is dragging. The completion is saved at once.
export const SOLVE_SETTLE_MS = 600;
// The first ask for help when the count is off numbers the blocks on the mat,
// one this often, with the counting sound and no words (Phase 20 Q3).
export const COUNT_UP_STEP_MS = 320;

function isBossStop(nodeId: NodeId): boolean {
  return chapterOf(nodeId).nodes.find((n) => n.id === nodeId)?.role === 'boss';
}

// The correction a committed answer needs, if it needs one. Building towards
// the answer is not a mistake and has none.
function correctionOf(session: LevelSession): Line | null {
  const f = feedbackFor(session);
  return f.tone === 'adjust' ? f.detail : null;
}

// The buttons under a right (or finished) answer are the host's; these are
// what it gets to build them with.
export interface PlayActionParts {
  readonly solved: boolean;
  readonly compact: boolean;
  readonly landscape: boolean;
  // The breathing for the bright button (the way on once right).
  readonly breathe: ReturnType<typeof useBreathe>;
  // "Play again" (the same puzzle from the start, its own round), as a pill
  // and as the round icon used where a row is short of room.
  readonly again: { readonly pill: ReactNode; readonly round: ReactNode };
}

// Where a puzzle played on the level page comes from and where it goes
// (Phase 21): a map stop is saved move by move, completed, kept in the album
// and leads on to the next stop (LevelScreen); a random puzzle from free play
// keeps nothing at all (ChallengeScreen). The play is the same (LevelPlay).
export interface PlayHost {
  // Saved work to open with, and whether the puzzle was finished before this visit.
  readonly work: BenchState | null;
  readonly finished: boolean;
  // A boss: its star, the fanfare, more paper, the 17's "biggest first".
  readonly boss: boolean;
  // A boss's entrance outline (BOSS_ENTRANCE).
  readonly entrance: boolean;
  // The very first stop shows the "like this" hand sooner.
  readonly firstStop: boolean;
  // COUNT_TO_PASS: the way on waits for a full count, the first time.
  readonly countToPass: boolean;
  // The opening mat (which may already be right), then every change to it.
  readonly onOpen: (session: LevelSession) => void;
  readonly onMat: (session: LevelSession) => void;
  // "Play again" / "start over" asks first: false keeps the round as it is.
  readonly onReplay: () => boolean;
  // "Start over" in the menu.
  readonly restartable: boolean;
  // What the card says under a right answer.
  readonly next: (session: LevelSession) => Line;
  // The buttons under a right (or finished) answer; null: none.
  readonly actions: (parts: PlayActionParts) => ReactNode;
  // The menu's way out.
  readonly exit: { readonly title: string; readonly icon: IconName; readonly testID: string; readonly onPress: () => void };
}

// The puzzle being played: the mat, the card, the cloud, help, counting, the
// two-beat solve and the menu. It reads and writes no progress itself.
export function LevelPlay({ puzzle, lang, host }: { readonly puzzle: Puzzle; readonly lang: Lang; readonly host: PlayHost }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  // Landscape phones: the target and buttons move to a side column so the stage keeps its height.
  const landscape = win.width > win.height;
  const compact = !landscape && win.height < LEVEL_CHROME.compactBelow;
  const text = MENU[lang];
  const { onOpen, onMat: saveWork, onReplay, boss, firstStop } = host;
  const [session, setSession] = useState<LevelSession | null>(null);
  const sessionRef = useRef<LevelSession | null>(null);
  // Whether the stop was finished before this visit (COUNT_TO_PASS leaves those alone).
  const [finishedBefore, setFinishedBefore] = useState(false);

  // Spoken corrections follow one timing rule (see correction-voice.ts). They
  // queue (interrupt: false) so counting words and the prompt are never cut off.
  const [corrections] = useState(() => createCorrectionVoice({ stop: () => voice.stop() }));
  // How much help the current answer has had. `pointed`: the correction came
  // on its own (or a step was done), pointing only where that gives nothing
  // away. `asks`: how many times the child asked (the card or the help
  // button), which climbs the help ladder (hints.ts HELP_LADDER_STEPS). Any
  // change to the answer starts both again.
  const [pointed, setPointed] = useState(false);
  const [asks, setAsks] = useState(0);
  const asksRef = useRef(0);
  const setAskCount = useCallback((n: number) => {
    asksRef.current = n;
    setAsks(n);
  }, []);
  // After the child sends back what asked-for help named, what it lit in the
  // tray (the one to bring) stays lit until the next move (Phase 20 Q4).
  const [carry, setCarry] = useState<ReadonlyArray<string>>([]);
  // The blocks on the mat numbered one by one for the first ask (display only).
  const [countUp, setCountUp] = useState<{ readonly units: ReadonlyArray<UnitId>; readonly shown: number } | null>(null);
  useEffect(() => {
    if (countUp === null || countUp.shown >= countUp.units.length) {
      return;
    }
    const t = setTimeout(() => {
      play('count', countUp.shown + 1);
      setCountUp({ ...countUp, shown: countUp.shown + 1 });
    }, COUNT_UP_STEP_MS);
    return () => clearTimeout(t);
  }, [countUp]);
  const clearHelp = useCallback(() => {
    setPointed(false);
    setAskCount(0);
    setCarry([]);
    setCountUp(null);
  }, [setAskCount]);
  useEffect(
    () =>
      corrections.setSpeaker((l) => {
        if (AUTO_SPEECH.correction) {
          say(lang, l.key, l.params, false);
        }
        setPointed(true);
        return AUTO_SPEECH.correction;
      }),
    [corrections, lang],
  );
  useEffect(() => () => corrections.dispose(), [corrections]);

  useEffect(() => {
    if (sessionRef.current?.whole === puzzle) {
      return;
    }
    const s = startSession(puzzle, host.work, host.finished);
    setFinishedBefore(host.finished);
    sessionRef.current = s;
    setSession(s);
    clearHelp();
    // Saved work that is already right shows as right, without a second
    // celebration (the host keeps it: a stop's album picture).
    onOpen(s);
    play('arrive');
    if (AUTO_SPEECH.prompt) {
      say(lang, puzzle.prompt, promptParams(puzzle));
    }
    corrections.answer(correctionOf(s));
    // Only when the puzzle (the stop) changes; the saved work is read once at entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle]);

  // The solve event the stage and badge animate: a fresh number per solve, and
  // 0 again as soon as anything else changes the bench, so rearranging, undoing,
  // replaying or a block mounting later never replays an old celebration.
  const [celebration, setCelebration] = useState(0);
  // The hop for a finished step of a stop asked in steps (no paper, no "next").
  const [stepHop, setStepHop] = useState(0);
  const solves = useRef(0);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => corrections.pause(menuOpen), [corrections, menuOpen]);
  // A finished count closes the loop on the total (2026-10-15 review, PRD §3
  // goal 2): the number on the cloud pops, "n in all" is said once and every
  // counted block blinks together. `counts` numbers the finished rounds.
  const [counts, setCounts] = useState(0);
  const countRounds = useRef(0);
  // The cloud pops on a solve and on a finished count.
  const [badgePops, setBadgePops] = useState(0);
  const pop = usePop(badgePops);
  // The second beat of a solve (SOLVE_SETTLE_MS): which solve waits for it
  // (0: none), whether a finger is down, and its timer.
  const [settling, setSettling] = useState(false);
  const pendingSolve = useRef(0);
  const dragging = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdSettle = useCallback(() => {
    if (settleTimer.current !== null) {
      clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
  }, []);
  const armSettle = useCallback(() => {
    holdSettle();
    if (pendingSolve.current === 0 || dragging.current) {
      return;
    }
    settleTimer.current = setTimeout(() => {
      settleTimer.current = null;
      setCelebration(pendingSolve.current);
      setBadgePops((n) => n + 1);
      pendingSolve.current = 0;
      setSettling(false);
    }, SOLVE_SETTLE_MS);
  }, [holdSettle]);
  const dropSettle = useCallback(() => {
    holdSettle();
    pendingSolve.current = 0;
    setSettling(false);
  }, [holdSettle]);
  useEffect(() => holdSettle, [holdSettle]);

  // Anything the child does puts the demo away and starts its wait again.
  const [demo, setDemo] = useState(0);
  const [stirred, setStirred] = useState(0);
  const demos = useRef(0);
  const stir = useCallback(() => {
    setDemo(0);
    setStirred((n) => n + 1);
  }, []);
  // A "who's missing?" stop opens with a partner on the mat: that counts as empty here (Phase 19).
  const emptyMat = session !== null && atStart(session) && !session.verdict.matched;

  const [nudge, setNudge] = useState(0);
  const nudged = useRef(false);
  const tipWaiting = session !== null && asks === 0 && feedbackFor(session).tone === 'adjust';
  useEffect(() => {
    if (!tipWaiting || menuOpen || nudged.current) {
      return;
    }
    // Any change, count or drag (session, stirred) starts the wait again.
    const t = setTimeout(() => {
      nudged.current = true;
      setNudge(1);
    }, NUDGE_AFTER_MS);
    return () => clearTimeout(t);
  }, [tipWaiting, menuOpen, session, stirred]);
  useEffect(() => {
    if (!emptyMat || menuOpen || demos.current >= DEMO_MAX) {
      return;
    }
    const show = setTimeout(
      () => {
        demos.current += 1;
        setDemo(demos.current);
      },
      firstStop && demos.current === 0 ? DEMO_FIRST_STOP_MS : DEMO_AFTER_MS,
    );
    const hide = setTimeout(() => setDemo(0), (firstStop && demos.current === 0 ? DEMO_FIRST_STOP_MS : DEMO_AFTER_MS) + DEMO_SHOWN_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [emptyMat, menuOpen, stirred, firstStop]);


  // History (completedNodeIds) only unlocks the map. What the screen shows as
  // right or wrong is the current verdict; the celebration is the solve event.
  const update = useCallback(
    (next: LevelSession, solvedNow: boolean, stepDone = false) => {
      const before = sessionRef.current;
      sessionRef.current = next;
      setSession(next);
      // Blocks on or off mid-count: the numbers still queued are for another mat.
      if (before !== null && countWordsStale(before, next)) {
        voice.stop();
      }
      // Asked-for help named a partner to send back and the child did: what it
      // lit that has not moved (the one to bring) stays lit until the next move.
      const lit = before !== null && asksRef.current > 0 ? helpAt(before, asksRef.current).focus.objects : [];
      const placeOf = (s: LevelSession, id: string) => {
        const state = s.history.state;
        const units = state.groups.get(id as never)?.unitIds ?? [id as UnitId];
        return units.every((u) => state.bench.has(u)) ? 'bench' : 'tray';
      };
      const sent = before !== null && lit.some((id) => placeOf(before, id) === 'bench' && placeOf(next, id) === 'tray');
      // A step done: the new picture lights up at once (help level 1 points at it).
      setPointed(stepDone && !solvedNow);
      setAskCount(0);
      setCountUp(null);
      setCarry(sent && before !== null ? lit.filter((id) => placeOf(before, id) === placeOf(next, id)) : []);
      saveWork(next);
      // Before the success line: a stale correction is stopped, the success line is not.
      corrections.answer(correctionOf(next));
      // Two other partners that make the total too (Phase 20, F5): the same
      // little celebration as a step done, once, as the mat turns into it.
      const sameSum = (s: LevelSession | null) => s !== null && feedbackFor(s).title.key === copyKey('feedback.same-sum');
      if ((stepDone && !solvedNow) || (!solvedNow && sameSum(next) && !sameSum(before))) {
        // One picture made, the next to make with the same blocks: a hop, the
        // success sound and the cloud's pop; the paper waits for the last one.
        solves.current += 1;
        setStepHop(solves.current);
        setCelebration(0);
        setBadgePops((n) => n + 1);
        play('success');
        return;
      }
      setStepHop(0);
      if (solvedNow) {
        // The first beat now: the sound and the smiles. The paper, the number's
        // move and the way on follow after SOLVE_SETTLE_MS (armSettle).
        solves.current += 1;
        pendingSolve.current = solves.current;
        setSettling(true);
        setCelebration(0);
        play(boss ? 'fanfare' : 'success');
        if (AUTO_SPEECH.success) {
          const fb = matchedFeedback(next);
          say(lang, fb.key, fb.params);
        }
        armSettle();
      } else {
        setCelebration(0);
        // Wrong again before the second beat: it never comes.
        if (!next.verdict.matched) {
          dropSettle();
        }
        // A soft "hmm?" when the answer turns into one that needs changing; not
        // again while it stays wrong, so moving things around is not nagged.
        if (feedbackFor(next).tone === 'adjust' && (before === null || feedbackFor(before).tone !== 'adjust')) {
          play('adjust');
        }
      }
    },
    [saveWork, boss, lang, corrections, setAskCount, armSettle, dropSettle],
  );

  const onCommand = useCallback(
    (cmd: Command): boolean => {
      const current = sessionRef.current;
      if (current === null) {
        return false;
      }
      const r = commitCommand(current, cmd);
      if (!r.ok) {
        return false;
      }
      update(r.session, r.solvedNow, r.stepDone);
      return true;
    },
    [update],
  );

  const onPreview = useCallback((cmd: Command): boolean => {
    const current = sessionRef.current;
    return current === null ? false : previewCommand(current, cmd);
  }, []);

  const onTapUnit = useCallback(
    (unitId: UnitId) => {
      const current = sessionRef.current;
      if (current === null) {
        return;
      }
      const { session: next, outcome } = countTap(current, unitId);
      sessionRef.current = next;
      setSession(next);
      // The child counts for itself: the numbers help put up give way.
      setCountUp(null);
      corrections.activity();
      stir();
      if (outcome.kind === 'counted') {
        play(outcome.complete ? 'counted' : 'count', outcome.index);
        if (AUTO_SPEECH.countNumbers) {
          say(lang, copyKey(`number.${Math.min(outcome.index, 17)}`), {}, false);
        }
        if (outcome.complete) {
          countRounds.current += 1;
          setCounts(countRounds.current);
          setBadgePops((n) => n + 1);
          if (AUTO_SPEECH.countTotal) {
            say(lang, copyKey('count.total'), { n: outcome.total }, false);
          }
        }
      }
    },
    [lang, corrections, stir],
  );

  // A right mat cleared by "play again" (or "start over") comes back with
  // undo once the new round has nothing left to undo (Phase 20 Q8).
  const replayed = useRef<LevelSession | null>(null);
  // Pieces joining into one number: their notes, then the total's (Phase 20 F1).
  const onJoin = useCallback((parts: ReadonlyArray<number>, total: number) => play('join', total, parts), []);

  // A block or partner in the tray says its own number when tapped (Phase 20
  // Q11): asked for, so not automatic speech; no count, no change to the mat.
  const onTapTray = useCallback(
    (n: number) => {
      corrections.activity();
      stir();
      say(lang, copyKey(`number.${Math.min(n, 17)}`), {});
    },
    [lang, corrections, stir],
  );

  const onUndo = useCallback(() => {
    const current = sessionRef.current;
    if (current === null) {
      return;
    }
    const kept = replayed.current;
    if (current.history.past.length === 0 && kept !== null) {
      replayed.current = null;
    }
    const back = undoCommand(current) ?? (current.history.past.length === 0 ? kept : null);
    if (back !== null) {
      if (countWordsStale(current, back)) {
        voice.stop();
      }
      sessionRef.current = back;
      setSession(back);
      setCelebration(0);
      dropSettle();
      clearHelp();
      saveWork(back);
      corrections.answer(correctionOf(back));
    }
  }, [saveWork, corrections, dropSettle, clearHelp]);

  const onRecount = useCallback(() => {
    const current = sessionRef.current;
    if (current === null) {
      return;
    }
    // The old round's words (and its total) give way to the new count at once.
    voice.stop();
    const next = recount(current);
    sessionRef.current = next;
    setSession(next);
    setCountUp(null);
  }, []);

  // Re-challenge a finished stop: the completion and the unlocked map stay, the
  // work is cleared and this round's answer and celebration start over.
  const onRechallenge = useCallback(() => {
    if (!onReplay()) {
      return;
    }
    voice.stop();
    const before = sessionRef.current;
    replayed.current = before !== null && before.verdict.matched ? before : null;
    const fresh = startSession(puzzle, null);
    sessionRef.current = fresh;
    setSession(fresh);
    setCelebration(0);
    setStepHop(0);
    dropSettle();
    clearHelp();
    corrections.answer(null);
    play('arrive');
    if (AUTO_SPEECH.prompt) {
      say(lang, puzzle.prompt, promptParams(puzzle));
    }
  }, [onReplay, puzzle, lang, corrections, dropSettle, clearHelp]);

  // The help button and the feedback card ask for help. Help that has
  // something to correct climbs a rung each time it is asked on the same answer
  // (hints.ts helpAt) and the card shows what it said; otherwise the card's own
  // line again (the task, the next step), pointing at the shape picture on a
  // shape stop. A right answer says what was built, then what the card says.
  const nextLine = host.next;
  const onAskHelp = useCallback(() => {
    const current = sessionRef.current;
    if (current === null) {
      return;
    }
    const f = feedbackFor(current);
    corrections.heard(f.detail);
    // Found the help on its own: no need to point at it any more this visit.
    nudged.current = true;
    const n = asksRef.current + 1;
    setAskCount(n);
    if (asksForHelp(current, f)) {
      const help = helpAt(current, n);
      say(lang, help.line.key, help.line.params);
      if (help.countUp) {
        const bench = current.history.state.bench;
        setCountUp({ units: [...bench.keys()].sort((a, b) => bench.get(a)!.y - bench.get(b)!.y || bench.get(a)!.x - bench.get(b)!.x), shown: 0 });
      }
      return;
    }
    if (f.tone === 'success') {
      const built = matchedFeedback(current);
      const card = nextLine(current);
      say(lang, built.key, built.params);
      // (A card that already says what was built says it once.)
      if (card.key !== built.key || JSON.stringify(card.params) !== JSON.stringify(built.params)) {
        say(lang, card.key, card.params, false);
      }
      return;
    }
    say(lang, f.detail.key, f.detail.params);
    // The 17 boss on an empty mat: which partner to start with.
    const big = boss ? biggestFirst(current) : null;
    if (big !== null) {
      say(lang, big.line.key, big.line.params, false);
    }
  }, [lang, corrections, boss, nextLine, setAskCount]);

  const onDragActive = useCallback(
    (active: boolean) => {
      corrections.pause(active, 'drag');
      // A finger down holds the second beat of a solve; letting go waits again.
      dragging.current = active;
      if (active) {
        holdSettle();
        stir();
      } else {
        armSettle();
      }
    },
    [corrections, stir, holdSettle, armSettle],
  );

  const onPrompt = useCallback(() => {
    corrections.activity();
    say(lang, puzzle.prompt, promptParams(puzzle));
  }, [lang, puzzle, corrections]);

  const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null);
  const onStageLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStageSize({ width, height });
  }, []);

  // The tray's objects come from the stop's starting material, never from the
  // current state, so taking things out cannot reshuffle what is left.
  const objects = useMemo(() => trayObjects(puzzle.initial), [puzzle]);
  const geometry = useMemo(() => {
    if (stageSize === null) {
      return null;
    }
    return computeGeometry(stageSize.width, stageSize.height, puzzle.initial.bounds, objects.map((o) => o.footprint));
  }, [stageSize, puzzle, objects]);

  const order = useMemo(() => (session === null ? new Map<UnitId, number>() : countOrder(session)), [session]);
  const guide = useMemo((): AskedHelp | null => (session === null ? null : asks > 0 ? helpAt(session, asks) : pointed ? { ...guidanceFor(session, 1), countUp: false } : null), [session, asks, pointed]);
  const biggest = useMemo(() => (session === null || asks === 0 || !boss ? null : biggestFirst(session)), [session, asks, boss]);
  const spotlight = useMemo(
    () => [...(guide !== null && guide.focus.objects.length > 0 ? guide.focus.objects : carry), ...(biggest?.focus.objects ?? [])],
    [guide, carry, biggest],
  );
  const shownCounts = useMemo(() => (countUp === null ? order : new Map(countUp.units.slice(0, countUp.shown).map((u, i) => [u, i + 1]))), [countUp, order]);
  const breathe = useBreathe(session?.verdict.matched ?? false);

  if (session === null) {
    return <View style={[styles.root, { paddingTop: insets.top }]} />;
  }

  // A right answer's card says what the host says comes next.
  const card = cardFor(session, asks > 0 ? 2 : 0, true, guide?.line);
  const feedback = card.tone === 'success' ? { ...card, detail: host.next(session) } : card;
  // The stop as asked right now (the current step's picture on a stop in steps).
  const q = session.puzzle.question;
  const title = solvedEquation(session) ?? (q.kind === 'addition_exact' ? `${q.operands[0]} + ${q.operands[1]}` : String(q.kind === 'sum_composition' ? q.sum : q.target));
  const counting = countProgress(session);
  // The hand shows the first move of the reference answer: on a partner stop a
  // whole partner (never a decoy), on a loose stop one block. Past the first way
  // of a two-ways stop, a partner of the other way; on a "who's missing?" stop
  // the other half, put down beside the partner already there (Phase 19); on a
  // "send the extra away" stop the extra, from the mat back to the tray (Phase 21).
  const first = demoMove(session);
  const demoPiece = first === undefined ? undefined : first.type === 'takeGroup' || first.type === 'returnGroup' ? (first.groupId as string) : first.type === 'take' ? (first.unitId as string) : undefined;
  const demoTo = puzzle.given !== undefined && first?.type === 'takeGroup' ? first.origin : undefined;
  const template = session.puzzle.display.template;
  const isBoss = boss;
  const solved = session.verdict.matched;
  const groundTop = geometry === null || geometry.arrangement !== 'below' ? null : geometry.tray.y - 18;
  const small = compact || landscape;
  const targetNumber = q.kind === 'addition_exact' ? q.operands[0] + q.operands[1] : q.kind === 'sum_composition' ? q.sum : q.target;
  const targetColors = colorsFor(hueFor(targetNumber));
  // Each number celebrates its own way; the 8 brick drives off, 17 stands and waves (cheer.ts).
  const picture = session.puzzle.display.template;
  const cheer = cheerFor(targetNumber, { boss: isBoss, shape: picture === null ? null : { w: Math.max(...picture.cells.map((c) => c.x)) + 1, h: Math.max(...picture.cells.map((c) => c.y)) + 1 } });
  // The number to make sits on a cloud; a boss cloud wears a star.
  // The whole cloud says the task again, not just the number on it (2026-10-16
  // review B-2: only the digit, 24px wide, answered a tap).
  const badge = (
    <Animated.View style={[styles.badgeWrap, small ? styles.badgeWrapCompact : null, pop]}>
      <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPrompt} testID="prompt">
        <Cloud small={small} tone={solved ? 'solved' : isBoss ? 'boss' : 'plain'}>
          <Text
            style={[styles.target, small ? styles.targetCompact : null, title.length > 2 ? (small ? styles.targetWideCompact : styles.targetWide) : null, title.length > 5 ? (small ? styles.targetEquationCompact : styles.targetEquation) : null, title.includes('\n') ? (small ? styles.targetTwoCompact : styles.targetTwo) : null]}>
            {title}
          </Text>
        </Cloud>
      </Pressable>
      {isBoss ? <Text pointerEvents="none" style={[styles.bossStar, small ? styles.bossStarCompact : null]}>★</Text> : null}
    </Animated.View>
  );
  // The shape to build, drawn big enough to read at a glance (it was 11px a cell).
  const step = landscape ? 15 : compact ? 16 : 20;
  const templateSize = template === null ? null : { width: (Math.max(...template.cells.map((c) => c.x)) + 1) * step + 8, height: (Math.max(...template.cells.map((c) => c.y)) + 1) * step + 8 };
  const templatePreview =
    template !== null && templateSize !== null ? (
      <View style={[styles.templateBox, templateSize]} testID="template-preview">
        {template.cells.map((c) => (
          <View key={`${c.x},${c.y}`} style={[styles.templateCell, { left: 4 + c.x * step, top: 4 + c.y * step, width: step - 2, height: step - 2, borderRadius: step * 0.28, backgroundColor: targetColors.fill, borderColor: targetColors.edge }]} />
        ))}
        {/* "Build it like the little picture": the picture the line means lights up. */}
        {guide?.focus.template ? <Spotlight rect={{ x: 0, y: 0, ...templateSize }} radius={12} /> : null}
      </View>
    ) : null;
  // A COUNT_TO_PASS stop solved for the first time: the way on appears once
  // every block is counted (empty by default, see content/catalog).
  const countFirst = host.countToPass && !finishedBefore && solved && !counting.complete;
  const again = {
    pill: <PillButton title={text.again} onPress={onRechallenge} compact={compact} testID="again" />,
    round: <RoundButton label={<Icon name="again" size={26} />} accessibilityLabel={text.again} onPress={onRechallenge} size={compact ? 44 : 48} testID="again" />,
  };
  // The host's buttons, after the second beat (Phase 20 Q2).
  const parts = countFirst || settling ? null : host.actions({ solved, compact, landscape, breathe, again });
  const actions =
    parts === null ? null : (
      <Animated.View entering={FadeInDown.duration(220)} style={landscape ? styles.actionsColumn : styles.actionsRow} pointerEvents="box-none">
        {parts}
      </Animated.View>
    );
  // Counting: the running number while counting, then a clear way to count again.
  const countChip =
    counting.counted === 0 ? null : counting.complete ? (
      <View style={styles.recount}>
        <RoundButton label={<Icon name="count" size={26} />} accessibilityLabel={text.recount} testID="recount" onPress={onRecount} />
        <Text style={styles.recountLabel}>{text.recount}</Text>
      </View>
    ) : (
      <View style={styles.countChip} testID="count-chip">
        <Text style={styles.countChipText}>{counting.counted}</Text>
      </View>
    );
  const stage = (
    <View style={styles.stageArea} onLayout={onStageLayout} testID="stage">
      {/* Scenery only: it reaches past the stage (left / right -40) and must never take a tap
          (2026-10-16 review #1: it covered the right of "next" on an iPad in landscape). */}
      {groundTop !== null ? <View pointerEvents="none" style={[styles.ground, { top: groundTop }]} testID="ground" /> : null}
      {geometry !== null ? (
        <Stage
          state={session.history.state}
          geometry={geometry}
          trayObjects={objects}
          // The menu overlay covers the stage; toggling gestures off and on loses the first tap after it closes.
          enabled
          countOrder={shownCounts}
          matched={session.verdict.matched}
          // The faces agree with the card: puzzled while it gives a tip, happy when right.
          mood={feedback.tone === 'adjust' ? 'puzzled' : feedback.tone === 'success' ? 'happy' : 'calm'}
          celebrateTick={celebration || stepHop}
          cheer={stepHop > 0 ? 'hop' : cheer}
          onCommand={onCommand}
          onPreview={onPreview}
          onTapUnit={onTapUnit}
          onTapTray={onTapTray}
          onDragActive={onDragActive}
          // Right (after the second beat), the joined pieces become one number (merge.ts MERGE_ON).
          merge={MERGE_ON === 'touch' || (solved && !settling)}
          onJoin={onJoin}
          onFeel={play}
          spotlight={spotlight}
          demo={demo}
          demoPiece={demoPiece}
          demoTo={demoTo}
          demoBack={first?.type === 'returnGroup'}
          // A boss's entrance (Phase 21): the answer's outline until it is solved,
          // a cell lit for each block on the part of the mat being judged.
          outline={host.entrance && !solved ? { n: targetNumber, lit: matOf(session).bench.size } : undefined}
          wink={counting.complete ? counts : 0}
        />
      ) : null}
      {geometry !== null ? (
        <Confetti
          tick={celebration}
          x={geometry.bench.x + geometry.bench.width / 2}
          y={geometry.bench.y + geometry.bench.height * 0.45}
          colors={[targetColors.fill, THEME.amber, THEME.white, targetColors.pale, THEME.leaf]}
          count={isBoss ? 36 : 18}
          duration={isBoss ? 1300 : 1000}
        />
      ) : null}
    </View>
  );
  const menuButton = <RoundButton label={<Icon name="menu" size={26} />} accessibilityLabel={text.menu} testID="menu" onPress={() => setMenuOpen(true)} />;
  const promptLine = (
    <AnswerFeedback feedback={feedback} lang={lang} onReplay={onAskHelp} narrow={landscape} compact={compact} nudge={nudge} />
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }, landscape ? styles.rootRow : null]}>
      {landscape ? (
        <View style={styles.side} testID="level-side">
          <View style={styles.sideTop}>
            <View style={styles.sideCount}>{countChip}</View>
            {menuButton}
          </View>
          {/* Side by side: the column has to fit a short landscape screen with the success buttons. */}
          <View style={styles.sideTarget}>
            {badge}
            {templatePreview}
          </View>
          {promptLine}
          <View style={styles.sideFill} />
          {actions}
        </View>
      ) : (
        <>
          <SkyCloud x={10} y={insets.top + (compact ? 40 : 58)} width={compact ? 48 : 60} />
          <SkyCloud x={win.width - insets.right - (compact ? 112 : 128)} y={insets.top + (compact ? 56 : 74)} width={compact ? 38 : 46} flip />
          <View style={[styles.header, compact ? styles.headerCompact : null]} testID="level-header">
            {badge}
            {templatePreview}
          </View>
          {promptLine}
        </>
      )}
      {stage}
      {landscape ? null : (
        <View style={[styles.footer, compact ? styles.footerCompact : null]} testID="level-footer">
          {actions}
        </View>
      )}

      {landscape || countChip === null ? null : <View style={[styles.cornerCount, { top: insets.top + 10, left: insets.left + 12 }]}>{countChip}</View>}
      {landscape ? null : <View style={[styles.cornerMenu, { top: insets.top + 10, right: insets.right + 12 }]}>{menuButton}</View>}

      {/* The menu always fits the screen: inside the safe area, wrapped into columns
          on a landscape phone and scrollable as a last resort; tapping outside closes it. */}
      {menuOpen ? (
        <Animated.View
          entering={FadeIn.duration(140)}
          style={[styles.overlay, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10, paddingLeft: insets.left + 10, paddingRight: insets.right + 10 }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} accessibilityLabel={text.close} testID="menu-backdrop" />
          <View style={styles.menuCard} testID="menu-card">
            <ScrollView contentContainerStyle={[styles.menuItems, landscape ? styles.menuItemsWide : null]} bounces={false}>
              {/* The child's menu: the things a child does (2026-10-15 review K), plus the way
                  back to the map (D-072). Language, sounds and full screen live in the parents'
                  area behind the held gear. */}
              {[
                <PillButton key="close" title={text.close} icon="play" tone="accent" onPress={() => setMenuOpen(false)} testID="menu-close" />,
                <PillButton key="help" title={text.help} icon="bulb" onPress={() => { setMenuOpen(false); onAskHelp(); }} testID="menu-help" />,
                <PillButton key="undo" title={text.undo} icon="undo" onPress={() => { setMenuOpen(false); onUndo(); }} testID="menu-undo" />,
                host.restartable ? <PillButton key="restart" title={text.restart} icon="again" onPress={() => { setMenuOpen(false); onRechallenge(); }} testID="menu-restart" /> : null,
                <PillButton key="exit" title={host.exit.title} icon={host.exit.icon} onPress={() => { setMenuOpen(false); host.exit.onPress(); }} testID={host.exit.testID} />,
              ]
                .filter((item) => item !== null)
                .map((item) => (
                  <View key={item.key} style={landscape ? styles.menuItemWide : null}>
                    {item}
                  </View>
                ))}
              <View style={[styles.menuGate, landscape ? styles.menuItemWide : null]}>
                <ParentGate
                  size={48}
                  muted
                  accessibilityLabel={text.parent}
                  accessibilityHint={text.hold}
                  testID="menu-parent"
                  onOpen={() => {
                    setMenuOpen(false);
                    voice.stop();
                    router.push('/parent');
                  }}
                />
              </View>
            </ScrollView>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

// A stop on the map: entered once progress is there (a locked stop bounces
// back to the map), saved move by move, completed and kept in the album when
// right; the way on is the next stop, through the map, or the island's page.
export function LevelScreen({ nodeId: rawNodeId }: { readonly nodeId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useProgress();
  const nodeId = makeNodeId(rawNodeId) as NodeId;
  const lang = state?.language ?? 'zh';
  const text = MENU[lang];

  // Enter the stop once progress is loaded; a locked stop bounces back to the map.
  const entered = state?.nodes.get(nodeId);
  useEffect(() => {
    if (state === null || entered !== undefined) {
      return;
    }
    const r = dispatch({ type: 'enter', nodeId });
    if (!r.ok) {
      router.replace('/');
    }
  }, [state, entered, dispatch, nodeId, router]);

  // Depends on the ref only: saving work must not re-materialize the stop or reset the session.
  // A ref this build cannot play shows the recovery view instead of crashing.
  const ref = entered?.ref;
  const built = useMemo((): { puzzle: Puzzle | null; failed: boolean } => {
    if (ref === undefined) {
      return { puzzle: null, failed: false };
    }
    try {
      return { puzzle: materialize(ref), failed: false };
    } catch {
      return { puzzle: null, failed: true };
    }
  }, [ref]);

  // A right opening is the stop's album picture too (a no-op when it already
  // is; an archive from before the album fills it in on the next visit).
  const onOpen = useCallback(
    (s: LevelSession) => {
      if (s.verdict.matched) {
        dispatch({ type: 'complete', nodeId, verdict: s.verdict, work: s.history.state });
      }
    },
    [dispatch, nodeId],
  );
  // One dispatch, so one write, per change to the mat. A right mat (the last
  // step on a stop in steps: the verdict only matches there) is saved,
  // completed and kept as the stop's album picture together (2026-10-15 review
  // Q); any other mat is only saved and leaves the picture alone.
  const onMat = useCallback(
    (next: LevelSession) => {
      const work = next.history.state;
      dispatch(next.verdict.matched ? { type: 'complete', nodeId, verdict: next.verdict, work } : { type: 'saveWork', nodeId, work });
    },
    [dispatch, nodeId],
  );
  const onReplay = useCallback(() => dispatch({ type: 'replay', nodeId }).ok, [dispatch, nodeId]);
  const onMap = useCallback(() => {
    voice.stop();
    router.dismissTo('/');
  }, [router]);

  const onNext = useCallback(
    (solved: boolean) => {
      const next = nextNodeOf(nodeId);
      voice.stop();
      // A finished stop keeps its way out even when the mat is wrong now (D-038),
      // but a wrong mat is not carried on to the next stop or the island page: the
      // button says "back to the map" and goes only there (2026-10-16 review D-038
      // side effect: the wrong work was saved and the hop played as if right).
      if (!solved) {
        router.replace('/');
        return;
      }
      // The last stop of a finished island opens the island's own page (2026-10-15 review I).
      const island = chapterOf(nodeId);
      if (state !== null && (next === null || chapterOf(next).id !== island.id) && island.nodes.every((n) => state.completedNodeIds.has(n.id))) {
        router.replace({ pathname: '/island/[chapterId]', params: { chapterId: island.id } });
        return;
      }
      if (next === null || state === null || statusOf(state, next) === 'locked') {
        router.replace('/');
        return;
      }
      // The way on goes through the map, where the marker hops to the next stop
      // and it opens by itself (MapScreen ADVANCE).
      router.replace({ pathname: '/', params: { from: nodeId, to: next } });
    },
    [nodeId, router, state],
  );

  if (built.failed) {
    return <LevelRecovery nodeId={nodeId} />;
  }
  const puzzle = built.puzzle;
  if (puzzle === null) {
    return <View style={[styles.root, { paddingTop: insets.top }]} />;
  }

  // Only for a stop that was entered: the static export renders this route with a placeholder id.
  const completed = state?.completedNodeIds.has(nodeId) ?? false;
  const chapter = chapterOf(nodeId);
  const hasNext = nextNodeOf(nodeId) !== null;
  const nextStop = nextNodeOf(nodeId);
  const islandDone = (nextStop === null || chapterOf(nextStop).id !== chapter.id) && chapter.nodes.every((n) => state?.completedNodeIds.has(n.id) ?? false);
  const host: PlayHost = {
    work: entered?.work ?? null,
    finished: completed,
    boss: isBossStop(nodeId),
    entrance: BOSS_ENTRANCE.has(nodeId),
    firstStop: nodeId === FIRST_STOP,
    countToPass: COUNT_TO_PASS.has(nodeId),
    onOpen,
    onMat,
    onReplay,
    restartable: completed,
    next: () => ({ key: copyKey(hasNext ? 'feedback.next' : 'feedback.done'), params: {} }),
    // A finished stop always keeps its way on (2026-10-15 review: one more block
    // after solving took the button away, which felt like a punishment). Right
    // now: the bright, breathing button beside "play again"; finished before but
    // changed since: a plain one on its own, while the card says what is on the mat.
    actions: ({ solved, compact, landscape, breathe, again }) => {
      if (!solved && !completed) {
        return null;
      }
      // Wrong right now: only back to the map (see onNext).
      const nextTitle = !solved
        ? text.done
        : islandDone
          ? landscape
            ? format(copyKey('island.done.short'), lang)
            : format(copyKey('island.done'), lang, { island: format(chapter.title, lang) })
          : hasNext
            ? text.next
            : text.done;
      // Beside the island's own long label ("Number Island done!") "play again" is
      // the round icon, as in landscape, so the row fits a 360px phone in English
      // too (2026-10-16 review L-1: the pill pushed "next" off the right edge).
      return (
        <>
          {solved ? (landscape || islandDone ? again.round : again.pill) : null}
          <Animated.View style={solved ? breathe : null}>
            <PillButton title={nextTitle} icon={!solved ? 'map' : islandDone ? 'star' : hasNext ? 'play' : 'map'} tone={solved ? 'accent' : 'plain'} onPress={() => onNext(solved)} compact={compact} testID="next" />
          </Animated.View>
        </>
      );
    },
    exit: { title: text.map, icon: 'map', testID: 'menu-map', onPress: onMap },
  };
  return <LevelPlay puzzle={puzzle} lang={lang} host={host} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.sky },
  rootRow: { flexDirection: 'row' },
  // Heights from LEVEL_CHROME: the device layout tests subtract the same numbers.
  header: { height: LEVEL_CHROME.regular.header, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 16 },
  headerCompact: { height: LEVEL_CHROME.compact.header },
  side: { width: LEVEL_CHROME.sideColumn, alignItems: 'center', paddingTop: 4, paddingBottom: 6, paddingLeft: 8, gap: 4 },
  sideTop: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', minHeight: 48 },
  sideCount: { width: 76, alignItems: 'center' },
  sideFill: { flex: 1 },
  sideTarget: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  badgeWrap: { alignItems: 'center' },
  badgeWrapCompact: {},
  bossStar: { position: 'absolute', top: -2, left: -10, fontSize: 30, color: THEME.amber, textShadowColor: THEME.amberDeep, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
  bossStarCompact: { top: 2, left: -8, fontSize: 24 },
  target: { fontSize: 62, fontFamily: FONT.display, color: THEME.ink, lineHeight: 70 },
  targetCompact: { fontSize: 48, lineHeight: 56 },
  targetWide: { fontSize: 44, lineHeight: 52 },
  targetWideCompact: { fontSize: 32, lineHeight: 40 },
  targetEquation: { fontSize: 30, lineHeight: 38 },
  targetEquationCompact: { fontSize: 22, lineHeight: 30 },
  // Two ways side by side, one a line (Phase 20 Q1): both inside the cloud.
  targetTwo: { fontSize: 25, lineHeight: 32, textAlign: 'center' },
  targetTwoCompact: { fontSize: 19, lineHeight: 25, textAlign: 'center' },
  templateBox: { position: 'relative', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.8)', boxShadow: `0 4px 0 ${THEME.skyDeep}` },
  templateCell: { position: 'absolute', borderWidth: 1.5 },
  cornerMenu: { position: 'absolute' },
  cornerCount: { position: 'absolute', width: 76, alignItems: 'center' },
  recount: { alignItems: 'center', gap: 2 },
  recountLabel: { fontSize: 12, fontFamily: FONT.body, fontWeight: '800', color: THEME.inkSoft, textAlign: 'center' },
  // Ink, not green: green is "right" (2026-10-16 review F-1a).
  countChip: { minWidth: 52, height: 52, borderRadius: 26, paddingHorizontal: 12, backgroundColor: THEME.white, borderWidth: 3, borderColor: THEME.ink, alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 0 ${THEME.ink}` },
  countChipText: { fontSize: 28, fontFamily: FONT.display, color: THEME.ink },
  stageArea: { flex: 1 },
  ground: { position: 'absolute', left: -40, right: -40, bottom: -80, backgroundColor: THEME.sand, borderTopLeftRadius: 200, borderTopRightRadius: 200, opacity: 0.9 },
  footer: { height: LEVEL_CHROME.regular.footer, alignItems: 'center', justifyContent: 'center' },
  // Top-aligned: the button's lip stays on screen with a little room under it.
  footerCompact: { height: LEVEL_CHROME.compact.footer, justifyContent: 'flex-start' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionsColumn: { alignItems: 'center', gap: 8 },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(43,54,69,0.38)', alignItems: 'center', justifyContent: 'center' },
  menuCard: { backgroundColor: THEME.board, borderRadius: 28, minWidth: 224, maxWidth: '100%', maxHeight: '100%', borderWidth: 2, borderColor: THEME.sandDeep, overflow: 'hidden' },
  menuItems: { padding: 16, gap: 10 },
  menuItemsWide: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 600 },
  menuItemWide: { width: 176 },
  // The gear is quieter (`muted`, 0.85) on itself: an opacity here would also fade its hint bubble.
  menuGate: { alignItems: 'center', paddingTop: 4 },
});
