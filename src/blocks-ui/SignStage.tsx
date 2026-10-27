import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, Extrapolation, FadeIn, SlideInRight, SlideOutLeft, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { hueFor } from '../content';
import type { Sign } from '../core';
import { BlockBody, LiftShadow } from './Block';
import type { Mood } from './Face';
import { useBreathe, useCheer, useWobble } from './juice';
import type { Rect } from './layout';
import { FONT, SIGN_COLORS, THEME, colorsFor } from './palette';
import { GripPlate, NumberBadge } from './PartnerView';
import { SignBlock } from './SignBlock';
import type { SignMood } from './SignBlock';
import { overSlot } from './sign-layout';
import type { RoundPlace, SidePlace, SignGeometry } from './sign-layout';
import { Spotlight } from './Spotlight';
import { useDraggable } from './use-draggable';

// Compare Island's stage (Phase 23d): the round's two numbers standing on
// their plates, the slot between the plates, and the sign blocks in the tray.
// The numbers' blocks are only looked at and counted by tapping; the sign
// blocks are dragged (or tapped, the host's call) into the slot. It decides
// nothing: SignPlay says what is where and how everyone looks.
export type SideKey = 'left' | 'right';

export interface SignStageProps {
  readonly geometry: SignGeometry;
  readonly place: RoundPlace;
  // Changes per round: the pair slides out and the next one in.
  readonly roundKey: string;
  readonly signs: ReadonlyArray<Sign>;
  // The sign in the slot, and how it went.
  readonly placed: Sign | null;
  readonly verdict: 'right' | 'wrong' | null;
  readonly enabled: boolean;
  readonly moods: { readonly left: Mood; readonly right: Mood };
  // Faces turned towards the other side (-1 left, 1 right).
  readonly looks: { readonly left: number; readonly right: number };
  // A right answer's move: the bigger number hops, the same two wave.
  readonly cheer: { readonly tick: number; readonly left: 'hop' | 'wave' | null; readonly right: 'hop' | 'wave' | null };
  // Partners standing for their number (PARTS_JOIN_ON_PASS): in its colour, one face.
  readonly joined: boolean;
  // Counting numbers on the blocks, per side, by block index (reading order).
  readonly counts: { readonly left: ReadonlyMap<number, number>; readonly right: ReadonlyMap<number, number> };
  readonly spotlight: ReadonlyArray<SideKey | Sign>;
  // The "like this" hand carrying this sign into the slot; `tick` restarts it.
  readonly demo: { readonly sign: Sign; readonly tick: number } | null;
  // The wrong sign shakes its head once per tick.
  readonly shake: number;
  readonly onTapSign: (sign: Sign) => void;
  readonly onDropSign: (sign: Sign) => void;
  readonly onTakeOut: (sign: Sign) => void;
  readonly onLift: (active: boolean) => void;
  readonly onTapBlock: (side: SideKey, index: number) => void;
  readonly onTapPlate: (side: SideKey) => void;
}

const SLOT_LINE = 3;
export const JOIN_UP_TO = 10;

function headOf(cells: ReadonlyArray<{ readonly x: number; readonly y: number }>) {
  return cells.reduce((best, c) => (c.y < best.y || (c.y === best.y && c.x < best.x) ? c : best));
}

// Reading order of a side's blocks for counting: top to bottom, left to right.
export function sideCells(side: SidePlace): ReadonlyArray<{ readonly x: number; readonly y: number; readonly piece: number }> {
  return side.shape.pieces.flatMap((p, piece) => p.cells.map((c) => ({ x: c.x, y: c.y, piece }))).sort((a, b) => a.y - b.y || a.x - b.x);
}

function SideView({ side, which, cell, mood, look, cheer, tick, joined, counts, onTapBlock, onTapPlate }: {
  readonly side: SidePlace;
  readonly which: SideKey;
  readonly cell: number;
  readonly mood: Mood;
  readonly look: number;
  readonly cheer: 'hop' | 'wave' | null;
  readonly tick: number;
  readonly joined: boolean;
  readonly counts: ReadonlyMap<number, number>;
  readonly onTapBlock: (side: SideKey, index: number) => void;
  readonly onTapPlate: (side: SideKey) => void;
}) {
  const hop = useCheer('hop', cheer === 'hop' ? tick : 0, 0);
  const wave = useWobble(cheer === 'wave' ? tick : 0);
  const total = colorsFor(hueFor(side.side.n));
  const cells = sideCells(side);
  const pieces = side.shape.pieces;
  // Partners join only into a number with its own colour (up to 10): past 10
  // every number wears 10's lilac, and a joined 12 beside a 10 would look the same.
  const merged = (joined && side.side.n <= JOIN_UP_TO) || pieces.length === 1;
  const heads = merged ? [headOf(cells)] : pieces.map((p) => headOf(p.cells));
  const box = (cs: ReadonlyArray<{ readonly x: number; readonly y: number }>) => {
    const xs = cs.map((c) => c.x);
    const ys = cs.map((c) => c.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
  };
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={String(side.side.n)}
        onPress={() => onTapPlate(which)}
        testID={`sign-plate-${which}`}
        style={[styles.plate, { left: side.plate.x, top: side.plate.y, width: side.plate.width, height: side.plate.height, borderColor: total.deep, boxShadow: `0 3px 0 ${total.deep}` }]}>
        <Text style={[styles.plateText, { color: total.deep, fontSize: Math.round(side.plate.height * 0.62), lineHeight: side.plate.height - 6 }]}>{side.side.n}</Text>
      </Pressable>
      <Animated.View testID={`sign-side-${which}`} style={[styles.side, { left: side.blocks.x, top: side.blocks.y, width: side.blocks.width, height: side.blocks.height, transformOrigin: '50% 100%' }, hop, wave]}>
        {pieces.map((p, i) => {
          const b = box(p.cells);
          const colors = merged ? total : colorsFor(hueFor(p.n));
          return (
            <View key={`plate${i}`} pointerEvents="none" style={{ position: 'absolute', left: b.x * cell, top: b.y * cell, width: b.w * cell, height: b.h * cell }}>
              <GripPlate offsets={p.cells.map((c) => ({ x: c.x - b.x, y: c.y - b.y }))} cell={cell} color={colors.fill} around={merged ? cells.map((c) => ({ x: c.x - b.x, y: c.y - b.y })) : undefined} />
            </View>
          );
        })}
        {cells.map((c, index) => {
          const colors = merged ? total : colorsFor(hueFor(pieces[c.piece]!.n));
          const face = heads.some((h) => h.x === c.x && h.y === c.y);
          return (
            <Pressable key={`${c.x},${c.y}`} accessibilityLabel={`${index + 1}`} onPress={() => onTapBlock(which, index)} testID={`sign-cell-${which}-${index}`} style={{ position: 'absolute', left: c.x * cell, top: c.y * cell, width: cell, height: cell }}>
              <BlockBody cell={cell} x={0} y={0} colors={colors} face={face} mood={mood} count={counts.get(index) ?? null} look={face ? look : 0} />
            </Pressable>
          );
        })}
        {merged
          ? null
          : pieces.map((p, i) => {
              const b = box(p.cells);
              const size = Math.max(14, Math.round(cell * 0.42));
              return <NumberBadge key={`badge${i}`} testID={`sign-badge-${which}`} badge={{ left: (b.x + b.w) * cell - size * 0.7, top: (b.y + b.h) * cell - size * 0.8, size, n: p.n }} color={colorsFor(hueFor(p.n)).deep} />;
            })}
      </Animated.View>
    </>
  );
}

function Slot({ rect, state, empty }: { readonly rect: Rect; readonly state: 'idle' | 'hover' | 'right'; readonly empty: boolean }) {
  const breathe = useBreathe(empty && state === 'idle', 1200);
  return (
    <Animated.View
      pointerEvents="none"
      testID={state === 'right' ? 'sign-slot-right' : state === 'hover' ? 'sign-slot-hover' : 'sign-slot'}
      style={[
        styles.slot,
        { left: rect.x, top: rect.y, width: rect.width, height: rect.height, borderRadius: Math.round(rect.width * 0.28) },
        state === 'hover' ? styles.slotHover : state === 'right' ? styles.slotRight : null,
        breathe,
      ]}>
      {empty ? <Text style={[styles.slotMark, { fontSize: rect.width * 0.5, lineHeight: rect.width * 0.62 }]}>?</Text> : null}
    </Animated.View>
  );
}

function SignPiece({ sign, size, rest, enabled, mood, breathing, shake, placedHere, place, onTapSign, onDropSign, onTakeOut, onLift, onHover }: {
  readonly sign: Sign;
  readonly size: number;
  readonly rest: { readonly x: number; readonly y: number };
  readonly enabled: boolean;
  readonly mood: SignMood;
  readonly breathing: boolean;
  readonly shake: number;
  readonly placedHere: boolean;
  readonly place: RoundPlace;
  readonly onTapSign: (sign: Sign) => void;
  readonly onDropSign: (sign: Sign) => void;
  readonly onTakeOut: (sign: Sign) => void;
  readonly onLift: (active: boolean) => void;
  readonly onHover: (over: boolean) => void;
}) {
  const { gesture, style, squash, lift } = useDraggable({
    rest,
    restScale: 1,
    liftScale: 1.12,
    cellSize: size,
    enabled,
    onDrop: (t) => {
      onHover(false);
      const over = overSlot(place, size, rest.x + t.dx, rest.y + t.dy);
      if (over) {
        if (placedHere) {
          return 'same';
        }
        onDropSign(sign);
        return 'moved';
      }
      if (placedHere) {
        onTakeOut(sign);
        return 'moved';
      }
      return 'rejected';
    },
    onMove: (t) => onHover(!placedHere && overSlot(place, size, rest.x + t.dx, rest.y + t.dy)),
    onCancel: () => onHover(false),
    onTap: () => onTapSign(sign),
    onActive: onLift,
  });
  const breathe = useBreathe(breathing, 400);
  const wobble = useWobble(shake);
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View testID={`sign-piece-${sign}`} accessibilityRole="button" style={[styles.piece, { left: rest.x, top: rest.y, width: size, height: size, transformOrigin: 'top left' }, style]}>
        <LiftShadow cell={size} x={0} y={0} lift={lift} />
        <Animated.View style={[StyleSheet.absoluteFill, squash]}>
          <Animated.View style={[StyleSheet.absoluteFill, breathe]}>
            <Animated.View style={[StyleSheet.absoluteFill, wobble]}>
              <SignBlock size={size} sign={sign} mood={mood} lift={lift} />
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

// The "like this" hand (as DemoHand): a see-through sign and a pointing hand
// glide from its bed in the tray into the slot, twice. With reduced motion the
// ghost only blinks where the sign is.
const CYCLE = 1800;
function SignDemo({ sign, size, from, to, tick }: { readonly sign: Sign; readonly size: number; readonly from: { x: number; y: number }; readonly to: { x: number; y: number }; readonly tick: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(0);
    t.set(withRepeat(withSequence(withTiming(1, { duration: CYCLE, easing: Easing.linear }), withDelay(450, withTiming(0, { duration: 0 }))), 2, false));
  }, [t, tick]);
  const style = useAnimatedStyle(() => {
    const p = t.get();
    const fade = interpolate(p, [0, 0.12, 0.84, 1], [0, 1, 1, 0], Extrapolation.CLAMP);
    if (reduced) {
      return { opacity: fade, transform: [{ translateX: from.x }, { translateY: from.y }] };
    }
    const k = interpolate(p, [0.22, 0.74], [0, 1], Extrapolation.CLAMP);
    const ease = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const lift = Math.sin(ease * Math.PI) * size * 0.5;
    return { opacity: fade, transform: [{ translateX: from.x + (to.x - from.x) * ease }, { translateY: from.y + (to.y - from.y) * ease - lift }] };
  });
  return (
    <Animated.View pointerEvents="none" testID="sign-demo" style={[styles.demo, { width: size, height: size }, style]}>
      <SignBlock size={size} sign={sign} ghost />
      <Text style={[styles.hand, { fontSize: size * 0.62, lineHeight: size * 0.72, left: size * 0.38, top: size * 0.46 }]}>👆</Text>
    </Animated.View>
  );
}

export function SignStage({ geometry: geo, place, roundKey, signs, placed, verdict, enabled, moods, looks, cheer, joined, counts, spotlight, demo, shake, onTapSign, onDropSign, onTakeOut, onLift, onTapBlock, onTapPlate }: SignStageProps) {
  // The slot lights while a sign is held over it; a new round or a sign put in puts it out.
  const hoverKey = `${placed ?? '-'}|${roundKey}`;
  const [hoverAt, setHoverAt] = useState<string | null>(null);
  const hover = hoverAt === hoverKey;
  const setHover = (over: boolean) => setHoverAt(over ? hoverKey : null);
  const homeOf = (s: Sign) => geo.homes[signs.indexOf(s)]!;
  const rects: Rect[] = spotlight.map((k) => {
    if (k === 'left' || k === 'right') {
      const p = place[k];
      return { x: Math.min(p.blocks.x, p.plate.x), y: p.blocks.y, width: Math.max(p.blocks.width, p.plate.width), height: p.plate.y + p.plate.height - p.blocks.y };
    }
    const h = homeOf(k);
    return { x: h.x, y: h.y, width: geo.sign, height: geo.sign };
  });
  return (
    <View style={StyleSheet.absoluteFill} testID="sign-stage">
      <View pointerEvents="none" style={[styles.board, { left: geo.board.x, top: geo.board.y, width: geo.board.width, height: geo.board.height }]} />
      <View pointerEvents="none" style={[styles.tray, { left: geo.tray.x, top: geo.tray.y, width: geo.tray.width, height: geo.tray.height }]} />
      {geo.homes.map((h, i) => (
        <View key={`bed${i}`} pointerEvents="none" style={[styles.bed, { left: h.x + 2, top: h.y + 2, width: geo.sign - 4, height: geo.sign - 4, borderRadius: Math.round(geo.sign * 0.28) }]} />
      ))}
      <Animated.View key={roundKey} entering={SlideInRight.duration(380)} exiting={SlideOutLeft.duration(300)} style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <SideView side={place.left} which="left" cell={geo.cell} mood={moods.left} look={looks.left} cheer={cheer.left} tick={cheer.tick} joined={joined} counts={counts.left} onTapBlock={onTapBlock} onTapPlate={onTapPlate} />
        <SideView side={place.right} which="right" cell={geo.cell} mood={moods.right} look={looks.right} cheer={cheer.right} tick={cheer.tick} joined={joined} counts={counts.right} onTapBlock={onTapBlock} onTapPlate={onTapPlate} />
      </Animated.View>
      <Slot rect={place.slot} state={verdict === 'right' ? 'right' : hover ? 'hover' : 'idle'} empty={placed === null} />
      {rects.map((r, i) => (
        <Spotlight key={`spot${i}`} rect={r} radius={Math.round(Math.min(r.width, r.height) * 0.3)} />
      ))}
      {signs.map((s) => {
        const here = placed === s;
        return (
          <SignPiece
            key={s}
            sign={s}
            size={geo.sign}
            rest={here ? place.signAt : homeOf(s)}
            enabled={enabled && !(here && verdict === 'right')}
            mood={here && verdict === 'right' ? 'happy' : here && verdict === 'wrong' ? 'puzzled' : 'calm'}
            breathing={!here && enabled}
            shake={here && verdict === 'wrong' ? shake : 0}
            placedHere={here}
            place={place}
            onTapSign={onTapSign}
            onDropSign={onDropSign}
            onTakeOut={onTakeOut}
            onLift={onLift}
            onHover={setHover}
          />
        );
      })}
      {demo === null ? null : (
        <Animated.View entering={FadeIn.duration(120)} pointerEvents="none" style={StyleSheet.absoluteFill}>
          <SignDemo key={demo.tick} sign={demo.sign} size={geo.sign} from={homeOf(demo.sign)} to={place.signAt} tick={demo.tick} />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { position: 'absolute', backgroundColor: THEME.felt, borderRadius: 18, borderWidth: 3, borderColor: THEME.wood, boxShadow: `0 6px 0 ${THEME.woodDeep}` },
  tray: { position: 'absolute', backgroundColor: THEME.sand, borderRadius: 18, borderWidth: 2.5, borderStyle: 'dashed', borderColor: THEME.sandDeep, boxShadow: 'inset 0 -5px 0 rgba(227,201,139,0.6)' },
  bed: { position: 'absolute', borderWidth: 2, borderStyle: 'dashed', borderColor: '#D4B676' },
  plate: { position: 'absolute', backgroundColor: THEME.white, borderWidth: 3, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  plateText: { fontFamily: FONT.display, textAlign: 'center' },
  side: { position: 'absolute' },
  slot: { position: 'absolute', borderWidth: SLOT_LINE, borderStyle: 'dashed', borderColor: THEME.preview, backgroundColor: 'rgba(255,255,255,0.65)', alignItems: 'center', justifyContent: 'center' },
  slotHover: { borderStyle: 'solid', borderColor: SIGN_COLORS.edge, backgroundColor: 'rgba(255,184,61,0.24)', transform: [{ scale: 1.06 }] },
  slotRight: { borderStyle: 'solid', borderColor: THEME.leafDeep, backgroundColor: '#F3FBEC', boxShadow: '0 0 0 6px rgba(156,214,122,0.55)' },
  slotMark: { fontFamily: FONT.display, color: 'rgba(95,109,126,0.42)', textAlign: 'center' },
  piece: { position: 'absolute', zIndex: 20 },
  demo: { position: 'absolute', left: 0, top: 0, zIndex: 80 },
  hand: { position: 'absolute' },
});
