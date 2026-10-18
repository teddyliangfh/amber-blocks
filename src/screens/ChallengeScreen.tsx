import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { THEME } from '../blocks-ui';
import { nextChallenge } from '../content';
import type { Challenge } from '../content';
import { matchedFeedback } from './hints';
import { Icon } from './icons';
import { LevelPlay } from './LevelScreen';
import type { PlayHost } from './LevelScreen';
import { useProgress } from './progress-store';
import { PillButton, RoundButton } from './ui';
import { voice } from './voice';

// Free play's random puzzle (Phase 21): played like a stop (the cloud, the
// card, help, the hand, counting, the two beats, joining), and it follows
// progress (content/challenge.ts), but nothing is kept: no progress command at
// all, so no album, no unlocking and no change to where the map rests.
// Leaving or reloading drops it; the next visit deals a new one. Free play's
// own mat is untouched.
const TEXT = {
  zh: { more: '再来一题', back: '回自由玩' },
  en: { more: 'One more', back: 'Back to free play' },
} as const;

// A new seed for each puzzle: the content picks nothing at random by itself.
function drawSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

const keepNothing = () => undefined;

export function ChallengeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state } = useProgress();
  const done = state?.completedNodeIds;
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const last = useRef<Challenge | null>(null);
  // Each puzzle is a round of its own (a fresh play, hand and help).
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (done === undefined || last.current !== null) {
      return;
    }
    const first = nextChallenge(done, drawSeed());
    last.current = first;
    setChallenge(first);
  }, [done]);

  // "One more": a new puzzle, never the same kind with the same number.
  const onMore = useCallback(() => {
    if (done === undefined) {
      return;
    }
    voice.stop();
    const next = nextChallenge(done, drawSeed(), last.current);
    last.current = next;
    setChallenge(next);
    setRound((n) => n + 1);
  }, [done]);
  const onBack = useCallback(() => {
    voice.stop();
    router.dismissTo('/sandbox');
  }, [router]);
  // "Play again" starts the same puzzle over (nothing to record).
  const onReplay = useCallback(() => true, []);

  // The static export renders this page before any progress exists: draw nothing.
  if (state === null || challenge === null) {
    return <View style={[styles.root, { paddingTop: insets.top }]} />;
  }
  const text = TEXT[state.language];
  const host: PlayHost = {
    work: null,
    finished: false,
    boss: false,
    entrance: false,
    firstStop: false,
    countToPass: false,
    onOpen: keepNothing,
    onMat: keepNothing,
    onReplay,
    restartable: false,
    // Right: the card says what was built (there is no next stop).
    next: (s) => matchedFeedback(s),
    // Where the row is short of room (English, a landscape side column), the
    // way back is the round free-play icon, as "play again" is beside a long
    // label on a stop (2026-10-16 review L-1): the pills ran off a 375px phone.
    actions: ({ solved, compact, landscape, breathe }) =>
      solved ? (
        <>
          {landscape || state.language === 'en' ? (
            <RoundButton label={<Icon name="sandbox" size={26} />} accessibilityLabel={text.back} onPress={onBack} size={compact ? 44 : 48} testID="challenge-back" />
          ) : (
            <PillButton title={text.back} icon="sandbox" onPress={onBack} compact={compact} testID="challenge-back" />
          )}
          <Animated.View style={breathe}>
            <PillButton title={text.more} icon="dice" tone="accent" onPress={onMore} compact={compact} testID="challenge-more" />
          </Animated.View>
        </>
      ) : null,
    exit: { title: text.back, icon: 'sandbox', testID: 'menu-sandbox', onPress: onBack },
  };
  return <LevelPlay key={round} puzzle={challenge.puzzle} lang={state.language} host={host} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.sky },
});
