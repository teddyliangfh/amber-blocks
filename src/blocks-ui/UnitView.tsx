import { StyleSheet } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import type { Cell } from '../core';
import { BlockBody, LiftShadow } from './Block';
import type { Mood } from './Face';
import type { CheerMove } from './cheer';
import { useCheer } from './juice';
import type { BlockColors } from './palette';
import { GripPlate, NumberBadge } from './PartnerView';
import type { Badge } from './PartnerView';
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
  // Part of a joined character (Phase 20 F1): its badge, the character's cells
  // around it (relative to this block: it then sits on the shared plate), which
  // way its face turns, and the point its move turns about (px, relative to it).
  readonly badge?: Badge | null;
  readonly plateAround?: ReadonlyArray<Cell>;
  readonly look?: number;
  readonly pivot?: { readonly x: number; readonly y: number };
}

const ONE: ReadonlyArray<Cell> = [{ x: 0, y: 0 }];

export function UnitView({ size, colors, face, mood, countIndex, celebrateTick, index, drag, wink = 0, cheer = 'hop', badge = null, plateAround, look = 0, pivot }: UnitViewProps) {
  const { gesture, style, squash, lift } = useDraggable(drag);
  const hop = useCheer(cheer, celebrateTick, index);
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View testID="block" style={[styles.block, { left: drag.rest.x, top: drag.rest.y, width: size, height: size, transformOrigin: 'top left' }, style]}>
        <LiftShadow cell={size} x={0} y={0} lift={lift} />
        <Animated.View style={[StyleSheet.absoluteFill, squash]}>
          <Animated.View style={[StyleSheet.absoluteFill, pivot === undefined ? null : { transformOrigin: `${pivot.x}px ${pivot.y}px` }, hop]}>
            {plateAround === undefined ? null : <GripPlate offsets={ONE} cell={size} color={colors.fill} around={plateAround} />}
            <BlockBody cell={size} x={0} y={0} colors={colors} face={face} mood={mood} count={countIndex} lift={lift} wink={wink} look={look} />
            {badge === null ? null : <NumberBadge badge={badge} color={colors.deep} />}
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  block: { position: 'absolute' },
});
