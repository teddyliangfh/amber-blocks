// Minimal static server for the exported web build, with the same fallbacks a
// static host (Vercel, see vercel.json) applies: a static route such as /parent,
// /album, /sandbox or /challenge serves its own .html, /play/<id> serves the pre-rendered dynamic
// route (and /island/<id> likewise), anything unknown falls back to index.html.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT ?? 8787);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.map': 'application/json', '.svg': 'image/svg+xml' };

async function fileAt(relative) {
  const path = normalize(join(root, relative));
  if (!path.startsWith(root)) {
    return null;
  }
  try {
    const s = await stat(path);
    return s.isFile() ? path : null;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') {
    pathname = '/index.html';
  }
  let file = (await fileAt(pathname)) ?? (await fileAt(`${pathname}.html`));
  if (file === null && /^\/play\/[^/]+$/.test(pathname)) {
    file = await fileAt('/play/[nodeId].html');
  }
  if (file === null && /^\/island\/[^/]+$/.test(pathname)) {
    file = await fileAt('/island/[chapterId].html');
  }
  if (file === null) {
    file = await fileAt('/index.html');
  }
  if (file === null) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('dist/ is missing; run pnpm build:web first');
    return;
  }
  const body = await readFile(file);
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(body);
}).listen(port, () => {
  console.log(`serving ${root} on http://localhost:${port}`);
});
