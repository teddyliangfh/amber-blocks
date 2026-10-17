// Progressive fullscreen. Where the Fullscreen API exists (desktop browsers,
// iPad) the state follows real document events; where it does not (iPhone
// Safari) the layout already fills the viewport and the parent area explains
// "add to home screen". Never assumes a request succeeded (AC-11, AC-12).

interface DocLike {
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  fullscreenElement?: unknown;
  webkitFullscreenElement?: unknown;
  documentElement?: {
    requestFullscreen?: () => Promise<void> | void;
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  exitFullscreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
  addEventListener?: (type: string, cb: () => void) => void;
  removeEventListener?: (type: string, cb: () => void) => void;
}

interface NavLike {
  standalone?: boolean;
  userAgent?: string;
  maxTouchPoints?: number;
}

function doc(): DocLike | null {
  const g = globalThis as { document?: DocLike };
  return g.document ?? null;
}

function nav(): NavLike | null {
  const g = globalThis as { navigator?: NavLike };
  return g.navigator ?? null;
}

export function isFullscreenSupported(d: DocLike | null = doc()): boolean {
  if (d === null) {
    return false;
  }
  return Boolean(d.fullscreenEnabled || d.webkitFullscreenEnabled);
}

export function isFullscreen(d: DocLike | null = doc()): boolean {
  if (d === null) {
    return false;
  }
  return Boolean(d.fullscreenElement || d.webkitFullscreenElement);
}

export async function requestFullscreen(d: DocLike | null = doc()): Promise<boolean> {
  const el = d?.documentElement;
  if (d === null || el === undefined) {
    return false;
  }
  try {
    const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
    if (req === undefined) {
      return false;
    }
    await req.call(el);
  } catch {
    // Refused by the browser or the user: stay in the filled layout.
  }
  return isFullscreen(d);
}

export async function exitFullscreen(d: DocLike | null = doc()): Promise<boolean> {
  if (d === null) {
    return false;
  }
  try {
    const exit = d.exitFullscreen ?? d.webkitExitFullscreen;
    if (exit !== undefined) {
      await exit.call(d);
    }
  } catch {
    // ignore
  }
  return isFullscreen(d);
}

export async function toggleFullscreen(d: DocLike | null = doc()): Promise<boolean> {
  return isFullscreen(d) ? exitFullscreen(d) : requestFullscreen(d);
}

export function onFullscreenChange(cb: () => void, d: DocLike | null = doc()): () => void {
  if (d === null || d.addEventListener === undefined) {
    return () => undefined;
  }
  d.addEventListener('fullscreenchange', cb);
  d.addEventListener('webkitfullscreenchange', cb);
  return () => {
    d.removeEventListener?.('fullscreenchange', cb);
    d.removeEventListener?.('webkitfullscreenchange', cb);
  };
}

// Launched from the home screen (iOS) or installed PWA: the browser chrome is already gone.
export function isStandalone(n: NavLike | null = nav()): boolean {
  if (n === null) {
    return false;
  }
  if (n.standalone === true) {
    return true;
  }
  const g = globalThis as { matchMedia?: (q: string) => { matches: boolean } };
  try {
    return g.matchMedia?.('(display-mode: standalone)').matches ?? false;
  } catch {
    return false;
  }
}

export function isIOS(n: NavLike | null = nav()): boolean {
  if (n === null) {
    return false;
  }
  const ua = n.userAgent ?? '';
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && (n.maxTouchPoints ?? 0) > 1);
}
