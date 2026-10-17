import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { THEME } from '../blocks-ui';

// The number to make sits on a cloud in the island's sky: a pill with two
// puffs on top and a hard shadow underneath. Solved turns its shadow green;
// a boss cloud has an amber one. Fits the fixed header (LEVEL_CHROME).
export function Cloud({ small, tone, children }: { readonly small: boolean; readonly tone: 'plain' | 'boss' | 'solved'; readonly children: ReactNode }) {
  const k = small ? 0.8 : 1;
  const bg = tone === 'solved' ? '#F3FBEC' : THEME.cloud;
  const shade = tone === 'solved' ? THEME.leaf : tone === 'boss' ? THEME.amber : THEME.skyDeep;
  return (
    <View style={{ marginTop: 20 * k }}>
      <View style={[styles.puff, { left: 12 * k, top: -14 * k, width: 44 * k, height: 44 * k, borderRadius: 22 * k, backgroundColor: bg }]} />
      <View style={[styles.puff, { right: 14 * k, top: -20 * k, width: 52 * k, height: 52 * k, borderRadius: 26 * k, backgroundColor: bg }]} />
      <View style={[styles.body, { minWidth: 112 * k, height: 80 * k, borderRadius: 40 * k, paddingHorizontal: 22 * k, backgroundColor: bg, boxShadow: `0 ${5 * k}px 0 ${shade}` }]}>{children}</View>
    </View>
  );
}

// Scenery: a small cloud drifting in the sky behind everything. Never touched.
export function SkyCloud({ x, y, width, flip = false }: { readonly x: number; readonly y: number; readonly width: number; readonly flip?: boolean }) {
  const h = width * 0.36;
  return (
    <View pointerEvents="none" style={[styles.sky, { left: x, top: y, width, height: h + width * 0.2, transform: [{ scaleX: flip ? -1 : 1 }] }]}>
      <View style={[styles.skyPuff, { left: width * 0.16, top: 0, width: width * 0.36, height: width * 0.36, borderRadius: width * 0.18 }]} />
      <View style={[styles.skyPuff, { left: width * 0.42, top: width * 0.06, width: width * 0.3, height: width * 0.3, borderRadius: width * 0.15 }]} />
      <View style={[styles.skyPuff, { left: 0, top: width * 0.2, width, height: h, borderRadius: h / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  puff: { position: 'absolute' },
  body: { alignItems: 'center', justifyContent: 'center' },
  sky: { position: 'absolute', opacity: 0.85 },
  skyPuff: { position: 'absolute', backgroundColor: THEME.cloud },
});
