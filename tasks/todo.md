# Todo: M2 — 工程初始化 + math-core

计划与 AC 对照见 [plan.md](plan.md)。规则来源 [SPEC-math-core.md](../spec/SPEC-math-core.md)。  
通用 Definition of Done：任务内所有测试名以 AC 编号或规则名开头；`pnpm test -- src/core` 与 `pnpm typecheck` 绿；不 import react / expo / DOM；不执行任何 git 命令。

---

## Task 0: 初始化 Expo 工程 + TS strict + jest-expo + 脚本

**Description:** 在项目根目录用 `create-expo-app` 初始化（pnpm），开启 `strict` 与 `noUncheckedIndexedAccess`，接入 jest-expo，配置 `src/core/**` 覆盖率阈值 95%，提供 `test` / `typecheck` / `lint` 脚本。只保留模板自带依赖，不额外 `expo install`。**执行前须用户批准**（spec Ask first）。

**Acceptance criteria:**
- [x] `package.json` 有 `test`（jest）、`typecheck`（`tsc --noEmit`）、`lint` 三个脚本，包管理器 pnpm（另加 `test:core`、`lint:core-purity`）
- [x] `tsconfig.json` 含 `"strict": true`、`"noUncheckedIndexedAccess": true`（另加 `types: ["jest"]`）
- [x] jest 配置 `preset: 'jest-expo'`，`collectCoverageFrom: ['src/core/**/*.ts', '!src/core/**/*.test.ts']`，`coverageThreshold` 对 `src/core` 行 / 分支 ≥ 95；用一个临时空测试验证阈值门禁会使命令失败后删除

**Verification:**
- [x] Tests pass: `pnpm test`（空工程用 `--passWithNoTests` 验证）
- [x] Build succeeds: `pnpm typecheck`
- [x] Manual check: 把实际装上的 Expo SDK / RN / RNW 版本回填到 `spec/CAPABILITY-MAP.md` 的栈表

**Dependencies:** None（但需用户批准）

**Files likely touched:**
- `package.json`、`tsconfig.json`、`jest.config.js`（或 package.json 内 jest 字段）
- `app/`（模板生成，不改）
- `spec/CAPABILITY-MAP.md`（回填版本）

**Estimated scope:** Medium

## Checkpoint 0
- [x] `pnpm test`、`pnpm typecheck` 在空工程通过
- [ ] `pnpm lint`：被 npm 代理截断阻塞（见 plan.md 环境事实），需在可访问公网 npm 的网络上跑一次 `pnpm lint` 完成引导
- [x] 覆盖率门禁被验证过会失败（临时文件 50% → exit 1）

---

## Task 1: `ids.ts` + `grid.ts`

**Description:** 品牌类型 `UnitId` / `GroupId` / `QuestionId` 及工厂；`Cell`、`Bounds`、`inBounds`、4 邻接 `areAdjacent`、`isFree`、`normalize`（平移到最小 x / y 为 0）。

**Acceptance criteria:**
- [x] 品牌类型互不可赋值（用 `// @ts-expect-error` 测试）
- [x] `areAdjacent` 只认共享边；对角返回 false
- [x] `normalize` 对任意偏移的同一 cell 集合返回相同结果（含负坐标）

**Verification:**
- [x] Tests pass: `pnpm test -- src/core`
- [x] Build succeeds: `pnpm typecheck`

**Dependencies:** Task 0

**Files likely touched:**
- `src/core/ids.ts`、`src/core/ids.test.ts`
- `src/core/grid.ts`、`src/core/grid.test.ts`

**Estimated scope:** Small

---

## Task 2: `inventory.ts` + `state.ts` + `assertInvariants`

**Description:** `Unit`、`TraySlot`、`Group`、`BenchState` 类型；`createBenchState({ units, bounds })` 工厂（全部单位初始在托盘）；`assertInvariants(state)` 检查不变量 1–4：每个 UnitId 恰在 tray 或 bench 之一、bench 无重叠且在界内、groups 两两不交且都在 bench、units 集合不变。

**Acceptance criteria:**
- [x] 工厂产出的状态通过 `assertInvariants`
- [x] 手工构造的 4 种违例（双处 / 零处 / 重叠 / 组越出 bench）各自抛出带不变量编号的错误
- [x] `bounds` 为必填，无默认值（类型层面 + 运行时守卫）

**Verification:**
- [x] Tests pass: `pnpm test -- src/core`
- [x] Build succeeds: `pnpm typecheck`

**Dependencies:** Task 1

**Files likely touched:**
- `src/core/inventory.ts`、`src/core/inventory.test.ts`
- `src/core/state.ts`、`src/core/state.test.ts`

**Estimated scope:** Small

---

## Task 3: `commands.ts`：take / move / return + undo 栈

**Description:** `apply(state, cmd)` reducer 处理 `take` / `move` / `return`（`moveGroup` 留 Task 6）；`Result<T>` 拒绝不抛；`History = { state, past[] }`、`push` / `undo`、`MAX_UNDO = 8`；`return` 回原槽，占用则第一个空槽。需要记录来源槽（`homeSlot`），字段位置实现时报用户。

**Acceptance criteria:**
- [x] AC-35：取出 → 放回 → 再取出，槽位与身份守恒；每步后 `assertInvariants`
- [x] AC-03 / AC-33：占格、越界、不在托盘 / 不在工作台 → `{ ok:false }` 且返回的 state 与输入 **引用相等**
- [x] AC-34：`move` 只移指定单块，相邻块位置不变
- [x] AC-30：清空工作台（连续 `return`）后逐步 `undo` 还原块数 / 身份 / 位置；第 9 次 undo 失败（栈上限 8）

**Verification:**
- [x] Tests pass: `pnpm test -- src/core`
- [x] Build succeeds: `pnpm typecheck`

**Dependencies:** Task 2

**Files likely touched:**
- `src/core/commands.ts`、`src/core/commands.test.ts`
- `src/core/inventory.ts`（homeSlot）

**Estimated scope:** Medium

## Checkpoint 1（2026-10-13 达成）
- [x] Task 1–3 测试全绿（30 个），覆盖率 100% 行 / 98.97% 分支
- [x] 拒绝路径引用相等断言存在且通过
- [x] `homeSlot` 落位：`BenchState.home: ReadonlyMap<UnitId, number>`，`Unit` 保持 spec 的 `{ id, hue }`

---

## Task 4: `clusters.ts` + `shapes.ts`

**Description:** `clusters(state)` 按 4 邻接求连通分量（派生，不存储）；`ShapeTemplate` 归一化、`rotate90`、`mirrorX`、`equivalent(a, b, symmetry)`。

**Acceptance criteria:**
- [x] 两块相邻 = 1 簇，对角 = 2 簇，三块 L 形 = 1 簇
- [x] AC-43：3 块转角模板的 4 个旋转在 `rotation=true` 下等价；3 块长条不等价
- [x] 镜像 L 在 `mirror=false` 下**不**等价、`mirror=true` 下等价（显式列出 8 个 cell 集逐一断言）
- [x] `symmetry` 都关时只比平移

**Verification:**
- [x] Tests pass: `pnpm test -- src/core`
- [x] Build succeeds: `pnpm typecheck`

**Dependencies:** Task 2

**Files likely touched:**
- `src/core/clusters.ts`、`src/core/clusters.test.ts`
- `src/core/shapes.ts`、`src/core/shapes.test.ts`

**Estimated scope:** Small

---

## Task 5: `judge.ts`：`quantity` + `quantity_shape`

**Description:** `Question` 联合类型、`Verdict`、`VerdictReason`；`judge(state, q)` 实现前两种题型。`benchCount` 只来自 `state.bench.size`。默认 `symmetry = { rotation: true, mirror: false }`。

**Acceptance criteria:**
- [x] AC-37 / AC-21：4 块长条与 2×2 都匹配 `quantity 4`；不同 hue 结果相同
- [x] AC-43：`quantity_shape 2×2` 只有方阵通过；长条 `matched:false` 但 `benchCount` 仍为 4；工作台有第 5 块多余单位 → 不匹配（已决问题 1）
- [x] AC-38 / AC-01：`return` 一块后再 `judge`，结果立即按新个数更新

**Verification:**
- [x] Tests pass: `pnpm test -- src/core`
- [x] Build succeeds: `pnpm typecheck`

**Dependencies:** Task 3, Task 4

**Files likely touched:**
- `src/core/judge.ts`、`src/core/judge.test.ts`

**Estimated scope:** Small

---

## Task 6: `groups.ts` + `moveGroup` + 合体

**Description:** `Group` 创建 / 查询；`apply` 增加 `moveGroup`（整组平移，任一格被组外单位占或越界 → 整组拒绝）；`merge(state, a, b)` 判断两组按边相邻并返回并集组（`source` 保留来源）。

**Acceptance criteria:**
- [x] AC-26：整组平移一次提交；部分越界 → 拒绝且 state 引用相等
- [x] AC-39 / AC-04：合体后 `unitIds` 为并集、`source` 含两来源、总单位数不变
- [x] AC-40：`move` 作用于组内单块时只移该块，不触发组平移（两种命令语义分离）
- [x] AC-46：10 / 5 / 2 三组各自 `moveGroup` 到相接位置后 `benchCount === 17`

**Verification:**
- [x] Tests pass: `pnpm test -- src/core`
- [x] Build succeeds: `pnpm typecheck`

**Dependencies:** Task 3, Task 4

**Files likely touched:**
- `src/core/groups.ts`、`src/core/groups.test.ts`
- `src/core/commands.ts`、`src/core/commands.test.ts`

**Estimated scope:** Medium

---

## Task 7: `judge.ts`：`addition_exact` + `sum_composition`

**Description:** 在 `judge` 中加入两种加法判定：存在身份不同的两组满足操作数多重集、合体为一个簇、`benchCount === 和`。

**Acceptance criteria:**
- [x] AC-45：`addition_exact [3,4]`：3+4 通过、4+3 通过、5+2 不通过但 `benchCount === 7`
- [x] AC-44：`addition_exact [2,2]`：两个不同 `GroupId` 通过；同一组计两次不通过
- [x] `sum_composition 7, allowed [[3,4],[5,2]]`：3+4 与 5+2 都通过；6+1 不通过
- [x] 两组在工作台但不相接 → 不通过

**Verification:**
- [x] Tests pass: `pnpm test -- src/core`
- [x] Build succeeds: `pnpm typecheck`

**Dependencies:** Task 5, Task 6

**Files likely touched:**
- `src/core/judge.ts`、`src/core/judge.test.ts`

**Estimated scope:** Small

---

## Task 8: `counting.ts`

**Description:** `CountRound { fingerprint, counted }`；`startRound(state)`、`countUnit(round, state, unitId)`、`isRoundValid(round, state)`。`fingerprint = sorted(bench unitIds).join()`。

**Acceptance criteria:**
- [x] AC-02：同一块计两次，`counted.length` 仍为 1
- [x] AC-27：数到第 2 块时 `take` 第 4 块 → 轮次失效，`counted` 为空；单纯 `move` 重排 → 轮次有效、`counted` 不变
- [x] AC-28：`counted.length` 与 `benchCount` 分别可读，互不覆盖

**Verification:**
- [x] Tests pass: `pnpm test -- src/core`
- [x] Build succeeds: `pnpm typecheck`

**Dependencies:** Task 3

**Files likely touched:**
- `src/core/counting.ts`、`src/core/counting.test.ts`

**Estimated scope:** XS

## Checkpoint 2（2026-10-13 达成）
- [x] Task 4–8 全绿（累计 68 个）；四种题型脏夹具都在
- [x] 覆盖率 100% 行 / 98.83% 分支
- 备注：3 块转角是非手性的（镜像 = 某个旋转），镜像语义用 4 块 L / J 验证；合体结果组为派生值 `mergedGroup`，A / B 两组保留在状态中

---

## Task 9: `fast-check` 守恒属性测试

**Description:** 加 `fast-check` devDependency（已批准）。生成随机命令序列（take / move / return / moveGroup，含非法目标），对任意序列断言：每步 `assertInvariants` 通过；拒绝时引用相等；`units` 集合不变；undo 到底后回到初始状态。固定 seed。

**Acceptance criteria:**
- [x] AC-35 / AC-04 属性测试各一条，`numRuns ≥ 200`
- [x] 失败 counterexample 固化为普通 AC 测试（若有）：200 轮 × 2 无反例
- [x] `fast-check` 只出现在 `*.test.ts` 与 devDependencies

**Verification:**
- [x] Tests pass: `pnpm test src/core`
- [x] Build succeeds: `pnpm typecheck`

**Dependencies:** Task 6

**Files likely touched:**
- `src/core/invariants.property.test.ts`
- `package.json`

**Estimated scope:** XS

---

## Task 10: `index.ts` 公开 API + `demo.test.ts` + 门禁

**Description:** `index.ts` 只导出 spec Domain Model 列出的类型与 `createBenchState` / `apply` / `undo` / `judge` / `clusters` / counting 函数；`demo.test.ts` 用纯命令复现四站（1 块、2 块、2×2、转角 Boss）+ 两组 3+4，全部 `matched:true`；grep 门禁脚本。

**Acceptance criteria:**
- [x] 其余 `src/core/*.ts` 不被 `src/core` 之外 import（仅 `index.ts`）
- [x] `demo.test.ts` 五段全部 `matched: true`；每段换题用新 `createBenchState`，旧 History 不复用（AC-47）
- [x] 纯度 grep 零命中，写成 `pnpm lint:core-purity`（原 spec 的裸 `expo` 会命中 `export`，已改为只查 import 来源与整词）

**Verification:**
- [x] Tests pass: `pnpm test:core`（75 个，100% 行 / 98.83% 分支）
- [x] Build succeeds: `pnpm typecheck`
- [x] Manual check: spec "规则"每条有同名测试（对照 plan.md AC 表逐条勾）

**Dependencies:** Task 7, Task 8, Task 9

**Files likely touched:**
- `src/core/index.ts`
- `src/core/demo.test.ts`
- `package.json`

**Estimated scope:** Small

## Task 11: `takeGroup` / `returnGroup`（D-027，用户批准后追加）

**Description:** `Group` 增加 `shape`，不变量 3 放宽为"成员全在托盘或全在工作台"，新增整组取放两条命令，`move` 组内单块即脱组，托盘伙伴成员禁止单块 `take`。

**Acceptance criteria:**
- [x] `takeGroup` 一次落下全组，越界 / 占格整组拒绝；`returnGroup` 一次收回并刷新 shape
- [x] `defineGroup` 支持托盘伙伴（必须给 shape），拆分组拒绝 `split-group`
- [x] 属性测试覆盖新命令；抓到的反例（单块 `take` 托盘伙伴成员）固化为测试，规则写回 spec
- [x] demo 的 3+4 改为托盘 [5, 3, 2, 4] 的真实流程：先错配 5+2 → `groups-mismatch`，收回后 3+4 → 通过

**Verification:**
- [x] Tests pass: `pnpm test:core`（84 个，100% 行 / 99.09% 分支）
- [x] demo 抓到并修复：加法判定曾读取托盘伙伴的工作台格子，现只考虑全在工作台的组
- [x] Build succeeds: `pnpm typecheck`

## Checkpoint 3（spec Success Criteria，2026-10-13 达成）
- [x] 覆盖率 100% 行 / 99.09% 分支，`tsc --noEmit` 零错误
- [x] purity grep 零命中
- [x] AC 对照表全部勾完
- [x] 用户审过后再开 `SPEC-content.md`（已审，D-028）

---

# Phase 4: content（规则来源 [SPEC-content.md](../spec/SPEC-content.md)）

通用 DoD 同上：测试名以 AC 编号或规则名开头；`pnpm test:gate` 与 `pnpm typecheck` 绿；`src/content` 只 import `../core`。

## Task 12: 脚本 + `ids.ts` + `rng.ts`

**Description:** package.json 加 `test:content`、`test:gate`（全量覆盖率门禁，content 目录 95%）、`lint:purity`；品牌 id 与种子 PRNG（fnv1a + mulberry32）。

**Acceptance criteria:**
- [x] 相同 `PuzzleRef` → 相同随机序列；任一字段不同 → 不同种子
- [x] `int(n)` 在 [0, n)，`shuffle` 返回置换且确定
- [x] 固定 ref 的前 5 个 `int(100)` 有明确期望值（回归快照）

**Verification:**
- [x] Tests pass: `pnpm test:gate`
- [x] Build succeeds: `pnpm typecheck`

**Dependencies:** Task 11

**Files likely touched:** `package.json`、`src/content/ids.ts`、`src/content/rng.ts` + tests

**Estimated scope:** Small

## Task 13: `schema.ts` + `copy.ts`

**Description:** spec Domain Model 的类型；双语 key 表（章节标题、提示、反馈、提示语、数词 1–17）与 `format(key, lang, params, { numbers })`。

**Acceptance criteria:**
- [x] AC-17：每个 key 都有 zh / en，占位符集合一致
- [x] `format` 数字参数可按 `digit` / `word` 渲染；缺参或未知 key 抛错

**Verification:**
- [x] Tests pass: `pnpm test:gate`
- [x] Build succeeds: `pnpm typecheck`

**Dependencies:** Task 12

**Files likely touched:** `src/content/schema.ts`、`src/content/copy.ts`、`src/content/copy.test.ts`

**Estimated scope:** Small

## Task 14: `catalog/` + `envelope.ts`

**Description:** M2 五站目录、`CONTENT_VERSION = 1`、`findNode(ref)`；目标池抽取 + 近两站不重复。

**Acceptance criteria:**
- [x] AC-47：`contentVersion` 不符或节点未知 → 抛错
- [x] AC-43：目录里每个 `quantity_shape` 的模板单位数 = 目标数
- [x] AC-45：ch2 n1 是 `addition_exact`，干扰项 [5, 2]
- [x] `pickTarget` 避开最近两站；池 ≤ 2 或候选为空时放宽

**Verification:**
- [x] Tests pass: `pnpm test:gate`
- [x] Build succeeds: `pnpm typecheck`

**Dependencies:** Task 13

**Files likely touched:** `src/content/catalog/*.ts`、`src/content/envelope.ts` + tests

**Estimated scope:** Medium

## Task 15: `material.ts` + `distractors.ts`

**Description:** `hueFor`、`bodyOf`、`handlesFor`、第一章松散材料（目标 + extra）、第二章伙伴材料（解 + 干扰、按 seed 洗牌、与上一 variant 相同则再洗）。

**Acceptance criteria:**
- [x] AC-20：同一站材料 hue 一致，数量只由身份决定
- [x] AC-44：3+4 托盘含 3、4、5、2 四个真实伙伴，`groupSize` = 标签
- [x] AC-46：`handlesFor(17)` = [10, 5, 2]，`partnerMaterial` 产出三组共 17 单位
- [x] variant 0–4 的伙伴顺序至少两种

**Verification:**
- [x] Tests pass: `pnpm test:gate`
- [x] Build succeeds: `pnpm typecheck`

**Dependencies:** Task 14

**Files likely touched:** `src/content/material.ts`、`src/content/distractors.ts` + tests

**Estimated scope:** Medium

## Task 16: `solution.ts` + `validate.ts` + `generate.ts`

**Description:** 参考解（core 命令）、可解性 / 契合度校验、`materialize(ref, recentTargets)`。

**Acceptance criteria:**
- [x] 确定性：相同 ref 两次 `materialize` 深度相等
- [x] 2+2 手工 spec → 两个不同 `GroupId` 的二块组，参考解通过
- [x] 4 块 L 模板 `mirror=false` 的参考解是 L 本身
- [x] 错误路径：`extra = 0`、模板放不进 bounds、干扰项与操作数同尺寸 → 抛错

**Verification:**
- [x] Tests pass: `pnpm test:gate`
- [x] Build succeeds: `pnpm typecheck`

**Dependencies:** Task 15

**Files likely touched:** `src/content/solution.ts`、`src/content/validate.ts`、`src/content/generate.ts` + tests

**Estimated scope:** Medium

## Task 17: `index.ts` + `demo.test.ts` + 门禁

**Description:** 公开 API；demo 对 M2 五站 `materialize` → 跑参考解 → `judge` 全通过；ch1 n4 是 boss。

**Acceptance criteria:**
- [x] 目录每节点 × variant 0–4 `validate` 通过
- [x] `src/content` 之外不 import 其内部文件
- [x] `pnpm lint:purity` 零命中

**Verification:**
- [x] Tests pass: `pnpm test:gate`
- [x] Build succeeds: `pnpm typecheck`

**Dependencies:** Task 16

**Files likely touched:** `src/content/index.ts`、`src/content/demo.test.ts`

**Estimated scope:** Small

## Checkpoint 4（SPEC-content Success Criteria，2026-10-13 达成）
- 数据：content 39 个测试，全量 123 个；两目录均过 95% 阈值
- [x] `src/content` 覆盖率 ≥ 95%，`tsc --noEmit` 零错误，`pnpm lint:purity` 零命中
- [x] `demo.test.ts` 五站全通过
- [x] `SPEC-progress.md` 已起草（2026-10-13），待用户审


---

# Phase 5: progress（规则来源 [SPEC-progress.md](../spec/SPEC-progress.md)，2026-10-13 完成）

- [x] Task 18–21：`schema` / `unlock` / `reducer` / `codec` / `migrate` / `store` / `index` + 17 个测试
- [x] Checkpoint 5：覆盖率 98.21% 行 / 97.22% 分支；`pnpm test:gate` 140 全绿；typecheck / purity 零问题
- 备注：Phase 6 起按 D-030 由助手自主推进，精简 spec + 浏览器验证

# Phase 6–9: blocks-ui / audio-i18n / screens / web-shell（D-030）

- [x] Task 22: 清理模板 demo，建立应用壳（GestureHandlerRootView、SafeAreaProvider、ProgressProvider、Stack）
- [x] Task 23: blocks-ui 纯布局层（`layout.ts`：几何、cell ↔ px、落点钳位、托盘固定槽位排布）+ 测试
- [x] Task 24: blocks-ui 组件（`UnitView` / `PartnerView` / `Stage`，`use-draggable` = RNGH Pan + Tap 互斥 + Reanimated；位移按按下点绝对坐标自算，D-032）
- [x] Task 25: 关卡页（大目标 / 造型参考 / 舞台 / 角落菜单：继续、帮助、撤销、语言、全屏、地图 / 下一站 / 点数）
- [x] Task 26: 地图页 + 家长区（语言、全屏、添加到主屏幕说明、重置二次确认）
- [x] Task 27: audio-i18n（`speechSynthesis`，提示打断、数词排队、切语言先停；D-031）
- [x] Task 28: web-shell（`web.output = static`、`+html.tsx`、`global.css`、`fullscreen.ts`、`public/manifest.json`、`vercel.json`、`tools/serve-dist.mjs`）
- [x] Task 29: 浏览器验证（iPhone 视口 375×812：五站闭环、错配 5+2 帮助语、收回、合体、重玩显示旧作品、刷新恢复、切英文；静态 `dist/` 新 origin 从零走通第一站，无控制台错误）
- [x] Checkpoint 6（MVP，2026-10-13 达成）：四站 + 3+4 手机视口可玩，中英语音，渐进全屏（支持时），`dist/` 可静态打开
- 未做 / 已知限制：真机 iPhone 16 Pro Safari 未验证（需用户）；Vercel 未部署（需用户账号）；原生端语音静音；`pnpm lint` 仍需开放网络引导一次；内建浏览器的拖拽工具无中间 move，验证用脚本派发 pointer 事件

# Phase 10: 更多关卡 + 美化（2026-10-13，用户要求，按 puzzle / game-feel / frontend-design / animate-expo skills）

- [x] Task 30: 目录扩到 19 站（D-033）；`quantity.handles`、`handleMaterial`、新模板（1×4、2×3、2×4）；测试 158 全绿
- [x] Task 31: 托盘两行换行（`layoutTray`），空槽虚线，固定槽位
- [x] Task 32: 视觉身份：天空 / 沙 / 琥珀调色（`THEME`），工作台木板 + 点阵，玩具箱托盘，数字徽章，提示文字行
- [x] Task 33: 手感：匹配时积木依次弹跳 + 数字 pop（`useHop` / `usePop`），拖起倾斜 3°，点数脉冲，按钮按压缩放，下一站 / 菜单入场动画，笑脸；全部 UI 线程，尊重 reduce motion
- [x] Task 34: 地图：蜿蜒路径 + 虚线轨迹，岛屿卡片 + 路标进度，Boss 大圆 + 星，当前站上下浮动标记
- [x] Task 35: 浏览器验证：地图两岛、17 握把关、自由和 5 Boss、6 块两行托盘拖放与庆祝；无控制台错误
- 已知：celebration 的弹跳在截图里难以定格，需真机看手感；地图岛屿高度按站数固定，站多时可滚动

# Phase 11: 实现审查修复（2026-10-14，依据 [implementation-review-2026-10-14](../docs/implementation-review-2026-10-14.md)）

后续反馈优化（2026-10-14，用户实际试玩要求）：

- [x] 数字目标下增加双语可见反馈卡：开题引导、少块差额、多块差额、形状 / 连接 / 伙伴纠正、勾号与“拼对啦！”；点击可重听。
- [x] 加法选错伙伴即使数量不足也提示换伙伴，避免单纯鼓励继续添加。
- [x] 纠正提示稳定 900ms 后自动播报，改对取消旧提示；正常拼搭不连续报错，手动重听不重复自动提示。
- [x] 新增反馈规则与界面集成回归；34 suite / 439 tests 通过，lint、typecheck、web export 通过。
- [x] 浏览器实际验证 3+4 的选错伙伴 → 归还 → 合体成功，检查手机尺寸的反馈与操作区。

保留 core / content / progress / blocks-ui / screens 分层，不重写；手机网页优先，原生语音不在本轮。

## 第一阶段：托盘与成功反馈

- [x] Task 36（审查 P1）：托盘对象身份固定。`blocks-ui/tray.ts`：`trayObjects(puzzle.initial)` 在开题时决定对象（每个伙伴一个、每个松散块一个），`planTray` 一次排布，`trayView` 只按当前状态改占用；整组搬出留轮廓，成员槽不再变成独立空槽。`Stage` 改用它。
- [x] Task 37（审查 P2）：`layoutTray` 宽高同时约束（每行按本行最高、计行距与内边距），对象永不溢出；`computeGeometry` 接收托盘对象，托盘占剩余空间，在"托盘在下 / 托盘在右"间选格子更大的排法，托盘方块尽量 ≥ 40px；关卡页横屏改为左侧竖栏。
- [x] Task 38（审查 P2）：历史完成 / 当前答案 / 成功反馈分离。`commitCommand` 返回 `solvedNow`（错 → 对的那一次提交）；绿色目标、表情、成功按钮只看当前 verdict；重排、撤销、恢复不再庆祝；进站时已对的作品补记完成但不庆祝。
- 测试：`tray.test.ts`（10 / 12 / 17 + 第二章 7 站：搬出 / 放回 / 参考解后位置与比例不变；审查复现 n10 的 4 个对象）、`layout.test.ts`（11 种手机竖 / 横屏 × 19 站 × 3 variant：全部在舞台与托盘内、不重叠、格子与托盘方块 ≥ 32px）、`level-session.test.ts`（成功事件）。

## 第二阶段：存档可靠性

- [x] Task 39（审查 P2）：`progress/store.ts` `loadArchive`（读失败 → 内存模式且不写；坏头部 → 备份 + 新档；修复 → 备份 + 保留其余）、`createSaver`（单一顺序写入者，合并、失败上报不 reject、reset 协调）；`ProgressProvider` 改用它，读取 6 秒超时进入内存模式；存档状态只在家长区显示，内存模式可"重新读取存档"。
- [x] Task 40（审查 P2）：存档语义校验。`decodeArchive` 局部修复（坏站 / 坏作品 / 坏语言不再连累整档）；`sanitize` 校验 key 与 `ref.nodeId`、`ref.chapterId`、`ref.contentVersion`、`attemptVariant`、`materialize` 可建、作品材料属于本题；`resetNode` 命令 + `LevelRecovery` 界面 + 路由 `ErrorBoundary`。
- 测试：`reliability.test.ts`、`store.test.ts`（局部修复）、`progress-store.test.web.tsx`（jsdom：读 reject / 读超时 / 写失败恢复且无未处理拒绝 / reset 与乱序在途写入）。

## 第三阶段：教学体验

- [x] Task 41：整组内逐块点数。伙伴仍整体拖动；点伙伴里的某块按位置换算格子计数；被数到的块点亮并显示序号；Tap `maxDistance 6` 与 Pan `minDistance 6` 互斥，抬起放大推迟到 Pan 激活；数满后左上角"↻ 再数一遍"。
- [x] Task 42：加法成功后目标显示 `a + b = n`（自由和显示实际两伙伴），伙伴保留各自颜色与标签，可逐块点数确认。
- [x] Task 43：帮助按材料与当前状态选句（`screens/hints.ts`）；自由和提示与帮助改为"找两个伙伴，拼出 n"。
- [x] Task 44：重新挑战。成功后"再玩一次"、已完成站菜单"重新挑战"→ `replay`；从地图进站仍是继续作品。
- 测试：`hints.test.ts`、`level-session.test.ts`（伙伴内点数、再数一遍、加法结果）、`LevelScreen.test.web.tsx`（真实关卡页 + Provider，只替换手势层）。

## 工程

- [x] Task 45：lint 与包管理器（结果见下方 Checkpoint 11）。
- [x] Task 46：README、spec（blocks-ui / screens / progress / content）、本文件同步当前实现。

## 浏览器验证方法（内建浏览器，dev server `pnpm expo start --web`）

- 视口：390×844 竖屏、375×553（iPhone SE Safari 可见区）、844×390 与 667×331 横屏。
- 拖放：内建浏览器的拖拽工具没有中间 move，RNGH 需要真实的 pointer 序列；在页面里用脚本向目标元素派发 `pointerdown` → 12 次 `pointermove` → `pointerup`（`pointerType: 'touch'`）。合成 pointer 不能被浏览器捕获，测试页内把 `Element.prototype.setPointerCapture / releasePointerCapture` 换成空函数——只在测试页，应用代码未改。点数用 `pointerdown` → `pointerup`。
- 语音：测试页把 `speechSynthesis.speak` 换成记录函数，检查说了什么、说了几次。
- 截图：内建浏览器面板在 DOM 更新后有时不重绘，截图前把视口高度改 1px 强制重绘；元素状态以 DOM / localStorage 为准。

## Checkpoint 11（2026-10-14）

实际运行的检查：

- [x] `pnpm lint`（`expo lint`，eslint 9 + eslint-config-expo flat config）：0 error、0 warning。修掉的真问题：`use-draggable.ts` 在 React Compiler 下直接写 Reanimated `.value` 与渲染期读 ref（改为 `get()/set()`、去掉"最新 options ref"）；`ParentScreen` effect 内同步 setState。
- [x] `pnpm typecheck`：通过。
- [x] `pnpm test:gate`：34 个 suite、436 个测试全过（审查时 29 / 158）；core 100% 行 / 99.09% 分支，content 97.74% / 95.2%，progress 98.22% / 96.41%（门禁 95%）。新增统计 blocks-ui `tray.ts` / `layout.ts`（97.57% 行），screens 含 `LevelScreen.tsx` / `progress-store.tsx` / `hints.ts`（86.39% 行，无门禁，如实报告）。
- [x] `pnpm lint:purity`：零命中。
- [x] `pnpm build:web`：静态导出成功（5 个静态路由）。
- [x] 浏览器（dev server，内建浏览器 390×844 / 375×553 / 844×390 / 667×331，方法见上）：17 站托盘四个对象在内；ch1-n10 搬出一个 5 留轮廓、另一个 5 位置不变、放回与开题一致；两个 5 拼出 10 成功语音只说一次，重排不再说；伙伴内逐块点 1–10、"一共 十 块"、第 11 次点击忽略、"再数一遍"；"再玩一次"清空作品、保留完成与后续解锁；切英文保留作品；2 + 2 显示 `2 + 2 = 4` 并逐块数 4；横屏侧栏与侧边托盘；`localStorage.setItem` 抛错时继续游玩、无未处理拒绝、家长区显示"最近一次保存没有成功"；审查复现（某站 `ref.contentVersion = 999`）→ 家长区显示"已重置这些站"、原串备份、该站重新进入可玩、完成数不变。
- [x] 修掉浏览器验证发现的问题：菜单关闭后第一次点按丢失（手势 `enabled` 随菜单切换；改为菜单遮罩挡触摸、手势常开）；托盘轮廓对比度太低；横屏时菜单按钮压住托盘、`3 + 4 = 7` 换行、成功按钮被挤出侧栏。
- [x] 静态产物（`pnpm serve:web`，Playwright 无头 Chromium，新 context、可信鼠标事件）：地图 19 站、第一站拖放成功一次、重排不重复、刷新恢复作品与对的状态，控制台无错误。

未验证 / 遗留：

- 真机 iPhone Safari / Android Chrome：首次语音播放（用户手势解锁）、地址栏伸缩引起的舞台尺寸变化、横竖屏实时切换、拖拽中被系统手势打断、添加到主屏幕后的恢复——都没有在真机上验证，不能视为通过。横竖屏只在模拟视口里分别加载过，没测"玩到一半转屏"。
- 内建浏览器里的拖放是脚本派发的合成 pointer 事件（替换了 `setPointerCapture`），不等同于真实手指；Playwright 用的是鼠标而非触摸。
- 存储 reset 竞争与乱序写入只在单元 / jsdom 测试里用可控存储验证；浏览器 localStorage 是同步的，复现不了原生异步适配器的乱序。
- 未部署 Vercel。
- 审查的产品建议 4（帮助入口更显眼）、6（地图滚到当前站）、7（家长选章节）本轮未做。

# Phase 12: 答题反馈复审与优化（2026-10-14，Claude 接手 review Codex 的反馈卡改动）

## 复审发现（按优先级）

- P1 横屏菜单超出视口（已知）：667×331 已完成站 7 项菜单"继续"y=-61、"地图"y=337。→ 已修。
- P1 短横屏造型题答对后"下一站"出屏：667×331 ch1-n3 实测 next y=312、高 55（视口 331）。→ 已修。
- P1 配音选到机器人 / 特效声音：`pickVoice` 取第一个本地声音，macOS / iOS 上 zh-CN 是 "Eddy"、en-US 是 "Albert"（实测 Chromium 选中 Eddy）。→ 已修。
- P1 握把题（10 / 12 / 17）托盘伙伴正好是答案，"全搬过去"必过、没有选择（用户试玩指出）；备用单块是 10 的近白色，像空槽。→ 已修。
- P2 纠正语音打断点数：900ms 计时只在答案变化时重启，点数中计时到点会 `cancel()` 掉排队的数词；纠正用 interrupt。→ 已修。
- P2 数量题死路提示：10 站 5 + 两块单块 = 7 时显示蓝色"还差 3 块"、不播报，帮助句"换一个伙伴"无效（换 5 为 5 不变）；5 + 一块单块时"再拿一块"直接带进死路。→ 已修（可达性判断）。
- P2 useHop 重播旧庆祝（已知）：tick 永不清零 + index 进依赖，重排、成功后再拿块（新挂载）、再玩一次都会重跳。→ 已修，浏览器实测。
- P3 空工作台点反馈卡说的是帮助句，不是卡上写的题目；横屏窄卡去掉了状态图标；英文长标题在 375×553 溢出卡片；自由和成功语只说"5，就是 5 块"，与徽章 "2 + 3 = 5" 不一致；切语言后重复播报纠正；无点外关闭菜单。→ 均已修。
- 观察到一次、未复现：ch1-n10 答对后重新构建 dist 再进站，作品为空（完成记录在、无损坏备份）。随后直接复现"答对 → 刷新"作品正确保留。记为待观察。

## 修复

- [x] `audio-i18n/speak.ts`：`pickVoice` 女声 / 童声优先、Premium/Enhanced 优先、永不选特效与 Eloquence 声音、不用粤语；`pitch 1.1`。
- [x] `screens/correction-voice.ts`（新）：纠正语音单一规则；LevelScreen 接入（提交 / 撤销 / 再玩一次 / 点数 / 菜单 / 帮助 / 卡片）。
- [x] `LevelScreen`：成功事件 `celebration`（非成功提交清零）；`useHop` 每个事件只跳一次；卡片重听说卡上的话；横屏徽章与形状并排、形状参考放大；菜单安全区 + 横屏三列 + 滚动 + 点外关闭。
- [x] `AnswerFeedback`：窄卡保留图标、说明占整宽；短屏高度 70；英文无障碍标签用英文标点。
- [x] `hints.ts`：子集和可达性；卡住 → 琥珀"这样拼不到 n" + "先放回一些，再把伙伴搬过来" / "换一个伙伴试试"；自由和成功语说实际两个伙伴。
- [x] `content`：握把题 `decoys`（n10 [4]、n11 [3]、n12 [4]）、伙伴顺序洗牌、参考解子集和、validate 要求握把题有诱饵；备用块"1"色。
- [x] `copy.ts`：`feedback.stuck`、`hint.stuck.block`；英文标题缩短。
- [x] `MapScreen`：打开时滚到当前站。`ui.tsx` PillButton 标签居中（横屏两行"Back to map"）。

## Checkpoint 12

- [x] `pnpm lint` 0 问题；`pnpm typecheck` 通过；`pnpm lint:purity` 零命中。
- [x] `pnpm test:gate`：35 suite、449 测试全过（复审前 34 / 439）；core 100% / 99.09%，content 97.99% / 95.74%，progress 98.22% / 96.41%（门禁 95%）。
- [x] `pnpm build:web`：5 个静态路由；临时测量页 `src/app/dev-feedback.tsx` 已删除。
- [x] 回归测试会在旧实现上失败：把 `countHint` 换回旧贪心逻辑，"按帮助句操作总能完成"在 ch1-n10 失败（已验证后还原）。
- [x] 实际试玩（静态产物 http://localhost:8791，Playwright 无头 Chromium；**输入方式：CDP `Input.dispatchTouchEvent` 触摸序列**——浏览器输入管线里的可信触摸，不是合成 DOM 事件，也不是鼠标，但不是真机手指）：从空存档按顺序完成第一章 12 站与第二章 7 站；n2 多一块后立即逐块点数（纠正在最后一次点数后 895ms 排队说出，无 cancel）、改对（先 stop 再说成功）；n2 重排不跳、成功后再拿块不跳、拆坏再拼对跳（-14px）；n10 5 + 4 = 9 安静、+5 = 14 纠正一次、送回 4 成功；n10 卡住状态琥珀并纠正；n11 10 + 3 多 1 → 换 2；n12 10 + 5 + 4 多 2 → 换 2；n7 4 + 2 换伙伴 → 3 + 4 = 7；自由和 3 + 2 成功语"3 加 2，一共 5"。语音通过替换 `speechSynthesis.speak / cancel` 记录，实际选中 Tingting、pitch 1.1。
- [x] 布局实测：ch1-n3 667×331 横屏答对"下一站"底 325；ch2-n7 英文答对 + 7 项菜单在 390×844 / 375×553 / 844×390 / 667×331 全部元素在视口内；反馈卡全部文案（中英 × 竖屏 / 短屏 / 窄卡）在 360 / 375 / 390 宽不溢出（临时测量页）；地图当前站 ch2-n7 打开即在屏内（y=624/844）。
- 脚本辅助（非玩家操作）：地图上用 `scrollIntoView` 定位 ch2-n4；测量用 DOM 查询。

未验证 / 遗留：

- 真机 iPhone Safari / Android：实际发声（Tingting / Samantha 音色、pitch 1.1 是否自然）、首次音频解锁、真实手指拖放、安全区（Chromium 不模拟 env(safe-area-inset-*)，横屏只用视口高度近似）、玩到一半转屏。
- 童声：系统内置声音里没有像样的童声（"Junior" 是特效声音，已排除）；Edge 的在线 Ana / Xiaoyi 能被选中但 iPhone Safari 没有。要稳定童声需预生成音频（edge-tts，D-031 因本机企业代理暂缓）。
- 浏览器 aria-hidden 焦点警告（栈导航隐藏上一屏时按钮仍有焦点）为既有问题，本轮未处理。
- 家长选章节、章节完成收尾、形状参考放到工作台附近：未做。

## 下一轮儿童试玩观察重点

1. 不听语音时能否分辨 ✓ 绿卡与 ↻ 琥珀卡，是否会主动点卡片重听。
2. 握把题面对诱饵伙伴时怎么选：直接全搬、逐个试、还是先看数字标签；"这样拼不到 10"后能否自己送回。
3. 新声音（婷婷 / Samantha、略高音调）孩子是否愿意听、是否觉得吓人。
4. 点数被纠正语音"排在后面"时是否自然，还是觉得等太久。
5. 横屏时是否注意到左侧并排的形状参考。

# Phase 13: 儿童 / 游戏 / UI 复审修复（2026-10-14，依据 [child-game-ui-review-2026-10-14](../docs/child-game-ui-review-2026-10-14.md)）

先核对现状再改：报告中的四个问题在当前代码里都仍然存在（`CONTENT_VERSION = 1`；`devices.ts` 按 24px 提示栏算；纠正只说抽象句、不指物；17 站 375×553 实测 34px）。另外核对出：按真实栏高，17 站在部分发牌顺序下只有 29px（低于布局测试自己的 32px 下限），原测试是靠多算的舞台高度通过的。

## 存档与内容版本（D-034）

- [x] `schemaVersion` 只管存档 JSON 格式；`CONTENT_VERSION` 升到 2，`CONTENT_CHANGES[2] = [ch1-n10, ch1-n11, ch1-n12]`。
- [x] 发牌种子固定盐 1（`content/rng.ts` `DEAL_SALT`），升版本不洗乱没变的站。核对：v2 下 19 站材料与复审时的构建（v1）逐字节相同（指纹比对），所以已发诱饵的存档全部保留。
- [x] `progress/migrate.ts` 按站迁移，返回 `{ state, setAside }`；`loadArchive` 收起作品时原串另存 `amber-blocks/progress.before-upgrade`，`issue: 'upgraded'`（不是 `repaired`），`Loaded.upgraded` 列出站；家长区显示"题库更新过……"并列出"数字岛 第 10 站"等。
- [x] `content/fingerprint.test.ts`：每站材料指纹，材料变了没升版本就失败（已用把 n10 诱饵 4 改成 3 验证会失败）。
- 测试：`progress/upgrade.test.ts`（Phase 11 构建写出的冻结 v1 夹具：10 站未完成、第一岛全部完成 + 合体岛半成品；已发诱饵构建的 v1 存档；升级幂等；更新构建的存档；损坏仍算损坏）、`store.test.ts` migrate 三条、`ParentScreen.test.web.tsx`、`LevelScreen.test.web.tsx`（旧存档打开 10 站是新托盘）。

## 布局高度（单一来源）

- [x] `blocks-ui/chrome.ts` `LEVEL_CHROME`：LevelScreen 头部 / 底栏 / 侧栏、AnswerFeedback 卡高与间距、`devices.ts` 全部从这里取；删掉 LevelScreen 里残留的 24px `prompt` 样式。
- [x] 托盘排布取三种里最矮的（折行 / 先到先填 / 高的先放），行内保持发牌顺序；`layoutTray` 按输入顺序返回。
- 测试：舞台预算（375×553 → 375×335，402×714 → 402×446，含安全区与横屏）；17 站 24 种发牌顺序在 375×553 都 ≥ 34px；行内顺序；11 种手机 × 19 站 × 3 variant 回归按真实高度全部通过（最小 32px：360×640 的 17 站）。

## 答题反馈与引导（D-035）

- [x] 两级帮助（`screens/hints.ts` `guidanceFor` / `cardFor`）：第一级不点名，只点亮形状小图 / 要接起来的两个伙伴 / 离群积木；点卡片或"帮助"进入第二级，点名并点亮要送回 / 要拿的伙伴（数量题用广度优先找最短步骤）。答案一变灯灭。
- [x] 文案：形状"照着小图摆一摆"、离群"把分开的积木推到一起"、没接上"把 3 和 4 推到一起"、"把 4 送回去"、"把 4 送回去，换 2 过来"、"先放回 1 块，再把 4 搬过来"；答对卡片说"可以去下一站啦 / 回地图看看吧"，不重复徽章算式，语音仍说成功句。
- [x] 卡片：状态图标放进圆盘（✦ / ↗ 蓝、💡 琥珀、✓ 绿底白勾），↻ 不再用于"调整"；喇叭画成圆按钮。`blocks-ui/Spotlight.tsx` 点亮环：脉冲三次后常亮、不接收触摸。
- [x] 拖动中不播纠正（`correction-voice` 按原因暂停：菜单 / 拖动）；放不下的落点（`blocked`）摇一下弹回，反馈卡不变。
- 测试：`hints.test.ts`（两级帮助、点亮的正是句子说的、按第二级帮助字面操作从随机混乱 60 种子 × 3 站总能完成）、`correction-voice.test.ts`（拖动与菜单各自暂停）、`LevelScreen.test.web.tsx`（求助点名点亮、提交即熄灭、慢拖不播、形状小图点亮）。

## 小屏可操作性

- [x] 布局：上面的托盘排布把 17 站 375×553 的最差情况从 29px 提到 34px。按宽度算 375px 上约 36px 是物理上限（6×5 工作台 + 23 块材料），继续缩材料或改工作台尺寸会动内容版本，本轮不做。
- [x] 替代：点数命中容差 `countTarget`：点在已数过的块或空隙上，数手指半格内最近的未数块（只到相邻块），否则忽略；实测偏右点到已数块数到了右边那块，点到半格外不乱跳。

## 工程

- [x] 清掉 `LevelScreen.test.web.tsx` 的 act 警告（假计时测试结束前在 act 里冲刷存档写入）：0 条。
- [x] 修复本轮自己引入的问题：`nextNodeOf` 被挪到早返回之前，静态导出用占位 id 渲染该路由时抛错，直接打开 `/play/<id>` 出 React #419（基线构建无此错）。已移回，并加回归测试（注入同样错误时测试失败）。

## Checkpoint 13

- [x] `pnpm lint`：0 问题；`pnpm typecheck`：通过；`pnpm lint:purity`：零命中。
- [x] `pnpm test:gate`：38 suite、495 测试全过（复审时 35 / 449）；core 100% / 99.09%，content 98% / 95.74%，progress 98.52% / 96.36%（门禁 95%）。无 act 警告。
- [x] `pnpm build:web`：5 个静态路由。
- [x] 实际运行（静态产物 http://localhost:8787，Playwright 无头 Chromium，CDP `Input.dispatchTouchEvent` 触摸序列，新 context；语音以替换 `speechSynthesis.speak` 记录）：
  - 375×553：舞台 335px（= 测试 helper）、卡 70px；17 站每块 34px，托盘两行。10 + 5 + 4 = 19 → 琥珀 💡"多了 2 块 / 比 17 多了，把一个伙伴送回去"，900ms 后说一次、无点亮；点卡片 → 说"把 四 送回去，换 二 过来"，卡片同句，4（工作台）与 2（托盘）出现环；送回 4 → 灯灭；拿 2 → ✓"拼对啦！/ 可以去下一站啦"，"下一站"在屏内；点数：正点 1、偏右点已数块 → 2、正点已数块 → 3、点角落（半格外）→ 仍 3。
  - 390×844：舞台 576px；造型题摆成长条 → "数量对了，再看看形状 / 照着小图摆一摆"，自动纠正说出后小图出现环；拖到被占格 → 弹回时摇动（采样到 ±7° 内的旋转），反馈不变。
  - 360×568、375×553、667×331 × 中 / 英：第一级与第二级卡片文字都在卡内（横屏窄卡自动高 61–87px），两处环都在。
  - 旧存档（Phase 11 夹具）：10 站打开为 5 / 4 / 5 + 两块备用、空工作台，无恢复界面；`progress.before-upgrade` 有原串，无 `progress.corrupt`；家长区显示升级说明与"数字岛 第 10 站"；地图 9/12。
  - `/`、`/parent`、`/play/ch1-n1`、`/play/ch1-n10`、`/play/ch2-n7` 直接打开：控制台无 error / warning。
- 截图：`docs/review-assets/round2-*.png`。

未验证 / 遗留：

- 真机：手指实际点 34px 块的错点率、点数容差的手感、Spotlight 脉冲在 iPhone 上是否刺眼、喇叭 emoji 在 Android 上的样子，都只在无头 Chromium 里看过。
- 第三级帮助（示范拖动方向）、首次整组拖动示范、组数字与点数序号的区分、Boss / 章节收尾、"换个摆法"：本轮未做（复审的其他建议，不在这次四项范围内）。
- 横屏窄卡英文标题会折两行（如 "2 blocks / too many"），在卡内，未改。
- 17 站 360×640 Android 最小 32px，仍是全表最小值。

# Phase 14：可爱、手感与音效（2026-10-14，D-036）

三路复审（游戏设计 / 美术 / 儿童 UX，用 game-feel、puzzle、frontend-design、better-colors、animate-expo、mobile-native、impeccable delight·bolder·animate）结论：核心动作无声、积木不是角色、画面是 app 控件语法、关卡里没有会自己动的东西、过关时刻弱。Ted 中途补充："语音提示太多 太诡异了，换成音效，成功失败不同的提示音，抓起放下不同的音效"。

## 音效与语音（`audio-i18n/sfx.ts`、`screens/sound.ts`、`screens/speech-policy.ts`）

- [x] Web Audio 合成音效，无文件：抓起↑、落下"咔"、放回 / 飞回↓、放不下 bonk、点数按大调逐个升（17 都不重复）、数完 ta-da、答错一声轻"嗯？"（变成需要调整时一次，保持错时不再响）、过关琶音、Boss 小号、进站叮咚、按钮咔哒。主音量 0.22，压在语音下面。首次触摸才建 AudioContext（不在进站时报浏览器警告）；`navigator.audioSession.type = 'playback'`（静音键下与语音一致，待真机）。
- [x] 自动语音只留点数数字：开场题目、成功句、自动纠正、"一共 n 块"关掉；点徽章 / 卡片 / 帮助仍会说。自动纠正关掉后，第一级帮助（点亮小图等）照常在停手后出现。开关集中在 `AUTO_SPEECH`，改一行可恢复。
- [x] 菜单"音效：开 / 关"，按设备存 `amber-blocks/sfx-muted`（不进存档）。
- 测试：`sfx.test.ts`（每个音不同、成功高 / 调整低、抓起升 / 放回降、点数严格升、静音、无音频 / 报错静默）；`LevelScreen.sound.test.web.tsx`（进站只响不说、对 / 错音、错只响一次、Boss 小号、点数音阶 + 只念数字、舞台手感事件、菜单开关、再玩一次）；原 `LevelScreen.test.web.tsx` 以"自动语音全开"固定语音机制的时序。

## 积木角色与材质（`blocks-ui/Face.tsx`、`Block.tsx`）

- [x] 新脸：统一暖墨色（各色上 3.6–12:1）、五官下移、豆豆眼带高光、腮红（红 / 粉块用白色光晕）、小 U 嘴；过关 ^ ^ 眼 + 张嘴带舌头；托盘单块"睡脸"，拿起时（`lift` 0→1）换成睁大眼 + o 嘴；头块各自随机眨眼。仍然一簇 / 一个伙伴一张脸。
- [x] 塑料积木：底部深色厚唇 + 顶部亮边 + 硬投影（`boxShadow` 字符串）、左上高光豆、圆角 0.28；拿起时地面出现柔影。伙伴标签白字配 `deep` 色（全部 ≥ 4.5:1）。
- [x] 簇变大 / 变小：颜色 220ms 渐变 + 弹一下，不再硬切。

## 手感（`blocks-ui/use-draggable.ts`、`Stage.tsx`）

- [x] 托盘与工作台用同一数组、按身份做 key：积木在托盘 ↔ 工作台之间保留同一个视图，松手后从手指处弹簧飞进格子（FLIP）并压扁回弹，不再瞬移 / 重挂。
- [x] 按下即轻压（0.93），没拖动就弹回；进站时所有东西依次掉进来（只在头 0.9 秒，之后挂载的不掉）。
- [x] 减少动效：不飞、不掉、不撒彩纸，直接到位。

## 庆祝与引导

- [x] 过关：蹲 → 跳 24px → 落地压扁；云朵 pop + 摆动；彩纸（积木色 + 琥珀 + 白，普通 18 片 1s、Boss 36 片 1.3s，种子确定、不挡触摸）；"下一站"1.6 秒后开始呼吸。
- [x] 示范手：工作台空着且没人碰时，半透明积木 + 👆 从托盘沿弧线滑到工作台中间两遍；第一站 1.8 秒、其他 5 秒，每次进站最多两次，任何拖动 / 点数立刻收起。常量在 `LevelScreen.tsx` 顶部。

## 视觉

- [x] 字体：RNW 的 Text 自带 `font: 14px System`，`global.css` 的圆体从没生效。改为每个 Text 用 `FONT`（Fredoka 600 / 700 + ui-rounded + PingFang），`@expo-google-fonts/fredoka` 经 `expo install` 安装，根布局 `useFonts` 不阻塞渲染；全局 `font-synthesis-weight: none` 防止假粗体。
- [x] 关卡：目标数字放在云朵上（Boss 云带星、答对底影变绿），天上两朵小云；反馈卡改成带小尾巴的气泡 + 硬投影；工作台是木框毛毡垫 + 缝线；托盘是木边沙坑 + 沙粒；空槽是压进沙里的凹印；形状小图用目标色积木。
- [x] 按钮：硬底边，按下沉 3px + 咔哒；≡ ▶ ⚙ 🔊 ↻ 换成手绘图标（`screens/icons.tsx`）。
- [x] 地图：每站是带数字的积木角色（锁住 = 淡色睡脸、可玩 = 眨眼、完成 = 笑脸 + ✓）；锁住的站点了会摇一下 + bonk；岛外浅滩、沙的厚度、踏脚石、棕榈 / 贝壳 / 草丛放在路径对侧；标题两侧站着 1 和 2；Boss 星改贴在角上；第一站下移，标记不再压住岛牌。
- [x] 代码卫生：`juice.ts` 全部改 `get()/set()`；`useBob` 改 `withRepeat`（原先在 worklet 回调里调 JS 函数）。

## Checkpoint 14

- [x] `pnpm lint`：0 问题；`pnpm typecheck`：通过；`pnpm lint:purity`：零命中。
- [x] `pnpm test:gate`：40 suite、507 测试全过；覆盖率门禁通过（全部 96%）。
- [x] `pnpm build:web` 通过。
- [x] 实际运行（静态产物，Playwright 无头 Chromium，CDP 触摸）：390×844 抓起显示 o 嘴 + 地面影；落下飞入；2 站过关彩纸 + 跳 + 云变绿 + 下一站呼吸；第一站 1.8 秒出示范手、约 4 秒后收起；375×553 的 17 站与 667×331 横屏版面正常；减少动效下过关无彩纸、无报错；拦截 `AudioContext` 记录到：进站 659/988Hz、拖到过关 = 抓起 420 + 琶音 523→2093 + 落下 330/1320、点数 262/523 + ta-da 784/1047 且只说"一"；地图 / 关卡 / 家长页控制台无 error。
- 截图：`docs/review-assets/phase14-*.png`。

未验证 / 遗留：

- 真机：iPhone Safari 上 Web Audio 首次解锁、静音键下 `audioSession = 'playback'` 是否生效、音效与 TTS 同时播放的音量平衡、Fredoka 在 iOS 上的加载时机，都只在桌面 Chromium 验证。
- 这轮没做（复审建议，下一轮候选）：地图解锁仪式（过关后先回地图、标记跳到下一站）、作品册 / "换个摆法"贴纸、会说话的积木吉祥物、岛屿完成庆典、加法过关时两个伙伴"合体"外框、家长入口长按门槛。

# Phase 15：按 2026-10-15 儿童游戏复审做下一轮优化（依据 [game-review-2026-10-15](../docs/game-review-2026-10-15.md)）

验证方式：内建浏览器面板隐藏、chrome-devtools 的浏览器被另一个会话占用，本轮全部用 Playwright 无头 Chromium（缓存的 headless shell 1223）+ CDP `Input.dispatchTouchEvent` 触摸拖拽，静态产物 `PORT=8791 pnpm serve:web`，进度用 localStorage 预置（只写完成记录）。语音以替换 `speechSynthesis.speak` 记录，音效只核对调用，没有听。截图 `docs/review-assets/phase15-*.png`。为便于自动化，`bench` / `tray` / `block` / `partner-<n>` / `partner-label` / `partner-grip` / `face-<mood>` / `demo-ghost` 加了 testID。

## 第一档 A–G（D-037 – D-040）

### A. 工作台随本站材料（D-037，内容版本 3）

- [x] `content/bench.ts`：`fitBench(spec)` 纯函数。要放得下：数字按伙伴画法排（5 一行）、形状题每个转向和同数的一行（"数量对了，再看看形状"必须摆得出来）、加法的两个伙伴并排、每个伙伴；各加 1 格余量，最小 3 × 3；再按货架装箱确认全部材料能同时放上去（孩子把东西全拿出来才知道"多了"，不能弹回），放不下就加行。`benchFor(chapter, node)`：节点 `bounds` > 章节 `bounds`（都改成可选）> 推导。`validate` 新增"全部材料能同时放上去"。
- [x] 结果（390 × 844 格子）：1、2 站 3 × 3 → 84px（原 61）；合体岛 1 + 1 4 × 3 → 84px、2 + 1 / 2 + 2 5 × 3 → 73px（原 45）；8 砖与 17 仍 6 × 5、3 + 4 为 8 × 3（格子与原来相同）。11 种手机 + 两个模拟视口 × 19 站，没有一站比原来小。
- [x] `CONTENT_VERSION = 3`，`CONTENT_CHANGES[3]` 列 17 站（8、17 不变）；指纹表更新。测试证明 v3 除了 bounds 每站发的东西与 v2 逐字相同。
- [x] 迁移（`progress/migrate.ts` `onMat`）：变了的站，作品原位放得下就原位保留，放不下就整体平移到左上角，再放不下才收起（完成记录保留，家长区列出；文案改为"这些站更新过，之前摆的作品放不下了……"）。冻结夹具未动，只改了期望（9 站与自由和 5 的作品原位保留到新工作台）。
- 测试：`content/bench.test.ts`（9）、`catalog.test.ts` 每站尺寸表、`upgrade.test.ts` v2 → v3 三种情况、`layout.test.ts` 390 × 844 门槛与"没有一站变小"、`devices.ts` 加 390 × 844 / 360 × 640。旧测试里按 6 × 5 / 8 × 6 写死的坐标改到新工作台内（level-session、hints、tray、sound）。

### B. 已完成的站始终保留"下一站"（D-038）

- [x] `completed || solved` 显示"下一站"：现在对 → 亮色呼吸 + "再玩一次"；以前完成过但现在不对 → 白色按钮单独出现，卡片照实说（"多了 1 块"）。"再玩一次"规则不变（只在答对时）。
- 测试：答对 → 再放一块 → 下一站仍在、再玩一次消失；卸载重开（刷新）后同样；点下一站会前进；"再玩一次"后完成过的站仍有下一站。

### C. 点数总量闭环（D-038）

- [x] `AUTO_SPEECH.countTotal = true`：数完最后一块说一次"一共 n 块"（copy `count.total`），云朵数字 pop（与过关共用一个计数），数过的块一起眨一次眼（`useWink`：身体轻压 + 眼睛闭合，减少动效时不动）。其他自动语音仍关。
- [x] 顺带修：中文朗读 2 加量词说"两"（"一共 两 块"、"二，就是 两 块"），屏幕仍是数字（`content/copy.ts` `format`）。
- 测试：数字词序列不变 + 总量句只说一次、之后再点不说、"再数一遍"后数完才再眨眼 / 再说；`AUTO_SPEECH` 表固定；copy 两 / 二。

### D. 首个整组站示范整组 + 伙伴握把（D-040）

- [x] 示范手搬参考解的第一步：整组站是一个答案伙伴（不会是诱饵），散块站是一块。`DemoHand` 画整个外形的虚影，从托盘大小长到工作台大小，落在工作台正中。
- [x] 握把：伙伴的积木坐在同色半透明圆角底板上（只圆外角），缝隙和外缘露出一圈，一眼看出"这是一整个"；在积木后面，不盖脸和数字。
- 测试：`Stage.test.web.tsx`（真 Stage 在 jsdom 渲染）：10 站虚影 5 块、散块站 1 块、伙伴各有底板和数字、心情传到脸。

### E. 颜色（D-039，better-colors 实测）

- [x] 10 号 `#F4F1EA`（毛毡上 1.05:1、边 2.10:1）→ 丁香紫 `#D18EDB`（毛毡 2.27、沙 1.92、边 5.42、脸墨 5.82、白字 / deep 6.88，OKLCH 色相 322°，离 6 号紫 29°、7 号粉 29°）；任何白色都到不了毛毡上的 1.5:1，所以"10 是白的"让位给"看得见"。9 号灰蓝 → 长春花蓝 `#789BEF`（C 0.038 → 0.13，毛毡 2.53、沙 2.14、边 5.67、脸墨 5.23、白字 7.22，离 5 号 26°、6 号 27°）。地图睡着的站：边框 / 浅底 ≥ 1.7、deep 字 / 浅底 ≥ 4.8。10 号腮红改白色光晕（粉色在紫粉底上看不见）。
- [x] "需要调整"卡：淡黄底（与 3 号同色相 88° / 94°）→ 白底 + 3px 琥珀描边，小尾巴只描上两边。
- 测试：`blocks-ui/palette.test.ts`（每色白字 / deep ≥ 4.5、脸墨 ≥ 3；9、10 对毛毡 / 沙 ≥ 1.5、边 ≥ 3、浅底可辨、色相 ≥ 15°）。
- 未改（记为后续）：3 号黄 `#F9D23C` 在毛毡上 1.37:1、边 2.27:1，同样低于本轮给 9 / 10 定的线。

### F. 伙伴徽章不出界（D-040）

- [x] `layout.ts` `labelSpot`：徽章放进顶行最后一块的右下角（一块的伙伴在脸颊下方），不在头块（脸）、不在右上角（点数序号）、不出外形；多块 0.5 格、一块 0.4 格。
- 测试：1–10 各种格子大小都在外形内；8 × 3 工作台右缘 3 + 4 不出界；11 种手机上 10 站托盘三个徽章不重叠。

### G. "需要调整"时的表情（D-040）

- [x] `Mood` 加 `puzzled`：一边眉毛挑起、小 o 嘴、头歪 7°，不哭不生气、不眨眼。`Stage` 新增 `mood`，LevelScreen 按卡片语气给：adjust → puzzled，success → happy，其他 calm；托盘散块仍 sleepy。
- 测试：`Face.test.web.tsx`；LevelScreen：2 站 1 块 calm → 2 块 happy → 3 块 puzzled → 拿回 happy → 再拿回 calm。

## Checkpoint 15-1（第一档）

- [x] `pnpm lint` 0 问题；`pnpm typecheck` 通过；`pnpm lint:purity` 零命中。
- [x] `pnpm test:gate`：44 suite、574 测试全过（Phase 14：40 / 507，没有删测试）；覆盖率门禁通过（全部 96.37% / 91.98%）。
- [x] `pnpm build:web` 通过。
- [x] 实际运行（Playwright 无头 Chromium，mobile + touch，CDP 触摸）：
  - A：390 × 844 / 360 × 640 / 375 × 553 / 667 × 331，1 站 3 × 3、84px、三块全放上去 → "多了 2 块"；17 站 61 / 39 / 34 / 41px、3 + 4 45 / 42 / 43 / 59px（与原来相同）；合体岛 1 + 1 84px，拖两个 1 并排 → "1 + 1 = 2"；3 + 4 + 5 + 2 全部放上 8 × 3 → "多了 7 块"。四个视口控制台都无 error / warning。
  - B / G：390 × 844 2 站，2 块 → 下一站 + 再玩一次、头块笑脸；第 3 块 → "多了 1 块"、下一站仍在（白色）、再玩一次消失、头块 puzzled；刷新 → 作品 3 块、卡片与下一站照旧；拿回一块 → 拼对、笑脸。
  - C：点两块 → 记录到语音 "一" "二" "一共 两 块"（修之前是"一共 二 块"，本轮浏览器里发现的）。
  - D：10 站 5 秒后示范虚影 5 块（整条 5，不是诱饵 4），中途帧落在工作台正中；12 站虚影 10 块。
  - E / F：12 站 10 号丁香紫在毛毡上清楚；3 + 4 在 8 × 3 右缘，两个徽章都在工作台内（390 / 360 宽）；10 站托盘三个徽章不重叠（390、360）；17 站 360 × 640 四个徽章不重叠；"需要调整"白卡在 375 × 553、667 × 331 文字都在卡内。
- 截图：`phase15-a-*`、`phase15-b-solved`、`phase15-g-puzzled`、`phase15-c-counted`、`phase15-d-ch1-n10-demo-glide`、`phase15-e-*`（对照 r3-14 / r3-25）、`phase15-f-3plus4-*`。

未验证 / 遗留：

- 声音没听（"一共 n 块"的 TTS 读法、眨眼时机）；真机触摸没测。
- 工作台小了以后托盘在 390 × 844 下有大片空沙（积木已到 84px 上限），没有改托盘高度。
- 3 号黄在毛毡上的对比（见 E）。

## 第二档

### H. 过关前进仪式（D-041）

- [x] "下一站"不再直接换题：`router.replace('/?from=<本站>&to=<下一站>')`。地图读一次参数（`advanceOf`：两个已知站、下一站已解锁，否则就是普通地图），滚到两站中间；静态标记藏起，`TravelMarker` 沿三块踏脚石跳 4 下（每下 150ms，开始前 250ms）；落地时下一站从睡脸睁眼 + pop + `arrive` 音；落地后 900ms 自动进入下一站；全屏透明层，点任何地方立刻进入（只进一次）。减少动效：标记直接到位，其余照旧。跨岛（17 → 1 + 1）用两个岛的相对位置，同一套跳法。不会自动回地图，作品不清空。
- 测试：`MapScreen.test.web.tsx`（jsdom 里给 offset 尺寸让地图画出站点）：参数校验、跳 → 睁眼 + 音 → 自动进入、点一下进入且只一次、普通访问没有任何自动行为。LevelScreen：下一站 → `/?from=ch1-n2&to=ch1-n3`。

### I. 章节收尾（D-042）

- [x] 一章最后一站、且整章都完成时，"下一站"写成"数字岛完成了 / 合体岛完成了"，进入新页面 `/island/[chapterId]`（`IslandDoneScreen`）：岛名牌、一句引导（copy `island.onward` / `island.all`，中英各一，点了才说）、本岛所有站的角色笑脸交错跳三下、Boss 站作品用 `Stage` 只读渲染（`trayHidden`、`showcaseGeometry`，作品不对或被清空就用参考解）+ 彩纸 + fanfare，按钮"去合体岛"（经 H 的跨岛跳）/ 最后一岛"回地图"。没完成的岛或未知 id → 回地图（静态导出占位 id 不抛错）。横屏左右两栏，按钮不出屏。
- [x] 全部完成后地图最后一个岛下方常驻一串积木色彩旗和一个奖杯。
- [x] 新路由同步到 `tools/serve-dist.mjs` 与 `vercel.json` rewrites；typed routes 声明（`.expo/types/router.d.ts`，生成文件）用 expo-router 自带生成器刷新。
- 测试：`IslandDoneScreen.test.web.tsx`（真 Stage）：12 个笑脸、Boss 作品无沙坑、引导只在点时说、按钮去 `/?from=ch1-n12&to=ch2-n1`；最后一岛回地图；未完成 / 占位 id 回地图。LevelScreen：17 与 3 + 4 按参考解完成后按钮文字与去向。MapScreen：奖杯只在全通后出现。

## Checkpoint 15-2（H、I）

- [x] lint 0、typecheck 通过、lint:purity 零命中；test:gate 46 suite / 584 测试全过，覆盖率门禁通过（96.39% / 92.09%）；build:web 6 个静态路由（新增 `/island/[chapterId]`）。
- [x] 实际运行（Playwright 无头 Chromium + CDP 触摸）：
  - H，390 × 844：2 站拖两块 → 下一站 → URL `/?from=ch1-n2&to=ch1-n3`，下一站（4 方阵）睡脸、旅行标记在 2 站上方；落地后睁眼；约 1.75s 后自动进入 `/play/ch1-n3`；第二次运行在跳的途中点一下 → 0.9s 内进入。减少动效下同样进入。控制台无 error / warning。
  - I，390 × 844：拖 10、5、2 拼出 17 → 按钮"数字岛完成了" → `/island/ch1`：12 个角色、17 的作品、彩纸、"数字岛完成了，去合体岛吧"；点"去合体岛" → `/?from=ch1-n12&to=ch2-n1`，跨岛跳 → 进入 `/play/ch2-n1`。合体岛收尾页在 360 × 640、375 × 553、667 × 331、390 × 844 按钮都在屏内；"回地图"后地图底部有彩旗与奖杯（390 × 844、360 × 640 都在首屏内）。未完成的岛直接打开 `/island/ch1` → 回到 `/`。
- 截图：`phase15-h-hop`、`phase15-h-landed`、`phase15-i-island-*`、`phase15-i-cross-island-hop`、`phase15-i-map-trophy*`。

未验证 / 遗留：

- 音效只记录到振荡器调用（落地 = 进站音），没有听；跳的节奏 / 0.9s 是否太快要孩子试。
- 新克隆的仓库要先 `expo start` 或刷新 typed routes 声明，`pnpm typecheck` 才认 `/island/[chapterId]`（`.expo/` 是生成目录）。

### K. 儿童菜单精简（D-043）

- [x] 关卡菜单只剩 继续 / 帮助 / 撤销 / 重新挑战（完成过的站）+ 卡片底部一个小 ⚙。English、音效、全屏、地图都进家长区。
- [x] `screens/ui.tsx` `ParentGate`：长按 600ms（`PARENT_HOLD_MS`）才打开家长区；短按什么都不做（不响咔哒、不关菜单）。地图左下 ⚙ 同样改成长按。
- [x] 家长区新增"音效：开 / 关"（按设备存，仍是 `amber-blocks/sfx-muted`）和"回地图"（`router.dismissTo('/')`，从关卡进来也回到地图）；顺带给家长区三个没写字体的 Text 补上 `FONT`。
- 测试：LevelScreen 菜单项列表、⚙ 短按无反应 / 按住 650ms 进入家长区并关菜单；地图 ⚙ 同样；家长区音效开关、回地图。语言切换的两条旧测试改用测试内的进度探针切语言（家长区做的同一件事），音效开关测试改到家长区。

## Checkpoint 15-3（K）

- [x] lint 0、typecheck、lint:purity 通过；test:gate 46 suite / 587 测试，覆盖率门禁通过；build:web 通过。
- [x] 实际运行：390 × 844 与 667 × 331，菜单只有 继续 / 帮助 / 撤销 / 重新挑战 / ⚙；点 ⚙（120ms）→ 仍在关卡、菜单开着；按住 750ms → `/parent`；家长区音效开 → 关（localStorage `sfx-muted = 1`）→ 开；"回地图" → `/`；地图 ⚙ 点一下不动、按住进入家长区。控制台无 error / warning。截图 `phase15-k-menu-*`、`phase15-k-parent`。

未验证 / 遗留：真机长按（iOS Safari 长按可能触发文字选择 / 放大镜，按钮上没有文字，但要真机看）。孩子在关卡里没有直接回地图的路了（只剩"下一站"经地图）——这是本项要求的取舍，记在"需要 Ted 决定"。

### L. 数字岛 5–9 站重排（D-044，内容版本 4）

- [x] 新 5–9：5 = 握把 3 + 单块（第一次出现伙伴，托盘 3 + 4 块单块，其中 2 块是答案）→ 4 同量变身（同一站先方阵、再长条，两步都算）→ 6 塔（不变）→ 8 砖 Boss = 两个 4 叠起来（另有诱饵 3 和 1 块单块）→ 9 = 5 + 4（诱饵 3、2 块单块）。全图每站参考解里单块拖拽 ≤ 6（catalog 测试）。
- [x] 内容层：`quantity` 的握把可以少于目标，余数由单块补（只有握把恰好凑满目标时才必须有诱饵）；`quantity_shape` 可带握把 / 诱饵（握把必须凑满目标）；`quantity_shape.sequence: true` 按顺序问每个模板，`Puzzle.steps` 记全部步骤；参考解：方阵 4 次 take + 2 次 move 成长条；`validate` 要求参考解依次通过每一步、不能跳步。`fitBench` 同步支持（握把 + 单块的容量）。
- [x] 会话层（`level-session.ts`）：`step` / `whole` / `stepView`；提交后若本步对了且不是最后一步，进入下一步（同一批积木），`stepDone`；只有最后一步算过关、记完成；步骤只前进（撤销不回退）；重开：已完成的站直接在最后一步，没完成而作品已过第一步的从第二步继续。
- [x] 界面：第一步完成 → 积木跳一下 + success 音 + 云朵 pop，没有彩纸、没有"下一站"；卡片是蓝色"变个样子！/ 照着小图摆一摆"（不是纠错，脸不困惑），小图换成长条并点亮。
- [x] `CONTENT_VERSION = 4`，`CONTENT_CHANGES[4] = [ch1-n5, ch1-n6, ch1-n8, ch1-n9]`，指纹只这四站变（指纹描述只对有步骤的站追加 steps，其他站指纹不变）。旧存档在这四站的作品对不上新材料，收起（完成保留，家长区列出）；夹具测试期望相应更新（9 站作品收起）。
- 测试：generate（握把 + 单块、形状握把 + 诱饵、序列、跳步被拒）、catalog（新 5–9、单块 ≤ 6）、level-session（步骤、重开）、hints（第二步是"继续拼"）、LevelScreen（4 两步全流程 + 刷新）、tray、progress demo、upgrade。

## Checkpoint 15-4（L）

- [x] lint 0、typecheck、lint:purity 通过；test:gate 46 suite / 596 测试全过，覆盖率门禁通过；build:web 通过。
- [x] 实际运行（390 × 844，另看 360 × 640、667 × 331 托盘）：5 站托盘 3 + 4 块单块，5 秒后示范虚影 3 块（整个 3）；放 3 → "还差 2 块"，再放 2 块 → 拼对、下一站。4 站摆方阵 → "变个样子！/ 照着小图摆一摆"、小图变成 4 × 1 并有点亮环、没有下一站；拖两块成长条 → 拼对、下一站。8 站托盘 4、3、4 + 1 块，两个 4 叠成砖 → 拼对；9 站托盘 3、4、5 + 2 块，5 上 4 下 → 拼对。控制台无 error / warning。截图 `phase15-l-*`。

未验证 / 遗留：4 的第二步没有新的提示语音（只有卡片和点亮的小图，点卡片会说"照着小图摆一摆"）；孩子能否看懂"小图换了"要试玩。

### J. 专属过关动作（D-045）

- [x] `blocks-ui/cheer.ts` `cheerFor(目标数, { boss, shape })`：1 转圈、2 一起跳两下、3 叠罗汉（一个比一个跳得高）、4 开心地摇、5 波浪（两遍）、6 叠罗汉、7 转圈、8 / 9 波浪、10 / 12 站起来（拉高再落回）、其他数原来的跳；Boss：8 砖（形状 4 × 2）变小车——长出轮子，开出右边、从左边开回原位，17 的大伙伴（10）站起来挥手、其他伙伴跳。
- [x] `juice.ts` `useCheer(move, tick, index)` 统一实现（`useHop` 保留为 'hop'），`useWheels` 管轮子显隐；`Stage` 按块分配（17 只有 10 挥手）、画 `CarWheels`；LevelScreen 每站算好传给 Stage；多步站第一步完成仍是普通的跳。减少动效：什么都不动，直接在原位（轮子保持不可见）。
- 测试：`cheer.test.ts`（数字与 Boss 映射）、`Stage.test.web.tsx`（8 砖过关有轮子、别的动作 / 没过关没有）、LevelScreen（1 spin、2 pair、10 stand、8 car、17 tall-wave、1 + 1 pair、3 + 4 spin）。

## Checkpoint 15-5（J）

- [x] lint 0、typecheck、lint:purity 通过；test:gate 47 suite / 600 测试全过，覆盖率门禁通过（96.78% / 92.29%）；build:web 通过。
- [x] 实际运行（390 × 844）：1 站、8 砖、17 站分别拖到过关，正常动效和减少动效各一次。8 砖过关后 500ms 帧：两块 4 长出轮子开到右侧出画；1100ms 帧：从左边开回、轮子还在；之后回到原位。减少动效下作品不动、轮子不可见。三站控制台都无 error / warning。截图 `phase15-j-*`。

未验证 / 遗留：动作的节奏和"像不像"只看了帧截图，没有录像、没有孩子；转圈 / 站起来在 34px 小块上的观感没单独看。

### M. 家长区"从哪里开始"（D-046）

- [x] 进度新增命令 `startAt`：只改 `current`，不改完成记录、不建站。`isUnlocked` 多两条：`current` 那一站开着；进过的站一直开着（正常玩时进得去的站本来就开着，所以不改变原来的顺序解锁）。地图默认停在 `current`，其他站照常一站一站解锁。
- [x] 家长区"从哪里开始"：每个岛一个"从数字岛 / 合体岛开始"按钮 + 每站一个小按钮（地图上的数字，当前站高亮、`aria-selected`），下方写"现在从 合体岛 第 1 站 开始"。
- 测试：`unlock.test.ts`（只动 current、邻站仍锁、能进入、进过后离开仍能回来、完成照常开下一站、未知站拒绝）；`ParentScreen.test.web.tsx`（选岛 / 选站后存档 current 变、完成记录为空、文案与高亮）。

## Checkpoint 15-6（M）

- [x] lint 0、typecheck、lint:purity 通过；test:gate 47 suite / 602 测试全过，覆盖率门禁通过（content 98.41 / 95.34、core 100 / 99.09、progress 98.62 / 96.63）；build:web 6 个静态路由。
- [x] 实际运行（390 × 844，空存档）：家长区显示"现在从 数字岛 第 1 站 开始" → 点"从合体岛开始" → "现在从 合体岛 第 1 站 开始" → 回地图：标记在 1 + 1（睁眼、在首屏），数字岛第 2 站与合体岛第 2 站仍睡着 → 开始 → 进入 `/play/ch2-n1`（没有被弹回）→ 拼 1 + 1 → 下一站 → 地图跳 → `/play/ch2-n2`；存档完成记录只有 `ch2-n1`。控制台无 error / warning。截图 `phase15-m-parent`、`phase15-m-map`。

未验证 / 遗留：从中间开始的孩子不会经过前面的岛，所以那个岛的收尾页要等整岛完成才出现（设计如此）。

# Phase 16：作品册（2026-10-15，复审第三档 Q，D-047 – D-050）

只做作品册：把孩子每站拼对的样子留下来，能回头翻看（复审 §4.2"没有我做的东西"、§4.4 长层奖励）。之前 `NodeProgress.work` 只存"当前"作品：答对后乱动会被覆盖、"再玩一次"清成 null，没有地方留住拼对的样子。

验证方式同 Phase 15：内建浏览器面板隐藏不出帧，没用 chrome-devtools（可能被别的会话占用）；Playwright（npx 缓存）驱动缓存的 headless shell 1223，`isMobile` + `hasTouch`、`deviceScaleFactor` 2，拖拽用 CDP `Input.dispatchTouchEvent`（touchStart、14 次 touchMove、touchEnd），静态产物 `PORT=8791 pnpm serve:web`。第 5、7 步和性能测量用 `addInitScript` 预置 `amber-blocks/progress`（只预置一次），其余从空存档真拖。语音以替换 `speechSynthesis.speak` 记录，音效没有听。截图 `docs/review-assets/phase16-*.png`。

## 存档（D-047、D-048）

- [x] `ProgressState.album: ReadonlyMap<NodeId, BenchState>`（`createInitialState` 为空）。快照就是 `BenchState`，自带工作台尺寸、颜色、伙伴，单独就能画，不 materialize。
- [x] reducer：`complete` 可带 `work`，一次同时存作品、记完成、存作品册；同一份作品再提交（包括从存档读回来的等值副本，`codec.sameWork` 比较）返回原状态，不写存档。`saveWork` / `replay` / `newVariant` / `resetNode` / `enter` / `setLanguage` / `startAt` 都不碰作品册；"重置进度"是新的初始状态，作品册为空。
- [x] codec：存档末尾 `album` 字段，按站 id 排序，确定性序列化；没有这个字段 = 空作品册，不算修复；字段不是列表记 `album`，某条不是 `[站, 工作台]` 记 `album#i`，工作台坏了（不变量不过）记 `album:<站>`，只丢那一条，完成记录、作品、其他作品册照常。`schemaVersion` 仍为 1（D-047）。
- [x] sanitize：丢掉未知站、违反工作台不变量（`assertInvariants`）、工作台上什么都没有的条目，各记 `album:<站>`；不拿当前材料比对（旧材料、旧尺寸的图照样保留）。
- [x] migrate：内容升级原样保留作品册（已知版本、无法识别的版本都一样）；作品被收起的站，作品册里的原图还在。
- 测试：`progress/album.test.ts`（11）：何时写入、哪些操作不清；带伙伴的往返一致与确定性；去掉 `album` 字段后其余部分解出来完全一样（旧构建看到的就是这样）；两份冻结夹具作品册为空、无相关修复；5 种坏条目各只丢一条且 `loadArchive` 备份原串；sanitize 三种丢弃 + 旧材料保留；migrate 两条路径保留同一对象；v1 夹具加一张旧 9 站图，升级后作品收起而图还在。测试用的是重摆过的答案，不是参考解。

## 关卡写入（D-048）

- [x] `LevelScreen` 新增 `saveWork(next)`：答对（多步站只有最后一步的 verdict 会 matched）派发 `complete` + `work`，否则 `saveWork`；`update()` 与撤销都走它，一次改动一次派发、一次写入（原来第一次答对是 `saveWork` + `complete` 两次写）。进站时存档里的作品已经对，就用 `complete` + `work` 补进作品册（作品册出现之前的存档，下次进站补上；已经有同样的图就不写）。
- 测试：`LevelScreen.test.web.tsx` 新增 3 条：2 站答对那一次只写一次存档且作品册 = 作品；竖着重摆仍对 → 图更新；多放一块 → 作品变、图不变；撤销回到对的 → 图不变；再玩一次 → 作品 null、图在。4 同量变身：方阵后作品册没有它，长条后才有、且是一行四块。旧存档里已经对的 2 站：进站写一次补上，再进不写。改回"两次派发"时第一条测试失败（期望 1 次写入，实际 2 次），已确认测试能抓住。

## 作品册页 `/album`（D-049）

- [x] `screens/AlbumScreen.tsx`：`albumGroups` 按岛、按地图顺序分组，没作品的岛不出现；卡片 = `WorkPicture` 缩略图 + `labelOf` 数字标签（颜色同地图站点），Boss 带星；没有任何数量统计、空位或问号。空状态：打瞌睡的 1 + "拼对一站，作品就会住到这里"。底部"回地图"（`router.dismissTo('/')`）。
- [x] 放大：只读 `Stage`（`trayHidden`、`showcaseGeometry`，作品自己的工作台尺寸，笑脸），落下后 0.45 秒（`CHEER_AFTER_MS`）做一次 `cheerFor` 动作并响 success 音；点云朵上的数字才说（数词；合体站说"3 加 4，一共 7"）；× 或点空白收起。竖屏数字和 × 在上一行，横屏左右两栏。
- [x] `blocks-ui/picture.ts` `pictureOf`（纯函数：与 Stage 一样的上色——伙伴按自身大小、散块按所在簇大小，每个伙伴 / 簇左上块一张脸，外接框）+ `blocks-ui/WorkPicture.tsx`（复用 `BlockBody`，无手势，裁一块带木框的小毛毡）。新增图标 `album`（相框里三块积木）、`close`。
- [x] 新路由：`src/app/album.tsx`；`tools/serve-dist.mjs` 注释写明静态路由走自己的 .html（`/album` 本来就由 `${pathname}.html` 规则服务）；`vercel.json` 在兜底规则前加 `/album → /album.html`；typed routes 用 expo-router 自带生成器刷新（`.expo/types/router.d.ts` 有 `/album`）。
- [x] 性能（先测再定，360 × 640、CPU 4× 降速，各 4 次）：地图稳定后点作品册到 19 张卡画出来——19 个 `Stage` 缩略图 618–660ms，最长任务 183ms；静态 `WorkPicture` 564–593ms，无长任务；参照：同条件地图进关卡 593–818ms。直接打开 `/album`（含整包启动，各 3 次）Stage 版 1.56–1.93s、静态版 1.33–1.48s。滚动（三次上滑两次下滑）：从地图进入后两者最差帧都 ≤ 17ms；直接打开后 1.5 秒内开始滚，两者每次都碰到一帧长帧（静态 150–258ms，Stage 183–201ms，其中一次 1991ms）。从地图进入两者都没超过 1 秒；选静态是因为它没有长任务、冷启动平均快约 300ms，而只读卡片用不到 Stage 每块一个的手势。测量用的临时开关已删掉。
- 测试：`AlbumScreen.test.web.tsx`（5，真 Stage）：分组与顺序、卡片数字、每张图的笑脸数（2 = 1 张、17 = 3 张、3 + 4 = 2 张）、没有"x/y"、空状态与回地图、放大后 10 / 5 / 2 在只读工作台上且无沙坑、0.45 秒后只响一次 success、点数字前不说话、点后"十七"、合体说"3 加 4，一共 7"、× 与空白都能收起、静态导出加载中不抛错；`blocks-ui/picture.test.ts`（3）。

## 入口（D-050）

- [x] 地图底栏左侧、⚙ 旁边的作品册按钮（58px，直接点），作品册里有东西才出现。先放在底栏中间，横屏全通时挡住奖杯，改到左边。
- [x] 岛屿收尾页 `bossWork`：先用作品册里的 Boss 图，没有再走原来的（存档里还对的作品 → 参考解），按图自己的工作台尺寸画。
- 测试：`MapScreen.test.web.tsx`（只有完成记录、没有图时没有按钮；有一张图时出现，点了去 `/album`）；`IslandDoneScreen.test.web.tsx`（图在更宽的旧工作台上、整体右移两格，展示的是这张图）；`ParentScreen.test.web.tsx`（重置进度后存档里作品册为空）。

## Checkpoint 16

- [x] `pnpm lint` 0 问题；`pnpm typecheck` 通过；`pnpm lint:purity` 零命中。
- [x] `pnpm test:gate`：50 suite、627 测试全过（Phase 15：47 / 602，没有删测试，新增 25）；覆盖率门禁通过：全部 97.39% 语句 / 92.65% 分支，content 98.41 / 95.34，core 100 / 99.09，progress 98.98 / 97.34（门禁 95%）。无 act / console 警告。
- [x] `pnpm build:web`：7 个静态路由（新增 `/album`）。
- [x] 实际运行（390 × 844 走完整流程，最终构建上重跑一遍）：
  1. 空存档：地图底栏只有 ⚙ 和 ▶，没有作品册按钮（`phase16-1-map-empty`）。
  2. 从地图点 ▶ 进 1 站，拖一块 → 下一站 → 地图跳 → 自动进 2 站；拖两块并排 → 下一站 + 再玩一次（`phase16-2-ch1-n2-solved`）；存档作品册 `ch1-n1`、`ch1-n2`（2 站格子 (1,1)(2,1)）。回地图：⚙ 旁出现作品册按钮（`phase16-2-map-entry`）；点进去两张卡"1""2"（`phase16-2-album-two`）。
  3. 回 2 站，往左边再放一块 → "多了 1 块"，作品 3 块；作品册里 2 站仍是 (1,1)(2,1)，卡片里只有橙色（2）没有黄色（3）（`phase16-3-*`）。
  4. 把多的那块送回沙坑 → 又对了、出现"再玩一次" → 点它：作品 null；作品册仍是 (1,1)(2,1)，两张卡都在。
  5. 预置 1–5 站完成：6 站（同量变身）摆成方阵 → "变个样子！"，作品 4 块，作品册为空、作品册页是空状态；回 6 站从第二步继续，挪两块成长条 → "拼对啦！"、下一站；作品册出现 `ch1-n6`，格子 (0,0)…(3,0)（`phase16-5-*`）。
  6. 刷新作品册页：两张卡还在；点 2 站卡 → 放大，此前没有任何语音；点数字 → 语音记录"二"；× 收起；"回地图" → `/`；按住 ⚙ 800ms → 家长区 → 重置进度 → 确认：存档 `album: []`、完成记录空；作品册页是空状态，地图没有作品册按钮（`phase16-6-*`）。
  7. 冻结夹具 `archive-v1-phase11-ch1-finished.json`：地图正常、没有作品册按钮，`/album` 空状态，`/island/ch1` 照常展示 Boss（走原来的退路）；只读不写，存档仍是 v1 原样（`phase16-7-*`）。
  8. 以上全部页面控制台 0 error / 0 warning。
- [x] 版面（预置 19 站全有图）：360 × 640、667 × 331、390 × 844 下地图三个按钮都在屏内、互不重叠（⚙ 与作品册间距 16px）；作品册页没有横向滚动，卡片两列 / 四列 / 两列且都在屏宽内，"回地图"在屏内；17、3 + 4、8 砖三张放大图的数字、×、工作台都在屏内（横屏左右两栏）。截图 `phase16-map-*`、`phase16-album-*`、`phase16-zoom-*`。

未验证 / 遗留：

- 声音没听（放大时的 success 音、点数字的 TTS）；真机没测（触摸点卡片 / ×、iOS Safari 上 19 张图的滚动）。性能只在桌面 Chromium 的 CPU 4× 降速下测，不等于真机。
- 放大后的过关动作（转圈、开小车、挥手）只看了中途截图，没有录像。
- 旧构建（回滚部署）读新存档"照常玩、只丢作品册"是按代码推断 + "去掉 album 字段后其余解码完全一样"的测试，没有真的用旧构建跑。
- `vercel.json` 的 `/album` 规则没在 Vercel 上验证（项目还没部署）；`/parent` 一直只靠 `cleanUrls`，本轮没动。
- 作品册条目的数字标签用的是当前题库的 `labelOf`。以后某个版本若改了某站要拼的数（像 v4 改 5–9 站那样），旧图会配新数字；到时要在 migrate 里决定这些图怎么办。
- PRD §7 / §12 仍写"未来作品墙……是候选""本地作品墙……不是当前必须决定的事项"，本轮没改 PRD（Phase 13–15 也没改），是否同步由 Ted 定。

# Phase 17：自由玩沙盒（2026-10-15，复审第三档 O，D-051 – D-055）

只做一件事：地图上加一个"自由玩"入口，孩子不做题、随便拼（复审 §4.2"没有沙盒"、§4.8、§5 O）。没有答案，所以不判题；簇变色和点数就是沙盒里的奖励。

验证方式同 Phase 16：内建浏览器面板隐藏不出帧，没用 chrome-devtools；Playwright（npx 缓存）驱动缓存的 headless shell 1223，`isMobile` + `hasTouch`、`deviceScaleFactor` 2，拖拽用 CDP `Input.dispatchTouchEvent`（touchStart、14 次 touchMove、touchEnd），静态产物 `PORT=8791 node tools/serve-dist.mjs`（= `pnpm serve:web`）。语音以替换 `speechSynthesis.speak` 记录；音效以包装 `OscillatorNode.frequency.setValueAtTime` 记录每个音的起始频率（对 / 错音、进站音有自己独有的频率，可以分辨），没有听。版面检查与夹具用 `addInitScript` 预置存档（sessionStorage 标记只写一次），完整流程从空存档真拖。截图 `docs/review-assets/phase17-*.png`。

## 材料与会话（D-051、D-053、D-055）

- [x] `content/sandbox.ts`：`SANDBOX = { blocks: 10, bounds: 6 × 5 }` 一个常量（带注释：改了它旧沙盒会被当损坏丢掉，要先在 migrate 里收起），`sandboxMaterial()` = 10 块单块、都是 1 号红色、无伙伴、id `sandbox-u0…u9`。
- [x] `screens/sandbox-session.ts`（纯逻辑）：`startSandbox`（存档里的摆法或新盒子，撤销为空）、`commitSandbox`、`undoSandbox`、`previewSandbox`、`canUndo`、`tidySandbox`（伙伴整个、散块按托盘位全部送回，算一步历史、受 `MAX_UNDO` 限制；工作台空时返回 null）。没有 verdict、没有步骤。
- [x] 点数复用 `level-session`：`countTap` / `countOrder` / `countProgress` / `recount` / `isCounted` 改成对任何带 `history` + `round` 的会话都能用（只改类型签名，行为不变，关卡测试原样通过）。
- 测试：`content/sandbox.test.ts`（2）、`screens/sandbox-session.test.ts`（6）：提交 / 预览 / 拒绝 / 撤销；全部收回一步清空、托盘回到发牌时的样子、撤销一次全部回来、空时没有空步骤；历史上限；伙伴整个送回；点数的数字、总量、再数一遍、挪动不失效、增减块失效、撤销与收回后的计数。

## 存档（D-052）

- [x] `ProgressState.sandbox: BenchState | null`（初始 null）；reducer 新命令 `saveSandbox`：只改沙盒，同样的工作台（含读回来的等值副本）返回原状态、不写；不需要进过任何站。
- [x] codec：存档末尾（`album` 之后）`sandbox` 字段，null 或工作台 JSON；没有这个字段 = null、不算修复；结构坏了只丢它，记 `sandbox`。`schemaVersion` 仍为 1。
- [x] sanitize：`assertInvariants` 不过或材料不是 `sandboxMaterial()`（`sameMaterial`：尺寸、颜色、托盘位、无伙伴）就丢，记 `sandbox`；空工作台合法。migrate：已知升级、无法识别的版本都原样保留。"重置进度"是新的初始状态，沙盒为 null。
- 测试：`progress/sandbox.test.ts`（10）：不进完成记录、不解锁、不动 `current`（含十块全放上去）；同样的工作台不产生新状态；其他 8 种命令都不清它；往返一致、确定性、是最后一个字段、null 与空工作台往返；去掉字段后其余部分解出来完全一样 + 多一个未知字段照常读（旧构建看到的就是这样）；两份冻结夹具 `sandbox` 为 null、无相关修复、在其上玩沙盒不改完成记录与 `current`；6 种坏字段各只丢沙盒、`loadArchive` 记修复并备份原串；sanitize 5 种错材料丢弃、空的保留；migrate 两条路径保留同一对象。`ParentScreen.test.web.tsx` 新增：重置进度后存档 `sandbox` 为 null。

## 页面 `/sandbox`（D-053 – D-055）

- [x] `screens/SandboxScreen.tsx`：复用 `Stage`（`matched` 恒 false、`mood="calm"`、`celebrateTick` 0、`onFeel = play`），托盘对象由沙盒材料固定算一次；点数徽章 / "再数一遍" / 数完眨眼与关卡相同；空工作台示范手（5 秒、显示 4.2 秒、每次进来最多两次，碰一下收起）。顶部绿色牌子（`sandbox` 图标 + "自由玩 / Free play"），底部 回地图 / 全部收回 / 撤销 三个带字圆按钮（没东西可做时变淡、不响应）；横屏移到左侧竖栏。每次改动派发一次 `saveSandbox`、写一次存档。回地图 `voice.stop()` + `router.dismissTo('/')`。进度没加载完（静态导出）什么都不画。
- [x] `blocks-ui/chrome.ts` 新增 `SANDBOX_CHROME`（顶栏 76 / 64、底栏 96 / 84、竖栏 152）；页面栏高只从这里取。
- [x] `screens/icons.tsx` 新增手绘图标：`sandbox`（三块随手叠、顶上一块歪着、无相框）、`map`（地图上的标记）、`tidy`（箭头进盒）、`undo`（回转箭头）。
- [x] 新路由 `src/app/sandbox.tsx`；`vercel.json` 在兜底规则前加 `/sandbox → /sandbox.html`；`tools/serve-dist.mjs` 注释写明 `/sandbox` 走自己的 .html；typed routes 用 expo-router 自带生成器刷新（`.expo/types/router.d.ts` 有 `/sandbox`）；`package.json` 覆盖率统计加上 `sandbox-session.ts`、`SandboxScreen.tsx`（不在门禁目录里，只是报告）。
- 测试：`SandboxScreen.test.web.tsx`（10，真 Stage，只包一层拿到它的 props 来提交命令）：新盒子 10 块打瞌睡、6 × 5 空工作台、没有云朵 / 下一站 / 再玩一次 / 反馈卡 / 彩纸 / 菜单、全部收回与撤销变淡、无语音无音效；三块一排一张脸、拉开两张脸，`matched` 始终 false、无 success / fanfare / adjust / arrive；被占的格子无预览、弹回、不写；每次拖放 / 全部收回 / 撤销各写一次存档；点数只说"一""二""三""一共 3 块"、音效 count:1 / count:2 / counted:3、再数一遍、加一块后计数失效；全部收回只响 return、撤销回到原样、一步步撤回到空盒后撤销与收回都不动作；回地图 `dismissTo('/')`、重进与刷新后摆法还在、完成记录与 `current` 不变；示范手；英文；冻结夹具 v1 打开空盒、玩了以后完成记录不变；进度未加载不画不抛。

## 入口（D-054）

- [x] 地图底栏右侧、▶ 左边 58px 按钮（`sandbox` 图标，`aria-label` 自由玩 / Free play），一直显示，直接点 → `router.push('/sandbox')`；前进仪式期间整条底栏不接收触摸（原有行为）。
- 测试：`MapScreen.test.web.tsx`：空存档、过了 4 站、过了 18 站三种地图都有按钮，点了去 `/sandbox`，和 ▶ 在同一组、紧挨在 ▶ 前面。

## Checkpoint 17

- [x] `pnpm lint` 0 问题；`pnpm typecheck` 通过；`pnpm lint:purity` 零命中（`content/sandbox.ts` 只引 core）。
- [x] `pnpm test:gate`：54 suite、657 测试全过（Phase 16：50 / 627，没有删测试，新增 30）；覆盖率门禁通过：content 98.42 / 95.34、core 100 / 99.09、progress 99.01 / 97.52（门禁 95%）；全部 97.41% 语句 / 91.84% 分支（比 Phase 16 的 92.65% 低，是因为统计列表新加了 `SandboxScreen.tsx`，它的分支 78.78%：几处"会话还没建好"的早返回没走到）。无 act / console 警告。
- [x] `pnpm build:web`：8 个静态路由（新增 `/sandbox`）。
- [x] 实际运行（390 × 844 走完整流程，空存档）：
  1. 地图底栏 ⚙、自由玩、▶（自由玩在 ▶ 左边 16px、不重叠、在屏内；没有作品册按钮）（`phase17-1-map-empty`）。点自由玩 → `/sandbox`：托盘 10 块、工作台空，没有云朵 / 卡片 / 下一站 / 彩纸（`phase17-1-sandbox-empty`）。
  2. 从托盘拖 3 块到 (1,1)(2,1)(3,1)：工作台上一张脸、三块都是 3 号黄（`phase17-2-three`）；把 (3,1) 拉到 (3,3)：两张脸、两块 2 号橙 + 一块 1 号红（`phase17-2-split`）。
  3. 逐个点三块：语音记录 `["一","二","三","一共 三 块"]`；音的起始频率 261.63 / 523.26、293.66 / 587.32、329.63 / 659.26、783.99、1046.5（点数音阶 + 数完），没有对 / 错音、进站音独有的频率；没有彩纸、没有下一站，出现"再数一遍"（`phase17-3-counted`）。
  4. 存档 `sandbox.bench` 3 块、`completedNodeIds` 空、`current` null；回地图 → `/`；再点自由玩 → 摆法相同；刷新 → 摆法相同（`phase17-4-reloaded`）。
  5. 全部收回 → 工作台空、托盘 10 块，存档里是空工作台（`phase17-5-tidy`）；撤销 → 三块回到原位，存档同步（`phase17-5-undo`）。
  6. 地图 ▶ 进 1 站、拖一块过关：完成记录 `["ch1-n1"]`、`current` ch1-n1；进沙盒（摆法还在）、拖一块、全部收回、撤销：完成记录与 `current` 不变；回地图、按住 ⚙ 850ms → 家长区 → 重置进度 → 确认：存档 `sandbox: null`、完成记录空；再进沙盒是满盒子、空工作台（`phase17-6-after-reset`）。
  7. 冻结夹具 `archive-v1-phase11-ch1-finished.json`：地图有自由玩按钮，`/sandbox` 托盘 10 块、工作台空；只看不动时存档仍是 v1 原样、没有 `sandbox` 字段（`phase17-7-v1-*`）。
  8. 以上全部页面控制台 0 error / 0 warning。
- [x] 版面（预置：全通 + 一张作品册图 + 沙盒里 2 和 1）：390 × 844、360 × 640、667 × 331 下地图四个按钮（⚙、作品册、自由玩、▶）都在屏内、互不重叠，地图打开时和滚到底时彩旗 + 奖杯都不在任何按钮下面；沙盒页 10 块都在屏内（托盘 7 + 工作台 3）、托盘在屏内，牌子与三个按钮在屏内且不压托盘和积木，没有页面滚动。积木：390 × 844 工作台 / 托盘 61 / 61px，360 × 640 56 / 56px，667 × 331 61 / 44px（横屏托盘在右侧两列）。截图 `phase17-layout-map-*`、`phase17-layout-sandbox-*`。

未验证 / 遗留：

- 声音没听（只核对了起始频率）；真机没测（触摸拖放、长按、iOS Safari 下的示范手与按钮）。
- 旧构建（回滚部署）读新存档"照常玩、只丢沙盒"是按代码推断 + "去掉 `sandbox` 字段后其余解码完全一样 / 多一个未知字段照常读"的测试，没有真的用旧构建跑。
- `vercel.json` 的 `/sandbox` 规则没在 Vercel 上验证（项目还没部署）。
- 竖屏 390 × 844 下托盘只用到两行，下面一大片空沙（同已知遗留"工作台变小后托盘大片空沙"，沙盒里也一样，没改托盘高度）。
- 沙盒坏了被丢掉时，家长区沿用"有几站的存档和当前题库对不上，已重置这些站"那句话（作品册坏了也是这句），不准确，没改。
- 沙盒作品不进作品册（D-055，后续）。

## 交给 review（2026-10-15，Ted 要先让 agent review 再决定下一步）

本节把本轮聊天里的最终报告落到文档里。前几轮的"需要 Ted 决定"只写在聊天里，这里一并补上。没有执行任何 git 命令，改动都在工作区。

### 改动范围

新增：

- `src/content/sandbox.ts` + `sandbox.test.ts`：沙盒材料与常量 `SANDBOX`。
- `src/screens/sandbox-session.ts` + `sandbox-session.test.ts`：沙盒会话（纯逻辑）。
- `src/progress/sandbox.test.ts`：存档字段的全部规则。
- `src/screens/SandboxScreen.tsx` + `SandboxScreen.test.web.tsx`：页面。
- `src/app/sandbox.tsx`：路由。
- `docs/review-assets/phase17-*.png`：20 张截图。

修改：

- `src/progress/schema.ts`（`sandbox` 字段）、`migrate.ts`（初始 null + 注释）、`codec.ts`（读写 `sandbox`）、`sanitize.ts`（结构与材料检查；`drawable` 多一个"空工作台合法"参数）、`reducer.ts`（`saveSandbox`）。
- `src/screens/level-session.ts`：只改类型，点数函数改为对 `Counting`（`history` + `round`）泛型；行为不变。
- `src/screens/MapScreen.tsx`：▶ 左边的入口按钮、文案、`rightButtons` 样式。
- `src/screens/icons.tsx`：新图标 `sandbox` / `map` / `tidy` / `undo`。
- `src/blocks-ui/chrome.ts` + `index.ts`：`SANDBOX_CHROME`。
- `src/content/index.ts`：导出 `SANDBOX`、`sandboxMaterial`。
- 测试：`MapScreen.test.web.tsx`（入口 1 条）、`ParentScreen.test.web.tsx`（重置清空沙盒 1 条）。
- 配置：`vercel.json`（`/sandbox` 规则）、`tools/serve-dist.mjs`（注释）、`package.json`（覆盖率统计列表加两个文件）、`.expo/types/router.d.ts`（生成文件，用生成器刷新）。
- 文档：`docs/discussion-and-decisions.md`（D-051 – D-055）、本文件 Phase 17、`README.md`（"当前实现"里玩法、存档两句，门禁结果指向 Phase 17）。

没碰：`Stage.tsx` 内部、`LevelScreen.tsx`、关卡的任何行为、PRD、`src/progress/__fixtures__/`。

### 建议 review 重点看

1. 存档兼容：`codec.ts` 的 `sandbox` 解码、`sanitize.ts` 用 `sameMaterial(sandbox, sandboxMaterial())` 判材料。"旧构建读到新存档不会清零"只有代码推断 + 测试（去掉字段 / 多一个未知字段），没用旧构建真跑。
2. `level-session.ts` 的泛型改动：确认只动了签名、关卡行为没变（关卡原有测试全过）。
3. `tidySandbox` 手工拼 `History`（没走 core 的 `commit`），`past` 按 `MAX_UNDO` 截断，和 `commit` 一致；收回失败会抛错（按不变量 1 不会发生）。
4. `SandboxScreen.tsx` 在回调里读 `sessionRef`，和 `LevelScreen` 同一写法；渲染期间不写 ref。
5. 入口紧挨 ▶（间距 16px）：会不会误触 ▶，要真机看。
6. 示范手是助手补的（D-053），brief 里没要求。
7. `SANDBOX` 常量以后一改，旧存档里的沙盒会被当成损坏丢掉，家长区显示"已修复"。到时要先在 migrate 里安静地收起。
8. 沙盒或作品册坏了被丢掉时，家长区用的还是"有几站的存档和当前题库对不上，已重置这些站"，文案不准确，没改。

### 怎么复现

- 门禁：`pnpm lint && pnpm typecheck && pnpm lint:purity && pnpm test:gate && pnpm build:web`。
- 浏览器：`pnpm build:web` 后 `PORT=8791 pnpm serve:web`，按 Checkpoint 17 的 1–8 步和版面检查走一遍。本轮用的 Playwright 脚本（`harness.mjs`、`flow.mjs`、`layout.mjs`）在会话草稿目录 `/private/tmp/claude-503/-Users-tedliang-Desktop-AI-Projects-amber-blocks/b59ca19c-b626-4466-9a5a-27ddedff4f54/scratchpad/`，不在仓库里，系统清理临时目录后就没了。

### 需要 Ted 决定

之前几轮留下、仍未决定的九项：

1. 10 号的颜色（D-039 改成丁香紫，放弃了"10 是白的"）。
2. 关卡里没有回地图（D-043，回地图只在家长区）。
3. 过关回地图后 0.9s 自动进站（D-041）。
4. 8 砖由两个 4 组成（D-044）。
5. 旧存档里 5 / 6 / 8 / 9 站的作品被收起（内容版本 4）。
6. 撤销回到对的样子时作品册也更新（D-048）。
7. 进站时补录旧作品进作品册（D-048）。
8. 作品册标题"我的作品 / My builds"。
9. PRD 要不要同步作品册（PRD §7 / §12 仍写作品墙是候选）。

本轮新增：

10. 沙盒材料：现在是 10 块单块、无伙伴、无配色选择。要不要加伙伴、更多块，或者 PRD 3.2 的"自由配色"？
11. 入口位置：现在在 ▶ 左边，还是改放左边一组（⚙、作品册旁）？
12. 沙盒作品要不要进作品册？作品册按站 id 存，需要一个"拍下来"之类的动作。
13. 沙盒里撤销按钮常驻在底栏，关卡里撤销在菜单里，要不要统一？
14. 家长区的修复文案对沙盒 / 作品册不准确，要不要改？
15. 沙盒里的示范手（助手补的）留着还是去掉？

### 已知遗留（按 brief 不顺手修）

- 3 号黄在毛毡上的对比度只有 1.37:1。
- `docs/level-progression.md` 里 5–9 站的描述过时。
- 工作台变小后托盘大片空沙：沙盒在 390 × 844 下也一样，托盘只用到两行。
- 作品册的数字标签用的是当前题库的 `labelOf`。

### 下一轮建议（第三档剩下的 N / P / R 选一项）

推荐 R（合体瞬间"变成 7"的视觉事件）：

- 只动界面层，范围小、风险低，能在浏览器里完整验证。
- 补的是加法最核心的那一刻：现在 3 和 4 合上以后仍是两种颜色、两张脸，"7"只出现在云朵算式里，没有"变成 7"的瞬间（复审 §4.5）。分数最低的"奖励 / 多巴胺"（4 分）和"趣味性"（5 分）都直接受益。

另外两项：

- P（拆分命令 + 第三章"拆开岛"）教学价值最大，但要改 core、内容和规格，建议等真机和孩子试玩之后再做。
- N（"换一题"接 `newVariant`）引擎成本最低，但多数站换出来只是托盘顺序和诱饵不同，新鲜感有限；按钮放哪、孩子懂不懂也要先定。

# Phase 18：落实第四轮测评的第一档 + 布局预算（2026-10-16，依据 [full-review-2026-10-16](../docs/full-review-2026-10-16.md) 第 6 节第一档 1–6、第二档 7，D-056 – D-067）

只做测评第 6 节第一档 1–6 和第二档 7，其余不碰。没有执行任何 git 命令；没有新增依赖；没改 `src/progress/__fixtures__/`、`AUTO_SPEECH`；没加任何语音。

验证方式：chrome-devtools MCP 本会话连不上（启动时 `CONNECTION_CLOSED`），改用 Phase 16 / 17 的 Playwright（npx 缓存，headless shell 1223），`isMobile` + `hasTouch`、`deviceScaleFactor` 2（1280 × 800 用桌面 × 1），拖拽用 CDP `Input.dispatchTouchEvent`（touchStart、14 次 touchMove、touchEnd），静态产物 `PORT=8791 pnpm serve:web`（= `node tools/serve-dist.mjs`）。存档种子用 `progress` 的 `reduce` + `serialize` 生成：把 src 的纯逻辑编译到会话草稿目录，逐站跑参考解，得到"全通且每站作品是对的""全通无作品"两种（中 / 英），另留一份内容版本 4 的旧档测升级。语音以替换 `speechSynthesis.speak / cancel` 记录；音效以包装 `OscillatorNode.frequency.setValueAtTime` 记录频率与排程时间；没有听。截图 `docs/review-assets/phase18-*.png`（20 张）。脚本在会话草稿目录 `/private/tmp/claude-503/-Users-tedliang-Desktop-AI-Projects-amber-blocks/6e991c51-fc17-4a75-90f8-87a914b573d3/scratchpad/`（`harness.mjs`、`c21`–`c27d.mjs`、`gen-seeds.cjs`、`matrix.cjs`），不在仓库里。

## 2.1 出屏（D-056）

- [x] `IslandDoneScreen.tsx`：竖屏"去下一岛 / 回地图"移出 ScrollView，做成固定页脚 `island-footer`（上 4、下 12px）；横屏两栏不变。
- [x] `LevelScreen.tsx`：横屏侧栏里岛尾按钮用新文案 `island.done.short`（"完成！/ Done!"，`copy.ts` 中英各一）；竖屏出现"X 岛完成了"时旁边的"再玩一次"改圆形图标键（英文"Number Island done!"在 360–390 宽把"下一站"挤出右边，测评 L-1）；舞台沙丘层 `pointerEvents="none"`（`testID="ground"`）。
- 测试：新增 `screens/layout-fit.test.web.tsx`（53 条）。`blocks-ui/devices.ts` 的 13 个视口 × 中英：关卡页（ch1-n12、ch2-n7 答对）的 `next` 在固定的一行里（不在舞台、不在滚动区）；竖屏头 / 卡 / 底栏从真实组件的计算样式读出，加上安全区后剩下的高度正好等于 `devices.ts` 的舞台高度（> 200），按钮高 ≤ 底栏；横屏是短文案；沙丘 `pointer-events: none`；岛收尾页竖屏按钮在 `island-footer`（根节点的直接子节点、不在滚动区），横屏在左栏。jsdom 没有排版引擎，所以这是"结构 + 栏高预算"测试，像素在浏览器里量。反证：去掉沙丘的 `pointerEvents` / 把短屏底栏改成 40px，测试都会红（改回后绿）。

## 2.2 过关与前进打磨包（D-057 – D-059）

- [x] `screens/progress-store.tsx`：`loadArchive` 报 `upgraded` 或 `repaired` 时，`adopt` 里立刻经同一个 saver `save(state)` 一次；干净的存档不写。
- [x] `LevelScreen.tsx onNext`：当前 `verdict.matched` 不是 true → 只 `router.replace('/')`；按钮文字此时是 `text.done`（"回地图"）。D-038 的"常驻"保留。
- [x] `MapScreen.tsx`：`SKIP_AFTER_MS = 300`，覆盖层改走 `onSkip`（打开时刻在首个 effect 里记，之前一律不跳）；自动进站的定时器不受影响；落地改响 `tap`。
- [x] `audio-i18n/sfx.ts`：`SOLVE_AFTER = 0.1` 加到 `success` / `fanfare` 每个音的 `at`（`fanfare` 最晚 1.27s 结束，`sfx.test.ts` 的 1.3s 上限仍过）。
- 测试：`progress-store.test.web.tsx` +3（v1 夹具载入后、什么都不动，存档 `contentVersion` 已是当前版本，备份是原串，二次载入 `issue` 为 null、`upgraded` 为空；坏的 `album` 修复后写回、二次载入 ok；干净存档载入不写）。`LevelScreen.test.web.tsx`：review B 用例改为"多放一块 → 按钮'回地图'，只调用 `replace('/')`；重新打开改回对 → '下一站'带 `from/to`"；新增"合体岛最后一站改错 → '回地图'、不进收尾页"。`MapScreen.test.web.tsx`：落地音 `arrive` → `tap`；"点一下立刻进入"改为"刚打开时的连点不算、旅行标记还在，300ms 后点一下进入且只一次"。

## 2.3 点数与首个握把站（D-060 – D-062，内容版本 5）

- [x] `blocks-ui/layout.ts countTarget`：点中的块已数过 → `null`；只有没点中块（伙伴外框的空隙）时才用半格容差；找不到返回 `null`（原来返回 `hit`）。
- [ ] `Stage` 对 `null` 让该块眨一下：没做（测评标"可选"；要给 `UnitView` / `PartnerView` / `BlockBody` 加第二个 wink 属性，`useWink` 的 tick 一换就眨，不能复用现有的 `wink`）。
- [x] `voice.stop()`：`LevelScreen` 与 `SandboxScreen` 的 `onRecount` 开头；提交（两处的 `update`）与关卡撤销时，若 `countWordsStale(before, next)`（`level-session.ts` 新纯函数：本轮已有数词且工作台上的块集合变了；只挪位置不算）。
- [x] `content/catalog/chapter-1.ts` ch1-n5 `extra: 2 → 3`；`CONTENT_VERSION = 5`，`CONTENT_CHANGES[5] = [ch1-n5]`；`fingerprint.test.ts` `FINGERPRINT_VERSION = 5`，ch1-n5 `9fd3b722 → e33c688f`，其余 18 站不变。
- [x] `COUNT_TO_PASS: ReadonlySet<NodeId>`（`content/catalog/index.ts`，默认 `new Set()`，注释写明用途与 5 个 Boss 候选），经 `content` 导出；`LevelScreen`：集合里的站、本次进站前没完成、已答对但还没数完 → 整行（再玩一次 + 下一站）不出现。默认空集，行为不变。
- 测试：`layout.test.ts` countTarget 用例改写（数过的块中心 / 右缘 / 下缘都是 null；同一块两次只得一个数；空隙仍数半格内最近的未数块、跳过数过的、找不到为 null）。`level-session.test.ts` +1（`countWordsStale`：没数过不算、挪位置不算、加块 / 拿走 / 换块都算）。`LevelScreen.sound.test.web.tsx` +1（数完 7 块后点再数一遍：stop 恰在 8 句之后；新一轮数两个后把 4 送回：stop；再点从"一"开始）。`upgrade.test.ts` +3（v4 → v5：5 站比 v4 多一块单块且只多这一块；旧作品对不上 → 收起，完成记录、作品册旧图、后续解锁保留，1 站作品原样；没作品的 v4 存档安静升级；经 `loadArchive` 报 `upgraded`、列出 ch1-n5、原串进升级备份）。`hints.test.ts` +1（5 站：四块单块是 building "还不到 5，再拿一块"，五块单块与 3 + 2 都对）。`catalog.test.ts` / `tray.test.ts` 改 5 站的期望（extra 3；托盘对象 `[3,1,1,1,1,1]`）。`LevelScreen.test.web.tsx` +1（用 mock 把 ch1-n2 放进 COUNT_TO_PASS：答对并记完成，但数完两块才出现两颗按钮；重新进站直接有；真正的常量是空集）。

## 2.4 错误态的非文字指向（D-063、D-064）

- [x] `screens/hints.ts`：`pairPlan` 里"送回两个、拿两个、工作台上两个的和正好等于目标"时返回 `hint.same-sum`（"{x} 加 {y} 也是 {n}！再找 {a} 和 {b}" / "{x} plus {y} is {n} too! Now find {a} and {b}"），x、y 按工作台从左到右，focus = 工作台那一对 + 托盘要拿的那一对；新 `leftToRight` 与 `apartPair` 共用。第一级不变。
- [x] `AnswerFeedback.tsx`：新属性 `nudge`；值变大时喇叭圆盘按 Spotlight 的 `withRepeat` 写法放大到 1.28 再回落、两次（4 × 240ms），重挂载不重播，减少动效不动；`LevelScreen`：`NUDGE_AFTER_MS = 3000`，"需要调整"且没求过助、菜单关着、静止（提交、点数、拖动都重新计时）3 秒后 `nudge = 1`，每次进站最多一次；点过卡片 / 帮助后不再提示。
- [x] `ui.tsx ParentGate`：短按 `play('tap')` + 120ms 小晃（−4 / 4 / −2 / 0，减少动效不晃），仍不打开；`LevelScreen` 菜单里 `size` 40 → 48。
- [x] 云朵：`onPress` / `accessibilityRole` / `accessibilityLabel` / `testID="prompt"` 挪到包住 `Cloud` 的 `Pressable`，Boss 星星 `pointerEvents="none"`。
- [x] `hitSlop`：`RoundButton` 与 `ParentGate` 改成外层 `Pressable` 带 `padding: 8, margin: -8`、里面一层 View 画圆（布局占位不变，触摸区每边多 8px）。
- 测试：`hints.test.ts` +1（ch2-n7 放 5 + 2：第一级仍"我们先找 3 和 4"、不点亮；第二级中英句子与四个点亮对象；2 在左时读"2 加 5"；卡片显示同一句）。`LevelScreen.sound.test.web.tsx` +2（3 秒前不提示、点数重新计时、到点喇叭 testID 变 nudge-1、全程没说话；改对再改错不再提示；先点过卡片的不提示）。`MapScreen.test.web.tsx`：家长门短按只有一声 `tap`、不跳转。

## 2.5 颜色（D-065）

- [x] `Stage.tsx` 吸附虚影：底 `THEME.previewFill`（`rgba(43,54,69,0.10)`），虚线 `THEME.preview`（改为中性 `#5F6D7E`）。`LevelScreen` / `SandboxScreen` 计数芯片字、边、底边改 `THEME.ink`。
- [x] `palette.ts` n3 `edge: '#9C7B08'`（deep 仍 `#866B0F`）；`MapScreen` 睡着的站描边用 `colors.edge`，数字去掉 `opacity: 0.75`。
- [x] `palette.test.ts`：全部 10 色——fill 对毛毡 / 沙 ≥ 1.5（3 号是命名例外 `PALE_FILL`：1.37 / 1.15）；edge 对毛毡 / 沙 / 白 ≥ 3；睡着的站按渲染合成（整站 0.92 透明压在沙上）数字 ≥ 3、edge 描边 ≥ 2.5，另断言旧的 0.75 叠加确实不到 3；两两色相 ≥ 15°；语义守门：`leaf / leafDeep / preview / amber` 要么近灰（OKLCH C < 0.05）要么与每个 fill ≥ 15°，冲突清单必须正好是 `KNOWN_CLASHES = ['leaf/n4', 'leafDeep/n4']`（11.4° / 6.8°，没改 leaf，交 Ted）。
- 说明：brief 写的 pale 断言是"deep@0.75 压 pale@0.92 压 sand ≥ 3:1"，但同一条要去掉 0.75；按 0.75 算 10 色里 7 色只有 2.59–2.81，所以测试断言的是去掉之后的真实渲染（3.24–4.37），并另加一条说明旧值不过。

## 2.6 壳与元数据（D-066）

- [x] `public/manifest.json` `orientation: "any"`；`icon-512.png` / `icon-180.png` 用 sips 缩到真实尺寸、PIL MAXCOVERAGE 256 色量化：512 × 512 57,136 B、180 × 180 10,929 B（原来都是 1024 × 1024 / 799,005 B）。图仍是 Expo 模板的蓝色 "A" 占位图。
- [x] `vercel.json` `headers`：`/:path((?!_expo/static/).*)` → `Cache-Control: no-cache`；`/_expo/static/(.*)` → `public, max-age=31536000, immutable`（两条不重叠，负向前瞻按 Vercel 文档 redirect 示例的写法）。
- [x] `src/app/_layout.tsx`：`useFonts` 两份 `{ uri: require('@expo-google-fonts/fredoka/600SemiBold/…ttf'), display: FontDisplay.SWAP }`（700 同），不再 import 包的 index（它 require 全部五个字重）；新 `DocumentMeta` 用 expo-router `Head` 设 `<title>Amber Blocks</title>` 与 `<html lang>`（随 `state.language`：zh-CN / en）。`+html.tsx` 去掉重复的静态 `<title>`（导出的 html 里原来是空的 `<title data-rh>` 在前、所以标题为空）。
- [x] `progress-store.tsx reset`：新初始状态带上当前 `language`。
- 测试：`ParentScreen.test.web.tsx` +1（英文存档重置后存档语言仍是 en、完成记录与站都清空）。

## Checkpoint 18-1（2.1 – 2.6）

- [x] 门禁（每项做完都跑了五条，全绿）：基线 54 suite / 657 测试；2.1 后 55 / 710；2.2 后 55 / 714；2.3 后 55 / 721；2.4 后 55 / 724；2.5 后 55 / 726；2.6 后 55 / 727。`pnpm lint` 0 问题，`pnpm typecheck` 通过，`pnpm lint:purity` 零命中，`pnpm build:web` 8 个静态路由。2.3 后覆盖率：content 98.42 / 95.34、core 100 / 99.09、progress 99.01 / 97.52（语句 / 分支，门禁 95）。没有删测试；改了期望的旧测试都写在上面各项。
- [x] 浏览器（每项控制台 0 error / 0 warning）：
  1. 2.1：375 × 553 `/island/ch1` 按钮 y 485–541（屏高 553），页面没滚动，中心命中按钮（`phase18-21-island-375x553`）。667 × 331 / 667 × 375 / 1024 × 768 / 1280 × 800 的 ch1-n12、ch2-n7（答对，中英）`next` 底边分别 325–327 / 369–371 / 762–764 / 794–796（都 ≤ innerHeight），95% 宽处 `elementFromPoint` 都命中 `next`；文案"完成！/ Done!"（`phase18-21-next-ch1-n12-667x331`、`-1024x768`）。英文 360 / 375 / 390 竖屏答对行：圆形再玩一次 + "Number Island done!" 都在屏内（360：x 39–83、95–321）。
  2. 2.2：ch1-n1 拖一块过关：drop 330Hz 排在 t=981ms、success 523.25Hz 在 1081ms（晚 100ms）。点"下一站"一次：振荡器 880、880、659.25、987.77——进站音只一次。双击"下一站"：CDP 能做到的最短间隔是 +135 / +151 / +158 / +189 / +190 / +206ms（几轮），第二下都落在刚打开的地图上：旅行标记照常出现，`/play/ch1-n2` 在第一下之后 2142–2184ms 才打开，659.25 只一次（brief 的"100ms 内"在脚本里做不到，最短 135ms）（`phase18-22-solved-ch1-n1`）。
  3. 2.3：ch1-n3（73px 块）同一块点两下、再点它右缘（旁边就是未数的块）：只说"一"，芯片 1（`phase18-23-count-once`）；数完 4 块点再数一遍：`speechSynthesis.cancel` 紧跟其后。ch1-n5：托盘是 3 号伙伴（183px）+ 五块单块（61px），拖五块单块 → "拼对啦！"+ 下一站（`phase18-23-n5-singles`）。v4 旧档（全通、每站有对的作品）打开地图、什么都不动：存档已是内容版本 5，`progress.before-upgrade` 有原串，ch1-n5 作品被收起；刷新后家长区不再显示升级提示。
  4. 2.4：云朵 `prompt` 135 × 100，左下角也命中，点它说"把 三 和 四 合起来"。ch2-n7 拖 5 + 2 接起来 → 卡片"数量够了，再找对伙伴"；点卡片 → "5 加 2 也是 7！再找 3 和 4"，4 个光圈分别套在工作台的 5、2 与托盘的 3、4 上，说"五 加 二 也是 七！再找 三 和 四"（`phase18-24-same-sum-help`）。ch1-n2 放三块不动：最后一次落下后约 3.0s 喇叭 testID 变 nudge、最大 scale 1.28，期间没有任何语音。地图 ⚙ 短按：响 880Hz、translateX 在 −4 … 4 之间走一遍、仍在 `/`；⚙ 画 48、触摸区 64 × 64；菜单里的 ⚙ 画 48 × 48。
  5. 2.5：ch1-n3 放 3 块黄、拿起第 4 块（绿）停在 (1,1) 上：虚影底 `rgba(43,54,69,0.1)`、虚线 `rgb(95,109,126)`，不是绿（`phase18-25-ghost-ch1-n3`）；计数芯片字与边 `rgb(43,54,69)`（`phase18-25-chip-ink`）；空存档地图上睡着的 ch1-n4（3 号 Boss）描边 `rgb(156,123,8)`、整站 0.92、数字不透明 1（`phase18-25-map-sleeping`）。
  6. 2.6：中英 × `/`、`/play/ch1-n2`、`/album`、`/parent`、`/sandbox`、`/island/ch1`：`document.title` "Amber Blocks"，`html lang` zh-CN / en，两个 FontFace 都是 `display: swap`，只请求了两份 ttf；`/manifest.json` `orientation: any`；`dist/assets` 下只有 Fredoka 600 / 700；`sips` 核对两张图标 512 / 180。

## 2.7 布局预算重分配（D-067）

- [x] `blocks-ui/layout.ts`：`StageGeometry` 新增 `trayZone`；`computeGeometry` 先按原规则选格子（`chooseGeometry`），再 `settle`：托盘在下方时高 = min(可用, 排布行高 + 2 × `TRAY_PAD` + `TRAY_SLACK` 24)，省下的一半放到工作台上方（工作台 + 托盘整体垂直居中），`trayZone` 从托盘顶到舞台底（减 gap）；`resolveDrop` 用 `trayZone` 判"放回"。缩放比例不变（封顶后的托盘按同一比例放得下），游戏中托盘不重排。`WIDE_MAT_COLS = 8`：8 列及以上工作台的左右边距可以为 0。
- [x] `blocks-ui/chrome.ts`：`compact` feedback 70 → 56、footer 64 → 52。为了放得下：`PillButton` 新增 `compact`（`paddingVertical 7`、`minHeight 44`），关卡短屏的再玩一次 / 下一站用它；短屏底栏顶对齐；圆形"再玩一次"短屏 44px。
- [ ] side 排布"只为当前在托盘的对象留位（归还时不重排）"：没做。托盘对象与位置开题即固定（D-032 / D-034），"归还时不重排"就必须为每个对象留位，与"只为当前在托盘的对象留位"冲突；含义要 Ted 澄清。
- 测试：`layout.test.ts` 栏高预算改为 80 + 56 + 4 + 52、SE 舞台 375 × 361（浏览器实测 361）；新增"layout budget" 5 条：PHONES × 19 站 × 3 个 variant 的工作台格与托盘块 ≥ 40，不到 40 的必须正好是清单里的四处与数值；390 × 844 的 1 站与 3 + 4 站空沙 ≤ 40% / 45%、工作台 + 托盘上下留白相差 ≤ 1px；360 × 640 的 ch1-n6 托盘高 ≥ 托盘块 + 16；托盘下方 30px 的沙地松手是"放回"、工作台仍是工作台；8 列工作台 48px、6 列仍留边距。`tray.test.ts`（任一伙伴搬出其余位置比例不变等）原样全绿。

## Checkpoint 18-2（2.7）

- [x] 门禁：`pnpm lint` 0 问题；`pnpm typecheck` 通过；`pnpm lint:purity` 零命中；`pnpm test:gate` 55 suite / 732 测试全过（9.6s），覆盖率：全部 97.44 / 92.92（语句 / 分支），content 98.42 / 95.34、core 100 / 99.09、progress 99.01 / 97.52（门禁 95%）、blocks-ui（layout / tray）97.96 / 91.11、screens 94.92 / 88.85；`pnpm build:web` 8 个静态路由，dist 4.6 MB → 2.9 MB（图标与字体），JS 2,420,897 B。
- [x] 纯布局数字（`devices.ts` 的 13 个视口 × 19 站 × 3 个 variant，取每站最小）：不到 40px 的从 8 处降到 4 处。剩下：iPhone SE 竖屏 375 × 553 的 ch1-n12 **34**（原 34，没提高）、Android 360 × 568 竖屏 ch1-n12 **34**（原 32）、Android 640 × 304 横屏 ch1-n11 / ch1-n12 **38**（原 38）。原因：17 站的托盘在 375 / 360 宽是"宽度受限"——最矮的排法把 5 + 2 + 1 + 1 放一行，九块加三道缝要塞进 335px 内宽，34px 封顶；多给的 26px 高度帮不上。草稿里试过托盘贴边 + 缝 6px，最多到 37px，不值得改，交 Ted 决定。390 × 844：1 站托盘空沙 65% → **19%**，3 + 4 站 72% → **17%**，3 + 4 的块 45 → **48px**；360 × 640 ch1-n6 托盘高 **77** ≥ 托盘块 46.2 + 16。
- [x] 浏览器（与纯布局数字一致；控制台 0 error / 0 warning）：
  1. 舞台实测：375 × 553 舞台 375 × 361；390 × 844 ch1-n1 托盘 366 × 124、内容 100 → 空 19%；ch2-n7 托盘 366 × 144、空 17%、块 48；360 × 640 ch1-n6 托盘 77 高、块 46.2；375 × 553 ch1-n12 托盘块 34（截图 `phase18-27-ch1-n12-*` 与 `phase18-27-ch1-n1-*` 各 390 × 844、375 × 553、360 × 640、667 × 331 四张；`phase18-27-ch2-n7-360x640` 是 8 列工作台贴满宽度、木框在屏边被裁掉一点）。
  2. 390 × 844 ch1-n1：块拖到工作台，再拖到托盘下沿以下 40px 的沙地松手 → 回到托盘，响放回音。
  3. 短屏底栏（375 × 553、360 × 640，中英，ch1-n11 答对）：再玩一次 / 下一站都是 44px 高、底边距屏底 8px，底下的 4px 硬边在屏内。
  4. 短屏反馈卡 56px：在 360 × 640 与 375 × 553 上取卡片说明 / 标题的真实字体和宽度（226 / 241px），用 canvas 量了 `copy.ts` 全部 feedback / hint / prompt 句子（中英、数字取 17 / 10 等最长），没有一句超过一行。
  5. 回归：2.1 – 2.6 的浏览器脚本在 2.7 之后全部重跑，全过（期间发现并修了一处：短屏底栏里 48px 的圆形再玩一次加上 4px 硬边正好顶到屏底，改为 44px）。

未验证 / 遗留：

- 声音没听（只核对了频率与排程时间）；真机没测（见下"只能真机确认"）。
- chrome-devtools MCP 连不上，浏览器验证全部是 Playwright headless；没有在内建浏览器或真机上看。
- 可选的"已数过的块眨一下"没做；side 排布"只为托盘里的对象留位"没做（见上）。
- 17 站在小屏仍 34px（见 Checkpoint 18-2）；Android 640 × 304 横屏 12 / 17 站 38px。
- 375 × 553 的 ch1-n6 是右侧窄托盘（59px 宽）的竖屏 side 排布：这是原有算法在旧舞台（335px）上就会选的，不是本轮造成的，没改。
- 8 列工作台贴满宽度后，木框在 360 宽的屏边被裁掉几像素（截图可见）；若不喜欢，把 `WIDE_MAT_COLS` 的边距改成木框宽 7px 即可（块会小 1–3px）。
- `vercel.json` 的缓存头没在 Vercel 上验证（未部署）。
- 安静的内容升级（存档版本旧、但没有任何站被收起）仍不写回（`issue` 为 null）；只是每次打开都在内存里迁移一次，家长区不显示任何东西，没改。
- 规格与 README：`SPEC-screens.md`（结构树补岛收尾 / 作品册 / 沙盒三页与 `/island` `/album` `/sandbox` 三个路由，菜单改为当前的四项 + 家长门，调整卡图标 💡，本轮的前进按钮、云朵、喇叭提示、同和帮助、家长门短按、点数、短屏栏高）、`SPEC-blocks-ui.md`（托盘高度规则、`trayZone`、8 列、点数容差、中性虚影）、`SPEC-content.md`（目录表更新到内容版本 5、`bounds` 规则改为 D-037、`COUNT_TO_PASS`）、`SPEC-progress.md`（升级 / 修复写回）、`SPEC-audio-i18n.md`（`SOLVE_AFTER`、落地 tap、数词停止）、`SPEC-web-shell.md`（标题 / lang、manifest、字体、缓存头）、README「当前实现」对应句子都已同步。`docs/level-progression.md`、PRD 等测评 O 节列的其他文档不在本轮范围，没动。

### 需要 Ted 决定

本轮新增：

1. `COUNT_TO_PASS` 要不要启用、启用哪些站（D-062）。测评说"4 个 Boss"，实际有 5 个：ch1-n4（3 转角）、ch1-n8（8 砖）、ch1-n12（17）、ch2-n4（自由和 5）、ch2-n7（3 + 4）。
2. 17 站在 375 × 553 / 360 × 568 的托盘块 34px（宽度受限）怎么处理：接受；托盘贴边 + 缝 6px（最多 37px）；或改 17 的托盘内容（例如去掉诱饵 4 或换小一点的诱饵，要升内容版本 6）。
3. 3 号黄的 fill 在毛毡 / 沙上只有 1.37 / 1.15:1（本轮只加深了 edge）：要不要换一个更深的黄。
4. 成功绿 `leaf` / `leafDeep` 与 4 号块的绿只差 11° / 7°（本轮把虚影与计数芯片移开了绿色，成功色本身没改）：要不要换成功色。
5. 家长门短按现在响一下、晃一下（改了 D-043 的"短按没有任何反应"，D-064）：保留还是恢复完全无反应。
6. 竖屏"X 岛完成了"旁边的"再玩一次"改成了圆形图标键（D-056）：视觉上是否接受。
7. side 排布"只为当前在托盘的对象留位"的确切含义（与固定托盘冲突，见 2.7）。
8. 8 列工作台贴满屏宽、木框被裁：接受，还是留出木框宽度。
9. 图标仍是 Expo 模板占位图：需要正式图标美术。

brief 第 4 节列出、本轮按要求没做的：

10. 散块站托盘是否不按目标色染（A-3a）。
11. 超过目标的簇是否不按簇大小变色（F-1b）。
12. 合体岛"干扰对等于目标"（2-3 的 3+1、2-5 的 1+4、2-6 的 2+3、2-7 的 5+2）是有意还是无意（C-2；本轮只改了求助句与点亮）。
13. `audioSession` playback（现状）还是 ambient。
14. 要不要 service worker（离线壳）。
15. 沙盒示范手去留、沙盒要不要伙伴、关卡与沙盒的撤销入口统一。
16. 合体岛调序 / Boss 改 `sum_composition`。
17. 内容池与"换一题"。

另：Phase 17 末尾"需要 Ted 决定"的 1–15 条仍未决定。

### 只能真机确认

- 声音：落地声与晚 0.1 秒的过关音听起来是不是"先咚后叮"；地图落地的轻 tap 是否太弱；低频音在手机喇叭上。
- 双击"下一站"：真实手指的第二下间隔（脚本最快只能 135ms）；300ms 的门槛会不会让想跳过的家长觉得"点了没反应"。
- 喇叭放大两次孩子会不会注意到、会不会去点卡片。
- 家长门：iOS Safari 长按 600ms 是否仍被系统菜单 / 放大镜抢走；短按的晃动家长能否看懂。
- 34–40px 的块（17 站小屏、横屏 12 / 17 站）真实手指的抓取率。
- 短屏 44px 按钮、距屏底 8px：Safari 底部工具栏伸缩时是否被盖住。
- `font-display: swap` 首次打开时字体从系统圆体换成 Fredoka 的跳动是否明显。
- manifest `orientation: any`：添加到主屏幕后横屏是否可用；新图标在主屏幕上的样子。
- Vercel 缓存头（部署后用 `curl -I` 看 html 与 `/_expo/static/` 文件）。
- Android（Noto Sans SC）下短屏反馈卡的中文是否仍是一行（本轮在 macOS 字体下量的）。

# Phase 19：合体岛重做——"还差谁"与"两种拼法"（2026-10-16，D-068 – D-071，内容版本 6）

只做 brief 2.1 – 2.5，方向 Ted 已选定。没有执行任何 git 命令；没有新增依赖；没改 `src/progress/__fixtures__/`、`AUTO_SPEECH`；没加任何自动语音（新句子只在点云朵 / 卡片 / 帮助时说）。core 没改；存档 `schemaVersion` 不变、没加字段。

顺序说明：2.1 写内容层时把 2.3 的内容部分（`ways` 的 schema / 参考解 / validate，与关卡会话共用的 `content/steps.ts`）一起做了（同一处代码）；2.2 / 2.3 的界面代码写完后先做了 2.4 的目录，再写 2.2 / 2.3 的界面测试（`LevelScreen.test.web.tsx` 要用目录里真实的站）。每一步之后都跑了门禁（数字见各项）。v5 的种子存档在动代码之前用 v5 代码生成（会话草稿目录 `v5/seeds`，生成方式同 Phase 18）。

## 2.1 内容层："还差谁"（D-068）

- [x] `content/schema.ts`：`sum_composition` 加可选 `given?: number`、`ways?: number`；`Puzzle` 加可选 `given?: GroupId`、`ways?: number`（只有对应的站带，其他站的 `Puzzle` 形状不变）。
- [x] `content/material.ts givenMaterial`：托盘照 `partnerOrder` 洗 [缺的那一半, ...distractors]，given 伙伴排最后（home 槽位在托盘末尾，照旧存在 → 托盘留轮廓），再用 core `takeGroup` 放到工作台最左列、竖直居中（按 given 与缺的那一半中较高的那个算，两行的伙伴也放得下）。
- [x] `content/generate.ts`：`promptFor(question, spec)` 带 given 的站用 `prompt.missing_part`（新文案，中英各一："已经有 {a} 了，再找一个伙伴，拼成 {n}" / "Here is {a}. Find one more partner to make {n}"）；`display.target = sum`，`operands = null`；given ≥ sum 抛错。
- [x] `content/solution.ts`：given 站参考解一步（缺的那一半 `takeGroup` 到 given 右边，不碰 given）；ways 站依次拼每一种（拼好 → `returnGroup` 两个 → 下一种）。
- [x] `content/validate.ts`：只有 given 伙伴可以开局在工作台上，且工作台上只有它；`allowed` 必须恰好是 [[given, sum − given]]；托盘里能补全它的伙伴恰好一个；given 与 `ways > 1` 不能同时用；ways：正整数、`allowed.length ≥ ways`、`ways ≥ 2` 时托盘里没有别的一对凑出 sum；参考解按步判定（每一步只接受前面没用过的拼法）。`content/steps.ts`（新）：`samePair`、`stepCount`、`questionAt`、`benchPair`，validate 与关卡会话共用。
- [x] `content/bench.ts`：不用改（given 本来就是允许拼法的一个尺寸，`partnerSizesFor` 已把它算进材料），加了一句注释。
- 测试：`generate.test.ts` +8（given 站开局 given 在工作台最左、托盘 3 / 1 / 4 且恰好一个能补全、home 槽位为空、partnerIds 最后一个是 given、prompt / display；参考解 1 步、matched、given 不动、落点 (2, y)；4 个种子 × 3 个 variant 确定性、托盘有洗牌、given 的 home 总在最后；两行的另一半也放得下；`allowed` 多一对 / 换一对 / ways 2 / given ≥ sum / 干扰与操作数同尺寸 / 托盘里有第二个 3 / 工作台上多一个伙伴 / spec 没有 given / puzzle 丢了 given 都抛错；ways 站同一托盘、参考解 6 步、第一种之后同一种不再算、另一种算；拼法不够、托盘里 6 + 1 也凑出 7、同一种拼两次都抛错；`steps.ts` 各函数）。
- 门禁：lint 0（新测试里一处 `readonly number[]` 改 `ReadonlyArray`）、typecheck 通过、purity 零命中、test:gate 55 suite / 740 测试，覆盖率 content 98.04 / 95.4、core 100 / 99.09、progress 99.01 / 97.52；build:web 通过。目录还没改，指纹表全部不变。

## 2.2 界面："还差谁"站（D-068）

- [x] `screens/level-session.ts`：`givenPartner`、`onlyGiven`（工作台上只有 given，不论位置）、`atStart`（空工作台或 onlyGiven）、`demoMove`（参考解第一步；given 站把缺的那一半放在 given 现在位置的右边，放不下放左边，都放不下按参考解）。
- [x] `screens/hints.ts`：新 `promptParams`（LevelScreen 里原来的同名函数移过来，given 站给 `{ a: given, n: sum }`）；`feedbackFor`：onlyGiven 当开题（说明是题目），given 送回后空工作台说"找两个伙伴，拼出 n"；given 站少了时标题 `feedback.notyet`"还不到 {n} / Not {n} yet"（不说差几块）；新 `asksForHelp`：需要调整，或 given 站的"还不到"，或两种拼法的"换一种拼法"，第二级帮助才有东西可点名；`pairPlan`：没有要送回、只差一个时 `hint.bring`"把 {a} 搬过来 / Bring the {a}"并点亮它（以前这种情况返回 null；旧站的"需要调整"态里不会出现，旧行为不变）；`cardFor` / `guidanceFor` 用 `asksForHelp`。
- [x] `screens/LevelScreen.tsx`：`emptyMat` 改用 `atStart`（开局有 given 也出示范手）；示范手用 `demoMove`，given 站另传落点 `demoTo`；`onAskHelp` 用 `asksForHelp`；云朵照旧（和；答对后 `solvedEquation` 按从左到右 → `2 + 3 = 5`）。
- [x] `blocks-ui/Stage.tsx`：新可选属性 `demoTo?: Cell`（手放下的工作台格，左上角）；不给时仍放在工作台中间（其他站不变）。
- 测试见 2.4 之后的"界面测试"。

## 2.3 Boss："两种拼法"（D-069）

- [x] 内容部分见 2.1。
- [x] `screens/level-session.ts`：`LevelSession.used`（前面每步用掉的那一对大小）；`stepView(whole, step, used)` 用 `questionAt` 把用掉的拼法从 allowed 里去掉；`startSession` / `commitCommand` 每过一步记下当时工作台上的那一对；`undoCommand` 保留 `used`（步骤只前进）。恢复：未完成的站存档作品是某个允许拼法 → 第一步已完成、用掉的就是它；完成过的站打开在最后一步、`used` 为空，任一允许拼法都算对。新 `sameWayAgain`：用掉的那一对（或它剩下的一个）是工作台上全部 → "换一种拼法"态。`demoMove`：过了第一步，搬还没用过的拼法里的伙伴。
- [x] `screens/hints.ts`：`sameWayAgain` → building，标题 `feedback.another`"换一种拼法！/ Another way!"，说明 `hint.another-way`"再用另外两个伙伴拼出 {n} / Make {n} with two other partners"；第二级走 `pairPlan`（剩下的拼法）→ 同和句"3 加 4 也是 7！再找 5 和 2"、点亮两对；只剩一个时"把 4 送回去"。
- [x] 庆祝：LevelScreen 原有的 `stepDone` 分支（D-044）原样适用——第一步跳、success 音、云朵 pop，没有彩纸、没有"下一站"、不记完成；最后一步 `solvedNow` → 彩纸、fanfare（Boss）、下一站、作品册存最后的工作台。岛收尾页 `bossWork` 不用改：没有作品册图时参考解的终点就是最后一种拼法。
- 和 brief 不同的一处：brief 写"第二步时工作台上还是上一步那一对 → building"。实现时发现送回其中一个（工作台上只剩 3）会按普通规则变成"换个伙伴试试看"并响一声"需要调整"，像在责备正在照做的孩子，所以"那一对剩下的一个"也算"换一种拼法"态（D-069）。

## 2.4 合体岛目录 + 内容版本 6（D-070）

- [x] `content/catalog/chapter-2.ts`：8 站，n1–n4 不变；n5 = 5 / given 2 / 干扰 [1, 4]；n6 = 6 / given 4 / [1, 3]；n7 = 7 / given 3 / [2, 5]；n8 Boss = 7 / [[3, 4], [5, 2]] / ways 2 / [1]。逐站核对通过，没有调 distractors：干扰与 given 的和（3、6；5、7；5、8）都不是本站的和；n8 托盘 3、4、5、2、1 两两相加等于 7 的恰好 3 + 4、2 + 5（catalog 测试断言）。注意 n6 的 1 + 3、n7 的 2 + 5、n5 的 1 + 4 也能凑出和——这是"送回 given 改拼"的同和帮助路径，brief 要求的就是这条。
- [x] `content/catalog/index.ts`：`CONTENT_VERSION = 6`；`CONTENT_CHANGES[6] = [ch2-n5, ch2-n6, ch2-n7]`；ch2-n8 不登记（`migrate` 只处理存档里已有的站，旧存档不可能有它的作品，登记了也什么都不做；指纹测试只要求登记的站存在）；`COUNT_TO_PASS` 注释的 Boss 候选 ch2-n7 → ch2-n8。
- [x] `content/fingerprint.test.ts`：`FINGERPRINT_VERSION = 6`；描述里只为带 ways / given 的站追加 ways、given 与工作台（其他站的描述逐字节不变）；**数字岛 12 站与 ch2-n1…n4 的指纹与版本 5 完全相同**（df3b63c2 … c9dd5ad8，测试通过即证明），n5 `3c13c51e → 1ddcbdea`、n6 `16fc254e → 0d3f2cd6`、n7 `419c1740 → dfc97337`，n8 新 `681b29c8`。
- [x] `progress/migrate.ts`：新 `onwardFrom`——升级后 `current` 是已完成的站、它的下一站没完成时，移到下一站（全通 v5 存档停在 7 站 → 8 站）；其他情况 `current` 不变。完成记录、作品收起、作品册的规则原样（D-034 / D-048）。
- 浏览器之前先算了：工作台 n5 6 × 3、n6 7 × 3、n7 8 × 3、n8 8 × 3；`devices.ts` 13 个视口 × 3 个 variant，n5–n8 工作台格 45–84px、托盘块最小 40（横屏托盘）；`layout.test` 的"不到 40px"清单没有多出新项（仍是原来的 4 处）。

### 改了期望的旧测试（逐条）

- `content/generate.test.ts` "the join stop: 3 + 4 …"：ch2-n7 不再是指定加法，改用内容版本 5 的同一份规格经 `materializeNode` 生成（标题改为 "an exact join (the 3 + 4 boss up to content version 5)"）。
- `content/validate.test.ts` "addition puzzles are checked …"：同上，用旧规格生成 3 + 4。
- `content/catalog/catalog.test.ts`："seven join stops" → eight、Boss [ch2-n4, ch2-n8]、工作台表加 n6 7x3 / n8 8x3；"AC-45: the join boss is an exact 3 + 4" → "Phase 19: Join Island is …"（8 站 spec 全表、干扰不补全 given、n8 恰好两对、n7 开局 3 与 prompt、n8 ways 2）。
- `content/demo.test.ts`：nineteen → twenty stops（Boss 仍是 5 个）。
- `content/bench.test.ts` "fitting it changed nothing but the mat"：given 伙伴坐在各自工作台的半高处，所以只比"哪些块在工作台上"、不比位置。
- `content/fingerprint.test.ts`：见上。
- `progress/demo.test.ts`：合体岛 7 / 7 → 8 / 8。
- `progress/unlock.test.ts`：地图 19 → 20 站；ch2-n7 的下一站是 ch2-n8，ch2-n8 没有下一站；全完成时 `defaultCurrent` = ch2-n8。
- `blocks-ui/tray.test.ts` "taking any one partner out leaves one outline"：given 站开局正好显示 given 的轮廓；其余检查从"given 放回托盘"的状态开始。
- `blocks-ui/layout.test.ts`："8-column mat … 3 + 4" → ch2-n8（另断言 ch2-n7 也是 8 列 48px）；"a tray below the mat …" 的 [ch1-n1, ch2-n7] → [ch1-n1, ch2-n8]（五个伙伴，空沙仍 ≤ 45%）。
- `screens/hints.test.ts` 5 条（"right count does not claim success …"、"addition: find a and b …"、"3 + 4 with a 4 and a 2 …"、"A-4: 3 + 4 built as 5 + 2 …"、"a right answer: the card says what comes next …"）：改用旧规格 3 + 4（`exactJoin()`）——这些测的是指定加法的帮助句，代码没变，仍服务 1 + 1 / 2 + 1 / 2 + 2。
- `screens/LevelScreen.test.web.tsx`：`unlockedTo` 的站表加 ch2-n8；"3 + 4: one success per solve …" → ch2-n7 的"还差谁"（云朵 7、开局说"已经有 3 了…"、托盘 4 个对象含 3 的轮廓、拖 4 一次答对、卡片"可以去下一站啦"，没有了原来"还差 4 块"那一步）；"finished island's last stop …" 与 "review H / I" → ch2-n8；"asked-for help names the partner …" → ch2-n7（先送回 3，再放 4 + 2：第一级句子由"我们先找 3 和 4"变为"找两个伙伴，拼出 7"，送回 2 后标题由"还差 3 块"变为"还不到 7"，其余点名与点亮不变）。
- `screens/LevelScreen.sound.test.web.tsx`：站表加 ch2-n8；"a boss plays the fanfare …" → ch2-n8（第一种拼法 success，第二种 fanfare，点数 7 块不变）；"H-3 count again …" → ch2-n7 把 4 贴在开局的 3 旁边（原来先 `takeGroup` 3，在新目录下 3 已在工作台、命令被拒，测试凭运气通过）。
- `screens/IslandDoneScreen.test.web.tsx`：站表加 ch2-n8；"the last island" 19 → 20 站、8 个角色，并断言没有作品册图时画的是最后一种拼法 5 + 2；"unknown island" 19 → 20；"unfinished island" 加一条：合体岛 7 / 8（v5 全通升级后）没有收尾页、回地图。
- `screens/MapScreen.test.web.tsx`：站表加 ch2-n8；"bunting and a cup" 改为打完 ch2-n8 才出现。
- `screens/AlbumScreen.test.web.tsx`：站表加 ch2-n8；"only what was built" 用 ch2-n8（卡片 "7★"、5 + 2 两张笑脸）；放大测试的"合体说算式"改用 ch2-n3（"2+2"、说"2 加 2，一共 4"）——自由和与"还差谁"的作品册卡片说数字（"七"），和 ch2-n4 一样。
- `screens/layout-fit.test.web.tsx`：岛尾站 ch2-n7 → ch2-n8（两处）。

### 界面测试（2.2 / 2.3，在 2.4 之后写）

- `screens/level-session.test.ts` +5：两种拼法第一种是一步且被用掉、挪动 / 送回再拼回不推进、送回一个仍是"换一种拼法"、另一种是过关、撤销保留 `used`、哪种先拼都行；恢复（未完成的存档作品 = 第一种、完成过的站任一种都对、半成品从第一步开始）；示范手过了第一步搬另一种的伙伴；"还差谁"开局 / 挪动仍是开局 / 送回后是空工作台 / 一步答对 `2 + 3 = 5`；示范手落点（右边、放不下放左边、都放不下用参考解）。
- `screens/hints.test.ts` +9："还差谁"开局卡（中英）、挪动仍开局、送回后"找两个伙伴"；"还不到 5"不含差值、第二级"把 2 搬过来"点亮 given；多了"把 4 送回去，换 3 过来"点亮 4 与 3、1 在旁边是"换个伙伴"再点名；送回 2 改拼 1 + 4 → "1 加 4 也是 5！再找 2 和 3"四个点亮；答对；三站的 `promptParams`；两种拼法第二步"换一种拼法！"（中英）、第一级不点亮、第二级同和句与四个点亮、卡片在第二级显示同一句；送回一个仍是"换一种拼法"、第二级"把 4 送回去"；另一种过关、第一步是普通自由和。
- `screens/LevelScreen.test.web.tsx` +4：ch2-n5 开局（云朵 5、开题卡与题目、工作台上只有 2、表情 calm、示范手搬 3 落在 (2, y)、5 秒出现、拖动后收起不再出现）；一次拖动答对只庆祝一次、`2 + 3 = 5`、重排不再庆祝、完成与作品册写入；"多了 1 块"→求助点亮 4 与 3、送回 4 和 2 后是开题"找两个伙伴"、只放 3 是"还不到 5"（页面上没有"还差"）→求助"把 2 搬过来"点亮 2、1 + 4 → 同和句四个点亮；ch2-n8 第一步小庆祝（hop、没有下一站 / 再玩一次、没说成功句、云朵仍是 7、没记完成）、挪动第一对不推进、求助同和句点亮两对、刷新后从第二步继续、送回一个仍是"换一种拼法"、另一种过关一次（`5 + 2 = 7`、非 hop 的过关动作、"合体岛完成了"）、作品册是 5 + 2。
- `screens/LevelScreen.sound.test.web.tsx` +1：两种新站都没有自动语音；"还差谁"开局只有进站音、多了响一次"需要调整"、答对 success、点云朵才说题目；两种拼法第一种 success、送回第一对的一个不响"需要调整"、点卡片才说"把 4 送回去"。
- `progress/upgrade.test.ts` +5（v5 → v6）：只改了 n5–n7 的材料、ch2-n8 是新的、其他站的 v5 作品原样保留；（种子 5）三站旧作品都收起、完成记录与作品册保留；全通 v5 存档：`current` 移到 ch2-n8、可进、合体岛 7 / 8、不是全通，打完 8 站全通，经 `loadArchive` 报 `upgraded`、列出 n5–n7、原串进升级备份；（种子 4242 / 3）托盘恰好洗成同样顺序时旧作品保留：7 站 3 + 4 仍对，6 站 4 + 1 放到 7 × 3 上、不对、完成记录在；`current` 只在"已完成 → 下一站没完成"时移动。

## Checkpoint 19-1（2.1 – 2.4）

- [x] 门禁：2.1 后 55 / 740（见上）；2.2 / 2.3 代码后（目录未改）55 / 740 全过、lint / typecheck 通过；2.4 目录改完、修完旧测试、写完新测试后：`pnpm lint` 0 问题；`pnpm typecheck` 通过；`pnpm lint:purity` 零命中；`pnpm test:gate` 55 suite / **780** 测试全过（基线 732），覆盖率：全部 97.6 / 93.39（语句 / 分支），content 98.04 / 95.4、core 100 / 99.09、progress 99.02 / 97.59（门禁 95）、blocks-ui 97.96 / 91.11、screens 95.64 / 89.81；jest 输出里没有 console error / warning；`pnpm build:web` 8 个静态路由。
- [x] 没有删测试；改了期望的旧测试逐条见上。
- [x] 规格同步：`SPEC-content.md`（schema 的 `given` / `ways`、`Puzzle.steps / ways / given`、`prompt.missing_part`、"还差谁"材料、validate 规则、目录表到内容版本 6、工作台尺寸句、`COUNT_TO_PASS` 候选）、`SPEC-screens.md`（"还差谁"与"两种拼法"的卡片、帮助、示范手、庆祝、恢复规则，同和帮助的例子、"还不到 n"、测试清单）、`SPEC-progress.md`（`current` 例外与 v5 → v6）、README「当前实现」（题库 20 站、玩法、8 列、内容版本 6、门禁指向 Phase 19）、`docs/level-progression.md` §5 改为现状。决策 D-068 – D-071。

## 2.5 浏览器走查（Checkpoint 19-2）

做法同 Phase 18：chrome-devtools MCP 本会话连不上（启动时 `CONNECTION_CLOSED`），改用 Playwright npx 缓存（headless shell 1223），`isMobile` + `hasTouch`、`deviceScaleFactor` 2，拖拽用 CDP `Input.dispatchTouchEvent`（touchStart、14 次 touchMove、touchEnd），静态产物 `PORT=8791 node tools/serve-dist.mjs`。种子用 `progress` 的 `reduce` + `serialize`（纯模块编译到会话草稿目录）：v6 的"数字岛全通 + 合体岛 1–4 完成"（`upto5`，中 / 英）、"5–7 完成且无作品、8 站停在第二步"（`n8-step2`）、"5–7 完成且无作品"（`joins-open`）；v5 全通种子是动代码之前用 v5 代码生成的（`full-solved-zh`，种子 4242，`current` = ch2-n7，作品册 19）。语音替换 `speechSynthesis.speak / cancel` 记录，音效包装 `OscillatorNode.frequency.setValueAtTime` 记录；没有听。脚本 `w1.mjs`、`w2.mjs`、`w2b.mjs`、`w3.mjs`、`gen-seeds.cjs` 在会话草稿目录 `/private/tmp/claude-503/-Users-tedliang-Desktop-AI-Projects-amber-blocks/aada8b19-08d7-4c4a-9d9c-11dc22e5c2d4/scratchpad/v6/`，不在仓库里。截图 18 张 `docs/review-assets/phase19-01` … `phase19-18`。

- [x] **390 × 844 从地图真拖着玩 n5 → n8**（`w1.mjs`，22 / 22 通过，控制台 0 error / 0 warning）：
  1. 地图合体岛 8 站、没有奖杯；点 ▶ 进 ch2-n5（当前站）。
  2. n5 开局：云朵 "5"；卡片"动手试试看 / 已经有 2 了，再找一个伙伴，拼成 5"；工作台上只有 2（第 0 列第 1 行，6 × 3，格 61px）；托盘 1、4、3 + 2 的空位轮廓（右下两格，`phase19-01`）；只有进站音 880 → 659.25 → 987.77，没有语音。约 5 秒后示范手出现，把 3 搬到第 2 列第 1 行、正贴在 2 右边（`phase19-02`）。
  3. 故意多拿：4 贴在 2 右边 → "多了 1 块 / 比 5 多了，把一个伙伴送回去"，响一次"需要调整"（392 / 349.23）；点卡片 → "把 4 送回去，换 3 过来"，两个光圈正套在 4 与 3 上，说"把 四 送回去，换 三 过来"（`phase19-03`）。
  4. 4 和 2 送回托盘 → "动手试试看 / 找两个伙伴，拼出 5"；拼 1 + 4 → "数量够了，再找对伙伴"；点卡片 → "1 加 4 也是 5！再找 2 和 3"，四个光圈套在 1、4、2、3 上，说"一 加 四 也是 五！再找 二 和 三"（`phase19-04`）。
  5. 收回后摆 2、再把 3 贴上 → 云朵 "2 + 3 = 5"、"拼对啦！ / 可以去下一站啦"、"下一站"；success 523.25 一组；没有语音（`phase19-05`）。
  6. "下一站" → 地图跳站 → 自动进 ch2-n6：云朵 "6"、"已经有 4 了…拼成 6"；点卡片只说题目（"已经有 四 了，再找一个伙伴，拼成 六"）、不点亮；示范手把 2 放在第 4 列第 1 行（4 的右边）；拖 2 一次 → "4 + 2 = 6"、success。ch2-n7 同样：示范手把 4 放在第 3 列，拖一次 "3 + 4 = 7"。
  7. ch2-n8：云朵 "7"、"找两个伙伴，拼出 7"、托盘 5、2、1、3、4；点卡片说"找两个伙伴，拼出 七"；示范手把 3 搬到工作台中间。拼 3 + 4 → success 一组（523.25 一次）、没有彩纸（`confetti` 不存在）、没有"下一站 / 再玩一次"、云朵仍 "7"、卡片"换一种拼法！ / 再用另外两个伙伴拼出 7"、没有语音（`phase19-06`）。把 3 挪到 4 下面再挪回：仍是"换一种拼法！"、没有 success。保持第一对、点卡片 → "3 加 4 也是 7！再找 5 和 2"，四个光圈套在 3、4、5、2 上（`phase19-07`）。送回 3 时仍是"换一种拼法！"、没有"需要调整"音；送回 4、拼 5 + 2 → 云朵 "5 + 2 = 7"、"拼对啦！"、彩纸、fanfare（523.25 两次 … 2093）、"合体岛完成了"（`phase19-08`）。
  8. 岛收尾页 `/island/ch2`：8 个角色欢呼，Boss 作品是最后一种拼法 5 + 2（`phase19-09`）；回地图：奖杯与彩旗出现、合体岛 8 站（`phase19-10`）。
- [x] **v5 全通存档**（`w2.mjs` 9 / 10、`w2b.mjs`，控制台 0 / 0）：打开地图、什么都不动：存档已是内容版本 6、`current` = ch2-n8、完成记录 19 条、`progress.before-upgrade` 是原串；5、6 站旧作品收起，**7 站旧作品保留**（种子 4242 恰好把 7 站托盘洗成和 v5 一样的顺序，旧的 3 + 4 仍与新材料一致且是对的，照 D-034 保留；单测里种子 5 三站都收起），作品册 19 张都在；地图没有奖杯（`phase19-11`）。家长区（首次打开即进家长区）："题库更新过，存档已自动升级… 下次进去从头摆：合体岛 第 5 站、合体岛 第 6 站"（`phase19-12`），刷新后不再出现（D-057）。`w2.mjs` 里那一条没通过是脚本问题：先开了地图（已升级并写回）再整页跳到 `/parent`，提示照 D-057 不会再出现，改在 `w2b.mjs` 首次打开家长区验证。`/island/ch2` → 回地图；ch2-n7 打开是保留的 "3 + 4 = 7"、"下一站"；▶ 进 ch2-n8，先 5 + 2（"换一种拼法！"）再 3 + 4 → "合体岛完成了" → 岛收尾页 8 个角色 → 回地图奖杯回来，完成 20 站。
- [x] **小屏截图**（`w3.mjs`，控制台 0 / 0）：360 × 640 与 667 × 331 各截 n5 开局（`phase19-13`、`phase19-14`）、n8 第二步（`phase19-15`、`phase19-16`，从存档恢复直接是"换一种拼法！"——刷新后从第二步继续在真实构建里成立）、地图合体岛（`phase19-17`、`phase19-18`：8 站，当前站 ch2-n8 在视野内，y 409 / 120）。
- [x] **新卡片句子的排版**（`w3.mjs`，390 × 844、360 × 640、375 × 553、667 × 331、640 × 360 × 中英 × n5 / n6 / n7 开局、n8 第二步、n8 求助，全部在卡片之内）：中文竖屏全部一行；英文 "Here is 2. Find one more partner to make 5" 在 375 × 553 一行，在 390 × 844（14px 字，要 267px、有 242px）与 360 × 640（12px，要 229px、有 226px）**折两行**，仍在卡内（360 × 640 下沿离卡底 1px）；横屏 148px 窄卡里题目与英文句子两行，"换一种拼法！"折成"换一种拼 / 法！"，卡片变高到 67–83px（长句在窄卡折行是原有情况）。
- [x] 纯布局数字（Checkpoint 19-1 已列）：n5–n8 在 13 个视口工作台格 45–84px、托盘块 ≥ 40。

## Checkpoint 19-2

- [x] 门禁（走查之后、只改了文档，又跑一遍）：`pnpm lint` 0 问题；`pnpm typecheck` 通过；`pnpm lint:purity` 零命中；`pnpm test:gate` 55 suite / 780 测试（9.7s），覆盖率全部 97.6 / 93.39，content 98.04 / 95.4、core 100 / 99.09、progress 99.02 / 97.59、blocks-ui 97.96 / 91.11、screens 95.64 / 89.81；`pnpm build:web` 8 个静态路由，dist 2.9 MB。
- [x] 浏览器：见 2.5，四个脚本全程控制台 0 error / 0 warning。

未验证 / 遗留：

- 声音没听（只核对了频率与排程）；真机没测。chrome-devtools MCP 连不上，全部是 Playwright headless。
- 停服务时用了 `pkill -f tools/serve-dist.mjs`：如果当时别的会话也用这个脚本开着 8787，也会一起停掉（之后 8787、8081 都没有响应，无法确认之前是否在跑）。
- 8 列工作台贴满屏宽时，最左边伙伴的光圈在屏边被裁掉几像素（`phase19-07`；与 Phase 18 的木框被裁同一原因，D-067 `WIDE_MAT_COLS`）。
- 最后一站（ch2-n8）答对时卡片说"回地图看看吧"、按钮写"合体岛完成了"——原来的 ch2-n7 也是这样，没改。
- `hints.test` 里"从随机混乱状态按帮助操作总能完成"的属性测试只覆盖 10 / 12 / 17，没有扩到合体岛新站（新站用逐个场景测试）。→ 已补，见 2.6。
- "两种拼法"第二步中途刷新、工作台上只剩半成品时，从第一步开始（第一种可以再用原来那一对）；不存 `used` 是因为不加存档字段（D-069）。

### 需要 Ted 决定

brief 第 4 节、本轮按默认做的（D-071）：

1. 开局伙伴可以被拖回托盘（不锁）。
2. 托盘里留着开局伙伴的空位轮廓（`phase19-01` 托盘右下两格；排在托盘末尾）。
3. "还差谁"站不接受换掉开局伙伴的其他凑法（1 + 4 走同和帮助"1 加 4 也是 5！再找 2 和 3"）。
4. "还差谁"站的卡片不说差几块（"还不到 5"）。
5. 原来的 3 + 4 Boss 变成"两种拼法"里的一种（ch2-n8）。
6. 全通旧存档在合体岛多出第 8 站、奖杯暂时消失（打完 8 站回来）。

本轮新增：

7. 托盘恰好洗成同样顺序的旧存档（约十分之一的种子），变了的站照 D-034 保留旧作品：7 站的 3 + 4 仍然对；6 站会留着一个 4 + 1（不是 6，打开时是"回地图"、卡片"换个伙伴试试看"）。要不要给"变了的站"加一条"旧作品在新题下不对就收起"。
8. 英文"还差谁"题目（brief 原文）在 360 宽短屏与 390 常规卡片折两行（仍在卡内，Android 字体可能更宽）。保留原文；要一行可改为 "Here is {a}. Find one more to make {n}"（12px 184px / 14px 215px），`copy.ts` 一行。
9. `current` 迁移规则（D-070，助手补充）：升级后停在已完成的站、下一站没完成时移到下一站。不要的话删 `migrate.ts onwardFrom`，全通 v5 存档的地图会停在 7 站（8 站仍可点）。
10. "两种拼法"把"送回第一对中的一个"也算"换一种拼法"（brief 只写了"还是那一对"），理由见 2.3。
11. "两种拼法"第一步之后云朵仍显示 7，第一种拼法没有留下记录（只有小庆祝）。要不要在云朵或卡片上留着第一种的算式。
12. 地图上 4 / 5 站都标 "5"、7 / 8 站都标 "7"（自由和与"还差谁"都只显示和）。要不要区分（例如还差谁标 "2+?"）。
13. 横屏窄卡里"换一种拼法！"折成两行（"换一种拼 / 法！"）。

brief 第 4 节列出、本轮按要求没做的：三个伙伴合体、凑到 10 / 第三个岛"大合体岛"（Phase 20）；合体瞬间"变成 n"的动画；拆开岛 / 拆分命令；内容池与"换一题"；数字岛任何改动；启用 `COUNT_TO_PASS`（候选现为 ch1-n4、n8、n12，ch2-n4、n8）；Phase 18"需要 Ted 决定"清单里的其他事项（仍未决定）。

### 只能真机确认

- 孩子是否把开局就在的伙伴当成"已经有了"，还是当成要先送回去的东西；托盘里的空位轮廓会不会引孩子把它放回去。
- 不识字的孩子能否从"跳一下 + 叮"和拼搭卡（↗）明白要"换一种拼法"（这里没有自动语音，只有点卡片才说）。
- 第一步的 success 与最后的 fanfare 在手机喇叭上听起来是否分得开。
- 8 列工作台在 360 宽手机上 45px 的块、贴着屏边的伙伴，真实手指的抓取；拖回开局伙伴是否顺手。
- Android（Noto Sans）下英文"还差谁"题目两行是否仍在 56px 卡片之内（macOS 字体下只剩 1px）。
- Ted 设备上真实的 v5 存档升级后哪几站的旧作品被收起（取决于它自己的种子）。

## 2.6 跟进：合体岛"按帮助操作总能完成"属性测试（2026-10-16，另一会话）

- [x] `hints.test.ts` 新增 "Phase 19: following help from a random muddle always finishes the Join Island sums, the boss both ways"：ch2-n4 – n8 各 80 个种子；随机 takeGroup / returnGroup 混乱（0–5 步、随机格）之后，孩子能求助（`asksForHelp`）就按第二级、否则按第一级做：点亮的工作台伙伴送回，点亮的托盘伙伴贴着工作台上的伙伴搬过来，"把 a 和 b 推到一起"就 moveGroup 推到相贴；什么都没点亮（开局 / 搭建中）从托盘随机拿一个（优先没送回过的）放随机格；一半概率只做点亮的第一件就再问，让换到一半的状态也被问到。24 步之内必须做完最后一步（ch2-n8 两种拼法都做完），没做完的连同轨迹（步:工作台伙伴:句子，* = 有点亮）一起列出。实测最长 17 步；ch2-n8 80 个都进了第二步；帮助句覆盖开题两种、`hint.sum-pair`、`hint.bring`、`hint.swap.pair`、`hint.send`、`hint.same-sum`、`hint.not-merged`。
- [x] **它抓到一个真问题，已修**：工作台上三个伙伴、要送回两个时（例：送回开局的 4 后摆 2 + 3 + 1 拼 6；ch2-n8 第二步 3 + 1 + 2），`pairPlan` 返回 null，求助退回第一级"找两个伙伴，拼出 6"、什么都不点亮；照做的孩子再拿一个 → "比 6 多了，把一个伙伴送回去"（不点亮）→ 送回刚拿的那个 → 循环（未修时 ch2-n6 种子 11 / 46 / 57 / 68 / 75 / 77、ch2-n8 种子 29 卡住）。修法只改 `hints.ts` `pairPlan` 结尾一处：要送回的不止一个时也点名第一个（`hint.send`"把 3 送回去"），问一次点一个，和数字岛 `quantityPlan` 一样；一换一仍是"把 a 送回去，换 b 过来"，同和二换二仍是 D-063 那句。另加场景测试钉住 ch2-n6 的 2 + 3 + 1 → "把 3 送回去" → "把 1 送回去，换 4 过来"。两个新测试在旧代码上都失败（验证过）。界面上的变化：三个伙伴在工作台上时点卡片 / 求助，从"找两个伙伴，拼出 n"、不点亮，变成点名并点亮一个要送回的伙伴。不要的话把那一处改回 `if (best.send.length === 1) { … } return null;`。`SPEC-screens.md` 的求助规则与测试清单各补一句。
- [x] 内容、core、存档、AUTO_SPEECH 没动；没跑 git。门禁：`pnpm lint` 0 问题；`pnpm typecheck` 通过；`pnpm lint:purity` 零命中；`pnpm test:gate` 55 suite / **782** 测试全过（覆盖率全部 97.63 / 93.6）。
- 未做：浏览器里没走"三个伙伴 → 求助"的新卡片（纯逻辑改动，句子与点亮沿用已有的 `hint.send`）。

## 上线与 D-072：关卡菜单加回"回地图"（2026-10-17）

- [x] 上线：私有仓库 `teddyliangfh/amber-blocks`（`main`，首个提交 `1071041`），Vercel Git 导入，https://amber-blocks.vercel.app/ ；各路由（含 `/play/<id>`、`/island/<id>` 深链接刷新）都是 200。之后每次 push 到 `main` 自动部署。
- [x] Ted 线上试玩反馈：进了关卡就回不到地图重新选站（D-043 把"地图"收进家长区时列入"需要 Ted 决定"，PRD AC-42 要求回地图始终可用）。Ted 决定加回（D-072）。
- [x] `LevelScreen.tsx`：菜单在"重新挑战"之后、⚙ 之前加 `menu-map`"回地图 / Back to map"，未完成的站也有；`voice.stop()` + `router.dismissTo('/')`（沙盒、家长区同一条路）。
- [x] 测试：`LevelScreen.test.web.tsx` 菜单项列表加 `menu-map`；新测试：未完成站菜单也有回地图，点了先停语音、`dismissTo('/')`、不走 `replace`、菜单收起。
- [x] 门禁：`pnpm lint`、`pnpm typecheck`、`pnpm lint:purity` 通过；`pnpm test:gate` 55 suite / **783** 测试全过（覆盖率门槛达标）；`pnpm build:web` 通过。
- [x] 实际运行（静态产物，Playwright 无头 Chromium）：390 × 844 未完成站菜单 继续 / 帮助 / 撤销 / 回地图 / ⚙，点回地图 → `/`；667 × 331 横屏从深链接直接打开已完成站，菜单两列五项 + ⚙ 全在视口内（卡片 y 86–245），点回地图 → `/`（栈里没有地图时 `dismissTo` 换成地图）。控制台 0 error / 0 warning。
- 文档：D-072、`SPEC-screens.md` 关卡菜单、README 儿童菜单一句。

## D-073：家长门短按冒"按住进入家长区"气泡（2026-10-17）

- [x] Ted 线上反馈："设置功能点击没反应"——⚙ 是按住 600ms 的家长门，短按只有 tap + 小晃，太轻。Ted 决定保留按住，短按加文字提示（D-073）。
- [x] `screens/ui.tsx` `ParentGate`：短按 `setHint(n + 1)`，⚙ 上方冒气泡（白底、沙色描边与底边、`FONT.body` 15px、宽 160、`pointerEvents="none"`、`FadeIn` 120ms），文字取 `accessibilityHint`；`PARENT_HINT_MS = 1500` 后消失，再点重新计时（effect 依赖计数），按住打开时先收起；新增 `hintAlign`（默认居中，地图传 `start`，免得左下角的气泡出屏）。
- [x] 中文 `hold` 文案"长按进入家长区"→"按住进入家长区"（`MapScreen`、`LevelScreen`），英文不变。
- [x] 测试：`MapScreen.test.web.tsx` 家长门测试加气泡出现 / 第二次点续时 / 到点消失 / 按住打开后没有残留；`LevelScreen.test.web.tsx` 菜单 ⚙ 短按出气泡、菜单不关、`PARENT_HINT_MS` 后消失。
- [x] 走查时发现：关卡菜单 ⚙ 的外层 `menuGate` 有 `opacity: 0.85`，把气泡也一起变半透明，被盖住的"回地图"字透出来。改为 `ParentGate` 新增 `muted`，0.85 只加在齿轮本身，`menuGate` 去掉 opacity（齿轮外观不变）。气泡 `marginBottom` 加到 12 并加一个指向 ⚙ 的小尖角，盖住菜单按钮时整段文字都在气泡下面，不会被气泡边切半。
- [x] 门禁：`pnpm lint`、`pnpm typecheck`、`pnpm lint:purity` 通过；`pnpm test:gate` 55 suite / 783 测试全过；`pnpm build:web` 通过。
- [x] 实际运行（静态产物，Playwright 无头 Chromium）：375 × 667 地图点 ⚙ → 气泡在 ⚙ 正上方、左对齐、一行（x 12–172），约 1.5 秒后消失；关卡菜单点 ⚙ → 菜单不关，气泡居中盖住"回地图"按钮、不透字，1.5 秒后消失（记录：出现 1382ms、消失 2883ms）；667 × 331 横屏菜单气泡盖住"撤销"、在卡片内（x 440–600）。控制台 0 error / 0 warning。
- 文档：D-073、`SPEC-screens.md` 家长门一条、README 家长区一句。

# Phase 20：质量 + 招牌时刻"合体变身"（2026-10-18，D-074 – D-088）

只做 [tasks/brief-phase-20.md](brief-phase-20.md) 的第 1 批（20-1 → 20-2 → 20-3，16 项全部实现），来源 [docs/play-review-2026-10-18.md](../docs/play-review-2026-10-18.md)。没有执行任何 git 命令（工作区里 D-072 / D-073 的未提交改动原样保留，在它们之上继续改）；没有新增依赖、没改 `package.json`；`judge.ts` 与 core 没改；`schemaVersion` 不变、没加存档字段；`CONTENT_VERSION` 仍是 6、catalog 没改；没加任何自动语音（新句子都在点按时说，音效可以自己响）；新动画都有减少动效分支（只换色 / 透明度）。`pnpm lint:purity` 每节都是零命中。

## 20-1 判题与反馈（D-074 – D-080）

- [x] 1. 两种拼法并排（D-074）：`level-session.ts` 新 `judgedMat` / `matOf` / `wayAside` / `roomBeside`；`standingWays` 找"恰好是一种用过的拼法、两个伙伴已接好、自成一簇"的部分，判题前剔除。`startSession` 与 `commitCommand` 共用 `walk`（第二种判法：一种允许拼法自成一簇、旁边还有别的块 → 记为已拼的一种），刷新不丢第一种；完成过的站两种并排仍是对的。`sameWayAgain` / 求助 / `solvedParts` / `solvedEquation` 都看剔除后的部分；云朵两行 `3 + 4 = 7` / `5 + 2 = 7`（按拼出先后，`LevelScreen` 两行字号）。"换一种拼法"态第三级 `hint.beside`"在旁边再拼一个 7"并点亮要拿的那一对；放不下（第一种在中间一行）就仍走同和句。
- [x] 2. 庆祝分两拍（D-075）：`SOLVE_SETTLE_MS = 600`。第一拍 success / fanfare 音、笑脸、绿卡，完成与作品册即时派发；第二拍（彩纸、过关动作、云朵 pop、"下一站 / 再玩一次"）由 `armSettle` 计时，`onDragActive(true)` 暂停、松手后重新计时，改错（`dropSettle`）就取消；撤销、再玩一次也取消。
- [x] 3. 求助逐级升（D-076）：`hints.ts HELP_LADDER_STEPS = 3`、`rungOf`、`helpAt`、`sendOnly`、`biggestFirst`；`LevelScreen` 用 `asks`（求助次数）+ `pointed`（自动第一级）代替原 `helpLevel`；第 1 下数量不对时工作台上的块依次亮数字（`COUNT_UP_STEP_MS = 320`，count 音，不念数词，只显示）；17 Boss 空台求助说完题目再排队说"先搬最大的伙伴"并点亮 10（`hint.biggest`）。
- [x] 4. 求助语音不被掐断（D-077）：`correction-voice` speaker 返回 boolean，只有出声才记 `spokenSig`；`LevelScreen` 返回 `AUTO_SPEECH.correction`。送回被点名的伙伴后，求助点亮过、位置没变的（要拿的那个）保持点亮到下一次提交（`carry`）。
- [x] 5. 自由和不报差数（D-078）：`fewer && (puzzle.given !== undefined || q.kind === 'sum_composition')` → "还不到 n"。
- [x] 6. 看到的 = 听到的（D-079）：`hint.fewer.blocks`"还不到 n，再拿 k 块"；成功时点卡片先念成功句、再排队念卡片正文；`feedback.matched.quantity.one`；"Let's find"；家长区"语言 / Language"；英文菜单"Keep playing"。
- [x] 7. 承认孩子的发现（D-080）：同和且两个伙伴相贴 → 蓝卡 `feedback.same-sum` + `hint.find`，无"需要调整"音、无困惑脸，复用 stepHop 小庆祝；`asksForHelp` 包含这一态。数量 / 造型题过关列部分（`feedback.matched.parts.2…5`，伙伴 + 相贴的散块组，从左到右）；ch1-n6 最后一步 `feedback.matched.same`。
- 门禁（20-1 结束）：`pnpm lint` 0；`pnpm typecheck` 通过；`pnpm lint:purity` 零命中；`pnpm test:gate` 55 suite / 800 测试（基线 783），覆盖率全部 97.61 / 93.96，screens 96.09 / 91.69，content 98.04 / 95.4，core 100 / 99.09，progress 99.02 / 97.59；`pnpm build:web` 通过。

## 20-2 界面与手感（D-081 – D-086）

- [x] 8. 图标（D-081）：`icons.tsx` 新 `bulb`、`star`（五道射线绕中心转 + 圆心；第一版三角拼法在浏览器里像只鸟，已重画）、`count`；`PillButton` 可选 `icon`；菜单 继续 play / 帮助 bulb / 撤销 undo / 重新挑战 again / 回地图 map；底栏 下一站 play / 回地图 map / 岛完成 star；`AnswerFeedback` 的 💡 换成 bulb。
- [x] 9. ↻ 不再一图两义（D-081）：再数一遍用 `count` 图标；再玩一次 / 重新挑战前答案是对的就留着那一局（`replayed`），新一局没有可撤销时撤销拿回整局。
- [x] 10. 岛收尾页防连点（D-082）：`ISLAND_SKIP_AFTER_MS = 800`；地图奖杯是按钮（"奖杯 / Trophy"），replace 到 `/island/ch2`。
- [x] 11. 家长区清空（D-083）：提示文字在上、取消（accent）+ 清空（plain）在下，`CONFIRM_GAP = 60`（浏览器实测重置按钮 56px 高，第一版按 52 算只隔 56px，已改）；`store.ts RESET_BACKUP_KEY`，`createSaver().reset` 先备份原串；`progress-store undoReset`；`ParentScreen` 本次停留期间显示"撤销清空"和一句说明。
- [x] 12. 点托盘里的角色（D-084）：`Stage` 新 `onTapTray`，托盘对象 `onTap` → hop（负数 tick）+ 关卡 / 沙盒念数词。
- [x] 13. 就近吸附（D-085）：`layout.ts nearbyOrigins`、`settleOrigin`；`Stage` 的 `dropUnit` / `dropPartner` / 两个 preview 都走 `settleAt`，伙伴优先贴住其他伙伴；落回自己原位算 same。
- [x] 14. 小修（D-086）：`+html.tsx` `#boot` 天空色 + 标题占位、robots meta；`vercel.json` `X-Robots-Tag: noindex`（JSON 不能写注释，同一条说明写在 `+html.tsx` 与 README）；菜单 `accessibilityLabel` = MENU.menu；地图 `<ParentGate muted>`、删 `parentButton` 透明度；README 部署状态。
- 门禁（20-2 结束）：lint 0、typecheck、purity 零命中；`pnpm test:gate` 55 suite / 805 测试（之后补了托盘点按测试），覆盖率全部 97.44 / 93.84；`pnpm build:web` 通过。

## 20-3 招牌时刻（D-087、D-088）

- [x] 15. 合体变身（D-087）：`blocks-ui/merge.ts`（`MERGE_ON = 'success'`、`MERGE_SEAM_MS = 220`、`MERGE_BLINK_MS = 220`、纯函数 `mergedClusters`：含伙伴、≥ 2 个部分的簇，给出总数、部分、头块、接缝）；`Stage` 新属性 `merge` / `onJoin`，状态机（`view` + `truth` ref + 计时器）：新解的第二拍 → 接缝亮（`SeamGlow`）→ 脸转向对方并眨眼（`BlockBody` 新 `look`，`wink` 用负数 tick）+ `onJoin` → 合成一个角色；之后再合（拖开又放回）只换色；`lifted` 让拿起的那一块所在的角色立刻分开。各部分的外观覆盖：颜色 `hueFor(总数)`、只有头块有脸（`PartnerView faceAt`）、一个总数徽章（`NumberBadge`，放在含"上排最后一格"的那一块）、底板按整个角色的轮廓圆角（`GripPlate around`，散块也画底板）、同一错开序号与转动中心（`pivot` → `transformOrigin`），车轮等合完再出现。`LevelScreen` 传 `merge={MERGE_ON === 'touch' \|\| (solved && !settling)}`，`onJoin` → `play('join', total, parts)`；岛收尾页与作品册放大传 `merge`；`pictureOf` 按合体后的样子上色（作品册缩略图）。`sfx.ts` 新 `join`（`notesFor(name, step, parts)`、`JOIN_STEP`），`Sfx.play` / `sound.play` 多一个 `parts` 参数。
- [x] 16. 自由玩冒数字（D-088）：`sandbox-session.ts clusterChanges`；`SandboxScreen` 每次提交后算变化 → `bubbles`（`Stage` 新属性，`NumberBubble`，`BUBBLE_MS = 800`）+ `play('join', …)`。
- 门禁（20-3 结束）：lint 0、typecheck、purity 零命中；`pnpm test:gate` 56 suite / 816 测试，覆盖率全部 97.58 / 93.82；`pnpm build:web` 通过。

### 改了期望的旧测试（逐条）

- `screens/hints.test.ts` "right count does not claim success for a wrong shape or the wrong partners"：5 + 2 相贴现在是"也是 7"的发现（D-080），把 2 挪到第 3 行（不相贴）继续测原来的"数量够了，再找对伙伴"；补英文"Let's find 3 and 4"。
- `screens/hints.test.ts` "loose stops keep the single-block hints"：空工作台的第一级句子"还不到 2，再拿一块"→"还不到 2，再拿 2 块"（D-079）；补一块时仍是"再拿一块"。
- `screens/hints.test.ts` "2026-10-16 review A-4: 3 + 4 built as 5 + 2"：tone adjust → building，标题"5 加 2 也是 7！"，第一级"我们先找 3 和 4"→"再找 3 和 4"（D-080）；第二级同和句不变。
- `screens/hints.test.ts` "the 2 sent back and 1 + 4 built"：卡片标题"数量够了，再找对伙伴"→"1 加 4 也是 5！"（D-080）。
- `screens/hints.test.ts` "the first way still on the mat"：第二级"3 加 4 也是 7！再找 5 和 2"（点亮四个）→"在旁边再拼一个 7"（点亮 5 与 2）（D-074）；补第一种在中间一行时仍是原同和句。
- `screens/hints.test.ts` 两个属性测试：大数站那个把新 key `hint.fewer.blocks` 当作"再拿一块"处理（动作相同）；合体岛那个改成 `test.each` 跑两遍（整句帮助 / 求助阶梯：先按第 2 级做，回到见过的工作台再问一次拿到完整句，并模拟 D-077 的"送回后要拿的那个保持点亮"）。
- `screens/level-session.test.ts` "the first way is a step and is used up"：第一种拼好后 verdict 由 groups-mismatch → count-mismatch / benchCount 0（自成一簇的第一种被剔除，剩下的什么都没有，D-074）。
- `screens/correction-voice.test.ts` setup：speaker 回调改为返回 true（签名变化，期望不变）。
- `screens/LevelScreen.test.web.tsx`：`beforeEach` 改用 `jest.useFakeTimers({ advanceTimers: 1 })`（时钟照常走，可快进），新 `beat()` 快进 `SOLVE_SETTLE_MS`；以下 10 个测试在过关后加 `beat()` 才断言"下一站 / 再玩一次 / celebrateTick"：ch2-n7 的 3 + 4（另断言第一拍时没有"下一站"、tick 为 0、表情已是 happy）、"breaking a right answer"、"review B"、"finished island's last stop"、"COUNT_TO_PASS"、"review H / I"、"review L"、"play again"（再次过关前 tick 为 0）、"ch2-n5 one move solves it"、"7 made two ways"。
- `screens/LevelScreen.test.web.tsx` "wrong answers show and speak a useful correction"：拼对后点卡片念 ['2，就是 2 块'] → ['2，就是 2 块', '可以去下一站啦']（D-079）。
- `screens/LevelScreen.test.web.tsx` "asked-for help names the partner and lights it"：一次点卡片 → 三次（第 1 下卡片原句 + 6 块依次亮数字、第 2 下"把 2 送回去"、第 3 下"把 2 送回去，换 3 过来"）；送回 2 后 3 仍点亮（原来断言灯全灭，D-077），数字标签消失。
- `screens/LevelScreen.test.web.tsx` "short of 5 … 1 + 4 is 5 too"：4 多了要点三下才到"把 4 送回去，换 3 过来"；"把 2 搬过来"在第二下；1 + 4 的标题由"数量够了，再找对伙伴"变为"1 加 4 也是 5！"并有小庆祝，第三下才是同和句。
- `screens/LevelScreen.test.web.tsx` "7 made two ways"：第一种在工作台上时第一下"再用另外两个伙伴拼出 7"点亮 3、4，第二下"在旁边再拼一个 7"点亮 5、2（原来一下就是同和句点亮四个，D-074 / D-076）。
- `screens/LevelScreen.sound.test.web.tsx`：同样改用快进计时器；"Phase 19: who's missing and two ways …"点两下才念到"把 4 送回去"；"play again opens with the arrive sound"在"再玩一次"出现前先 `beat()`。
- `screens/IslandDoneScreen.test.web.tsx`：快进计时器；两个测试点"去合体岛 / 回地图"前快进 `ISLAND_SKIP_AFTER_MS`，第一个另断言刚打开时的点按无效（D-082）。
- `progress/reliability.test.ts` "reset waits for the write in flight"：写入序列 [old, null, fresh] → [old, old（备份）, null, fresh]，另断言 `RESET_BACKUP_KEY` 是原串（D-083）。
- `blocks-ui/picture.test.ts` 两个：ch1-n5 的 3 + 两块单块由"3 色 + 2 色、两张脸"变为一个 5 色、一张脸（另测拆开后回到 3 + 2）；17 由"三张脸"变为一个 n10 色、一张脸，并加 8 砖一个 n8（D-087）。
- `screens/AlbumScreen.test.web.tsx` "only what was built is shown"：ch1-n12 三张脸 → 一张，ch2-n8 两张 → 一张（D-087）。
- `screens/SandboxScreen.test.web.tsx` "counting says the numbers and the total once"：音效里多了摆一排时的 `join:1`、`join:2`、`join:3`（D-088），分开断言。

### 新测试（+33，783 → 816）

- `level-session.test.ts` +3：两种并排不相贴过关、云朵两行、完成后重开仍对、哪种先都行；贴成 14 块判多了、送回再拼仍过关、未接好的第一种不剔除；第二种中途刷新从第二步继续、`roomBeside`（顶行有地方、中间一行没有）。
- `hints.test.ts` +9：`rungOf` 与 `HELP_LADDER_STEPS`；swap 三级与 `countUp`、阶梯为 1 时等于整句；错伙伴第一级点亮工作台伙伴、空工作台不纠正；17 Boss `biggestFirst`；Q5 "还不到 5"；Q6 单数与"再拿 2 块"；F5 部分列举、8 砖"4 和 4"、ch1-n6"变了样子"；F5 同和蓝卡（中英）与三级；合体岛属性测试的阶梯版。
- `correction-voice.test.ts` +1：不出声的纠正不 `stop` 后面的求助（旧代码失败）。
- `LevelScreen.test.web.tsx` +4：手指按着时第二拍等着、改错就不来、放下再等 600ms；两种并排过关、云朵两行、作品册 14 块、重开仍两行；再玩一次后撤销拿回整局、菜单 aria "菜单"；17 Boss 空台求助两句排队并点亮 10、托盘点按念"十"不计数、普通站没有第二句。
- `LevelScreen.sound.test.web.tsx` +1：正式策略下纠正计时器到点后求助、照做第一步，不触发 `stop`，3 仍点亮。
- `ParentScreen.test.web.tsx` +1：问题在上、取消亮色、清空白色；清空后备份键是原串；撤销清空写回。
- `reliability.test.ts` +1：reset 备份原串；没有存档不备份；备份写失败不影响清空。
- `layout.test.ts` +2：`nearbyOrigins` 顺序与边界；`settleOrigin` 原位 / 最近 / 优先 / 无处可放。
- `merge.test.ts` +5（新文件）：默认值；3 + 4 一个簇（总数、部分、头块、接缝、key 稳定）；分开 / 单个伙伴 / 只有散块都不合；3 + 两块单块是 5；8 砖、17。
- `Stage.test.web.tsx` +3：已对的 1 + 1 打开即一个 2；新解的接缝 → 眨眼 + join → 一个 8（车轮等着）、同一解再合不再闪；自由玩数字气泡。
- `sfx.test.ts` +1：join 的音高顺序与时长、三部分、带 parts 播放。
- `sandbox-session.test.ts` +2：并起来的变化与部分、新放一块；拆开两处各一、整组挪动无变化、放回缩小。
- 已有测试里加的断言：`MapScreen` 奖杯可点与 aria；`SandboxScreen` 托盘点按念"一"。

## 浏览器走查（Checkpoint 20）

内建浏览器（`preview_start expo-web`，dev 模式），视口 375 × 812 为主；拖放用浏览器面板的 `left_click_drag`（RNGH 的 pointer 事件），存档用 localStorage 种子（与 `unlockedTo` 同格式）；页面里包了 `OscillatorNode.frequency.setValueAtTime` / `speechSynthesis.speak / cancel` 与一个 MutationObserver 记录音高、语音、彩纸 / 下一站 / 接缝 / 气泡的出现时刻。没有听声音。截图 22 张 `docs/review-assets/p20-01` … `p20-22`。

- [x] 从清空 localStorage 的新存档开始：地图 → 1 站拖一块过关，"下一站"在过关后才淡入（带 ▶ 图标）。
- [x] ch1-n2 多拖一块（三次拖放相隔约 50ms）：success 音 → 第三块落下响"需要调整"→ 白色"回地图"；全程没有出现彩纸，也没有出现"下一站"（`p20-01`）。
- [x] ch1-n5 3 + 3 块（多 1 块）连点卡片三下：第 1 下说"比 五 多了，放回一块"并依次响 count 音 261.63 → 440（6 个、不念数词），6 块亮出 1–6（`p20-02`）；第 2、3 下同一句并点亮多出的一块（这站的最短一步就是放回一块，没有要点名的伙伴）。
- [x] ch2-n5 把 4 贴在 2 右边连点三下：①"比 五 多了，把一个伙伴送回去"+ 数字 1–6；②"把 四 送回去"点亮 4（`p20-03`）；③"把 四 送回去，换 三 过来"点亮 4 与 3（`p20-04`）。把 4 送回托盘：没有 `cancel`，3 仍点亮（`p20-05`）。把 3 贴到 2 右边：success 音即时，约 630ms 后彩纸 + 下一站 + 接缝，再约 230ms 响 join（293.66 / 329.63 / 392 + 784 = 2、3、5），变成一个蓝色的 5、一张脸、一个"5"徽章（`p20-06`）。
- [x] ch2-n1：1 + 1 合体过程（接缝、转脸，`p20-07`）→ 一个橙色的 2（`p20-08`）。
- [x] ch1-n8：两条绿色的 4 → 一个青色的 8，一张脸、一个"8"，车轮在合完之后才出现（`p20-09`）。
- [x] ch2-n8：3 + 4（第一步跳一下，各自颜色不合体）→ 点卡片两下：②"在旁边再拼一个 7"点亮 5 与 2（`p20-10`）；5 放在下面一行时"还不到 7"（不是"多了 7 块"）；再放 2 → 云朵两行"3 + 4 = 7 / 5 + 2 = 7"、两个粉色的 7、"合体岛完成了"带星星图标（`p20-11`，星星第一版画坏，重画后复查）。
- [x] 岛收尾页连点：点"合体岛完成了"后立刻在收尾页按钮位置连点两下，页面没被跳过；Boss 作品是两个合好的粉色 7（`p20-12`）。回地图 → 奖杯在、点奖杯进 `/island/ch2`；地图 ⚙ 的透明度只在齿轮自身（0.85）。
- [x] 家长区清空后撤销：确认态问题在上、取消（橙）清空（白）在下，清空键上沿 744、原重置按钮下沿 684，隔 60px（`p20-14`）；清空后 `progress.before-reset` 是原串（完成 20、作品册 1），出现"撤销清空"与说明（`p20-15`）；撤销后完成 20、作品册 1、"从合体岛第 8 站开始"都回来，按钮消失。标题"语言"。
- [x] 冷启动占位：整页刷新时先看到天空色和"Amber Blocks"（`p20-13`）；生产构建 `dist/index.html` 里有 `#boot` 与 `robots noindex, nofollow`。
- [x] 沙盒连块：放一块冒"1"、贴上第二块冒"2"、隔开放的一块冒"1"、补上空隙冒"4"、再接一块冒"5"（`p20-16`），join 音按部分再总数（4 = 2 + 1 + 1：293.66、261.63、261.63、349.23 + 698.46）；从中间抽走一块，两边的 2 与被抽走的 1 各冒一次（记录里同时出现"2"与"1"两种气泡），只响总数；每个气泡约 0.78 秒消失；点盒子里的一块说"一"。全程不说别的话。
- [x] 英文模式（ch2-n3 2 + 2）：3 单独放时琥珀"Try a different partner"+ 需要调整音；把 1 贴上 → 蓝卡"3 plus 1 is 4 too! / Now find 2 and 2"、跳一下、success 音、表情 calm（`p20-17`）；三下求助"Now find two and two"→"Send the three back"→"three plus one is four too! Now find two and two"并点亮四个（`p20-18`）；菜单"Keep playing / Help / Undo / Back to map"带图标（`p20-19`）。
- [x] 360 × 640（英文 ch2-n8 两种并排）：短屏云朵两行在云内，"Join Island done!"带星（x 94–322、下沿 633）与圆形再玩一次都在屏内（`p20-20`）。
- [x] 667 × 331 横屏：重新打开已完成的 ch2-n8 直接是两个合好的 7（不再闪），侧栏云朵两行、"Done!"带星在屏内（`p20-21`）；英文菜单两行三列，"Keep playing""Back to map"在 176px 的格子里折两行，全部在卡内（`p20-22`）。
- [x] 控制台：dev 与生产构建（`static-dist`，8787）都是 0 error。warning：dev 模式 RN-web 的 `useNativeDriver` 回退（生产构建没有）；从地图 ▶ `router.push` 进关卡时 "Blocked aria-hidden on an element because its descendant retained focus"（被点的 ▶ 留着焦点，所在页面被 Stack 设为 aria-hidden；生产构建也有；这条路本轮没改，见已知遗留）。

## Checkpoint 20（最终）

- [x] 门禁（文档写完后最后一次）：`pnpm lint` 0 问题；`pnpm typecheck` 通过；`pnpm lint:purity` 零命中；`pnpm test:gate` 56 suite / 816 测试全过（基线 783；19.5s），覆盖率全部 97.58 / 93.82（语句 / 分支），content 98.04 / 95.4、core 100 / 99.09、progress 99.03 / 97.61（门禁 95，均达标）、blocks-ui 98.09 / 92.15、screens 96.08 / 91.4（基线 95.75 / 90.29）；jest 输出里没有 console error / warning；`pnpm build:web` 通过，dist 2.9 MB。
- [x] 没有删测试；改了期望的旧测试逐条见上。
- [x] 规格与文档：决策 D-074 – D-088；`SPEC-screens.md`（结构、规则、验证）、`SPEC-blocks-ui.md`（合体、就近吸附、托盘点按、数字气泡、`pictureOf`）；README「当前实现」与「已知缺口」。

### 需要 Ted 决定（都留了一处可改的常量或一行）

1. `MERGE_ON`（`blocks-ui/merge.ts`）：`'success'`（答对才变，默认）还是 `'touch'`（贴上就变）。`'touch'` 只跑了单测（`Stage` 每个新簇都会走一遍接缝 / 眨眼），没在浏览器里走过。
2. 合体后是否保留"部分"的痕迹（测评 §6 #3）：现在彻底变成一个角色（只有总数徽章）；拿起任一块即分开。
3. `SOLVE_SETTLE_MS = 600`（两拍之间）。
4. `HELP_LADDER_STEPS = 3`（设 1 回到第一下就给完整句）；`COUNT_UP_STEP_MS = 320`；第 1 下亮出的数字留到答案变化为止（第 2、3 下仍显示）。
5. `ISLAND_SKIP_AFTER_MS = 800`。
6. `MERGE_SEAM_MS` / `MERGE_BLINK_MS` 各 220ms。
7. F5 的小庆祝复用了 success 音（brief 要求"复用两种拼法第一步的小庆祝"）：答案还没对就响"对了"的音，会不会让孩子以为过关。
8. "先搬最大的伙伴"只给数量题 Boss（实际只有 17 站）；卡片上仍写题目，这一句只说不写（与 D-079"念出来的就是写着的"略有出入）。
9. 自由玩：从盒子里新放上的单独一块也冒"1"并响一声；拆开时只响总数。
10. 再玩一次后撤销拿回的是整个上一局（含它自己的撤销历史）。
11. "两种拼法"实时推进也用了恢复的规则：一种拼法自成一簇、旁边已有别的块，也算第一步完成（否则实时与刷新后的判法不一致）。
12. 就近吸附"伙伴优先贴住其他伙伴"：在 ch2-n8 第二步，若松手点被占，第二种可能被吸到贴着第一种（变成 14 块"多了"），孩子要再挪开。

### 已知遗留（按 brief 不顺手修）

- 地图 ▶ / 下一站用 `router.push` 进关卡时的 aria-hidden 焦点 warning（被点按钮在隐藏的页面里保留焦点；dev 与生产都有，与本轮改动无关）。
- 8 列工作台仍贴着屏幕边（Q13，上轮待定）。
- F5 同和态第 3 级时，卡片标题与正文都以"3 plus 1 is 4 too!"开头（完整句本来就带这一句）。
- ch1-n5 这种"只需放回一块"的情况，第 2、3 级是同一句。
- "再玩一次"药丸没有图标（只有圆形版本有）。
- 横屏英文菜单"Keep playing / Back to map"折两行（在卡内）。
- `vercel.json` 不能写注释，noindex 的说明只在 `+html.tsx` 与 README。
- 浏览器面板在不截图时不会重新排版，脚本里量位置前要先截一张（只影响走查方法）。

### 只能真机确认

- 600ms 的两拍在手指上是"先对、再欢呼"还是"卡了一下"；手指还按着时第二拍等着是否自然。
- 托盘里真实手指的点按与拖动是否分得开（6px 阈值），点了会不会误拖。
- 合体时接缝 / 转脸 / 眨眼在手机尺寸下看不看得出；join 音在手机喇叭上能否听出"3、4、7"。
- 第 1 级求助的 count 音与说话的那句重叠时会不会乱。
- 就近吸附在手指不准时是否顺手，虚影跳到旁边格会不会让孩子困惑。
- Safari 字体下家长区清空键与重置键是否仍隔 ≥ 60px。
- 冷启动占位在真实网络与 Vercel 上的样子；部署后用 `curl -I` 看 `X-Robots-Tag`。
- bulb / count / star 图标在小尺寸上孩子能否认出。

## 网页图标：Amber（2026-10-18，Phase 20 之后）

- [x] Ted 要求换掉标签页上的 Expo 占位图标。比较了三个方向（单个琥珀色积木角色 / 琥珀积木加一个红色 1 / 2 × 2 四块一张脸），在 16 / 32 / 64 / 180px、浅色与深色标签栏上并排渲染：后两个在 16px 时红块和脸都成了噪点，选单个积木角色——游戏里同样的塑料、底边、高光和脸，琥珀色（`THEME.amber` / `amberDeep`），名字就叫 Amber。
- [x] `public/favicon.svg`（64 格绘制）；`public/favicon.ico` 内含 16 / 32 / 48 三张 PNG，每张直接从 SVG 按该尺寸渲染（Expo 自己生成时是从 48 缩下去，16px 发糊）；`assets/images/favicon.png` 换成 48px 新图（`app.json web.favicon` 不改）。`public/` 里有 `favicon.ico` 时 Expo 导出不再自己加 `<link rel="icon">`，所以 `+html.tsx` 写了 ico（带 sizes）与 svg 两条。
- [x] 主屏幕图标：`assets/brand/app-icon.svg`（天空色底、沙丘、Amber 微微倾斜跳起、沙上有影子；满版，主要内容在中间 80%）→ `public/icon-180.png`（apple-touch-icon）、`icon-512.png`（manifest），不透明。草稿里的一朵云挡住积木一角，删了。
- [x] `pnpm build:web` 后 `dist/` 里的 favicon.ico / favicon.svg / icon-180 / icon-512 都是新图，html 里三条 icon 链接；静态服务（8787）四个文件都能加载。typecheck、lint 通过（只改了 `+html.tsx` 与资源）。
- 没做：原生 App 图标（`assets/images/icon.png`、Android 自适应图标、iOS `assets/expo.icon`）仍是 Expo 模板；没在真机上看主屏幕图标。渲染用的脚本（headless Chromium 渲染 SVG、打包 ICO）在会话草稿目录，不在仓库里。

# Phase 21：合体岛换花样 + 自由玩随机题（2026-10-18，D-089 – D-096，内容版本 7）

按 [tasks/brief-phase-21.md](brief-phase-21.md) 21-1 → 21-2 → 21-3 做完，第 8 项（Boss 登场，可选）也做了。没有执行任何 git 命令；没有新增依赖、没改 `package.json`；core 没改（`judge.ts` 没动）；`schemaVersion` 不变、没加存档字段；没加任何自动语音（新句子都在点按时说）；新动画都有减少动效分支（Boss 轮廓不呼吸、只亮格；示范手反向时只在起点闪）。`pnpm lint:purity` 每节都是零命中；随机题的随机数由界面传入种子，content 里没有 `Math.random`。

顺序说明：先用当前 v6 代码生成三份种子存档（临时 jest 测试写文件、用完删除），冻结在 `src/progress/__fixtures__/archive-v6-phase20-{all-finished,ch2-half,ch1-half}.json`（种子 4242；全通的地图停在 ch2-n8、自由玩里摆着三块；合体岛做到 4 站、5 站把 4 贴在 2 旁边；数字岛做到 6 站、7 站拿出三块），之后才改题库。

## 21-1 内容引擎：三种新动作（D-089、D-090）

- [x] 1. 送走多的：`schema.ts` 的 `sum_composition.onMat?`、`Puzzle.onMat?`；`material.ts onMatMaterial`（托盘 = 干扰（可为空）+ 这一排，home 槽位在末尾；core `takeGroup` 从最左列起排成一排、竖直居中）；`generate.ts` 用 `prompt.send_away`（新文案，中英各一）；`solution.ts sendAway`（多出的依次 `returnGroup`）；`validate.ts assertOnMat`（和大于 sum、一对、一排里凑出 sum 的位置对恰好一个且就是它且相邻、全部材料里没有别的一对凑出 sum、开局恰好是这一排且连成一排、不与 given / ways 混用）；`bench.ts` 那一排原样放下、不加余量（`Need.dealt`）。
- [x] 2. 新模板 `TEN_2X5`、`STAIRS_6`（`catalog/shapes.ts`）。核对：右对齐楼梯是左对齐转 90°，默认对称判对；1 不在 2 的端上的"楼梯"判 shape-mismatch。用伙伴拼的造型参考解改为 `cover`（第一组加起来够数、又能按原样铺满图形的伙伴），旧 20 站的参考解与改动前逐条相同（HEAD 的旧 `solution.ts` 临时对比，6 个种子 × 3 个 variant）。
- [x] 3. 十几：`given: 10` 的 `fitBench` 是 9 × 3，10 两排在第 0–4 列、3 落在第 5 列，托盘里恰好一个 3。
- 门禁（21-1 结束）：`pnpm lint` 0；`pnpm typecheck` 通过；`pnpm lint:purity` 零命中；`pnpm test:gate` 56 suite / 827 测试，content 97.97 / 95.17（门禁 95）；`pnpm build:web` 通过。目录没改，指纹全部不变。

## 21-2 合体岛目录（内容版本 7）与界面（D-091 – D-094）

- [x] 4. `catalog/chapter-2.ts` 12 站（新站 n9 – n12 插在表中位置，原 8 站一字未改）；n12 的干扰取 [2, 4]（brief 没给，选的是 3 两边的数，都补不成 13）；n9 / n11 的 extra 取 1（同 8 砖）。n9 的十只认横放（`TEN_LYING`，D-090）：可转向时工作台 6 × 6，iPhone SE / 360 × 640 / 640 × 360 横屏上块只有 34–38px，横放的两个 5 也立不起来。`CONTENT_VERSION = 7`、`CONTENT_CHANGES[7] = []`；`fingerprint.test.ts` 版本 7，原 20 站指纹与版本 6 逐字节相同，新站 n9 `86c69617`、n10 `3ec25ced`、n11 `808c3608`、n12 `53dc5454`（描述里只为带 `onMat` 的站追加那一排与工作台）。地图 `labelOf` 不用改：新站标 10 / 7 / 6 / 13；地图与家长区芯片 12 个都排得下（数字岛本来就 12 站）。
- [x] 5. 迁移 v6 → v7（`progress/migrate.ts`）：`UPGRADE_CURRENT = 'first-open'`，`onwardFrom` 导出、带规则参数；完成记录、作品、作品册、自由玩原样（同一引用）；全通存档 `current` → ch2-n9。家长区"题库更新过"不出现、不列站（没有收起作品，`issue` 为 null）。
- [x] 6. 送走站界面：`level-session onlyOnMat` 并入 `atStart`；`hints.ts` 开题卡（`dealt && !opening` 才改说"找两个伙伴"）、`asksForHelp` 加开题与 onMat 站的拼搭态；`demoMove` 全部送回后搬那一对的伙伴；`Stage demoBack` + `DemoHand toScale`（虚影从工作台回托盘轮廓）；`LevelScreen` 对 `returnGroup` 传 `demoBack`。过关：3 + 4 合体成 7（Phase 20 合体照常）。
- [x] 7. 三个伙伴：合体、join 音（`mergedClusters` 部分 [1, 2, 3] → 依次响再响总数）、过关句"1、2 和 3，一共 6 块"本来就对；求助在"2 + 4 够数但搭不成"时进死路（"照着小图摆一摆"），已修（D-093，`hints.ts covers` / `shapeInReach` / `quantityPlan accepts`）。核对 `stack`：动作是 `stack`，但合体后楼梯是一个角色、整体跳一次（D-087 同一错开序号），不是一级比一级高——没改，列入需要 Ted 决定。
- [x] 8.（可选）Boss 登场：`BOSS_ENTRANCE`（`content/catalog/index.ts`，默认 ch2-n4、ch2-n8）、`blocks-ui/BossOutline.tsx`（`bossOutlineCells`、虚线格、pale 亮格、`sleepy` 脸、`useBreathe`）、`Stage outline` 属性（画在积木下、不接触摸）；`LevelScreen` 在没答对时传 `{ n, lit: matOf(session).bench.size }`。没做"拼满后醒来"：答对即消失，合体接着演。
- 门禁（21-2 结束）：lint 0、typecheck、purity 零命中；`pnpm test:gate` 56 suite / 917 测试，覆盖率全部 97.57 / 93.89，content 97.97 / 95.17、core 100 / 99.09、progress 99.04 / 97.67、screens 96.09 / 91.57；`pnpm build:web` 通过。

## 21-3 自由玩"随机题"（D-095、D-096）

- [x] 9. `content/challenge.ts`：`nextChallenge` / `challengeCap` / `CHALLENGE_RULES`（规则见 D-095；上限取"已完成站里最大的数，不小于 3"，避免只完成 1 站时上限变成 1 而无题可出）；`content/index.ts` 导出。
- [x] 10. 界面：`LevelScreen.tsx` 拆成 `LevelPlay` + `PlayHost`（地图站的 `LevelScreen` 宿主与原来行为相同，原关卡测试一条没改就通过）；`ChallengeScreen.tsx`（什么都不存、`key` 按轮次、答对卡片说拼了什么、底栏"回自由玩 / 再来一题"、菜单"回自由玩"）；路由 `src/app/challenge.tsx`、`vercel.json` 在兜底规则前加 `/challenge → /challenge.html`、`tools/serve-dist.mjs` 注释（`/challenge` 本来就由 `${pathname}.html` 规则服务）、typed routes 用 expo-router 自带生成器刷新（`.expo/types/router.d.ts` 有 `/challenge`）；`icons.tsx` 新 `dice`；`SandboxScreen` 底栏加骰子"随机题 / Random"（横屏侧栏三个工具折成两行）。React Compiler lint：`LevelPlay` 不能把用到 ref 的回调传进渲染期的函数调用，所以"再玩一次"由 `LevelPlay` 先画成药丸 / 圆形两种，宿主只挑；随机题首题用"先写 ref 再 setState"的写法（同 SandboxScreen）。
- 浏览器发现并修：英文"Back to free play"+"One more"两个药丸在 375 宽要 394px（"One more"出屏），改为英文与横屏时"回自由玩"是圆形 sandbox 图标键（同 2026-10-16 L-1 "再玩一次"的做法），中文竖屏仍是药丸。
- 门禁（21-3 结束）：lint 0、purity 零命中；`pnpm test:gate` 58 suite / 932 测试；typecheck 有一处测试文件类型错误（mock 的 `args[0]` 是 unknown），已修，再跑通过；`pnpm build:web` 导出 `/challenge`。

### 改了期望的旧测试（逐条）

- `content/catalog/catalog.test.ts`："eight join stops" → twelve；工作台表加 n9 6x3 / n10 9x3 / n11 6x4 / n12 9x3；"Phase 19: Join Island is three joins …" → "Phase 21: Join Island is twelve stops …"（12 站 spec 全表、造型站只用伙伴铺得满的只有 handles、送走站只有相邻的 3 + 4、n12 是 10、动作序列）。
- `content/demo.test.ts`：twenty → twenty-four stops（Boss 仍是 5 个）。
- `content/fingerprint.test.ts`：版本 7，描述追加 `onMat`，四个新指纹（原 20 个不变）。
- `content/bench.test.ts` "fitting it changed nothing but the mat"：对比用的旧工作台取"旧固定尺寸与新尺寸的较大者"——送走站那一排 9 宽放不进旧的 8 × 6；旧站仍在 6 × 5 / 8 × 6 上比。
- `progress/demo.test.ts`：合体岛 8 / 8 → 12 / 12。
- `progress/store.test.ts`：`richState` 按新地图顺序多完成 n9 / n10 / n11（否则 n5 锁着进不去），完成数 18 → 21（两处）。
- `progress/unlock.test.ts`：地图 20 → 24；ch2-n7 的下一站是 ch2-n12（另断言 n3 → n9、n12 → n8）；完成整岛的顺序；家长从 ch2-n3 开始、完成后打开的是 ch2-n9（原来 ch2-n4）。
- `progress/upgrade.test.ts` v5 → v6 那组改为"v5 → v6 → v7"：`v5Finished` 用版本 5 自己的地图（`V5_CHAPTERS`），因为 v7 的解锁顺序变了；去掉 `CONTENT_VERSION` 是 6 的断言；全通 v5 存档 `current` → ch2-n9（原 ch2-n8），n9 – n12 可玩、n8 锁着（前一站是 n12）、合体岛 7 / 12、打完五站全通；`loadArchive` 后 `current` 是 ch2-n9；"地图只从已完成站移到没完成的下一站" → 停在已完成的 ch1-n3 时移到 ch2-n9（原来不动，D-092 新规则）。
- `blocks-ui/tray.test.ts`：开局轮廓与"全部放回托盘"的起点从 given 推广到 onMat；"参考解之后对象不变"改为和"全部在托盘"的样子比（送走站参考解把 2 送回托盘，原来的开局样子里没有它）。
- `blocks-ui/layout.test.ts` "no stop got smaller blocks than with the old mats"：Phase 21 的四站不比（它们没有旧工作台，送走站在 8 列上放不下）。全部视口 ≥ 40px 的清单没有改。
- 界面测试里写死的地图顺序（`LevelScreen.test.web.tsx`、`LevelScreen.sound.test.web.tsx` 的 `unlockedTo`，`AlbumScreen`、`IslandDoneScreen`、`MapScreen` 的 `ORDER` / `finishedUpTo`）：换成 24 站的新顺序。
- `screens/IslandDoneScreen.test.web.tsx` "the last island"：完成 20 → 24 站、角色 8 → 12 个。
- `screens/hints.test.ts` 合体岛"按帮助操作总能完成"属性测试：站表加 ch2-n10、ch2-n12（两种模式都过）。

### 新测试（+116，816 → 932；手写 50 条，其余是按目录展开的 `test.each`：指纹 +4、托盘 +8、真实手机 × 新站等）

- `content/generate.test.ts` +9：送走站开局位置、home 槽位、参考解 1 步、左端多一个也行、九种非法规格、一排不连；十与楼梯模板、三个种子都由参考解搭出且诱饵留在托盘、楼梯一级一个伙伴、转向 / 少一块 / 多一块 / 不连通 / 不像；够数但铺不满的伙伴不是参考解；10 + ? = 13 的工作台与参考解。
- `content/challenge.test.ts`（新文件）+9：确定性、上限、新存档只出 1–3、ch1-n3 后只多方块、数字岛通关后五种造型且过 6 用握把、1 + 1 后有加法（和 ≤ 10、干扰不同尺寸）、全通后十与楼梯、不连着出同一题、各进度大量种子全部过 `validate` 且参考解判对。
- `progress/upgrade.test.ts` +6：v6 → v7 三份冻结存档什么都不丢（作品同一引用、作品册、自由玩）、全通存档四站可玩且地图停在 n9、合体岛做到一半、数字岛做到一半、经 `loadArchive` 不报升级不备份、`UPGRADE_CURRENT` 两种规则与边界。
- `screens/level-session.test.ts` +3、`screens/hints.test.ts` +6：送走站开题 / 一次过关 / 送错 / 全部送回；开题卡中英、开题阶梯、送错阶梯、过关句；楼梯 2 + 4、多了不引向 2 + 4、三部分过关句。
- `screens/LevelScreen.test.web.tsx` +4：n10 全流程（开题、示范手反向、问两下点名 2、送走过关、第二拍合体）、n9 / n11（十站起来、楼梯 stack、三部分过关句）、n12、Boss 轮廓（n4 亮格与消失、n8 第二种重新亮、普通站没有）。`LevelScreen.sound.test.web.tsx` +1：送走站开题与挪动不响"需要调整"，送错才响，送走响 success。
- `screens/ChallengeScreen.test.web.tsx`（新文件）+5：新存档进页出 1–3 的数字题、答对两个按钮 / 再来一题换题 / 回自由玩 / 全程零写入（存档原串不变，自由玩摆法在内）、按进度出题、菜单（没有重新挑战）与英文圆形回键、存档没读到时不出题。`SandboxScreen.test.web.tsx` +1：骰子进 `/challenge`、不写存档、摆法不动。
- `screens/MapScreen.test.web.tsx` +2：新站标签；v6 全通存档 12 站都画出、四个新站 available、没有奖杯、▶ 进 ch2-n9。`screens/ParentScreen.test.web.tsx` +1：v6 存档不提示升级、不列站、芯片 12 个、"现在从 合体岛 第 4 站 开始"。
- `blocks-ui/Stage.test.web.tsx` +2：送走站示范手（`demoBack`）、Boss 轮廓与 `bossOutlineCells`。`blocks-ui/merge.test.ts` +1：楼梯一个 6、部分 [1, 2, 3]。

## 浏览器走查（Checkpoint 21）

内建浏览器（`preview_start expo-web`，dev 模式），视口 375 × 812 为主，抽查 360 × 640 与 667 × 331；拖放用面板的 `left_click_drag`；存档种子用冻结的 v6 存档（临时复制到 `public/` 给页面 `fetch`，走查后已删除）或在页面里改 localStorage；页面里包了 `AudioParam.setValueAtTime` 与 `speechSynthesis.speak / cancel` 记录音高与语音，MutationObserver 记录示范手 / 接缝 / 下一站 / 彩纸出现的时刻。没有听声音。截图 21 张 `docs/review-assets/p21-01` … `p21-21`。

- [x] v6 全通存档升级：地图合体岛 8 / 12，四个新站 available，标记停在新的"10"（ch2-n9），没有奖杯（`p21-01`）；localStorage 里仍是 v6、`current` ch2-n8（没收起作品就不写回，第一次改动后才是 v7）。
- [x] ch2-n9：云朵 10、两排 5 的小图、托盘 5 / 4 / 单块 / 5；两个 5 叠成两排 → 一个紫色的 10、一张脸、"10"徽章（`p21-02`）。
- [x] ch2-n10：开局卡片 ✦"动手试试看 / 工作台上多了，送走多的，拼成 7"，3 + 4 + 2 在工作台上、托盘三个轮廓（`p21-03`）；约 5 秒示范手把 2 的虚影从工作台搬向托盘（`p21-04`）；点卡片一下说"工作台上多了，送走多的，拼成 七"并依次亮出 1–9（九个点数音），两下说"把 二 送回去"、卡片同句、光圈套住 2（`p21-05`）；开局没有"需要调整"音。把 2 拖回托盘 → 云朵"3 + 4 = 7"、"拼对啦！"，601ms 后彩纸 + 下一站，接缝 → join 音 329.63 / 349.23 / 493.88（3、4、7），一个粉色的 7（`p21-06`），没有语音。
- [x] ch2-n11：1、2、3 一级一个伙伴搭成楼梯 → join 音 261.63 / 293.66 / 329.63 / 440（1、2、3、6），一个紫色的 6、一张脸（`p21-07`）。
- [x] ch2-n12：10 两排已在工作台上（托盘里留两排轮廓），中文题目"已经有 10 了，再找一个伙伴，拼成 13"在 375 宽折成两行（"13"单独一行，在卡内）；3 拖到右边 → "10 + 3 = 13"、一个 13（与 10 同色，`hueFor` 封顶 n10）（`p21-08`）。
- [x] 自由玩 → 随机题：清空存档进自由玩，底栏"回地图 / 随机题（骰子）/ 全部收回 / 撤销"，摆两块（`p21-09`）；点骰子 → `/challenge`"拼出 2 块"（`p21-10`）；拼对 → 卡片"2，就是 2 块"、底栏"回自由玩 + 再来一题"（`p21-11`）；再来一题 → "拼出 3 块"、再来一题 → "2"；菜单"继续 / 帮助 / 撤销 / 回自由玩 / ⚙"（`p21-12`）；回自由玩 → 两块原样、撤销仍可用（同一页从栈里回来，`p21-13`）；全程 localStorage 原串不变。数字岛通关的存档刷新 6 次：3 转角、4 方块 / 长条、3、6 塔、4、4，没有加法；再加上 ch2-n1 刷新 7 次：2 + 7、6 塔、6 + 4、2、9、3 转角、5 + 2（`p21-14`）。
- [x] 英文：ch2-n10 "Give it a try / Too many! Send one back to make 7" 一行（`p21-15`）；英文随机题答对后两个药丸要 394px、"One more"出屏 → 改成圆形回键后 71–300px（`p21-16`）。
- [x] 360 × 640：ch2-n10 9 列工作台块 40px、用满屏宽，卡片一行（`p21-17`）。667 × 331 横屏：ch2-n10 工作台与托盘、侧栏云朵与两行卡片（`p21-18`）；随机题答对后侧栏圆形回键 + "再来一题"在 168px 侧栏内（下沿 326 / 331，`p21-19`）。
- [x] Boss 登场（ch2-n4，去掉完成记录的全通存档）：工作台中间五格虚线 + 睡脸；2 放在上一行 → 亮 2 格、"还不到 5"（`p21-20`）；3 贴上 → 轮廓消失、"2 + 3 = 5"、合体成一个蓝色的 5（`p21-21`）。
- [x] 控制台：0 error；warning 只有 dev 模式 RN-web 的 `useNativeDriver` 回退。一次面板点击菜单键没反应（DOM 命中的是菜单键，JS `click()` 能打开），在同样的"答对 → 再来一题 → 点菜单"顺序下复现不出，记为面板工具的偶发。

## Checkpoint 21（最终）

- [x] 门禁（文档写完后最后一次）：`pnpm lint` 0 问题；`pnpm typecheck` 通过；`pnpm lint:purity` 零命中；`pnpm test:gate` 58 suite / 932 测试全过（基线 816；11.1s），覆盖率全部 97.6 / 93.83（语句 / 分支，基线 97.58 / 93.82），content 98.12 / 95.23（基线 98.04 / 95.4，分支降 0.17，仍过门禁 95）、core 100 / 99.09、progress 99.04 / 97.67（基线 99.03 / 97.61）、blocks-ui 98.09 / 92.15、screens 96.08 / 91.39；jest 输出里没有 console error / warning；`pnpm build:web` 9 个静态路由（多了 `/challenge`），dist 2.9 MB。
- [x] 没有删测试；改了期望的旧测试逐条见上。
- [x] 规格与文档：决策 D-089 – D-096；`SPEC-content.md`（`onMat`、新模板、`cover` 参考解、目录到内容版本 7、工作台尺寸、`BOSS_ENTRANCE`、随机题出题器）、`SPEC-progress.md`（v6 → v7、`UPGRADE_CURRENT`）、`SPEC-screens.md`（送走站、三个伙伴的求助、Boss 登场、随机题页面、测试清单）、`SPEC-blocks-ui.md`（示范手反向、Boss 轮廓）；README「当前实现」；`docs/level-progression.md` §5 改为现状。

### 需要 Ted 决定（都留了一处可改的常量或一行）

1. 合体岛 12 站的顺序与四个新站的数字（`catalog/chapter-2.ts`，brief 的表）；n12 的干扰 [2, 4]、n9 / n11 的 extra 1 是我补的。
2. n9 的十只认横放（`TEN_LYING`）：改成默认可转向是一行，代价是工作台 6 × 6、小屏块 34–38px。另：单块可以顶替伙伴，5 + 4（诱饵）+ 1 块单块也搭得成两排的十（同 8 砖的 4 + 3 + 1）；要排除就把 n9 的诱饵改成 3。
3. 送走站多出的伙伴只放在两端（`validate` 要求相邻）；全部材料里不许有别的一对凑出和（比 brief 的"一种送法"更严）。
4. 送走站开题也走求助阶梯（第 2 下"把 2 送回去"）；"还差谁"站开题不走（只说题目）。两者不一致是有意的：送走站不送任何一个，工作台上就一直是开题。
5. `UPGRADE_CURRENT = 'first-open'`（迁移后停在已完成的站 → 第一个"前一站已完成、自己没完成"的站，可能往回走，如停在 n4 的存档移到 n9）；`'next'` 是 Phase 19 的规则。
6. 楼梯合体后整体跳一次（D-087），不是 brief 设想的"一个比一个跳得高"。要后者需要给合体角色单独的动作，或楼梯不合体。
7. `BOSS_ENTRANCE` 只给合体岛两个 Boss；轮廓在带着半成品刷新时也显示（不只是进站那一刻）；答对即消失，没有"醒来"一拍。
8. 随机题 `CHALLENGE_RULES`：上限不小于 3；过 6 的数字题用 `handlesFor`（7–10 是一个 7–10 的伙伴 + 诱饵，一次拖拽就过）；图形题沿用原站的 handles / decoys；加法和 ≤ 10；先选题型再选题（三种题型等概率，数字题的数并不均匀地常出大数）。
9. 按钮文案"随机题 / Random"、"再来一题 / One more"、"回自由玩 / Back to free play"；英文与横屏时"回自由玩"是圆形图标键（没有字）。随机题答对卡片说"拼了什么"（"2，就是 2 块"），没有新文案。

### 已知遗留（按 brief 不顺手修）

- v6 → v7 没有收起作品，`progress-store` 读完不写回，存档在第一次改动前仍是 v6（每次打开都迁移一遍，结果相同）。K-1（D-057）只对 `upgraded` / `repaired` 写回。
- 9 列工作台和 8 列一样贴着屏幕边（Q13），送走站求助的光圈在右边被裁掉一点（`p21-05`）。
- 13（以及 12、17）合体后与 10 同色（`hueFor` 封顶 n10）。
- 中文"已经有 10 了，再找一个伙伴，拼成 13"在 375 宽折两行（在卡内）。
- dev 模式下关卡在面板里要 3–5 秒才画出舞台（截图里有几张空白，是渲染时机，不是功能）。
- 随机题没有"重新挑战"菜单项；`PlayHost.onReplay` 对随机题恒为 true（界面上没有入口）。

### 只能真机确认

- 孩子能否看懂"送走多的"：开局三个伙伴都在工作台上，会不会先去托盘拿东西；示范手反向（从工作台飞回托盘）是否看得出是"拿走"。
- 9 列工作台 40px 的块（360 宽）手指抓取；贴边的伙伴与 iOS Safari 左缘返回手势。
- 楼梯站孩子会不会拿 4 + 2 去试，"数量够了，再找对伙伴"能否引导到换伙伴。
- Boss 轮廓的呼吸与睡脸是否被当成"可以点"的东西；亮格是否被注意到。
- 随机题的骰子按钮孩子是否会反复点；"再来一题"的节奏是否让孩子停不下来（不计进度、没有奖励，是有意的）。
- 英文圆形"回自由玩"键家长能否认出是"回去"。

# 合体岛最终 Boss 判题修复（2026-10-18，第六轮产品评审 L1，D-097）

依据 [product-review-2026-10-18](../docs/product-review-2026-10-18.md) 第 3 节 L1（截图 `r6-07` / `r6-08` / `r6-09`）。没有执行任何 git 写操作；core（`judge.ts`）、目录、`CONTENT_VERSION`、存档结构都没改；没有新增依赖。

- [x] 判题：`level-session.ts` 第二步起按伙伴身份剔除已用拼法（`madeWays`：两个伙伴整个在工作台上、互相贴着，不要求自成一簇），`judgedMat` / `solvedEquation` 改用它；原来的 `standingWays`（自成一簇）只留给推进第一种。
- [x] 推进第一种（`walk` → `madeBeside`）：保留"自成一簇、旁边还有别的块"；加"两个伙伴贴着、剩下的只是下一种的一对或半对"（`partOfPair`，`sameWayAgain` 也改用它，逻辑与原来相同）。这样贴着的第二种中途刷新、两种贴着一起摆成、已完成的 Boss 重开都接得上；3 + 4 贴着干扰 1 不推进。
- [x] 求助：`roomBeside` 去掉"不贴着已拼的"条件，中间一行的第一种也说"在旁边再拼一个 7"、点亮 5 和 2。剩下部分的点名本来就只看 `matOf`，第一种贴着时不会再被点名送回。
- [x] Boss 虚线（可选项，做了）：`bossOutlineCells(bounds, n, made)` 第二步躲开第一种（先不贴着的空行，再空行，先下后上）；`LevelScreen` 传 `made: asideCells(session)`，`Stage outline.made` → `BossOutline`。
- [x] 浏览器里发现并修：贴着的两种过关后合体成一个紫色的"14"（合体按簇算，D-087），和云朵"3 + 4 = 7 / 5 + 2 = 7"对不上。`mergedClusters(state, apart)` / `pictureOf(state, apart)` 加 `apart`（每组只在组内合体）；`waysApart(session)` 给关卡页，`workWaysApart(node, work)` 给作品册卡片与放大、岛收尾页（`IslandDoneScreen` 抽出 `bossOf`）。
- 门禁：`pnpm lint` 0；`pnpm typecheck` 通过；`pnpm lint:purity` 零命中；`pnpm test:gate` 58 suite / 941 测试全过（基线 932），覆盖率全部 97.59 / 93.8（基线 97.6 / 93.83），blocks-ui 98.09 / 92.15、content 98.12 / 95.23、core 100 / 99.09、progress 99.04 / 97.67、screens 96.09 / 91.36（基线 96.08 / 91.39）。没有跑 `pnpm build:web`。

### 改了期望的旧测试（逐条）

- `level-session.test.ts` "Phase 20: the two ways touching are one 14-block cluster, too many" → "D-097: the two ways touching … are the solve"（同一摆法现在 `solvedNow`、云朵两行；送回第一对、第一种没接上仍在第 0 步两条不变）。
- `level-session.test.ts` 中途刷新那条：`roomBeside(middle)` false → true。
- `hints.test.ts` "the first way still on the mat"：中间一行的第一种，第 2 级由"3 加 4 也是 7！再找 5 和 2"（点亮四个）改为"在旁边再拼一个 7"（点亮 5、2）。
- `hints.test.ts` 随机求助属性测试（两种模式）：孩子听到"把它们接起来"时推的是点亮的那两个、推到碰上对方为止（原来推工作台上前两个伙伴、碰上任何一个就停）。新规则下第二种可以贴着第一种，原脚手架会去推第一种的 3 / 4，80 个种子里卡住 17（整段求助）/ 18（阶梯）个。
- `LevelScreen.test.web.tsx` Boss 轮廓那条：`outline` 多了 `made`（n4 与开局是 `[]`；n8 第一种在顶行后是顶行 7 格）。

### 新测试（+9，932 → 941）

- `level-session.test.ts` +4：第一种在虚线行、第二种在上一行 / 下一行（`test.each`，半成品"还不到 7"、过关、云朵两行、重开仍对、中途刷新接上、`asideCells` / `waysApart` / `workWaysApart`）；贴着一个干扰只判剩下的；贴着下一种半对的算第一种（`5 + 2 = 7 / 3 + 4 = 7`）、贴着干扰 1 的不算。
- `hints.test.ts` +1：贴着时"还不到 7"、三级求助都不点 3 / 4；干扰 1 时"把 1 送回去，换 2 过来"、阶梯第 2 下"把 1 送回去"；多了送回 1。
- `LevelScreen.test.web.tsx` +1：虚线行 + 上一行贴着的全流程（"在旁边再拼一个 7"点亮 5、2，"还不到 7"，过关、云朵两行、作品册 14 块、重开，`Stage apart` 两组 7）。
- `Stage.test.web.tsx` +1、`merge.test.ts` +1、`picture.test.ts` +1：轮廓躲行；分开前一个 14、分开后两个 7（颜色、脸）。

## 浏览器走查

内建浏览器（`preview_start expo-web`，dev 模式），视口 375 × 812；存档用临时 jest 测试生成"解锁到 ch2-n8"的 v7 存档，复制到 `public/` 给页面 `fetch` 写进 localStorage（走查后已删除，`public/` 无残留）；拖放用脚本化 PointerEvent（`setPointerCapture` 打桩）。

- [x] 开局：中间一行 7 格虚线 + 睡脸。3、4 沿虚线摆在中间一行 → "换一种拼法！"，虚线移到最下一行。点卡片两下 → "在旁边再拼一个 7"。5 贴在下一行 → "还不到 7"、亮 5 格；2 贴上 → "拼对啦！"、云朵两行、下一站"合体岛完成了"。
- [x] 第一次过关时合体成一个紫色的"14"，修了（上面第 5 项）；重开与再走一遍（第二种贴在上一行）都是两个粉色的 7。
- [x] 隔开摆：3 + 4 在顶行 → 虚线到底行（不贴着的那行）；5 + 2 在底行 → 过关、云朵两行。
- [x] 先送回第一对：3 + 4 在中间一行，把 3、4 拖回托盘（第一个拖回后仍是"换一种拼法！"，两个都回后是开局卡片），5 + 2 摆在中间一行 → 过关、云朵 `5 + 2 = 7`。
- [x] 作品册卡片：两排粉色、两张脸；岛收尾页 `/island/ch2`：工作台上两个"7"徽章。控制台 0 error。

### Ted 的决定（2026-10-18，按助手建议）

1. 只用判题层方案（加虚线换行），不做"第一种拼对后自动滑到顶行"：判题已接受所有摆法，自动挪作品只会让孩子困惑。
2. "贴着下一种半对也算第一种"保留，实时提交上也生效：拼出合法的一种就认，刷新前后规则一致。
3. 第二步虚线保留"先不贴着、再空行、先下后上"：第一种在上、第二种在下，与云朵两行顺序一致。
4. 下一步：先真机试 ch2-n8（虚线换行后孩子在哪拼第二种；贴着的两个 7 合体后是否看得出是两个，看不出再加间隔或描边）；"求助编号连第一种也编"与评审 L2–L4 一起做；"刷新时第二种只有干扰会退回第一步"先不管。L1 单独一个 commit。

### 已知遗留（不顺手修）

- 求助第 1 级在"数量不对"时给工作台上所有块编号（`helpAt countUp`，`LevelScreen` 用整个工作台），第一种留在旁边时也会被一起编号（Phase 20 起就这样，第一种自成一簇时也是）。
- 第一种被拉开（3、4 不再贴着）时它不算已拼，剩下的里有 3 和 4，求助会点名送回其中一个（拉开即拆掉，原来也是）。
- 第一种贴着第二种时刷新，若第二种只摆了一个干扰（不是下一种的伙伴），会回到第 0 步判"多了"（推进条件只认下一种的伙伴）。

### 只能真机确认

- 孩子看到虚线从中间一行跳到最下一行，会不会把它当成"要把第一种挪下去"。
- 贴在一起的两个 7 合体后看得出是两个（相邻两排同色，中间只有一道缝）。

## 图标与提示伙伴 Amber（2026-10-18，D-098）

- [x] Ted 给的 `Glossy Amber Chibi Girl Icon.png`（1254 × 1254，琥珀积木里的 Q 版女孩，天空 + 沙丘底，白边圆角）复制为源图 `assets/brand/app-icon.png`；旧矢量 `public/favicon.svg`、`assets/brand/app-icon.svg` 删除，`+html.tsx` 去掉 svg 那条 icon 链接。
- [x] 抠图：HSV 饱和度 > 0.35 的是积木描边，从图边泛洪去掉天空、沙丘、阴影和白边，剩下的就是积木（含脸和头发）；边缘 1.2px 羽化。透明底 `assets/images/amber-girl.png`（168px，最大显示 56px 的 3 倍）。
- [x] 标签页：`public/favicon.ico`（16 / 32 / 48，各自从全尺寸缩，16px 略锐化）与 `assets/images/favicon.png`（48）用抠出的积木满格；主屏幕 `public/icon-180.png` / `icon-512.png` 与原生 `assets/images/icon.png`（1024）用整张图满版，白边与圆角按同行最近的底色补齐。
- [x] 关卡页 `screens/AmberGuide.tsx`（`LevelPlay` 里，地图站与随机题都有）：竖屏绝对定位在 header 左下角（坐在左边小云前），下巴压在卡片左上沿 10px（紧凑 8px），在符号圆片之上；横屏在侧栏顶行的点数格（44px，不高于菜单行 48）；点数 / 再数一遍时她让出这个角。尺寸在 `LEVEL_CHROME.guide`，不进 header / 卡片高度预算。
- [x] 动作：`useBob(1.5px, 2.6s)` 轻浮动；`juice.ts useNod(cue)` 每条新提示（卡片 adjust 的标题 + 内容 + nudge 次数变了）点一下头，挂载时的值只记下不播（转屏不重播）；减少动效时都不动。`pointerEvents="none"`、读屏隐藏。
- [x] 测试：`layout-fit.test.web.tsx` 每个竖屏设备查她是绝对定位、下巴落在卡片上沿与圆片之间，横屏查她在侧栏里且不高于 48；`LevelScreen.test.web.tsx` 3 + 4 那条查点数时她不在、再数一遍后回来。941 测试全过，lint、typecheck、`build:web` 通过（`dist/` 只有 ico + apple-touch 两条 icon 链接，图都是新图）。
- [x] 内建浏览器（dev）：375 × 812、360 × 640、667 × 331 下量了矩形，她与云朵数字、菜单键、卡片符号和标题、工作台都不相交，页面无横竖滚动；脚本拖两块到第一站出"多了 1 块"时测到点头（转到约 −9° 再回正）。控制台 0 error。
- 没做 / 待定：Android 自适应图标、iOS `assets/expo.icon`、启动图仍是 Expo 模板；没在真机上看主屏幕图标；减少动效分支只按代码与既有 hook 同样的写法确认，浏览器里没法模拟；点她暂时没有反应（可以做成和点卡片一样重播提示，等试玩看孩子会不会去点她）。抠图 / 出图脚本在会话草稿目录，不在仓库里。

# Phase 22：拿走岛（2026-10-19，D-099 – D-104，内容版本 8）

按 [docs/take-away-and-compare-design.md](../docs/take-away-and-compare-design.md) §7 的 22-1 → 22-5 做完，只做拿走岛（比一比岛 / Phase 23 没做）。没有执行任何 git 命令；没有新增依赖、没改 `package.json`；`schemaVersion` 不变、没加存档字段；没加任何自动语音（新句子都在点按时说）；新动画（火箭发射）有减少动效分支（和其他过关动作一样不动）。`pnpm lint:purity` 每节都是零命中。

顺序说明：先用当前 v7 代码生成三份种子存档（临时 jest 测试写文件、用完删除），冻结在 `src/progress/__fixtures__/archive-v7-phase21-{all-finished,ch2-half,ch1-half}.json`（种子 4242；全通的地图停在 ch2-n8、自由玩里摆着三块；合体岛做到 6 站、5 站把 4 贴在 2 旁边；数字岛做到 6 站、7 站拿出三块），之后才改 core 与题库。

## 22-1 core：`split` 判定（D-100）

- [x] `judge.ts`：`Question` 加 `split { total, parts, except? }`；`VerdictReason` 加 `parts-mismatch`（数对了、簇数不对）与 `split-used`（落在 `except` 里的、已经拆过的分法）。**偏离设计稿**：稿子只写了 `parts-mismatch`；为了让"两种拆法"和"两种拼法"同一条路（`questionAt` 第二步把用过的拆法放进 `except`，core 判、界面只看 reason），多加了 `except` 与 `split-used`，没有在界面层偷改判定。拿走不加判定（`quantity`）。`judge.test.ts` +4。
- 门禁（22-1 结束）：core 测试全过；typecheck 要等 content / screens 接上新 kind 才能过（switch 穷尽），所以在 22-2 / 22-4 后补跑。

## 22-2 content（D-099、D-101）

- [x] `schema.ts`：`QuestionSpec` 加 `split { total, parts, ways? }`、`take_away { start, take, onMat?, steps? }`；`Puzzle.takeAway`。`material.ts presetMaterial`（单块一排在工作台上、托盘只有床位）；拿走伙伴复用 `onMatMaterial(onMat, [])`。`generate.ts`（倒数 → `quantity` 序列、`prompt.split` / `prompt.take_away` / `prompt.take_away.partner`）；`solution.ts`（`pullApart` 第 k 种 = 从右数第 k 块右移一格；`sendHome` 单块从右往左 / 伙伴那一组）；`validate.ts`（`assertSplit`、`assertTakeAway`、倒数 steps、`assertJoinedRow` 抽出与送走站共用）；`steps.ts`（`questionAt` 的 `except`、`benchPair` 没有伙伴时取两堆）；`bench.ts`（那一排加 1 格余量）；`challenge.ts numberOf` 接新 kind（随机题不出新题型）。
- [x] `catalog/chapter-3.ts` 8 站（设计稿 §3.1 默认表）；`CONTENT_VERSION = 8`、`CONTENT_CHANGES[8] = []`；`ISLAND_SHOWCASE = { ch3: ch3-n4 }`；`fingerprint.test.ts` 版本 8（原 24 站指纹不变；新站 n1 `81eccc44`、n2 `8d97d408`、n3 `46e7ebb8`、n4 `b6b0991c`、n5 `fc7dae1d`、n6 `2e58cc53`、n7 `93f43e80`、n8 `f87bbf98`；描述里追加 `takeAway` 与开局在工作台上的块）。`copy.ts` 加拿走岛的 23 个 key（设计稿 §6 里拿走岛用到的，加 `hint.pull.right` / `hint.split.another` / `hint.split.two` / `hint.bring.back` / `hint.send.home.left` / `hint.call.back.one`；比一比的 key 没加）。
- 门禁（22-2 结束）：content / core 测试全过，purity 零命中。

## 22-3 progress（D-099）

- [x] 种子存档（见上）；`upgrade.test.ts` 新 describe v7 → v8（三份存档什么都不丢、全通 → ch3-n1 且其余锁着、打完 8 站全通且每站作品按自己的问题判对、合体岛 / 数字岛做到一半不动、经 `loadArchive` 不报升级不备份、`UPGRADE_CURRENT` 两条规则都落到 ch3-n1）；`migrate.ts` 没改。
- 门禁（22-3 结束）：core / content / progress 302 测试全过。

## 22-4 screens（D-102 – D-104）

- [x] `level-session.ts`：`onlyPreset`（并入 `atStart`）、`takeAwayAt`、`splitDemo` / `demoMove` 的拆开与送回家分支、`solvedParts` / `solvedEquation` 的拆开与拿走（`SPLIT_EQUATION`、`MINUS`）、`cloudTitle`、`targetNumberOf`、`walk` 对倒数"数少于某一步就算过了"。
- [x] `hints.ts`：`GAP_TOLD_UNTIL`、`promptParams` / `promptLine`、`splitFeedback` / `takeAwayFeedback`、`partnerTakeAway(Line)`、`splitPlan` / `takeAwayPlan`、`lookHere` / `asksForHelp` / `sendOnly` / `helpAt` 的新分支；`hintFor` 对新站直接取卡片正文。
- [x] `LevelScreen.tsx`：云朵 `cloudTitle`；示范手 `move` / `return`（`demoTo` / `demoBack`）；倒数每步响 count 音而不是 success；第二拍 `launch` 音；点云朵念当前步。`Stage.tsx`：工作台上的单块可作示范起点（回床位 / 到 `demoTo`）。`cheer.ts` + `juice.ts` `launch`；`sfx.ts` `launch`；`MapScreen labelOf`；`IslandDoneScreen` 用 `ISLAND_SHOWCASE`。
- [x] 测试：`level-session.test.ts` +5、`hints.test.ts` +6、`LevelScreen.test.web.tsx` +5、`LevelScreen.sound.test.web.tsx` +2、`MapScreen.test.web.tsx` +2、`IslandDoneScreen.test.web.tsx` +1、`Stage.test.web.tsx` +1、`cheer.test.ts` +1、`sfx.test.ts` +1。
- 门禁（22-4 结束）：lint 0、typecheck 通过、purity 零命中、`pnpm test:gate` 58 suite / 1099 测试、`pnpm build:web` 通过。

## 22-5 文档

- [x] D-099 – D-104；`SPEC-content.md`（规格、材料、校验、目录表到版本 8、工作台、`ISLAND_SHOWCASE`）、`SPEC-screens.md`（拆开站、拿走站 / 倒数、地图与岛收尾、测试清单）、`SPEC-progress.md`（v7 → v8）、`SPEC-blocks-ui.md`（示范手搬单块、`launch`）、README「当前实现」、`docs/level-progression.md` §5b、设计稿状态行。

### 改了期望的旧测试（逐条）

- `content/demo.test.ts`：twenty-four → thirty-two stops，Boss 5 → 7。
- `content/catalog/catalog.test.ts`："two islands" → three（ch3 8 站、两个 ★）；工作台表加 ch3 八站。
- `content/fingerprint.test.ts`：版本 8；描述追加 `takeAway` 与"开局在工作台上的块"（只影响新站）；8 个新指纹。
- `content/generate.test.ts`：两条错误信息正则（"ways come from a sum spec" → "ways come from a sum"；"come from a sum spec" → "come from a sum or take-away spec"）。
- `progress/unlock.test.ts`：地图 24 → 32；`CHAPTERS` 3；ch2-n8 的下一站是 ch3-n1；完成整条链到 ch3-n8。
- `progress/upgrade.test.ts`：v5 的地图去掉 ch3（`V5_CHAPTERS`）；"全通"断言改为"拿走岛以外全通"（`beforeTakeAway`）；v6 → v7 组里写死的 `CONTENT_VERSION` 7 改为常量；`'next'` 规则从 ch2-n8 现在落到 ch3-n1（原 ch2-n8，另断言只有两岛时仍是 ch2-n8）。
- `screens/IslandDoneScreen.test.web.tsx`："the last island"（ch2）改为"合体岛完成了，去拿走岛"（按钮进 ch3-n1 的地图跳跃）；新加拿走岛收尾页测试。
- `screens/MapScreen.test.web.tsx`：奖杯要 ch3-n8 完成，奖杯进 `/island/ch3`。
- `LevelScreen` / `LevelScreen.sound` / `MapScreen` / `IslandDoneScreen` 测试里写死的地图顺序追加 ch3 八站。
- `audio-i18n/sfx.test.ts`：`NAMES` 加 `launch`。

### 新测试（+167，932 → 1099；其中指纹 `test.each` +8、真实手机 × 新站等展开若干）

见 22-1 – 22-4 各条；另 `generate.test.ts` 加了一组只为分支覆盖的"构建器拒绝"测试（`presetMaterial`、`sendHome`、`pullApart` 与 `validate` 的新分支）。

## 浏览器走查（Checkpoint 22）

内建浏览器（`preview_start expo-web`，dev 模式），视口 375 × 812 为主，抽查 360 × 640（英文）与 667 × 331（英文）；拖放用面板的 `left_click_drag`（块的位置先用 JS 读 `getBoundingClientRect`，刚进站时积木还在弹入、要等一下再读）；页面里包了 `AudioParam.setValueAtTime` 与 `speechSynthesis.speak` 记录音高与语音，MutationObserver 记录示范手 / 彩纸 / 接缝 / 下一站。浏览器里本来就有一份 v7 全通存档（Ted 之前走查留下的），打开即迁移到 v8、地图停在 ch3-n1（没写回，第一次改动后才是 v8）。没有听声音。截图 23 张 `docs/review-assets/p22-01` … `p22-22`。面板截图常常晚一帧（卡片还是上一句），每一步都另用 JS 读了卡片与云朵的文字确认。

- [x] 地图：合体岛下面多了"拿走岛 0/8"，第 1 站醒着、其余睡着，标签 3 / 4 / 4−1 / ★5 / 5−2 / 6−2 / 7−3 / ★5（`p22-01`）。
- [x] ch3-n1：云朵 3、卡片 ✦"把 3 分成两个伙伴"、三块贴成一排（一张脸）、托盘三个空床位（`p22-02`）；进站 5 秒示范手出现；把最右一块拖到隔一格 → 云朵 `3 = 2 + 1`、"拼对啦！"、两堆各自变色各一张脸、success 音、0.6 秒后彩纸 + 下一站（`p22-03`）。
- [x] ch3-n2：第二块挪到第一块上面 → `4 = 2 + 2`、两个橙色的 2（`p22-04`）。
- [x] ch3-n3：云朵 `4 − 1`、"4 个伙伴，送 1 个回家"（`p22-05`）；最右一块拖进托盘 → `4 − 1 = 3`、回去的那块在自己的床位打瞌睡、return 音 + success 音（`p22-06`）。
- [x] ch3-n4 ★：拉开最右一块 → success 音、"换一种分法！/ 再分成另外两个数"（`p22-07b`）；再把第四块挪过去 → `5 = 4 + 1` / `5 = 3 + 2` 两行、fanfare、彩纸（`p22-07`）。
- [x] ch3-n5：云朵 `5 − 2`；送一块 → 蓝色"还要再送 1 个 / 送 1 块回家"（`p22-08a`）；送两块 → `5 − 2 = 3`（`p22-08`）。
- [x] ch3-n6：开局 4 + 2 一排、"6 里送走 2，还剩几个？"、托盘两个轮廓（`p22-09`）；把 4 送回 → 琥珀"拿走的是 4，不是 2 / 把 4 叫回来，送走 2"、adjust 音、困惑脸；点卡片两下 → 念"把 四 叫回来，送走 二"、"把 四 叫回来"，光圈套住托盘里的 4（`p22-10`）；把 4 拖回、把 2 送回 → `6 − 2 = 4`、4 的 wiggle（`p22-11`）。
- [x] ch3-n7：3 + 2 + 2 一排、8 列工作台用满屏宽、托盘三个轮廓两行（`p22-12`）；送走 3 → `7 − 3 = 4`，第二拍两个 2 合体成一个绿色的 4（接缝、join 音 2、2、4）（`p22-13`）。
- [x] ch3-n8 ★：云朵 `5 − 1` 带星（`p22-14`）；每送一块：云朵 `4 − 1` → `3 − 1` → `2 − 1`、卡片"再送一个回家！/ n 个伙伴，送 1 个回家"、响剩下那个数的 count 音（349 / 329 / 293 Hz，往下走）（`p22-15`、`p22-16`）；最后一块 → `2 − 1 = 1`、fanfare、彩纸、发射音（do 到高 do），红色的 1 冲出画面再落回，底栏"★ 拿走岛完成了"+ 圆形再玩一次（`p22-17`）。
- [x] 岛收尾页 `/island/ch3`："★ 拿走岛 ★ / 所有的岛都完成了！"，八个角色欢呼（标签同地图），展示的是第 4 站的 3 + 2 两堆（`ISLAND_SHOWCASE`），按钮"回地图"（`p22-18`）；回地图：拿走岛 8 站全勾、彩旗 + 奖杯（`p22-19`）；存档 v8、32 站完成、`current` ch3-n8。
- [x] 360 × 640 英文：ch3-n6 开局 "Give it a try / Send the 2 home from 6" 一行、底栏 "Play again / Next stop" 在屏内（按钮下沿 632 / 640）（`p22-20`）；送错 4 后 "That was the 4, not the 2" / "Bring the 4 back, send the 2" 都是一行（JS 量得 220px，截图晚一帧没拍到琥珀卡）。
- [x] 667 × 331 英文：ch3-n5 已完成态侧栏 `5 − 2 = 3` + 圆形再玩一次 + "Next stop"（`p22-21`）；再玩一次后侧栏 `5 − 2`、"Give it a try / 5 here. Send 2 home"，5 块一排、托盘 5 个床位（`p22-22`）。
- [x] 控制台：0 error。

## Checkpoint 22（最终）

- [x] 门禁（文档写完后最后一次）：`pnpm lint` 0 问题；`pnpm typecheck` 通过；`pnpm lint:purity` 零命中；`pnpm test:gate` 58 suite / 1099 测试全过（基线 932），覆盖率全部 97.57 / 93.62（语句 / 分支），content 98.32 / 95.61（门禁 95）、core 100 / 99.13、progress 99.04 / 97.67、blocks-ui 98.09 / 92.15、screens 96.08 / 91.02；`pnpm build:web` 9 个静态路由。
- [x] 没有删测试；改了期望的旧测试逐条见上。

### 需要 Ted 决定（都留了一处可改的常量或一行）

1. 拿走岛的数字与顺序、岛名"拿走岛 / Take-away Island"、Boss 是倒数火箭（`catalog/chapter-3.ts`、`copy.ts chapter.ch3.title`；设计稿 §9 第 2、3、10 问）。
2. `ISLAND_SHOWCASE`（`content/catalog/index.ts`）：岛收尾页展示第 4 站而不是倒数剩下的 1（§9 第 14 问）。
3. `SPLIT_EQUATION`（`screens/level-session.ts`）：云朵 `3 = 1 + 2`；设成 `'none'` 只留 `3`（§9 第 4 问）。
4. `GAP_TOLD_UNTIL`（`screens/hints.ts`）：拿走单块站到 ch3-n5 为止说"还要再送 k 个"，之后只说"还没拿走 k 块"（§9 第 8 问）。
5. core 多了 `split-used`（第二个新 reason）与 `except`，没有只加 `parts-mismatch`（D-100）。
6. 校验口径：拆开只认两份；`ways ≤ floor(total / 2)`；拿走伙伴"唯一送法"按大小的多重集算（[2, 2] 送 2 算一种）；倒数只用单块；工作台按那一排加 1 格余量（送走站是原样放下）。
7. 倒数每步没有"先 pop 成 `5 − 1 = 4`、0.6 秒后再换 `4 − 1`"的停顿（答对立刻换到下一步，算式只在最后一步留下）；减少动效时火箭和其他过关动作一样不动（设计稿说"只闪一下"）。
8. 伙伴站送错的卡片正文一开始就是完整句"把 4 叫回来，送走 2"（设计稿 §5.2 这么写；阶梯只影响念什么、点亮什么）。中文里"叫 k 个回来"（标题）与"把 k 块叫回来"（正文）的量词按设计稿 §6（伙伴说个、单块说块）。
9. 倒数最后一步的成功句是"2 拿走 1，还剩 1"（设计稿没写最后念什么）。

### 已知遗留 / 没做

- 比一比岛（Phase 23）、随机题的新题型（`take_away` / `split`）、设计稿 §6 里比一比的文案 key：都没做（本阶段范围外）。
- "送多了"时设计稿说示范手从托盘搬回来：没做（示范手只在开题出现，和别的站一致）。
- 作品册里拿走岛那一组、家长区"从哪里开始"的拿走岛芯片：按 `CHAPTERS` 自动出现（有 jsdom 测试覆盖地图 / 岛收尾页），浏览器里没有逐一走。
- 面板截图晚一帧：`p22-02` 示范手、`p22-07b` 卡片、`p22-20` 之后的琥珀卡没拍到，文字都用 JS 读过确认。
- 走查时顺手观察到的旧现象（没改）：横屏 667 × 331 托盘在工作台下方而不是右侧（`arrangement` 按空间决定，Phase 21 之前就是这样）。

### 只能真机确认

- 火箭发射的手感（900px 冲出画面、1.7 秒落回）在高屏手机上够不够"冲出去"；减少动效下只是不动。
- 倒数的下行 count 音与发射音在手机扬声器上听不听得出"往下走 / 往上冲"。
- 4 × 3 工作台上 84px 的块"拉开一格"手指会不会碰到旁边的块；拆开站第二种拆法要把一块放到另一块下面（示范手演的那一步）。
- iOS Safari 的音频解锁与语音（同前几个 Phase）。

---

# Phase 23-0：顶栏开场仪式 + A-lite（2026-10-23，D-105 – D-109，内容版本不变）

依据 [shape-island-and-header-prd.md](../docs/shape-island-and-header-prd.md) §3、[brief-phase-23-0.md](brief-phase-23-0.md)；PRD §8 全按默认。顺序：23-0-1 → 门禁 → 23-0-2 → 门禁 + 三视口走查 → 冻结 v8 种子存档 → 23a。没有 git 操作、没加依赖、存档格式不变。

## 23-0-1 开场仪式 C（D-105、D-106）

- [x] `juice.ts`：`usePop(tick, peak = 1.32, from = 1)` 参数化；`usePulse(tick, times = 1)`；新 `useWobble(tick, delay)`（±8° 三下）、`useLean(tick, dx, dy, delay)`（探身 + 点头）。
- [x] `sfx.ts`：新音效 `look`（B4 → F♯5，音符晚 `LOOK_AT` 0.45 s；`step` 2 = 再唤起，不延迟、×0.7）。
- [x] `LevelScreen.tsx`：`looks` 计数（开站、再玩一次、随机题换题各 +1）→ 云朵 0.6 → 1.4 → 1、阴影闪深 450ms、小图 300ms 起摇、Amber 400ms 探身；`CLOUD_NUDGE_MS = 3500`、`CLOUD_NUDGE_MAX = 2`；触摸（拖起 / 点托盘 / 计数 / 落子 / 点云朵 / 点卡片 / 开菜单）后停；示范手显示期间不计，手收后重等；开站已拼对不提醒。序列换步只让小图 `useNod`。减少动效：阴影加深 + 小图边框 3px 1 秒（`LOOK_STILL_MS`）。
- [x] `AmberGuide.tsx`：`lean` 属性（只在仪式那 450ms 给 tick，转屏 / 计数后回来不重做）；`Cloud.tsx`：`flash`。
- [x] 测试：`LevelScreen.sound.test.web.tsx` 开站音 `['arrive', 'look']`（7 处）、倒数 slice 下标 +1；`ChallengeScreen.test.web.tsx` 1 处；新 describe "Phase 23-0: the cloud says look here"（fake timers：3.5 s 前不响、3.5 s 第一次、示范手期间不发、手收后第二次、不超过 2 次；四种触摸各自取消；再玩一次重新开始、拼对的站不提醒）；`sfx.test.ts` 加 `look`。
- [x] 门禁：lint 0、typecheck 过、purity 0、test:gate 58 suite / 1103、build:web 过。

## 23-0-2 A-lite（D-107 – D-109）

- [x] `chrome.ts`：`LEVEL_CHROME` regular 120 / 88 / 4 / 68、compact 88 / 56 / 4 / 48；新 `CLOUD`、`PICTURE_PAD`、`pictureBox()`。
- [x] `Cloud.tsx`：新 `TargetCloud`（尺寸取 `CLOUD`、阴影 `#8FC3E3`、`flash` `#6AAAD4`、`spotlight` 套整朵云）；旧 `Cloud` 不动（作品册在用）。
- [x] `LevelScreen.tsx`：小图进云、目标色 + 2px edge + 首格 calm 脸（`PICTURE_FACE_MIN = 10`）+ 没拼对时 `useBreathe`；云朵不是纯数字时不画；数字 72 / 52 档；旧的独立小图盒删掉。
- [x] `AnswerFeedback.tsx`：图标盘 44 → 48、开始态 Amber 脸（`START_SYMBOL`）、喇叭 40 → 44。
- [x] 测试：`layout.test.ts` chrome 常量（280 / 196、SE 357）、`SMALL` 的 Android 360 × 640 · 17 34 → 33；新 describe "the shape picture on the cloud"（所有目录模板 × 三种尺寸的小图盒 ≤ 云内框、PRD 表里的五个尺寸）；`LevelScreen.test.web.tsx` 两处 spotlight 选择器改成 `prompt` 下；新 describe "Phase 23-0: the shape picture rides on the cloud"（小图是云的子节点、目标色、一张脸、Amber 头像；拿走 / 加法 / 数量站没有小图）。
- [x] 门禁：lint 0、typecheck 过、purity 0、test:gate 58 suite / 1107、build:web 过。

## 浏览器走查（Checkpoint 23-0）

内建浏览器面板这次导航 localhost 一直被拒（"navigation denied"，`curl` 200），改用 Playwright（Chromium，dev 模式 `expo-web`）；存档先用 v7 全通夹具（删掉 ch1-n3 / n7 / n8 / ch2-n11 的完成），后来换成 v8 全通夹具。截图 `docs/review-assets/p23-*.jpg`。没有听声音（chime 只在 jsdom 里验证派发）。

- [x] 375 × 812 ch1-n3 再玩一次：云朵 bounding 0 ms 265 × 165 → 327 ms 163 × 94 → 静止 180 × 100（弹大再回）（`p23-01`）；3.5 s 云朵 testID 变 `cloud-look-1-1`（第一次脉冲）（`p23-03`）；5.3 s 示范手 + ghost 出现（`p23-04`）；卡片开始态是 Amber 的脸。
- [x] 375 × 812 实测：顶栏 0–120、云 180 × 100、小图 2 × 2 = 64（呼吸中量到 61–75）、卡 120–208、盘 48、舞台 212–744、底栏 744–812；ch1-n3 工作台 / 托盘积木 70（格不变）；**17 托盘积木 44**（PRD 预期 46 → 44 ✓）；ch1-n8 小图 4 × 2 格 28；ch2-n9 十 5 × 2 格 22；ch2-n11 楼梯 3 × 3 格 18；加法站 `1 + 1 = 2` 无小图（`p23-375-*`）。
- [x] 360 × 640：云 140 × 76，ch1-n3 小图格 22、托盘 67；17 托盘 41（视口内量；`layout.test` 里带浏览器栏的 Android 360 × 640 是 33）；ch1-n8 托盘 44；"下一站"下沿 637 / 640（`p23-360-*`）。
- [x] 667 × 331：**按 PRD"数字上、小图下"排时，答对后"下一站"下沿 373 > 331（ch1-n8 / ch2-n9 / ch2-n11 都出界）→ 改成并排**；改后 ch1-n8 下一站 267–327、ch2-n9 268–326、ch2-n11 269–327，都在屏内；17 托盘 40（`p23-667-*`）。
- [x] 减少动效（`emulateMedia reducedMotion: reduce`）：开站 200ms 小图边框 3px、阴影加深、云宽 180 不缩放；1.4 s 后边框 2px、阴影复原（`p23-05`）。
- [x] 控制台 0 error。

---

# Phase 23a：内容 v9 六站造型快赢（2026-10-23，D-110 – D-111，内容版本 9）

## 种子存档（先于题库）

- [x] 用 v8 代码（23-0 完成后、题库没动前）生成三份，临时 jest 测试写文件、用完删除：`src/progress/__fixtures__/archive-v8-phase22-{all-finished,ch1-half,ch2-half}.json`（种子 4242；v7 三份种子经 v8 的 `migrate` 读入，全通那份再把拿走岛 8 站按参考解打完：32 站、地图停 ch3-n8、自由玩三块；数字岛一半停 ch1-n7、三块在工作台；合体岛一半停 ch2-n5）。

## 题库（D-110）

- [x] `catalog/shapes.ts` 八个模板；`chapter-1.ts` 插 ch1-n13 – n17、`SINGLES_DRAG_CAP`、`MIRROR_FOR_CHIRAL`、`TEN_UPRIGHT`；`chapter-2.ts` 插 ch2-n13；`CONTENT_VERSION = 9`、`CONTENT_CHANGES[9] = []`。工作台（拟合）：n13 5 × 4、n14 6 × 4、n15 6 × 4、n16 6 × 4、n17 6 × 5（写死）、ch2-n13 6 × 5，与 PRD 表一致。
- [x] `challenge.ts`：随机题沿用站自己的 `bounds`（D-111）。
- [x] `hints.ts`：`covers` 导出（只为测试，逻辑没改）。
- [x] 测试：目录（38 站 / 13 造型站、新站规格、三副面孔 4 take + 2 move、诱饵口径、拖数上限）、`bench.test` 允许站上写死的 `bounds`、指纹（旧 32 站不变，加 6 个，`FINGERPRINT_VERSION = 9`）、`demo.test` 38 站、`challenge.test`（新图都进骰子、站着的十随机题仍 6 × 5 且不转）、`hints.test` 用 `covers()` 验诱饵（甜甜圈 3+3+2、大楼梯 5+4+1 / 5+3+2 判假；带备用单块顶替算对）。
- [x] 升级：新 describe v8 → v9（三份存档什么都不丢、全通 → ch1-n13 且六站都开、打完六站全通且每站作品按自己的题判对、数字岛一半不动只开 ch1-n13、合体岛一半不动开数字岛五站、经 `loadArchive` 不报升级不备份）；`migrate.ts` 没改。
- [x] 改了期望的旧测试（都是"新站插在中间"的连带）：各测试文件里写死的地图顺序加新 id（store / reliability / album / unlock / Challenge / Level / sound / Album / Map / IslandDone）；站数 12 → 17 / 13、32 → 38；旧版本升级测试里"全通存档停在新站"的期望从 ch2-n9 / ch3-n1 改成 ch1-n13（v9 起 'first-open' 先找到它；`V9_FIRST`），`V5_CHAPTERS` 去掉 v9 新站；家长区"作品收起"的站号按地图位置 第 10 / 12 站 → 第 14 / 17 站、"从哪里开始"→ 数字岛第 7 站；地图标签加 ch2 的 10；`layout.test SMALL` 加大楼梯三项 38。
- [x] 门禁：lint 0、typecheck 过、purity 0、test:gate 58 suite / **1202**（23-0 前 1099）、build:web 过；覆盖率 97.64 / 93.68（语句 / 分支），content 98.32 / 95.78。

## 浏览器走查（Checkpoint 23a，Playwright）

- [x] 375 × 812：注入 v8 全通存档 → 地图标记停在 ch1-n13（4，醒着），ch1 五个新站 available、旧站 completed（`p23-10`）；本地存档在第一次改动前仍写着 v8（同 Phase 22）。
- [x] ch1-n13 拖完：蘑菇 4 块 → "变个样子！"、光圈套云、小图换成闪电（`p23-11`）；挪一块 → 小图换成靴子（`p23-12`）；再挪一块 → "拼对啦！"（`p23-13`）。
- [x] 站着的十 / 大楼梯 / 甜甜圈的工作台与托盘：375 下 n17 格 58、托盘 58，ch2-n13 托盘 54；360 × 640 n17 托盘 42、ch2-n13 40；667 × 331 都 40–41（`p23-360-ch1-n17` 等）。

## 需要 Ted 决定（都有一处常量或一行）

1. `CLOUD_NUDGE_MS = 3500` / `CLOUD_NUDGE_MAX = 2`（`LevelScreen.tsx`）；第二次脉冲放在"示范手收起后再等 3.5 秒"（≈12.7 s）是我的落法，PRD 没写第二次什么时候。
2. 横屏小图和数字**并排**而不是 PRD 的"上下"（上下会把"下一站"挤出 331 高的屏）——看 `p23-667-ch2-n9.jpg`。
3. 站着的十在云里的小图格只有 11px（短屏 8px）、没有脸：PRD 的格公式按高度卡死。可选：`PICTURE_FACE_MIN` 调低，或给竖长图单独放宽高度（会超 100 高的云）。
4. 大楼梯（ch2-n13）在 SE / Android 360 × 640 / 640 × 360 托盘积木 38px（PRD 估 ≥ 40）；改法是减诱饵或缩 extra（会改题，另开版本）。
5. `START_SYMBOL = 'amber'`、`SINGLES_DRAG_CAP = 6`、`MIRROR_FOR_CHIRAL`、`TEN_UPRIGHT`、六站清单与位置、伙伴站 extra 1：按 PRD 默认。
6. 开站 chime 的音高（B4 → F♯5）只在代码里定，没在手机上听过。

## 与 PRD 的出入

- 横屏云朵：PRD §3.3"侧栏内数字上、小图下"→ 并排（见上）。
- 17 在 Android 360 × 640（带浏览器栏）托盘积木 34 → 33（PRD 只写了格 43 → 42）；大楼梯 38（PRD 说新站都 ≥ 40）。
- PRD §3.2 的阴影闪"`#A9D5EE` → `#8FC3E3` → 回"：A-lite 已把静止阴影改成 `#8FC3E3`，所以闪的是再深一档 `#6AAAD4`。
- 诱饵口径：大楼梯除了 PRD 写的 5 + 4 + 1，还有 5 + 3 + 2，也铺不出（测试里两条都列了）。

## 只能真机确认

- 开站一拍（弹大 1.4 倍时云朵会短暂盖住菜单按钮与屏顶）在真机上是"看这里"还是"吓一跳"；chime 在手机扬声器上和 `arrive` 叠在一起听不听得清。
- 3.5 s 脉冲 + 5 s 示范手的节奏孩子会不会觉得"一直在动"（PRD H1 / H3）。
- Amber 头像在 48px 盘里的辨识度；彩色带脸小图在户外光下的显著性。
- iOS Safari 的音频解锁（同前）。

## 已知遗留 / 没做

- 方案 B（影子）、造型岛、`MAP_SHAPE_LABEL`：下一个 Phase。
- 随机题里三副面孔是三道单图题，不是三步序列（`challenge.ts` 不透传 `sequence`，Phase 21 起如此）。
- 地图上 4 4 / 8 8 / 9 9 / 10 10 相邻同号（PRD §8 #13 已接受）。

---

# Phase 23b：造型岛 Shape Island（2026-10-23，D-112 – D-120，内容版本 10）

依据 [shape-island-and-header-prd.md](../docs/shape-island-and-header-prd.md) §4.2、§8 默认、§9 边界。顺序：冻结 v9 种子存档 → content → progress → blocks-ui → screens → 升级测试 → 三视口走查。没有 git 操作、没加依赖、`schemaVersion` 不变、旧 38 站指纹不变、`lint:purity` 零命中。

## 种子存档（先于题库）

- [x] v9 代码（23a 完成、题库没动前）生成，临时 jest 测试写文件、用完删除：`src/progress/__fixtures__/archive-v9-phase23a-{all-finished,ch1-half,ch2-half}.json`（v8 三份经 v9 `migrate`；全通那份按参考解打完 v9 六站，38 站，地图回到 ch3-n8；合体岛一半那份先打完数字岛五个新站（数字岛 17 / 17），地图回到 ch2-n5、作品保留；数字岛一半原样，停 ch1-n7、三块在台上）。

## content（D-112、D-115、D-117、D-120）

- [x] `shapes.ts`：`CORNER_5 BOAT_5 BOAT_5_C DUCK_5 TREE_5 HOUSE_7 DOG_6 ROCKET_6`。`schema.ts`：`PictureId`、`ShadowSpec`，`quantity_shape.picture / shadow`，`Puzzle.picture / shadow`。`catalog/chapter-5.ts`（`SHADOW_POLICY`、`PICTURE_SYMMETRY`）；`catalog/index.ts`：`SHAPE_ISLAND_POSITION`、`SHAPE_ISLAND_GATE`、`SIDE_ISLANDS`、`CONTENT_VERSION = 10`、`CONTENT_CHANGES[10] = []`。`generate.ts` 透传与 `prompt.picture.<id>`；`challenge.ts` 透传（`CHALLENGE_SHADOW`）；`validate.ts`（影子规则、`assertDecoysMiss`）；`copy.ts`（岛名、图名四组 key、影子九个 key、`feedback.launch`）。
- [x] 测试：catalog（地图四岛、ch5 规格 / 影子 / 对称 / 工作台、开站句、参考解拖数 2 2 3 3 3 6 4 4、诱饵口径、鸭狗镜像对转 180° 错、n6 一步）、generate（validate 拒绝）、challenge（新图入池、透传）、fingerprint（v10，8 个新指纹）、demo（46 站 / 9 Boss）。

## progress（D-113、D-120）

- [x] `unlock.ts openerOf`（旁岛跳过），`isUnlocked` 与 `migrate.onwardFrom('first-open')` 都用它。测试：unlock（ch1-n12 → ch5-n1、ch5-n8 → ch2-n1、两岛同开、`openerOf`）；upgrade 新 describe v9 → v10（什么都不丢、全通 → ch5-n1 且其余锁着、打完 8 站全通且每站按自己的图判对、合体岛一半不动且 ch5-n1 同开、继续合体岛不受影响、停在已完成站 → ch5-n1、数字岛一半不动、经 store 不报升级不备份、v8 全通仍落 ch1-n13）。

## blocks-ui（D-114、D-118）

- [x] `ShadowOutline.tsx`（`SHADOW_SNAP: 0`、`shadowHead`）；`BossOutline` 改为一排的 ShadowOutline（testID 不变）；`Stage.shadow`；`cheer.ts` `picture`、`BOSS_PICTURE_CHEER`。测试 cheer +1。

## screens（D-114、D-116 – D-119）

- [x] `shadow.ts`（`SHADOW_LIT`、`centred / follow / cornerOf / litCells / fill`）；`level-session.ts`（`LevelSession.shadow`、`revealShadow`、`shadowView`）；`hints.ts`（开站句、`feedback.shadow.gap / out` 卡、`shadowHelp` 阶梯、`shadowNext`、`shadowDemo`、图名成功句、`partsLine`）；`LevelScreen.tsx`（`Stage.shadow`、求助浮现与示范手、`shadowDemo` 优先、火箭发射音、点卡片念 parts、`SHAPE_CLOUD_ON_PASS`）；`MapScreen.tsx`（`MAP_SHAPE_LABEL`、`mapPictureOf`、迷你图）。
- [x] 测试：`shadow.test.ts` 新（11）、`LevelScreen.test.web.tsx` +3、`MapScreen.test.web.tsx` +2、`IslandDoneScreen.test.web.tsx` +1。

### 改了期望的旧测试

- `catalog.test.ts`：`CHAPTERS[i]` 改成按 id 取岛；地图三岛 → 四岛；工作台表加 ch5；23a 那条"38 站 / 13 造型站"只数 ch5 以外。
- `unlock.test.ts`：地图 38 → 46；ch1-n12 的下一站是 ch5-n1；打完数字岛 `defaultCurrent` 是 ch5-n1（原 ch2-n1）；打完合体岛 / 拿走岛但没玩造型岛时停 ch5-n1；`CHAPTERS` 3 → 4。
- `upgrade.test.ts`：`V5_CHAPTERS` 去掉 ch5；`beforeV9` 去掉 ch5；v8 → v9 组里写死的版本 9 改为 `CONTENT_VERSION`，"全部完成"改为"v9 及以前的站全部完成"。
- `challenge.test.ts`：全通后的图集合加 8 张。
- `demo.test.ts`：38 → 46 站，7 → 9 Boss。
- `fingerprint.test.ts`：版本 10，描述对带图的站追加 `picture / shadow`。
- `IslandDoneScreen.test.web.tsx`：数字岛收尾"去合体岛"→"去造型岛"，按钮去 ch5-n1。
- `MapScreen.test.web.tsx`：奖杯要造型岛也打完；标签测试按 id 取岛。

## 门禁（最终）

- [x] `pnpm lint` 0；`pnpm typecheck` 过；`pnpm lint:purity` 零命中；`pnpm test:gate` 59 suite / **1337**（基线 1202）；覆盖率全部 97.47 / 93.42（语句 / 分支），content 98.33 / 95.78、core 100 / 99.13、progress 99.06 / 97.71、blocks-ui 98.09 / 92.15、screens 95.97 / 90.93；`pnpm build:web` 过。

## 浏览器走查（Checkpoint 23b，Playwright）

内建浏览器面板导航 localhost 仍被拒（"navigation denied or failed"），改用 Playwright（Chromium）对 `static-dist`（`pnpm build:web` 产物，8787）。存档注入 v9 全通夹具（临时拷进 `dist/` 用 fetch 读，走查后删掉）。没有听声音。截图 `docs/review-assets/p23b-*.jpg`。

- [x] 375 × 812 地图：v9 全通存档打开即迁移，造型岛在数字岛下面、"造型岛 0/8"，ch5-n1 醒着、其余睡着，8 站都是迷你图（`p23b-01`）。
- [x] ch5-n1：云朵 `4` + 绿色蘑菇小图；卡片"动手试试看 / 把伙伴放进影子里"；工作台 5 × 4，格 70，影子在 (1,1) 起、4 格 62px 虚线、首格睡脸；托盘伙伴 70（`p23b-02`）。把 3 拖到左上角（影子外）→ 影子挪到 (0,0) 接住它、三格亮，卡片"影子还没填满 / 还差这里"（`p23b-03`）；点卡片两下 → "把 1 放到这里"，托盘的 1 有光圈、影子空格琥珀实线（`p23b-04`）；把 1 拖进去 → "拼对啦！"、影子消失、"下一站"、云朵仍是 `4`（`p23b-05`）。
- [x] ch5-n8（375）：开站没有影子，"照着小图拼小火箭"；第 2 下"影子来帮忙啦"、影子 6 格出现（`p23b-06`）；第 3 下"把 3 放进影子里"、尾翼 3 格发亮、示范手搬 3 进影子（`p23b-07`）。
- [x] 各视口开站（工作台格 / 托盘积木 px）：375 × 812 n2–n8 格 58、托盘 58（n1 70 / 70）；360 × 640 格 56，托盘 n2 / n3 / n5–n7 56、n4 50、n8 52（n1 托盘 58–67）；667 × 331 托盘 40–42（n4 工作台格 47、托盘 41；n8 格 54、托盘 41）。全部 ≥ 40（`TRAY_MIN_BLOCK`），托盘下沿都在屏内（`p23b-375/360/667-n5/n8-opening`）。
- [x] 控制台 0 error。
- [ ] n6 变身（大转角 → 小船、影子换形、"把 1 挪进影子里"示范手）只在 jsdom / 单元测试里走过，浏览器没拖。

## 需要 Ted 决定（都有一处常量或一行）

1. 8 站数字、图、顺序、岛名（`catalog/chapter-5.ts`、`copy.ts chapter.ch5.title`）；伙伴站 extra 1。
2. `SHAPE_ISLAND_POSITION = 'after-ch1'`、`SHAPE_ISLAND_GATE = 'none'`（`catalog/index.ts`）。注意 'none' 靠新加的旁岛解锁规则实现（`progress/unlock.ts openerOf`）；新孩子打完数字岛会看到两个岛同时开，地图标记和岛收尾页都先指向造型岛。
3. `SHADOW_POLICY`（n7 第 1 下、n8 第 2 下）、`PICTURE_SYMMETRY`（鸭狗转关镜开）。
4. `SHADOW_LIT = 'covered'`（`'solution'` 已实现，一词切换）、`SHADOW_SNAP = 0`（0.5 没做）。
5. `SHAPE_CLOUD_ON_PASS = 'count'`（`'parts'` 已实现）、`BOSS_PICTURE_CHEER = true`、`CHALLENGE_SHADOW = 'as-stop'`、`MAP_SHAPE_LABEL = 'picture'`。
6. 影子跟随规则（见"出入"）：包得住第一块就挪，包不住只试首格对首格。
7. 火箭 Boss 在 360 × 640 的云里小图只有约 11px 一格（3 × 4 图按高度卡），而 n7 / n8 没影子时它就是唯一参考——PRD 的前提"A-lite 小图就是参考"在紧凑屏偏弱。可选：n8 改 `{ onHelp: 1 }`，或紧凑屏放宽小图高度。
8. 地图迷你图格 ≤ 16px（四宽的小鸭只有约 11px，没画脸）。

## 与 PRD 的出入

- 小鸭工作台 6 × 3（拟合），PRD 表写 6 × 5（按转开估的）。
- 文案：PRD 的 `prompt.picture` 等用 `{name}` 占位；`Line.params` 只有数字，改成一图一组 key 在建表时填名（同句同义）。另加了 PRD 没列的 `hint.shadow.start`（开站"把伙伴放进影子里"）、`hint.shadow.move`（伸出卡正文"把它挪进影子里"）、`hint.shadow.put`（"把 1 放到这里"）、`hint.picture.look.<id>`（"照着小图拼小火箭"）。n6 序列开站句用旧的"用 5 块拼成这个样子"。
- 影子跟随：PRD 写"以那块为头格"；实现先找能把整块包进影子的平移（取首格对上影子最靠前格的），找不到才首格对首格；横放的 3 落在影子外时这样能整块进影子。
- n7 的阶梯：PRD 只写"第 1 下浮现"；实现第 2 下点名、第 3 下示范手（和常显站同节奏）。n8 照 PRD（1 小图、2 浮现、3 点名 + 示范手）。浮现只在空台上发生；台上已有块又没影子时走数字岛的造型求助。
- 伸出影子的第 3 下没有示范手（示范手只会搬托盘里的伙伴、台上的单块）。
- 点名"把 3 放进影子里"取一种铺法里最大的一件（PRD 例句也是 3），不是阅读顺序第一件（那样火箭会先点 1）。
- `SHAPE_ISLAND_GATE = 'none'` 需要改解锁（旁岛），PRD 没写；`SIDE_ISLANDS` 是 content 导出的新常量。
- 测试数 +135（PRD 估 +60–90）。

## 只能真机确认

- 影子虚线（2.5px dashed、0.85 透明）在户外光下够不够显眼；亮格淡色与伙伴本色的区分。
- 第一块放在影子外时影子"跳过去"会不会让孩子以为自己做错了（S1）。
- 示范手搬进影子的落点：截图里 ghost 是动画中途，略低于发亮格，真机看最后落点。
- 火箭过关发射 + 发射音；地图迷你图在 68px 站点里认不认得出（"狗那站"）。
- iOS Safari 音频解锁（同前）。

## 已知遗留 / 没做

- `SANDBOX_DAILY_SHADOW`（沙盒今日造型，默认关）没做，也没留常量；旧形状站 `SHADOW_ON_OLD_SHAPE_STOPS` 没做（PRD §8 #14 默认"求助浮现"，需要给旧站加 `shadow`，会改指纹 → 另开版本）。
- `PICTURE_PLACEMENT = 'fixed'` 判定分支没做（'anywhere' 是唯一实现，没加常量）。
- 比一比岛（23c）。

---

# Phase 23c：比一比岛 Compare Island（2026-10-23，D-122 – D-128，内容版本 11）

依据 [take-away-and-compare-design.md](../docs/take-away-and-compare-design.md) §3.2、§4、§5.3 – §5.6、§6、§7"Phase 23"、§9（全按默认）与 [shape-island-and-header-prd.md](../docs/shape-island-and-header-prd.md) §5、§9。顺序：冻结 v10 种子存档 → core → content → progress → screens / blocks-ui → 三视口走查 → 文档。没有 git 操作、没加依赖、`schemaVersion` 不变、旧 46 站指纹一字未变、`lint:purity` 零命中、没加自动语音 / 失败音 / 红叉。决策编号从 D-122 起（D-121 已被"提示卡改回 ✦"占用）。

## 种子存档（先于题库）

- [x] v10 代码（23b 完成、题库没动前）生成，临时 jest 测试写文件、用完删除：`src/progress/__fixtures__/archive-v10-phase23b-{all-finished,ch1-half,ch2-half}.json`（v9 三份经 v10 `migrate`；全通那份按参考解打完造型岛 8 站：46 站、作品册 46、地图回到 ch3-n8、自由玩三块；合体岛一半停 ch2-n5、数字岛 17 / 17；数字岛一半停 ch1-n7、三块在台上）。

## core（D-123）

- [x] `judge.ts`：`compare { given, relation }`（`CompareRelation`，空工作台不算）、`order { sizes }`、新 reason `order-mismatch`；导出 `compares`。`judge.test.ts` +5。

## content（D-122、D-124）

- [x] `schema.ts`（`compare` / `order` 规格）；`material.ts singlesMaterial`；`generate.ts`（`targetOf`、三连 steps、题目 key）；`solution.ts compareRow` + 排队；`validate.ts assertCompare / assertOrder` + 三连 steps；`bench.ts`（`COMPARE_ROWS = 2`、`Need.rows`）；`challenge.ts numberOf`；`copy.ts`（岛名 + 比一比 39 个 key，共 40）；`catalog/chapter-4.ts`；`catalog/index.ts`（`CHAPTERS` 末尾加 ch4、`CONTENT_VERSION = 11`、`CONTENT_CHANGES[11] = []`）。
- [x] 指纹：`FINGERPRINT_VERSION = 11`，旧 46 站不变，新 n1 `193a0041`、n2 `e1a7170e`、n3 `225d6ea7`、n4 `f75ed30e`、n5 `606bca21`、n6 `ba41a567`、n7 `bb3e3f1a`、n8 `f843b856`（描述函数没改：`question` 与 `steps` 已经带着 `given` / `relation` / `sizes`）。
- [x] 测试：catalog 新 describe（8 站规格、工作台 6 / 5 / 6 / 7 / 6 / 6 / 7 × 2 与 9 × 3、参考解拖数 3 3 1 6 1 1 4 3、挑站恰好一个对、1 + 2 一样多 / 2 + 5 比 3 多、三连 3 → 4 → 5、排队洗牌且相邻两次不同、反着排是 `order-mismatch`）；generate 新 describe（材料、`fitBench` 只加宽、validate 与构建器拒绝的各条）。

## progress（D-125）

- [x] `upgrade.test.ts` 新 describe v10 → v11（三份什么都不丢、全通 → ch4-n1 其余锁着、按顺序打完 8 站全通作品册 54 且每站作品按自己的题判对、比较站作品只有孩子那排、两份一半不动 ch4-n1 锁着、经 `loadArchive` 不报升级不备份、v9 / v8 全通仍落 ch5-n1 / ch1-n13）。`migrate.ts`、`unlock.ts` 没改。

## blocks-ui / audio（D-126、D-128）

- [x] `CompareRail.tsx`（新）；`Stage.rail`（比较台与它的聚光）；`layout.computeGeometry(..., rail)`；`cheer.ts LINE_UP_CHEER`、`cheerFor({ lineUp })`；`sfx.ts compare`、`COMPARE_STEP`。测试：Stage（比较台位置 = 工作台上方一格、徽章、点它念数、聚光）、layout（留行后格子与托盘不变；全题库三视口检查按留行算）、cheer、sfx。

## screens（D-126 – D-128）

- [x] `level-session.ts`：`COMPARE_ORDER`、`compareLine`、`lineUp`、`grownPast`（三连续档）、`cloudTitle` / `solvedEquation` / `targetNumberOf` 新分支、`waysApart` / `workWaysApart` 排队分开。
- [x] `hints.ts`：`RAIL_SPOT`、`compareFeedback` / `orderFeedback`、`comparePlan` / `orderPlan`、`promptParams` / `matchedFeedback` / `hintFor` / `lookHere` / `asksForHelp` / `sendOnly` 新分支；排队不逐块亮数。
- [x] `CompareSketch.tsx`（新，云朵小图）；`LevelScreen.tsx`（留行、`Stage.rail`、示范手落在 (0, 0)、第二拍 `compare` 音、排队 `lineUp` 动作）；`MapScreen.tsx labelOf` + `MAP_ORDER_LABEL`。
- [x] 测试：`level-session.test.ts` +4、`hints.test.ts` +5、`LevelScreen.test.web.tsx` +4、`LevelScreen.sound.test.web.tsx` +1、`MapScreen.test.web.tsx` +1、`IslandDoneScreen.test.web.tsx` +1。

### 改了期望的旧测试（逐条）

- `catalog.test.ts`：地图四岛 → 五岛（`[..., 'ch3', 'ch4']`）；工作台表加 ch4；23a 那条"38 站"再去掉 ch4，23b 那条"46 站 / 21 造型站"去掉 ch4。
- `demo.test.ts`：46 → 54 站，9 → 11 Boss。
- `fingerprint.test.ts`：版本 11，加 8 个新指纹。
- `unlock.test.ts`：地图 46 → 54；ch3-n8 的下一站是 ch4-n1（原 null）；打完全部旧岛 `defaultCurrent` 是 ch4-n1（原 ch3-n8），再打完 ch4 停 ch4-n8；`CHAPTERS` 4 → 5；无造型岛的岛表里 ch4-n1 由 ch3-n8 打开。
- `upgrade.test.ts`：`V5_CHAPTERS` / `beforeV9` 去掉 ch4；v8 → v9 组"'next' 在最后一站没有下一站"从 ch3-n8 改为 ch4-n8；v9 → v10 组写死的版本 10 改为 `CONTENT_VERSION`、"全通"改为"v10 及以前的站全通"（`beforeV11`）、'next' 从 ch3-n8 现在落到 ch4-n1。
- `layout.test.ts`：比较站（新站，没有旧工作台）加进"不比旧工作台小"的排除；全题库三视口检查与预算测试对比较站按留一行算。
- `IslandDoneScreen.test.web.tsx`：拿走岛收尾"所有的岛都完成了 / 回地图"→"去比一比岛"（按钮进 ch4-n1 的地图跳跃）；`ORDER` 加 ch4。
- `MapScreen.test.web.tsx`：奖杯要比一比岛也打完，奖杯进 `/island/ch4`；地图岛顺序加 ch4。
- `LevelScreen.test.web.tsx` / `LevelScreen.sound.test.web.tsx`：`unlockedTo` 的地图顺序加 ch4。
- `audio-i18n/sfx.test.ts`：`NAMES` 加 `compare`。

## 门禁（最终）

- [x] `pnpm lint` 0；`pnpm typecheck` 过；`pnpm lint:purity` 零命中；`pnpm test:gate` 59 suite / **1486**（基线 1337，+149，没删测试）；覆盖率全部 97.52 / 93.72（语句 / 分支），content 98.58 / 96.47、core 100 / 99.21、progress 99.06 / 97.71、blocks-ui 98.12 / 92.30、screens 95.96 / 91.14；`pnpm build:web` 过。

## 浏览器走查（Checkpoint 23c，Playwright）

内建浏览器面板仍不去 localhost，改用 Playwright（Chromium）对 `static-dist`（`pnpm build:web` 产物，8787）。v10 全通夹具临时拷进 `dist/`、fetch 后写进 localStorage `amber-blocks/progress`（走查后已删）；后几站把夹具的 `current` 改成要去的站再进（`current` 的站总是开着）。拖放用 Playwright 真实鼠标事件。没有听声音。截图 `docs/review-assets/p23c-*.jpg`。

- [x] 375 × 812 地图：v10 全通存档打开即迁移，拿走岛下面"比一比岛 0/8"，标记在 `=3`（醒着），其余睡着，标签 `=3 >2 <4 3 =4 >3 <5 134`（`p23c-01`）。
- [x] ch4-n1（375）：云朵 `3` + 两排小图；卡片"动手试试看 / 搭一排和它一样多的"；比较台 (13, 336) 348 × 58，格 58，三块黄色 3 带脸带徽章；工作台 6 × 2；托盘五块红色单块 58（`p23c-02`）。拖 1、2 块 →"还比它少 / 在它下面再放一块"（`p23c-03`）；第 3 块 → 云朵 `3 = 3`、"拼对啦！"、下一站，孩子那排正好在比较台下面、变成一个黄色的 3（`p23c-04`）。
- [x] ch4-n4 ★（375，格 50）：3 块"还比它少"→"一样多了，再多 1 块"；第 4 块 → 比较台长成绿色的 4、云朵 `4`、"它也变成 4 了！再多一块"、比较台套光圈（`p23c-05`）；第 5 块 → 比较台 5；第 6 块 → `6 > 5`、"拼对啦！"（`p23c-06`）。
- [x] ch4-n6（375）：放 2 →琥珀"2 比 3 少 / 换一个伙伴试试"（`p23c-07`）；再放 1 → 蓝色"2 加 1 是 3，和它一样多！/ 找一个比 3 多的伙伴"（`p23c-08`）。
- [x] ch4-n8 ★（375）：没有比较台，云朵三根灰条，工作台 9 × 3 格 41（用满屏宽），托盘伙伴 41（`p23c-09`）；3 放最左、1 放后面 →"3 比 1 多，1 排前面 / 先放最小的"（`p23c-10`）；改成 1、3、4 → `1 < 3 < 4`、三个伙伴各自一张脸一个徽章（没合成 8）（`p23c-11`）。
- [x] 360 × 640（英文）开局：n1 比较台 y 232、格 56、托盘 56；n4 格 48、托盘 48；n6 格 56、托盘伙伴 56；n8 托盘 40；托盘下沿 476 – 508 / 640（`p23c-360-*`）。n1 搭对后"Next stop"按钮 591 – 637 / 640（`p23c-360-ch4-n1-solved`）。
- [x] 667 × 331（英文）开局：比较台在右侧舞台顶部，n1 / n6 格 79、n4 格 67；托盘 n1 / n6 42、n4 67、n8 55；托盘下沿 ≤ 311 / 331（`p23c-667-*`）；n1 搭对后侧栏"Next stop"270 – 327 / 331。
- [x] 卡片文字在 360 宽一行（JS 量 Fredoka 15px，可用 226px）：最长标题 "3 is more than 1. 1 goes first" 185、"1 加 2 是 3，和它一样多！" 172；最长正文 "The 1 on the left, then the 3, then the 4" 209。
- [x] 控制台 0 error。
- [ ] n3 / n5 / n7 只在 jsdom / 单元测试里走过；比较台被点时的跳动与念数、减少动效、三连长大时的变色 pop 只在代码与 jsdom 里看过。

## 需要 Ted 决定（都有一处常量或一行）

1. 8 站数字与顺序、岛名"比一比岛 / Compare Island"、Boss 是排队 [1, 3, 4]（`catalog/chapter-4.ts`、`copy.ts chapter.ch4.title`；设计稿 §9 #2 #3 #11）。
2. `COMPARE_ORDER = 'child-first'`（`screens/level-session.ts`，`4 > 2`；`'rail-first'` 写 `2 < 4`，§9 #5）。没做"鳄鱼嘴"装扮、没念"大于 / 小于"（§9 #5 #6 默认，没留开关常量）。
3. `MAP_ORDER_LABEL = 'sizes'`（`MapScreen.tsx`，`134`；`'sign'` 是 `≤`）。三连的标签只写 `3`（设计稿默认）。
4. `LINE_UP_CHEER = 'stack'`（`blocks-ui/cheer.ts`，用现成的"一个比一个跳得高"代替设计稿的新动作 parade）。
5. `COMPARE_ROWS = 2`（`content/bench.ts`）与比较台占一行（`LevelScreen COMPARE_RAIL_ROWS = 1`）。
6. 单块颜色是 1 的红色（`singlesMaterial`），不是比较台的颜色——用同色会在比之前就像"一样"。
7. `COMPARE_STEP = 0.28` 秒（两声之间）；第二拍才响（和火箭发射音同一时刻）。
8. 挑站放错是琥珀"调整"（会响一下"嗯？"音、脸歪头）——设计稿 §5.3 写琥珀；如果觉得"2 比 3 少"本身是知识、不该算调整，可以改成蓝色拼搭态（一行）。

## 与设计稿的出入

- 内容版本 11（稿子写 9）。
- 文案：`feedback.compare.is` 按稿子自己的建议拆成三个 key；成功句叫 `feedback.matched.compare.*`（`feedback.matched.same` 已被占用）；另加了几条稿子没列的 key（见 D-127），每种关系都有题目句（含没用到的"搭比它少"、"挑多 1 / 少 1"）。
- 发现句按工作台从左到右念（"2 加 1 是 3"，稿子例句是"1 加 2"）。
- 求助第 1 下：稿子说"比较台伙伴依次亮出 1–3"；实现是点亮整条比较台，搭站数量不对时改为孩子那排逐块亮数（现成的 countUp），没有给比较台逐块亮数。
- 三连每步过后没有"先 pop 成 `4 > 3`、再换"的停顿（同 Phase 22 倒数）：云朵立刻换成新的比较台数，只有最后一步写 `6 > 5`；点云朵念的是当前题目，不是"依次念三句"。
- 排队过关没有新动作 parade（用 'stack'），也没有在跳的同时逐个响 count 音；第二拍一次响 1、3、4 三声。
- 长出来的那截 / 空出来的格子"亮一下"没做；比较台长大用 `BlockBody` 自带的变色 pop（减少动效时直接换色）。
- 作品册里比较站的缩略图没有补画比较台（只有孩子那一排）；排队站作品用 `apart` 分开（做了）。
- 比较站工作台是拟合出来的 2 行（`fitBench` 的 `rows`），不是写死在节点上的 `bounds`；结果与稿子的表一致。

## 只能真机确认

- 比较台与孩子那排"对齐比长短"在手机上是否一眼看得出（S：第一块会不会放在比较台旁边）；沙色窄台与托盘同色会不会被当成第二个托盘。
- 两声比较音（高→低 / 低→高）在手机扬声器上听不听得出方向。
- 排队站 375 宽 9 × 3 格 41、360 宽托盘 40——够大但贴边；小手能不能把 4 精确放在 3 的右边。
- iOS Safari 的音频解锁与语音（同前）。

## 已知遗留 / 没做

- 自由玩随机题不出比较 / 排队题（设计稿 §4.6 本轮不加）。
- 作品册比较站补画比较台（见"出入"）。
- 走查时看到的旧现象（没改）：9 列工作台用满屏宽时木框贴到屏幕边（Phase 21 起 9 × 3 的站都这样）。
