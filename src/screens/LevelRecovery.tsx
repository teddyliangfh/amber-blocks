import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONT, THEME } from '../blocks-ui';
import { nodeId as makeNodeId } from '../content';
import { useProgress } from './progress-store';
import { PillButton } from './ui';

const TEXT = {
  zh: { title: '这一站暂时打不开', body: '可以重新开始这一站，已经通过的关卡不会丢。', restart: '重新开始这一站', map: '回地图' },
  en: { title: 'This stop could not open', body: 'You can start this stop again. Finished stops are kept.', restart: 'Start this stop again', map: 'Back to map' },
} as const;

// Shown instead of a broken stop: a stop whose saved ref or work cannot be
// played, or a render error inside the level. Starting the stop again forgets
// only that stop's ref and work; the map and completions stay.
export function LevelRecovery({ nodeId, onRestarted }: { readonly nodeId: string; readonly onRestarted?: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, dispatch } = useProgress();
  const text = TEXT[state?.language ?? 'zh'];
  return (
    <View style={[styles.root, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]} testID="level-recovery">
      <Text style={styles.title}>{text.title}</Text>
      <Text style={styles.body}>{text.body}</Text>
      <View style={styles.row}>
        <PillButton
          title={text.restart}
          tone="accent"
          testID="recovery-restart"
          onPress={() => {
            dispatch({ type: 'resetNode', nodeId: makeNodeId(nodeId) });
            onRestarted?.();
          }}
        />
        <PillButton title={text.map} testID="recovery-map" onPress={() => router.replace('/')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.sky, alignItems: 'center', paddingHorizontal: 24, gap: 14 },
  title: { fontSize: 26, fontFamily: FONT.display, fontWeight: '800', color: THEME.ink, textAlign: 'center' },
  body: { fontSize: 16, color: THEME.inkSoft, textAlign: 'center', lineHeight: 22 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 12 },
});
