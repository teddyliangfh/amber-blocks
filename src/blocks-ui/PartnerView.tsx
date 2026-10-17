import { StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import type { Cell } from '../core';
import { BlockBody, LiftShadow } from './Block';
import type { Mood } from './Face';
import type { CheerMove } from './cheer';
import { useCheer } from './juice';
import { blockAt, labelSpot } from './layout';
import { FONT } from './palette';
import type { BlockColors } from './palette';
import { useDraggable } from './use-draggable';
import type { DraggableOptions } from './use-draggable';

export interface PartnerViewProps {
  readonly cell: number;
  readonly offsets: ReadonlyArray<Cell>;
  readonly colors: BlockColors;
  readonly label: number;
  readonly mood: Mood;
  readonly celebrateTick: number;
  readonly index: number;
  readonly drag: DraggableOptions;
  // Counting numbers per block (same order as offsets), null for uncounted.
  readonly counts?: ReadonlyArray<number | null>;
  // A tap on the partner: the index into offsets of the block under the
  // finger (-1 for a gap in its box) and the point, relative to the partner at
  // rest. The partner still drags as one object; tapping only counts.
  readonly onTapBlock?: (index: number, point: { readonly x: number; readonly y: number }) => void;
  // A finished count (0 = none): every block blinks once with the others.
  readonly wink?: number;
  // What it does on a solve (its number's move).
  readonly cheer?: CheerMove;
}

// A partner's grip (2026-10-15 review: nothing showed that grabbing one block
// carries the whole partner). Its blocks sit on one rounded plate in their own
// colour, seen in the seams between them and as a thin rim around the outline:
// one piece, the whole of which a finger picks up. Behind the blocks, so it
// never covers a face or a number. Corners are rounded only on the outside.
function GripPlate({ offsets, cell, color }: { readonly offsets: ReadonlyArray<Cell>; readonly cell: number; readonly color: string }) {
  const has = new Set(offsets.map((c) => `${c.x},${c.y}`));
  const open = (x: number, y: number) => !has.has(`${x},${y}`);
  const r = Math.round(cell * 0.3);
  return (
    <View pointerEvents="none" testID="partner-grip" style={[StyleSheet.absoluteFill, styles.plate]}>
      {offsets.map((c) => (
        <View
          key={`${c.x},${c.y}`}
          style={{
            position: 'absolute',
            left: c.x * cell,
            top: c.y * cell,
            width: cell,
            height: cell,
            backgroundColor: color,
            borderTopLeftRadius: open(c.x - 1, c.y) && open(c.x, c.y - 1) ? r : 0,
            borderTopRightRadius: open(c.x + 1, c.y) && open(c.x, c.y - 1) ? r : 0,
            borderBottomLeftRadius: open(c.x - 1, c.y) && open(c.x, c.y + 1) ? r : 0,
            borderBottomRightRadius: open(c.x + 1, c.y) && open(c.x, c.y + 1) ? r : 0,
          }}
        />
      ))}
    </View>
  );
}

// The head block is the leftmost block of the top row.
export function headIndex(offsets: ReadonlyArray<Cell>): number {
  let best = 0;
  offsets.forEach((c, i) => {
    const b = offsets[best] as Cell;
    if (c.y < b.y || (c.y === b.y && c.x < b.x)) {
      best = i;
    }
  });
  return best;
}

export function PartnerView({ cell, offsets, colors, label, mood, celebrateTick, index, drag, counts, onTapBlock, wink = 0, cheer = 'hop' }: PartnerViewProps) {
  const { gesture, style, squash, lift } = useDraggable(
    onTapBlock === undefined
      ? drag
      : {
          ...drag,
          onTap: (point) => onTapBlock(blockAt(offsets, cell, point), point),
        },
  );
  const hop = useCheer(cheer, celebrateTick, index);
  const width = (Math.max(...offsets.map((c) => c.x)) + 1) * cell;
  const height = (Math.max(...offsets.map((c) => c.y)) + 1) * cell;
  const head = headIndex(offsets);
  const tag = labelSpot(offsets, cell);
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View testID={`partner-${label}`} style={[styles.partner, { left: drag.rest.x, top: drag.rest.y, width, height, transformOrigin: 'top left' }, style]}>
        {offsets.map((c, i) => (
          <LiftShadow key={`s${i}`} cell={cell} x={c.x * cell} y={c.y * cell} lift={lift} />
        ))}
        <Animated.View style={[StyleSheet.absoluteFill, squash]}>
          <Animated.View style={[StyleSheet.absoluteFill, hop]}>
            <GripPlate offsets={offsets} cell={cell} color={colors.fill} />
            {offsets.map((c, i) => (
              <BlockBody key={i} cell={cell} x={c.x * cell} y={c.y * cell} colors={colors} face={i === head} mood={mood} count={counts?.[i] ?? null} lift={lift} wink={wink} />
            ))}
            {/* The partner's number: white on the colour's deep shade, readable on every hue. */}
            <View pointerEvents="none" testID="partner-label" style={[styles.labelWrap, { left: tag.left, top: tag.top, minWidth: tag.size, height: tag.size, borderRadius: tag.size / 2, backgroundColor: colors.deep }]}>
              <Text style={[styles.label, { fontSize: tag.size * 0.64, lineHeight: tag.size * 0.86 }]}>{label}</Text>
            </View>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  partner: { position: 'absolute' },
  plate: { opacity: 0.55 },
  labelWrap: { position: 'absolute', paddingHorizontal: 2, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', boxShadow: '0 2px 0 rgba(27,42,58,0.18)' },
  label: { color: '#FFFFFF', fontFamily: FONT.display, textAlign: 'center' },
});
