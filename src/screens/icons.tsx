import { StyleSheet, View } from 'react-native';

import { THEME } from '../blocks-ui';

// Small drawn icons in the toy style: chunky rounded strokes in the app's ink,
// the same on every platform (the emoji and symbol glyphs they replace changed
// shape and weight from one phone to the next).
export type IconName = 'menu' | 'play' | 'gear' | 'speaker' | 'again' | 'album' | 'close' | 'sandbox' | 'map' | 'tidy' | 'undo' | 'bulb' | 'star' | 'count';

export function Icon({ name, size, color = THEME.ink }: { readonly name: IconName; readonly size: number; readonly color?: string }) {
  const s = size;
  const stroke = Math.max(2.5, s * 0.14);
  switch (name) {
    case 'menu':
      return (
        <View style={[styles.box, { width: s, height: s, justifyContent: 'center', gap: s * 0.13 }]}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ alignSelf: 'center', width: s * 0.62, height: stroke, borderRadius: stroke / 2, backgroundColor: color }} />
          ))}
        </View>
      );
    case 'play': {
      // A triangle from borders, nudged right so it looks centred.
      const h = s * 0.62;
      return (
        <View style={[styles.box, { width: s, height: s }]}>
          <View style={{ marginLeft: s * 0.1, width: 0, height: 0, borderTopWidth: h / 2, borderBottomWidth: h / 2, borderLeftWidth: h * 0.86, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: color, borderRadius: s * 0.04 }} />
        </View>
      );
    }
    case 'gear': {
      const tooth = s * 0.2;
      return (
        <View style={[styles.box, { width: s, height: s }]}>
          {[0, 45, 90, 135].map((deg) => (
            <View key={deg} style={{ position: 'absolute', width: s * 0.84, height: tooth, borderRadius: tooth * 0.3, backgroundColor: color, transform: [{ rotate: `${deg}deg` }] }} />
          ))}
          <View style={{ width: s * 0.62, height: s * 0.62, borderRadius: s * 0.31, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: s * 0.24, height: s * 0.24, borderRadius: s * 0.12, backgroundColor: THEME.white }} />
          </View>
        </View>
      );
    }
    case 'speaker': {
      const wave = (d: number, o: number) => (
        <View style={{ position: 'absolute', left: s * 0.36 - d / 2 + o, top: s / 2 - d / 2, width: d, height: d, borderRadius: d / 2, borderWidth: stroke * 0.8, borderColor: 'transparent', borderRightColor: color }} />
      );
      return (
        <View style={[styles.box, { width: s, height: s, alignItems: 'flex-start' }]}>
          <View style={{ position: 'absolute', left: s * 0.08, top: s * 0.36, width: s * 0.2, height: s * 0.28, borderRadius: s * 0.04, backgroundColor: color }} />
          <View style={{ position: 'absolute', left: s * 0.14, top: s * 0.18, width: 0, height: 0, borderTopWidth: s * 0.32, borderBottomWidth: s * 0.32, borderRightWidth: s * 0.3, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: color }} />
          {wave(s * 0.42, s * 0.12)}
          {wave(s * 0.72, s * 0.12)}
        </View>
      );
    }
    case 'again': {
      // An open ring with an arrowhead: "once more".
      const d = s * 0.66;
      return (
        <View style={[styles.box, { width: s, height: s }]}>
          <View style={{ width: d, height: d, borderRadius: d / 2, borderWidth: stroke, borderColor: color, borderTopColor: 'transparent', transform: [{ rotate: '-30deg' }] }} />
          <View style={{ position: 'absolute', left: s * 0.6, top: s * 0.1, width: 0, height: 0, borderLeftWidth: s * 0.14, borderRightWidth: s * 0.14, borderBottomWidth: s * 0.2, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color, transform: [{ rotate: '110deg' }] }} />
        </View>
      );
    }
    case 'album': {
      // A picture frame with three blocks standing in it: "the things I built".
      const w = s * 0.84;
      const h = s * 0.74;
      const b = s * 0.2;
      const gap = s * 0.04;
      const floor = (h - 2 * stroke) * 0.86;
      const block = (x: number, y: number) => <View style={{ position: 'absolute', left: x, top: y, width: b, height: b, borderRadius: b * 0.28, backgroundColor: color }} />;
      return (
        <View style={[styles.box, { width: s, height: s }]}>
          <View style={{ width: w, height: h, borderRadius: s * 0.16, borderWidth: stroke, borderColor: color }}>
            {block(s * 0.1, floor - b)}
            {block(s * 0.1 + b + gap, floor - b)}
            {block(s * 0.1, floor - 2 * b - gap)}
          </View>
        </View>
      );
    }
    case 'sandbox': {
      // Free play: three blocks stacked any old way, the top one tipped over,
      // and no frame around them (the album's three stand in a frame).
      const b = s * 0.3;
      const gap = s * 0.05;
      const floor = s * 0.84;
      const block = (x: number, y: number, deg = 0) => <View style={{ position: 'absolute', left: x, top: y, width: b, height: b, borderRadius: b * 0.28, backgroundColor: color, transform: [{ rotate: `${deg}deg` }] }} />;
      return (
        <View style={[styles.box, { width: s, height: s }]}>
          {block(s * 0.5 - b - gap / 2, floor - b)}
          {block(s * 0.5 + gap / 2, floor - b)}
          {block(s * 0.5 - b * 0.35, floor - 2 * b - gap * 1.6, 18)}
        </View>
      );
    }
    case 'map': {
      // The map's own marker: a round head on a point, "where I am on the map".
      const d = s * 0.56;
      const tip = s * 0.26;
      return (
        <View style={[styles.box, { width: s, height: s }]}>
          <View style={{ position: 'absolute', top: s * 0.1, width: d, height: d, borderRadius: d / 2, borderWidth: stroke, borderColor: color, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: d * 0.3, height: d * 0.3, borderRadius: d * 0.15, backgroundColor: color }} />
          </View>
          <View style={{ position: 'absolute', top: s * 0.1 + d - stroke * 0.4, width: 0, height: 0, borderLeftWidth: tip * 0.55, borderRightWidth: tip * 0.55, borderTopWidth: tip, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: color }} />
        </View>
      );
    }
    case 'tidy': {
      // Put them all back: an arrow down into an open box.
      const w = s * 0.72;
      const h = s * 0.34;
      const head = s * 0.2;
      return (
        <View style={[styles.box, { width: s, height: s }]}>
          <View style={{ position: 'absolute', top: s * 0.08, width: stroke, height: s * 0.26, borderRadius: stroke / 2, backgroundColor: color }} />
          <View style={{ position: 'absolute', top: s * 0.3, width: 0, height: 0, borderLeftWidth: head * 0.75, borderRightWidth: head * 0.75, borderTopWidth: head, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: color }} />
          <View style={{ position: 'absolute', bottom: s * 0.1, width: w, height: h, borderWidth: stroke, borderTopWidth: 0, borderColor: color, borderBottomLeftRadius: s * 0.12, borderBottomRightRadius: s * 0.12 }} />
        </View>
      );
    }
    case 'undo': {
      // A turn back: a half ring open to the left, its top end pointing left.
      const d = s * 0.58;
      const head = s * 0.24;
      return (
        <View style={[styles.box, { width: s, height: s }]}>
          <View style={{ position: 'absolute', left: s * 0.26, top: s * 0.22, width: d, height: d, borderRadius: d / 2, borderWidth: stroke, borderColor: color, borderLeftColor: 'transparent' }} />
          <View style={{ position: 'absolute', left: s * 0.18, top: s * 0.22 + stroke / 2 - head * 0.5, width: 0, height: 0, borderTopWidth: head / 2, borderBottomWidth: head / 2, borderRightWidth: head * 0.86, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: color }} />
        </View>
      );
    }
    case 'bulb': {
      // A light bulb: "here is a tip" (Phase 20 Q7, the help button and the
      // "needs a change" card; it replaces the 💡 emoji).
      const d = s * 0.56;
      return (
        <View style={[styles.box, { width: s, height: s }]}>
          <View style={{ position: 'absolute', top: s * 0.06, width: d, height: d, borderRadius: d / 2, borderWidth: stroke, borderColor: color }} />
          {/* A little shine inside, then the screw base under the glass. */}
          <View style={{ position: 'absolute', top: s * 0.06 + d * 0.26, left: s * 0.5 - d * 0.14, width: d * 0.14, height: d * 0.3, borderRadius: d * 0.07, backgroundColor: color, transform: [{ rotate: '25deg' }] }} />
          <View style={{ position: 'absolute', top: s * 0.06 + d + stroke * 0.4, width: s * 0.28, height: stroke, borderRadius: stroke / 2, backgroundColor: color }} />
          <View style={{ position: 'absolute', top: s * 0.06 + d + stroke * 1.8, width: s * 0.18, height: stroke, borderRadius: stroke / 2, backgroundColor: color }} />
        </View>
      );
    }
    case 'star': {
      // A five-point star (the island done): five rays turned a fifth of a
      // turn each about the middle, over a disc that fills the centre.
      const ray = s * 0.17;
      const reach = s * 0.48;
      const disc = s * 0.42;
      return (
        <View style={[styles.box, { width: s, height: s }]}>
          {[0, 72, 144, 216, 288].map((deg) => (
            <View key={deg} style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${deg}deg` }] }]}>
              <View style={{ position: 'absolute', left: s / 2 - ray, top: s / 2 - reach, width: 0, height: 0, borderLeftWidth: ray, borderRightWidth: ray, borderBottomWidth: reach, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />
            </View>
          ))}
          <View style={{ width: disc, height: disc, borderRadius: disc / 2, backgroundColor: color }} />
        </View>
      );
    }
    case 'count': {
      // Counting: one finger up under a row of three dots (Phase 20 Q8: "count
      // again" had the same ↻ as "play again").
      const dot = s * 0.15;
      const finger = s * 0.17;
      return (
        <View style={[styles.box, { width: s, height: s }]}>
          {[0.26, 0.52, 0.78].map((x) => (
            <View key={x} style={{ position: 'absolute', left: s * x - dot / 2, top: s * 0.08, width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
          ))}
          <View style={{ position: 'absolute', left: s * 0.26 - finger / 2, top: s * 0.32, width: finger, height: s * 0.42, borderRadius: finger / 2, backgroundColor: color }} />
          <View style={{ position: 'absolute', left: s * 0.14, top: s * 0.58, width: s * 0.44, height: s * 0.34, borderRadius: s * 0.12, backgroundColor: color }} />
        </View>
      );
    }
    case 'close': {
      const bar = (deg: number) => <View style={{ position: 'absolute', width: s * 0.66, height: stroke, borderRadius: stroke / 2, backgroundColor: color, transform: [{ rotate: `${deg}deg` }] }} />;
      return (
        <View style={[styles.box, { width: s, height: s }]}>
          {bar(45)}
          {bar(-45)}
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center' },
});
