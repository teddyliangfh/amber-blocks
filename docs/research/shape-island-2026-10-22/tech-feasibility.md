# Amber Blocks：形状玩法扩展的技术可行性（2026-10-22）

范围：只读代码分析，没有改任何文件。效标：Phase 22 拿走岛 ≈ 2–3 天（1 个 judge kind、2 个 spec kind、3 个材料构造器、8 站、hints 分支、2 种示范手、1 个过关动作、v7 种子存档 + 迁移测试、浏览器走查；+167 测试，932 → 1099，`tasks/todo.md:1650-1699`）。所有"天"都按这个尺子。

事实核对：目录里 `quantity_shape` 站是 **7** 站不是 5（`chapter-1.ts:18,19,27,28,29` 的 n3/n4/n6/n7/n8，`chapter-2.ts:29,36` 的 ch2-n9 十、ch2-n11 阶梯），命名模板 7 个（`catalog/shapes.ts:5-14`）。无论 5 还是 7，占比都低，结论不变。

## 0. 一页结论

- 现有引擎的"形状"只有一种表达：整数格 `Cell` + 4 邻接簇 + 模板在平移 / 旋转 / 镜像下的等价（`grid.ts:3-4,40-42,60-73`，`shapes.ts:35-62`，`judge.ts:98-109`）。伙伴（group）的身体可以是任意格子集（`groups.ts:50-57` 只检查不重叠），但 content 永远发 `bodyOf(n)` 的横排 / 两行（`material.ts:12-24`，`:98`，`:129`），伙伴只能平移、不能转（`commands.ts:155-208` 只有 delta / origin；`hints.ts:268-270` 明写"a partner is rigid"）。
- 存档没有任何形状专属字段：`NodeProgress.work` 和 `album` 都是整个 `BenchState`（`progress/schema.ts:9,29`），codec 把 `bench` 存成 `[id, x, y]`、`units` 存成 `[id, hue]`、`groups` 存 `shape`（`codec.ts:16-25`）。所以：**Option 0 / 1 不动 `schemaVersion`，只加内容版本；Option 2 要给 `bench` 三元组加第四项、`units` 加第三项（可按 album / sandbox 的先例当尾部可缺省字段处理，`codec.ts:54-58`）；Option 3 / 4 的状态不是 `BenchState`，要么并列新字段、要么 `schemaVersion = 2`。**
- 渲染：方块的"玩具塑料"质感全靠 `boxShadow inset`（`Block.tsx:23-30`）和 `overflow: hidden`（`:107`），只对矩形成立。三角形用 border 技巧能画实心 + 描边（`icons.tsx:22-30` 的 play、`:151-166` 的 star），画不出内凹倒角、画不出斜向虚线。**react-native-svg 在"斜边要描边 + 圆角 + 虚线轮廓 + 45° 任意多边形"这一步才真的必要（Option 3）；Option 2 / 4 用 View 能过。**
- 推荐：**Phase 23a（比一比岛之前，3–4 天）= Option 1 + Option 0 合做一个"拼图岛 / Picture Island"**：图画轮廓画在工作台上、更多更大的模板、用非横排身体的伙伴拼图。它复用 100% 现有引擎，立刻把"形状站太少"从 7 站补到 15 站。**Phase 23b = 比一比岛（设计稿不变）。Phase 24 = 真正的"形状岛"**，在 Option 2（半格三角，90° 转）和 Option 4（三角格拼图块，60° 转）之间按 spike 结果与 Ted 的偏好二选一；Option 3（连续坐标七巧板）只有在"必须拼经典七巧板剪影"时才值得。

| 选项 | 引擎改动 | 存档影响 | 渲染 | 旋转 | 工作量（天） | 风险 | 结论 |
|---|---|---|---|---|---|---|---|
| 0 更多多联骨牌模板 | core 0；content 加 `bodies`（伙伴自定义身体）、`bench.ts` 用 `boxOf(shape)` | 内容版本 +1，`CONTENT_CHANGES[9] = []`；schema 不变 | 现有 View，零新组件 | 不转（伙伴刚性）；可选 `rotateGroup` 命令 +1 天 | 1–1.5（+1 若加旋转） | 低；托盘 ≥ 40px 限制单块数 | 做，并入 23a |
| 1 图画轮廓站 | core 加 `picture` 判定分支（或 `quantity_shape.at`）；blocks-ui 把 `BossOutline` 从"一行"推广到"任意模板 + 原点" | 同上；作品册不变 | 现有 View（虚线格） | 不涉及 | 2–3 | 低–中；"固定位置"与 §4"去除平移"冲突，要 Ted 拍板 | 做，23a 主体 |
| 2 半格三角（格上七巧板） | core 新占位模型 `Placement{cell, part}`、邻接表、模板含 part、`rotate90` 映射 part；`Unit.kind`；新命令 `rotate` | `bench` 四元组、`units` 三元组（可缺省）；沙盒要第二个盒子 | View：border 三角 + 描边三角；脸放三角重心 | 只能 90°（45° 不在格上）；`SHAPE_TURN` 常量四选一 | 5–8 | 中；**不是经典七巧板**（钻石方块、斜放大三角不可表达）；脸与质感 | Phase 24 候选 A |
| 3 连续坐标七巧板 | 新模块对 `shape-core` + `shape-ui`：Z[√2] 精确坐标、SAT 重叠、顶点 / 边吸附、剪影包含 | `work: BenchState \| ShapeState` → `schemaVersion 2` 或并列 `shapeNodes` 字段；作品册要 `ShapePicture` | View 可拼（border 三角 + 45° transform），但描边 / 虚线 / 抗锯齿建议上 SVG | 45° 步进；手势 = 点转 / 按钮 / 双指（4 岁不行） | 8–12 | 高；两个 1000 行文件（LevelScreen / hints）要分叉 | 暂缓 |
| 4 三角格拼图块（pattern blocks） | 同 2 的量级，换成三角格坐标（q, r, up/down）、3 邻接 | 同 2（`bench` 存三角坐标） | View：等边三角 border 技巧最省（同向 ± 180°） | 60° 步进 | 5–8 | 中；只能用四种（三角 / 菱形 / 梯形 / 六边形），方块与细菱形不在格上 | Phase 24 候选 B |

## 1. Option 0：现有引擎上更多多联骨牌模板

**今天能做什么。** 模板就是任意格子集（`shapes.ts:19-21` 归一化），判定对平移 + 旋转（默认）等价（`shapes.ts:17`，`SPEC-math-core` 已决 #2）。一个 5 × 4 的 20 格模板在 core 层零改动。限制全在 content / UI：

- 单块数：目录约定"没有一站要求超过 6 个单块"（`chapter-1.ts:9-10`），随机题 `maxSingles: 6`（`challenge.ts:41`）。20 格模板必须由伙伴拼（`handles`，`schema.ts:50-51`；`validate.ts:280` 要求 handles 之和 = target，`:282-285` 要求至少一个诱饵）。
- 伙伴身体：**core 允许非横排**（`groups.ts:50-57` 只查 `shape.length === unitIds.length` 且不重叠；不变量 3 `state.ts:90-119` 同），`PartnerView` 按任意 `offsets` 画（`PartnerView.tsx:111-144`），`GripPlate` 的圆角按真实轮廓算（`:70-97`），托盘对象用 `footprintOf(group.shape)`（`tray.ts:25`），参考解 `cover()` 和求助 `covers()` 都按刚性任意形状回溯（`solution.ts:158-183`，`hints.ts:273-292`）。**只有 content 不会发非横排**：`handleMaterial` / `partnerMaterial` 写死 `bodyOf(size)`（`material.ts:98,129`），`fitBench` 用 `numberBox(n)` 当伙伴盒子（`bench.ts:25-27,57-59,66`）。改法：`QuestionSpec.quantity_shape` 加 `bodies?: ReadonlyArray<ReadonlyArray<Cell>>`（与 `handles` 同序，缺省 `bodyOf`），`handleMaterial` 的 `order` 回调同步洗牌 bodies，`bench.ts` 的 partners 盒子改 `boxOf(body)`；`hueFor(size)` 不变（颜色仍按块数）。
- **模板能否要求特定分解？不能。** `judge.ts:98-109` 只看数量、单簇、格子集，不读 `state.groups`。要"必须用 3 和 4 拼"，加 `Question.quantity_shape.parts?: number[]`，在 judge 里像 `judgePairs`（`judge.ts:77-90`）一样检查工作台上整伙伴的尺寸多重集；`VerdictReason` 加 `parts-mismatch` 的近亲 `pieces-mismatch`。半天。
- **什么限制工作台大小。** `fitBench`：每个模板转向的盒子 + 1 格余量，再保证所有材料同时放得下（`bench.ts:139-153`，`holdsAll :113-135`）。5 × 4 模板转向后是 4 × 5 → 6 × 6 的工作台。屏幕侧 `layout.ts:57-77,105-155`：375 × 812（stage 375 × 544，`chrome.ts:11`）下 cell = ⌊351 / cols⌋（< 8 列有 12px 边距）或 ⌊375 / cols⌋（≥ 8 列，`WIDE_MAT_COLS :48`）：5 列 70px、6 列 58、7 列 50、8 列 46、9 列 41、10 列 37、13 列 28 = `MIN_CELL`。行数上限 ≈ (544 − 36 − 80) / cell：58px 时 7 行。真正的瓶颈是托盘：`TRAY_MIN_BLOCK = 40`（`:39`），6 × 6 工作台在 58px 时托盘只剩 160px，两行以内（≈ 14 个 40px 的东西）；再多就走 fallback（`:144-147`），积木整体变小。360 × 640（compact，stage 360 × 448）更紧：6 × 6 工作台会被压到 ≈ 48px。**结论：大模板用 3–5 个伙伴 + 1 诱饵 + 1–2 个单块，不要超过 8 个托盘对象。**
- 序列（`sequence: true`，`schema.ts:55`）已支持多模板同一批块；大模板序列用 `reshape()`（`solution.ts:115`）只处理单块的参考解，伙伴版序列参考解要补 `cover()` 逐步（`solution.ts:295-299` 现在遇伙伴步骤会 throw）。

**存档。** `schemaVersion` 不变。只加新站 → `CONTENT_VERSION = 9`、`CONTENT_CHANGES[9] = []`（`catalog/index.ts:19-48` 先例）。若改旧站模板：列进 CHANGES；`migrate.refit` 只比材料（`sanitize.ts:20-40` 不比模板）→ 旧作品保留并按新题重判。作品册是历史，不受影响（`migrate.ts:85-87`）。先按 22-3 的做法用 v8 代码冻结三份种子存档（`tasks/todo.md:1654`）。

**测试。** content：`catalog.test`（工作台表）、`fingerprint.test`（新指纹）、`generate.test`（bodies 构造器与拒绝分支）、`bench.test`（`boxOf`）、`validate.test`（bodies 长度 / 不重叠 / 放得下）；screens：`hints.test` 的 `covers` 已有阶梯 1 + 2 + 3 的非横排用例（`chapter-2.ts:36`）可加 L 形；属性测试：对任意 ≤ 5 × 4 模板与任意 bodies 分解，`cover()` 有解 ⇔ `covers()` 说可达（参考解与求助一致性），fast-check 已在（`invariants.property.test.ts:1-13`）。

**旋转（可选）。** 新命令 `rotateGroup { groupId, turns }`：`shape = alignedShape(rotate90^turns(cells))`，工作台上按同一原点重落、`isAvailable` 检查，undo 免费（`commands.ts:262-277`）；属性测试加一条"转四次回原样"。UI：伙伴上的 tap 已被点数占用（`Stage.tsx:472-477`，`PartnerView.tsx:113-118`），要另找入口（见 §2 的 `SHAPE_TURN`）。+1 天。

**工作量 1–1.5 天（+1 旋转）。风险低。结论：做。**

## 2. Option 1：图画轮廓站（outline on the mat）

**推广 `BossOutline`。** 现在 `bossOutlineCells` 只会排一行并自动换行（`BossOutline.tsx:16-31`），组件按 cells 画虚线格、前 `lit` 格填 pale 色、第一格睡脸（`:38-64`），`pointerEvents="none"`、不参与判题与吸附（`Stage.tsx:776`，D-094）。改成 `PictureOutline({ cells, lit: Set<cellKey> })`：cells = 模板 + 原点；亮格 = 工作台格 ∩ 轮廓格（逐格，不再是"前 n 格"）。`Stage.outline` 的类型从 `{ n, lit, made }` 扩成联合。LevelScreen 的小预览（`LevelScreen.tsx:619-656`，每格一个 View）保留。

**判定两种口径，一个常量。**

- 平移自由（`'anywhere'`）：judge 不变（`quantity_shape`），轮廓只是脚手架 + 吸附偏好。
- 平移固定（`'fixed'`）：core 加 `Question.quantity_shape.at?: Cell`（或新 kind `picture { cells }`），matched ⇔ `benchCount === target` 且工作台格子集 = 模板平移到 `at`（不做旋转等价；或 `symmetry` 仍生效但以 `at` 为盒子原点）。`VerdictReason` 可复用 `shape-mismatch`，加 `off-picture`（数量对、形状对、位置不对）给 hints 用。judge 改 10 行。
- 常量：`PICTURE_PLACEMENT: 'fixed' | 'anywhere' = 'anywhere'`，放 `content/catalog/index.ts`（与 `BOSS_ENTRANCE :68`、`ISLAND_SHOWCASE :74` 同处）。设计上 `'fixed'` 与 `docs/level-progression.md:56`"形状判定去除整体平移"相抵，默认取 `'anywhere'`，是否固定由 Ted 决定。

**吸附进轮廓。** `settleOrigin` 已有 `prefer` 回调（`layout.ts:226-232`），`Stage.tsx:405` 用它让伙伴优先贴着伙伴；加 `preferOutline(o) => 该 origin 下所有格都在轮廓内且尚未被亮`，与 `besidePartner` 组合（先轮廓、后贴伙伴）。预览虚影（`Stage.tsx:777-780`）自动跟着。半天。

**content。** `QuestionSpec.quantity_shape` 加 `picture?: { at?: Cell }`；`materializeNode` 把原点写进 `Puzzle.picture`（`generate.ts:149-166`）；`validate` 查轮廓在工作台内（`validate.ts:289-297` 已查每个转向放得下）；`fitBench` 把轮廓当 `dealt` 盒子（`bench.ts:45-47` 的 Phase 21 先例）；参考解 `take` 到轮廓格（`solution.ts:289`）。指纹描述要含原点（`fingerprint.test.ts` 哈希题目）。

**存档。** `schemaVersion` 不变；`work` / `album` 仍是 `BenchState`。`CONTENT_VERSION = 9`，新站不列。`sanitize` / `migrate` 不改。

**hints / screens。** `feedbackFor` 的 `shape-mismatch` 分支（`hints.ts:258-266,446-454`）加"放进图画里"一句与轮廓聚光（`AnswerFocus.template :483` 已有 `template: boolean`，加 `outline: boolean`）；`shapeInReach` 不变。示范手：`demoTo` 已支持指定格（`Stage.tsx:62-65`），指向轮廓左上。`cheerFor` 可按模板盒子选动作（`cheer.ts:25-39` 已读 shape）。`MapScreen.labelOf` 走 `quantity_shape`（`:66-67`）不改。

**测试。** core `judge.test` +4（fixed 口径：对位 / 错位 / 多块 / 转向）、`shapes.test` +2；content `validate` / `generate` / `bench` +8；blocks-ui `BossOutline` → `PictureOutline` 单测 +4、`Stage.test.web` 亮格 +2、`layout.test` 偏好吸附 +3；screens `hints.test` +4、`LevelScreen.test.web` +3；progress `upgrade.test` v8 → v9 组 +6。≈ +60–90。

**工作量 2–3 天（Phase 22 同量级）。风险低–中。结论：做，作为 23a 主体。**

## 3. Option 2：半格直角三角（格上的七巧板族）

**占位模型。** `BenchState.bench: Map<UnitId, Cell>` → `Map<UnitId, Placement>`，`Placement = { cell: Cell; part: 'full' | 'NE' | 'NW' | 'SE' | 'SW' }`（part = 直角所在的角；一格最多两个 part 且必须共对角线：NE 只与 SW 共存，NW 只与 SE）。`Unit` 加 `kind: 'square' | 'tri'`（`inventory.ts:7-10`）。冲突表 5 × 5、邻接表（两块相邻 ⇔ 共享正长度的边：同格对角线两侧、或跨格边——NE 占满上边和右边，所以与上格的 `full | SW | SE`、右格的 `full | NW | SW` 相邻）。`Group.shape` 从 `Cell[]` 改 `Placement[]`。`inBounds` 的整数检查（`grid.ts:30-31`）保留，half 信息在 part 里，不动坐标类型。

**哪些要改。** `grid.ts`（`isFree` / `sameCell` → placement 版）、`clusters.ts`（邻接换表）、`commands.ts`（`isAvailable :34-41`、`takeGroup :180-208` 落点冲突、新命令 `rotate { id, turns }`：cells 绕原点 `rotate90` + part 映射 NE → NW → SW → SE，`alignedShape` 不变）、`shapes.ts`（模板 = `Placement[]`；`rotate90` / `mirrorX` 映射 part；`normalize` 只动 cell）、`judge.ts`（`quantity_shape` 改为"占用的半格并集 = 模板并集"，不管哪块拼的）、`state.ts` 不变量 2 换冲突检查、`counting.ts` 不变。**方块全是 `'full'` 时一切退化为今天的行为，88 条 core 测试应原样通过——这是模型正确的验收线。**

**件族。** 小三角 = 1 半格；方块 = 1 格；平行四边形 = 相邻两格各一半、斜边平行；中三角 = 两半格斜边相接（如 NE(0,0) + NW(1,0)，斜边朝下、底边水平长 2）；大三角 = 2 × 2 的一半 = 2 整格 + 2 半格。**关键限制：所有顶点在整数格上，所以件只能转 90°。** 经典七巧板的"方块斜放成钻石""大三角斜边水平"顶点落在 ½ 或 √2 处，不可表达——经典正方形拼法本身就拼不出来。这是"格上的三角拼图"（polyabolo），不是七巧板；对 4 岁足够（房子 = 方块 + 三角屋顶、船、箭头、鱼、小树），但要跟 Ted 讲清。

**渲染（纯 View）。** 三角 = `width: 0; height: 0` + 两边透明 border + 一边着色（`icons.tsx:22-30`）；描边 = 同样的三角缩小 2–3px 叠在上面（外层 edge 色、内层 fill 色）；4 个 part 各一组 border 参数或 1 组 + `transform: rotate`。失去的：`toyShadow` 的内凹倒角与顶部高光（`Block.tsx:23-30`，只对矩形生效）、圆角（直角三角可用 `borderRadius` 极小值）、斜边虚线（预览虚影 `Stage.tsx:846` 与轮廓虚线只能画直边；斜边改实线淡色）。脸：`Face` 是独立 View（`Block.tsx:96`），放在三角重心、尺寸 × 0.6。另一法"旋转方块 + 父级 `overflow: hidden`"只能得到斜边轴对齐的中三角，不如 border 法通用。**SVG 在此不必要**；要抗锯齿斜边描边时再上。

**旋转 UI 与成本。** 四选一常量（见 §6 (2)）：`'dealt'` 托盘预先按图画需要的朝向发件（零手势，content 只需在 `bodies` 里给朝向；最像 4 岁）；`'snap'` 落点试 4 个朝向取 core 第一个接受的、优先落进轮廓（`settleOrigin` 外再包一层，半天）；`'tap'` 工作台上点一下转 90°（与点数 tap 冲突：形状站 `countOrder` 关闭、`tapAt` 改派给 rotate，`Stage.tsx:472-477`）；`'button'` 页脚一个"转一转"按钮作用于最后摸过的件（`LevelScreen` 页脚已有 pill / round 按钮体系）。双指 `Gesture.Rotation` 不考虑。动画：`use-draggable.ts:215-217` 的 transform 已含 `rotate`（tilt），加一个 `turn` 共享值绕中心转，再按新 rest 重渲染（与 `useLayoutEffect :108-125` 的 FLIP 同法）。

**计数语义。** PRD §4.5（`prd.md:169-181`）与 AC-22（`:306`）：拼片按"用了几块"计，不按面积，不与单位方块混用。实现：`benchCount` 仍 = 身份数（`state.ts:32-34`），云朵写"用了 5 块"而不是数字角色；`hueFor(簇大小)` 的簇变色（`Stage.tsx:302-314`）对 `kind === 'tri'` 关闭，颜色按件种固定；点数 tap 关闭或改成数件。`MERGE_ON` 合体变身（`merge.ts:14`）对形状站关掉。

**模板匹配带朝向。** `variants()` 对 `Placement[]` 做 4 转（+ 镜像）；"并集相等"判定对件的分解不敏感，自然允许"两个小三角代替一个方块"——是否允许，一个常量 `PICTURE_FILL: 'any-pieces' | 'dealt-pieces'`（后者加 `pieces-mismatch`）。

**存档。** `codec.ts:21` 的 `bench` 三元组加第四项 `part`（缺省 `'full'`），`:19` 的 `units` 加 `kind`（缺省 `'square'`），`groups.shape` 同；**按 album / sandbox 先例不动 `schemaVersion`**（`codec.ts:54-58`），`decodeArchive` 对旧三元组补缺省。旧构建读新存档：忽略第四项、把三角当方块 → 不变量 2 可能误报"两块同格"→ 整站作品丢（只在降级时发生，Vercel 推 main 无降级）。替代：`schemaVersion: 2` + v1 解码兼容 + `UPGRADE_BACKUP_KEY` 备份（`store.ts:11`），更正统但多一天。`sanitize.sameMaterial`（`sanitize.ts:20-40`）要比 `kind`。沙盒：`SANDBOX` 一变旧沙盒即被当损坏丢掉（`sandbox.ts:13-15`）→ 加并列尾字段 `shapeSandbox: BenchState | null`，`SandboxScreen` 加一个"形状盒"切换，不动 10 块方块的盒子。

**测试。** core：新 `placement.test`（冲突表 / 邻接表穷举 25 + 25 项）、属性测试（任意命令序列不重叠半格、`rotate` 四次恒等、邻接对称、簇是等价类划分）；`shapes.test` / `judge.test` / `clusters.test` 各加三角用例；**现有 88 条不改**。content：形状材料构造器 + 新 chapter 的 fingerprint；blocks-ui：`TriView` 快照 + `Stage.test.web` 落点朝向；screens：形状站 host 的 `LevelScreen.test.web`。≈ +150–200，覆盖门槛 95%（`package.json coverageThreshold`）意味着没有测试的分支进不去。

**性能。** 每件 ≤ 6 个 View，8 件 + 20 格轮廓 < 200 个节点，与今天 17 站相当；`covers()` 回溯在 4 朝向 × 位置上会膨胀（7 件 6 × 6 格最坏数万次），求助每次提交都算（`hints.ts:176 → :295`），要 memo 或改成"面积 + 盒子"的廉价可达判定。

**工作量 5–8 天**（core 1.5–2、content 1–1.5、渲染 + 旋转 1.5–2、screens / hints 1–1.5、测试 + 走查 1）。**风险中。结论：Phase 24 候选 A。**

## 4. Option 3：连续画布上的真七巧板

**模块对。** `shape-core`（纯 TS，进 `lint:purity`）：坐标用 Z[√2]（`{ a, b }` 表示 a + b√2，整数对，加减乘精确；45° 旋转矩阵元素是 0、±1、±√2/2——取单位 = 半边长后全在 Z[√2]/2 内，仍可整数化），件 = 凸多边形顶点表（七块全凸），变换 = 45° 步进 + 镜像（平行四边形），重叠 = SAT（凸 × 凸，精确比较不需容差），吸附 = 顶点对顶点 / 顶点对边（最近距离 < 半格，用平方距离比较），判定 = 件两两不重叠 ∧ 每件在剪影内（凸件：顶点都在多边形内且边不穿越）∧ 面积和 = 剪影面积。`shape-ui`：`ShapeStage`（件 = View 组合 + `rotate` transform）、`ShapePicture`（作品册）、旋转手势。

**复用 / 新写。** 复用：progress 的地图状态机、解锁、`UPGRADE_CURRENT`（`migrate.ts:139`）、`store.ts`、语音、`Cloud` / `AnswerFeedback` / `AmberGuide` / 页脚按钮（`screens/ui.tsx`）、`MapScreen`（`labelOf :61-83` 加分支、`Chapter.kind`）、`IslandDoneScreen`、`ChallengeScreen` 骨架。新写：`shape-core` 全部、`ShapeStage` 与拖放（`use-draggable` 可复用，坐标是像素所以无差别）、`ShapeLevelScreen`（`LevelScreen.tsx` 1040 行与 `BenchState` 深绑：`matOf`、`countProgress`、`demoMove`、`cheerFor`、`outline`，拆不动，只能另起一页共用 chrome）、`shape-hints`（阶梯简单：下一块放哪、转一转）、作品册 `ShapePicture`、沙盒 `ShapeSandboxScreen`。

**存档。** `NodeProgress.work: BenchState | null`（`progress/schema.ts:9`）与 `album` 要么加判别字段（`schemaVersion: 2`，`decodeArchive :161-163` 现在直接拒绝 ≠ 1，需要 v1 → v2 解码 + 备份），要么并列尾字段 `shapeNodes` / `shapeAlbum`（旧构建忽略、不崩）。`sanitize` 要有 `sameShapeMaterial`。

**渲染。** View 可行：件在轴对齐时用 border 三角拼好，整件 `rotate` 45°（CSS transform 抗锯齿在 Safari 可接受）；剪影 = 参考解的件画成灰色（content 有 `solution`），不用描虚线；斜边描边、虚线轮廓、填充动画要 SVG → 这是"`npx expo install react-native-svg`"的真正触发点（Expo Go 内置、RNW 走 DOM SVG，SDK 58 兼容由 `expo install` 解）。

**手势。** 旋转对 4 岁只剩"点一下转 45°"或页脚按钮；吸附要同时对位置与角度（角度已离散化，只对位置）。连续坐标下"放歪了一点"是常态，吸附阈值是手感的核心，要真机调。

**工作量 8–12 天**（shape-core 2–3、shape-ui 3–4、screens / progress 2、测试 + 走查 1–2），**风险高**：新引擎、新存档分支、两个最大文件分叉、SVG 决策。**结论：只有"必须经典七巧板剪影"才做。**

## 5. Option 4：三角格上的 pattern blocks（简述）

坐标：三角格 `{ q, r, up: boolean }`（每个单元三角有 3 个边邻居），件 = 三角 1、菱形 2、梯形 3、六边形 6（方块与细菱形需要 90° / 30°，不在格上，去掉）。core 改法与 Option 2 同构（`grid` 换坐标系与邻接、`shapes` 的 `rotate` 改 60° 步进六转、judge 并集相等）；渲染更省：等边三角 border 技巧（`borderLeft = borderRight = s/2`、`borderBottom = s√3/2`）只有 up / down 两种朝向，复合件 = 若干同向三角 View；工作台底纹要三角点阵（`Stage.tsx:460-468` 的 gridDots 改）。旋转 60°：`SHAPE_TURN` 同一常量。计数语义同 §3。存档同 Option 2（`bench` 元组换坐标），工作量 5–8 天。**教学上最贴合 pre-K（2 个三角 = 1 个菱形、3 个 = 梯形、6 个 = 六边形，与合体岛的"拼起来"是同一个故事）**，缺点是与现有方块世界视觉断裂。**结论：Phase 24 候选 B；若 Ted 更要"几何等价"而不是"拼图剪影"，选它。**

## 6. 随机题、沙盒、常量

**(1) 随机题 / 沙盒按选项。**

- Option 0 / 1：`nextChallenge` 的 `shapes()` 自动收集已完成 `quantity_shape` 站的模板（`challenge.ts:102-124`，沿用那站的 handles / decoys）→ 新模板与 bodies 零改动流入（bodies 要随 spec 复制，`:118`）。固定位置的图画站若是新 kind，加 `pictures()` 候选与 `CHALLENGE_RULES.picturesAfter`（`:28-47`）。沙盒不动（10 块单块，`sandbox.ts:16`）。
- Option 2 / 4：`Challenge.puzzle` 仍是 `Puzzle`（`:19-25`），`ChallengeScreen` 走 `LevelPlay` host（`ChallengeScreen.tsx:12-13,49,60`）→ 形状题只要同一 `BenchState` 泛化就能进 dice，加 kind `'shape_picture'` 并 gated 在形状岛第 1 站。沙盒：并列 `shapeSandbox` 字段 + 盒子切换；`clusterChanges` / 气泡按件数（`sandbox-session.ts:91-112`，`Stage.bubbles`）可直接复用。
- Option 3：独立 `nextShapeChallenge` + `ShapeChallengeScreen`；沙盒另起页面。

**(2) 旋转策略的命名常量（Ted 决定模式，`merge.ts:14` / `level-session.ts:10` / `hints.ts:12` 先例）。**

```ts
// content/catalog/index.ts（与 BOSS_ENTRANCE、ISLAND_SHOWCASE 同处）
// How a Shape Island piece turns. Unconfirmed (feedback 2026-10-22): a default
// for Ted, one word to change. 'dealt': the tray deals every orientation the
// picture needs and nothing turns (no new gesture; the first island's default).
// 'snap': a dropped piece turns to the first orientation the core accepts
// there, inside the outline first. 'tap': a tap on a piece on the mat turns it
// one step (counting taps are off on shape stops). 'button': a "turn" button
// in the footer turns the last-touched piece.
export const SHAPE_TURN: 'dealt' | 'snap' | 'tap' | 'button' = 'dealt';
// One step of a turn: a quarter on the square grid (Option 2), a sixth on the
// triangle grid (Option 4), an eighth only on a continuous canvas (Option 3).
export const SHAPE_TURN_STEP: 90 | 60 | 45 = 90;
// Option 1: where the picture's outline counts. 'anywhere' keeps the judge as
// it is (level-progression §4: shapes are judged up to translation) and the
// outline is only scenery and a snap target; 'fixed' judges the cells in place.
export const PICTURE_PLACEMENT: 'anywhere' | 'fixed' = 'anywhere';
```

默认 `'dealt'` 是最安全的：content 发件时已经按图画朝向，core 的 `rotate` 命令可以先不写；之后改成 `'snap'` 只是 Stage 一处。

## 7. 推荐路径与分期

```
spikes（§8，3–4 个，各 ≤ 1 天，可与比一比岛并行）
  → Phase 23a 拼图岛（Option 1 + Option 0，内容版本 9，3–4 天）
  → Phase 23b 比一比岛（设计稿 §3.2 / §7 不变，内容版本 10，3–4 天）
  → Phase 24 形状岛（Option 2 或 4，内容版本 11，5–8 天；存档加尾字段）
  → 以后：Option 3 仅在需要经典剪影时
```

- **23a 放在比一比岛之前**的理由：反馈直接、零引擎风险、能当 Phase 24 的用户研究（孩子对轮廓 / 吸附 / 更大图画的反应决定 Phase 24 要不要旋转）；比一比岛的 `compare` / `order` 判定与 23a 互不触碰（`judge.ts` 各加分支、`QuestionSpec` 各加 kind，switch 穷尽由 tsc 兜底）。岛序：ch4 拼图岛、ch5 比一比岛（id 自由，解锁按前一站，`UPGRADE_CURRENT = 'first-open'` 自动落到新岛第一站，`migrate.ts:131-139`）；或反过来，由 Ted 定。
- 23a 清单：core `at?` 判定（若 `'fixed'`）；content `bodies` + `picture` + 8 站（建议：房子 5 × 4 由 L 形 4 + 方块 4 + 单块；长桥；楼梯 10；汽车 2 × 5 + 轮；两步序列）；blocks-ui `PictureOutline` + 偏好吸附；screens hints 两句 + 示范手；`CHALLENGE_RULES.picturesAfter`；v8 种子存档 → `upgrade.test` v8 → v9；fingerprint；文档 D-105 起。
- Phase 24 进入条件：spike 1（三角渲染）与 spike 2（旋转手势）给出可接受的截图与孩子试玩；否则留在 Option 0/1 的多联骨牌世界继续加站（成本几乎为零）。
- 依赖顺序：种子存档先于题库改动（每个 Phase）；`Stage.outline` 类型扩展先于 23a 的 LevelScreen；`Placement` 模型（spike 3）先于 Phase 24 任何 UI。

## 8. 预研 spike 清单（各 ≤ 1 天）

1. **三角渲染**：在 `SandboxScreen` 临时加 4 个朝向的 border 三角 + 描边 + 脸，RNW 0.21 Chrome / iOS Safari 截图：锯齿、描边对齐、`transform: rotate` 拖动时的闪烁、375 × 812 下 58px 格的可读性。产出：View 够不够、要不要 SVG。
2. **旋转入口**：`rotateGroup` 命令 + 三种入口原型（落点自动转、点转、按钮），给孩子玩 10 分钟；记录误触。产出：`SHAPE_TURN` 的默认值。
3. **半格占位模型**：纯 TS 写 `placement.ts`（part 冲突表、邻接表、`rotate90` 映射）+ fast-check 四条属性；把 `bench` 泛化后跑现有 88 条 core 测试，必须全绿。产出：Option 2 的 core 改动真实大小。
4. **图画轮廓 + 吸附**：`bossOutlineCells` → 任意模板 + 原点；`settleOrigin` 加轮廓偏好；在 ch1-n8（8 砖，`chapter-1.ts:29`）上浏览器走查亮格与吸附。产出：23a 的 Stage 改法。
5. **伙伴自定义身体**：spec `bodies` → `handleMaterial` → `fitBench(boxOf)` → `cover()` / `covers()`；用 L 形 4 + 方块 4 拼 5 × 4 房子，在 360 × 640 看托盘是否跌破 40px。产出：23a 的 content 改法与站表。
6. **存档四元组**：`codec` 对 `bench` 第四项、`units` 第三项的缺省解码，在 `archive-v7-phase21-*.json` 三份夹具上往返；决定不动 `schemaVersion` 还是升 2。
7. （仅 Option 3）**Z[√2] + SAT 微库**：七块的精确重叠 / 包含 + 属性测试，量 `shape-core` 的真实规模。

## 9. 风险

- **产品口径**：`'fixed'` 轮廓与 §4"去除平移"相抵；"用了几块"与数字角色的语义分离（PRD §4.5 / AC-22）要在云朵、点数、变色、合体四处同时关掉，漏一处就把拼片当成了数。
- **期望管理**：Option 2 不是经典七巧板（无 45°）；Option 4 只有四种块。要在 Ted 看截图前说清。
- **脸与质感**：品牌靠方块的脸与塑料感；三角上的脸可能难看 → spike 1 先看。
- **存档**：尾字段方案降级不安全（只是理论上）；沙盒材料一变旧沙盒即丢（`sandbox.ts:13-15`）→ 用并列字段。每个 Phase 先冻结种子存档。
- **求助算法**：`covers()` 回溯随朝向 × 件数膨胀，且每次提交都算；Phase 24 要 memo 或降级为廉价判定，否则低端机掉帧（`hints.ts:176,295`）。
- **大文件分叉**：`LevelScreen.tsx` 1040 行、`hints.ts` 949 行、`Stage.tsx` 851 行；形状站若再往里加分支，三个文件都会过 1200 行。建议 Phase 24 用 `PlayHost` 变体 + `ShapeHints` 独立文件隔离，而不是继续加 `if (q.kind === ...)`。
- **门禁**：core / content / progress 95% 覆盖（`package.json`）、`lint:purity` 零命中、`layout.test` 的 13 台设备 ≥ 32px 断言（`SPEC-blocks-ui` 舞台几何条）——新引擎每一条都要补到位，否则 `test:gate` 红。
- **工作量偏差**：Option 2 / 4 的估算假设 spike 1–3 顺利；若三角要上 SVG 或旋转要动画打磨，按 × 1.5 算。
