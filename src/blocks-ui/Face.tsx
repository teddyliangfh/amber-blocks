import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { THEME } from './palette';

// calm: awake, waiting. happy: the stop is solved (^ ^ eyes, open smile).
// sleepy: dozing in the tray; it wakes when a finger lifts it. puzzled: the
// answer needs a change (2026-10-15 review: a wrong answer still smiled while
// the card said "here is a tip"): one brow up, a small "o", the head tilted a
// little. Wondering, never sad or cross.
export type Mood = 'calm' | 'happy' | 'sleepy' | 'puzzled';

const INK = THEME.faceInk;
const TONGUE = '#FF7A8A';

// An original face: low-set bean eyes with a shine, cheeks, a small mouth.
// Only ever on the head block of a cluster or partner (or a block on its own),
// so faces never stand in for the count. `size` is the block's inner side in px.
// While `lifted` (0..1) rises the face swaps to wide eyes and an "o".
export function Face({ size, mood = 'calm', blush, lifted, winked, blink = false }: {
  readonly size: number;
  readonly mood?: Mood;
  readonly blush: string;
  readonly lifted?: SharedValue<number>;
  // 0..1, 1 = eyes shut: the blink everyone does together when a count ends (useWink).
  readonly winked?: SharedValue<number>;
  readonly blink?: boolean;
}) {
  const s = size;
  const reduced = useReducedMotion();
  const still = useSharedValue(0);
  const up = lifted ?? still;
  const shut = winked ?? still;
  const lid = useSharedValue(1);
  // Each face blinks on its own beat, so a tray full of them never blinks in unison.
  useEffect(() => {
    if (!blink || reduced || mood !== 'calm') {
      lid.set(1);
      return;
    }
    const wait = 2200 + Math.random() * 3300;
    lid.set(withRepeat(withSequence(withDelay(wait, withTiming(0.12, { duration: 70 })), withTiming(1, { duration: 90 })), -1, false));
    return () => cancelAnimation(lid);
  }, [blink, reduced, mood, lid]);
  const rest = useAnimatedStyle(() => ({ opacity: 1 - up.get() }));
  const awake = useAnimatedStyle(() => ({ opacity: up.get() }));
  const lids = useAnimatedStyle(() => ({ transform: [{ scaleY: lid.get() }] }));
  const together = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 - 0.88 * shut.get() }] }));

  const line = Math.max(1.5, s * 0.035);
  const eyeW = Math.max(3, s * 0.11);
  const eyeH = Math.max(4, s * 0.14);
  const eyeY = s * 0.42;
  const eyeDX = s * 0.17;
  const shine = Math.max(1.5, s * 0.045);
  const arc = Math.max(5, s * 0.17);

  const beanEye = (cx: number, w: number, h: number) => (
    <View style={{ position: 'absolute', left: cx - w / 2, top: eyeY - h / 2, width: w, height: h, borderRadius: w / 2, backgroundColor: INK }}>
      <View style={{ position: 'absolute', right: w * 0.12, top: h * 0.14, width: shine, height: shine, borderRadius: shine / 2, backgroundColor: THEME.white }} />
    </View>
  );
  // ∩ for a happy squint, ∪ for closed sleepy eyes: one ring with a single side inked.
  const arcEye = (cx: number, side: 'top' | 'bottom') => (
    <View
      style={{
        position: 'absolute',
        left: cx - arc / 2,
        top: side === 'top' ? eyeY - arc * 0.3 : eyeY - arc * 0.75,
        width: arc,
        height: arc,
        borderRadius: arc / 2,
        borderWidth: line,
        borderColor: 'transparent',
        [side === 'top' ? 'borderTopColor' : 'borderBottomColor']: INK,
      }}
    />
  );

  let eyes: React.ReactNode;
  let mouth: React.ReactNode;
  if (mood === 'happy') {
    eyes = (
      <>
        {arcEye(s / 2 - eyeDX, 'top')}
        {arcEye(s / 2 + eyeDX, 'top')}
      </>
    );
    const w = s * 0.26;
    const h = s * 0.15;
    mouth = (
      <View style={{ position: 'absolute', left: s / 2 - w / 2, top: s * 0.55, width: w, height: h, backgroundColor: INK, borderTopLeftRadius: s * 0.03, borderTopRightRadius: s * 0.03, borderBottomLeftRadius: w / 2, borderBottomRightRadius: w / 2, overflow: 'hidden', alignItems: 'center' }}>
        <View style={{ position: 'absolute', bottom: -h * 0.12, width: w * 0.5, height: h * 0.55, borderRadius: w * 0.25, backgroundColor: TONGUE }} />
      </View>
    );
  } else if (mood === 'sleepy') {
    eyes = (
      <>
        {arcEye(s / 2 - eyeDX, 'bottom')}
        {arcEye(s / 2 + eyeDX, 'bottom')}
      </>
    );
    const w = s * 0.1;
    mouth = <View style={{ position: 'absolute', left: s / 2 - w / 2, top: s * 0.57, width: w, height: w * 0.5, borderWidth: line, borderTopWidth: 0, borderColor: INK, borderBottomLeftRadius: w / 2, borderBottomRightRadius: w / 2 }} />;
  } else if (mood === 'puzzled') {
    const browW = s * 0.15;
    const brow = (cx: number, lift: number, deg: number) => (
      <View style={{ position: 'absolute', left: cx - browW / 2, top: eyeY - eyeH / 2 - s * 0.1 - lift, width: browW, height: line, borderRadius: line / 2, backgroundColor: INK, transform: [{ rotate: `${deg}deg` }] }} />
    );
    eyes = (
      <>
        {beanEye(s / 2 - eyeDX, eyeW, eyeH)}
        {beanEye(s / 2 + eyeDX, eyeW, eyeH)}
        {brow(s / 2 - eyeDX, s * 0.05, -16)}
        {brow(s / 2 + eyeDX, 0, 8)}
      </>
    );
    const o = s * 0.1;
    mouth = <View style={{ position: 'absolute', left: s / 2 - o / 2 + s * 0.03, top: s * 0.57, width: o, height: o * 1.1, borderRadius: o / 2, borderWidth: line, borderColor: INK }} />;
  } else {
    eyes = (
      <Animated.View style={[StyleSheet.absoluteFill, lids, { transformOrigin: `50% ${eyeY}px` }]}>
        {beanEye(s / 2 - eyeDX, eyeW, eyeH)}
        {beanEye(s / 2 + eyeDX, eyeW, eyeH)}
      </Animated.View>
    );
    const w = s * 0.16;
    mouth = <View style={{ position: 'absolute', left: s / 2 - w / 2, top: s * 0.55, width: w, height: w * 0.5, borderWidth: line, borderTopWidth: 0, borderColor: INK, borderBottomLeftRadius: w / 2, borderBottomRightRadius: w / 2 }} />;
  }

  const cheekW = s * 0.17;
  const cheekH = s * 0.09;
  const oW = s * 0.12;
  const oH = s * 0.14;
  return (
    <View pointerEvents="none" testID={`face-${mood}`} style={[StyleSheet.absoluteFill, { width: s, height: s }, mood === 'puzzled' ? styles.tilt : null]}>
      <View style={[styles.cheek, { left: s / 2 - s * 0.3 - cheekW / 2, top: s * 0.57 - cheekH / 2, width: cheekW, height: cheekH, borderRadius: cheekH / 2, backgroundColor: blush }]} />
      <View style={[styles.cheek, { left: s / 2 + s * 0.3 - cheekW / 2, top: s * 0.57 - cheekH / 2, width: cheekW, height: cheekH, borderRadius: cheekH / 2, backgroundColor: blush }]} />
      <Animated.View style={[StyleSheet.absoluteFill, rest]}>
        <Animated.View style={[StyleSheet.absoluteFill, together, { transformOrigin: `50% ${eyeY}px` }]}>{eyes}</Animated.View>
        {mouth}
      </Animated.View>
      {/* Lifted: "whee!" — wide eyes and a round mouth. */}
      <Animated.View style={[StyleSheet.absoluteFill, awake]}>
        {beanEye(s / 2 - eyeDX, eyeW * 1.2, eyeH * 1.2)}
        {beanEye(s / 2 + eyeDX, eyeW * 1.2, eyeH * 1.2)}
        <View style={{ position: 'absolute', left: s / 2 - oW / 2, top: s * 0.56, width: oW, height: oH, borderRadius: oW / 2, backgroundColor: INK }} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  cheek: { position: 'absolute' },
  tilt: { transform: [{ rotate: '-7deg' }] },
});
