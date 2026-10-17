import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONT, SANDBOX_CHROME, Stage, THEME, computeGeometry, trayObjects } from '../blocks-ui';
import { copyKey, sandboxMaterial } from '../content';
import type { Command, UnitId } from '../core';
import { SkyCloud } from './Cloud';
import { Icon } from './icons';
import type { IconName } from './icons';
import { countOrder, countProgress, countTap, countWordsStale, recount } from './level-session';
import { useProgress } from './progress-store';
import { canUndo, commitSandbox, previewSandbox, startSandbox, tidySandbox, undoSandbox } from './sandbox-session';
import type { SandboxSession } from './sandbox-session';
import { play } from './sound';
import { AUTO_SPEECH } from './speech-policy';
import { RoundButton } from './ui';
import { say, voice } from './voice';

// Free play (2026-10-15 review O, D-051 – D-055): ten blocks, an empty mat and
// no question. Nothing here is right or wrong, so there is no feedback card, no
// right / wrong sound, no paper, no cheer and no next stop. What stays is what
// the blocks do by themselves: the pick-up, drop and put-back sounds, clusters
// that take their count's colour, and counting with its numbers and its total.
// The mat is kept as the child leaves it (progress `sandbox`).

const TEXT = {
  zh: { title: '自由玩', map: '回地图', tidy: '全部收回', undo: '撤销', recount: '再数一遍' },
  en: { title: 'Free play', map: 'Map', tidy: 'Put all back', undo: 'Undo', recount: 'Count again' },
} as const;

// The "like this" hand on an empty mat, with a level's timing: after this long
// without a touch, at most DEMO.max times a visit.
const DEMO = { afterMs: 5000, shownMs: 4200, max: 2 } as const;

// A round button with its name underneath: the picture for the child, the word for a grown-up.
function ToolButton({ icon, label, onPress, enabled = true, testID }: { readonly icon: IconName; readonly label: string; readonly onPress: () => void; readonly enabled?: boolean; readonly testID: string }) {
  return (
    <View style={[styles.tool, enabled ? null : styles.toolOff]} pointerEvents={enabled ? 'auto' : 'none'} testID={`${testID}-wrap`}>
      <RoundButton label={<Icon name={icon} size={28} />} size={52} accessibilityLabel={label} testID={testID} onPress={onPress} />
      <Text style={styles.toolLabel}>{label}</Text>
    </View>
  );
}

export function SandboxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const landscape = win.width > win.height;
  const compact = !landscape && win.height < SANDBOX_CHROME.compactBelow;
  const { state, dispatch } = useProgress();
  const lang = state?.language ?? 'zh';
  const text = TEXT[lang];

  // The box never changes, so neither does the tray's layout.
  const material = useMemo(() => sandboxMaterial(), []);
  const objects = useMemo(() => trayObjects(material), [material]);

  // Where the child left it, read once when progress is there.
  const [session, setSession] = useState<SandboxSession | null>(null);
  const sessionRef = useRef<SandboxSession | null>(null);
  useEffect(() => {
    if (state === null || sessionRef.current !== null) {
      return;
    }
    const s = startSandbox(state.sandbox, material);
    sessionRef.current = s;
    setSession(s);
  }, [state, material]);

  // A finished count: the counted blocks blink together (as in a level).
  const [counts, setCounts] = useState(0);
  const countRounds = useRef(0);

  const [demo, setDemo] = useState(0);
  const [stirred, setStirred] = useState(0);
  const demos = useRef(0);
  const stir = useCallback(() => {
    setDemo(0);
    setStirred((n) => n + 1);
  }, []);
  const emptyMat = session !== null && session.history.state.bench.size === 0;
  useEffect(() => {
    if (!emptyMat || demos.current >= DEMO.max) {
      return;
    }
    const show = setTimeout(() => {
      demos.current += 1;
      setDemo(demos.current);
    }, DEMO.afterMs);
    const hide = setTimeout(() => setDemo(0), DEMO.afterMs + DEMO.shownMs);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [emptyMat, stirred]);

  // One dispatch, so one write, per change to the mat.
  const update = useCallback(
    (next: SandboxSession) => {
      const before = sessionRef.current;
      sessionRef.current = next;
      setSession(next);
      // Blocks on or off mid-count: the numbers still queued are for another mat.
      if (before !== null && countWordsStale(before, next)) {
        voice.stop();
      }
      dispatch({ type: 'saveSandbox', work: next.history.state });
    },
    [dispatch],
  );

  const onCommand = useCallback(
    (cmd: Command): boolean => {
      const current = sessionRef.current;
      if (current === null) {
        return false;
      }
      const r = commitSandbox(current, cmd);
      if (!r.ok) {
        return false;
      }
      update(r.session);
      return true;
    },
    [update],
  );

  const onPreview = useCallback((cmd: Command): boolean => {
    const current = sessionRef.current;
    return current === null ? false : previewSandbox(current, cmd);
  }, []);

  // Counting as in a level: a number word per block, then the total once.
  const onTapUnit = useCallback(
    (unitId: UnitId) => {
      const current = sessionRef.current;
      if (current === null) {
        return;
      }
      const { session: next, outcome } = countTap(current, unitId);
      sessionRef.current = next;
      setSession(next);
      stir();
      if (outcome.kind !== 'counted') {
        return;
      }
      play(outcome.complete ? 'counted' : 'count', outcome.index);
      if (AUTO_SPEECH.countNumbers) {
        say(lang, copyKey(`number.${Math.min(outcome.index, 17)}`), {}, false);
      }
      if (outcome.complete) {
        countRounds.current += 1;
        setCounts(countRounds.current);
        if (AUTO_SPEECH.countTotal) {
          say(lang, copyKey('count.total'), { n: outcome.total }, false);
        }
      }
    },
    [lang, stir],
  );

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

  const onUndo = useCallback(() => {
    const current = sessionRef.current;
    const back = current === null ? null : undoSandbox(current);
    if (back !== null) {
      update(back);
      stir();
    }
  }, [update, stir]);

  // Everything back in the box in one go, and one undo brings it all back (PRD P-008). No question asked.
  const onTidy = useCallback(() => {
    const current = sessionRef.current;
    const tidy = current === null ? null : tidySandbox(current);
    if (tidy !== null) {
      update(tidy);
      play('return');
      stir();
    }
  }, [update, stir]);

  const onMap = useCallback(() => {
    voice.stop();
    router.dismissTo('/');
  }, [router]);

  const onDragActive = useCallback(
    (active: boolean) => {
      if (active) {
        stir();
      }
    },
    [stir],
  );

  const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null);
  const onStageLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStageSize({ width, height });
  }, []);
  const geometry = useMemo(
    () => (stageSize === null ? null : computeGeometry(stageSize.width, stageSize.height, material.bounds, objects.map((o) => o.footprint))),
    [stageSize, material, objects],
  );
  const order = useMemo(() => (session === null ? new Map<UnitId, number>() : countOrder(session)), [session]);

  // The static export renders this page before any progress exists: draw nothing.
  if (state === null || session === null) {
    return <View style={[styles.root, { paddingTop: insets.top }]} />;
  }

  const counting = countProgress(session);
  const groundTop = geometry === null || geometry.arrangement !== 'below' ? null : geometry.tray.y - 18;
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
  // "This is free play", without anything to read: the sandbox picture on a sign.
  const sign = (
    <View style={styles.sign} testID="sandbox-sign">
      <Icon name="sandbox" size={landscape ? 22 : 26} />
      <Text style={[styles.signText, landscape ? styles.signTextSmall : null]}>{text.title}</Text>
    </View>
  );
  const mapButton = <ToolButton icon="map" label={text.map} onPress={onMap} testID="sandbox-map" />;
  const tools = (
    <View style={styles.tools}>
      <ToolButton icon="tidy" label={text.tidy} onPress={onTidy} enabled={session.history.state.bench.size > 0} testID="sandbox-tidy" />
      <ToolButton icon="undo" label={text.undo} onPress={onUndo} enabled={canUndo(session)} testID="sandbox-undo" />
    </View>
  );
  const stage = (
    <View style={styles.stageArea} onLayout={onStageLayout} testID="stage">
      {groundTop !== null ? <View style={[styles.ground, { top: groundTop }]} /> : null}
      {geometry !== null ? (
        <Stage
          state={session.history.state}
          geometry={geometry}
          trayObjects={objects}
          enabled
          countOrder={order}
          matched={false}
          // Nothing to solve: calm faces, never a celebration.
          mood="calm"
          celebrateTick={0}
          onCommand={onCommand}
          onPreview={onPreview}
          onTapUnit={onTapUnit}
          onDragActive={onDragActive}
          onFeel={play}
          demo={demo}
          wink={counting.complete ? counts : 0}
        />
      ) : null}
    </View>
  );

  return (
    <View
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }, landscape ? styles.rootRow : null]}
      testID="sandbox-screen">
      {landscape ? (
        <View style={styles.side}>
          <View style={styles.sideTop}>
            <View style={styles.sideCount}>{countChip}</View>
            {mapButton}
          </View>
          {sign}
          <View style={styles.sideFill} />
          {tools}
        </View>
      ) : (
        <>
          <SkyCloud x={10} y={insets.top + (compact ? 34 : 44)} width={compact ? 44 : 54} />
          <SkyCloud x={win.width - insets.right - (compact ? 100 : 116)} y={insets.top + (compact ? 40 : 52)} width={compact ? 36 : 42} flip />
          <View style={[styles.header, compact ? styles.headerCompact : null]}>{sign}</View>
        </>
      )}
      {stage}
      {landscape ? null : (
        <View style={[styles.footer, compact ? styles.footerCompact : null]}>
          {mapButton}
          {tools}
        </View>
      )}
      {landscape || countChip === null ? null : <View style={[styles.cornerCount, { top: insets.top + 10, left: insets.left + 12 }]}>{countChip}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.sky },
  rootRow: { flexDirection: 'row' },
  // Heights from SANDBOX_CHROME only.
  header: { height: SANDBOX_CHROME.regular.header, alignItems: 'center', justifyContent: 'center' },
  headerCompact: { height: SANDBOX_CHROME.compact.header },
  footer: { height: SANDBOX_CHROME.regular.footer, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  footerCompact: { height: SANDBOX_CHROME.compact.footer },
  side: { width: SANDBOX_CHROME.sideColumn, alignItems: 'center', paddingTop: 4, paddingBottom: 6, paddingLeft: 8, gap: 8 },
  sideTop: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', minHeight: 52 },
  sideCount: { width: 76, alignItems: 'center' },
  sideFill: { flex: 1 },
  sign: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: THEME.leaf, borderWidth: 3, borderColor: THEME.leafDeep, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5, boxShadow: `0 4px 0 ${THEME.leafDeep}` },
  signText: { fontSize: 20, fontFamily: FONT.display, color: THEME.ink },
  signTextSmall: { fontSize: 15 },
  tools: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  tool: { width: 64, alignItems: 'center', gap: 2 },
  toolOff: { opacity: 0.4 },
  toolLabel: { fontSize: 12, lineHeight: 14, fontFamily: FONT.body, fontWeight: '800', color: THEME.inkSoft, textAlign: 'center' },
  cornerCount: { position: 'absolute', width: 76, alignItems: 'center' },
  recount: { alignItems: 'center', gap: 2 },
  recountLabel: { fontSize: 12, fontFamily: FONT.body, fontWeight: '800', color: THEME.inkSoft, textAlign: 'center' },
  // Ink, not green: green is "right" (2026-10-16 review F-1a).
  countChip: { minWidth: 52, height: 52, borderRadius: 26, paddingHorizontal: 12, backgroundColor: THEME.white, borderWidth: 3, borderColor: THEME.ink, alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 0 ${THEME.ink}` },
  countChipText: { fontSize: 28, fontFamily: FONT.display, color: THEME.ink },
  stageArea: { flex: 1 },
  ground: { position: 'absolute', left: -40, right: -40, bottom: -80, backgroundColor: THEME.sand, borderTopLeftRadius: 200, borderTopRightRadius: 200, opacity: 0.9 },
});
