import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { Rect } from './layout';
import { THEME } from './palette';

// A ring around something a hint is talking about ("send the 4 back"), so the
// child does not have to match words to blocks. It pulses three times, then
// stays until the answer changes; it never takes a touch.
export function Spotlight({ rect, radius = 14 }: { readonly rect: Rect; readonly radius?: number }) {
  const reduced = useReducedMotion();
  const glow = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      return;
    }
    glow.set(1);
    glow.set(withRepeat(withTiming(0.3, { duration: 420 }), 6, true));
    return () => cancelAnimation(glow);
  }, [reduced, glow]);
  const style = useAnimatedStyle(() => ({ opacity: glow.get() }));
  return (
    <Animated.View
      pointerEvents="none"
      testID="spotlight"
      style={[styles.ring, { left: rect.x - 5, top: rect.y - 5, width: rect.width + 10, height: rect.height + 10, borderRadius: radius }, style]}
    />
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 4, borderColor: THEME.amberDeep, backgroundColor: 'rgba(255,184,61,0.16)', zIndex: 50 },
});
