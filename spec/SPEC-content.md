# Spec: content

模块 id：`content`（见 [CAPABILITY-MAP](CAPABILITY-MAP.md)）  
日期：2026-10-13  
状态：已审（2026-10-13，见 D-028），并已实现于 `src/content/`（2026-10-13：39 个测试，Success Criteria 1–3 达成；第 4 条待 `SPEC-progress.md`、第 5 条待 `audio-i18n` 验证）。6 个 Open Questions 按建议默认采纳，记录在文末"已决问题"。任务见 [tasks/plan.md](../tasks/plan.md) Task 12–17。

依赖：`math-core`（只经 `src/core/index.ts`）。消费者：`progress`（章节 / 节点图）、`blocks-ui`（初始材料与显示元数据）、`screens`（提示语）、`audio-i18n`（语义 key）。

## Objective

把"这一站是什么题"变成一份**可复现、已验证可解**的材料包。输入是一个引用 `{ contentVersion, chapterId, nodeId, attemptVariant, seed }`，输出是一个 `Puzzle`：core 的 `Question`、初始 `BenchState`（托盘里的单位块 / 伙伴、工作台 `bounds`）、提示与反馈的语义 key，以及一条只用 core 命令写成的参考解。同一引用永远得到同一份 `Puzzle`；换语言、回地图、刷新都不重抽（AC-42、AC-44、AC-47）。

范围（2026-10-13 第二版，D-033）：第一章 12 站（三段，每段三道普通题 + Boss）+ 第二章 7 站（小和起步、自由和小 Boss、3+4 章节挑战），共 19 站。schema 与生成步骤按 [level-progression §6](../docs/level-progression.md) 设计成可扩展。

成功的样子：PRD 里关于出题、可复现、可解性、干扰项与文案一致性的验收条件（AC-17、AC-43、AC-44、AC-45、AC-46、AC-47）每条对应到这里的一个纯函数和至少一条测试；`progress` 与 `blocks-ui` 不需要知道题是怎么生成的。

## Tech Stack

- TypeScript 5.x / 6.x，`strict`、`noUncheckedIndexedAccess`（随工程）。
- 零运行时依赖；只 import `../core`（`index.ts`）。不 import `react`、`react-native`、`expo-*`、DOM 类型。
- 伪随机：自带 `mulberry32`，种子由 `fnv1a(1, chapterId, nodeId, attemptVariant, seed)` 得到。第一项原为 `contentVersion`，2026-10-14 固定为 1（当时全部托盘就是用 1 发的）：升内容版本只改它列出的站，不能顺带洗乱没变的站（D-034）。不使用 `Math.random`、`Date.now`。
- 文案：中英文本表与语义 key 放在本模块（`copy.ts`），作为 build 期 edge-tts 生成音频与运行期显示的**唯一**来源；`audio-i18n` 只做 key → mp3 的映射与播放。

## Commands

```
Test:     pnpm test:content            # = jest src/content（快速）
Gate:     pnpm test:gate               # = jest --coverage：core + content 一起跑，两个目录各 95% 阈值
Typecheck pnpm typecheck
Purity:   pnpm lint:purity             # src/core src/content
```

门禁合并的原因：jest 的按路径阈值在只跑一个目录时会因另一个目录无覆盖数据而报错，所以覆盖率门禁一次跑全部。

## Project Structure

```
src/content/
  ids.ts            ChapterId / NodeId / CopyKey 品牌类型
  schema.ts         Chapter、NodeSpec、QuestionSpec、PuzzleRef、Puzzle、PuzzleDisplay
  rng.ts            fnv1a + mulberry32：seeded()、int()、shuffle()
  envelope.ts       目标池抽取 + 近两站不重复（池小放宽）
  material.ts       按题型生成单位块 / 伙伴（hue、shape、托盘顺序）
  distractors.ts    第二章干扰伙伴
  solution.ts       参考解：用 core 命令摆出一个通过的作品
  validate.ts       可解性 / 契合度校验（跑参考解 + judge + bounds）
  generate.ts       materialize(ref) → Puzzle（串起以上各步）
  challenge.ts      自由玩随机题：按已完成的站出一道题（Phase 21）
  copy.ts           语义 key 表：zh / en 文本 + 参数占位
  catalog/
    chapter-1.ts    数字岛：M2 四站
    chapter-2.ts    合体岛：M2 一站
    index.ts        CONTENT_VERSION、chapters[]、按 id 查找
  index.ts          公开 API（只从这里 export）
  *.test.ts         与源文件同目录
```

## Domain Model

```ts
// ids.ts
export type ChapterId = string & { readonly __brand: 'ChapterId' };
export type NodeId    = string & { readonly __brand: 'NodeId' };
export type CopyKey   = string & { readonly __brand: 'CopyKey' };

// schema.ts
export interface Chapter {
  readonly id: ChapterId;
  readonly title: CopyKey;
  readonly bounds: Bounds;                              // 本章工作台格数（core 要求 content 给）
  readonly nodes: ReadonlyArray<NodeSpec>;              // 地图次序
}
export interface NodeSpec {
  readonly id: NodeId;
  readonly role: 'normal' | 'boss';
  readonly spec: QuestionSpec;
}
// 一个节点描述"允许的题"，不是一道固定题；M2 的池都只有一个元素。
export type QuestionSpec =
  | { kind: 'quantity';        targets: ReadonlyArray<number>; extra: number; handles?: ReadonlyArray<number> }   // extra ≥ 1：托盘多给几块；handles：大数拆成握把伙伴（17 = 10+5+2），和必须等于目标且只能单目标池
  | { kind: 'quantity_shape';  target: number; templates: ReadonlyArray<ShapeTemplate>; symmetry?: Symmetry; extra: number }
  | { kind: 'addition_exact';  pairs: ReadonlyArray<readonly [number, number]>; distractors: ReadonlyArray<number> }
  | { kind: 'sum_composition'; sum: number; allowed: ReadonlyArray<readonly [number, number]>; distractors: ReadonlyArray<number>;
      given?: number;   // Phase 19"还差谁"：开局一个这个大小的伙伴已在工作台上，是答案的一部分；allowed 必须恰好是 [[given, sum − given]]
      ways?: number;    // Phase 19"两种拼法"：同一站、同一托盘问 ways 次，每次接受一个还没用过的允许拼法；默认 1
      onMat?: ReadonlyArray<number> }   // Phase 21"送走多的"：开局这些伙伴已在工作台上排成一排、比 sum 多；allowed 是送走多的之后剩下的那一对
  | { kind: 'split';     total: number; parts: number; ways?: number }   // Phase 22 拆开：total 块单块开局贴成一排在工作台上、托盘只有床位，拉成 parts 堆（这一轮只认 2）；ways 次每次一种没拆过的分法
  | { kind: 'take_away'; start: number; take: number; onMat?: ReadonlyArray<number>; steps?: ReadonlyArray<number> };  // Phase 22 拿走：start 块开局在工作台上，送 take 块回家；判定就是 quantity start − take；onMat 是 start 拆成的伙伴；steps 是倒数（每步送几块，和等于 take）

export interface PuzzleRef {
  readonly contentVersion: number;
  readonly chapterId: ChapterId;
  readonly nodeId: NodeId;
  readonly attemptVariant: number;                      // 0 = 首次；"再玩新题"才 +1
  readonly seed: number;                                // 设备级，由 progress 首次生成后保存
}
export interface PuzzleDisplay {
  readonly target: number | null;                       // 大数字；加法题为 null，用 operands
  readonly operands: readonly [number, number] | null;
  readonly template: ShapeTemplate | null;              // 造型参考（小图 / 大轮廓）
  readonly partnerIds: ReadonlyArray<GroupId>;          // 托盘伙伴的显示顺序（已洗牌）；数字标签 = groupSize()
}
export interface Puzzle {
  readonly ref: PuzzleRef;
  readonly question: Question;                          // core
  readonly steps?: ReadonlyArray<Question>;             // 同一站分步（sequence 形状题）
  readonly ways?: number;                               // 同一站问几种拼法（sum 带 ways）；前几步用掉了哪几种由关卡会话记，不进 core
  readonly given?: GroupId;                             // 开局就在工作台上的伙伴（sum 带 given）；它在托盘里的 home 槽位照旧
  readonly onMat?: ReadonlyArray<GroupId>;              // 开局就在工作台上、要送走多的那一排（sum 带 onMat，或 take_away 带 onMat），从左到右；各自的 home 槽位照旧
  readonly takeAway?: { start: number; take: number };  // 拿走站（Phase 22）：开局几块、一共送走几块；question 是剩下的数，倒数的 steps 是每步剩下的数
  readonly initial: BenchState;                         // core；材料在托盘（given 伙伴 / onMat 一排除外，已在工作台上），伙伴已 defineGroup（带 shape）
  readonly display: PuzzleDisplay;
  readonly prompt: CopyKey;                             // 例 copy('prompt.quantity')，参数见 copy.ts
  readonly solution: ReadonlyArray<Command>;            // 参考解，只用于验证；不展示给孩子
}

// copy.ts
export interface CopyEntry { readonly zh: string; readonly en: string; readonly params: ReadonlyArray<string> }
export const COPY: Readonly<Record<string, CopyEntry>>;   // key → 双语文本；运行期 format(key, lang, params)
```

文案边界（2026-10-14 审查修订）：

- 提示不能比判定规则承诺得更宽。`prompt.sum_composition` 改为"找两个伙伴，拼出 {n}"/"Find two partners that make {n}"（判定只接受 `allowed` 中的两个伙伴），不再说"怎么分都行"。
- "还差谁"站（`given`）的题目是 `prompt.missing_part`："已经有 {a} 了，再找一个伙伴，拼成 {n}" / "Here is {a}. Find one more partner to make {n}"（a = given，n = sum；Phase 19）。"两种拼法"站沿用 `prompt.sum_composition`。"送走多的"站（`onMat`）的题目是 `prompt.send_away`："工作台上多了，送走多的，拼成 {n}" / "Too many! Send one back to make {n}"（Phase 21）。
- 帮助句按材料区分：松散块用 `hint.count-mismatch.fewer / more`（拿一块 / 放回一块）；伙伴用 `hint.fewer.partner`（再搬一个伙伴）、`hint.more.partner`（把一个伙伴送回去）、`hint.swap.partner`（换一个伙伴）；自由和用 `hint.sum-pair`。选句逻辑在 `screens/hints.ts`。

材料规则（`material.ts`）：

- 单位块 `hue` 是伙伴主题色 token（`'n1'`…`'n10'`，按数量；>10 复用 `'n10'`），由 `blocks-ui` 映射到真实颜色。core 不读它。
- 第一章：托盘 `target + extra` 块（M2：extra = 2），全部松散单位，hue 全为该站目标数的主题色（同一站同色，数量由身份决定，AC-20）。
- 第二章：每个伙伴是一个 `defineGroup(..., shape)` 的托盘组；shape 取该数的标准身体 `bodyOf(n)`：n ≤ 5 横排一行，6–10 两行（上 5 下 n−5）；n > 10 不是一个身体，`handlesFor(n)` 拆成握把（17 → 10 / 5 / 2，12 → 10 / 2）。托盘顺序 = 解 + 干扰项合并后按 seed 洗牌；variant k 的顺序若与 k−1 完全相同则再洗一次（递归求 k−1 的顺序），避免唯一正确组永远在同一位置。

- "还差谁"（Phase 19，`givenMaterial`）：托盘按 `partnerOrder` 洗 [缺的那一半, ...distractors]，given 伙伴排在最后（槽位在托盘末尾），随后用 core `takeGroup` 放到工作台最左一列、竖直居中（让缺的那一半能贴着它放在右边）；它的 home 槽位照旧，所以托盘里留着它的轮廓，送回去总有地方。
- "送走多的"（Phase 21，`onMatMaterial`）：托盘按 `partnerOrder` 洗 distractors（可以为空），onMat 的伙伴按给定顺序排在后面（槽位在托盘末尾），随后用 core `takeGroup` 从工作台最左一列起排成一排、互相贴着、竖直居中；各自的 home 槽位照旧（托盘留轮廓，可以拖回）。
- 拆开 / 拿走单块（Phase 22，`presetMaterial`，D-101）：`total`（或 `start`）块单块，颜色 `hueFor(total)`，用 core `take` 从最左列起贴成一排、竖直居中放在工作台上；托盘只剩它们的床位（home 槽位照旧，送回去各回各家）。拿走伙伴站复用 `onMatMaterial(onMat, [])`（托盘没有干扰）。

生成步骤（`generate.ts`，对应 level-progression §6）：

1. `rng = seeded(ref)`。
2. 目标：`envelope.pick(spec, rng, recentTargets)`，近两站同目标则换（池 ≤ 2 时放宽）。`recentTargets` 由 `progress` 传入，M2 固定表下恒为空。
3. 形状：`quantity_shape` 从 `templates` 抽一个。
4. 材料：按上面的规则生成 `units` 与托盘；第二章再加 `distractors`。
5. 洗牌托盘顺序（只影响 `tray` 槽位与 `display.partnerIds`，不影响身份）。
6. `solution.build(question, initial)`：用 core 命令摆出一个通过的作品。
7. `validate(puzzle)`：跑参考解，每步 `ok`，最终 `judge().matched === true`；所有模板 / 伙伴 shape 都能放进 `bounds`；`quantity_shape` 的 `template.cells.length === target`；`addition_exact` 中 a = b 时有两个不同 `GroupId`；干扰项不与解同尺寸时才算干扰。任何一步失败 → 抛错（内容 bug，不是运行时降级）。
   - `given`（Phase 19）：开局工作台上只有 given 伙伴（其余材料在托盘）；`allowed` 恰好是 [[given, sum − given]]；托盘里能补全它的伙伴恰好一个；不能同时带 `ways > 1`。参考解只有一步：把缺的那一半搬过去贴在 given 右边，不碰 given。
   - `ways`（Phase 19）：正整数且 `allowed.length ≥ ways`；每个允许拼法都有两个不同身份的伙伴；`ways ≥ 2` 时托盘里没有别的一对能凑出 sum。参考解依次拼每一种（拼好 → 送回 → 下一种），逐步判定时每一步只接受前面没用过的拼法（`steps.ts questionAt`，与关卡会话共用）。
   - `onMat`（Phase 21）：和大于 sum；`allowed` 恰好一对；onMat 里能凑出 sum 的位置对恰好一个，就是 `allowed` 那一对，而且两者相邻（多出的伙伴都在两端，送走后剩下的那一对仍然相贴，孩子只需"送走"一个动作）；全部材料（工作台 + 托盘）里没有别的两个伙伴能凑出 sum（只有一种送法，托盘里也没有别的路）；开局工作台上恰好是这一排、从左到右、互相贴着；不能同时带 `given` 或 `ways > 1`。参考解：把多出的伙伴依次 `returnGroup`，剩下的那一对不动。
   - 用伙伴拼的造型（`quantity_shape` + `handles`）：参考解按托盘顺序找第一组加起来等于目标、又能按原样（不转向）铺满图形的伙伴，从左上角第一个空格起逐个放（`solution.ts cover`）；长方形（8 砖、十）与原来的"按图形宽度一行行排"结果相同，楼梯要每一级一个伙伴（2 + 4 是 6，但搭不成楼梯）。
   - `split`（Phase 22，D-100 / D-101）：question 是 core `split { total, parts }`（`except` 由 `steps.ts questionAt` 在第二种起加上用过的分法，core 判 `split-used`）；`parts === 2`、`total ≥ 2`、`ways ≤ floor(total / 2)`（1 + 4 与 4 + 1 算一种）、`puzzle.ways` 与规格一致、开局恰好 `total` 块都在工作台上、没有伙伴、一簇。参考解：最右一块右移一格（第 k 种 = 从右数第 k 块右移一格，k + (total − k)）；逐步走法同 ways（`benchPair` 没有伙伴时取两堆的大小）。
   - `take_away`（Phase 22，D-100 / D-101）：question 是 `quantity { target: start − take }`（倒数：`steps` 每步剩下的数，`puzzle.steps`）；`puzzle.takeAway` 等于规格；`take ≥ 1`、`start − take ≥ 1`（不减到 0）；开局恰好 `start` 块都在工作台上；单块站没有伙伴也没有 `puzzle.onMat`；伙伴站 `onMat` 的和等于 `start`、`puzzle.onMat` 就是它们、连成一排从左到右、按大小只有一组伙伴等于 `take`（[3, 2, 2] 拿 3 只有那个 3；[2, 2] 拿 2 算一种），倒数只用单块；`steps` 每步 ≥ 1、和等于 `take`、至少两步、每一步的 target 就是剩下的数。参考解：单块从右往左 `return`、伙伴 `returnGroup` 那一组、倒数一次一块（每一步都经过）；送错的参考解不通过。

## 规则（每条都要有测试）

- **确定性**：相同 `PuzzleRef` → `materialize` 结果深度相等；不同 `attemptVariant` → 第二章托盘顺序在 5 个 variant 内至少出现 2 种（AC-44）。
- **版本隔离**：`PuzzleRef.contentVersion` 必须等于 `CONTENT_VERSION`，否则 `materialize` 抛错；旧版本的恢复 / 迁移是 `progress` 的事（AC-47）。
- **可解性**：目录里每个节点 × variant 0–4 都通过 `validate`。
- **形状题**：模板单位数 = 目标数；模板经 `symmetry` 的所有变体都放得进 `bounds`（AC-43）。
- **加法题**：指定加法（`addition_exact`，现为 1+1 / 2+1 / 2+2；测试里另用内容版本 5 的 3+4 规格）的托盘含两个真实操作数伙伴与干扰伙伴；每个伙伴 `groupSize === 标签数`；2+2 产出两个不同 `GroupId` 的二块组（AC-44）。
- **指定与自由分离**：指定加法节点的 `question.kind === 'addition_exact'`；`sum_composition`（自由和、"还差谁"、"两种拼法"）的生成同样通过验证（AC-45）。
- **还差谁 / 两种拼法**（Phase 19）：given 站开局 given 伙伴在工作台、托盘里恰好一个合法伙伴、参考解 1 步且 matched、确定性；`allowed` 不对或托盘里有第二个能补全的伙伴时抛错。ways 站同一托盘、参考解两步都拼；拼法不够、托盘里有别的一对凑出 sum、或同一种拼两次都抛错。
- **送走多的 / 新造型**（Phase 21）：onMat 站开局一排从最左列起、竖直居中、托盘留 home 槽位、参考解 1 步送回多的；不多于和、多于一对、中间多一个、两种送法、托盘里另有一对、与 given / ways 混用、一排不连都抛错。`TEN_2X5` 与 `STAIRS_6` 都能由参考解搭出（诱饵留在托盘）、转向后的摆法也判对、少一块 / 多一块 / 不连通 / 不像都判错；加起来够数但铺不满图形的伙伴不算参考解。10 + ? = 13 的工作台放得下两排 5 加右边的 3。
- **拆开 / 拿走**（Phase 22）：拆开站开局一排从最左列起、竖直居中、托盘全空床位、参考解一步拉开、任何别的分法也对、两种拆法参考解两步且同一种两次不通过；少于两块、不是两份、ways 多于分法、块在托盘、伙伴、不连成一排、规格外的 `except` 都抛错。拿走站 5 − 2 开局一排、参考解从右往左送两块、各回各家；伙伴站 6 − 2 送 2、送 4 不对、7 − 3 送走两个 2 剩 3 块；倒数每步剩下的数、每一步都经过、[2, 1] 也行；减到 0、块在托盘、伙伴不等于 start、两种送法、伙伴倒数、一步的倒数、步数不等于 take、规格不符的 `takeAway` 都抛错。
- **随机题**（Phase 21，`challenge.ts`）：同一进度、种子、上一题 → 同一道题；各种进度下只出允许的题型与数字；大量种子出的题全部通过 `validate` 且参考解判对；同一题型同一个数不连着出两次；上限与解锁的边界。
- **17 Boss**：不进 M2 目录，但 `bodyOf(17)` 与 `material` 要能产出 10 / 5 / 2 三个伙伴且总单位 17（AC-46）；放在扩展测试里。
- **文案**：`COPY` 每个 key 都有 zh 与 en；`params` 在两种语言的占位符集合一致；`format` 缺参抛错（AC-17）。
- **纯度**：`src/content` 不 import RN / DOM；`hue` 不参与任何算术或判定。

目录（`catalog/`，内容版本 8，2026-10-19；版本历史见 `catalog/index.ts` 的 `CONTENT_CHANGES`：v2 10 / 12 / 17 加诱饵，v3 工作台按材料，v4 5–9 站重排，v5 5 站五块单块，v6 合体岛 5–7 改"还差谁"、新增 8 站"两种拼法"，v7 合体岛插入 n9–n12 四站、原 20 站一字不变、`CONTENT_CHANGES[7] = []`，v8 追加拿走岛 ch3 八站、原 24 站一字不变、`CONTENT_CHANGES[8] = []`）。合体岛按地图顺序列出：

| 章 | 节点 | role | spec |
|---|---|---|---|
| ch1 数字岛 | n1 / n2 | normal | quantity 1 / 2，extra 2 |
| ch1 | n3 | normal | quantity_shape 4，2×2 |
| ch1 | n4 | boss | quantity_shape 3，转角 |
| ch1 | n5 | normal | quantity 5，handles [3]，extra 3（握把 3 + 五块单块，数单块也能拼到 5；内容版本 5，2026-10-16 测评 A-6） |
| ch1 | n6 | normal | quantity_shape 4，先 2×2 再 1×4（sequence，同一站两步，D-044） |
| ch1 | n7 | normal | quantity_shape 6，2×3 塔 |
| ch1 | n8 | boss | quantity_shape 8，2×4 砖，handles [4, 4]，decoys [3]，extra 1（D-044） |
| ch1 | n9 | normal | quantity 9，handles [5, 4]，decoys [3]（D-044） |
| ch1 | n10 | normal | quantity 10，handles [5, 5]，decoys [4] |
| ch1 | n11 | normal | quantity 12，handles [10, 2]，decoys [3] |
| ch1 | n12 | boss | quantity 17，handles [10, 5, 2]，decoys [4] |
| ch2 合体岛 | n1 / n2 / n3 | normal | addition_exact 1+1 / 2+1 / 2+2，干扰 [3] / [4] / [3, 1] |
| ch2 | n9 | normal | quantity_shape 10，`TEN_2X5`，symmetry 不转向（`TEN_LYING`），handles [5, 5]，decoys [4]，extra 1（两个 5 叠成十，内容版本 7） |
| ch2 | n4 | boss | sum_composition 5，allowed [[2,3],[4,1]]，干扰 [5] |
| ch2 | n10 | normal | sum_composition 7，onMat [3, 4, 2]，allowed [[3,4]]，干扰 []（送走多的，内容版本 7） |
| ch2 | n5 | normal | sum_composition 5，given 2，allowed [[2,3]]，干扰 [1, 4]（还差谁，内容版本 6） |
| ch2 | n6 | normal | sum_composition 6，given 4，allowed [[4,2]]，干扰 [1, 3]（还差谁） |
| ch2 | n11 | normal | quantity_shape 6，`STAIRS_6`，handles [1, 2, 3]，decoys [4]，extra 1（三个伙伴搭楼梯，内容版本 7） |
| ch2 | n7 | normal | sum_composition 7，given 3，allowed [[3,4]]，干扰 [2, 5]（还差谁） |
| ch2 | n12 | normal | sum_composition 13，given 10，allowed [[10,3]]，干扰 [2, 4]（十几，内容版本 7） |
| ch2 | n8 | boss | sum_composition 7，allowed [[3,4],[5,2]]，ways 2，干扰 [1]（两种拼法；托盘 3、4、5、2、1 里能凑出 7 的恰好这两对） |
| ch3 拿走岛 | n1 / n2 | normal | split 3 / 4，parts 2（内容版本 8，Phase 22，D-099） |
| ch3 | n3 | normal | take_away start 4，take 1（单块） |
| ch3 | n4 | boss | split 5，parts 2，ways 2（1 + 4 与 2 + 3，两次要不一样） |
| ch3 | n5 | normal | take_away 5，take 2（单块） |
| ch3 | n6 | normal | take_away 6，take 2，onMat [4, 2]（只有送走 2 剩 4） |
| ch3 | n7 | normal | take_away 7，take 3，onMat [3, 2, 2]（只有送走 3 剩 4；两个 2 是 4 块，送走剩 3） |
| ch3 | n8 | boss | take_away 5，take 4，steps [1, 1, 1, 1]（倒数火箭：5 → 4 → 3 → 2 → 1） |

新站核对（catalog 测试）：n9 / n11 只用伙伴（不算单块）能铺满图形的组合只有 handles（n11 的 2 + 4 是 6 但不是楼梯；单块可以顶替一个伙伴，如 n9 的 5 + 4 + 1 块单块，与 8 砖的 4 + 3 + 1 相同）；n10 一排里能凑出 7 的只有相邻的 3 + 4；n12 的干扰都补不成 10 + ? = 13。每两三站换一种动作：合起来 ×3、造型、自由凑、送走、还差谁 ×2、造型、还差谁 ×2、两种拼法。

握把题的材料：`handleMaterial` = 握把伙伴（各自主题色）+ 诱饵伙伴（decoys）+ extra 块松散单位；判定仍是 `quantity`（只数数量，任何凑出目标的组合都对，如 10 = 5 + 4 + 1）。

2026-10-14 用户试玩修订：原先托盘里的伙伴正好就是答案（10 = 5 + 5），"把伙伴全搬过去"总能过关，没有选择。现在：
- 握把题必须带至少一个诱饵伙伴（`validate`：`handles need at least one decoy partner`；`decoys` 只能和 `handles` 一起用），全部伙伴之和必然超过目标。
- 伙伴在托盘里的顺序按种子洗牌（`partnerOrder`，同第二章），诱饵不固定在同一个位置。
- 参考解只搬加起来正好等于目标的伙伴（子集和），诱饵留在托盘。
- 松散备用块着"1"的颜色（红），不再用 10 的近白色——那在托盘里像空槽。
- 当时没升 contentVersion，2026-10-14 复审指出旧存档在这三站的作品会被当成损坏清掉。已改为：`CONTENT_VERSION = 2`，`CONTENT_CHANGES[2] = [ch1-n10, ch1-n11, ch1-n12]`，由 progress 按站迁移（D-034）。以后任何站对同一 ref 发的东西变了，都要升版本并登记；`fingerprint.test.ts` 会拦住漏登记。

`bounds`（2026-10-15 改为 D-037）：工作台由本站材料推导（`content/bench.ts`）：放得下数字按伙伴画法的排法、形状题每个转向和同数的一行、加法两个伙伴并排与每个伙伴，各加 1 格余量、最小 3 × 3，并保证全部材料能同时放上去（放不下就加行）。章节 / 节点仍可固定 `bounds`（节点优先），目前没有站固定。拼出 1 是 3 × 3，合体岛 7 与 8 站是 8 × 3（6 站 7 × 3），8 砖与 17 是 6 × 5。"还差谁"站的 given 伙伴本来就是允许拼法的一个尺寸，`fitBench` 照常把它算在材料里。Phase 21：onMat 那一排要原样放得下、不加余量（它是"多出来的"，不是孩子要搭的），所以送走站是 9 × 3；10 + 3 站是 9 × 3（两排 5 加右边 3 格再加 1 格余量）；楼梯站 6 × 4；十（只认横放）6 × 3——若改成可转向，竖放的十要 6 行，工作台变 6 × 6，小屏块只有 34–38px。9 列工作台在 360 宽手机上块 40px，和 8 列一样用满屏宽。

拿走岛核对（catalog 测试，Phase 22）：数都 ≤ 7、`start − take ≥ 1`；n6 / n7 按大小只有一组伙伴等于 take（n7 的两个 2 是 4 块）；n4 的 ways 不多于 floor(5 / 2)；每站参考解步数 1 / 1 / 1 / 2 / 2 / 1 / 1 / 4。工作台（`fitBench`，那一排加 1 格余量，与送走站的"原样放下"不同）：4×3 / 5×3 / 5×3 / 6×3 / 6×3 / 7×3 / 8×3 / 6×3。

`ISLAND_SHOWCASE`（2026-10-19，`catalog/index.ts`，D-099）：岛收尾页展示的站（没列的岛展示最后一个 Boss）；默认拿走岛展示 n4（5 的两种拆法），不展示倒数剩下的一个 1。只是展示，由岛收尾页读。

`BOSS_ENTRANCE`（2026-10-18，`catalog/index.ts`，D-094）：Boss 登场的站，默认合体岛两个 Boss（ch2-n4、ch2-n8）。只是展示（虚线轮廓、睡脸、亮格），由关卡页读，判题、存档都不看它。

自由玩随机题（Phase 21，`challenge.ts`，D-095）：`nextChallenge(已完成的站, 种子, 上一题?)` → `{ kind, n, spec, puzzle }`。纯函数：随机数只来自界面传入的种子（`mulberry32(fnv1a('challenge|' + seed))`），content 里不用 `Math.random`。规则集中在 `CHALLENGE_RULES`（待 Ted 拍板）：上限 = 已完成站里最大的数（数量站目标、造型站块数、加法 / 自由和的和），不小于 3（一站没完成时就是 3）；数字题总是有，目标 1 到上限，超过 6 用 `handlesFor` 握把 + 一个 2–5 的诱饵（不与握把同尺寸），extra 2；图形题在 ch1-n3 完成后才有，只出已完成造型站里的模板（每个模板一题，沿用那一站的 extra / symmetry / handles / decoys），块数不超过上限；加法题在 ch2-n1 完成后才有，a、b ≥ 1，a + b ≤ min(上限, 10)，再加一个 1–5、与 a、b 都不同的干扰伙伴。先等概率选题型，再在题型里等概率选题；与上一题同题型同数的题先剔除。生成用 `materializeNode(合成节点, fitBench(spec), ref)`，ref 的章是 `challenge`、站是 `challenge-<题型>-<数>`、版本是当前 `CONTENT_VERSION`；每道题照常过 `validate`。

`COUNT_TO_PASS`（2026-10-16，`catalog/index.ts`，D-062）：一组站，第一次拼对后要把工作台上的块都数一遍才出现"下一站"。**默认是空集**，要不要启用、哪些站由 Ted 决定；候选是 5 个 Boss（ch1-n4、n8、n12，ch2-n4、n8；内容版本 6 起合体岛 Boss 是 ch2-n8）。

## Code Style

```ts
// src/content/generate.ts
import { createBenchState, judge } from '../core';
import type { Puzzle, PuzzleRef } from './schema';
import { findNode } from './catalog';
import { seeded } from './rng';
import { buildMaterial } from './material';
import { buildSolution } from './solution';
import { validate } from './validate';

export function materialize(ref: PuzzleRef, recentTargets: ReadonlyArray<number> = []): Puzzle {
  const { chapter, node } = findNode(ref);            // throws on unknown id / wrong contentVersion
  const rng = seeded(ref);
  const question = pickQuestion(node.spec, rng, recentTargets);
  const { initial, display } = buildMaterial(question, chapter.bounds, node.spec, rng);
  const solution = buildSolution(question, initial);
  const puzzle = { ref, question, initial, display, prompt: promptFor(question), solution };
  validate(puzzle);                                    // throws: a content bug must not reach a child
  return puzzle;
}
```

约定同 math-core：kebab-case 文件、命名导出、无 class、只有 `index.ts` 对外、状态不可变、注释英文说"为什么"。目录文件只放数据和纯函数，不放生成逻辑。

## Testing Strategy

- jest-expo，`*.test.ts` 同目录，测试名以 AC 编号或规则名开头。
- 必含夹具：
  - 目录全量：每节点 × variant 0–4 `validate` 通过，且 `materialize` 两次深度相等。
  - 洗牌：ch2 n1 在 variant 0–4 的 `display.partnerIds` 至少两种顺序；3 组不在 5 个 variant 里始终同一位置。
  - 2+2：手工 spec 产出两个不同 `GroupId` 的二块组，`judge` 用参考解通过。
  - 镜像配置：`quantity_shape` 用 4 块 L 模板、`symmetry.mirror=false`，参考解必须是 L 本身而非 J。
  - 错误路径：未知节点、错误 `contentVersion`、`extra = 0`（抛错）、模板放不进 bounds（抛错）、`format` 缺参。
  - RNG：固定 seed 的前 5 个 `int()` 快照；两个不同 ref 的 seed 不同。
- 覆盖率：`src/content` 行 / 分支 ≥ 95%。
- 一个 `demo.test.ts`：对 M2 五站依次 `materialize` → 跑参考解 → `judge` 全部 `matched: true`，并断言 ch1 n4 的 `role === 'boss'`。

## Boundaries

- **Always**：纯函数、确定性；改规则先改本 spec；完成前跑 `pnpm test:content` 与 `pnpm typecheck`。
- **Ask first**：往目录加节点 / 章节（内容决定）；改 `Puzzle` / `QuestionSpec` 形状；改 `CONTENT_VERSION`；新增依赖；改 `bounds`。
- **Never**：git；`Math.random` / `Date.now`；在线或 AI 实时出题；用 `hue` / 标签推导数值；把未验证的题交给 UI（`validate` 失败不能降级为"跳过"）。

## Success Criteria

1. `src/content` 测试全过，覆盖率 ≥ 95%，`tsc --noEmit` 零错误。
2. `pnpm lint:purity` 对 `src/core src/content` 零命中。
3. 规则一节每条至少一个同名测试；`demo.test.ts` 五站全通过。
4. `progress` 只靠 `index.ts` 导出的 `chapters`、`NodeSpec`、`materialize`、`PuzzleRef` 就能写它的 spec（接口冻结后由 `SPEC-progress.md` 验证）。
5. `copy.ts` 的 key 表能直接喂给 build 期 edge-tts 脚本（`audio-i18n` 阶段验证）。

## 已决问题（2026-10-13）

| # | 问题 | 决定 |
|---|---|---|
| 1 | 第一章托盘材料 | 目标数 + 2 块（`extra = 2`），观察数量识别，不让"全搬完"自动成立 |
| 2 | `bounds` | ~~ch1 6×5、ch2 8×6~~ 已被 D-037 取代：按本站材料推导（见上文 `bounds`）；`blocks-ui` 按格数缩放 |
| 3 | 伙伴身体 | n ≤ 5 横排一行，6–10 两行（上 5 下 n−5）；合体题里 3 用横排，转角只在造型 Boss |
| 4 | 中文数词 | 文本表存汉字数词（一…十七）给 TTS；显示用阿拉伯数字（`format` 的 `numbers: 'word' \| 'digit'`） |
| 5 | 文案表位置 | 放 content（`copy.ts`），audio-i18n 只做 key → mp3 |
| 6 | "再玩新题" | 不进 M2；`attemptVariant` 固定 0，代码路径保留并测试 |

以上为用户回复"6 条按建议"时采纳；任一条改动都是一行编辑，改前先更新本表。
