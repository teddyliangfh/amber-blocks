# Capability Map: Amber Blocks M2（首个工程竖切片）

日期：2026-10-13  
状态：用户已审（2026-10-13），作为后续所有模块 spec 的索引。模块 id 一经选定不再改名。

关联：[PRD v0.10](../docs/prd.md)、[章节地图与关卡](../docs/level-progression.md)、[可玩切片](../docs/playable-slice.md)、[学习主线](../docs/learning-stages.md)。

## 模块

| 模块 id | 职责 | 依赖 | Spec |
|---|---|---|---|
| `math-core` | 纯 TS 领域层：单位块稳定身份、托盘↔工作台库存守恒、接边/连接簇、整组握把、四种题型判定（quantity / quantity_shape / addition_exact / sum_composition）、按提交粒度的 undo、点数轮次失效规则。零 RN / DOM 依赖 | — | [SPEC-math-core.md](SPEC-math-core.md) |
| `content` | 章节 / 节点 / 题目 schema；seed + contentVersion + nodeId + attemptVariant 的确定性出题；难度包络、干扰项、可解性校验；中英文案与音频共用语义 key | math-core | 待写 |
| `progress` | 地图状态机（未到达 → 可开始 → 作答中 → 已完成）、completedNodeIds 幂等、每站稳定作品、语言偏好；本地持久化接口（AsyncStorage，web 落 localStorage） | content | 待写 |
| `blocks-ui` | RN 跨端渲染：数字伙伴 / 单位块 / 托盘 / 工作台；RNGH Pan + Reanimated 拖放：抓取点跟手、提起阴影、吸附预览、松手提交、取消 / 失焦复位、整组握把。自写，不引入 dnd 库 | math-core | 待写 |
| `audio-i18n` | ~~expo-audio 播放预制 zh / en 短句~~ → M2 用 `speechSynthesis`（D-031）；队列 / 打断 / 失效规则（AC-05、AC-27–29）；首次点击解锁移动端音频；切语言不重建状态 | content | 待写 |
| `screens` | Expo Router 壳：地图页、关卡页（无常驻顶栏、角落菜单）、下一站转场、家长区（语言 / 帮助） | blocks-ui, progress, audio-i18n | 待写 |
| `web-shell` | RN Web 专项：dvh / safe-area / touch-action / overscroll、渐进全屏、可选 PWA manifest、`expo export -p web` 静态产物与 Vercel 托管 | screens | 待写 |

Build order：`math-core` → `content` → `progress` ∥ `blocks-ui` → `audio-i18n` → `screens` → `web-shell`

接口归属：依赖箭头指向的提供方在自己的 spec 里定义契约（例如 `math-core` 的公开 API 在 `SPEC-math-core.md`，`content` 只消费）。

## M2 竖切片验收目标

第一章 3 道普通题 + 转角 Boss + 地图 / 重玩 + 一个 3+4 整组样例 + 中英短语音（默认中文）+ 渐进全屏；在 iPhone 16 Pro Safari 上可玩，Vercel 静态托管可打开。

**状态（2026-10-13）**：七个模块全部实现（`src/core`、`src/content`、`src/progress`、`src/blocks-ui`、`src/audio-i18n`、`src/screens`、`src/web-shell`），`pnpm test:gate` 156 个测试全绿；在内建浏览器 iPhone 视口与静态导出 `dist/` 上验证了五站闭环。剩余两项需用户：真机 Safari 试玩、Vercel 部署。

## 已确认的工程决策（2026-10-13）

| 项 | 决定 |
|---|---|
| 目录 | `/Users/tedliang/Desktop/AI Projects/amber-blocks/`（由 `amber blocks` 改名，去空格） |
| 栈 | 实际安装（2026-10-13，`latest` tag）：Expo SDK 58.0.7、React 19.3.0、React Native 0.88.0-rc.4（SDK 58 模板官方锁定）、React Native Web 0.21.4、Reanimated 4.7.0、Gesture Handler 3.2.1、expo-router 58.0.17、jest-expo 58.0.9、TypeScript 6.0.3；expo-audio 待 `audio-i18n` 模块再装。npm 上没有 SDK 57 tag |
| 包管理器 | pnpm |
| 默认语音语言 | 中文（可切英文） |
| 首次真机 | iPhone 16 Pro，Safari |
| 静态托管 | Vercel |
| 渲染 | 积木用 RN View，不上 Skia / SVG |
| 测试 | 统一 jest-expo；web 拖放流程用 chrome-devtools MCP |
| 屏幕方向 | 竖屏优先，不锁方向 |
| 语音素材 | ~~构建期用 edge-tts 生成静态 mp3~~ → M2 改用浏览器 `speechSynthesis`（D-031，edge-tts 被本机代理证书阻塞）；运行时零网络请求不变 |
| 语言约定 | 代码标识符与注释英文，文档中文 |
| 版本控制 | 助手不执行任何 git 操作；由用户另行处理 |

## 文件约定

- `spec/CAPABILITY-MAP.md`：本文件，模块索引。
- `spec/SPEC-<module-id>.md`：每个模块一份，按 build order 逐个写、逐个审。
- `tasks/plan.md`、`tasks/todo.md`：spec 通过后由 planning-and-task-breakdown 产出。
