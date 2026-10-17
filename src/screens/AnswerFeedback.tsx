import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { FONT, LEVEL_CHROME, THEME } from '../blocks-ui';
import { copyKey, format } from '../content';
import type { Lang } from '../content';
import type { AnswerFeedback as Feedback } from './hints';
import { Icon } from './icons';

// One look tells the state without reading: a green disc with a tick is right,
// a white disc with a bulb ringed in amber is "here is a tip", blue is still
// building. The bulb replaced ↻, which also meant "count again" and "play again".
const SYMBOL = { start: '✦', building: '↗', adjust: '💡', success: '✓' } as const;

// The speaker's nudge: it swells and settles twice (up, down, up, down), the
// way a Spotlight ring pulses. No sound and no words come with it.
const NUDGE_SCALE = 1.28;
const NUDGE_STEP_MS = 240;

export function AnswerFeedback({ feedback, lang, onReplay, narrow = false, compact = false, nudge = 0 }: {
  readonly feedback: Feedback;
  readonly lang: Lang;
  readonly onReplay: () => void;
  readonly narrow?: boolean;
  readonly compact?: boolean;
  // Bumped when the card should point at its own help (LevelScreen: a tip left
  // untouched for a while, the first time a stop needs changing).
  readonly nudge?: number;
}) {
  const reduced = useReducedMotion();
  const swell = useSharedValue(1);
  // Only a new nudge pulses: not a remount (rotating the phone) with an old one.
  const seen = useRef(nudge);
  useEffect(() => {
    if (nudge <= seen.current) {
      return;
    }
    seen.current = nudge;
    if (reduced) {
      return;
    }
    swell.set(1);
    swell.set(withRepeat(withTiming(NUDGE_SCALE, { duration: NUDGE_STEP_MS }), 4, true));
    return () => cancelAnimation(swell);
  }, [nudge, reduced, swell]);
  const swellStyle = useAnimatedStyle(() => ({ transform: [{ scale: swell.get() }] }));
  const title = format(feedback.title.key, lang, feedback.title.params);
  const detail = format(feedback.detail.key, lang, feedback.detail.params);
  const listen = format(copyKey('feedback.listen'), lang);
  const ink = feedback.tone === 'success' ? styles.successInk : null;
  const disc = narrow ? 26 : compact ? 36 : 44;
  const symbol = (
    <View testID="feedback-symbol" style={[styles.disc, styles[`${feedback.tone}Disc`], { width: disc, height: disc, borderRadius: disc / 2 }]}>
      <Text style={[styles.symbol, feedback.tone === 'success' ? styles.symbolOnGreen : null, { fontSize: disc * 0.5, lineHeight: disc * 0.62 }]}>{SYMBOL[feedback.tone]}</Text>
    </View>
  );
  // The whole card replays; the speaker is drawn as a button so it reads as one.
  const button = narrow ? 26 : compact ? 34 : 40;
  const speaker = (
    <Animated.View
      testID={nudge > 0 ? `feedback-speaker-nudge-${nudge}` : 'feedback-speaker'}
      style={[styles.speaker, { width: button, height: button, borderRadius: button / 2 }, swellStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no">
      <Icon name="speaker" size={button * 0.62} color={THEME.inkSoft} />
    </Animated.View>
  );
  const titleText = <Text testID="feedback-title" style={[styles.title, narrow || compact ? styles.titleNarrow : null, narrow ? styles.grow : null, ink]}>{title}</Text>;
  const detailText = <Text testID="feedback-detail" style={[styles.detail, narrow || compact ? styles.detailNarrow : null]}>{detail}</Text>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={lang === 'zh' ? `${title}。${detail}。${listen}` : `${title}. ${detail}. ${listen}`}
      accessibilityLiveRegion="polite"
      testID="answer-feedback"
      onPress={onReplay}
      style={({ pressed }) => [styles.card, styles[feedback.tone], compact ? styles.compact : null, narrow ? styles.narrow : null, { transform: [{ translateY: pressed ? 2 : 0 }] }]}>
      {/* A speech bubble's tail, pointing up at the number it talks about. */}
      {narrow ? null : <View style={[styles[feedback.tone], styles.tail, feedback.tone === 'adjust' ? styles.tailOutlined : null]} />}
      {narrow ? (
        // Side column: the symbol stays (state must read without words), the detail gets the full width.
        <>
          <View style={styles.narrowHead}>
            {symbol}
            {titleText}
            {speaker}
          </View>
          {detailText}
        </>
      ) : (
        <>
          {symbol}
          <View style={styles.body}>
            {titleText}
            {detailText}
          </View>
          {speaker}
        </>
      )}
    </Pressable>
  );
}

const TONE_SHADE = { start: THEME.skyDeep, building: THEME.skyDeep, adjust: '#F2C46B', success: THEME.leaf } as const;
const ADJUST_LINE = 3;

const styles = StyleSheet.create({
  // Fixed heights (LEVEL_CHROME) so the stage below never changes size with the wording.
  card: { marginHorizontal: 14, marginBottom: LEVEL_CHROME.regular.feedbackGap, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 8, height: LEVEL_CHROME.regular.feedback },
  start: { backgroundColor: '#F2FAFF', boxShadow: `0 4px 0 ${TONE_SHADE.start}` },
  building: { backgroundColor: '#F2FAFF', boxShadow: `0 4px 0 ${TONE_SHADE.building}` },
  // White with an amber outline: the old pale yellow (#FFF6E0) sat at the 3
  // block's hue and read as "a yellow thing" next to it (2026-10-15 review).
  adjust: { backgroundColor: THEME.white, borderWidth: ADJUST_LINE, borderColor: THEME.amber, boxShadow: `0 4px 0 ${TONE_SHADE.adjust}` },
  success: { backgroundColor: '#EEF9E4', boxShadow: `0 4px 0 ${TONE_SHADE.success}` },
  tail: { position: 'absolute', top: -7, left: '50%', marginLeft: -8, width: 16, height: 16, borderRadius: 3, transform: [{ rotate: '45deg' }], boxShadow: 'none' },
  // On the outlined card the tail carries the outline on its two upper edges only.
  tailOutlined: { top: -7 - ADJUST_LINE, marginLeft: -8 - ADJUST_LINE / 2, borderBottomWidth: 0, borderRightWidth: 0 },
  compact: { height: LEVEL_CHROME.compact.feedback, marginBottom: LEVEL_CHROME.compact.feedbackGap, paddingVertical: 6 },
  narrow: { height: 'auto', marginHorizontal: 0, marginBottom: 0, paddingHorizontal: 6, paddingVertical: 6, minHeight: 54, gap: 3, alignSelf: 'stretch', flexDirection: 'column', alignItems: 'stretch' },
  narrowHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  grow: { flex: 1 },
  body: { flex: 1, gap: 3 },
  disc: { alignItems: 'center', justifyContent: 'center', borderWidth: 3, backgroundColor: THEME.white },
  startDisc: { borderColor: THEME.skyDeep },
  buildingDisc: { borderColor: THEME.skyDeep },
  adjustDisc: { borderColor: THEME.amber },
  successDisc: { borderColor: THEME.leafDeep, backgroundColor: THEME.leafDeep },
  symbol: { fontFamily: FONT.display, color: THEME.ink, textAlign: 'center' },
  symbolOnGreen: { color: THEME.white },
  title: { fontSize: 18, fontFamily: FONT.display, fontWeight: '800', color: THEME.ink },
  titleNarrow: { fontSize: 15, lineHeight: 18 },
  detail: { fontSize: 14, lineHeight: 19, fontFamily: FONT.body, fontWeight: '600', color: THEME.inkSoft },
  detailNarrow: { fontSize: 12, lineHeight: 16 },
  speaker: { alignItems: 'center', justifyContent: 'center', backgroundColor: THEME.white, borderWidth: 2, borderColor: THEME.sandDeep, boxShadow: `0 3px 0 ${THEME.sandDeep}` },
  successInk: { color: '#2F6A24' },
});
