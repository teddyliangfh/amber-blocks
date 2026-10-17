# Spec: web-shell（精简版，D-030 自主推进）

模块 id：`web-shell`。日期：2026-10-13。状态：已实现并在浏览器验证（2026-10-13，Checkpoint 6）；助手自审，边实现边修订。

## 规则

- `app.json`：`web.output = "static"`，`orientation = "default"`（竖屏优先不锁）。
- `src/app/+html.tsx`：`viewport-fit=cover`、`apple-mobile-web-app-capable`、`theme-color`、`manifest.json`（`public/`）。网页标题与 `html lang` 由根布局用 expo-router `Head` 设（"Amber Blocks"，lang 随家长区语言 zh-CN / en，D-066）。
- `public/manifest.json`：`orientation: "any"`（关卡页有完整的横屏布局，不锁方向，D-066）；`icon-512.png` / `icon-180.png` 是真实的 512 / 180 像素（各 < 60 KB；图还是 Expo 模板占位图）。
- 字体：只打包并加载 Fredoka 600 / 700 两份，`font-display: swap`（D-066）。
- `vercel.json` 缓存头（D-066）：`/_expo/static/` 下带哈希的文件 `public, max-age=31536000, immutable`，其他（html、manifest、图标）`no-cache`，两条规则互不重叠。
- `src/web-shell/global.css`：`100dvh`、`overscroll-behavior: none`、禁用长按选择 / 呼出菜单、舞台 `touch-action: none`。
- `src/web-shell/fullscreen.ts`：渐进全屏——支持 Fullscreen API 时按实际事件更新状态（AC-11）；不支持（iPhone Safari）时用铺满布局 + 添加到主屏幕说明（AC-12、AC-14）。
- 产物：`pnpm build:web` = `expo export -p web` → `dist/`，纯静态，可用任意静态服务器打开；Vercel 直接托管 `dist/`。

## 验证

- `fullscreen.test.ts`：无 document 环境下不崩；假 document 下状态随事件变化。
- 浏览器：桌面全屏进出；iPhone 视口布局不被地址栏 / 安全区遮挡；`python3 -m http.server` 起 `dist/` 可玩。
