import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Buddy, Confetti, FONT, Stage, THEME, colorsFor, showcaseGeometry } from '../blocks-ui';
import { CHAPTERS, CONTENT_VERSION, ISLAND_SHOWCASE, copyKey, format, hueFor, materialize } from '../content';
import type { Chapter, CopyKey, Lang, NodeSpec, Puzzle } from '../content';
import { apply, judge } from '../core';
import type { BenchState } from '../core';
import type { ProgressState } from '../progress';
import { SkyCloud } from './Cloud';
import { workWaysApart } from './level-session';
import { labelOf } from './MapScreen';
import { useProgress } from './progress-store';
import { play } from './sound';
import { PillButton } from './ui';
import { say } from './voice';

// The end of an island (2026-10-15 review I): every character on it cheers
// with a staggered hop, paper flies, the child's own boss work is on show, one
// line says what comes next (spoken only when tapped), and one button goes on.
// Nothing here times out or moves on by itself.

const MAP = { zh: '回地图', en: 'Back to map' } as const;
// The page's button answers only this long after the page opens (Phase 20,
// play review Q9): the last stop's "island done" button sits about where this
// one does, and a quick second tap on it skipped the whole page in 0.4s. The
// map's hop has the same guard (MapScreen SKIP_AFTER_MS, 300ms).
export const ISLAND_SKIP_AFTER_MS = 800;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const NO_COUNTS = new Map();

function Cheer({ index, size, colors, label }: { readonly index: number; readonly size: number; readonly colors: ReturnType<typeof colorsFor>; readonly label: string }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      return;
    }
    y.set(withDelay(300 + index * 90, withRepeat(withSequence(withTiming(-size * 0.45, { duration: 180, easing: EASE_OUT }), withSpring(0, { damping: 9, stiffness: 260 })), 3, false)));
  }, [reduced, index, size, y]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <Animated.View style={[styles.cheer, style]} testID="island-cheer">
      <Buddy size={size} colors={colors} mood="happy" blink={false} />
      <Text style={[styles.cheerLabel, { color: colors.deep }]}>{label}</Text>
    </Animated.View>
  );
}

// The boss's finished work: its album picture (how the child last had it
// right, 2026-10-15 review Q); else the child's own work when it is still
// right; else the stop's reference answer (work is cleared by "play again",
// for one). Drawn on its own mat size. The stop shown is the island's last
// boss, or the one ISLAND_SHOWCASE names (Phase 22: Take-away Island's 5 split
// two ways, not the countdown's lone 1).
function bossOf(chapter: Chapter): NodeSpec | undefined {
  const pick = ISLAND_SHOWCASE[chapter.id];
  return chapter.nodes.find((n) => n.id === pick) ?? [...chapter.nodes].reverse().find((n) => n.role === 'boss') ?? chapter.nodes[chapter.nodes.length - 1];
}

function bossWork(chapter: Chapter, state: ProgressState): BenchState | null {
  const boss = bossOf(chapter);
  if (boss === undefined) {
    return null;
  }
  const kept = state.album.get(boss.id);
  if (kept !== undefined) {
    return kept;
  }
  const saved = state.nodes.get(boss.id);
  try {
    const puzzle: Puzzle = materialize(saved?.ref ?? { contentVersion: CONTENT_VERSION, chapterId: chapter.id, nodeId: boss.id, attemptVariant: 0, seed: state.seed });
    if (saved?.work != null && judge(saved.work, puzzle.question).matched) {
      return saved.work;
    }
    return puzzle.solution.reduce((w, cmd) => {
      const r = apply(w, cmd);
      return r.ok ? r.value : w;
    }, puzzle.initial);
  } catch {
    return null;
  }
}

function lineFor(chapter: Chapter, next: Chapter | null, lang: Lang): { readonly key: CopyKey; readonly params: Readonly<Record<string, string>> } {
  const island = format(chapter.title, lang);
  return next === null ? { key: copyKey('island.all'), params: {} } : { key: copyKey('island.onward'), params: { island, next: format(next.title, lang) } };
}

export function IslandDoneScreen({ chapterId }: { readonly chapterId: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const { state } = useProgress();
  const index = CHAPTERS.findIndex((c) => c.id === chapterId);
  const chapter = index === -1 ? null : CHAPTERS[index]!;
  const next = index === -1 ? null : (CHAPTERS[index + 1] ?? null);
  const done = chapter !== null && state !== null && chapter.nodes.every((n) => state.completedNodeIds.has(n.id));
  // Only a finished island has a page; anything else (the static export's
  // placeholder id, a typed address) goes to the map.
  useEffect(() => {
    if (state !== null && !done) {
      router.replace('/');
    }
  }, [state, done, router]);
  useEffect(() => {
    if (done) {
      play('fanfare');
    }
  }, [done]);
  const shown = useMemo(() => (chapter === null || state === null ? null : bossWork(chapter, state)), [chapter, state]);
  // Two ways to make 7 that touch: two 7s, not one 14 (D-097).
  const apart = useMemo(() => {
    const boss = chapter === null ? undefined : bossOf(chapter);
    return boss === undefined || shown === null ? [] : workWaysApart(boss, shown);
  }, [chapter, shown]);
  // When the page opened (set after the first paint; until then nothing goes on).
  const openedAt = useRef(Number.POSITIVE_INFINITY);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);
  if (chapter === null || state === null || !done) {
    return <View style={[styles.root, { paddingTop: insets.top }]} />;
  }
  const lang = state.language;
  const line = lineFor(chapter, next, lang);
  const landscape = win.width > win.height;
  // Landscape: the words and the button on the left, the crowd and the work on the right, all on one screen.
  const column = landscape ? Math.min(Math.floor((win.width - insets.left - insets.right - 60) / 2), 420) : Math.min(win.width - 40, 420);
  const box = { width: Math.min(column - 8, 360), height: landscape ? Math.max(90, win.height - insets.top - insets.bottom - 190) : 200 };
  const geometry = shown === null ? null : showcaseGeometry(box.width, box.height, shown.bounds);
  const size = landscape ? 30 : Math.max(30, Math.min(48, Math.floor(column / 6) - 12));
  const colors = chapter.nodes.map((n) => colorsFor(hueFor(labelOf(n).number)).fill);
  const onGo = () => {
    if (Date.now() - openedAt.current < ISLAND_SKIP_AFTER_MS) {
      return;
    }
    if (next === null) {
      router.replace('/');
      return;
    }
    // Over to the next island the way every stop is reached: the map's hop.
    router.replace({ pathname: '/', params: { from: chapter.nodes[chapter.nodes.length - 1]!.id, to: next.nodes[0]!.id } });
  };
  const go = (
    <View style={styles.go}>
      <PillButton title={next === null ? MAP[lang] : format(copyKey('island.go'), lang, { next: format(next.title, lang) })} tone="accent" onPress={onGo} testID="island-go" />
    </View>
  );
  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]} testID="island-done">
      <SkyCloud x={10} y={insets.top + 30} width={60} />
      <SkyCloud x={win.width - 90} y={insets.top + 70} width={46} flip />
      <ScrollView contentContainerStyle={[styles.scroll, landscape ? styles.scrollWide : null]} bounces={false}>
        <View style={[styles.column, { width: column }]}>
          <View style={styles.sign}>
            <Text style={styles.signText}>★ {format(chapter.title, lang)} ★</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => say(lang, line.key, line.params)} style={styles.bubble} testID="island-line">
            <Text style={styles.bubbleText}>{format(line.key, lang, line.params)}</Text>
          </Pressable>
          {landscape ? go : null}
        </View>
        <View style={[styles.column, { width: column }]}>
        <View style={[styles.crowd, landscape ? styles.crowdWide : null]}>
          {chapter.nodes.map((n, i) => (
            <Cheer key={n.id} index={i} size={size} colors={colorsFor(hueFor(labelOf(n).number))} label={labelOf(n).label} />
          ))}
        </View>
        {shown !== null && geometry !== null ? (
          <View style={{ width: box.width, height: geometry.bench.height + 16, marginTop: 8 }} testID="island-work">
            <View style={{ position: 'absolute', left: 0, right: 0, top: 8, height: geometry.bench.height }}>
              <Stage
                state={shown}
                geometry={geometry}
                trayObjects={[]}
                trayHidden
                enabled={false}
                countOrder={NO_COUNTS}
                matched
                mood="happy"
                celebrateTick={1}
                merge
                apart={apart}
                onCommand={() => false}
                onPreview={() => false}
                onTapUnit={() => undefined}
              />
              <Confetti tick={1} x={box.width / 2} y={geometry.bench.height / 2} colors={[...colors, THEME.amber, THEME.white]} count={40} duration={1400} />
            </View>
          </View>
        ) : null}
        </View>
      </ScrollView>
      {/* Portrait: the one way on is a fixed footer, never below the fold (2026-10-16
          review #1: on a 375 × 553 phone it sat under the screen with nothing
          saying "scroll"). The crowd and the work scroll above it. */}
      {landscape ? null : (
        <View style={styles.footer} testID="island-footer">
          {go}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.sky },
  scroll: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, gap: 14 },
  scrollWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 12, paddingBottom: 12, gap: 20, flexGrow: 1 },
  column: { alignItems: 'center', gap: 14 },
  crowdWide: { paddingTop: 10, gap: 6 },
  sign: { backgroundColor: THEME.leaf, borderWidth: 3, borderColor: THEME.leafDeep, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 8, boxShadow: `0 4px 0 ${THEME.leafDeep}` },
  signText: { fontSize: 24, fontFamily: FONT.display, color: THEME.ink },
  bubble: { backgroundColor: THEME.white, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, boxShadow: `0 4px 0 ${THEME.skyDeep}`, maxWidth: 360 },
  bubbleText: { fontSize: 18, fontFamily: FONT.body, color: THEME.ink, textAlign: 'center' },
  crowd: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, maxWidth: 420, paddingTop: 18 },
  cheer: { alignItems: 'center', gap: 2 },
  cheerLabel: { fontSize: 14, fontFamily: FONT.display },
  go: { marginTop: 6 },
  // At least 8px between the button's lip and the bottom of the screen (review I-6).
  footer: { alignItems: 'center', paddingTop: 4, paddingBottom: 12 },
});
