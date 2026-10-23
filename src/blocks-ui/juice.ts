import { useEffect, useRef } from 'react';
import { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import type { CheerMove } from './cheer';

// Transient feedback on the UI thread. Everything here returns to rest.
// Shared values go through get() / set(): the app builds with the React Compiler.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// How far the little car drives before it comes round again (past any phone's edge).
export const CAR_DRIVE = 900;
// How long the car's trip takes, wheels out to wheels in.
export const CAR_MS = 1650;
// How far the rocket flies (past the top of any phone) and how long the whole
// launch takes, crouch to landing (Phase 22).
export const LAUNCH_HEIGHT = 900;
export const LAUNCH_MS = 1700;

const LAND = { damping: 10, stiffness: 260, mass: 0.5 } as const;
const SETTLE = { damping: 9, stiffness: 240 } as const;

// The solve moment, played once per event (`tick`, 0 = none): a new index
// (blocks rearranged) only sets the stagger, it never replays it. Each number
// has its own move (cheer.ts, 2026-10-15 review J); 'hop' is the plain one: a
// crouch, a jump and a splat. With reduced motion nothing moves.
export function useCheer(move: CheerMove, tick: number, index: number) {
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const r = useSharedValue(0);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const played = useRef(0);
  useEffect(() => {
    if (tick === 0 || tick === played.current || reduced) {
      return;
    }
    played.current = tick;
    const i = Math.min(index, 16);
    const splat = (delay: number) => {
      sy.set(withDelay(delay, withSequence(withTiming(0.86, { duration: 80 }), withTiming(1.1, { duration: 120 }), withTiming(0.82, { duration: 80, easing: EASE_OUT }), withSpring(1, SETTLE))));
      sx.set(withDelay(delay, withSequence(withTiming(1.12, { duration: 80 }), withTiming(0.92, { duration: 120 }), withTiming(1.18, { duration: 80, easing: EASE_OUT }), withSpring(1, SETTLE))));
    };
    const jump = (delay: number, height: number) => withDelay(delay, withSequence(withTiming(-height, { duration: 180, easing: EASE_OUT }), withSpring(0, LAND)));
    switch (move) {
      case 'spin': {
        // 1 (and 7): a full turn in the air.
        const d = i * 80;
        y.set(withDelay(d, withSequence(withTiming(-22, { duration: 220, easing: EASE_OUT }), withSpring(0, LAND))));
        r.set(withDelay(d, withSequence(withTiming(360, { duration: 520, easing: Easing.inOut(Easing.cubic) }), withTiming(0, { duration: 0 }))));
        break;
      }
      case 'pair': {
        // 2: everyone jumps together, twice.
        splat(0);
        y.set(withSequence(withDelay(80, withTiming(-26, { duration: 170, easing: EASE_OUT })), withTiming(0, { duration: 150 }), withTiming(-18, { duration: 150, easing: EASE_OUT }), withSpring(0, LAND)));
        break;
      }
      case 'stack': {
        // 3 (and 6): each one jumps higher than the last, like climbing on top.
        splat(i * 110);
        y.set(jump(i * 110 + 80, Math.min(16 + i * 9, 60)));
        break;
      }
      case 'wiggle': {
        // 4: a happy shake.
        r.set(withDelay(i * 40, withSequence(withTiming(-12, { duration: 90 }), withTiming(12, { duration: 120 }), withTiming(-9, { duration: 110 }), withTiming(9, { duration: 110 }), withSpring(0, SETTLE))));
        y.set(jump(i * 40, 10));
        break;
      }
      case 'wave': {
        // 5 (8, 9): a wave runs along them, twice.
        const d = i * 70;
        y.set(withDelay(d, withSequence(withTiming(-18, { duration: 150, easing: EASE_OUT }), withTiming(0, { duration: 160 }), withDelay(Math.max(0, 420 - d), withTiming(-12, { duration: 140, easing: EASE_OUT })), withSpring(0, LAND))));
        break;
      }
      case 'stand':
      case 'tall-wave': {
        // 10 and 12: standing up tall. 17's big partner also waves while it stands.
        sy.set(withSequence(withTiming(1.3, { duration: 240, easing: EASE_OUT }), withDelay(move === 'tall-wave' ? 760 : 380, withSpring(1, SETTLE))));
        sx.set(withSequence(withTiming(0.88, { duration: 240, easing: EASE_OUT }), withDelay(move === 'tall-wave' ? 760 : 380, withSpring(1, SETTLE))));
        if (move === 'tall-wave') {
          r.set(withDelay(240, withSequence(withTiming(-10, { duration: 130 }), withTiming(10, { duration: 170 }), withTiming(-10, { duration: 170 }), withTiming(10, { duration: 170 }), withSpring(0, SETTLE))));
        }
        break;
      }
      case 'car': {
        // The 8 brick on wheels: off to the right, round again from the left, home.
        x.set(withSequence(withDelay(250, withTiming(CAR_DRIVE, { duration: 650, easing: Easing.in(Easing.quad) })), withTiming(-CAR_DRIVE, { duration: 0 }), withTiming(0, { duration: 750, easing: EASE_OUT })));
        y.set(withDelay(250, withSequence(withTiming(-3, { duration: 90 }), withTiming(0, { duration: 90 }), withTiming(-3, { duration: 90 }), withTiming(0, { duration: 90 }))));
        break;
      }
      case 'launch': {
        // The countdown's rocket: a crouch, straight up and out of the picture,
        // then back down from above to land where it was.
        sy.set(withSequence(withTiming(0.78, { duration: 180 }), withTiming(1.3, { duration: 160, easing: EASE_OUT }), withDelay(900, withSpring(1, SETTLE))));
        sx.set(withSequence(withTiming(1.16, { duration: 180 }), withTiming(0.84, { duration: 160, easing: EASE_OUT }), withDelay(900, withSpring(1, SETTLE))));
        y.set(withSequence(withDelay(180, withTiming(-LAUNCH_HEIGHT, { duration: 480, easing: Easing.in(Easing.quad) })), withDelay(320, withTiming(0, { duration: LAUNCH_MS - 980, easing: EASE_OUT }))));
        break;
      }
      case 'hop': {
        splat(i * 55);
        y.set(jump(i * 55 + 80, 24));
        break;
      }
    }
  }, [move, tick, index, reduced, x, y, r, sx, sy]);
  return useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }, { rotate: `${r.get()}deg` }, { scaleX: sx.get() }, { scaleY: sy.get() }] }));
}

// The plain solve hop (see useCheer).
export function useHop(tick: number, index: number) {
  return useCheer('hop', tick, index);
}

// The car's wheels: out for the trip, then tucked away again.
export function useWheels(tick: number) {
  const reduced = useReducedMotion();
  const o = useSharedValue(0);
  useEffect(() => {
    if (tick === 0 || reduced) {
      return;
    }
    o.set(withSequence(withTiming(1, { duration: 180 }), withDelay(CAR_MS - 380, withTiming(0, { duration: 200 }))));
  }, [tick, reduced, o]);
  return o;
}

// A quick pulse when something is acknowledged (a block counted, a number
// spoken); `times` pulses back to back (the cloud's "look here", Phase 23-0).
export function usePulse(tick: number, times = 1) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (tick === 0 || reduced) {
      return;
    }
    const once = [withTiming(1.16, { duration: 90, easing: EASE_OUT }), withTiming(1, { duration: 160 })];
    s.set(withSequence(...Array.from({ length: times - 1 }, () => once).flat(), withTiming(1.16, { duration: 90, easing: EASE_OUT }), withSpring(1, { damping: 11, stiffness: 260 })));
  }, [tick, times, reduced, s]);
  return useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
}

// A count just finished: every counted block blinks once, together ("that's
// all of us"). 0 → 1 → 0 over about a quarter second; 1 is eyes shut. `tick`
// is the finished round (0 = none); each new one plays once.
export function useWink(tick: number) {
  const reduced = useReducedMotion();
  const w = useSharedValue(0);
  useEffect(() => {
    if (tick === 0 || reduced) {
      return;
    }
    w.set(withSequence(withTiming(1, { duration: 90, easing: EASE_OUT }), withDelay(60, withTiming(0, { duration: 130 }))));
  }, [tick, reduced, w]);
  return w;
}

// A bigger pop for the one headline change on screen (the target turning
// green): up to `peak` and back. `from` below 1 makes it an entrance, the
// cloud's at a stop's opening (0.6 → 1.4 → 1, Phase 23-0).
export function usePop(tick: number, peak = 1.32, from = 1) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  const r = useSharedValue(0);
  useEffect(() => {
    if (tick === 0 || reduced) {
      return;
    }
    s.set(from);
    s.set(withSequence(withTiming(peak, { duration: from < 1 ? 220 : 140, easing: EASE_OUT }), withSpring(1, { damping: 7, stiffness: 200 })));
    r.set(withSequence(withTiming(-6, { duration: 90 }), withTiming(6, { duration: 120 }), withSpring(0, { damping: 8, stiffness: 200 })));
  }, [tick, peak, from, reduced, s, r]);
  return useAnimatedStyle(() => ({ transform: [{ scale: s.get() }, { rotate: `${r.get()}deg` }] }));
}

// "Look at me": a little rock, ±8° three times, `delay` ms after each new
// `tick` (the shape picture at a stop's opening, Phase 23-0). Nothing with
// reduced motion.
export function useWobble(tick: number, delay = 0) {
  const reduced = useReducedMotion();
  const r = useSharedValue(0);
  useEffect(() => {
    if (tick === 0 || reduced) {
      return;
    }
    r.set(withDelay(delay, withSequence(withTiming(-8, { duration: 80 }), withTiming(8, { duration: 85 }), withTiming(-8, { duration: 85 }), withTiming(8, { duration: 85 }), withTiming(-8, { duration: 85 }), withSpring(0, SETTLE))));
  }, [tick, delay, reduced, r]);
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${r.get()}deg` }] }));
}

// Leaning towards something and nodding at it, `delay` ms after each new
// `tick`: Amber has no arms to point with (Phase 23-0). (dx, dy): which way.
export function useLean(tick: number, dx: number, dy: number, delay = 0) {
  const reduced = useReducedMotion();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const r = useSharedValue(0);
  useEffect(() => {
    if (tick === 0 || reduced) {
      return;
    }
    const lean = (to: number) => withDelay(delay, withSequence(withTiming(to, { duration: 160, easing: EASE_OUT }), withDelay(420, withSpring(0, SETTLE))));
    x.set(lean(dx));
    y.set(lean(dy));
    r.set(withDelay(delay, withSequence(withTiming(-9, { duration: 110, easing: EASE_OUT }), withTiming(5, { duration: 150 }), withTiming(-5, { duration: 140 }), withSpring(0, SETTLE))));
  }, [tick, dx, dy, delay, reduced, x, y, r]);
  return useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }, { rotate: `${r.get()}deg` }] }));
}

// A nod, as if saying "here's a tip": a dip forward and back, once each time
// `cue` changes to a new non-null value. The value on mount only sets what has
// been seen (rotating the phone remounts with the same tip). With reduced
// motion nothing moves.
export function useNod(cue: string | null) {
  const reduced = useReducedMotion();
  const r = useSharedValue(0);
  const y = useSharedValue(0);
  const seen = useRef(cue);
  useEffect(() => {
    if (cue === seen.current) {
      return;
    }
    seen.current = cue;
    if (cue === null || reduced) {
      return;
    }
    r.set(withSequence(withTiming(-9, { duration: 110, easing: EASE_OUT }), withTiming(5, { duration: 150 }), withTiming(-5, { duration: 140 }), withSpring(0, SETTLE)));
    y.set(withSequence(withTiming(3, { duration: 110, easing: EASE_OUT }), withTiming(0, { duration: 150 }), withTiming(2, { duration: 140 }), withSpring(0, SETTLE)));
  }, [cue, reduced, r, y]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }, { rotate: `${r.get()}deg` }] }));
}

// An ambient bob for the map marker, the one piece of motion the player did not cause.
export function useBob(enabled: boolean, amplitude = 6, period = 1300) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (!enabled || reduced) {
      y.set(0);
      return;
    }
    y.set(withRepeat(withSequence(withTiming(-amplitude, { duration: period / 2, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: period / 2, easing: Easing.inOut(Easing.quad) })), -1, false));
    return () => {
      cancelAnimation(y);
      y.set(0);
    };
  }, [enabled, reduced, y, amplitude, period]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
}

// A slow breath on the button that moves the game on, once the child has had
// a moment to enjoy the solve: it says "this way" without words.
export function useBreathe(enabled: boolean, after = 1600) {
  const reduced = useReducedMotion();
  const s = useSharedValue(1);
  useEffect(() => {
    if (!enabled || reduced) {
      s.set(1);
      return;
    }
    s.set(withDelay(after, withRepeat(withSequence(withTiming(1.07, { duration: 650, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) })), -1, false)));
    return () => {
      cancelAnimation(s);
      s.set(1);
    };
  }, [enabled, reduced, after, s]);
  return useAnimatedStyle(() => ({ transform: [{ scale: s.get() }] }));
}
