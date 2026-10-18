import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Buddy, FONT, Stage, THEME, WorkPicture, cheerFor, colorsFor, pictureOf, showcaseGeometry } from '../blocks-ui';
import type { CheerMove } from '../blocks-ui';
import { CHAPTERS, MAX_NUMBER_WORD, copyKey, format, hueFor } from '../content';
import type { Chapter, CopyKey, NodeId, NodeSpec } from '../content';
import type { BenchState } from '../core';
import { Cloud, SkyCloud } from './Cloud';
import { Icon } from './icons';
import { workWaysApart } from './level-session';
import { labelOf } from './MapScreen';
import { useProgress } from './progress-store';
import { play } from './sound';
import { PillButton, RoundButton } from './ui';
import { say } from './voice';

// The album (2026-10-15 review Q): every stop the child has built right, as
// they last had it, grouped by island. Only what was made is shown: no count
// of how many are left, no empty frames, nothing to collect (PRD §5). A card
// opens the work big on its own mat, where it does its number's move once; the
// number speaks when tapped and never on its own.

const TEXT = {
  zh: { title: '我的作品', empty: '拼对一站，作品就会住到这里', map: '回地图', close: '收起' },
  en: { title: 'My builds', empty: 'Build a stop right and it will live here', map: 'Back to map', close: 'Close' },
} as const;

const GAP = 12;
const MIN_CARD = 140;
const PAD = 20;
// The opened work does its move once the blocks have dropped onto the mat.
export const CHEER_AFTER_MS = 450;
const NO_COUNTS = new Map();
// The opened work's number column (landscape) and number row (portrait: the cloud's height).
const SIDE = 150;
const TOP = 100;

export interface AlbumEntry {
  readonly node: NodeSpec;
  readonly work: BenchState;
}

// The album by island, in map order; an island with nothing in it yet is left out.
export function albumGroups(album: ReadonlyMap<NodeId, BenchState>, chapters: ReadonlyArray<Chapter> = CHAPTERS): ReadonlyArray<{ readonly chapter: Chapter; readonly entries: ReadonlyArray<AlbumEntry> }> {
  return chapters
    .map((chapter) => ({ chapter, entries: chapter.nodes.flatMap((node) => (album.has(node.id) ? [{ node, work: album.get(node.id)! }] : [])) }))
    .filter((g) => g.entries.length > 0);
}

// What the number says when tapped: the sum for a join, else the number.
function spokenOf(node: NodeSpec): { readonly key: CopyKey; readonly params: Readonly<Record<string, number>> } {
  const s = node.spec;
  if (s.kind === 'addition_exact') {
    const [a, b] = s.pairs[0] ?? [0, 0];
    return { key: copyKey('feedback.matched.addition'), params: { a, b, n: a + b } };
  }
  return { key: copyKey(`number.${Math.min(labelOf(node).number, MAX_NUMBER_WORD)}`), params: {} };
}

// The move the stop made when it was solved: its number's, a boss's own (the 8 brick drives).
function cheerOf(node: NodeSpec, work: BenchState): CheerMove {
  const p = pictureOf(work);
  return cheerFor(labelOf(node).number, { boss: node.role === 'boss', shape: node.spec.kind === 'quantity_shape' ? { w: p.cols, h: p.rows } : null });
}

function Card({ entry, width, onOpen }: { readonly entry: AlbumEntry; readonly width: number; readonly onOpen: () => void }) {
  const { label, number } = labelOf(entry.node);
  const colors = colorsFor(hueFor(number));
  const inner = width - 16;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={`album-card-${entry.node.id}`}
      onPress={onOpen}
      onPressIn={() => play('tap')}
      style={({ pressed }) => [styles.card, { width, transform: [{ translateY: pressed ? 3 : 0 }], boxShadow: `0 ${pressed ? 1 : 4}px 0 ${THEME.skyDeep}` }]}>
      <WorkPicture state={entry.work} width={inner} height={Math.round(inner * 0.62)} apart={workWaysApart(entry.node, entry.work)} testID="album-picture" />
      <View style={[styles.tag, { backgroundColor: colors.fill, borderColor: colors.edge }]}>
        <Text style={[styles.tagText, { fontSize: label.length > 2 ? 17 : 21 }]}>{label}</Text>
      </View>
      {entry.node.role === 'boss' ? <Text style={styles.star}>★</Text> : null}
    </Pressable>
  );
}

// One work, big, on its own mat: it drops in, then does its move once.
function Zoom({ entry, onClose, lang }: { readonly entry: AlbumEntry; readonly onClose: () => void; readonly lang: 'zh' | 'en' }) {
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const landscape = win.width > win.height;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      setTick(1);
      play('success');
    }, CHEER_AFTER_MS);
    return () => clearTimeout(t);
  }, []);
  const { label } = labelOf(entry.node);
  const boss = entry.node.role === 'boss';
  const spoken = spokenOf(entry.node);
  // Inside the overlay's padding and the card's (16 + 2 a side), the mat's own 8 above and below.
  const free = { width: win.width - insets.left - insets.right - 24 - 36, height: win.height - insets.top - insets.bottom - 24 - 36 - 16 };
  // Landscape: the number and the close button beside the mat, so nothing leaves a short screen.
  const box = landscape ? { width: Math.min(free.width - SIDE - 16, 460), height: free.height } : { width: Math.min(free.width, 420), height: Math.min(free.height - TOP - 8, 340) };
  const geometry = showcaseGeometry(box.width, box.height, entry.work.bounds);
  const number = (
    <Pressable accessibilityRole="button" accessibilityLabel={label} testID="album-zoom-number" onPress={() => say(lang, spoken.key, spoken.params)}>
      <Cloud small={landscape} tone={boss ? 'boss' : 'solved'}>
        <Text style={[styles.zoomNumber, label.length > 2 ? styles.zoomNumberWide : null]}>{label}</Text>
      </Cloud>
      {boss ? <Text style={styles.zoomStar}>★</Text> : null}
    </Pressable>
  );
  const close = <RoundButton label={<Icon name="close" size={22} />} accessibilityLabel={TEXT[lang].close} onPress={onClose} testID="album-zoom-close" />;
  return (
    <Animated.View entering={FadeIn.duration(140)} style={[styles.overlay, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12, paddingLeft: insets.left + 12, paddingRight: insets.right + 12 }]} testID="album-zoom">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={TEXT[lang].close} testID="album-zoom-backdrop" />
      <View style={[styles.zoomCard, landscape ? styles.zoomCardWide : null]}>
        <View style={landscape ? styles.zoomSide : styles.zoomTop}>
          {number}
          {close}
        </View>
        <View style={{ width: box.width, height: geometry.bench.height + 2 * 8 }} testID="album-zoom-work" pointerEvents="none">
          <View style={{ position: 'absolute', left: 0, right: 0, top: 8, height: geometry.bench.height }}>
            <Stage
              state={entry.work}
              geometry={geometry}
              trayObjects={[]}
              trayHidden
              enabled={false}
              countOrder={NO_COUNTS}
              matched
              mood="happy"
              celebrateTick={tick}
              cheer={cheerOf(entry.node, entry.work)}
              merge
              apart={workWaysApart(entry.node, entry.work)}
              onCommand={() => false}
              onPreview={() => false}
              onTapUnit={() => undefined}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

export function AlbumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const win = useWindowDimensions();
  const { state } = useProgress();
  const [opened, setOpened] = useState<NodeId | null>(null);
  if (state === null) {
    return <View style={[styles.root, { paddingTop: insets.top }]} />;
  }
  const lang = state.language;
  const text = TEXT[lang];
  const groups = albumGroups(state.album);
  const avail = win.width - insets.left - insets.right - 2 * PAD;
  const cols = Math.max(2, Math.floor((avail + GAP) / (MIN_CARD + GAP)));
  const card = Math.floor((avail - (cols - 1) * GAP) / cols);
  const open = opened === null ? undefined : groups.flatMap((g) => g.entries).find((e) => e.node.id === opened);
  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]} testID="album-screen">
      <SkyCloud x={8} y={insets.top + 18} width={58} />
      <SkyCloud x={win.width - 80} y={insets.top + 54} width={44} flip />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.sign}>
          <Icon name="album" size={26} />
          <Text style={styles.signText}>{text.title}</Text>
        </View>
        {groups.length === 0 ? (
          <View style={styles.empty} testID="album-empty">
            <Buddy size={76} colors={colorsFor('n1')} mood="sleepy" blink={false} />
            <Text style={styles.zzz}>z z</Text>
            <Text style={styles.emptyText}>{text.empty}</Text>
          </View>
        ) : (
          groups.map(({ chapter, entries }) => (
            <View key={chapter.id} style={styles.group} testID={`album-group-${chapter.id}`}>
              <View style={styles.islandSign}>
                <Text style={styles.islandText}>{format(chapter.title, lang)}</Text>
              </View>
              <View style={[styles.grid, { width: avail }]}>
                {entries.map((entry) => (
                  <Card key={entry.node.id} entry={entry} width={card} onOpen={() => setOpened(entry.node.id)} />
                ))}
              </View>
            </View>
          ))
        )}
      </ScrollView>
      <View style={[styles.bottomBar, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <PillButton title={text.map} tone="accent" testID="album-map" onPress={() => router.dismissTo('/')} />
      </View>
      {open !== undefined ? <Zoom key={open.node.id} entry={open} lang={lang} onClose={() => setOpened(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: THEME.sky },
  scroll: { alignItems: 'center', paddingHorizontal: PAD, paddingTop: 16, gap: 18 },
  sign: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: THEME.leaf, borderWidth: 3, borderColor: THEME.leafDeep, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 7, boxShadow: `0 4px 0 ${THEME.leafDeep}` },
  signText: { fontSize: 24, fontFamily: FONT.display, color: THEME.ink },
  group: { alignItems: 'center', gap: 12 },
  islandSign: { backgroundColor: THEME.sand, borderWidth: 2, borderColor: THEME.sandDeep, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 5, boxShadow: `0 3px 0 ${THEME.sandDeep}` },
  islandText: { fontSize: 18, fontFamily: FONT.display, color: THEME.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card: { backgroundColor: THEME.white, borderRadius: 20, padding: 8, paddingBottom: 10, alignItems: 'center', gap: 6 },
  tag: { minWidth: 44, height: 34, paddingHorizontal: 10, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  tagText: { fontFamily: FONT.display, color: THEME.faceInk },
  star: { position: 'absolute', left: -6, top: -12, fontSize: 26, color: THEME.amber, transform: [{ rotate: '-18deg' }], fontFamily: FONT.display, textShadowColor: THEME.amberDeep, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
  empty: { alignItems: 'center', gap: 8, paddingTop: 40, maxWidth: 300 },
  zzz: { fontSize: 20, fontFamily: FONT.display, color: THEME.inkSoft, marginTop: -4 },
  emptyText: { fontSize: 17, fontFamily: FONT.body, color: THEME.inkSoft, textAlign: 'center' },
  bottomBar: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(43,54,69,0.38)', alignItems: 'center', justifyContent: 'center' },
  zoomCard: { backgroundColor: THEME.board, borderRadius: 28, borderWidth: 2, borderColor: THEME.sandDeep, padding: 16, alignItems: 'center', gap: 8 },
  zoomCardWide: { flexDirection: 'row', gap: 16 },
  zoomTop: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  zoomSide: { width: SIDE, alignItems: 'center', gap: 12 },
  zoomNumber: { fontSize: 56, lineHeight: 64, fontFamily: FONT.display, color: THEME.ink },
  zoomNumberWide: { fontSize: 38, lineHeight: 46 },
  zoomStar: { position: 'absolute', top: 2, left: -10, fontSize: 28, color: THEME.amber, fontFamily: FONT.display, textShadowColor: THEME.amberDeep, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 },
});
