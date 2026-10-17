# Implementation Plan: Amber Blocks M2 — 工程初始化 + math-core

日期：2026-10-13  
状态：由 planning-and-task-breakdown 产出，覆盖 [CAPABILITY-MAP](../spec/CAPABILITY-MAP.md) build order 的第一段：工程初始化 → `math-core`。后续模块（`content`、`progress`、`blocks-ui`…）在各自 spec 审过后**追加到本文件**，不另起新 plan。

任务清单见 [todo.md](todo.md)；本文件只放决策、风险、AC 对照。

## Overview

把 [SPEC-math-core.md](../spec/SPEC-math-core.md) 落成 `src/core/` 纯 TS 领域层：单位块稳定身份、托盘↔工作台守恒、簇 / 形状等价、整组握把、四种题型判定、按提交粒度 undo、点数轮次。零 RN / DOM 依赖，jest-expo 全覆盖，覆盖率 ≥ 95%。前置：用 `create-expo-app` 初始化工程（ask first，见 Task 0）。

## Architecture Decisions

- **先初始化 Expo 工程，不先做独立 TS 包**。spec 明确"单应用，monorepo 过度设计"；core 作为 `src/core/` 目录存在，jest-expo 一套测试跑到底。
- **Task 0 只装模板自带依赖**。Reanimated / Gesture Handler / expo-audio 等运行时依赖若模板未带，留到消费它们的模块（`blocks-ui`、`audio-i18n`）spec 审过后再 `expo install`，符合"新增依赖 ask first"。
- **按能力竖切，不按文件横切**。每个任务 = 源文件 + 同目录测试 + 对应 AC，任务结束时 `pnpm test -- src/core` 绿。
- **先命令后判定**。命令层（take / move / return / undo）是所有脏夹具的基础，高风险先做；判定层依赖簇与组，放后。
- **`fast-check` 属性测试单独一个任务**，只覆盖不变量 1–4（守恒），不替代 AC 命名的样例测试。
- **数值只从 `unitIds.length` 来**。任何 `hue` / `label` 参与算术即 bug；Task 10 用 grep 当门禁。
- **17 Boss 不需要三元 `sum_composition`**。17 是第一章 `quantity 17`，10 / 5 / 2 只是 `moveGroup` 的搬运便利（AC-46）；判定仍是 `benchCount === 17`。`allowed` 保持二元组。

## Task List

### Phase 0: 工程初始化（ask first）
- [x] Task 0: 初始化 Expo 工程 + TS strict + jest-expo + 脚本（2026-10-13）

### Checkpoint 0
- [x] `pnpm test`、`pnpm typecheck` 在空工程上通过；`pnpm lint` 引导待开放网络（见环境事实）

### Phase 1: 基础类型与守恒
- [x] Task 1: `ids.ts` + `grid.ts`
- [x] Task 2: `inventory.ts` + `state.ts` + `assertInvariants`
- [x] Task 3: `commands.ts`：take / move / return + undo 栈

### Checkpoint 1
- [x] 守恒脏夹具全绿（2026-10-13）（托盘满 / 空槽复用、拒绝路径引用相等）

### Phase 2: 结构与判定
- [x] Task 4: `clusters.ts` + `shapes.ts`
- [x] Task 5: `judge.ts`：`quantity` + `quantity_shape`
- [x] Task 6: `groups.ts` + `moveGroup` + 合体
- [x] Task 7: `judge.ts`：`addition_exact` + `sum_composition`
- [x] Task 8: `counting.ts`

### Checkpoint 2
- [x] 四种题型脏夹具全绿（2026-10-13）（长条 vs 2×2、L 形镜像 ≠ 旋转、5+2 对 [3,4]、2+2 同组复用）

### Phase 3: 收口
- [x] Task 9: `fast-check` 守恒属性测试
- [x] Task 10: `index.ts` 公开 API + `demo.test.ts` + 覆盖率 / grep 门禁
- [x] Task 11: `takeGroup` / `returnGroup` + `Group.shape`（D-027，2026-10-13）

### Phase 4: content（SPEC-content.md，D-028）
- [x] Task 12: 脚本（`test:content` / `test:gate` / `lint:purity`）+ `ids.ts` + `rng.ts`
- [x] Task 13: `schema.ts` + `copy.ts`（双语 key 表、`format`）
- [x] Task 14: `catalog/`（M2 五站、`CONTENT_VERSION`、`findNode`）+ `envelope.ts`
- [x] Task 15: `material.ts` + `distractors.ts`（hue、`bodyOf` / `handlesFor`、托盘洗牌）
- [x] Task 16: `solution.ts` + `validate.ts` + `generate.ts`（`materialize`）
- [x] Task 17: `index.ts` + `demo.test.ts` + 门禁

### Checkpoint 4（= SPEC-content Success Criteria，2026-10-13 达成）
- [x] `src/content` 覆盖率 ≥ 95%，`tsc --noEmit` 零错误，`pnpm lint:purity` 零命中
- [x] 目录每节点 × variant 0–4 `validate` 通过；`demo.test.ts` 五站全通过
- [x] `SPEC-progress.md` 已审（2026-10-13，D-029）

### Phase 5: progress（SPEC-progress.md，D-029）
- [x] Task 18: 脚本 + `schema.ts` + `unlock.ts`（状态派生、解锁、下一站、章完成度）
- [x] Task 19: `reducer.ts`（六条命令）
- [x] Task 20: `codec.ts` + `migrate.ts` + `store.ts`
- [x] Task 21: `index.ts` + `demo.test.ts` + 门禁

### Checkpoint 5（= SPEC-progress Success Criteria，2026-10-13 达成）
- [x] `src/progress` 覆盖率 98.21% 行 / 97.22% 分支，typecheck / purity 零问题；demo 五站打通（全量 140 个测试）

### Phase 6–9（D-030 自主推进，2026-10-13 完成）
- [x] blocks-ui、audio-i18n、screens、web-shell：精简 spec（`spec/SPEC-*.md`）+ 实现 + 浏览器验证 + 静态导出可打开（Checkpoint 6 = MVP）
- 待用户：真机 iPhone Safari 试玩；Vercel 部署（`vercel.json` 已备）

### Phase 11：实现审查修复（2026-10-14，见 todo.md Phase 11 与 docs/implementation-review-2026-10-14.md）
- [x] 托盘对象固定 + 宽高约束 + 横屏；成功反馈事件；存档读写可靠性与语义校验；整组逐块点数、加法结果、按材料帮助、重新挑战；lint 打通、包管理器固定；jsdom 界面集成测试
- 待验证：真机 Safari / Android（语音首播、地址栏、转屏、手势打断、主屏幕恢复）

### Checkpoint 3（= spec Success Criteria，2026-10-13 达成）
- [x] `src/core` 覆盖率 100% 行 / 98.83% 分支，`tsc --noEmit` 零错误
- [x] `pnpm lint:core-purity` 零命中
- [x] 规则一节每条至少一个同名 AC 测试
- [x] `demo.test.ts` 四站 + 3+4 全 `matched: true`
- [x] `SPEC-content.md` 已审（2026-10-13，D-028）

## AC 对照（spec 承诺覆盖的条目 → 任务）

| AC | 任务 |
|---|---|
| AC-01 总量与真实数量一致 | 5 |
| AC-02 一轮每块最多计一次 | 8 |
| AC-03 取消 / 中断不丢不复制 | 3 |
| AC-04 合并拆分守恒、撤销一致 | 3, 6 |
| AC-20 换色重排不改身份 | 2, 5 |
| AC-21 quantity 不因颜色外形拒绝 | 5 |
| AC-25 取出 / 移动 / 拖回三条主路径 | 3 |
| AC-26 单块一次一身份；整组只提交一次 | 3, 6 |
| AC-27 重排保留点数；集合变化失效 | 8 |
| AC-28 部分计数 vs 总量分离 | 8 |
| AC-30 清空后撤销还原 | 3 |
| AC-33 取消 / 失焦不丢块 | 3 |
| AC-34 拉开子块只移子块 | 3, 4 |
| AC-35 托盘 / 工作台守恒 | 2, 3, 9 |
| AC-37 长条与 2×2 都匹配 4 | 5 |
| AC-38 拖回后匹配立即更新 | 5 |
| AC-39 操作数对应真实身份、合体守恒 | 6, 7 |
| AC-40 单块 / 整组语义不混用 | 6 |
| AC-43 模板单位数 = 数字；平移 / 旋转 / 镜像按配置 | 4, 5 |
| AC-44 2+2 两个不同身份 | 7 |
| AC-45 指定 3+4 与自由 7 分离 | 7 |
| AC-46 17 整组握把、真实 17 单位 | 6（moveGroup）, 10（demo 可选） |
| AC-47 换题不污染 | 3（History 按题）, 10 |

content 模块（Task 12–17）承诺的条目：

| AC | 任务 |
|---|---|
| AC-17 中英版本覆盖同一含义 | 13 |
| AC-20 hue 只用于显示 | 15 |
| AC-43 模板单位数 = 数字；变体放得进 bounds | 14, 16 |
| AC-44 固定 ref 可复现；两个真实组；2+2 两个身份 | 12, 15, 16 |
| AC-45 指定 3+4 与自由 7 分离 | 14, 16 |
| AC-46 17 = 10 / 5 / 2 握把，真实 17 单位 | 15 |
| AC-47 contentVersion 隔离 | 14, 16 |

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| `create-expo-app` 最新模板的目录 / 依赖与 CAPABILITY-MAP 写的版本号不一致 | Med | 按"初始化当日最新稳定版"执行；Task 0 完成后把实际版本回填到 CAPABILITY-MAP 表 |
| jest-expo 对纯 TS 目录的 transform / coverage 配置踩坑（`collectCoverageFrom` 与 `coverageThreshold` 作用域） | Med | Task 0 就配 `src/core/**` 的 95% 阈值并用一个空测试验证门禁生效，不留到 Task 10 |
| L 形镜像与旋转等价判断写错（镜像 L ∉ 4 个旋转） | High | Task 4 夹具显式列出 4 旋转 + 4 镜像旋转共 8 个 cell 集，逐一断言 |
| `return` 的"回原槽位"需要记住来源槽，spec 的 `BenchState` 没存 | Med | Task 3 在 `Unit` 或 bench 条目上加 `homeSlot`，作为 `index.ts` 形状变更提前报告 |
| `undo` 与 `moveGroup` 合体后的 `groups` 并集回退 | Med | History 存整份 `BenchState` 快照（≤ 8 份，状态很小），不做反向命令 |
| fast-check 生成的随机命令序列让失败难复现 | Low | 固定 `seed`，失败时打印 counterexample 并固化为普通 AC 测试 |

## 环境事实（Task 0 执行中发现，2026-10-13）

- 本机公网 npm 被封（403），所有 npm 流量走 Syfe 代理；代理 packument 只列约 999 个最新版本，老版本范围解析失败。为此 `package.json` 保留两个 `pnpm.overrides`：`react-refresh: 0.19.0`（与 React 19.3 配套，仅 dev Fast Refresh 运行时）、`@react-native/normalize-colors: $react-native`（RNW 要 ^0.74.1，钉到 RN 同版本）。锁文件存在后安装只拉 tarball，不再受截断影响。
- `expo lint` 首次引导要装 eslint + eslint-config-expo，其依赖链（`@typescript-eslint/*`、`react-is@^16`）反复被截断。2026-10-14 改为手工装好并提交配置（实现审查要求修好 lint）：`eslint@^9` + `eslint-config-expo@~58.0.4` 为 devDependencies，`eslint.config.js` 按 Expo 文档的 flat config；`pnpm.overrides` 把 `@typescript-eslint/*` 十个包钉到代理里存在的 8.71.1（8.71.2 不在截断后的 packument 里）、`prop-types>react-is` 钉到锁文件里已有的 18.3.1（只在 lint 时用）。代理恢复完整后可以删掉这些 override 重新解析。`array-type` 规则按本项目写法配置（只读 `ReadonlyArray<T>`，可变 `T[]`）。
- 包管理器（2026-10-14）：`package.json` 的 `packageManager: pnpm@10.22.0`；store 用 pnpm 默认（用户目录），不在项目或全局配置里改。沙箱化的执行环境若无权访问默认 store，会在项目里建 `.pnpm-store/` 并报 `ERR_PNPM_UNEXPECTED_STORE`——这是执行环境问题，已把 `.pnpm-store/` 加入 `.gitignore`，不要为它改 store 配置。一次 `pnpm add` 曾卡在解析阶段 40 多分钟无网络活动，停掉重跑（`--reporter=append-only --fetch-timeout=120000`）43 秒完成。
- 测试（2026-10-14）：jest 分两个 project：`logic`（`jest-expo` 预设，`*.test.ts`）与 `web-ui`（`jest-expo/web` + jsdom，`*.test.web.tsx`，`tools/jest-setup-web.js` 补 `matchMedia` / `ResizeObserver`）。界面集成用 `react-dom/client` + `act` 渲染真实组件，没有新增测试库；只加了 `@types/react-dom`。
- 内建浏览器面板（2026-10-14）：面板隐藏时页面不出帧（`requestAnimationFrame` 不触发），`ResizeObserver` / `onLayout` 不回调、截图停在旧画面。需要真实渲染的检查改用 Playwright 无头浏览器（可信鼠标事件，不需要替换 `setPointerCapture`）。
- `pnpm expo install` 在 pnpm 10.22 下失败（Expo CLI 传 `--dev`，pnpm 已不认）；按 Expo 打印的版本手动 `pnpm add -D`。
- 模板侧改动：手工创建 `expo-env.d.ts`（`expo start` 才会生成，内容固定）；`src/components/app-tabs.web.tsx` 剥离一个与 RN 0.88-rc 类型不兼容的 `ref`（上游模板 bug，`screens` 模块实现时该 demo 整体删除）。未搬入：模板 `.git`、`README.md`、`.claude/settings.json`（会重复启用 expo 插件）、`LICENSE`（Expo 版权，许可证由用户定）。
- 留给后续模块的模板配置：`app.json` 的 `web.output` 为 `server`（capability map 要静态导出，`web-shell` 改 `static`）、`orientation` 为 `portrait`（决策是竖屏优先不锁方向，`screens` 改 `default`）。

## Open Questions

- Task 0 的 `create-expo-app` 已获批准并执行（SDK 58）。
- Task 3 的 `homeSlot`：已落为 `BenchState.home: ReadonlyMap<UnitId, number>`，`Unit` 不变。
- ~~待用户决定~~ 已批准并实现为 Task 11（D-027）。原问题：第二章托盘里的整组伙伴无法用现有命令一次搬上工作台。spec 的不变量 3 要求组成员都在工作台，`take` 只搬单块，所以 `3+4` 这类题要么由 UI 发 N 次 `take` + `defineGroup`（违反 AC-26 只提交一次），要么新增原子命令。建议：`Group` 增加 `shape: ReadonlyArray<Cell>`（成员相对偏移），不变量 3 放宽为"成员要么全在托盘要么全在工作台"，新增 `takeGroup { groupId, origin }` / `returnGroup { groupId }` 两条命令。属 `index.ts` 公开 API 变更，按 spec 需先问。
