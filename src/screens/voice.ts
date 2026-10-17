import { Platform } from 'react-native';

import { createSilentVoice, createWebVoice, speakKey } from '../audio-i18n';
import type { Voice } from '../audio-i18n';
import type { CopyKey, Lang } from '../content';

// One voice for the whole app. Web: the browser's own synthesizer; native: silent until expo-speech lands (D-031).
export const voice: Voice = Platform.OS === 'web' ? createWebVoice() : createSilentVoice();

export function say(lang: Lang, key: CopyKey, params: Readonly<Record<string, string | number>> = {}, interrupt = true): void {
  speakKey(voice, key, lang, params, { interrupt });
}
