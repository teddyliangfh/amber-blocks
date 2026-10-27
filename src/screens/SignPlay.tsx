import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Confetti, FONT, LEVEL_CHROME, SignStage, THEME, colorsFor, placeRound, sideCells, signGeometry, useBreathe, usePop } from '../blocks-ui';
import type { CloudSize, Mood, SideKey, SignSize } from '../blocks-ui';
import { copyKey, hueFor } from '../content';
import type { Lang, Puzzle } from '../content';
import type { BenchState, Sign } from '../core';
import type { AnswerFeedback as Feedback, Line } from './hints';
import { AmberGuide } from './AmberGuide';
import { AnswerFeedback } from './AnswerFeedback';
import { SkyCloud, TargetCloud } from './Cloud';
import { Icon } from './icons';
import type { IconName } from './icons';
import type { PlayActionParts } from './LevelScreen';
import { PARTS_JOIN_ON_PASS, TAP_TO_PLACE, WRONG_SIGN, signHelp, signPass, signRightCard, signStartCard, signTask, signWrongCard } from './sign-hints';
import { play } from './sound';
import { AUTO_SPEECH } from './speech-policy';
import { ParentGate, PillButton, RoundButton } from './ui';
import { say, voice } from './voice';

// Compare Island's play (Phase 23d, PRD §3): a stop is a few rounds, each a
// pair of numbers and a slot between them; the child drags (or taps) a sign
// block into the slot. A right sign: the success sound and smiles, then on the
// second beat each number's note, the bigger side hops and the smaller looks
// up at it (the same two wave), and the next pair slides in. The last right
// sign finishes the stop (saved at once, like a right mat) and the way on comes
// with the paper. A wrong sign shakes its head and floats home; the card says
// the fact ("4 比 1 多"), never "wrong". Rounds are the visit's, not saved:
// leaving or reloading starts the stop's first round again (PRD §11 #9).

const MENU = {
  zh: { help: '帮助', close: '继续', again: '再玩一次', restart: '重新挑战', parent: '家长区', hold: '按住进入家长区', menu: '菜单' },
  en: { help: 'Help', close: 'Keep playing', again: 'Play again', restart: 'Start over', parent: 'Parents', hold: 'Press and hold for the parents\' area', menu: 'Menu' },
} as const;

// The two beats of a right sign (as LevelPlay's SOLVE_SETTLE_MS), then the
// pause before the next pair slides in (PRD §3.1: 0.8 s).
export const SIGN_SETTLE_MS = 600;
export const NEXT_PAIR_MS = 800;
// A wrong sign shakes, then floats back home after this long (WRONG_SIGN 'bounce').
export const WRONG_BACK_MS = 650;
// The "like this" hand: once a visit, on the first round, after this long untouched.
export const SIGN_DEMO_AFTER_MS = 5000;
export const SIGN_DEMO_SHOWN_MS = 4200;
// Help's first step numbers the blocks one by one.
export const SIGN_COUNT_STEP_MS = 320;

export interface SignHost {
  // Finished before this visit (and not started again since): it opens on the
  // finished last round. The host remounts SignPlay for every new deal.
  readonly finished: boolean;
  readonly boss: boolean;
  // The last round is right: save the picture (the stop's material) as its work.
  readonly onSolved: (work: BenchState) => void;
  // "Play again" (the rounds again, in a new order): false keeps it as it is.
  readonly onReplay: () => boolean;
  readonly restartable: boolean;
  readonly next: () => Line;
  readonly actions: (parts: PlayActionParts) => ReactNode;
  readonly exit: { readonly title: string; readonly icon: IconName; readonly testID: string; readonly onPress: () => void };
}

type Counts = { readonly left: ReadonlyMap<number, number>; readonly right: ReadonlyMap<number, number> };
const NO_COUNTS: Counts = { left: new Map(), right: new Map() };

interface Play {
  readonly round: number;
  readonly placed: Sign | null;
  readonly verdict: 'right' | 'wrong' | null;
  // A wrong sign this round (the card stays amber until it is right).
  readonly wrong: boolean;
  // The second beat of a right sign has come.
  readonly settled: boolean;
  // Every round right.
  readonly done: boolean;
}

const FRESH: Play = { round: 0, placed: null, verdict: null, wrong: false, settled: false, done: false };

export function SignPlay({ puzzle, lang, host }: { readonly puzzle: Puzzle; readonly lang: Lang; readonly host: SignHost }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const landscape = win.width > win.height;
  const compact = !landscape && win.height < LEVEL_CHROME.compactBelow;
  const text = MENU[lang];
  const sign = puzzle.sign!;
  const rounds = sign.rounds;
  const last = rounds.length - 1;

  // The finished picture when a finished stop opens; a fresh round otherwise
  // (and after "play again", which deals the rounds in a new order).
  const [state, setState] = useState<Play>(() => (host.finished ? { round: last, placed: rounds[last]!.answer, verdict: 'right', wrong: false, settled: true, done: true } : FRESH));
  const stateRef = useRef<Play>(state);
  const set = useCallback((next: Play) => {
    stateRef.current = next;
    setState(next);
  }, []);
  const [asks, setAsks] = useState(0);
  const [counts, setCounts] = useState<Counts>(NO_COUNTS);
  const [countUp, setCountUp] = useState<{ readonly cells: ReadonlyArray<{ readonly side: SideKey; readonly index: number }>; readonly shown: number } | null>(null);
  const [demo, setDemo] = useState<{ readonly sign: Sign; readonly tick: number } | null>(null);
  const [shake, setShake] = useState(0);
  const [cheerTick, setCheerTick] = useState(0);
  const [joined, setJoined] = useState(host.finished && PARTS_JOIN_ON_PASS);
  const [celebration, setCelebration] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  // The opening's "look here" (as LevelPlay): the cloud pops in, Amber leans, a chime.
  const [looks] = useState(host.finished ? 0 : 1);
  const [touched, setTouched] = useState(false);
  const entrance = usePop(looks, 1.4, 0.6);
  const [cloudPops, setCloudPops] = useState(0);
  const cloudPop = usePop(cloudPops);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (host.finished) {
      return;
    }
    play('arrive');
    play('look');
    if (AUTO_SPEECH.prompt) {
      say(lang, copyKey('prompt.sign'), {});
    }
    // Once, as this deal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The "like this" hand, once a visit: the first round, nothing touched yet.
  const demoShown = useRef(false);
  useEffect(() => {
    if (touched || menuOpen || state.round !== 0 || state.done || demoShown.current) {
      return;
    }
    const t = setTimeout(() => {
      demoShown.current = true;
      setDemo({ sign: rounds[0]!.answer, tick: 1 });
      later(SIGN_DEMO_SHOWN_MS, () => setDemo(null));
    }, SIGN_DEMO_AFTER_MS);
    return () => clearTimeout(t);
  }, [touched, menuOpen, state.round, state.done, rounds, later]);

  // Help's first step: the blocks numbered one by one with their notes.
  useEffect(() => {
    if (countUp === null || countUp.shown >= countUp.cells.length) {
      return;
    }
    const t = setTimeout(() => {
      const c = countUp.cells[countUp.shown]!;
      const shown = countUp.cells.slice(0, countUp.shown + 1);
      const index = shown.filter((x) => x.side === c.side).length;
      play('count', index);
      setCounts({
        left: new Map(shown.filter((x) => x.side === 'left').map((x, i) => [x.index, i + 1])),
        right: new Map(shown.filter((x) => x.side === 'right').map((x, i) => [x.index, i + 1])),
      });
      setCountUp({ ...countUp, shown: countUp.shown + 1 });
    }, SIGN_COUNT_STEP_MS);
    return () => clearTimeout(t);
  }, [countUp]);

  const round = rounds[state.round]!;

  const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null);
  const onStageLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStageSize({ width, height });
  }, []);
  const size: SignSize = landscape ? 'side' : compact ? 'compact' : 'regular';
  const geometry = useMemo(() => (stageSize === null ? null : signGeometry(stageSize.width, stageSize.height, rounds, sign.signs.length, size)), [stageSize, rounds, sign.signs.length, size]);
  const place = useMemo(() => (geometry === null ? null : placeRound(geometry, round)), [geometry, round]);

  const touch = useCallback(() => {
    setTouched(true);
    setDemo(null);
  }, []);

  const nextRound = useCallback(() => {
    const s = stateRef.current;
    set({ ...FRESH, round: s.round + 1 });
    setAsks(0);
    setCounts(NO_COUNTS);
    setCountUp(null);
    setJoined(false);
  }, [set]);

  const putIn = useCallback(
    (s: Sign) => {
      const now = stateRef.current;
      if (now.done || now.verdict !== null) {
        return;
      }
      touch();
      setAsks(0);
      setCountUp(null);
      const r = rounds[now.round]!;
      if (s === r.answer) {
        const final = now.round === last;
        set({ ...now, placed: s, verdict: 'right', done: final });
        play(final && host.boss ? 'fanfare' : 'success');
        setCloudPops((n) => n + 1);
        if (AUTO_SPEECH.success) {
          const pass = signPass(r);
          say(lang, pass.key, pass.params);
        }
        if (final) {
          host.onSolved(puzzle.initial);
        }
        later(SIGN_SETTLE_MS, () => {
          set({ ...stateRef.current, settled: true });
          play('compare', r.right.n, [r.left.n]);
          setCheerTick((n) => n + 1);
          if (PARTS_JOIN_ON_PASS && (r.left.parts !== null || r.right.parts !== null)) {
            setJoined(true);
          }
          if (final) {
            setCelebration((n) => n + 1);
          } else {
            later(NEXT_PAIR_MS, nextRound);
          }
        });
        return;
      }
      set({ ...now, placed: s, verdict: 'wrong', wrong: true });
      setShake((n) => n + 1);
      play('adjust');
      if (WRONG_SIGN === 'bounce') {
        later(WRONG_BACK_MS, () => {
          set({ ...stateRef.current, placed: null, verdict: null });
          play('return');
        });
      }
    },
    [rounds, last, host, puzzle.initial, lang, set, later, nextRound, touch],
  );

  const onTapSign = useCallback(
    (s: Sign) => {
      if (TAP_TO_PLACE) {
        play('pickup');
        putIn(s);
        return;
      }
      touch();
      play('tap');
    },
    [putIn, touch],
  );
  const onDropSign = useCallback(
    (s: Sign) => {
      // WRONG_SIGN 'stay': a wrong sign waits in the slot; another one put in sends it home.
      const now = stateRef.current;
      if (now.verdict === 'wrong' && now.placed !== s) {
        set({ ...now, placed: null, verdict: null });
        stateRef.current = { ...now, placed: null, verdict: null };
      }
      play('drop');
      putIn(s);
    },
    [putIn, set],
  );
  const onTakeOut = useCallback(
    (s: Sign) => {
      const now = stateRef.current;
      if (now.placed === s && now.verdict === 'wrong') {
        set({ ...now, placed: null, verdict: null });
        play('return');
      }
    },
    [set],
  );
  const onLift = useCallback(
    (active: boolean) => {
      if (active) {
        touch();
        play('pickup');
      }
    },
    [touch],
  );

  // Counting by tapping, as on every island: each block its next number,
  // the same block again nothing; the last one says "n in all".
  const onTapBlock = useCallback(
    (side: SideKey, index: number) => {
      touch();
      setCountUp(null);
      setCounts((c) => {
        const mine = c[side];
        if (mine.has(index)) {
          return c;
        }
        const n = mine.size + 1;
        const total = side === 'left' ? round.left.n : round.right.n;
        const complete = n === total;
        play(complete ? 'counted' : 'count', n);
        if (AUTO_SPEECH.countNumbers) {
          say(lang, copyKey(`number.${Math.min(n, 17)}`), {}, false);
        }
        if (complete && AUTO_SPEECH.countTotal) {
          say(lang, copyKey('count.total'), { n: total }, false);
        }
        return { ...c, [side]: new Map(mine).set(index, n) };
      });
    },
    [touch, round, lang],
  );
  const onTapPlate = useCallback(
    (side: SideKey) => {
      touch();
      say(lang, copyKey(`number.${Math.min(side === 'left' ? round.left.n : round.right.n, 17)}`), {});
    },
    [touch, round, lang],
  );

  const right = state.verdict === 'right';
  const help = asks > 0 && !right ? signHelp(round, asks, state.wrong) : null;
  const feedback: Feedback = right ? signRightCard(round, state.done, host.next()) : help !== null ? help.card : state.wrong ? signWrongCard(round) : signStartCard();

  const onAskHelp = useCallback(() => {
    touch();
    const now = stateRef.current;
    const r = rounds[now.round]!;
    if (now.verdict === 'right') {
      const pass = signPass(r);
      say(lang, pass.key, pass.params);
      const next = now.done ? host.next() : { key: copyKey('feedback.sign.next'), params: {} };
      say(lang, next.key, next.params, false);
      return;
    }
    const n = Math.min(3, asks + 1);
    setAsks(n);
    // A later step stops the numbering (what is numbered stays).
    setCountUp(null);
    const h = signHelp(r, n, now.wrong);
    h.said.forEach((l, i) => say(lang, l.key, l.params, i === 0));
    if (h.countUp && place !== null) {
      setCounts(NO_COUNTS);
      setCountUp({
        cells: [...sideCells(place.left).map((_, index) => ({ side: 'left' as const, index })), ...sideCells(place.right).map((_, index) => ({ side: 'right' as const, index }))],
        shown: 0,
      });
    }
    if (h.demo) {
      setDemo({ sign: r.answer, tick: Date.now() });
      later(SIGN_DEMO_SHOWN_MS, () => setDemo(null));
    }
  }, [touch, rounds, lang, host, asks, place, later]);

  const onPrompt = useCallback(() => {
    touch();
    const task = signTask(rounds[stateRef.current.round]!);
    say(lang, task.key, task.params);
  }, [touch, rounds, lang]);

  const onRechallenge = useCallback(() => {
    if (!host.onReplay()) {
      return;
    }
    voice.stop();
  }, [host]);

  const breathe = useBreathe(state.done && state.settled);
  const small = compact || landscape;
  const cloudSize: CloudSize = landscape ? 'side' : compact ? 'compact' : 'regular';
  const bigger: SideKey | null = round.answer === '>' ? 'left' : round.answer === '<' ? 'right' : null;
  const cheer = right && state.settled ? { tick: cheerTick, left: bigger === null ? ('wave' as const) : bigger === 'left' ? ('hop' as const) : null, right: bigger === null ? ('wave' as const) : bigger === 'right' ? ('hop' as const) : null } : { tick: 0, left: null, right: null };
  const looksAt = right && state.settled && bigger !== null ? { left: bigger === 'right' ? 1 : 0, right: bigger === 'left' ? -1 : 0 } : { left: 0, right: 0 };
  const mood: Mood = state.verdict === 'wrong' ? 'puzzled' : right ? 'happy' : 'calm';
  const moods: { readonly left: Mood; readonly right: Mood } = { left: right && bigger === 'right' ? 'calm' : mood, right: right && bigger === 'left' ? 'calm' : mood };
  const signText = round.answer;
  const cloudTitle = right ? `${round.left.n} ${signText} ${round.right.n}` : `${round.left.n} □ ${round.right.n}`;
  const number = (n: number) => <Text style={[styles.cloudNumber, small ? styles.cloudNumberSmall : null]}>{n}</Text>;
  const dot = small ? 7 : 9;
  const badge = (
    <Animated.View style={[styles.badgeWrap, entrance]} testID={`cloud-look-${looks}`}>
      <Animated.View style={cloudPop}>
        <Pressable accessibilityRole="button" accessibilityLabel={cloudTitle} onPress={onPrompt} testID="prompt">
          <TargetCloud size={cloudSize} tone={right ? 'solved' : host.boss ? 'boss' : 'plain'}>
            <View style={styles.cloudInner}>
              <View style={styles.cloudLine} testID="cloud-equation">
                {number(round.left.n)}
                {right ? (
                  <Text style={[styles.cloudNumber, styles.cloudSign, small ? styles.cloudNumberSmall : null]}>{signText}</Text>
                ) : (
                  <View testID="cloud-blank" style={[styles.cloudBlank, { width: small ? 22 : 30, height: small ? 22 : 30 }]} />
                )}
                {number(round.right.n)}
              </View>
              <View style={styles.dots} testID="round-dots">
                {rounds.map((_, i) => {
                  const done = i < state.round || (i === state.round && right);
                  return <View key={i} testID={done ? 'round-dot-done' : 'round-dot'} style={[styles.dot, { width: dot, height: dot, borderRadius: dot / 2 }, done ? styles.dotDone : i === state.round ? styles.dotNow : null]} />;
                })}
              </View>
            </View>
          </TargetCloud>
        </Pressable>
      </Animated.View>
      {host.boss ? <Text pointerEvents="none" style={[styles.bossStar, small ? styles.bossStarCompact : null]}>★</Text> : null}
    </Animated.View>
  );
  const again = {
    pill: <PillButton title={text.again} onPress={onRechallenge} compact={compact} testID="again" />,
    round: <RoundButton label={<Icon name="again" size={26} />} accessibilityLabel={text.again} onPress={onRechallenge} size={compact ? 44 : 48} testID="again" />,
  };
  const solved = state.done && state.settled;
  const parts = state.done && !state.settled ? null : host.actions({ solved, compact, landscape, breathe, again });
  const actions =
    parts === null ? null : (
      <Animated.View entering={FadeInDown.duration(220)} style={landscape ? styles.actionsColumn : styles.actionsRow} pointerEvents="box-none">
        {parts}
      </Animated.View>
    );
  const tipCue = feedback.tone === 'adjust' ? `${JSON.stringify(feedback.title)}${JSON.stringify(feedback.detail)}` : null;
  const lean = { tick: looks, dx: landscape ? 0 : 6, dy: landscape ? 6 : 0, delay: 400 };
  const guideAt = compact ? LEVEL_CHROME.guide.compact : LEVEL_CHROME.guide.regular;
  const targetColors = colorsFor(hueFor(Math.max(round.left.n, round.right.n)));
  const stage = (
    <View style={styles.stageArea} onLayout={onStageLayout} testID="stage">
      {geometry !== null && place !== null ? (
        <SignStage
          geometry={geometry}
          place={place}
          roundKey={`${puzzle.ref.attemptVariant}-${state.round}`}
          signs={sign.signs}
          placed={state.placed}
          verdict={state.verdict}
          enabled={!menuOpen && !state.done && state.verdict === null}
          moods={moods}
          looks={looksAt}
          cheer={cheer}
          joined={joined}
          counts={counts}
          spotlight={help?.spotlight ?? []}
          demo={demo}
          shake={shake}
          onTapSign={onTapSign}
          onDropSign={onDropSign}
          onTakeOut={onTakeOut}
          onLift={onLift}
          onTapBlock={onTapBlock}
          onTapPlate={onTapPlate}
        />
      ) : null}
      {geometry !== null && place !== null ? (
        <Confetti tick={celebration} x={place.slot.x + place.slot.width / 2} y={place.slot.y} colors={[targetColors.fill, THEME.amber, THEME.white, targetColors.pale, THEME.leaf]} count={host.boss ? 36 : 18} duration={host.boss ? 1300 : 1000} />
      ) : null}
    </View>
  );
  const menuButton = <RoundButton label={<Icon name="menu" size={26} />} accessibilityLabel={text.menu} testID="menu" onPress={() => { touch(); setMenuOpen(true); }} />;
  const card = <AnswerFeedback feedback={feedback} lang={lang} onReplay={onAskHelp} narrow={landscape} compact={compact} />;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }, landscape ? styles.rootRow : null]} testID="sign-play">
      {landscape ? (
        <View style={styles.side} testID="level-side">
          <View style={styles.sideTop}>
            <View style={styles.sideCount}>
              <AmberGuide size={LEVEL_CHROME.guide.side} cue={tipCue} lean={lean} />
            </View>
            {menuButton}
          </View>
          <View style={styles.sideTarget}>{badge}</View>
          {card}
          <View style={styles.sideFill} />
          {actions}
        </View>
      ) : (
        <>
          <SkyCloud x={10} y={insets.top + (compact ? 40 : 58)} width={compact ? 48 : 60} />
          <SkyCloud x={win.width - insets.right - (compact ? 112 : 128)} y={insets.top + (compact ? 56 : 74)} width={compact ? 38 : 46} flip />
          <View style={[styles.header, compact ? styles.headerCompact : null]} testID="level-header">
            {badge}
          </View>
          {card}
        </>
      )}
      {stage}
      {landscape ? null : (
        <View style={[styles.footer, compact ? styles.footerCompact : null]} testID="level-footer">
          {actions}
        </View>
      )}
      {landscape ? null : (
        <View pointerEvents="none" style={[styles.cornerGuide, { top: insets.top + (compact ? LEVEL_CHROME.compact.header : LEVEL_CHROME.regular.header) - guideAt.size + guideAt.over, left: insets.left + 12 }]} testID="guide-corner">
          <AmberGuide size={guideAt.size} cue={tipCue} lean={lean} />
        </View>
      )}
      {landscape ? null : <View style={[styles.cornerMenu, { top: insets.top + 10, right: insets.right + 12 }]}>{menuButton}</View>}
      {menuOpen ? (
        <Animated.View entering={FadeIn.duration(140)} style={[styles.overlay, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10, paddingLeft: insets.left + 10, paddingRight: insets.right + 10 }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} accessibilityLabel={text.close} testID="menu-backdrop" />
          <View style={styles.menuCard} testID="menu-card">
            <ScrollView contentContainerStyle={[styles.menuItems, landscape ? styles.menuItemsWide : null]} bounces={false}>
              {[
                <PillButton key="close" title={text.close} icon="play" tone="accent" onPress={() => setMenuOpen(false)} testID="menu-close" />,
                <PillButton key="help" title={text.help} icon="bulb" onPress={() => { setMenuOpen(false); onAskHelp(); }} testID="menu-help" />,
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

// The level screen's frame (LevelScreen's styles, the same LEVEL_CHROME heights).
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.sky },
  rootRow: { flexDirection: 'row' },
  header: { height: LEVEL_CHROME.regular.header, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 16 },
  headerCompact: { height: LEVEL_CHROME.compact.header },
  side: { width: LEVEL_CHROME.sideColumn, alignItems: 'center', paddingTop: 4, paddingBottom: 6, paddingLeft: 8, gap: 4 },
  sideTop: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', minHeight: 48 },
  sideCount: { width: 76, alignItems: 'center' },
  sideTarget: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sideFill: { flex: 1 },
  badgeWrap: { alignItems: 'center' },
  cloudInner: { alignItems: 'center' },
  cloudLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cloudNumber: { fontSize: 50, lineHeight: 58, fontFamily: FONT.display, color: THEME.ink },
  cloudNumberSmall: { fontSize: 36, lineHeight: 42 },
  cloudSign: { color: '#2F6A24' },
  cloudBlank: { borderWidth: 3, borderStyle: 'dashed', borderColor: THEME.preview, borderRadius: 8 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 2 },
  dot: { borderWidth: 2, borderColor: '#8FC3E3', backgroundColor: THEME.white },
  dotDone: { backgroundColor: THEME.leafDeep, borderColor: THEME.leafDeep },
  dotNow: { borderColor: THEME.ink },
  bossStar: { position: 'absolute', top: -2, left: -10, fontSize: 30, color: THEME.amber, textShadowColor: THEME.amberDeep, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
  bossStarCompact: { top: 2, left: -8, fontSize: 24 },
  cornerMenu: { position: 'absolute' },
  cornerGuide: { position: 'absolute' },
  stageArea: { flex: 1 },
  footer: { height: LEVEL_CHROME.regular.footer, alignItems: 'center', justifyContent: 'center' },
  footerCompact: { height: LEVEL_CHROME.compact.footer, justifyContent: 'flex-start' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionsColumn: { alignItems: 'center', gap: 8 },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(43,54,69,0.38)', alignItems: 'center', justifyContent: 'center' },
  menuCard: { backgroundColor: THEME.board, borderRadius: 28, minWidth: 224, maxWidth: '100%', maxHeight: '100%', borderWidth: 2, borderColor: THEME.sandDeep, overflow: 'hidden' },
  menuItems: { padding: 16, gap: 10 },
  menuItemsWide: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 600 },
  menuItemWide: { width: 176 },
  menuGate: { alignItems: 'center', paddingTop: 4 },
});
