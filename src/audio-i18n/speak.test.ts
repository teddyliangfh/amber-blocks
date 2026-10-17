import { copyKey } from '../content';
import { createSilentVoice, createSynthVoice, createWebVoice, pickVoice, speakKey } from './speak';

interface Spoken {
  readonly text: string;
  readonly lang: string;
  readonly voice: unknown;
  readonly pitch: number;
}

function fakeSynth(voices: ReadonlyArray<{ lang: string; name: string; localService?: boolean }> = []) {
  const spoken: Spoken[] = [];
  let cancels = 0;
  const synth = {
    speak: (u: { text: string; lang: string; rate: number; pitch: number; voice: unknown }) => {
      spoken.push({ text: u.text, lang: u.lang, voice: u.voice, pitch: u.pitch });
    },
    cancel: () => {
      cancels += 1;
      spoken.length = 0;
    },
    getVoices: () => voices,
  };
  class Utterance {
    lang = '';
    rate = 1;
    pitch = 1;
    voice: unknown = null;
    constructor(public text: string) {}
  }
  return { synth, Utterance, spoken, cancels: () => cancels };
}

describe('speak', () => {
  test('AC-17: a key renders the current language with number words', () => {
    const f = fakeSynth();
    const voice = createSynthVoice(f.synth, f.Utterance);
    expect(speakKey(voice, copyKey('feedback.matched.quantity'), 'zh', { n: 4 })).toBe('四，就是 四 块');
    expect(speakKey(voice, copyKey('feedback.matched.quantity'), 'en', { n: 4 }, { interrupt: false })).toBe('four. four blocks');
    expect(f.spoken.map((s) => s.lang)).toEqual(['zh-CN', 'en-US']);
  });

  test('AC-05 / AC-29: prompts interrupt, counting words queue in order', () => {
    const f = fakeSynth();
    const voice = createSynthVoice(f.synth, f.Utterance);
    speakKey(voice, copyKey('prompt.quantity'), 'zh', { n: 3 });
    speakKey(voice, copyKey('number.1'), 'zh', {}, { interrupt: false });
    speakKey(voice, copyKey('number.2'), 'zh', {}, { interrupt: false });
    expect(f.spoken.map((s) => s.text)).toEqual(['拼出 三 块', '一', '二']);
    speakKey(voice, copyKey('hint.not-one-cluster'), 'zh');
    expect(f.cancels()).toBe(2);
    expect(f.spoken.map((s) => s.text)).toEqual(['把分开的积木推到一起']);
    voice.stop();
    expect(f.spoken).toEqual([]);
  });

  // The order macOS Chrome reported on 2026-10-14 (iOS lists the same voices).
  // Taking the first local one spoke Chinese as "Eddy" and English as "Albert".
  const APPLE = [
    ['Albert', 'en-US'], ['Bad News', 'en-US'], ['Daniel', 'en-GB'], ['Eddy (English (United States))', 'en-US'],
    ['Eddy (Chinese (China mainland))', 'zh-CN'], ['Flo (Chinese (China mainland))', 'zh-CN'], ['Grandpa (Chinese (China mainland))', 'zh-CN'],
    ['Junior', 'en-US'], ['Meijia', 'zh-TW'], ['Rocko (Chinese (China mainland))', 'zh-CN'], ['Samantha', 'en-US'],
    ['Shelley (Chinese (China mainland))', 'zh-CN'], ['Sinji', 'zh-HK'], ['Tingting', 'zh-CN'], ['Zarvox', 'en-US'],
  ].map(([name, lang]) => ({ name: name!, lang: lang!, localService: true }));

  test('voice choice: warm female voices, never the novelty or robot ones', () => {
    expect(pickVoice(APPLE, 'zh')?.name).toBe('Tingting');
    expect(pickVoice(APPLE, 'en')?.name).toBe('Samantha');
    // Enhanced downloads and online natural voices win when the device has them; a child voice first.
    expect(pickVoice([...APPLE, { name: 'Tingting (Enhanced)', lang: 'zh-CN', localService: true }], 'zh')?.name).toBe('Tingting (Enhanced)');
    expect(pickVoice([...APPLE, { name: 'Microsoft Ana Online (Natural) - English (United States)', lang: 'en-US', localService: false }], 'en')?.name).toMatch(/Ana/);
    expect(pickVoice([...APPLE, { name: 'Microsoft Xiaoyi Online (Natural) - Chinese (Mainland)', lang: 'zh-CN', localService: false }], 'zh')?.name).toMatch(/Xiaoyi/);
    // Without a preferred voice: another Mandarin voice, never Cantonese, never a novelty voice.
    const noTingting = APPLE.filter((v) => v.name !== 'Tingting');
    expect(pickVoice(noTingting, 'zh')?.name).toBe('Meijia');
    expect(pickVoice(noTingting.filter((v) => v.name !== 'Meijia'), 'zh')).toBeNull();
    // Only novelty voices: no explicit voice, the browser's default for the language speaks.
    expect(pickVoice(APPLE.filter((v) => v.name !== 'Samantha' && v.name !== 'Daniel'), 'en')).toBeNull();
    expect(pickVoice(APPLE.filter((v) => v.name !== 'Samantha'), 'en')?.name).toBe('Daniel');
  });

  test('every utterance gets the chosen voice and a slightly brighter pitch', () => {
    const f = fakeSynth(APPLE);
    const voice = createSynthVoice(f.synth, f.Utterance);
    voice.say('hi', 'en', { interrupt: false });
    voice.say('你好', 'zh', { interrupt: false });
    expect((f.spoken[0]?.voice as { name: string }).name).toBe('Samantha');
    expect((f.spoken[1]?.voice as { name: string }).name).toBe('Tingting');
    expect(f.spoken.every((s) => s.pitch > 1 && s.pitch <= 1.2)).toBe(true);
    // Voices not loaded yet: no explicit voice, the browser picks by language.
    const none = fakeSynth();
    const v2 = createSynthVoice(none.synth, none.Utterance);
    v2.say('x', 'en', { interrupt: false });
    expect(none.spoken[0]?.voice).toBeNull();
  });

  test('a broken synthesizer never throws; silence is supported nowhere', () => {
    const broken = { speak: () => { throw new Error('nope'); }, cancel: () => { throw new Error('nope'); }, getVoices: () => [] };
    class U { lang = ''; rate = 1; pitch = 1; voice: unknown = null; constructor(public text: string) {} }
    const voice = createSynthVoice(broken, U);
    expect(() => voice.say('x', 'zh', { interrupt: true })).not.toThrow();
    expect(() => voice.stop()).not.toThrow();
    expect(voice.isSupported()).toBe(true);
    const silent = createSilentVoice();
    expect(silent.isSupported()).toBe(false);
    expect(() => silent.say('x', 'zh', { interrupt: true })).not.toThrow();
    // jest-expo's jsdom-free environment has no speechSynthesis: the web voice falls back to silence.
    expect(createWebVoice().isSupported()).toBe(false);
  });
});
