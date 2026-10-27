import { useEffect, useLayoutEffect, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

// The one gesture every block shares: a pan that follows the finger, lifts the
// block, and on release asks the owner what happened. "moved" means the owner
// changed the rest position (the block re-renders there), anything else springs
// back. A tap without movement is a separate action (counting): the pan only
// activates after 6px and the tap fails after 6px, so one touch is never both.
// The block lifts when the pan activates, not on touch-down, so a tap measures
// its point against the block at rest.

// 'blocked': released over the bench where the block cannot go (a taken cell,
// no room). It springs back with a small shake, so "it does not fit there"
// never reads like a wrong answer; a release anywhere else just springs back.
export type DropResult = 'moved' | 'same' | 'rejected' | 'blocked';

export interface Translation {
  readonly dx: number;
  readonly dy: number;
}

export interface DraggableOptions {
  readonly rest: { readonly x: number; readonly y: number };
  readonly restScale: number;
  readonly liftScale: number;
  readonly cellSize: number;
  readonly enabled: boolean;
  readonly onDrop: (t: Translation) => DropResult;
  readonly onMove?: (t: Translation) => void;
  readonly onCancel?: () => void;
  // Where the tap landed, relative to the block's top-left at rest.
  readonly onTap?: (point: { readonly x: number; readonly y: number }) => void;
  // A drag started (true) or ended either way (false).
  readonly onActive?: (active: boolean) => void;
  // Drops in from above when it first appears (ms after the stop opens), or not at all.
  readonly enterDelay?: number;
  // Where it comes in from (Phase 24): 'above', dropping into place; 'side',
  // sliding in from off the left (Take-away Island's bosses: the row is on the
  // mat from the start, so it arrives instead).
  readonly enterFrom?: 'above' | 'side';
}

// A finger was involved: springs carry velocity through an interruption.
const SETTLE = { damping: 18, stiffness: 220, mass: 0.6 } as const;
const LIFT = { damping: 14, stiffness: 260, mass: 0.5 } as const;
// Flying the last bit from the finger to its cell, or back to the tray: a
// little overshoot so it lands rather than teleports.
const LAND = { damping: 15, stiffness: 240, mass: 0.6 } as const;
const BOUNCE = { damping: 7, stiffness: 320, mass: 0.5 } as const;
const TILT_DEG = 3;
const SHAKE_DEG = 7;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export function useDraggable(options: DraggableOptions) {
  const reduced = useReducedMotion();
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(options.restScale);
  const tilt = useSharedValue(0);
  const active = useSharedValue(0);
  const lastCellX = useSharedValue(0);
  const lastCellY = useSharedValue(0);
  // Where the finger went down. RNGH's translation excludes the distance covered
  // before the pan activates, so the drop is measured from here instead.
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  // 0 at rest, 1 held up: drives the face ("whee") and the shadow under it.
  const lift = useSharedValue(0);
  // Squash and stretch about the centre, for an inner layer: a squish under the
  // finger, a splat on landing.
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  // Set by an accepted drop, read by the move it causes: that move lands with a splat.
  const landed = useSharedValue(0);
  const restAt = useRef<{ x: number; y: number } | null>(null);

  // The gesture is rebuilt on every render, so its worklets always hand off to
  // this render's handlers; no ref to the latest options is needed. Shared
  // values go through get() / set() because the app builds with the React Compiler.
  const { restScale, onDrop, onMove, onCancel, onTap, onActive } = options;
  const settle = (result: DropResult) => {
    if (result !== 'moved') {
      tx.set(withSpring(0, SETTLE));
      ty.set(withSpring(0, SETTLE));
    }
    landed.set(result === 'moved' ? 1 : 0);
    lift.set(withTiming(0, { duration: 160 }));
    scale.set(withSpring(restScale, SETTLE));
    tilt.set(
      result === 'blocked' && !reduced
        ? withSequence(withTiming(-SHAKE_DEG, { duration: 60 }), withTiming(SHAKE_DEG, { duration: 90 }), withTiming(-SHAKE_DEG / 2, { duration: 80 }), withSpring(0, SETTLE))
        : withSpring(0, SETTLE),
    );
    active.set(0);
    onActive?.(false);
  };
  const handleStart = () => onActive?.(true);
  const handleDrop = (dx: number, dy: number) => settle(onDrop({ dx, dy }));
  const handleMove = (dx: number, dy: number) => onMove?.({ dx, dy });
  const handleCancel = () => {
    settle('rejected');
    onCancel?.();
  };
  const handleTap = (x: number, y: number) => onTap?.({ x, y });

  // A move that the owner accepted re-renders the block at its new rest
  // position. Before paint, the translation is rebased so the block still sits
  // where it was let go, then springs the rest of the way and lands with a
  // little splat (FLIP); with reduced motion it just appears there.
  useLayoutEffect(() => {
    const prev = restAt.current;
    restAt.current = { x: options.rest.x, y: options.rest.y };
    if (prev === null || reduced) {
      tx.set(0);
      ty.set(0);
      return;
    }
    tx.set(prev.x + tx.get() - options.rest.x);
    ty.set(prev.y + ty.get() - options.rest.y);
    tx.set(withSpring(0, LAND));
    ty.set(withSpring(0, LAND));
    if (landed.get() === 1) {
      landed.set(0);
      sx.set(withSequence(withTiming(1.14, { duration: 70, easing: EASE_OUT }), withSpring(1, BOUNCE)));
      sy.set(withSequence(withTiming(0.86, { duration: 70, easing: EASE_OUT }), withSpring(1, BOUNCE)));
    }
  }, [options.rest.x, options.rest.y, reduced, tx, ty, sx, sy, landed]);

  // Arriving at a stop, everything drops into place one after another.
  const { enterDelay, enterFrom = 'above' } = options;
  useEffect(() => {
    if (enterDelay === undefined || reduced) {
      return;
    }
    if (enterFrom === 'side') {
      tx.set(-options.rest.x - options.cellSize * 3);
      tx.set(withDelay(enterDelay, withSpring(0, LAND)));
    } else {
      ty.set(-options.cellSize * 0.6);
      ty.set(withDelay(enterDelay, withSpring(0, LAND)));
    }
    sy.set(withDelay(enterDelay + 120, withSequence(withTiming(0.88, { duration: 70 }), withSpring(1, BOUNCE))));
    sx.set(withDelay(enterDelay + 120, withSequence(withTiming(1.1, { duration: 70 }), withSpring(1, BOUNCE))));
    // Once, on mount: later moves are the layout effect's job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scale.set(withSpring(restScale, SETTLE));
  }, [restScale, scale]);

  const { cellSize, liftScale, enabled } = options;
  const tiltTarget = reduced ? 0 : TILT_DEG;
  const pan = Gesture.Pan()
    .enabled(enabled)
    .minDistance(6)
    .onBegin((e) => {
      'worklet';
      startX.set(e.absoluteX);
      startY.set(e.absoluteY);
      lastCellX.set(0);
      lastCellY.set(0);
      // A squish under the finger the moment it touches, before any decision.
      if (!reduced) {
        sx.set(withTiming(0.93, { duration: 90, easing: EASE_OUT }));
        sy.set(withTiming(0.93, { duration: 90, easing: EASE_OUT }));
      }
    })
    .onStart(() => {
      'worklet';
      scheduleOnRN(handleStart);
      active.set(1);
      lift.set(withTiming(1, { duration: 120 }));
      sx.set(withSpring(1, LIFT));
      sy.set(withSpring(1, LIFT));
      scale.set(withSpring(liftScale, LIFT));
      tilt.set(withSpring(tiltTarget, LIFT));
    })
    .onUpdate((e) => {
      'worklet';
      const dx = e.absoluteX - startX.get();
      const dy = e.absoluteY - startY.get();
      tx.set(dx);
      ty.set(dy);
      const cx = Math.round(dx / cellSize);
      const cy = Math.round(dy / cellSize);
      if (cx !== lastCellX.get() || cy !== lastCellY.get()) {
        lastCellX.set(cx);
        lastCellY.set(cy);
        scheduleOnRN(handleMove, dx, dy);
      }
    })
    .onEnd((e) => {
      'worklet';
      scheduleOnRN(handleDrop, e.absoluteX - startX.get(), e.absoluteY - startY.get());
    })
    .onFinalize((_e, success) => {
      'worklet';
      if (active.get() === 0) {
        // A touch that never became a drag (a counting tap): let the squish go.
        sx.set(withSpring(1, BOUNCE));
        sy.set(withSpring(1, BOUNCE));
      }
      if (!success) {
        scheduleOnRN(handleCancel);
      }
    });

  const tap = Gesture.Tap()
    .enabled(enabled)
    .maxDuration(400)
    .maxDistance(6)
    .onEnd((e, success) => {
      'worklet';
      if (success) {
        scheduleOnRN(handleTap, e.x, e.y);
      }
    });

  const gesture = Gesture.Exclusive(pan, tap);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }, { rotate: `${tilt.get()}deg` }],
    zIndex: active.get() === 1 ? 100 : 1,
  }));
  // For a layer inside the moving one, scaled about its own centre.
  const squash = useAnimatedStyle(() => ({ transform: [{ scaleX: sx.get() }, { scaleY: sy.get() }] }));

  return { gesture, style, squash, lift };
}
