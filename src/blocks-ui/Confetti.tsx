import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

// A burst of little paper squares from one point, in the solved number's
// colours: up and out, then falling with a spin, gone in under a second. It
// never takes a touch and never waits: the stage stays playable through it.

interface Piece {
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly size: number;
  readonly color: string;
  readonly round: boolean;
}

// Deterministic per burst (a seed, not Math.random), so tests and replays agree.
function pieces(count: number, colors: ReadonlyArray<string>, seed: number): ReadonlyArray<Piece> {
  let h = (seed * 2654435761) >>> 0 || 1;
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (rand() - 0.5) * Math.PI * 1.1;
    const speed = 150 + rand() * 170;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      spin: (rand() - 0.5) * 900,
      size: 7 + rand() * 6,
      color: colors[i % colors.length] as string,
      round: rand() > 0.7,
    };
  });
}

const GRAVITY = 520;

function Bit({ piece, t }: { readonly piece: Piece; readonly t: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const s = t.get();
    return {
      opacity: s < 0.7 ? 1 : Math.max(0, 1 - (s - 0.7) / 0.3),
      transform: [{ translateX: piece.vx * s }, { translateY: piece.vy * s + GRAVITY * s * s }, { rotate: `${piece.spin * s}deg` }],
    };
  });
  return (
    <Animated.View
      style={[
        styles.bit,
        { width: piece.size, height: piece.round ? piece.size : piece.size * 0.6, marginLeft: -piece.size / 2, marginTop: -piece.size / 2, borderRadius: piece.round ? piece.size / 2 : 2, backgroundColor: piece.color },
        style,
      ]}
    />
  );
}

export function Confetti({ tick, x, y, colors, count = 16, duration = 1000 }: {
  // A new number fires a new burst; 0 shows nothing.
  readonly tick: number;
  readonly x: number;
  readonly y: number;
  readonly colors: ReadonlyArray<string>;
  readonly count?: number;
  readonly duration?: number;
}) {
  const reduced = useReducedMotion();
  const t = useSharedValue(1);
  useEffect(() => {
    if (tick === 0 || reduced) {
      return;
    }
    t.set(0);
    t.set(withTiming(1, { duration, easing: Easing.linear }));
  }, [tick, reduced, duration, t]);
  if (tick === 0 || reduced) {
    return null;
  }
  return (
    <View pointerEvents="none" style={[styles.origin, { left: x, top: y }]} testID="confetti">
      {pieces(count, colors, tick).map((p, i) => (
        <Bit key={`${tick}-${i}`} piece={p} t={t} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  origin: { position: 'absolute', width: 0, height: 0, zIndex: 60 },
  bit: { position: 'absolute', left: 0, top: 0 },
});
