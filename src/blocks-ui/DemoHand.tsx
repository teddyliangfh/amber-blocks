import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { Easing, Extrapolation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import type { BlockColors } from './palette';

// "Like this": a see-through piece (a block, or a whole partner) and a pointing
// hand glide from the tray to the middle of the mat, twice, then go. Shown only while the mat is empty and
// nobody has touched anything for a while; any touch removes it. It never
// takes a touch itself. With reduced motion the ghost just blinks at the tray.
const CYCLE = 1800;

export function DemoHand({ from, to, cell, colors, cells = [{ x: 0, y: 0 }], fromScale = 1 }: {
  // Top-left corners, in stage px, of where the ghost starts and lands.
  readonly from: { readonly x: number; readonly y: number };
  readonly to: { readonly x: number; readonly y: number };
  readonly cell: number;
  readonly colors: BlockColors;
  // The piece being carried, as cell offsets: one block, or a whole partner
  // (2026-10-15 review: the first partner stop showed a single block, so
  // nothing said a partner moves as one).
  readonly cells?: ReadonlyArray<{ readonly x: number; readonly y: number }>;
  // Its size in the tray, growing to full size on the way to the mat.
  readonly fromScale?: number;
}) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withSequence(withTiming(1, { duration: CYCLE, easing: Easing.linear }), withDelay(450, withTiming(0, { duration: 0 }))), 2, false));
  }, [t]);
  const style = useAnimatedStyle(() => {
    const p = t.get();
    const fade = interpolate(p, [0, 0.12, 0.84, 1], [0, 1, 1, 0], Extrapolation.CLAMP);
    if (reduced) {
      return { opacity: fade, transform: [{ translateX: from.x }, { translateY: from.y }, { scale: fromScale }] };
    }
    const k = interpolate(p, [0.22, 0.74], [0, 1], Extrapolation.CLAMP);
    const ease = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
    const press = interpolate(p, [0.12, 0.2, 0.76, 0.84], [1, 0.9, 0.9, 1], Extrapolation.CLAMP);
    // A little arc, as a hand would carry it.
    const lift = Math.sin(ease * Math.PI) * cell * 0.5;
    return {
      opacity: fade,
      transform: [{ translateX: from.x + (to.x - from.x) * ease }, { translateY: from.y + (to.y - from.y) * ease - lift }, { scale: press * (fromScale + (1 - fromScale) * ease) }],
    };
  });
  const inset = Math.max(2, Math.round(cell * 0.06));
  const w = (Math.max(...cells.map((c) => c.x)) + 1) * cell;
  const h = (Math.max(...cells.map((c) => c.y)) + 1) * cell;
  return (
    <Animated.View pointerEvents="none" testID="demo-hand" style={[styles.ghost, { width: w, height: h, transformOrigin: 'top left' }, style]}>
      {cells.map((c) => (
        <Animated.View
          key={`${c.x},${c.y}`}
          testID="demo-ghost"
          style={[styles.block, { left: c.x * cell + inset, top: c.y * cell + inset, width: cell - 2 * inset, height: cell - 2 * inset, borderRadius: cell * 0.26, backgroundColor: colors.fill, borderColor: colors.edge }]}
        />
      ))}
      {/* The finger holds the first block: one grip carries the whole partner. */}
      <Text style={[styles.hand, { fontSize: cell * 0.78, lineHeight: cell * 0.9, left: cell * 0.32, top: cell * 0.42 }]}>👆</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ghost: { position: 'absolute', left: 0, top: 0, zIndex: 80 },
  block: { position: 'absolute', opacity: 0.55, borderWidth: 2, borderStyle: 'dashed' },
  hand: { position: 'absolute' },
});
