import { format } from '../content';
import type { CopyKey, Lang } from '../content';

// A voice is anything that can say a sentence in a language. The web voice uses
// the browser's own speech synthesis (offline on iOS Safari and Chrome); native
// gets a silent voice until expo-speech is wired in (D-031).

export interface Voice {
  readonly say: (text: string, lang: Lang, options: { readonly interrupt: boolean }) => void;
  readonly stop: () => void;
  readonly isSupported: () => boolean;
}

export const LANG_TAG: Readonly<Record<Lang, string>> = { zh: 'zh-CN', en: 'en-US' };

interface SynthLike {
  speak(utterance: UtteranceLike): void;
  cancel(): void;
  getVoices(): ReadonlyArray<{ readonly lang: string; readonly localService?: boolean; readonly name: string }>;
}

interface UtteranceLike {
  readonly text: string;
  lang: string;
  rate: number;
  pitch: number;
  voice: unknown;
}

type UtteranceCtor = new (text: string) => UtteranceLike;

type VoiceInfo = ReturnType<SynthLike['getVoices']>[number];

// Warm female and child voices, best first. Apple lists its novelty and
// Eloquence voices ahead of these (zh-CN starts with "Eddy", en-US with
// "Albert"), so taking the first local voice gave a four-year-old a robot.
const PREFERRED: Readonly<Record<Lang, ReadonlyArray<RegExp>>> = {
  zh: [/xiaoyi/i, /xiaoxiao/i, /tingting|婷婷/i, /yu-?shu|语舒/i, /lili|莉莉/i, /google.*(普通话|mandarin)/i, /meijia|美佳/i],
  en: [/\bana\b/i, /jenny/i, /aria/i, /\bava\b/i, /samantha/i, /allison/i, /susan/i, /\bzoe\b/i, /nicky/i, /google us english/i, /karen/i, /moira/i, /tessa/i, /serena/i],
};

// Novelty, robot and old-age voices bundled with Apple systems. Never used,
// even as a fallback: the browser's own default for the language is better.
const AVOID = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|junior|ralph|fred|kathy|princess|bruce|agnes|vicki|victoria|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley)\b/i;

// Mandarin only: a Cantonese voice (zh-HK) reads the same characters in another language.
const FAMILY: Readonly<Record<Lang, ReadonlyArray<string>>> = { zh: ['zh-cn', 'zh-tw', 'zh-sg'], en: ['en-us', 'en-gb', 'en-au', 'en-ie', 'en-ca', 'en-nz'] };

function rank(v: VoiceInfo, lang: Lang): number {
  const tag = v.lang.replace('_', '-').toLowerCase();
  const family = FAMILY[lang].indexOf(tag);
  if (family === -1 || AVOID.test(v.name)) {
    return -1;
  }
  const preferred = PREFERRED[lang].findIndex((re) => re.test(v.name));
  const quality = /premium/i.test(v.name) ? 2 : /enhanced|natural|neural/i.test(v.name) ? 1 : 0;
  // A preferred name beats any region; then the main region, then quality, then on-device.
  return (preferred === -1 ? 0 : 1000 - preferred * 10) + (10 - family) * 5 + quality * 2 + (v.localService === true ? 1 : 0);
}

export function pickVoice(voices: ReadonlyArray<VoiceInfo>, lang: Lang): VoiceInfo | null {
  let best: VoiceInfo | null = null;
  let bestScore = -1;
  for (const v of voices) {
    const score = rank(v, lang);
    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

// Slightly brighter than the voice's natural pitch: friendlier for a young
// child without the chipmunk effect higher values give.
const PITCH = 1.1;

export function createSynthVoice(synth: SynthLike, Utterance: UtteranceCtor): Voice {
  return {
    say: (text, lang, { interrupt }) => {
      try {
        if (interrupt) {
          synth.cancel();
        }
        const u = new Utterance(text);
        u.lang = LANG_TAG[lang];
        u.rate = 0.9;
        u.pitch = PITCH;
        u.voice = pickVoice(synth.getVoices(), lang);
        synth.speak(u);
      } catch {
        // A refused or broken synthesizer must never break play (AC-16).
      }
    },
    stop: () => {
      try {
        synth.cancel();
      } catch {
        // ignore
      }
    },
    isSupported: () => true,
  };
}

export function createSilentVoice(): Voice {
  return { say: () => undefined, stop: () => undefined, isSupported: () => false };
}

// The browser voice when speech synthesis exists, else silence.
export function createWebVoice(): Voice {
  const g = globalThis as { speechSynthesis?: SynthLike; SpeechSynthesisUtterance?: UtteranceCtor };
  if (g.speechSynthesis === undefined || g.SpeechSynthesisUtterance === undefined) {
    return createSilentVoice();
  }
  return createSynthVoice(g.speechSynthesis, g.SpeechSynthesisUtterance);
}

// Prompts and feedback interrupt; counting words queue so they stay in order (AC-29).
export function speakKey(
  voice: Voice,
  key: CopyKey,
  lang: Lang,
  params: Readonly<Record<string, string | number>> = {},
  options: { readonly interrupt: boolean } = { interrupt: true },
): string {
  const text = format(key, lang, params, { numbers: 'word' });
  voice.say(text, lang, options);
  return text;
}
