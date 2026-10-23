import { StyleSheet, View } from 'react-native';

import { PICTURE_PAD, THEME, colorsFor, pictureBox } from '../blocks-ui';
import type { CloudSize } from '../blocks-ui';
import { hueFor } from '../content';
import type { Question } from '../core';

// The little picture on a Compare Island cloud (Phase 23c, design §5.3, in
// the shape picture's slot, Phase 23-0): a compare shows two rows, the rail's
// partner on top in its colour, under it a grey dashed row as long as the
// answer would be: one longer (more), one shorter (fewer), the same. A
// line-up shows three grey bars, short to tall. Before the answer only; once
// right the cloud writes the sign instead.
export function CompareSketch({ question, size }: { readonly question: Extract<Question, { kind: 'compare' | 'order' }>; readonly size: CloudSize }) {
  if (question.kind === 'order') {
    const n = question.sizes.length;
    const box = pictureBox(n, n, size);
    return (
      <View testID="compare-sketch" style={{ width: box.width, height: box.height }}>
        {question.sizes.map((_, i) => (
          <View key={i} style={[styles.bar, { left: PICTURE_PAD + i * box.cell, top: PICTURE_PAD + (n - 1 - i) * box.cell, width: box.cell - 2, height: (i + 1) * box.cell - 2, borderRadius: box.cell * 0.28 }]} />
        ))}
      </View>
    );
  }
  const a = question.given;
  const longer = question.relation === 'more' || question.relation === 'one_more';
  const shorter = question.relation === 'fewer' || question.relation === 'one_fewer';
  const row = Math.max(1, longer ? a + 1 : shorter ? a - 1 : a);
  const box = pictureBox(Math.max(a, row), 2, size);
  const colors = colorsFor(hueFor(a));
  return (
    <View testID="compare-sketch" style={{ width: box.width, height: box.height }}>
      {Array.from({ length: a }, (_, x) => (
        <View key={`a${x}`} style={[styles.cell, { left: PICTURE_PAD + x * box.cell, top: PICTURE_PAD, width: box.cell - 2, height: box.cell - 2, borderRadius: box.cell * 0.28, backgroundColor: colors.fill, borderColor: colors.edge }]} />
      ))}
      {Array.from({ length: row }, (_, x) => (
        <View key={`b${x}`} testID="compare-sketch-row" style={[styles.cell, styles.ghost, { left: PICTURE_PAD + x * box.cell, top: PICTURE_PAD + box.cell, width: box.cell - 2, height: box.cell - 2, borderRadius: box.cell * 0.28 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: { position: 'absolute', borderWidth: 2 },
  ghost: { borderStyle: 'dashed', borderColor: THEME.inkSoft, backgroundColor: 'rgba(255,255,255,0.5)' },
  bar: { position: 'absolute', backgroundColor: THEME.inkSoft, opacity: 0.55 },
});
