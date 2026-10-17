import { exitFullscreen, isFullscreen, isFullscreenSupported, isIOS, isStandalone, onFullscreenChange, requestFullscreen, toggleFullscreen } from './fullscreen';

function fakeDoc(options: { enabled?: boolean; refuse?: boolean; webkit?: boolean } = {}) {
  const listeners = new Map<string, (() => void)[]>();
  const d: Record<string, unknown> & { fullscreenElement: unknown; webkitFullscreenElement: unknown } = {
    fullscreenElement: null,
    webkitFullscreenElement: null,
    addEventListener: (t: string, cb: () => void) => listeners.set(t, [...(listeners.get(t) ?? []), cb]),
    removeEventListener: (t: string, cb: () => void) => listeners.set(t, (listeners.get(t) ?? []).filter((x) => x !== cb)),
  };
  if (options.webkit) {
    d['webkitFullscreenEnabled'] = options.enabled ?? true;
    d['documentElement'] = { webkitRequestFullscreen: () => { if (options.refuse) throw new Error('no'); d.webkitFullscreenElement = {}; } };
    d['webkitExitFullscreen'] = () => { d.webkitFullscreenElement = null; };
  } else {
    d['fullscreenEnabled'] = options.enabled ?? true;
    d['documentElement'] = { requestFullscreen: async () => { if (options.refuse) throw new Error('no'); d.fullscreenElement = {}; } };
    d['exitFullscreen'] = async () => { d.fullscreenElement = null; };
  }
  return { d, fire: (t: string) => (listeners.get(t) ?? []).forEach((cb) => cb()), count: (t: string) => (listeners.get(t) ?? []).length };
}

describe('fullscreen', () => {
  test('AC-12: without a document nothing is supported and nothing throws', async () => {
    expect(isFullscreenSupported(null)).toBe(false);
    expect(isFullscreen(null)).toBe(false);
    expect(await requestFullscreen(null)).toBe(false);
    expect(await exitFullscreen(null)).toBe(false);
    expect(await toggleFullscreen(null)).toBe(false);
    expect(onFullscreenChange(() => undefined, null)()).toBeUndefined();
    expect(isStandalone(null)).toBe(false);
    expect(isIOS(null)).toBe(false);
  });

  test('AC-11: state follows the document, including webkit-prefixed browsers and refusals', async () => {
    const std = fakeDoc();
    expect(isFullscreenSupported(std.d)).toBe(true);
    expect(await toggleFullscreen(std.d)).toBe(true);
    expect(isFullscreen(std.d)).toBe(true);
    expect(await toggleFullscreen(std.d)).toBe(false);
    const wk = fakeDoc({ webkit: true });
    expect(isFullscreenSupported(wk.d)).toBe(true);
    expect(await requestFullscreen(wk.d)).toBe(true);
    expect(await exitFullscreen(wk.d)).toBe(false);
    const refused = fakeDoc({ refuse: true });
    expect(await requestFullscreen(refused.d)).toBe(false);
    const noApi = { documentElement: {} };
    expect(await requestFullscreen(noApi)).toBe(false);
    expect(isFullscreenSupported({ fullscreenEnabled: false })).toBe(false);
  });

  test('change listeners attach to both event names and detach cleanly', () => {
    const f = fakeDoc();
    let calls = 0;
    const off = onFullscreenChange(() => { calls += 1; }, f.d);
    f.fire('fullscreenchange');
    f.fire('webkitfullscreenchange');
    expect(calls).toBe(2);
    off();
    expect(f.count('fullscreenchange')).toBe(0);
    const bare = onFullscreenChange(() => undefined, {});
    expect(bare()).toBeUndefined();
  });

  test('standalone and iOS detection read the navigator', () => {
    expect(isStandalone({ standalone: true })).toBe(true);
    expect(isStandalone({ standalone: false })).toBe(false);
    expect(isIOS({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' })).toBe(true);
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', maxTouchPoints: 5 })).toBe(true);
    expect(isIOS({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', maxTouchPoints: 0 })).toBe(false);
  });
});
