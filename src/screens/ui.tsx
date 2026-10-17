import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Animated, { FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { FONT, THEME } from '../blocks-ui';
import { Icon } from './icons';
import type { IconName } from './icons';
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
  icon,
  testID,
}: {
  readonly title: string;
  readonly onPress: () => void;
  readonly tone?: 'plain' | 'accent';
  // A little shorter, for the button row of a short phone (LEVEL_CHROME.compact.footer).
  readonly compact?: boolean;
  // A picture before the words, for a child who cannot read them (Phase 20 Q7).
  readonly icon?: IconName;
  readonly testID?: string;
}) {
  const edge = tone === 'accent' ? THEME.amberDeep : THEME.sandDeep;
  return (
    <Pressable
      accessibilityRole="button"
      testID={testID}
      onPress={onPress}
      onPressIn={() => play('tap')}
      style={({ pressed }) => [styles.pill, compact ? styles.pillCompact : null, icon === undefined ? null : styles.pillIcon, { backgroundColor: tone === 'accent' ? THEME.amber : THEME.white, borderColor: edge }, lip(edge, pressed)]}>
      {icon === undefined ? null : <Icon name={icon} size={compact ? 20 : 22} />}
      <Text style={[styles.pillLabel, icon === undefined ? null : styles.pillLabelIcon, { color: THEME.ink }]}>{title}</Text>
    </Pressable>
  );
}

// The way into the parents' area (2026-10-15 review K): hold it for
// PARENT_HOLD_MS. A tap does not open it; it answers with a click and a small
// shake (2026-10-16 review I-3 / M-1: a tap that did nothing at all read as
// broken to a parent who did not know to hold), still nothing a child can use.
// The tap also shows the hold hint in a small bubble above the gear for
// PARENT_HINT_MS (D-073: the click and shake alone still read as broken); a child
// who cannot read gets nothing more from it.
export const PARENT_HOLD_MS = 600;
export const PARENT_HINT_MS = 1500;
// The shake on a tap: four short steps, 120ms in all.
const SHAKE = [-4, 4, -2, 0] as const;
const HINT_WIDTH = 160;
const TAIL = 10;

export function ParentGate({ onOpen, size = 48, accessibilityLabel, accessibilityHint, hintAlign = 'center', muted = false, testID }: {
  readonly onOpen: () => void;
  readonly size?: number;
  readonly accessibilityLabel: string;
  // Also the words in the bubble a tap shows.
  readonly accessibilityHint: string;
  // 'start' when the gear sits at the screen's left edge (the map), so the bubble stays on screen.
  readonly hintAlign?: 'center' | 'start';
  // A quieter gear (the level menu). On the gear itself, not a wrapper, so the bubble stays solid.
  readonly muted?: boolean;
  readonly testID?: string;
}) {
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  // 0: no bubble; each tap counts up, so a second tap keeps it up for another PARENT_HINT_MS.
  const [hint, setHint] = useState(0);
  useEffect(() => {
    if (hint === 0) {
      return undefined;
    }
    const timer = setTimeout(() => setHint(0), PARENT_HINT_MS);
    return () => clearTimeout(timer);
  }, [hint]);
  const onTap = () => {
    play('tap');
    setHint((n) => n + 1);
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
      onLongPress={() => {
        setHint(0);
        onOpen();
      }}
      delayLongPress={PARENT_HOLD_MS}
      style={styles.slop}>
      {({ pressed }) => (
        <>
          <Animated.View style={[styles.round, { width: size, height: size, borderRadius: size / 2, backgroundColor: THEME.white, borderColor: THEME.sandDeep }, lip(THEME.sandDeep, pressed), muted ? styles.muted : null, shake]}>
            <Icon name="gear" size={size * 0.5} color={THEME.inkSoft} />
          </Animated.View>
          {hint > 0 ? (
            <Animated.View
              entering={FadeIn.duration(120)}
              pointerEvents="none"
              style={[styles.hint, hintAlign === 'start' ? styles.hintStart : styles.hintCenter]}
              testID={testID === undefined ? undefined : `${testID}-hint`}>
              <Text style={styles.hintLabel}>{accessibilityHint}</Text>
              <View style={[styles.hintTail, hintAlign === 'start' ? { left: SLOP + size / 2 - TAIL / 2 } : styles.hintTailCenter]} />
            </Animated.View>
          ) : null}
        </>
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
  // The picture and the words side by side; a long label still wraps beside it.
  pillIcon: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: 20 },
  pillLabelIcon: { flexShrink: 1 },
  // Above the gear, over whatever is there (it takes no touches), gone by itself.
  // High enough that a menu button it covers is covered past its label, not cut through it.
  hint: { position: 'absolute', bottom: '100%', width: HINT_WIDTH, marginBottom: TAIL + 2, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 2, borderColor: THEME.sandDeep, backgroundColor: THEME.white, zIndex: 10 },
  hintCenter: { left: '50%', marginLeft: -HINT_WIDTH / 2 },
  hintStart: { left: 0 },
  hintLabel: { fontSize: 15, fontFamily: FONT.body, fontWeight: '800', color: THEME.ink, textAlign: 'center' },
  muted: { opacity: 0.85 },
  // A small point down at the gear.
  hintTail: { position: 'absolute', bottom: -TAIL / 2 - 1, width: TAIL, height: TAIL, backgroundColor: THEME.white, borderRightWidth: 2, borderBottomWidth: 2, borderColor: THEME.sandDeep, transform: [{ rotate: '45deg' }] },
  hintTailCenter: { left: '50%', marginLeft: -TAIL / 2 },
});
