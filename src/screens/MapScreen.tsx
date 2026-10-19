import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent, ScrollViewInstance } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Buddy, FONT, Face, THEME, colorsFor, useBob, usePop } from '../blocks-ui';
import { CHAPTERS, format, hueFor } from '../content';
import type { Chapter, NodeId, NodeSpec } from '../content';
import { chapterCompletion, defaultCurrent, mapOrder, statusOf } from '../progress';
import type { NodeStatus, ProgressState } from '../progress';
import { SkyCloud } from './Cloud';
import { Icon } from './icons';
import { useProgress } from './progress-store';
import { play } from './sound';
import { ParentGate, RoundButton } from './ui';

const TEXT = {
  zh: { title: 'Amber Blocks', parent: '家长', hold: '按住进入家长区', play: '开始', next: '去下一站', album: '我的作品', sandbox: '自由玩', trophy: '奖杯' },
  en: { title: 'Amber Blocks', parent: 'Parents', hold: "Press and hold for the parents' area", play: 'Play', next: 'Go to the next stop', album: 'My builds', sandbox: 'Free play', trophy: 'Trophy' },
} as const;

// The way on (2026-10-15 review H): "next stop" comes back to the map first.
// The marker hops along the stepping stones to the next stop, which wakes up
// with the arrive sound, and a moment later the stop opens by itself; a tap
// anywhere goes straight in. The map never opens on its own after a solve,
// and nothing on the mat is cleared by a timer (PRD §2).
export const ADVANCE = { startMs: 250, hopMs: 150, hops: 4, enterMs: 900 } as const;
// "Tap anywhere to go straight in" waits this long after the map opens: a
// child's second tap on "next" otherwise lands on the fresh map and skips the
// whole hop (2026-10-16 review D-1: 91ms after the first tap).
export const SKIP_AFTER_MS = 300;
const HOP = 18;

export interface Advance {
  readonly from: NodeId;
  readonly to: NodeId;
}

// The advance the map was asked to show, if it is one it can: two known stops,
// the second one open.
export function advanceOf(params: { readonly from?: string | string[]; readonly to?: string | string[] }, state: ProgressState | null): Advance | null {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const from = one(params.from);
  const to = one(params.to);
  const known = new Set<string>(mapOrder(CHAPTERS).map((e) => e.nodeId));
  if (state === null || from === undefined || to === undefined || !known.has(from) || !known.has(to)) {
    return null;
  }
  return statusOf(state, to as NodeId) === 'locked' ? null : { from: from as NodeId, to: to as NodeId };
}

const STOP = 68;
const BOSS = 84;
const STEP = 96;
const SHOAL = 8;
// The trail starts below the island's sign, with room for the marker over the first stop.
const TRAIL_TOP = 76;

export function labelOf(node: NodeSpec): { label: string; number: number } {
  const s = node.spec;
  switch (s.kind) {
    case 'quantity':
      return { label: String(s.targets[0] ?? '?'), number: s.targets[0] ?? 1 };
    case 'quantity_shape':
      return { label: String(s.target), number: s.target };
    case 'addition_exact': {
      const pair = s.pairs[0] ?? [0, 0];
      return { label: `${pair[0]}+${pair[1]}`, number: pair[0] + pair[1] };
    }
    case 'sum_composition':
      return { label: String(s.sum), number: s.sum };
    // Take-away Island (Phase 22, design §4.2): a split is its whole; a take-away
    // reads `4−1` and wears the colour of what is left (the character the child
    // ends with); the countdown boss is its start.
    case 'split':
      return { label: String(s.total), number: s.total };
    case 'take_away':
      return s.steps !== undefined ? { label: String(s.start), number: s.start } : { label: `${s.start}−${s.take}`, number: s.start - s.take };
  }
}

// A winding trail: stops swing left and right down the island.
function trailX(index: number, width: number, size: number): number {
  const amplitude = Math.max(0, width / 2 - size / 2 - 10);
  return width / 2 + amplitude * Math.sin(index * 1.05 + 0.4) - size / 2;
}

// Where stop i of a chapter sits on its island's trail: top-left and size.
function stopAt(chapter: Chapter, i: number, trailWidth: number): { readonly x: number; readonly y: number; readonly size: number } {
  const node = chapter.nodes[i]!;
  const size = node.role === 'boss' ? BOSS : STOP;
  return { x: trailX(i, trailWidth, size), y: i * STEP + (node.role === 'boss' ? -8 : 0), size };
}

// The marker's resting place over a stop (as Marker draws it).
function markerAt(stop: { readonly x: number; readonly y: number; readonly size: number }): { readonly x: number; readonly y: number } {
  return { x: stop.x + stop.size / 2 - 13, y: stop.y - 34 };
}

// The marker on its way: hops from one point to the next, starting `delay` ms
// after it mounts. With reduced motion it is simply there when it lands.
function TravelMarker({ points, delay }: { readonly points: ReadonlyArray<{ readonly x: number; readonly y: number }>; readonly delay: number }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  const hops = points.length - 1;
  useEffect(() => {
    p.set(withDelay(delay, withTiming(1, { duration: reduced ? 0 : hops * ADVANCE.hopMs, easing: Easing.linear })));
  }, [p, delay, hops, reduced]);
  const xs = points.map((q) => q.x);
  const ys = points.map((q) => q.y);
  const style = useAnimatedStyle(() => {
    const at = p.get() * hops;
    const seg = Math.min(Math.floor(at), hops - 1);
    const t = at - seg;
    const x = xs[seg]! + (xs[seg + 1]! - xs[seg]!) * t;
    const y = ys[seg]! + (ys[seg + 1]! - ys[seg]!) * t - HOP * Math.sin(Math.PI * t);
    return { transform: [{ translateX: x }, { translateY: y }] };
  });
  return (
    <Animated.View pointerEvents="none" testID="travel-marker" style={[styles.marker, styles.travel, style]}>
      <View style={styles.markerTip} />
    </Animated.View>
  );
}

function Marker({ size }: { readonly size: number }) {
  const bob = useBob(true);
  return (
    <Animated.View pointerEvents="none" style={[styles.marker, { left: size / 2 - 13, top: -34 }, bob]}>
      <View style={styles.markerTip} />
    </Animated.View>
  );
}

// Each stop is a block character with its number on its tummy: asleep (pale)
// until it unlocks, awake and blinking when it is open, beaming once it is done.
// A sleeping stop wiggles and bonks when tapped instead of doing nothing.
function StopDot({
  node,
  status,
  current,
  x,
  y,
  onPress,
  dozing = false,
  woken = 0,
}: {
  readonly node: NodeSpec;
  readonly status: NodeStatus;
  readonly current: boolean;
  readonly x: number;
  readonly y: number;
  readonly onPress: () => void;
  // The next stop, still asleep until the marker arrives; then it wakes (woken > 0) with a pop.
  readonly dozing?: boolean;
  readonly woken?: number;
}) {
  const reduced = useReducedMotion();
  const wiggle = useSharedValue(0);
  const wiggleStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wiggle.get()}deg` }] }));
  const wake = usePop(woken);
  const { label, number } = labelOf(node);
  const colors = colorsFor(hueFor(number));
  const locked = status === 'locked';
  const done = status === 'completed';
  const boss = node.role === 'boss';
  const size = boss ? BOSS : STOP;
  const border = 3;
  const face = size * 0.62;
  const onLocked = () => {
    play('blocked');
    if (!reduced) {
      wiggle.set(withSequence(withTiming(-8, { duration: 60 }), withTiming(8, { duration: 90 }), withTiming(-5, { duration: 80 }), withSpring(0, { damping: 10, stiffness: 260 })));
    }
  };
  return (
    <View style={{ position: 'absolute', left: x, top: y, width: size, height: size }}>
      {current ? <Marker size={size} /> : null}
      {boss ? <Text style={styles.crown}>★</Text> : null}
      <Animated.View style={[wiggleStyle, wake]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${node.id} ${status}`}
          accessibilityState={{ disabled: locked }}
          testID={`stop-${node.id}`}
          onPress={locked ? onLocked : onPress}
          style={({ pressed }) => [
            styles.stop,
            {
              width: size,
              height: size,
              borderRadius: size * 0.3,
              borderWidth: border,
              backgroundColor: locked ? colors.pale : colors.fill,
              // Asleep: the pale body, outlined in the colour's own edge (2026-10-16
              // review F-2: the fill as outline was 1.2–2.3:1 on the pale body).
              borderColor: colors.edge,
              opacity: locked ? 0.92 : 1,
              transform: [{ translateY: pressed && !locked ? 3 : 0 }, { scale: current ? 1.06 : 1 }],
              boxShadow: `inset 0 -6px 0 rgba(0,0,0,${locked ? 0.06 : 0.14}), inset 0 4px 0 rgba(255,255,255,0.4), 0 ${pressed && !locked ? 2 : 5}px 0 rgba(27,42,58,0.18)`,
            },
          ]}>
          <View pointerEvents="none" style={{ position: 'absolute', left: (size - 2 * border - face) / 2, top: -face * 0.04, width: face, height: face }}>
            <Face size={face} mood={done ? 'happy' : locked || dozing ? 'sleepy' : 'calm'} blush={colors.blush} blink={!locked && !done && !dozing} />
          </View>
          <Text style={[styles.stopLabel, { color: locked ? colors.deep : THEME.faceInk, fontSize: label.length > 2 ? size * 0.27 : size * 0.36, lineHeight: size * 0.4, top: size * 0.47 }]}>{label}</Text>
        </Pressable>
      </Animated.View>
      {done ? (
        <View style={styles.check}>
          <Text style={styles.checkText}>✓</Text>
        </View>
      ) : null}
    </View>
  );
}

// Once every island is done (2026-10-15 review I): a string of little flags in
// the blocks' colours with a cup in the middle, for good. Tapping it opens the
// last island's page again, its crowd and boss work (Phase 20 Q9).
function Trophy({ label, onPress }: { readonly label: string; readonly onPress: () => void }) {
  const flags = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6', 'n7', 'n8', 'n9', 'n10'];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.trophy} testID="map-trophy">
      <View style={styles.bunting}>
        <View style={styles.string} />
        {flags.map((h, i) => (
          <View key={h} style={[styles.flag, { borderTopColor: colorsFor(h).fill, marginTop: Math.abs(i - 4.5) < 3 ? 6 - Math.abs(i - 4.5) : 0 }]} />
        ))}
      </View>
      <View style={styles.cup}>
        <View style={styles.cupBowl}>
          <Text style={styles.cupStar}>★</Text>
        </View>
        <View style={[styles.cupHandle, { left: -9 }]} />
        <View style={[styles.cupHandle, { right: -9 }]} />
        <View style={styles.cupStem} />
        <View style={styles.cupBase} />
      </View>
    </Pressable>
  );
}

// Scenery on the island's edge, opposite the trail so it never sits under a stop.
function Palm({ x, y, flip }: { readonly x: number; readonly y: number; readonly flip: boolean }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: 54, height: 70, transform: [{ scaleX: flip ? -1 : 1 }] }}>
      <View style={styles.trunk} />
      {[-38, 8, 52].map((deg) => (
        <View key={deg} style={[styles.leaf, { transform: [{ rotate: `${deg}deg` }] }]} />
      ))}
      <View style={styles.coconut} />
    </View>
  );
}

function Shell({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
      <View style={styles.shell} />
      <View style={[styles.shell, { width: 14, height: 9, borderTopLeftRadius: 7, borderTopRightRadius: 7 }]} />
    </View>
  );
}

function Tuft({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
      {[-22, 0, 22].map((deg, i) => (
        <View key={deg} style={[styles.blade, { height: i === 1 ? 18 : 13, transform: [{ rotate: `${deg}deg` }] }]} />
      ))}
    </View>
  );
}

function Island({ chapter, width, children, done, total, title, onTop }: { readonly chapter: Chapter; readonly width: number; readonly children: React.ReactNode; readonly done: number; readonly total: number; readonly title: string; readonly onTop: (y: number) => void }) {
  const height = chapter.nodes.length * STEP + 20 + TRAIL_TOP - 36;
  return (
    <View style={styles.shoal} onLayout={(e) => onTop(e.nativeEvent.layout.y + SHOAL)}>
      <View style={[styles.island, { height }]}>
        <View style={styles.sign}>
          <Text style={styles.signText}>{title}</Text>
          <Text style={styles.signCount}>
            {done}/{total}
          </Text>
        </View>
        <View style={{ position: 'absolute', left: 0, top: TRAIL_TOP, width, height: height - TRAIL_TOP }}>{children}</View>
      </View>
    </View>
  );
}

export function MapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useProgress();
  const params = useLocalSearchParams<{ from?: string; to?: string }>();
  // Read once, as soon as progress is there: the advance belongs to this visit of the map.
  const [asked, setAsked] = useState<Advance | null | undefined>(undefined);
  if (asked === undefined && state !== null) {
    setAsked(advanceOf(params, state));
  }
  const advance = asked ?? null;
  const [landed, setLanded] = useState(false);
  const leaving = useRef(false);
  const goNext = useCallback(() => {
    if (advance === null || leaving.current) {
      return;
    }
    leaving.current = true;
    router.replace({ pathname: '/play/[nodeId]', params: { nodeId: advance.to } });
  }, [advance, router]);
  // When the map opened (set after the first paint; until then nothing skips).
  const openedAt = useRef(Number.POSITIVE_INFINITY);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);
  const onSkip = useCallback(() => {
    if (Date.now() - openedAt.current >= SKIP_AFTER_MS) {
      goNext();
    }
  }, [goNext]);
  useEffect(() => {
    if (advance === null) {
      return;
    }
    const landAt = ADVANCE.startMs + ADVANCE.hops * ADVANCE.hopMs;
    // A light tick on landing: the arrival jingle belongs to the stop itself,
    // which plays it when it opens (once, not twice in 0.9s; review D-4).
    const land = setTimeout(() => {
      setLanded(true);
      play('tap');
    }, landAt);
    const enter = setTimeout(goNext, landAt + ADVANCE.enterMs);
    return () => {
      clearTimeout(land);
      clearTimeout(enter);
    };
  }, [advance, goNext]);
  const [width, setWidth] = useState(0);
  const [viewport, setViewport] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
    setViewport(e.nativeEvent.layout.height);
  };
  // Open the map on the current stop: after the last stop of the first island
  // it sat below the fold, 2000px down.
  const scroll = useRef<ScrollViewInstance>(null);
  const [islandTops, setIslandTops] = useState<Readonly<Record<string, number>>>({});
  const scrolled = useRef(false);
  useEffect(() => {
    if (state === null || scrolled.current || viewport === 0 || width === 0) {
      return;
    }
    // On the way on, both stops are in view: the one just done and the next.
    const targets = advance === null ? [defaultCurrent(state)] : [advance.from, advance.to];
    const ys: number[] = [];
    for (const target of targets) {
      const chapter = CHAPTERS.find((c) => c.nodes.some((n) => n.id === target));
      const top = chapter === undefined ? undefined : islandTops[chapter.id];
      if (chapter === undefined || top === undefined) {
        return;
      }
      ys.push(top + TRAIL_TOP + chapter.nodes.findIndex((n) => n.id === target) * STEP + STOP / 2);
    }
    const centre = ys.reduce((a, b) => a + b, 0) / ys.length;
    scroll.current?.scrollTo({ y: Math.max(0, centre - viewport / 2), animated: false });
    scrolled.current = true;
  }, [state, viewport, width, islandTops, advance]);
  if (state === null) {
    return <View style={[styles.root, { paddingTop: insets.top }]} />;
  }
  const lang = state.language;
  const text = TEXT[lang];
  const current = defaultCurrent(state);
  // Every island finished: bunting and a cup stay on the map from then on.
  const allDone = mapOrder(CHAPTERS).every((e) => state.completedNodeIds.has(e.nodeId));
  const trailWidth = Math.max(0, width - 2 * 20 - 2 * 16 - 2 * SHOAL);
  // The hop path, in the next stop's island: the marker over the stop just
  // done, the stepping stones between, the marker over the next stop.
  const travel = (() => {
    if (advance === null || trailWidth === 0) {
      return null;
    }
    const where = (id: NodeId) => {
      const chapter = CHAPTERS.find((c) => c.nodes.some((n) => n.id === id))!;
      return { chapter, stop: stopAt(chapter, chapter.nodes.findIndex((n) => n.id === id), trailWidth) };
    };
    const a = where(advance.from);
    const b = where(advance.to);
    const topA = islandTops[a.chapter.id];
    const topB = islandTops[b.chapter.id];
    if (topA === undefined || topB === undefined) {
      return null;
    }
    const start = markerAt(a.stop);
    const end = markerAt(b.stop);
    const from = { x: start.x, y: start.y + topA - topB };
    const points = [0, 0.3, 0.5, 0.7, 1].map((t) => ({ x: from.x + (end.x - from.x) * t, y: from.y + (end.y - from.y) * t }));
    return { chapterId: b.chapter.id, points };
  })();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView ref={scroll} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 110 }]} onLayout={onLayout} showsVerticalScrollIndicator={false}>
        {width > 0 ? (
          <>
            <SkyCloud x={-6} y={8} width={64} />
            <SkyCloud x={width - 84} y={30} width={48} flip />
          </>
        ) : null}
        {/* The name, held up by a 1 and a 2. */}
        <View style={styles.titleRow}>
          <Buddy size={34} colors={colorsFor('n1')} />
          <Text style={styles.title}>{text.title}</Text>
          <Buddy size={34} colors={colorsFor('n2')} />
        </View>
        {CHAPTERS.map((chapter) => {
          const { done, total } = chapterCompletion(state, chapter.id);
          return (
            <Island
              key={chapter.id}
              chapter={chapter}
              width={trailWidth}
              done={done}
              total={total}
              title={format(chapter.title, lang)}
              onTop={(y) => setIslandTops((tops) => (tops[chapter.id] === y ? tops : { ...tops, [chapter.id]: y }))}>
              {width > 0
                ? chapter.nodes.map((node, i) => {
                    const size = node.role === 'boss' ? BOSS : STOP;
                    const x = trailX(i, trailWidth, size);
                    const y = i * STEP + (node.role === 'boss' ? -8 : 0);
                    const next = chapter.nodes[i + 1];
                    const nx = next === undefined ? null : trailX(i + 1, trailWidth, next.role === 'boss' ? BOSS : STOP) + (next.role === 'boss' ? BOSS : STOP) / 2;
                    const ny = next === undefined ? null : (i + 1) * STEP + (next.role === 'boss' ? -8 : 0) + (next.role === 'boss' ? BOSS : STOP) / 2;
                    const cx = x + size / 2;
                    const cy = y + size / 2;
                    // Scenery every third stop, on the far side from the trail.
                    const left = cx > trailWidth / 2;
                    const decorX = left ? 0 : trailWidth - 54;
                    const decor = i % 3 === 1 ? (i % 2 === 1 ? <Palm x={decorX} y={y - 6} flip={!left} /> : <Shell x={left ? 6 : trailWidth - 44} y={y + 30} />) : i % 3 === 2 && chapter.nodes.length > 4 ? <Tuft x={left ? 10 : trailWidth - 34} y={y + 40} /> : null;
                    return (
                      <View key={node.id}>
                        {decor}
                        {nx !== null && ny !== null
                          ? [0.3, 0.5, 0.7].map((t) => (
                              <View key={t} style={[styles.stone, { left: cx + (nx - cx) * t - 7, top: cy + (ny - cy) * t - 4.5 }]} />
                            ))
                          : null}
                        <StopDot
                          node={node}
                          status={statusOf(state, node.id)}
                          current={advance === null && node.id === current}
                          x={x}
                          y={y}
                          onPress={() => router.push({ pathname: '/play/[nodeId]', params: { nodeId: node.id } })}
                          dozing={advance !== null && node.id === advance.to && !landed && statusOf(state, node.id) === 'available'}
                          woken={advance !== null && node.id === advance.to && landed ? 1 : 0}
                        />
                      </View>
                    );
                  })
                : null}
              {travel !== null && travel.chapterId === chapter.id ? <TravelMarker points={travel.points} delay={ADVANCE.startMs} /> : null}
            </Island>
          );
        })}
        {/* At the end of the last trail, where the map rests once everything is done. */}
        {allDone ? <Trophy label={text.trophy} onPress={() => router.replace({ pathname: '/island/[chapterId]', params: { chapterId: CHAPTERS[CHAPTERS.length - 1]!.id } })} /> : null}
      </ScrollView>
      {advance !== null ? (
        // On the way on, any tap goes straight to the next stop.
        <Pressable style={StyleSheet.absoluteFill} onPress={onSkip} accessibilityRole="button" accessibilityLabel={text.next} testID="advance-skip" />
      ) : null}
      <View style={[styles.bottomBar, { bottom: insets.bottom + 16 }]} pointerEvents={advance === null ? 'box-none' : 'none'}>
        <View style={styles.leftButtons}>
          {/* Quieter on the gear itself (`muted`), so its hint bubble stays solid (as in the level menu, D-073). */}
          <ParentGate muted accessibilityLabel={text.parent} accessibilityHint={text.hold} hintAlign="start" testID="parent" onOpen={() => router.push('/parent')} />
          {/* The album, the child's own (2026-10-15 review Q): a plain tap, there once
              something is in it. Beside the gear, away from play and clear of the cup. */}
          {state.album.size > 0 ? <RoundButton label={<Icon name="album" size={32} />} size={58} accessibilityLabel={text.album} testID="album" onPress={() => router.push('/album')} /> : null}
        </View>
        <View style={styles.rightButtons}>
          {/* Free play (2026-10-15 review O): always there, a plain tap, nothing to
              finish first. Beside play, the other way to play; clear of the cup. */}
          <RoundButton label={<Icon name="sandbox" size={34} />} size={58} accessibilityLabel={text.sandbox} testID="sandbox" onPress={() => router.push('/sandbox')} />
          <RoundButton label={<Icon name="play" size={34} />} tone="accent" size={70} accessibilityLabel={text.play} testID="play" onPress={() => router.push({ pathname: '/play/[nodeId]', params: { nodeId: current } })} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.sky },
  scroll: { paddingHorizontal: 20, paddingTop: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 18, marginTop: 4 },
  title: { fontSize: 32, fontFamily: FONT.display, color: THEME.ink, textAlign: 'center' },
  // The sea is shallow right around the island.
  shoal: { backgroundColor: THEME.shoal, borderRadius: 52, padding: SHOAL, marginBottom: 22 },
  island: { backgroundColor: THEME.sand, borderRadius: 44, paddingHorizontal: 16, overflow: 'visible', boxShadow: `inset 0 -10px 0 ${THEME.sandDeep}` },
  sign: { alignSelf: 'center', marginTop: -2, backgroundColor: THEME.leaf, borderWidth: 3, borderColor: THEME.leafDeep, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 7, flexDirection: 'row', gap: 10, alignItems: 'center', boxShadow: `0 4px 0 ${THEME.leafDeep}` },
  signText: { fontSize: 19, fontFamily: FONT.display, fontWeight: '800', color: THEME.ink },
  signCount: { fontSize: 15, fontFamily: FONT.display, color: THEME.ink },
  stone: { position: 'absolute', width: 14, height: 9, borderRadius: 4.5, backgroundColor: THEME.sandDeep, opacity: 0.75 },
  stop: { alignItems: 'center', overflow: 'hidden' },
  stopLabel: { position: 'absolute', fontFamily: FONT.display, textAlign: 'center' },
  check: { position: 'absolute', right: -7, top: -7, width: 26, height: 26, borderRadius: 13, backgroundColor: THEME.leafDeep, borderWidth: 2, borderColor: THEME.white, alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 0 rgba(27,42,58,0.2)' },
  checkText: { color: THEME.white, fontFamily: FONT.display, fontSize: 15, lineHeight: 18 },
  // A boss wears a star sticker on its corner (the marker owns the space above).
  crown: { position: 'absolute', left: -12, top: -18, zIndex: 2, transform: [{ rotate: '-18deg' }], fontSize: 30, color: THEME.amber, textShadowColor: THEME.amberDeep, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
  marker: { position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: THEME.amber, borderWidth: 3, borderColor: THEME.amberDeep, alignItems: 'center', zIndex: 5 },
  travel: { left: 0, top: 0, zIndex: 6 },
  markerTip: { position: 'absolute', bottom: -10, width: 0, height: 0, borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 9, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: THEME.amberDeep },
  trunk: { position: 'absolute', left: 24, top: 18, width: 9, height: 50, borderRadius: 5, backgroundColor: THEME.trunk, transform: [{ rotate: '8deg' }] },
  leaf: { position: 'absolute', left: 6, top: 10, width: 44, height: 15, borderRadius: 8, backgroundColor: THEME.palm, borderWidth: 2, borderColor: THEME.palmDeep, transformOrigin: '50% 100%' },
  coconut: { position: 'absolute', left: 26, top: 20, width: 9, height: 9, borderRadius: 4.5, backgroundColor: '#8A5A33' },
  shell: { width: 20, height: 13, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: THEME.shell, boxShadow: '0 2px 0 #E08F80' },
  blade: { width: 6, borderRadius: 3, backgroundColor: '#7CC765', transformOrigin: '50% 100%' },
  bottomBar: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  // The parents' corner stays quiet next to the big play button.
  leftButtons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  rightButtons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  trophy: { alignItems: 'center', marginTop: -4, marginBottom: 8 },
  bunting: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', paddingTop: 2 },
  string: { position: 'absolute', left: -6, right: -6, top: 0, height: 2, borderRadius: 1, backgroundColor: THEME.woodDeep },
  flag: { width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 16, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  cup: { alignItems: 'center', marginTop: 4 },
  cupBowl: { width: 46, height: 36, backgroundColor: THEME.amber, borderBottomLeftRadius: 23, borderBottomRightRadius: 23, borderTopLeftRadius: 6, borderTopRightRadius: 6, borderWidth: 3, borderColor: THEME.amberDeep, alignItems: 'center', justifyContent: 'center' },
  cupStar: { fontSize: 18, lineHeight: 22, fontFamily: FONT.display, color: THEME.white },
  cupHandle: { position: 'absolute', top: 6, width: 14, height: 18, borderRadius: 7, borderWidth: 3, borderColor: THEME.amberDeep },
  cupStem: { width: 8, height: 8, backgroundColor: THEME.amberDeep },
  cupBase: { width: 34, height: 8, borderRadius: 4, backgroundColor: THEME.amberDeep },
});
