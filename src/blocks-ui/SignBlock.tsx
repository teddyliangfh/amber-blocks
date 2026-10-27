import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { picturedSides } from '../content';
import { signOf } from '../core';
import type { BenchState, Sign } from '../core';
import { SIGN_COLORS, THEME } from './palette';

// Compare Island's sign block (Phase 23d, PRD §5.2, the 23d design): the same
// toy plastic as a block (lit rim, dark lip, hard shadow), a size bigger, a
// little star for "this one moves", and the sign drawn as two thick rounded
// bars, white with a dark amber outline. Under it a small face, one of the
// family: calm in the tray, wide-eyed lifted, a smile when it was the right
// sign, one brow up when it was not. Only looked at: SignStage moves it.
export type SignMood = 'calm' | 'happy' | 'puzzled';

const INK = THEME.faceInk;
const BAR = 0.15;
const OUTLINE = 0.045;

interface Bar {
  readonly cx: number;
  readonly cy: number;
  readonly length: number;
  readonly deg: number;
}

// The bars, as fractions of the block's inner side: a chevron for > and <
// (its point 0.16 right or left of the middle), two bars for =.
export function signBars(sign: Sign): ReadonlyArray<Bar> {
  if (sign === '=') {
    return [
      { cx: 0.5, cy: 0.27, length: 0.38 + BAR, deg: 0 },
      { cx: 0.5, cy: 0.51, length: 0.38 + BAR, deg: 0 },
    ];
  }
  const dir = sign === '>' ? 1 : -1;
  const dx = 0.32;
  const dy = 0.15;
  const length = Math.hypot(dx, dy) + BAR;
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  return [
    { cx: 0.5, cy: 0.38 - dy / 2, length, deg: dir * deg },
    { cx: 0.5, cy: 0.38 + dy / 2, length, deg: -dir * deg },
  ];
}

export function SignBlock({ size, sign, mood = 'calm', lift, ghost = false }: { readonly size: number; readonly sign: Sign; readonly mood?: SignMood; readonly lift?: SharedValue<number>; readonly ghost?: boolean }) {
  const border = Math.max(2, Math.round(size * 0.05));
  const inner = size - 2 * border;
  const still = useSharedValue(0);
  const up = lift ?? still;
  const rest = useAnimatedStyle(() => ({ opacity: 1 - up.get() }));
  const awake = useAnimatedStyle(() => ({ opacity: up.get() }));
  const bars = signBars(sign);
  const lip = Math.max(2, Math.round(size * 0.085));
  const rim = Math.max(1, Math.round(size * 0.055));
  const drop = Math.max(2, Math.round(size * 0.07));
  const bar = (b: Bar, extra: number, color: string, key: string) => {
    const w = (b.length + 2 * extra) * inner;
    const h = (BAR + 2 * extra) * inner;
    return <View key={key} style={[styles.bar, { left: b.cx * inner - w / 2, top: b.cy * inner - h / 2, width: w, height: h, borderRadius: h / 2, backgroundColor: color, transform: [{ rotate: `${b.deg}deg` }] }]} />;
  };
  const eyeW = inner * 0.1;
  const eyeH = inner * 0.13;
  const eyeY = inner * 0.74;
  const line = Math.max(1.5, inner * 0.03);
  const eye = (cx: number, w: number, h: number) => (
    <View style={{ position: 'absolute', left: cx - w / 2, top: eyeY - h / 2, width: w, height: h, borderRadius: w / 2, backgroundColor: INK }}>
      <View style={{ position: 'absolute', right: w * 0.12, top: h * 0.14, width: w * 0.38, height: w * 0.38, borderRadius: w, backgroundColor: THEME.white }} />
    </View>
  );
  const arc = (cx: number) => {
    const a = inner * 0.12;
    return <View style={{ position: 'absolute', left: cx - a / 2, top: eyeY - a * 0.35, width: a, height: a, borderRadius: a / 2, borderWidth: line, borderColor: 'transparent', borderTopColor: INK }} />;
  };
  const brow = (cx: number, lift2: number, deg: number) => (
    <View style={{ position: 'absolute', left: cx - inner * 0.06, top: eyeY - eyeH / 2 - inner * 0.07 - lift2, width: inner * 0.12, height: line, borderRadius: line, backgroundColor: INK, transform: [{ rotate: `${deg}deg` }] }} />
  );
  const lx = inner * 0.37;
  const rx = inner * 0.63;
  const mouthW = inner * (mood === 'happy' ? 0.15 : 0.09);
  const face =
    mood === 'happy' ? (
      <>
        {arc(lx)}
        {arc(rx)}
        <View style={{ position: 'absolute', left: inner / 2 - mouthW / 2, top: inner * 0.79, width: mouthW, height: mouthW * 0.55, backgroundColor: INK, borderBottomLeftRadius: mouthW / 2, borderBottomRightRadius: mouthW / 2 }} />
      </>
    ) : (
      <>
        {eye(lx, eyeW, eyeH)}
        {eye(rx, eyeW, eyeH)}
        {mood === 'puzzled' ? (
          <>
            {brow(lx, inner * 0.03, -18)}
            {brow(rx, 0, 10)}
            <View style={{ position: 'absolute', left: inner / 2 - inner * 0.035, top: inner * 0.82, width: inner * 0.07, height: inner * 0.075, borderRadius: inner, borderWidth: line, borderColor: INK }} />
          </>
        ) : (
          <View style={{ position: 'absolute', left: inner / 2 - mouthW / 2, top: inner * 0.82, width: mouthW, height: mouthW * 0.5, borderWidth: line, borderTopWidth: 0, borderColor: INK, borderBottomLeftRadius: mouthW / 2, borderBottomRightRadius: mouthW / 2 }} />
        )}
      </>
    );
  return (
    <View
      pointerEvents="none"
      testID={`sign-block-${sign}`}
      style={[
        styles.body,
        { width: size, height: size, borderRadius: Math.round(size * 0.28), borderWidth: border, boxShadow: `inset 0 -${lip}px 0 rgba(122,67,0,0.25), inset 0 ${rim}px 0 rgba(255,255,255,0.6), 0 ${drop}px 0 rgba(27,42,58,0.22)` },
        ghost ? styles.ghost : null,
      ]}>
      <View style={[styles.shine, { left: inner * 0.11, top: inner * 0.08, width: inner * 0.24, height: Math.max(2, inner * 0.09), borderRadius: inner * 0.05 }]} />
      {bars.map((b, i) => bar(b, OUTLINE, SIGN_COLORS.outline, `o${i}`))}
      {bars.map((b, i) => bar(b, 0, SIGN_COLORS.glyph, `w${i}`))}
      <Text style={[styles.star, { right: inner * 0.05, top: inner * 0.0, fontSize: inner * 0.2, lineHeight: inner * 0.26 }]}>✦</Text>
      <View style={[styles.cheek, { left: inner * 0.17, top: inner * 0.79, width: inner * 0.12, height: inner * 0.065, borderRadius: inner * 0.04 }]} />
      <View style={[styles.cheek, { left: inner * 0.71, top: inner * 0.79, width: inner * 0.12, height: inner * 0.065, borderRadius: inner * 0.04 }]} />
      {ghost ? null : (
        <>
          <Animated.View style={[StyleSheet.absoluteFill, rest]} testID={`sign-face-${mood}`}>
            {face}
          </Animated.View>
          {/* Lifted: "whee!" — wide eyes and a round mouth, as a block does. */}
          <Animated.View style={[StyleSheet.absoluteFill, awake]}>
            {eye(lx, eyeW * 1.25, eyeH * 1.25)}
            {eye(rx, eyeW * 1.25, eyeH * 1.25)}
            <View style={{ position: 'absolute', left: inner / 2 - inner * 0.05, top: inner * 0.8, width: inner * 0.1, height: inner * 0.11, borderRadius: inner, backgroundColor: INK }} />
          </Animated.View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { overflow: 'hidden', backgroundColor: SIGN_COLORS.fill, borderColor: SIGN_COLORS.edge },
  ghost: { opacity: 0.55, borderStyle: 'dashed' },
  shine: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.55)', transform: [{ rotate: '-16deg' }] },
  bar: { position: 'absolute' },
  star: { position: 'absolute', color: THEME.white, fontWeight: '700' },
  cheek: { position: 'absolute', backgroundColor: SIGN_COLORS.cheek },
});

// A Compare Island picture (a finished round: two sides with a free column
// between, content `picturedSides`) wears its sign in that column, on the
// bottom row, smiling: the album card, the album's big view and the island
// page draw it over the blocks. `x`, `y`: where column 0 / row 0 of the work's
// cells are drawn, `cell` their size. Nothing when the work is not such a picture.
export function PictureSign({ work, cell, x, y }: { readonly work: BenchState; readonly cell: number; readonly x: number; readonly y: number }) {
  const sides = picturedSides(work);
  if (sides === null) {
    return null;
  }
  const bottom = Math.max(...[...work.bench.values()].map((c) => c.y));
  const inset = Math.max(1, Math.round(cell * 0.04));
  return (
    <View pointerEvents="none" testID="picture-sign" style={{ position: 'absolute', left: x + sides.gap * cell + inset, top: y + bottom * cell + inset }}>
      <SignBlock size={cell - 2 * inset} sign={signOf(sides.left, sides.right)} mood="happy" />
    </View>
  );
}
