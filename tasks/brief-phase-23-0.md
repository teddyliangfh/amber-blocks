# Brief · Phase 23-0 顶栏提示 + 23a 造型快赢（给开发 agent）

> 来源：Ted 看孩子玩之后的反馈（2026-10-22）："顶栏的数字、形状、提示太小、不够醒目""形状题太少，孩子最爱"。方案已经写成 PRD 并经过一轮冷读评审：[docs/shape-island-and-header-prd.md](../docs/shape-island-and-header-prd.md)（v0.2）。本 brief 只做 PRD 的 §3（顶栏）和 §4.1（内容 v9 快赢）；造型岛（§4.2）是下一个 Phase，不在本轮。

## 你的角色与目标

你是 Amber Blocks（给一位四岁、还不识字的孩子做的中英双语数学积木游戏，Expo SDK 58 + React Native Web，手机网页优先）的开发 agent。本轮两个目标，按顺序做，各自跑完门禁再进下一个：

1. **23-0 顶栏（≈ 1 天，不动内容版本和存档）**：开站有一拍"看这里"的仪式，形状小图并进云朵、用目标数字的颜色、第一格有脸，提示卡的状态符号放大。改完后孩子开站 2 秒内的第一眼应该落在云朵上（PRD §1 H1–H3）。
2. **23a 内容 v9（≈ 0.5–1 天，零引擎改动）**：数字岛插 5 站、合体岛插 1 站新造型（蘑菇 → 闪电 → 靴子三步、加号 5、甜甜圈 8、大方块 9、站着的十、大楼梯 10），旧站一字不改。形状站 7 → 13。

## 开工前必读

- PRD §0、§3（全部）、§4.1、§6、§8、§9：[docs/shape-island-and-header-prd.md](../docs/shape-island-and-header-prd.md)。
- 顶栏尺寸、对比度、每 px 对积木的代价实算与三个方案：[docs/research/shape-island-2026-10-22/header-ux.md](../docs/research/shape-island-2026-10-22/header-ux.md)；概念图 [docs/mockups/header-hints.html](../docs/mockups/header-hints.html)（只是概念，不是交付稿）。
- 新模板坐标与伙伴分解：[docs/research/shape-island-2026-10-22/game-design.md](../docs/research/shape-island-2026-10-22/game-design.md) §1.1（注意开头的勘误）；评审稿 [prd-review.md](../docs/research/shape-island-2026-10-22/prd-review.md) #1、#4、#5、#6、#8、#17、#18 是本轮直接相关的坑。
- 代码：`src/blocks-ui/chrome.ts`（`LEVEL_CHROME`）、`src/screens/LevelScreen.tsx`（badge / templatePreview 约 619–657 行，样式约 996–1017 行，`DEMO_AFTER_MS` / `NUDGE_AFTER_MS` 约 39–47 行）、`src/screens/Cloud.tsx`、`src/screens/AnswerFeedback.tsx`、`src/blocks-ui/juice.ts`（`usePop` / `useNod` / `usePulse` / `useReducedMotion`）、`src/blocks-ui/layout.ts`、`src/content/catalog/shapes.ts` / `chapter-1.ts` / `chapter-2.ts` / `index.ts`、`src/content/validate.ts`、`src/progress/__fixtures__/`（种子存档的做法）、`tasks/todo.md` Phase 22 的 22-3（种子存档流程）。
- README "当前实现"一节，知道现在的行为。

## 硬约束（与 Phase 22 相同）

- 不执行任何 git 操作（Ted 自己来）；不加依赖；`lint:purity` 零命中；存档 `schemaVersion` 不变；不加自动语音；每个待定取舍一个带注释的命名常量；只改必要的文件，旧站材料一字不改。
- 门禁：`pnpm lint`、`pnpm typecheck`、`pnpm test:gate`、`pnpm build:web`。改了 `LEVEL_CHROME` 后 `layout.test.ts` 的常量要同步，但 13 台设备 ≥ 32px 的断言本身不能放宽。
- 浏览器走查三种视口：375 × 812、360 × 640、667 × 331（内建浏览器 dev 模式 `expo-web`，走查方法见 `tasks/todo.md` 各 Phase 的"浏览器走查"）。

## 任务

### 23-0-1 开场仪式 C（PRD §3.2）

- 触发键 `(nodeId, attemptVariant)` 首次挂载：云朵 scale 0.6 → 1.4 → 1（`usePop` 参数化），阴影 `#A9D5EE` → `#8FC3E3` → 回；300–800ms 小图 ±8° 三次；400ms Amber `useNod` + 向云探身 6px；450ms 两音上行软 chime（比过关音低半度、更短，`audio-i18n/sfx.ts` 新事件）。序列换步只做小图 `useNod`、不响 chime；"再玩一次"算新开。
- 再唤起：新常量 `CLOUD_NUDGE_MS = 3500`；开站后 3.5 秒无触摸 → 云朵 `usePulse` 1.16× 两下 + chime 轻一度；每站最多 2 次，第一次触摸或示范手出现时取消。**不要撞上 5 秒的示范手**（`DEMO_AFTER_MS`）。
- `useReducedMotion`：不缩放不旋转，改云阴影加深 + 小图边框 1.5 → 3px 持续 1 秒，chime 保留。
- 测试：`LevelScreen.sound.test.web.tsx` 开站音频期望；凡断言"开站不弹"的用例改期望；再唤起的计时用 fake timers 验证取消逻辑。

### 23-0-2 A-lite：小图并入云朵、上色加脸（PRD §3.3）

- `LEVEL_CHROME`：regular header 104 → 120、feedback 84 → 88、footer 76 → 68；compact header 80 → 88、footer 52 → 48；`sideColumn` 不变。
- 云：regular H 100 / minW 180 / 阴影 6px `#8FC3E3`；compact H 76 / minW 140；横屏侧栏数字上、小图下。数字 72（算式 50、长算式 34）/ compact 52（算式 36）。
- 小图进云内：格 = `min(28, ⌊56 / 行⌋, ⌊112 / 列⌋)`（compact `min(22, ⌊44 / 行⌋, ⌊88 / 列⌋)`，横屏 `min(18, ⌊36 / 行⌋, ⌊72 / 列⌋)`），盒 = 格 × 行列 + 8；填色 `colorsFor(n).fill` + 2px edge，第一格 `Face mood="calm"` 约 14px，和积木一起 `useBreathe`。规则：有模板的站"数字 + 图"，算式站不放图。`Spotlight` 套整朵云。
- 提示卡：图标盘 44 → 48，开始态用 Amber 小头像（`assets/images/amber-girl.png` 裁头），调整态灯泡、成功态 ✓ 不变；喇叭 40 → 44；字号不动。
- 测试：`layout.test.ts:162–176` 常量；新增"所有目录模板的小图盒 ≤ 云内框"（遍历 `CHAPTERS` 的 `quantity_shape` 模板）；`LevelScreen.test.web.tsx:420–434` 的 `template-preview` 选择器；`layout-fit.test.web.tsx` 读 `LEVEL_CHROME` 自动跟，Amber chin 断言要仍成立。
- 走查记录每个视口的格 / 托盘 px（预期：375 × 812 格不变、17 站托盘 46 → 44；360 × 640 的 17 站 43 → 42；360 × 568 ≥ 33）。

### 23a 内容 v9（PRD §4.1）

- 先用 v8 代码冻结三份种子存档（照 22-3：全通、数字岛一半、合体岛一半）再改题库。
- `catalog/shapes.ts` 加 `T_4 S_4 L_4 PLUS_5 RING_8 SQUARE_3X3 TEN_STANDING STAIRS_10`（坐标见 game-design.md §1.1）。
- 插站（新 id，旧站不动）：ch1-n6 后 `sequence [T_4, S_4, L_4]` 单块 4 + extra 2、`symmetry { rotation: true, mirror: true }`；ch1-n7 后 `PLUS_5` 单块 5 + extra 2；ch1-n8 后 `RING_8, handles [3,3,1,1], decoys [2]`；ch1-n9 后 `SQUARE_3X3, [3,3,3], decoys [4]`；ch1-n10 后 `TEN_STANDING, [2,2,2,2,2], decoys [3]`，`symmetry { rotation: false, mirror: false }`，**`bounds: { cols: 6, rows: 5 }` 写死**（否则 `fitBench` 给 6 × 6，小屏 37px）；ch2-n11 后 `STAIRS_10, [1,2,3,4], decoys [5]`。
- 诱饵口径写进目录测试：**仅由伙伴组成**、含诱饵、和 = 目标的组合，用 `hints.ts` 的 `covers()` 判为假（RING `3+3+2`、SQUARE 无、TEN 无、STAIRS `5+4+1`）；带备用单块拼出来算对。
- `CONTENT_VERSION = 9`、`CONTENT_CHANGES[9] = []`；指纹测试更新；升级测试：全通 v8 → `current` 落到数字岛第一个新站，完成记录全保留。
- 文案 key：新站的云朵 / 卡片沿用现有 `quantity_shape` 文案；模板名暂不进文案（造型岛再做）。
- 地图标签照旧是数字（会出现 4 4、8 8、9 9、10 10 相邻，PRD §8 #13 已接受）。

## 不做

- 方案 B（影子搬上工作台）、`ShadowOutline`、造型岛 ch5、`MAP_SHAPE_LABEL`、`SHADOW_SNAP`：下一个 Phase。
- 提示卡字号、卡的配色；沙盒"今日造型"；骰子新池；任何三角形 / 七巧板。
- 伙伴自定义身体 `bodies`、让孩子转伙伴。

## 默认值（PRD §8，Ted 没说就按默认；各留一处可改）

`LEVEL_CHROME` 新值如上；`CLOUD_NUDGE_MS = 3500`；提示卡开始态 = Amber 头像；v9 插站清单如上；`SINGLES_DRAG_CAP = 6`（"小树 → 加号"7 拖序列不收）；`MIRROR_FOR_CHIRAL` 闪电 / 靴子开镜。

## 交付时更新这些文档

- `docs/discussion-and-decisions.md`：D-105 起逐条（仪式、A-lite 尺寸规则、再唤起时序、v9 插站、TEN_STANDING 的 6 × 5）。
- README "当前实现"（顶栏、形状站数 13 / 38）、`spec/SPEC-screens.md`（chrome 数字）、`spec/SPEC-content.md`（v9）、`tasks/todo.md` 新开 Phase 23-0 / 23a 两节（含"需要 Ted 决定""只能真机确认""浏览器走查"）。
- PRD 文件本身不改；若实现时发现 PRD 的数字不成立，在 todo 里记"与 PRD 的出入"。

## 完成的标准

- 四个门禁全绿，测试数只增不减；三种视口走查截图进 `docs/review-assets/p23-*.jpg`。
- 375 × 812 开站能看到：云朵弹一下、小图是目标色且有脸、3.5 秒后云朵脉冲、5 秒示范手；拿走岛算式站没有小图且不溢出。
- v9：全通 v8 存档升级后地图停在 ch1 第一个新站，六个新站都能用参考解过关，诱饵陷阱按口径判定。
- 结束时在聊天里报：改了什么、门禁结果、走查看到的 px、需要 Ted 决定的事、只能真机确认的事。
