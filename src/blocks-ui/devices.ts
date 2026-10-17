import { LEVEL_CHROME, portraitChrome } from './chrome';

// Stage sizes the level screen hands to computeGeometry on common phones, for
// layout tests. Viewports are CSS px of the visible browser area (address and
// tool bars showing, the worst case); insets are the safe areas the page sees.
// The chrome comes from LEVEL_CHROME, the same numbers LevelScreen lays out:
// portrait = header + feedback card + footer, compact under 700px tall;
// landscape = the side column.

export interface DeviceCase {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly insets?: { readonly top: number; readonly bottom: number; readonly left: number; readonly right: number };
}

export const PHONES: ReadonlyArray<DeviceCase> = [
  { name: 'iPhone SE Safari portrait', width: 375, height: 553 },
  { name: 'iPhone 13 mini Safari portrait', width: 375, height: 629 },
  { name: 'iPhone 16 Pro Safari portrait', width: 402, height: 714 },
  { name: 'iPhone 16 Pro home screen portrait', width: 402, height: 874, insets: { top: 62, bottom: 34, left: 0, right: 0 } },
  { name: 'iPhone 16 Pro Max Safari portrait', width: 440, height: 784 },
  { name: 'Android 360x640 Chrome portrait', width: 360, height: 568 },
  { name: 'Pixel 7 Chrome portrait', width: 412, height: 780 },
  // The browser checks' emulated viewports (whole window, no bars).
  { name: 'Emulated 390x844 portrait', width: 390, height: 844 },
  { name: 'Emulated 360x640 portrait', width: 360, height: 640 },
  { name: 'iPhone SE Safari landscape', width: 667, height: 331 },
  { name: 'iPhone 16 Pro Safari landscape', width: 874, height: 370, insets: { top: 0, bottom: 21, left: 62, right: 62 } },
  { name: 'Android 640x360 Chrome landscape', width: 640, height: 304 },
  { name: 'Pixel 7 Chrome landscape', width: 780, height: 360 },
];

export function isCompact(d: DeviceCase): boolean {
  return d.width <= d.height && d.height < LEVEL_CHROME.compactBelow;
}

export function stageSizeOf(d: DeviceCase): { readonly width: number; readonly height: number } {
  const i = d.insets ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const width = d.width - i.left - i.right;
  const height = d.height - i.top - i.bottom;
  if (d.width > d.height) {
    return { width: width - LEVEL_CHROME.sideColumn, height };
  }
  return { width, height: height - portraitChrome(isCompact(d)) };
}
