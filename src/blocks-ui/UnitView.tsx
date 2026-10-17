import { StyleSheet } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { BlockBody, LiftShadow } from './Block';
import type { Mood } from './Face';
import type { CheerMove } from './cheer';
import { useCheer } from './juice';
import type { BlockColors } from './palette';
import { useDraggable } from './use-draggable';
import type { DraggableOptions } from './use-draggable';

export interface UnitViewProps {
  readonly size: number;
  readonly colors: BlockColors;
  readonly face: boolean;
  readonly mood: Mood;
  // The block's counting number in the current round, or null.
  readonly countIndex: number | null;
  // Bumped once per solved stop; blocks hop in index order.
  readonly celebrateTick: number;
  readonly index: number;
  readonly drag: DraggableOptions;
  // A finished count (0 = none): blink once with the others.
  readonly wink?: number;
  // What it does on a solve (its number's move).
  readonly cheer?: CheerMove;
}

export function UnitView({ size, colors, face, mood, countIndex, celebrateTick, index, drag, wink = 0, cheer = 'hop' }: UnitViewProps) {
  const { gesture, style, squash, lift } = useDraggable(drag);
  const hop = useCheer(cheer, celebrateTick, index);
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View testID="block" style={[styles.block, { left: drag.rest.x, top: drag.rest.y, width: size, height: size, transformOrigin: 'top left' }, style]}>
        <LiftShadow cell={size} x={0} y={0} lift={lift} />
        <Animated.View style={[StyleSheet.absoluteFill, squash]}>
          <Animated.View style={[StyleSheet.absoluteFill, hop]}>
            <BlockBody cell={size} x={0} y={0} colors={colors} face={face} mood={mood} count={countIndex} lift={lift} wink={wink} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  block: { position: 'absolute' },
});
