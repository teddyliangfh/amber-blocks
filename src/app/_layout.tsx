import { FontDisplay, useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '../web-shell/global.css';
import { ProgressProvider, useProgress } from '../screens/progress-store';
import { installSoundUnlock } from '../screens/sound';

// The two Fredoka weights the app draws with, required one by one: the
// package's index requires all five, and the export shipped three files nobody
// asked for (2026-10-16 review E-3). `swap`: the rounded fallback stack shows
// at once and Fredoka takes over when it arrives.
const FREDOKA = {
  Fredoka_600SemiBold: { uri: require('@expo-google-fonts/fredoka/600SemiBold/Fredoka_600SemiBold.ttf'), display: FontDisplay.SWAP },
  Fredoka_700Bold: { uri: require('@expo-google-fonts/fredoka/700Bold/Fredoka_700Bold.ttf'), display: FontDisplay.SWAP },
};

const TITLE = 'Amber Blocks';

// The page's name and language (2026-10-16 review I-5: the title was empty and
// the language fixed to Chinese). The language follows the parents' setting.
function DocumentMeta() {
  const { state } = useProgress();
  return (
    <Head>
      <html lang={state?.language === 'en' ? 'en' : 'zh-CN'} />
      <title>{TITLE}</title>
    </Head>
  );
}

export default function RootLayout() {
  useEffect(() => installSoundUnlock(), []);
  // Not awaited: text shows in the fallback rounded stack until Fredoka arrives.
  useFonts(FREDOKA);
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ProgressProvider>
          <DocumentMeta />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#CFE9F7' } }} />
        </ProgressProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#CFE9F7' } });
