import { Platform } from 'react-native';

import { createSilentSfx, createWebSfx } from '../audio-i18n';
import type { Sfx, SfxName } from '../audio-i18n';

// One sound-effect player for the whole app. Web: synthesized with Web Audio;
// native: silent until it gets its own player. The mute switch is a per-device
// convenience in localStorage, outside the progress archive.
export const SFX_MUTED_KEY = 'amber-blocks/sfx-muted';

function readMuted(): boolean {
  try {
    return globalThis.localStorage?.getItem(SFX_MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export const sfx: Sfx = Platform.OS === 'web' ? createWebSfx(readMuted()) : createSilentSfx();

export function play(name: SfxName, step?: number, parts?: ReadonlyArray<number>): void {
  sfx.play(name, step, parts);
}

export function setSoundMuted(muted: boolean): void {
  sfx.setMuted(muted);
  try {
    globalThis.localStorage?.setItem(SFX_MUTED_KEY, muted ? '1' : '0');
  } catch {
    // Private mode: the switch still holds for this visit.
  }
}

// iOS Safari starts audio only from inside a touch, so the first touches of a
// visit wake the player (cheap once it runs). Speech plays with the ringer
// switch on silent; 'playback' lets the sounds do the same (Safari 17+, needs
// a real-device check).
export function installSoundUnlock(): () => void {
  const doc = (globalThis as { document?: Document }).document;
  if (Platform.OS !== 'web' || doc === undefined) {
    return () => undefined;
  }
  try {
    const session = (globalThis as { navigator?: { audioSession?: { type: string } } }).navigator?.audioSession;
    if (session !== undefined) {
      session.type = 'playback';
    }
  } catch {
    // Not offered: the default session.
  }
  const wake = () => sfx.unlock();
  const events = ['touchend', 'pointerup', 'click', 'keydown'] as const;
  for (const e of events) {
    doc.addEventListener(e, wake, { passive: true, capture: true });
  }
  return () => {
    for (const e of events) {
      doc.removeEventListener(e, wake, { capture: true });
    }
  };
}
