import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Confetti, FONT, LEVEL_CHROME, Spotlight, Stage, THEME, cheerFor, colorsFor, computeGeometry, trayObjects, useBreathe, usePop } from '../blocks-ui';
import { COUNT_TO_PASS, copyKey, format, hueFor, materialize, nodeId as makeNodeId } from '../content';
import type { NodeId, Puzzle } from '../content';
import type { Command, UnitId } from '../core';
import { chapterOf, nextNodeOf, statusOf } from '../progress';
import { createCorrectionVoice } from './correction-voice';
import { asksForHelp, cardFor, feedbackFor, guidanceFor, matchedFeedback, promptParams } from './hints';
import type { Line } from './hints';
import { AnswerFeedback } from './AnswerFeedback';
import { Cloud, SkyCloud } from './Cloud';
import { Icon } from './icons';
import { atStart, commitCommand, countOrder, countProgress, countTap, countWordsStale, demoMove, previewCommand, recount, solvedEquation, startSession, undoCommand } from './level-session';
import type { LevelSession } from './level-session';
import { LevelRecovery } from './LevelRecovery';
import { useProgress } from './progress-store';
import { play } from './sound';
import { AUTO_SPEECH } from './speech-policy';
import { ParentGate, PillButton, RoundButton } from './ui';
import { say, voice } from './voice';

const MENU = {
  zh: { help: '帮助', undo: '撤销', close: '继续', next: '下一站', done: '回地图', again: '再玩一次', restart: '重新挑战', recount: '再数一遍', parent: '家长区', hold: '长按进入家长区' },
  en: { help: 'Help', undo: 'Undo', close: 'Play', next: 'Next stop', done: 'Back to map', again: 'Play again', restart: 'Start over', recount: 'Count again', parent: 'Parents', hold: 'Press and hold for the parents\' area' },
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

function isBossStop(nodeId: NodeId): boolean {
  return chapterOf(nodeId).nodes.find((n) => n.id === nodeId)?.role === 'boss';
}

// The correction a committed answer needs, if it needs one. Building towards
// the answer is not a mistake and has none.
function correctionOf(session: LevelSession): Line | null {
  const f = feedbackFor(session);
  return f.tone === 'adjust' ? f.detail : null;
}

export function LevelScreen({ nodeId: rawNodeId }: { readonly nodeId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  // Landscape phones: the target and buttons move to a side column so the stage keeps its height.
  const landscape = win.width > win.height;
  const compact = !landscape && win.height < LEVEL_CHROME.compactBelow;
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
  const puzzle = built.puzzle;
  const [session, setSession] = useState<LevelSession | null>(null);
  const sessionRef = useRef<LevelSession | null>(null);
  // Whether the stop was finished before this visit (COUNT_TO_PASS leaves those alone).
  const [finishedBefore, setFinishedBefore] = useState(false);

  // Spoken corrections follow one timing rule (see correction-voice.ts). They
  // queue (interrupt: false) so counting words and the prompt are never cut off.
  const [corrections] = useState(() => createCorrectionVoice({ stop: () => voice.stop() }));
  // How much help the current answer has had: 0 none, 1 the correction was said
  // on its own (it points only where that gives nothing away), 2 the child asked
  // (the card or the help button) and the partner is named and lit. Any change
  // to the answer starts again at 0.
  const [helpLevel, setHelpLevel] = useState<0 | 1 | 2>(0);
  useEffect(
    () =>
      corrections.setSpeaker((l) => {
        if (AUTO_SPEECH.correction) {
          say(lang, l.key, l.params, false);
        }
        setHelpLevel((v) => (v === 0 ? 1 : v));
      }),
    [corrections, lang],
  );
  useEffect(() => () => corrections.dispose(), [corrections]);

  useEffect(() => {
    if (puzzle === null || sessionRef.current?.whole === puzzle) {
      return;
    }
    const s = startSession(puzzle, entered?.work ?? null, state?.completedNodeIds.has(nodeId) ?? false);
    setFinishedBefore(state?.completedNodeIds.has(nodeId) ?? false);
    sessionRef.current = s;
    setSession(s);
    setHelpLevel(0);
    // Saved work that is already right shows as right, without a second
    // celebration. It is the stop's album picture too (a no-op when it already is;
    // an archive from before the album fills it in on the next visit).
    if (s.verdict.matched) {
      dispatch({ type: 'complete', nodeId, verdict: s.verdict, work: s.history.state });
    }
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
  const tipWaiting = session !== null && helpLevel < 2 && feedbackFor(session).tone === 'adjust';
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
      nodeId === FIRST_STOP && demos.current === 0 ? DEMO_FIRST_STOP_MS : DEMO_AFTER_MS,
    );
    const hide = setTimeout(() => setDemo(0), (nodeId === FIRST_STOP && demos.current === 0 ? DEMO_FIRST_STOP_MS : DEMO_AFTER_MS) + DEMO_SHOWN_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [emptyMat, menuOpen, stirred, nodeId]);


  // One dispatch, so one write, per change to the mat. A right mat (the last
  // step on a stop in steps: the verdict only matches there) is saved,
  // completed and kept as the stop's album picture together (2026-10-15 review
  // Q); any other mat is only saved and leaves the picture alone.
  const saveWork = useCallback(
    (next: LevelSession) => {
      const work = next.history.state;
      dispatch(next.verdict.matched ? { type: 'complete', nodeId, verdict: next.verdict, work } : { type: 'saveWork', nodeId, work });
    },
    [dispatch, nodeId],
  );

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
      // A step done: the new picture lights up at once (help level 1 points at it).
      setHelpLevel(stepDone && !solvedNow ? 1 : 0);
      saveWork(next);
      // Before the success line: a stale correction is stopped, the success line is not.
      corrections.answer(correctionOf(next));
      if (stepDone && !solvedNow) {
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
        solves.current += 1;
        setCelebration(solves.current);
        setBadgePops((n) => n + 1);
        play(isBossStop(nodeId) ? 'fanfare' : 'success');
        if (AUTO_SPEECH.success) {
          const fb = matchedFeedback(next);
          say(lang, fb.key, fb.params);
        }
      } else {
        setCelebration(0);
        // A soft "hmm?" when the answer turns into one that needs changing; not
        // again while it stays wrong, so moving things around is not nagged.
        if (feedbackFor(next).tone === 'adjust' && (before === null || feedbackFor(before).tone !== 'adjust')) {
          play('adjust');
        }
      }
    },
    [saveWork, nodeId, lang, corrections],
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

  const onUndo = useCallback(() => {
    const current = sessionRef.current;
    if (current === null) {
      return;
    }
    const back = undoCommand(current);
    if (back !== null) {
      if (countWordsStale(current, back)) {
        voice.stop();
      }
      sessionRef.current = back;
      setSession(back);
      setCelebration(0);
      setHelpLevel(0);
      saveWork(back);
      corrections.answer(correctionOf(back));
    }
  }, [saveWork, corrections]);

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
  }, []);

  // Re-challenge a finished stop: the completion and the unlocked map stay, the
  // work is cleared and this round's answer and celebration start over.
  const completed = state?.completedNodeIds.has(nodeId) ?? false;
  const onRechallenge = useCallback(() => {
    if (puzzle === null || !dispatch({ type: 'replay', nodeId }).ok) {
      return;
    }
    voice.stop();
    const fresh = startSession(puzzle, null);
    sessionRef.current = fresh;
    setSession(fresh);
    setCelebration(0);
    setStepHop(0);
    setHelpLevel(0);
    corrections.answer(null);
    play('arrive');
    if (AUTO_SPEECH.prompt) {
      say(lang, puzzle.prompt, promptParams(puzzle));
    }
  }, [dispatch, nodeId, puzzle, lang, corrections]);

  // The help button and the feedback card ask for help. A wrong answer gets
  // the named, lit-up help (level 2) and the card shows it; otherwise the card's
  // own line again (the task, the next step, or what was built), pointing at the
  // shape picture on a shape stop.
  const onAskHelp = useCallback(() => {
    const current = sessionRef.current;
    if (current === null) {
      return;
    }
    const f = feedbackFor(current);
    corrections.heard(f.detail);
    // Found the help on its own: no need to point at it any more this visit.
    nudged.current = true;
    if (asksForHelp(current, f)) {
      const help = guidanceFor(current, 2);
      setHelpLevel(2);
      say(lang, help.line.key, help.line.params);
      return;
    }
    const line = f.tone === 'success' ? matchedFeedback(current) : f.detail;
    setHelpLevel((v) => (v === 0 ? 1 : v));
    say(lang, line.key, line.params);
  }, [lang, corrections]);

  const onDragActive = useCallback(
    (active: boolean) => {
      corrections.pause(active, 'drag');
      if (active) {
        stir();
      }
    },
    [corrections, stir],
  );

  const onPrompt = useCallback(() => {
    if (puzzle !== null) {
      corrections.activity();
      say(lang, puzzle.prompt, promptParams(puzzle));
    }
  }, [lang, puzzle, corrections]);

  const onNext = useCallback(() => {
    const next = nextNodeOf(nodeId);
    voice.stop();
    // A finished stop keeps its way out even when the mat is wrong now (D-038),
    // but a wrong mat is not carried on to the next stop or the island page: the
    // button says "back to the map" and goes only there (2026-10-16 review D-038
    // side effect: the wrong work was saved and the hop played as if right).
    if (sessionRef.current?.verdict.matched !== true) {
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
  }, [nodeId, router, state]);

  const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null);
  const onStageLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStageSize({ width, height });
  }, []);

  // The tray's objects come from the stop's starting material, never from the
  // current state, so taking things out cannot reshuffle what is left.
  const objects = useMemo(() => (puzzle === null ? [] : trayObjects(puzzle.initial)), [puzzle]);
  const geometry = useMemo(() => {
    if (stageSize === null || puzzle === null) {
      return null;
    }
    return computeGeometry(stageSize.width, stageSize.height, puzzle.initial.bounds, objects.map((o) => o.footprint));
  }, [stageSize, puzzle, objects]);

  const order = useMemo(() => (session === null ? new Map<UnitId, number>() : countOrder(session)), [session]);
  const guide = useMemo(() => (session === null || helpLevel === 0 ? null : guidanceFor(session, helpLevel)), [session, helpLevel]);
  const breathe = useBreathe(session?.verdict.matched ?? false);

  if (built.failed) {
    return <LevelRecovery nodeId={nodeId} />;
  }
  if (puzzle === null || session === null) {
    return <View style={[styles.root, { paddingTop: insets.top }]} />;
  }

  // Only for a stop that was entered: the static export renders this route with a placeholder id.
  const hasNext = nextNodeOf(nodeId) !== null;
  const feedback = cardFor(session, helpLevel, hasNext);
  // The stop as asked right now (the current step's picture on a stop in steps).
  const q = session.puzzle.question;
  const title = solvedEquation(session) ?? (q.kind === 'addition_exact' ? `${q.operands[0]} + ${q.operands[1]}` : String(q.kind === 'sum_composition' ? q.sum : q.target));
  const counting = countProgress(session);
  // The hand shows the first move of the reference answer: on a partner stop a
  // whole partner (never a decoy), on a loose stop one block. Past the first way
  // of a two-ways stop, a partner of the other way; on a "who's missing?" stop
  // the other half, put down beside the partner already there (Phase 19).
  const first = demoMove(session);
  const demoPiece = first === undefined ? undefined : first.type === 'takeGroup' ? (first.groupId as string) : first.type === 'take' ? (first.unitId as string) : undefined;
  const demoTo = puzzle.given !== undefined && first?.type === 'takeGroup' ? first.origin : undefined;
  const template = session.puzzle.display.template;
  const chapter = chapterOf(nodeId);
  const isBoss = chapter.nodes.find((n) => n.id === nodeId)?.role === 'boss';
  const solved = session.verdict.matched;
  const groundTop = geometry === null || geometry.arrangement !== 'below' ? null : geometry.tray.y - 18;

  const nextStop = nextNodeOf(nodeId);
  const islandDone = (nextStop === null || chapterOf(nextStop).id !== chapter.id) && chapter.nodes.every((n) => state?.completedNodeIds.has(n.id) ?? false);
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
            style={[styles.target, small ? styles.targetCompact : null, title.length > 2 ? (small ? styles.targetWideCompact : styles.targetWide) : null, title.length > 5 ? (small ? styles.targetEquationCompact : styles.targetEquation) : null]}>
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
  // A finished stop always keeps its way on (2026-10-15 review: one more block
  // after solving took the button away, which felt like a punishment). Right
  // now: the bright, breathing button beside "play again"; finished before but
  // changed since: a plain one on its own, while the card says what is on the mat.
  // Beside the island's own long label ("Number Island done!") "play again" is
  // the round icon, as in landscape, so the row fits a 360px phone in English
  // too (2026-10-16 review L-1: the pill pushed "next" off the right edge).
  const again = landscape || islandDone ? (
    <RoundButton label={<Icon name="again" size={26} />} accessibilityLabel={text.again} onPress={onRechallenge} size={compact ? 44 : 48} testID="again" />
  ) : (
    <PillButton title={text.again} onPress={onRechallenge} compact={compact} testID="again" />
  );
  // A COUNT_TO_PASS stop solved for the first time: the way on appears once
  // every block is counted (empty by default, see content/catalog).
  const countFirst = COUNT_TO_PASS.has(nodeId) && !finishedBefore && solved && !counting.complete;
  const actions =
    (solved || completed) && !countFirst ? (
      <Animated.View entering={FadeInDown.duration(220)} style={landscape ? styles.actionsColumn : styles.actionsRow} pointerEvents="box-none">
        {solved ? again : null}
        <Animated.View style={solved ? breathe : null}>
          <PillButton title={nextTitle} tone={solved ? 'accent' : 'plain'} onPress={onNext} compact={compact} testID="next" />
        </Animated.View>
      </Animated.View>
    ) : null;
  // Counting: the running number while counting, then a clear way to count again.
  const countChip =
    counting.counted === 0 ? null : counting.complete ? (
      <View style={styles.recount}>
        <RoundButton label={<Icon name="again" size={26} />} accessibilityLabel={text.recount} testID="recount" onPress={onRecount} />
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
          countOrder={order}
          matched={session.verdict.matched}
          // The faces agree with the card: puzzled while it gives a tip, happy when right.
          mood={feedback.tone === 'adjust' ? 'puzzled' : feedback.tone === 'success' ? 'happy' : 'calm'}
          celebrateTick={celebration || stepHop}
          cheer={stepHop > 0 ? 'hop' : cheer}
          onCommand={onCommand}
          onPreview={onPreview}
          onTapUnit={onTapUnit}
          onDragActive={onDragActive}
          onFeel={play}
          spotlight={guide?.focus.objects}
          demo={demo}
          demoPiece={demoPiece}
          demoTo={demoTo}
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
  const menuButton = <RoundButton label={<Icon name="menu" size={26} />} accessibilityLabel="menu" testID="menu" onPress={() => setMenuOpen(true)} />;
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
              {/* The child's menu: four things a child does (2026-10-15 review K). Language,
                  sounds, full screen and the map live in the parents' area behind the held gear. */}
              {[
                <PillButton key="close" title={text.close} tone="accent" onPress={() => setMenuOpen(false)} testID="menu-close" />,
                <PillButton key="help" title={text.help} onPress={() => { setMenuOpen(false); onAskHelp(); }} testID="menu-help" />,
                <PillButton key="undo" title={text.undo} onPress={() => { setMenuOpen(false); onUndo(); }} testID="menu-undo" />,
                completed ? <PillButton key="restart" title={text.restart} onPress={() => { setMenuOpen(false); onRechallenge(); }} testID="menu-restart" /> : null,
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
  menuGate: { alignItems: 'center', paddingTop: 4, opacity: 0.85 },
});
