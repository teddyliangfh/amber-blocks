import { useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { CLOUD, Spotlight, THEME } from '../blocks-ui';
import type { CloudSize } from '../blocks-ui';

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

// The level screen's cloud (Phase 23-0, PRD §3.3): the same cloud, sized by
// CLOUD to fit the fixed header (LEVEL_CHROME). The shape picture rides on it
// too, beside the number, and its shadow
// is a shade deeper than the sky's, so the cloud stands off the sky (header-ux
// §1.3: white on #CFE9F7 is 1.26:1). `flash`: deeper still for a moment, "look
// here". `spotlight`: help points at the picture, so the whole cloud lights up.
export function TargetCloud({ size, tone, flash = false, spotlight = false, children }: {
  readonly size: CloudSize;
  readonly tone: 'plain' | 'boss' | 'solved';
  readonly flash?: boolean;
  readonly spotlight?: boolean;
  readonly children: ReactNode;
}) {
  const c = CLOUD[size];
  const k = c.height / CLOUD.regular.height;
  const [body, setBody] = useState<{ width: number; height: number } | null>(null);
  const bg = tone === 'solved' ? '#F3FBEC' : THEME.cloud;
  const shade = tone === 'solved' ? (flash ? THEME.leafDeep : THEME.leaf) : tone === 'boss' ? (flash ? THEME.amberDeep : THEME.amber) : flash ? CLOUD_FLASH : CLOUD_SHADE;
  return (
    <View style={{ marginTop: 16 * k }}>
      <View style={[styles.puff, { left: 12 * k, top: -12 * k, width: 44 * k, height: 44 * k, borderRadius: 22 * k, backgroundColor: bg }]} />
      <View style={[styles.puff, { right: 14 * k, top: -16 * k, width: 52 * k, height: 52 * k, borderRadius: 26 * k, backgroundColor: bg }]} />
      <View
        onLayout={(e) => setBody({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
        testID="cloud-body"
        style={[
          styles.targetBody,
          size === 'side' ? styles.sideBody : { paddingHorizontal: 22 * k },
          { minWidth: c.minWidth, height: c.height, borderRadius: c.height / 2, backgroundColor: bg, boxShadow: `0 ${c.shadow}px 0 ${shade}` },
        ]}>
        {children}
        {/* Until it is measured, the ring takes the cloud's smallest size. */}
        {spotlight ? <Spotlight rect={{ x: 0, y: 0, ...(body ?? { width: c.minWidth, height: c.height }) }} radius={c.height / 2} /> : null}
      </View>
    </View>
  );
}

// A shade deeper than the sky's own (THEME.skyDeep, #A9D5EE), and one deeper
// again for the opening's flash (header-ux §2 A).
const CLOUD_SHADE = '#8FC3E3';
const CLOUD_FLASH = '#6AAAD4';

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
  targetBody: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 },
  // The landscape column is 160px inside: "10" and a 5 × 2 picture just fit.
  sideBody: { paddingHorizontal: 8, gap: 6 },
  sky: { position: 'absolute', opacity: 0.85 },
  skyPuff: { position: 'absolute', backgroundColor: THEME.cloud },
});
