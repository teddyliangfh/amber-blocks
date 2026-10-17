import { StyleSheet, Text, View } from 'react-native';

import { FONT } from './palette';
import type { BlockColors } from './palette';

// A counted block lights up and carries its counting number, so the child
// can see which blocks are done and the last number is the total.
export function CountMark({ size, n, colors }: { readonly size: number; readonly n: number; readonly colors: BlockColors }) {
  const badge = Math.max(14, Math.round(size * 0.4));
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[StyleSheet.absoluteFill, styles.lit]} />
      <View style={[styles.badge, { width: badge, height: badge, borderRadius: badge / 2, borderColor: colors.deep }]}>
        <Text style={[styles.n, { fontSize: badge * 0.66, lineHeight: badge * 0.9, color: colors.deep }]}>{n}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lit: { backgroundColor: 'rgba(255,255,255,0.28)' },
  badge: { position: 'absolute', right: 0, top: 0, backgroundColor: '#FFFFFF', borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  n: { fontFamily: FONT.display, textAlign: 'center' },
});
