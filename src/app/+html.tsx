import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Before the app's code arrives (a cold start on a phone takes seconds): the
// island's sky and the name, in plain CSS, instead of a white page (Phase 20
// Q14). The app's root view, sky-coloured too, covers it as soon as it mounts.
const BOOT_CSS = `
html, body { background-color: #CFE9F7; }
#boot { position: fixed; top: 0; right: 0; bottom: 0; left: 0; z-index: 0; display: flex; align-items: center; justify-content: center; pointer-events: none;
  font: 700 32px ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", system-ui, sans-serif; color: #2B3645; }
#root { position: relative; z-index: 1; }
`;

// The static HTML shell for the web export: a phone-first viewport that covers
// the notch area, home-screen launch metadata and the manifest (AC-14, AC-15).
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Amber Blocks" />
        <meta name="theme-color" content="#CFE9F7" />
        {/* Not for search engines while this is a private test build (Phase 20 Q15).
            Same rule as the X-Robots-Tag header in vercel.json (JSON has no comments):
            delete both when the game goes public. */}
        <meta name="robots" content="noindex, nofollow" />
        <link rel="manifest" href="/manifest.json" />
        {/* The tab icon: Amber, the girl in the amber block (assets/brand/app-icon.png,
            D-098). The .ico (16 / 32 / 48, each scaled from the full-size art) is a
            file in public/, so the export no longer adds this link itself. */}
        <link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />
        <link rel="apple-touch-icon" href="/icon-180.png" />
        {/* The title and the page language come from the root layout (expo-router Head). */}
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: BOOT_CSS }} />
      </head>
      <body>
        <div id="boot" aria-hidden="true">Amber Blocks</div>
        {children}
      </body>
    </html>
  );
}
