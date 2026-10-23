import { Image, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import { useBob, useLean, useNod } from '../blocks-ui';

// The girl in the amber block from the game's icon (D-098), cut out of
// assets/brand/app-icon.png at 3× her largest size.
const ART = require('../../assets/images/amber-girl.png');

// Amber, the one who gives the tips: she sits beside the feedback card so its
// words read as hers. A slow float while she waits, a nod each time a new tip
// comes up (`cue`, null when the card holds no tip); with reduced motion she
// keeps still. Scenery: no touches, nothing for a screen reader.
// `lean`: at a stop's opening she leans towards the cloud and nods at it
// (Phase 23-0), `delay` ms in; (dx, dy) is the way to the cloud.
export function AmberGuide({ size, cue, lean }: { readonly size: number; readonly cue: string | null; readonly lean?: { readonly tick: number; readonly dx: number; readonly dy: number; readonly delay: number } }) {
  const float = useBob(true, 1.5, 2600);
  const nod = useNod(cue);
  const toward = useLean(lean?.tick ?? 0, lean?.dx ?? 0, lean?.dy ?? 0, lean?.delay ?? 0);
  return (
    <Animated.View pointerEvents="none" style={[{ width: size, height: size }, float]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" testID="amber-guide">
      <Animated.View style={[styles.fill, toward]}>
        <Animated.View style={[styles.fill, nod]}>
          <Image source={ART} style={styles.fill} resizeMode="contain" />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // The nod turns about her chin, where she rests on the card.
  fill: { width: '100%', height: '100%', transformOrigin: 'bottom' },
});
