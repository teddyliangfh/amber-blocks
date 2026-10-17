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
      ways?: number };  // Phase 19"两种拼法"：同一站、同一托盘问 ways 次，每次接受一个还没用过的允许拼法；默认 1

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
  readonly initial: BenchState;                         // core；材料在托盘（given 伙伴除外，已在工作台最左列），伙伴已 defineGroup（带 shape）
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
- "还差谁"站（`given`）的题目是 `prompt.missing_part`："已经有 {a} 了，再找一个伙伴，拼成 {n}" / "Here is {a}. Find one more partner to make {n}"（a = given，n = sum；Phase 19）。"两种拼法"站沿用 `prompt.sum_composition`。
- 帮助句按材料区分：松散块用 `hint.count-mismatch.fewer / more`（拿一块 / 放回一块）；伙伴用 `hint.fewer.partner`（再搬一个伙伴）、`hint.more.partner`（把一个伙伴送回去）、`hint.swap.partner`（换一个伙伴）；自由和用 `hint.sum-pair`。选句逻辑在 `screens/hints.ts`。

材料规则（`material.ts`）：

- 单位块 `hue` 是伙伴主题色 token（`'n1'`…`'n10'`，按数量；>10 复用 `'n10'`），由 `blocks-ui` 映射到真实颜色。core 不读它。
- 第一章：托盘 `target + extra` 块（M2：extra = 2），全部松散单位，hue 全为该站目标数的主题色（同一站同色，数量由身份决定，AC-20）。
- 第二章：每个伙伴是一个 `defineGroup(..., shape)` 的托盘组；shape 取该数的标准身体 `bodyOf(n)`：n ≤ 5 横排一行，6–10 两行（上 5 下 n−5）；n > 10 不是一个身体，`handlesFor(n)` 拆成握把（17 → 10 / 5 / 2，12 → 10 / 2）。托盘顺序 = 解 + 干扰项合并后按 seed 洗牌；variant k 的顺序若与 k−1 完全相同则再洗一次（递归求 k−1 的顺序），避免唯一正确组永远在同一位置。

- "还差谁"（Phase 19，`givenMaterial`）：托盘按 `partnerOrder` 洗 [缺的那一半, ...distractors]，given 伙伴排在最后（槽位在托盘末尾），随后用 core `takeGroup` 放到工作台最左一列、竖直居中（让缺的那一半能贴着它放在右边）；它的 home 槽位照旧，所以托盘里留着它的轮廓，送回去总有地方。

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

## 规则（每条都要有测试）

- **确定性**：相同 `PuzzleRef` → `materialize` 结果深度相等；不同 `attemptVariant` → 第二章托盘顺序在 5 个 variant 内至少出现 2 种（AC-44）。
- **版本隔离**：`PuzzleRef.contentVersion` 必须等于 `CONTENT_VERSION`，否则 `materialize` 抛错；旧版本的恢复 / 迁移是 `progress` 的事（AC-47）。
- **可解性**：目录里每个节点 × variant 0–4 都通过 `validate`。
- **形状题**：模板单位数 = 目标数；模板经 `symmetry` 的所有变体都放得进 `bounds`（AC-43）。
- **加法题**：指定加法（`addition_exact`，现为 1+1 / 2+1 / 2+2；测试里另用内容版本 5 的 3+4 规格）的托盘含两个真实操作数伙伴与干扰伙伴；每个伙伴 `groupSize === 标签数`；2+2 产出两个不同 `GroupId` 的二块组（AC-44）。
- **指定与自由分离**：指定加法节点的 `question.kind === 'addition_exact'`；`sum_composition`（自由和、"还差谁"、"两种拼法"）的生成同样通过验证（AC-45）。
- **还差谁 / 两种拼法**（Phase 19）：given 站开局 given 伙伴在工作台、托盘里恰好一个合法伙伴、参考解 1 步且 matched、确定性；`allowed` 不对或托盘里有第二个能补全的伙伴时抛错。ways 站同一托盘、参考解两步都拼；拼法不够、托盘里有别的一对凑出 sum、或同一种拼两次都抛错。
- **17 Boss**：不进 M2 目录，但 `bodyOf(17)` 与 `material` 要能产出 10 / 5 / 2 三个伙伴且总单位 17（AC-46）；放在扩展测试里。
- **文案**：`COPY` 每个 key 都有 zh 与 en；`params` 在两种语言的占位符集合一致；`format` 缺参抛错（AC-17）。
- **纯度**：`src/content` 不 import RN / DOM；`hue` 不参与任何算术或判定。

目录（`catalog/`，内容版本 6，2026-10-16；版本历史见 `catalog/index.ts` 的 `CONTENT_CHANGES`：v2 10 / 12 / 17 加诱饵，v3 工作台按材料，v4 5–9 站重排，v5 5 站五块单块，v6 合体岛 5–7 改"还差谁"、新增 8 站"两种拼法"）：

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
| ch2 | n4 | boss | sum_composition 5，allowed [[2,3],[4,1]]，干扰 [5] |
| ch2 | n5 | normal | sum_composition 5，given 2，allowed [[2,3]]，干扰 [1, 4]（还差谁，内容版本 6） |
| ch2 | n6 | normal | sum_composition 6，given 4，allowed [[4,2]]，干扰 [1, 3]（还差谁） |
| ch2 | n7 | normal | sum_composition 7，given 3，allowed [[3,4]]，干扰 [2, 5]（还差谁） |
| ch2 | n8 | boss | sum_composition 7，allowed [[3,4],[5,2]]，ways 2，干扰 [1]（两种拼法；托盘 3、4、5、2、1 里能凑出 7 的恰好这两对） |

握把题的材料：`handleMaterial` = 握把伙伴（各自主题色）+ 诱饵伙伴（decoys）+ extra 块松散单位；判定仍是 `quantity`（只数数量，任何凑出目标的组合都对，如 10 = 5 + 4 + 1）。

2026-10-14 用户试玩修订：原先托盘里的伙伴正好就是答案（10 = 5 + 5），"把伙伴全搬过去"总能过关，没有选择。现在：
- 握把题必须带至少一个诱饵伙伴（`validate`：`handles need at least one decoy partner`；`decoys` 只能和 `handles` 一起用），全部伙伴之和必然超过目标。
- 伙伴在托盘里的顺序按种子洗牌（`partnerOrder`，同第二章），诱饵不固定在同一个位置。
- 参考解只搬加起来正好等于目标的伙伴（子集和），诱饵留在托盘。
- 松散备用块着"1"的颜色（红），不再用 10 的近白色——那在托盘里像空槽。
- 当时没升 contentVersion，2026-10-14 复审指出旧存档在这三站的作品会被当成损坏清掉。已改为：`CONTENT_VERSION = 2`，`CONTENT_CHANGES[2] = [ch1-n10, ch1-n11, ch1-n12]`，由 progress 按站迁移（D-034）。以后任何站对同一 ref 发的东西变了，都要升版本并登记；`fingerprint.test.ts` 会拦住漏登记。

`bounds`（2026-10-15 改为 D-037）：工作台由本站材料推导（`content/bench.ts`）：放得下数字按伙伴画法的排法、形状题每个转向和同数的一行、加法两个伙伴并排与每个伙伴，各加 1 格余量、最小 3 × 3，并保证全部材料能同时放上去（放不下就加行）。章节 / 节点仍可固定 `bounds`（节点优先），目前没有站固定。拼出 1 是 3 × 3，合体岛 7 与 8 站是 8 × 3（6 站 7 × 3），8 砖与 17 是 6 × 5。"还差谁"站的 given 伙伴本来就是允许拼法的一个尺寸，`fitBench` 照常把它算在材料里。

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
