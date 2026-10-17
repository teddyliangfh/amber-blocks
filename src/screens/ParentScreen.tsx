import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FONT, THEME } from '../blocks-ui';
import { CHAPTERS, format } from '../content';
import type { Lang, NodeId } from '../content';
import { chapterOf, defaultCurrent, mapOrder } from '../progress';
import { isFullscreen, isFullscreenSupported, isIOS, isStandalone, onFullscreenChange, toggleFullscreen } from '../web-shell/fullscreen';
import { labelOf } from './MapScreen';
import { useProgress } from './progress-store';
import { setSoundMuted, sfx } from './sound';
import { COLORS, PillButton } from './ui';
import { voice } from './voice';

const TEXT = {
  zh: {
    title: '家长区',
    language: '语言',
    zh: '中文',
    en: 'English',
    fullscreen: '全屏',
    exitFullscreen: '退出全屏',
    homeTip: 'iPhone 上：点 Safari 的分享按钮，选"添加到主屏幕"，就能像 App 一样全屏打开。',
    reset: '重置进度',
    confirm: '确定要清空所有进度？作品册也会一起清空。',
    yes: '清空',
    no: '取消',
    undoReset: '撤销清空',
    cleared: '进度已清空。离开家长区之前，还可以撤销。',
    back: '返回',
    startAt: '从哪里开始',
    startAtTip: '只改变"开始"按钮和地图标记的位置，不会把前面的站算作完成；地图上的其他站照常一站一站打开。',
    island: '从{chapter}开始',
    chosen: '现在从 {stop} 开始',
    sounds: '音效',
    soundOn: '音效：开',
    soundOff: '音效：关',
    map: '回地图',
    about: '每一站只做一件事：拼出数量、拼出造型，或把两个伙伴合起来。没有倒计时、没有扣分。',
    storage: '存档',
    saving: '进度会自动保存在这台设备的浏览器里。',
    'read-failed': '读取存档失败（可能是隐私模式或浏览器限制）。本次进度只在这次打开期间有效，不会写入存档。',
    'read-timeout': '读取存档超时。本次进度只在这次打开期间有效，不会写入存档。',
    corrupt: '原来的存档无法读取，已备份原内容并重新开始。',
    repaired: '有几站的存档和当前题库对不上，已重置这些站；其他进度和语言保留。',
    upgraded: '题库更新过，存档已自动升级，完成记录和语言都保留。',
    upgradedStops: '这些站更新过，之前摆的作品放不下了，已收起（完成记录还在），下次进去从头摆：',
    stop: '{chapter} 第 {n} 站',
    'write-failed': '最近一次保存没有成功（可能是隐私模式或存储已满）。游戏可以继续，下一步会再试。',
    'reset-failed': '清空存档时写入失败，请稍后再试。',
    retry: '重新读取存档（会替换本次未保存的进度）',
  },
  en: {
    title: 'Parents',
    language: 'Language',
    zh: '中文',
    en: 'English',
    fullscreen: 'Full screen',
    exitFullscreen: 'Exit full screen',
    homeTip: 'On iPhone: tap the Safari share button and choose "Add to Home Screen" to open it full screen like an app.',
    reset: 'Reset progress',
    confirm: 'Clear all progress? The album is cleared too.',
    yes: 'Clear',
    no: 'Cancel',
    undoReset: 'Undo clear',
    cleared: 'Progress was cleared. You can still undo it until you leave the parents\' area.',
    back: 'Back',
    startAt: 'Where to start',
    startAtTip: 'Moves only the Play button and the map marker. No stop counts as finished, and the other stops still open one after another.',
    island: 'Start at {chapter}',
    chosen: 'Play now starts at {stop}',
    sounds: 'Sounds',
    soundOn: 'Sounds: on',
    soundOff: 'Sounds: off',
    map: 'Back to map',
    about: 'Each stop does one thing: make a number, build a shape, or join two partners. No timers, no penalties.',
    storage: 'Saved progress',
    saving: 'Progress is saved automatically in this browser on this device.',
    'read-failed': 'Saved progress could not be read (private mode or a browser limit). This session plays in memory and will not be saved.',
    'read-timeout': 'Reading saved progress took too long. This session plays in memory and will not be saved.',
    corrupt: 'The old save could not be read. Its contents were backed up and play starts fresh.',
    repaired: 'A few stops did not match the current puzzles and were reset. Other progress and the language are kept.',
    upgraded: 'The puzzles were updated and saved progress was upgraded. Finished stops and the language are kept.',
    upgradedStops: 'These stops were updated and the blocks left there no longer fit, so they were put away (finished stops stay finished); they start fresh: ',
    stop: '{chapter} stop {n}',
    'write-failed': 'The last save did not go through (private mode or full storage). Play continues; the next move tries again.',
    'reset-failed': 'Clearing saved progress failed. Please try again later.',
    retry: 'Read saved progress again (replaces unsaved progress from this session)',
  },
} as const;

// "Number Island stop 10": how a parent finds a stop on the map.
function stopNames(ids: ReadonlyArray<NodeId>, lang: Lang): string {
  const order = mapOrder().map((e) => e.nodeId);
  return [...ids]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((id) => {
      const chapter = chapterOf(id);
      const n = chapter.nodes.findIndex((node) => node.id === id) + 1;
      return TEXT[lang].stop.replace('{chapter}', format(chapter.title, lang)).replace('{n}', String(n));
    })
    .join(lang === 'zh' ? '、' : ', ');
}

// Between the "reset" button and the "clear" button that takes its place, at least this many px.
const CONFIRM_GAP = 60;
// The "reset" pill's height as drawn (13px padding twice, a 26px line, a 2px border twice).
const RESET_HEIGHT = 56;

export function ParentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { state, dispatch, reset, undoReset, health, retryLoad } = useProgress();
  const [confirming, setConfirming] = useState(false);
  // Cleared during this visit: the way back stays here until the parent leaves.
  const [justCleared, setJustCleared] = useState(false);
  const [full, setFull] = useState(isFullscreen);
  const [muted, setMuted] = useState(() => sfx.isMuted());
  useEffect(() => onFullscreenChange(() => setFull(isFullscreen())), []);
  if (state === null) {
    return <View style={[styles.root, { paddingTop: insets.top }]} />;
  }
  const text = TEXT[state.language];
  const web = Platform.OS === 'web';
  const start = defaultCurrent(state);
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}>
        <Text style={styles.title}>{text.title}</Text>
        <Text style={styles.about}>{text.about}</Text>

        <Text style={styles.section}>{text.language}</Text>
        <View style={styles.row}>
          <PillButton title={text.zh} tone={state.language === 'zh' ? 'accent' : 'plain'} testID="lang-zh" onPress={() => { voice.stop(); dispatch({ type: 'setLanguage', language: 'zh' }); }} />
          <PillButton title={text.en} tone={state.language === 'en' ? 'accent' : 'plain'} testID="lang-en" onPress={() => { voice.stop(); dispatch({ type: 'setLanguage', language: 'en' }); }} />
        </View>

        {web && isFullscreenSupported() ? (
          <>
            <Text style={styles.section}>{text.fullscreen}</Text>
            <View style={styles.row}>
              <PillButton title={full ? text.exitFullscreen : text.fullscreen} testID="fullscreen" onPress={() => { void toggleFullscreen(); }} />
            </View>
          </>
        ) : null}
        {web && isIOS() && !isStandalone() ? <Text style={styles.tip}>{text.homeTip}</Text> : null}

        {/* Where play starts (2026-10-15 review M): a whole island or one stop. Only
            the current stop moves; nothing is marked finished. */}
        <Text style={styles.section}>{text.startAt}</Text>
        <Text style={styles.tip}>{text.startAtTip}</Text>
        {CHAPTERS.map((chapter) => (
          <View key={chapter.id} style={styles.chapterBlock}>
            <View style={styles.row}>
              <PillButton title={text.island.replace('{chapter}', format(chapter.title, state.language))} testID={`start-${chapter.id}`} onPress={() => dispatch({ type: 'startAt', nodeId: chapter.nodes[0]!.id })} />
            </View>
            <View style={styles.chips}>
              {chapter.nodes.map((node) => {
                const on = node.id === start;
                return (
                  <Pressable
                    key={node.id}
                    accessibilityRole="button"
                    aria-selected={on}
                    accessibilityLabel={stopNames([node.id], state.language)}
                    testID={`start-${node.id}`}
                    onPress={() => dispatch({ type: 'startAt', nodeId: node.id })}
                    style={[styles.chip, on ? styles.chipOn : null]}>
                    <Text style={[styles.chipText, on ? styles.chipTextOn : null]}>{labelOf(node).label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <Text style={styles.tip} testID="start-chosen">
          {text.chosen.replace('{stop}', stopNames([start], state.language))}
        </Text>

        {/* Moved here from the child's menu (2026-10-15 review K). */}
        <Text style={styles.section}>{text.sounds}</Text>
        <View style={styles.row}>
          <PillButton title={muted ? text.soundOff : text.soundOn} testID="sound" onPress={() => { setSoundMuted(!muted); setMuted(!muted); }} />
        </View>

        <Text style={styles.section}>{text.storage}</Text>
        <Text style={styles.tip} testID="storage-status">
          {health.issue === null ? (health.mode === 'memory' ? text['read-failed'] : text.saving) : text[health.issue]}
        </Text>
        {health.upgraded !== undefined && health.upgraded.length > 0 ? (
          <Text style={styles.tip} testID="storage-upgraded">
            {text.upgradedStops}
            {stopNames(health.upgraded, state.language)}
          </Text>
        ) : null}
        {health.mode === 'memory' ? (
          <View style={[styles.row, { marginTop: 10 }]}>
            <PillButton title={text.retry} testID="storage-retry" onPress={() => { void retryLoad(); }} />
          </View>
        ) : null}

        <Text style={styles.section}>{text.reset}</Text>
        {/* Phase 20 Q10: clearing is the plain button and "cancel" the bright one,
            and both sit under the question, CONFIRM_GAP below where "reset" was,
            so a second tap on "reset" lands on the words, not on "clear". */}
        {confirming ? (
          <View testID="reset-confirm">
            <Text style={styles.confirm}>{text.confirm}</Text>
            <View style={[styles.row, styles.confirmRow]}>
              <PillButton title={text.no} tone="accent" testID="reset-no" onPress={() => setConfirming(false)} />
              <PillButton title={text.yes} testID="reset-yes" onPress={() => { setConfirming(false); setJustCleared(true); void reset(); }} />
            </View>
          </View>
        ) : (
          <View style={styles.row}>
            <PillButton title={text.reset} testID="reset" onPress={() => setConfirming(true)} />
            {justCleared ? <PillButton title={text.undoReset} testID="reset-undo" onPress={() => { if (undoReset()) { setJustCleared(false); } }} /> : null}
          </View>
        )}
        {justCleared && !confirming ? <Text style={styles.tip} testID="reset-cleared">{text.cleared}</Text> : null}

        <View style={[styles.row, { marginTop: 32 }]}>
          <PillButton title={text.back} tone="accent" testID="back" onPress={() => router.back()} />
          <PillButton title={text.map} testID="to-map" onPress={() => { voice.stop(); router.dismissTo('/'); }} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.sky },
  scroll: { paddingHorizontal: 20, paddingTop: 12 },
  title: { fontSize: 30, fontFamily: FONT.display, fontWeight: '800', color: COLORS.ink },
  about: { fontSize: 16, fontFamily: FONT.body, color: COLORS.inkSoft, marginTop: 8, lineHeight: 22 },
  section: { fontSize: 18, fontFamily: FONT.display, fontWeight: '800', color: COLORS.ink, marginTop: 24, marginBottom: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, alignItems: 'center' },
  tip: { fontSize: 15, fontFamily: FONT.body, color: COLORS.inkSoft, marginTop: 12, lineHeight: 21 },
  // One line of words (22px) where the "reset" button was, then the buttons
  // CONFIRM_GAP below that button's bottom edge.
  confirm: { fontSize: 16, lineHeight: 22, fontFamily: FONT.body, color: COLORS.ink, width: '100%' },
  confirmRow: { marginTop: RESET_HEIGHT - 22 + CONFIRM_GAP },
  chapterBlock: { marginTop: 12, gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minWidth: 48, height: 40, paddingHorizontal: 10, borderRadius: 12, borderWidth: 2, borderColor: THEME.sandDeep, backgroundColor: THEME.white, alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: THEME.amber, borderColor: THEME.amberDeep },
  chipText: { fontSize: 16, fontFamily: FONT.display, color: THEME.ink },
  chipTextOn: { color: THEME.ink },
});
