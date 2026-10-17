import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { CountMark } from './CountMark';
import { Face } from './Face';
import type { Mood } from './Face';
import { usePulse, useWink } from './juice';
import type { BlockColors } from './palette';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const BOUNCE = { damping: 8, stiffness: 300, mass: 0.5 } as const;

// One block's measurements inside its grid cell.
export function blockMetrics(cell: number) {
  const inset = Math.max(2, Math.round(cell * 0.06));
  const side = cell - 2 * inset;
  const border = Math.max(1.5, Math.round(cell * 0.045));
  return { inset, side, border, radius: Math.round(side * 0.28) };
}

// Toy plastic: a darker lip along the bottom, a lit rim along the top and a
// hard (unblurred) shadow, so a block reads as a thing you can pick up.
function toyShadow(cell: number): string {
  const lip = Math.max(2, Math.round(cell * 0.08));
  const rim = Math.max(1, Math.round(cell * 0.05));
  const drop = Math.max(2, Math.round(cell * 0.06));
  return `inset 0 -${lip}px 0 rgba(0,0,0,0.16), inset 0 ${rim}px 0 rgba(255,255,255,0.42), 0 ${drop}px 0 rgba(27,42,58,0.16)`;
}

// A soft shadow on the ground that grows as the block is lifted.
export function LiftShadow({ cell, x, y, lift }: { readonly cell: number; readonly x: number; readonly y: number; readonly lift: SharedValue<number> }) {
  const { inset, side, radius } = blockMetrics(cell);
  const style = useAnimatedStyle(() => ({
    opacity: lift.get() * 0.2,
    transform: [{ translateY: lift.get() * cell * 0.16 }, { scale: 1 - lift.get() * 0.04 }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.ground, { left: x + inset, top: y + inset, width: side, height: side, borderRadius: radius }, style]} />;
}

// The body of one block at (x, y) in its owner: colour, plastic, shine, and
// optionally a face and a counting number. When its colour changes (its
// cluster grew or shrank: two 1s became a 2) it morphs and pops instead of
// switching.
export function BlockBody({ cell, x, y, colors, face, mood, count, lift, wink = 0 }: {
  readonly cell: number;
  readonly x: number;
  readonly y: number;
  readonly colors: BlockColors;
  readonly face: boolean;
  readonly mood: Mood;
  readonly count: number | null;
  readonly lift?: SharedValue<number>;
  // A finished count (0 = none): the block blinks once with the others.
  readonly wink?: number;
}) {
  const reduced = useReducedMotion();
  const { inset, side, border, radius } = blockMetrics(cell);
  const fill = useSharedValue(colors.fill);
  const edge = useSharedValue(colors.edge);
  const pop = useSharedValue(1);
  useEffect(() => {
    if (fill.get() === colors.fill && edge.get() === colors.edge) {
      return;
    }
    if (reduced) {
      fill.set(colors.fill);
      edge.set(colors.edge);
      return;
    }
    fill.set(withTiming(colors.fill, { duration: 220 }));
    edge.set(withTiming(colors.edge, { duration: 220 }));
    pop.set(withSequence(withTiming(1.12, { duration: 90, easing: EASE_OUT }), withSpring(1, BOUNCE)));
  }, [colors.fill, colors.edge, reduced, fill, edge, pop]);
  const paint = useAnimatedStyle(() => ({ backgroundColor: fill.get(), borderColor: edge.get(), transform: [{ scale: pop.get() }] }));
  const pulse = usePulse(count ?? 0);
  const winked = useWink(wink);
  const squint = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 - 0.08 * winked.get() }] }));
  const inner = side - 2 * border;
  return (
    <Animated.View style={[styles.body, { left: x + inset, top: y + inset, width: side, height: side, borderRadius: radius, borderWidth: border, boxShadow: toyShadow(cell) }, paint]}>
      <Animated.View style={[StyleSheet.absoluteFill, pulse]}>
        <Animated.View style={[StyleSheet.absoluteFill, squint]}>
          <View style={[styles.shine, { left: inner * 0.12, top: inner * 0.1, width: inner * 0.24, height: Math.max(2, inner * 0.09), borderRadius: inner * 0.05 }]} />
          {face ? <Face size={inner} mood={mood} blush={colors.blush} lifted={lift} winked={winked} blink={mood === 'calm'} /> : null}
          {count !== null ? <CountMark size={inner} n={count} colors={colors} /> : null}
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: { position: 'absolute', overflow: 'hidden' },
  shine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ rotate: '-16deg' }] },
  ground: { position: 'absolute', backgroundColor: '#1B2A3A' },
  buddy: { overflow: 'hidden' },
});

// A block character that is only looked at (the map title, a stop on the
// map): the same plastic and face, no gestures, no counting.
export function Buddy({ size, colors, mood = 'calm', blink = true }: { readonly size: number; readonly colors: BlockColors; readonly mood?: Mood; readonly blink?: boolean }) {
  const border = Math.max(2, Math.round(size * 0.05));
  const inner = size - 2 * border;
  return (
    <View pointerEvents="none" style={[styles.buddy, { width: size, height: size, borderRadius: Math.round(size * 0.28), borderWidth: border, backgroundColor: colors.fill, borderColor: colors.edge, boxShadow: toyShadow(size) }]}>
      <View style={[styles.shine, { left: inner * 0.12, top: inner * 0.1, width: inner * 0.24, height: Math.max(2, inner * 0.09), borderRadius: inner * 0.05 }]} />
      <Face size={inner} mood={mood} blush={colors.blush} blink={blink && mood === 'calm'} />
    </View>
  );
}
