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
import { ASLEEP_OPACITY, GATED_OPACITY, bossesOf, lookOf, trailX } from './map-looks';
import type { DecorKit, IslandLook, Landmark, SignGlyph, TrailStyle } from './map-looks';
import { useProgress } from './progress-store';
import { signLabel } from './sign-hints';
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
// `bossBeatMs` (Phase 24, review §4.2): coming from a boss, the landing gets
// one more beat before the stop opens, while the gate's bar or the island's
// flag goes up.
export const ADVANCE = { startMs: 250, hopMs: 150, hops: 4, enterMs: 900, bossBeatMs: 500 } as const;
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
const TRAIL_TOP = 84;

// How a Shape Island stop shows itself on the map (PRD §4.2.2, §8 #13):
// 'picture', its picture drawn small (the last one of a stop in steps), so a
// child who cannot read finds "the dog one"; 'number', its number as on every
// other island. Only Shape Island's pictures: Number Island's picture stops
// keep their numbers. A default for Ted.
export const MAP_SHAPE_LABEL: 'picture' | 'number' = 'picture';
// A Compare Island stop's label (Phase 23d, PRD §5.4, §11 #7): 'first-pair',
// its first round and sign ("4>1"); 'signs', the signs its tray holds ("><=").
// A default for Ted.
export const MAP_SIGN_LABEL: 'first-pair' | 'signs' = 'first-pair';

// The picture a stop shows on the map instead of its number, if it does.
export function mapPictureOf(node: NodeSpec): ReadonlyArray<{ readonly x: number; readonly y: number }> | null {
  const s = node.spec;
  if (MAP_SHAPE_LABEL !== 'picture' || s.kind !== 'quantity_shape' || s.picture === undefined) {
    return null;
  }
  return s.templates[s.templates.length - 1]!.cells;
}

// A picture on a stop: its cells, as big as fit the middle of the stop (no
// more than MAP_PICTURE_CELL), white on the stop's colour, the first one
// wearing the stop's face.
const MAP_PICTURE_CELL = 16;
function MiniPicture({ cells, size, edge, blush, mood, blink }: { readonly cells: ReadonlyArray<{ readonly x: number; readonly y: number }>; readonly size: number; readonly edge: string; readonly blush: string; readonly mood: 'happy' | 'sleepy' | 'calm'; readonly blink: boolean }) {
  const cols = Math.max(...cells.map((c) => c.x)) + 1;
  const rows = Math.max(...cells.map((c) => c.y)) + 1;
  const room = size * 0.66;
  const unit = Math.min(MAP_PICTURE_CELL, Math.floor(room / cols), Math.floor(room / rows));
  const head = [...cells].sort((a, b) => a.y - b.y || a.x - b.x)[0]!;
  return (
    <View pointerEvents="none" testID="stop-picture" style={{ position: 'absolute', left: (size - cols * unit) / 2 - 3, top: (size - rows * unit) / 2 - 4, width: cols * unit, height: rows * unit }}>
      {cells.map((c) => (
        <View key={`${c.x},${c.y}`} style={[styles.miniCell, { left: c.x * unit, top: c.y * unit, width: unit - 1, height: unit - 1, borderRadius: unit * 0.28, borderColor: edge }]}>
          {c === head && unit >= 12 ? <Face size={unit - 3} mood={mood} blush={blush} blink={blink} /> : null}
        </View>
      ))}
    </View>
  );
}

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
    // Compare Island (Phase 23d, PRD §5.4): the first round and its sign, in the colour of its bigger number.
    case 'sign':
      return signLabel(s, MAP_SIGN_LABEL);
  }
}

// Where stop i of a chapter sits on its island's trail: top-left and size.
function stopAt(chapter: Chapter, i: number, trailWidth: number): { readonly x: number; readonly y: number; readonly size: number } {
  const node = chapter.nodes[i]!;
  const size = node.role === 'boss' ? BOSS : STOP;
  return { x: trailX(i, trailWidth, size, lookOf(chapter.id).trail), y: i * STEP + (node.role === 'boss' ? -8 : 0), size };
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
  gated = false,
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
  // Asleep behind a closed gate (Phase 24): paler still.
  readonly gated?: boolean;
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
  const picture = mapPictureOf(node);
  const mood = done ? 'happy' : locked || dozing ? 'sleepy' : 'calm';
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
              opacity: locked ? (gated ? GATED_OPACITY : ASLEEP_OPACITY) : 1,
              transform: [{ translateY: pressed && !locked ? 3 : 0 }, { scale: current ? 1.06 : 1 }],
              boxShadow: `inset 0 -6px 0 rgba(0,0,0,${locked ? 0.06 : 0.14}), inset 0 4px 0 rgba(255,255,255,0.4), 0 ${pressed && !locked ? 2 : 5}px 0 rgba(27,42,58,0.18)`,
            },
          ]}>
          {picture !== null ? (
            <MiniPicture cells={picture} size={size} edge={colors.edge} blush={colors.blush} mood={mood} blink={!locked && !done && !dozing} />
          ) : (
            <>
              <View pointerEvents="none" style={{ position: 'absolute', left: (size - 2 * border - face) / 2, top: -face * 0.04, width: face, height: face }}>
                <Face size={face} mood={mood} blush={colors.blush} blink={!locked && !done && !dozing} />
              </View>
              <Text style={[styles.stopLabel, { color: locked ? colors.deep : THEME.faceInk, fontSize: label.length > 2 ? size * 0.27 : size * 0.36, lineHeight: size * 0.4, top: size * 0.47 }]}>{label}</Text>
            </>
          )}
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

// ---------------------------------------------------------------------------
// Scenery (Phase 24, map-looks.ts): each island's kit, on the island's edge
// opposite the trail so it never sits under a stop. All of it takes no touch.

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

// Shape Island's own pictures, small: a mushroom with spots and a sapling.
function Mushroom({ x, y, small = false }: { readonly x: number; readonly y: number; readonly small?: boolean }) {
  const k = small ? 0.7 : 1;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: 40 * k, height: 40 * k, alignItems: 'center' }}>
      <View style={{ width: 40 * k, height: 22 * k, borderTopLeftRadius: 20 * k, borderTopRightRadius: 20 * k, borderBottomLeftRadius: 5 * k, borderBottomRightRadius: 5 * k, backgroundColor: THEME.shell, boxShadow: '0 2px 0 #E08F80' }}>
        <View style={{ position: 'absolute', left: 8 * k, top: 7 * k, width: 7 * k, height: 7 * k, borderRadius: 4 * k, backgroundColor: THEME.white }} />
        <View style={{ position: 'absolute', left: 24 * k, top: 4 * k, width: 6 * k, height: 6 * k, borderRadius: 3 * k, backgroundColor: THEME.white }} />
      </View>
      <View style={{ width: 14 * k, height: 16 * k, borderBottomLeftRadius: 5 * k, borderBottomRightRadius: 5 * k, backgroundColor: '#FFF6E4', borderWidth: 1.5, borderTopWidth: 0, borderColor: '#E3C98B' }} />
    </View>
  );
}

function Sapling({ x, y, tall = false }: { readonly x: number; readonly y: number; readonly tall?: boolean }) {
  const h = tall ? 72 : 46;
  const crown = tall ? 38 : 28;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: crown + 4, height: h, alignItems: 'center' }}>
      <View style={{ width: crown, height: crown, borderRadius: crown / 2, backgroundColor: THEME.palm, borderWidth: 2, borderColor: THEME.palmDeep }} />
      <View style={{ width: 8, height: h - crown + 4, marginTop: -4, borderRadius: 3, backgroundColor: THEME.trunk }} />
    </View>
  );
}

// Join Island's boardwalk: a post, and a post with a lamp.
function Post({ x, y, lamp = false }: { readonly x: number; readonly y: number; readonly lamp?: boolean }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: 22, height: lamp ? 56 : 30, alignItems: 'center' }}>
      {lamp ? <View style={{ width: 18, height: 18, borderRadius: 6, backgroundColor: '#FFF1C2', borderWidth: 2.5, borderColor: THEME.woodDeep }} /> : null}
      <View style={{ width: 12, height: lamp ? 36 : 26, borderRadius: 3, backgroundColor: THEME.trunk, borderWidth: 2, borderColor: THEME.woodDeep, marginTop: lamp ? -2 : 0 }} />
      <View style={{ position: 'absolute', top: lamp ? 16 : 0, width: 12, height: 5, borderRadius: 2, backgroundColor: '#D7A86E' }} />
    </View>
  );
}

// Take-away Island's camp: a tent and a little bed (the tray is home).
function Tent({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: 56, height: 44, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={{ width: 0, height: 0, borderLeftWidth: 28, borderRightWidth: 28, borderBottomWidth: 40, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: THEME.shell }} />
      <View style={{ position: 'absolute', bottom: 0, width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderBottomWidth: 18, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#D9B07A' }} />
    </View>
  );
}

function Bed({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, width: 40, height: 22 }}>
      <View style={{ position: 'absolute', left: 0, bottom: 0, width: 40, height: 14, borderRadius: 5, backgroundColor: THEME.white, borderWidth: 2, borderColor: '#D9B07A' }} />
      <View style={{ position: 'absolute', left: 4, top: 0, width: 12, height: 10, borderRadius: 4, backgroundColor: '#FFF6E4', borderWidth: 2, borderColor: '#D9B07A' }} />
      <View style={{ position: 'absolute', left: 16, bottom: 4, width: 20, height: 8, borderRadius: 3, backgroundColor: THEME.shell }} />
    </View>
  );
}

// Compare Island: three little steps that climb.
function Stair({ x, y }: { readonly x: number; readonly y: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y, flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
      {[8, 14, 20].map((h) => (
        <View key={h} style={{ width: 10, height: h, borderRadius: 2, backgroundColor: THEME.white, borderWidth: 1.5, borderColor: '#BFDCEA' }} />
      ))}
    </View>
  );
}

// Scenery every third stop, on the far side from the trail: a big piece, a
// small piece, then a tuft or the like, in the island's kit.
function Decor({ kit, slot, x, y, left }: { readonly kit: DecorKit; readonly slot: 'big' | 'small' | 'tuft'; readonly x: number; readonly y: number; readonly left: boolean }) {
  const inner = (() => {
    switch (kit) {
      case 'beach':
        return slot === 'big' ? <Palm x={x} y={y - 6} flip={!left} /> : slot === 'small' ? <Shell x={left ? 6 : x + 10} y={y + 30} /> : <Tuft x={left ? 10 : x + 20} y={y + 40} />;
      case 'meadow':
        return slot === 'big' ? <Sapling x={x + 6} y={y - 2} /> : slot === 'small' ? <Mushroom x={left ? 6 : x + 10} y={y + 14} /> : <Mushroom x={left ? 10 : x + 20} y={y + 30} small />;
      case 'dock':
        return slot === 'big' ? <Post x={x + 14} y={y} lamp /> : slot === 'small' ? <Post x={left ? 8 : x + 18} y={y + 24} /> : <Tuft x={left ? 10 : x + 20} y={y + 40} />;
      case 'camp':
        return slot === 'big' ? <Tent x={x} y={y + 8} /> : slot === 'small' ? <Bed x={left ? 6 : x + 8} y={y + 24} /> : <Tuft x={left ? 10 : x + 20} y={y + 40} />;
      case 'steps':
        return slot === 'big' ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y - 12, width: 54, height: 72, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}>
            <Sapling x={0} y={0} tall />
            <Sapling x={38} y={26} />
          </View>
        ) : slot === 'small' ? (
          <Stair x={left ? 8 : x + 12} y={y + 20} />
        ) : (
          <Tuft x={left ? 10 : x + 20} y={y + 40} />
        );
    }
  })();
  return <View pointerEvents="none" testID={`decor-${kit}`}>{inner}</View>;
}

// The trail between two stops: three marks on the line between them, in the
// island's style. Planks fill in as stops are done (the smallest "mend the
// bridge": a plank after a done stop is solid, after one still to do, faint).
function Trail({ style, from, to, done, deep }: { readonly style: TrailStyle; readonly from: { readonly x: number; readonly y: number }; readonly to: { readonly x: number; readonly y: number }; readonly done: boolean; readonly deep: string }) {
  const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  return (
    <View pointerEvents="none" testID={`trail-${style}`}>
      {[0.3, 0.5, 0.7].map((t, k) => {
        const x = from.x + (to.x - from.x) * t;
        const y = from.y + (to.y - from.y) * t;
        switch (style) {
          case 'stones':
            return <View key={t} style={[styles.stone, { left: x - 7, top: y - 4.5, backgroundColor: deep }]} />;
          case 'slabs':
            return <View key={t} style={[styles.slab, { left: x - 9, top: y - 5.5, backgroundColor: deep }]} />;
          case 'planks':
            return <View key={t} style={[styles.plank, { left: x - 13, top: y - 3.5, backgroundColor: deep, opacity: done ? 0.95 : 0.4, transform: [{ rotate: `${angle + 90}deg` }] }]} />;
          case 'prints':
            // Left foot, right foot, left foot, each a little off the line.
            return (
              <View key={t} style={{ position: 'absolute', left: x - 4, top: y - 6, transform: [{ rotate: `${angle + 90}deg` }, { translateX: k % 2 === 0 ? -6 : 6 }] }}>
                <View style={[styles.print, { backgroundColor: deep }]} />
                <View style={[styles.toe, { backgroundColor: deep }]} />
              </View>
            );
          case 'steps':
            return <View key={t} style={[styles.stepMark, { left: x - 9, top: y - 3 - k * 3, height: 7 + k * 3, backgroundColor: deep }]} />;
        }
      })}
    </View>
  );
}

// The little picture on an island's sign: what the island teaches.
function SignPicture({ glyph }: { readonly glyph: SignGlyph }) {
  const size = 22;
  switch (glyph) {
    case 'block': {
      const c = colorsFor('n1');
      return (
        <View testID="sign-glyph-block" style={{ width: size, height: size, borderRadius: 6, backgroundColor: c.fill, borderWidth: 2, borderColor: c.edge, alignItems: 'center', justifyContent: 'center' }}>
          <Face size={14} mood="calm" blush={c.blush} />
        </View>
      );
    }
    case 'shadow':
      // A mushroom's silhouette in ink: a shadow to fill.
      return (
        <View testID="sign-glyph-shadow" style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
          <View style={{ width: 22, height: 12, borderTopLeftRadius: 11, borderTopRightRadius: 11, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: THEME.ink, opacity: 0.75 }} />
          <View style={{ width: 8, height: 8, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: THEME.ink, opacity: 0.75 }} />
        </View>
      );
    case 'pair': {
      const a = colorsFor('n2');
      const b = colorsFor('n3');
      return (
        <View testID="sign-glyph-pair" style={{ flexDirection: 'row', width: size + 4, height: size }}>
          <View style={{ width: 13, height: size, borderTopLeftRadius: 6, borderBottomLeftRadius: 6, backgroundColor: a.fill, borderWidth: 2, borderRightWidth: 1, borderColor: a.edge }} />
          <View style={{ width: 13, height: size, borderTopRightRadius: 6, borderBottomRightRadius: 6, backgroundColor: b.fill, borderWidth: 2, borderLeftWidth: 1, borderColor: b.edge }} />
        </View>
      );
    }
    case 'house':
      return (
        <View testID="sign-glyph-house" style={{ width: size + 2, height: size, alignItems: 'center' }}>
          <View style={{ width: 0, height: 0, borderLeftWidth: 12, borderRightWidth: 12, borderBottomWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#B63724' }} />
          <View style={{ width: 18, height: 12, backgroundColor: THEME.white, borderWidth: 2, borderTopWidth: 0, borderColor: '#B63724', alignItems: 'center', justifyContent: 'flex-end' }}>
            <View style={{ width: 5, height: 7, backgroundColor: '#B63724', borderTopLeftRadius: 2, borderTopRightRadius: 2 }} />
          </View>
        </View>
      );
    case 'scales':
      return (
        <View testID="sign-glyph-scales" style={{ width: size + 6, height: size, alignItems: 'center' }}>
          <View style={{ width: 26, height: 3, borderRadius: 1.5, backgroundColor: THEME.ink, marginTop: 3 }} />
          <View style={{ width: 3, height: 15, backgroundColor: THEME.ink }} />
          <View style={{ position: 'absolute', left: 0, top: 7, width: 10, height: 6, borderBottomLeftRadius: 5, borderBottomRightRadius: 5, backgroundColor: THEME.ink }} />
          <View style={{ position: 'absolute', right: 0, top: 10, width: 10, height: 6, borderBottomLeftRadius: 5, borderBottomRightRadius: 5, backgroundColor: THEME.ink }} />
          <View style={{ width: 12, height: 3, borderRadius: 1.5, backgroundColor: THEME.ink }} />
        </View>
      );
  }
}

// The scenery behind an island's last boss, on the pedestal at the island's
// foot (review §4.2): a two-peaked mountain, a launch pad, a bridgehead, a
// tent or the scales tower, all in the island's deep ground colour.
function LandmarkView({ kind, deep, width, height }: { readonly kind: Landmark; readonly deep: string; readonly width: number; readonly height: number }) {
  const inner = (() => {
    switch (kind) {
      case 'mountain':
        return (
          <>
            <View style={{ position: 'absolute', left: width * 0.42, bottom: 0, width: 0, height: 0, borderLeftWidth: width * 0.28, borderRightWidth: width * 0.28, borderBottomWidth: height * 0.72, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: deep, opacity: 0.85 }} />
            <View style={{ position: 'absolute', left: 0, bottom: 0, width: 0, height: 0, borderLeftWidth: width * 0.34, borderRightWidth: width * 0.34, borderBottomWidth: height, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: deep }} />
            <View style={{ position: 'absolute', left: width * 0.34 - 9, top: 0, width: 0, height: 0, borderLeftWidth: 9, borderRightWidth: 9, borderBottomWidth: 16, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: THEME.white, opacity: 0.9 }} />
          </>
        );
      case 'launchpad':
        return (
          <>
            <View style={{ position: 'absolute', left: width * 0.12, bottom: 0, width: width * 0.76, height: 14, borderRadius: 5, backgroundColor: deep }} />
            <View style={{ position: 'absolute', left: width * 0.18, bottom: 10, width: 12, height: height - 10, borderRadius: 3, backgroundColor: deep }} />
            {[0.3, 0.55, 0.8].map((t) => (
              <View key={t} style={{ position: 'absolute', left: width * 0.18 + 10, bottom: 10 + (height - 10) * t, width: width * 0.3, height: 5, borderRadius: 2, backgroundColor: deep, opacity: 0.8 }} />
            ))}
            <View style={{ position: 'absolute', left: width * 0.18 - 4, top: 0, width: 20, height: 8, borderRadius: 4, backgroundColor: THEME.white, opacity: 0.9 }} />
          </>
        );
      case 'bridge':
        return (
          <>
            <View style={{ position: 'absolute', left: width * 0.1, top: height * 0.2, width: width * 0.8, height: height * 0.8, borderTopLeftRadius: width * 0.4, borderTopRightRadius: width * 0.4, borderWidth: 12, borderBottomWidth: 0, borderColor: deep }} />
            <View style={{ position: 'absolute', left: width * 0.1 - 4, bottom: 0, width: 16, height: height * 0.55, borderRadius: 4, backgroundColor: deep }} />
            <View style={{ position: 'absolute', right: width * 0.1 - 4, bottom: 0, width: 16, height: height * 0.55, borderRadius: 4, backgroundColor: deep }} />
            <View style={{ position: 'absolute', left: width * 0.5 - 8, top: height * 0.06, width: 16, height: 8, borderRadius: 4, backgroundColor: THEME.white, opacity: 0.9 }} />
          </>
        );
      case 'tent':
        return (
          <>
            <View style={{ position: 'absolute', left: width * 0.1, bottom: 0, width: 0, height: 0, borderLeftWidth: width * 0.4, borderRightWidth: width * 0.4, borderBottomWidth: height, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: deep }} />
            <View style={{ position: 'absolute', left: width * 0.5 - 12, bottom: 0, width: 0, height: 0, borderLeftWidth: 12, borderRightWidth: 12, borderBottomWidth: height * 0.42, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: THEME.white, opacity: 0.85 }} />
          </>
        );
      case 'scales':
        return (
          <>
            <View style={{ position: 'absolute', left: width * 0.5 - 7, bottom: 0, width: 14, height: height, borderRadius: 4, backgroundColor: deep }} />
            <View style={{ position: 'absolute', left: width * 0.08, top: 8, width: width * 0.84, height: 8, borderRadius: 4, backgroundColor: deep }} />
            <View style={{ position: 'absolute', left: width * 0.08 - 2, top: 14, width: 4, height: 24, backgroundColor: deep, opacity: 0.8 }} />
            <View style={{ position: 'absolute', right: width * 0.08 - 2, top: 14, width: 4, height: 34, backgroundColor: deep, opacity: 0.8 }} />
            <View style={{ position: 'absolute', left: 0, top: 36, width: width * 0.3, height: 12, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, backgroundColor: THEME.white, borderWidth: 2, borderColor: deep }} />
            <View style={{ position: 'absolute', right: 0, top: 46, width: width * 0.3, height: 12, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, backgroundColor: THEME.white, borderWidth: 2, borderColor: deep }} />
          </>
        );
    }
  })();
  return (
    <View pointerEvents="none" testID={`landmark-${kind}`} style={{ position: 'absolute', width, height }}>
      {inner}
    </View>
  );
}

// The island's foot, drawn under every stop: the landmark behind the last
// boss (tall enough to show above it), the pedestal it stands on and the
// flag beside it.
const LANDMARK_W = 150;
const LANDMARK_H = 124;
function BossLandmark({ look, stop, trailWidth, flagUp, celebrate }: { readonly look: IslandLook; readonly stop: { readonly x: number; readonly y: number; readonly size: number }; readonly trailWidth: number; readonly flagUp: boolean; readonly celebrate: boolean }) {
  const cx = stop.x + stop.size / 2;
  const landmarkX = Math.max(-10, Math.min(trailWidth - LANDMARK_W + 10, cx - LANDMARK_W / 2));
  const poleRight = cx < trailWidth / 2;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', left: landmarkX, top: stop.y + stop.size - LANDMARK_H - 4, width: LANDMARK_W, height: LANDMARK_H }}>
        <LandmarkView kind={look.landmark} deep={look.groundDeep} width={LANDMARK_W} height={LANDMARK_H} />
      </View>
      <View style={[styles.pedestal, { left: stop.x - 12, top: stop.y + stop.size - 18, width: stop.size + 24, backgroundColor: look.groundDeep }]} testID="boss-pedestal" />
      <Flag x={poleRight ? stop.x + stop.size + 6 : stop.x - 30} y={stop.y - 34} height={stop.size + 44} up={flagUp} celebrate={celebrate} />
    </View>
  );
}

// The flag on the pole beside the landmark: down until the island's last boss
// is done, then up for good. `celebrate` runs it up (the ceremony after that
// boss, a beat after the marker lands); reduced motion puts it there.
function Flag({ x, y, height, up, celebrate }: { readonly x: number; readonly y: number; readonly height: number; readonly up: boolean; readonly celebrate: boolean }) {
  const reduced = useReducedMotion();
  const climb = height - 22;
  // 0: at the foot of the pole; 1: at the top.
  const v = useSharedValue(up && !celebrate ? 1 : 0);
  useEffect(() => {
    if (up) {
      v.set(reduced ? withTiming(1, { duration: 0 }) : withSpring(1, { damping: 12, stiffness: 90 }));
    }
  }, [up, v, reduced]);
  const flag = useAnimatedStyle(() => ({ transform: [{ translateY: -climb * v.get() }] }));
  return (
    <View pointerEvents="none" testID={`flag-${up ? 'up' : 'down'}`} style={{ position: 'absolute', left: x, top: y, width: 26, height }}>
      <View style={[styles.pole, { height }]} />
      <Animated.View style={[styles.flagCloth, { top: height - 22 }, flag]} />
    </View>
  );
}

// The gate on the trail after an island's little boss (review §4.2): two
// posts and a bar, in the island's deep colour. The bar lies across the way
// until that boss is done, then stands up; the stops behind it sleep paler
// (GATED_OPACITY) while it is closed. The unlock rule is as it was (stops open
// in order); the gate only draws it. `celebrate`: the ceremony after that boss.
function Gate({ x, y, deep, open, celebrate }: { readonly x: number; readonly y: number; readonly deep: string; readonly open: boolean; readonly celebrate: boolean }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(open && !celebrate ? 1 : 0);
  useEffect(() => {
    if (open) {
      v.set(reduced ? withTiming(1, { duration: 0 }) : withSpring(1, { damping: 11, stiffness: 100 }));
    }
  }, [open, v, reduced]);
  const bar = useAnimatedStyle(() => ({ transform: [{ rotate: `${-78 * v.get()}deg` }] }));
  return (
    <View pointerEvents="none" testID={`gate-${open ? 'open' : 'closed'}`} style={{ position: 'absolute', left: x - 40, top: y - 30, width: 80, height: 52 }}>
      <View style={[styles.gatePost, { left: 0, backgroundColor: deep }]}>
        <View style={styles.gateCap} />
      </View>
      <View style={[styles.gatePost, { right: 0, backgroundColor: deep }]}>
        <View style={styles.gateCap} />
      </View>
      <Animated.View style={[styles.gateBar, { backgroundColor: deep }, bar]}>
        <View style={styles.gateStripe} />
      </Animated.View>
    </View>
  );
}

// An island's sign: its picture, its name and one dot per stop, the done ones
// filled (review M-6: the score stays in the parents' area). Once the island
// is done, two little flags hang on its sides for good.
function Sign({ look, title, done, total, testID }: { readonly look: IslandLook; readonly title: string; readonly done: number; readonly total: number; readonly testID: string }) {
  const finished = done >= total;
  return (
    <View style={styles.signRow} testID={testID}>
      {finished ? <View style={[styles.signFlag, { borderTopColor: colorsFor('n1').fill }]} testID="sign-bunting" /> : null}
      <View style={styles.sign}>
        <View style={styles.signTop}>
          <SignPicture glyph={look.sign} />
          <Text style={styles.signText}>{title}</Text>
        </View>
        <View style={styles.signDots} accessibilityLabel={`${done}/${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={[styles.signDot, i < done ? styles.signDotDone : null]} testID={i < done ? 'sign-dot-done' : 'sign-dot-todo'} />
          ))}
        </View>
      </View>
      {finished ? <View style={[styles.signFlag, { borderTopColor: colorsFor('n5').fill }]} testID="sign-bunting" /> : null}
    </View>
  );
}

function Island({ chapter, width, children, done, total, title, onTop }: { readonly chapter: Chapter; readonly width: number; readonly children: React.ReactNode; readonly done: number; readonly total: number; readonly title: string; readonly onTop: (y: number) => void }) {
  const look = lookOf(chapter.id);
  const height = chapter.nodes.length * STEP + 20 + TRAIL_TOP - 36;
  return (
    <View style={styles.shoal} onLayout={(e) => onTop(e.nativeEvent.layout.y + SHOAL)} testID={`island-${chapter.id}`}>
      <View style={[styles.island, { height, backgroundColor: look.ground, boxShadow: `inset 0 -10px 0 ${look.groundDeep}` }]}>
        <Sign look={look} title={title} done={done} total={total} testID={`sign-${chapter.id}`} />
        <View style={{ position: 'absolute', left: 0, top: TRAIL_TOP, width, height: height - TRAIL_TOP }}>{children}</View>
      </View>
    </View>
  );
}

// The bottom bar's underlay: the sky fading in under the buttons, so the last
// stops of an island do not run straight under them (2026-10-16 review E-5,
// 2026-10-27 M-7). Strips of the sky, each a little more solid.
const SKY_RGB = '207,233,247';
function BottomShade({ height }: { readonly height: number }) {
  const strips = 8;
  return (
    <View pointerEvents="none" style={[styles.bottomShade, { height }]} testID="bottom-shade">
      {Array.from({ length: strips }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: `rgba(${SKY_RGB},${((i + 1) / strips) * 0.95})` }} />
      ))}
    </View>
  );
}
const BOTTOM_SHADE = 110;

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
  // Coming from a boss (Phase 24): the landing gets one more beat for the
  // gate's bar or the island's flag to go up before the next stop opens.
  const fromBoss = advance !== null && CHAPTERS.some((c) => c.nodes.some((n) => n.id === advance.from && n.role === 'boss'));
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
    const enter = setTimeout(goNext, landAt + (fromBoss ? ADVANCE.bossBeatMs : 0) + ADVANCE.enterMs);
    return () => {
      clearTimeout(land);
      clearTimeout(enter);
    };
  }, [advance, goNext, fromBoss]);
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
          const look = lookOf(chapter.id);
          const { tail, gates } = bossesOf(chapter);
          const tailId = chapter.nodes[tail]!.id;
          // The ceremony for a boss just done (advance.from): its gate or flag
          // waits closed / down until the marker lands, then goes up.
          const pending = (id: NodeId) => advance !== null && advance.from === id && !landed;
          const celebrating = (id: NodeId) => advance !== null && advance.from === id && landed;
          const gateOpen = (g: number) => statusOf(state, chapter.nodes[g]!.id) === 'completed' && !pending(chapter.nodes[g]!.id);
          const flagUp = statusOf(state, tailId) === 'completed' && !pending(tailId);
          return (
            <Island
              key={chapter.id}
              chapter={chapter}
              width={trailWidth}
              done={done}
              total={total}
              title={format(chapter.title, lang)}
              onTop={(y) => setIslandTops((tops) => (tops[chapter.id] === y ? tops : { ...tops, [chapter.id]: y }))}>
              {width > 0 ? <BossLandmark look={look} stop={stopAt(chapter, tail, trailWidth)} trailWidth={trailWidth} flagUp={flagUp} celebrate={celebrating(tailId)} /> : null}
              {width > 0
                ? chapter.nodes.map((node, i) => {
                    const { x, y, size } = stopAt(chapter, i, trailWidth);
                    const next = chapter.nodes[i + 1];
                    const nextAt = next === undefined ? null : stopAt(chapter, i + 1, trailWidth);
                    const cx = x + size / 2;
                    const cy = y + size / 2;
                    const status = statusOf(state, node.id);
                    // Scenery every third stop, on the far side from the trail.
                    const left = cx > trailWidth / 2;
                    const decorX = left ? 0 : trailWidth - 54;
                    const slot = i % 3 === 1 ? (i % 2 === 1 ? 'big' : 'small') : i % 3 === 2 && chapter.nodes.length > 4 ? 'tuft' : null;
                    return (
                      <View key={node.id}>
                        {slot !== null ? <Decor kit={look.decor} slot={slot} x={decorX} y={y} left={left} /> : null}
                        {nextAt !== null ? <Trail style={look.trail.style} from={{ x: cx, y: cy }} to={{ x: nextAt.x + nextAt.size / 2, y: nextAt.y + nextAt.size / 2 }} done={status === 'completed'} deep={look.groundDeep} /> : null}
                        {gates.includes(i) && nextAt !== null ? <Gate x={(cx + nextAt.x + nextAt.size / 2) / 2} y={(cy + nextAt.y + nextAt.size / 2) / 2} deep={look.groundDeep} open={gateOpen(i)} celebrate={celebrating(node.id)} /> : null}
                        <StopDot
                          node={node}
                          status={status}
                          current={advance === null && node.id === current}
                          x={x}
                          y={y}
                          onPress={() => router.push({ pathname: '/play/[nodeId]', params: { nodeId: node.id } })}
                          dozing={advance !== null && node.id === advance.to && !landed && status === 'available'}
                          woken={advance !== null && node.id === advance.to && landed ? 1 : 0}
                          gated={gates.some((g) => g < i && !gateOpen(g))}
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
      <BottomShade height={insets.bottom + BOTTOM_SHADE} />
      <View style={[styles.bottomBar, { bottom: insets.bottom + 16 }]} pointerEvents={advance === null ? 'box-none' : 'none'}>
        <View style={styles.leftButtons} pointerEvents="box-none">
          {/* Quieter on the gear itself (`muted`), so its hint bubble stays solid (as in the level menu, D-073). */}
          <ParentGate muted accessibilityLabel={text.parent} accessibilityHint={text.hold} hintAlign="start" testID="parent" onOpen={() => router.push('/parent')} />
          {/* The album, the child's own (2026-10-15 review Q): a plain tap, there once
              something is in it. Beside the gear, away from play and clear of the cup. */}
          {state.album.size > 0 ? <RoundButton label={<Icon name="album" size={32} />} size={58} accessibilityLabel={text.album} testID="album" onPress={() => router.push('/album')} /> : null}
        </View>
        <View style={styles.rightButtons} pointerEvents="box-none">
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
  island: { borderRadius: 44, paddingHorizontal: 16, overflow: 'visible' },
  signRow: { alignSelf: 'center', flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: -2 },
  sign: { backgroundColor: THEME.leaf, borderWidth: 3, borderColor: THEME.leafDeep, borderRadius: 24, paddingHorizontal: 16, paddingTop: 5, paddingBottom: 7, alignItems: 'center', gap: 3, boxShadow: `0 4px 0 ${THEME.leafDeep}` },
  signTop: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  signText: { fontSize: 19, fontFamily: FONT.display, fontWeight: '800', color: THEME.ink },
  signDots: { flexDirection: 'row', gap: 2.5, alignItems: 'center' },
  signDot: { width: 6, height: 6, borderRadius: 3, borderWidth: 1.5, borderColor: THEME.leafDeep, backgroundColor: 'transparent' },
  signDotDone: { backgroundColor: THEME.ink, borderColor: THEME.ink },
  // Two little flags beside a finished island's sign.
  signFlag: { width: 0, height: 0, marginTop: 6, borderLeftWidth: 8, borderRightWidth: 8, borderTopWidth: 15, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  stone: { position: 'absolute', width: 14, height: 9, borderRadius: 4.5, opacity: 0.75 },
  slab: { position: 'absolute', width: 18, height: 11, borderRadius: 3, opacity: 0.7 },
  plank: { position: 'absolute', width: 26, height: 7, borderRadius: 2 },
  print: { width: 7, height: 10, borderRadius: 3.5, opacity: 0.7 },
  toe: { position: 'absolute', top: -4, left: 1.5, width: 4, height: 4, borderRadius: 2, opacity: 0.7 },
  stepMark: { position: 'absolute', width: 18, borderRadius: 2, opacity: 0.75 },
  stop: { alignItems: 'center', overflow: 'hidden' },
  stopLabel: { position: 'absolute', fontFamily: FONT.display, textAlign: 'center' },
  miniCell: { position: 'absolute', backgroundColor: THEME.white, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
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
  // The last boss's pedestal at the island's foot, the flag's pole and cloth, the gate.
  pedestal: { position: 'absolute', height: 24, borderRadius: 10, opacity: 0.9 },
  pole: { position: 'absolute', left: 10, top: 0, width: 5, borderRadius: 2.5, backgroundColor: THEME.woodDeep },
  flagCloth: { position: 'absolute', left: 14, width: 0, height: 0, borderTopWidth: 9, borderBottomWidth: 9, borderLeftWidth: 18, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: THEME.amber },
  gatePost: { position: 'absolute', top: 6, width: 12, height: 46, borderRadius: 4, borderWidth: 2, borderColor: 'rgba(43,54,69,0.25)', alignItems: 'center' },
  gateCap: { marginTop: -5, width: 16, height: 7, borderRadius: 3.5, backgroundColor: THEME.white, opacity: 0.9 },
  gateBar: { position: 'absolute', left: 5, top: 22, width: 70, height: 11, borderRadius: 5.5, borderWidth: 2, borderColor: 'rgba(43,54,69,0.25)', transformOrigin: '5px 50%', justifyContent: 'center' },
  gateStripe: { marginLeft: 12, width: 44, height: 3, borderRadius: 1.5, backgroundColor: THEME.white, opacity: 0.8 },
  bottomShade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
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
