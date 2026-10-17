import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { FONT, THEME } from '../blocks-ui';
import { Icon } from './icons';
import { play } from './sound';

export const COLORS = THEME;

// Toy buttons: a hard lip underneath that the button sinks into when pressed
// (on press-in, with a click), instead of shrinking like an app control.
const LIP = 4;

function lip(color: string, pressed: boolean) {
  return { boxShadow: `0 ${pressed ? 1 : LIP}px 0 ${color}`, transform: [{ translateY: pressed ? LIP - 1 : 0 }] };
}

export function RoundButton({
  label,
  onPress,
  tone = 'plain',
  size = 48,
  accessibilityLabel,
  testID,
}: {
  readonly label: ReactNode;
  readonly onPress: () => void;
  readonly tone?: 'plain' | 'accent';
  readonly size?: number;
  readonly accessibilityLabel: string;
  readonly testID?: string;
}) {
  const edge = tone === 'accent' ? THEME.amberDeep : THEME.sandDeep;
  // The touch area reaches SLOP past the drawn circle: hitSlop does nothing on
  // react-native-web (2026-10-16 review I-1), padding does, on both.
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} testID={testID} onPress={onPress} onPressIn={() => play('tap')} style={styles.slop}>
      {({ pressed }) => (
        <View
          style={[
            styles.round,
            { width: size, height: size, borderRadius: size / 2, backgroundColor: tone === 'accent' ? THEME.amber : THEME.white, borderColor: edge },
            lip(edge, pressed),
          ]}>
          {typeof label === 'string' ? <Text style={[styles.roundLabel, { color: THEME.ink, fontSize: size * 0.42 }]}>{label}</Text> : label}
        </View>
      )}
    </Pressable>
  );
}

export function PillButton({
  title,
  onPress,
  tone = 'plain',
  compact = false,
  testID,
}: {
  readonly title: string;
  readonly onPress: () => void;
  readonly tone?: 'plain' | 'accent';
  // A little shorter, for the button row of a short phone (LEVEL_CHROME.compact.footer).
  readonly compact?: boolean;
  readonly testID?: string;
}) {
  const edge = tone === 'accent' ? THEME.amberDeep : THEME.sandDeep;
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      onPressIn={() => play('tap')}
      style={({ pressed }) => [styles.pill, compact ? styles.pillCompact : null, { backgroundColor: tone === 'accent' ? THEME.amber : THEME.white, borderColor: edge }, lip(edge, pressed)]}>
      <Text style={[styles.pillLabel, { color: THEME.ink }]}>{title}</Text>
    </Pressable>
  );
}

// The way into the parents' area (2026-10-15 review K): hold it for
// PARENT_HOLD_MS. A tap does not open it; it answers with a click and a small
// shake (2026-10-16 review I-3 / M-1: a tap that did nothing at all read as
// broken to a parent who did not know to hold), still nothing a child can use.
export const PARENT_HOLD_MS = 600;
// The shake on a tap: four short steps, 120ms in all.
const SHAKE = [-4, 4, -2, 0] as const;

export function ParentGate({ onOpen, size = 48, accessibilityLabel, accessibilityHint, testID }: {
  readonly onOpen: () => void;
  readonly size?: number;
  readonly accessibilityLabel: string;
  readonly accessibilityHint: string;
  readonly testID?: string;
}) {
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const onTap = () => {
    play('tap');
    if (!reduced) {
      x.set(withSequence(...SHAKE.map((v) => withTiming(v, { duration: 30 }))));
    }
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      onPress={onTap}
      onLongPress={onOpen}
      delayLongPress={PARENT_HOLD_MS}
      style={styles.slop}>
      {({ pressed }) => (
        <Animated.View style={[styles.round, { width: size, height: size, borderRadius: size / 2, backgroundColor: THEME.white, borderColor: THEME.sandDeep }, lip(THEME.sandDeep, pressed), shake]}>
          <Icon name="gear" size={size * 0.5} color={THEME.inkSoft} />
        </Animated.View>
      )}
    </Pressable>
  );
}

// Extra touch area around a round button that takes no room in the layout.
const SLOP = 8;

const styles = StyleSheet.create({
  slop: { padding: SLOP, margin: -SLOP },
  round: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  roundLabel: { fontFamily: FONT.display },
  pill: { paddingHorizontal: 24, paddingVertical: 13, borderRadius: 999, borderWidth: 2, alignItems: 'center' },
  // 44px tall: still a full touch target, and with its 4px lip it fits the 52px row.
  pillCompact: { paddingVertical: 7, minHeight: 44, justifyContent: 'center' },
  // Centred: in the narrow landscape column a long label ("Back to map") wraps.
  pillLabel: { fontSize: 19, fontFamily: FONT.display, fontWeight: '800', textAlign: 'center' },
});
