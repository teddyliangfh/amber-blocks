import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { BlockBody } from './Block';
import { useCheer } from './juice';
import { labelSpot } from './layout';
import type { StageGeometry } from './layout';
import { NumberBadge } from './PartnerView';
import type { BlockColors } from './palette';
import { STAGE_COLORS } from './palette';

// The partner a compare stop is about (Phase 23c, Compare Island, design
// §2.3, §5.3): a row of `n` on a narrow sand rail right above the mat, left
// aligned with its first column, the same cell size, its face (calm), badge
// and colour, a dotted line along its foot. Scenery, like the boss's outline
// (D-094): never dragged, never judged, never saved. A tap makes it hop and
// say its number (`onTap`, as a partner in the tray does, D-084); it hops
// back when the stop is solved (`celebrateTick`). Grown ("one more" in steps)
// its blocks change colour as any block does (BlockBody), and a block appears
// at the right end. Reduced motion: no hop (useCheer).
export function CompareRail({ geometry, n, colors, celebrateTick, onTap }: { readonly geometry: StageGeometry; readonly n: number; readonly colors: BlockColors; readonly celebrateTick: number; readonly onTap?: (n: number) => void }) {
  const [taps, setTaps] = useState(0);
  const cell = geometry.cell;
  const cheer = useCheer('hop', celebrateTick, 0);
  const tapped = useCheer('hop', taps, 0);
  const offsets = Array.from({ length: n }, (_, x) => ({ x, y: 0 }));
  const top = geometry.bench.y - cell;
  return (
    <View pointerEvents="box-none" testID="compare-rail" style={[styles.rail, { left: geometry.bench.x, top, width: geometry.bench.width, height: cell }]}>
      <View pointerEvents="none" style={[styles.base, { borderRadius: Math.round(cell * 0.2) }]} />
      <View pointerEvents="none" style={[styles.line, { bottom: -3 }]} />
      <Animated.View style={[{ width: n * cell, height: cell }, cheer]}>
        <Animated.View style={[StyleSheet.absoluteFill, tapped]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={String(n)}
          testID={`compare-rail-${n}`}
          onPress={() => {
            setTaps((t) => t + 1);
            onTap?.(n);
          }}
          style={StyleSheet.absoluteFill}>
          {offsets.map((c) => (
            <BlockBody key={c.x} cell={cell} x={c.x * cell} y={0} colors={colors} face={c.x === 0} mood="calm" count={null} />
          ))}
          <NumberBadge badge={{ ...labelSpot(offsets, cell), n }} color={colors.deep} testID="compare-rail-label" />
        </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { position: 'absolute' },
  base: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: STAGE_COLORS.trayFill, borderWidth: 2, borderColor: STAGE_COLORS.trayLine },
  line: { position: 'absolute', left: 0, right: 0, borderBottomWidth: 3, borderStyle: 'dotted', borderColor: STAGE_COLORS.trayLine },
});
