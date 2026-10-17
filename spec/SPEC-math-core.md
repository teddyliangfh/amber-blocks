# Spec: math-core

模块 id：`math-core`（见 [CAPABILITY-MAP](CAPABILITY-MAP.md)）  
日期：2026-10-13  
状态：已审（2026-10-13，见 D-026），并已实现于 `src/core/`（2026-10-13：84 个测试，覆盖率 100% 行 / 99.09% 分支，Success Criteria 1–3、5 达成；第 4 条待 `SPEC-content.md` 验证）。5 个 Open Questions 按建议默认采纳，记录在文末"已决问题"。实现计划与待决的 `takeGroup` API 问题见 [tasks/plan.md](../tasks/plan.md)。

## Objective

Amber Blocks 的纯 TypeScript 领域层。它回答且只回答一个问题：**工作台上到底有几块、它们怎么连着、这一题过没过**。所有数学事实由单位块的稳定身份决定，颜色、外形、动画、屏幕坐标都不参与计算。

消费者：

- `content`：用它校验生成的题目可解。
- `blocks-ui`：手势松手时把"把这块放到这个格子"交给它提交，拿回新状态或拒绝原因。
- `progress`：保存它产出的稳定作品。
- 测试：不起 RN、不起浏览器就能跑完全部规则。

成功的样子：PRD 里关于数量、守恒、判定、撤销、点数的验收条件（AC-01–04、20–21、25–28、30、33–35、37–40、43–47）每一条都对应到这里的一个纯函数和至少一条测试。

## Tech Stack

- TypeScript 5.x，`strict: true`，`noUncheckedIndexedAccess: true`。
- 零运行时依赖。不 import `react`、`react-native`、`expo-*`、DOM 类型。
- 测试专用 devDependency：`fast-check`（守恒不变量的属性测试，只在 `*.test.ts` 中 import）。
- 不使用 `Date.now()`、`Math.random()`；需要随机时由调用方传入 `seed` 或预抽好的序列。
- 作为 Expo 工程内的 `src/core/` 目录存在，不单独发包（单应用，monorepo 是过度设计）。

## Commands

工程初始化后（见 Boundaries：初始化本身要先问）：

```
Test (本模块):  pnpm test:core              # = jest src/core（快速；pnpm 10 会把 `--` 原样传给 jest，不要加）
Test (门禁):    pnpm test:gate              # = jest --coverage，core + content 各 95% 阈值
Test (watch):   pnpm test --watch src/core
Typecheck:      pnpm typecheck            # tsc --noEmit
Lint:           pnpm lint src/core          # expo lint 引导待开放网络，见 tasks/plan.md
Purity:         pnpm lint:purity            # src/core src/content，见 Success Criteria 2
```

## Project Structure

```
src/core/
  ids.ts              branded UnitId / GroupId / QuestionId 与工厂
  grid.ts             Cell、边界、4 邻接、平移归一化
  inventory.ts        Unit、Tray、Bench；库存守恒不变量
  clusters.ts         连通分量（按边相邻）
  shapes.ts           模板归一化、旋转 / 镜像变换、等价判断
  groups.ts           整组握把：组身份、整组平移、合体（身份并集）
  state.ts            BenchState 聚合 + assertInvariants
  commands.ts         命令 reducer（take / move / return / moveGroup）+ undo 栈
  judge.ts            Question 联合类型 + judge() → Verdict
  counting.ts         点数轮次与失效
  index.ts            公开 API（只从这里 export）
  *.test.ts           与源文件同目录
```

## Domain Model

```ts
// ids.ts
export type UnitId = string & { readonly __brand: 'UnitId' };
export type GroupId = string & { readonly __brand: 'GroupId' };

// grid.ts
export interface Cell { readonly x: number; readonly y: number }   // 整数格
export interface Bounds { readonly cols: number; readonly rows: number }
// 相邻 = 共享一条边（4 邻接）。对角不算相邻。

// inventory.ts
export interface Unit { readonly id: UnitId; readonly hue: Hue }   // hue 只用于显示
export interface TraySlot { readonly slot: number; readonly unitId: UnitId | null }
export interface BenchState {
  readonly units: ReadonlyMap<UnitId, Unit>;          // 本题全部材料，固定
  readonly tray: ReadonlyArray<TraySlot>;              // 不在工作台上的单位待在这里
  readonly bench: ReadonlyMap<UnitId, Cell>;           // 已提交的工作台位置
  readonly groups: ReadonlyMap<GroupId, Group>;        // 第二章：可整组搬运的伙伴
  readonly bounds: Bounds;                             // 由 content 按题配置；本模块不设默认值
}
export interface Group {
  readonly id: GroupId;
  readonly unitIds: ReadonlyArray<UnitId>;             // 身份集合（已排序），合体后保留来源
  readonly shape: ReadonlyArray<Cell>;                 // 与 unitIds 同序的相对偏移（最小 x / y 为 0）：伙伴从托盘落到工作台时的身体
  readonly source: ReadonlyArray<GroupId>;             // 来源组，用于分色显示
}

// clusters.ts（派生，不存储）
export interface Cluster { readonly unitIds: ReadonlyArray<UnitId>; readonly cells: ReadonlyArray<Cell> }

// shapes.ts
export interface ShapeTemplate { readonly cells: ReadonlyArray<Cell> }      // 已归一化到原点
export interface Symmetry { readonly rotation: boolean; readonly mirror: boolean }

// judge.ts
export type Question =
  | { kind: 'quantity';        target: number }
  | { kind: 'quantity_shape';  target: number; template: ShapeTemplate; symmetry: Symmetry }
  | { kind: 'addition_exact';  operands: readonly [number, number] }
  | { kind: 'sum_composition'; sum: number; allowed: ReadonlyArray<readonly [number, number]> };
export interface Verdict {
  readonly matched: boolean;
  readonly benchCount: number;                         // 工作台真实单位数
  readonly reason: VerdictReason;                      // 给 UI 做描述性提示，不是扣分
}

// commands.ts
export type Command =
  | { type: 'take';       unitId: UnitId; to: Cell }                  // 托盘 → 工作台
  | { type: 'move';       unitId: UnitId; to: Cell }                  // 工作台内单块移动
  | { type: 'return';     unitId: UnitId }                            // 工作台 → 托盘
  | { type: 'moveGroup';  groupId: GroupId; delta: Cell }             // 整组平移
  | { type: 'takeGroup';  groupId: GroupId; origin: Cell }            // 托盘 → 工作台，整组一次落下（origin + shape）
  | { type: 'returnGroup'; groupId: GroupId };                        // 工作台 → 托盘，整组一次收回
export type Result<T> = { ok: true; value: T } | { ok: false; reason: RejectReason };
export function apply(state: BenchState, cmd: Command): Result<BenchState>;
export function undo(history: History): Result<History>;              // History = { state, past[] }

// counting.ts
export interface CountRound { readonly fingerprint: string; readonly counted: ReadonlyArray<UnitId> }
```

## 规则（每条都要有测试）

### 不变量（任何命令前后都成立）

1. 每个 `UnitId` 恰好在 `tray` 或 `bench` 之一，不在两处、不在零处（AC-03、AC-35）。
2. `bench` 中任意两块不占同一格；格子都在 `bounds` 内（AC-26）。
3. `groups` 中的 `unitIds` 两两不相交；每个组的成员要么**全部**在 `tray`、要么**全部**在 `bench`（已决问题 6）；`shape.length === unitIds.length`；在托盘中的组其 `shape` 格子互不重复。
4. 命令不改变 `units` 集合：不会多块、不会少块。

`assertInvariants(state)` 在测试里跟在每个命令后面；生产里只在 `__DEV__` 下调用。

### 命令

- 输入状态只读；成功返回新对象，失败返回 `{ ok:false, reason }` 且输入状态引用不变（AC-33 取消不丢块的基础）。
- `take` / `move` 目标格被占或越界 → 拒绝。调用方负责"无效落点回到原处"的视觉，本层不猜测替代落点。
- `move` 只移动指定单块，即使它在某个簇里（AC-34 拉开子块只移动子块）；若该块属于某个组，则脱离该组（单块 / 整组语义不混用，AC-40）。
- `take` 遇到托盘中属于某个组的单块 → 拒绝 `grouped`：托盘里的伙伴是一个整体，只能 `takeGroup` 整组出来，再用 `move` 拆（属性测试 2026-10-13 抓到的反例）。
- `takeGroup` 要求全组在托盘；目标格 = `origin + shape[i]`，任一越界或被占 → 整组拒绝。`returnGroup` 要求全组在工作台；逐块回原槽 / 第一个空槽，并把 `shape` 更新为当前相对摆位。两者都只提交一次（AC-26）。
- `defineGroup(state, id, unitIds, shape?)` 不是儿童命令，供 content 建材料：成员全在工作台时 `shape` 由当前位置推导；全在托盘时必须传 `shape`（长度不符或重复格子视为内容 bug，抛错）；一部分在托盘一部分在工作台 → 拒绝 `split-group`。
- `moveGroup` 整组平移；任一目标格被组外单位占或越界 → 整组拒绝，不部分成功（AC-26 整组只提交一次）。
- `return` 把单位放回它来自的槽位；槽位已被占时放到第一个空槽；无空槽是不变量 1 的违反，直接抛错。
- `undo` 回退最近一条**已提交**命令，不记录拖动过程；栈上限 `MAX_UNDO = 8`（可配置）。undo 不触及任何进度 / 判定结果，那是 `progress` 的事（AC-30、AC-41）。

### 簇与形状

- 簇 = 工作台上按边相邻的连通分量。拖动中的块由 UI 层暂不提交，因此本层永远只看稳定状态（AC-34 过渡中不显示簇数量由 UI 保证）。
- 模板等价：先平移归一化（最小 x、y 移到 0）；`rotation=true` 时比较 4 个 90° 旋转；`mirror=true` 时再比较各自的水平镜像；两者都关时只比平移。
- 默认 `symmetry = { rotation: true, mirror: false }`（level-progression §4：普通题允许旋转，镜像按题显式配置）。

### 判定（只在调用方提交后调用；拖动中永不调用）

| kind | matched 条件 | 明确不要求 |
|---|---|---|
| `quantity` | `benchCount === target` | 颜色、是否相接、排列（AC-21、AC-37） |
| `quantity_shape` | `benchCount === target` 且工作台单位恰好组成一个簇，其格子集合与 `template` 在 `symmetry` 下等价 | 像素对齐、特定颜色（AC-43） |
| `addition_exact [a,b]` | 存在两个**身份不同**的组 A、B，`|A|=a`、`|B|=b`（顺序无关），二者合体为一个簇，且 `benchCount === a+b` | 操作顺序；5+2 对 [3,4] 不通过（AC-45） |
| `sum_composition n` | 存在一组组，其大小多重集属于 `allowed`，合体为一个簇，`benchCount === n` | 唯一分法（AC-45） |

- `a = b`（如 2+2）必须由两个不同 `GroupId` 满足，同一组不能计两次（AC-44）。
- 加法判定只考虑成员**全部在工作台**的组；还在托盘里的伙伴不参与（demo 2026-10-13 抓到的 bug：托盘伙伴被读取工作台格子）。
- 合体 = 两组内任意单位按边相邻且都在工作台；结果组 `unitIds` 为并集，`source` 保留来源（AC-39 来源分色）。
- 操作数、和都来自身份计数，`Verdict.benchCount` 是唯一数值来源；标签、颜色、面积一律不读（AC-20、AC-40）。

### 点数轮次

- `fingerprint = sorted(bench unitIds).join()`。集合变化（增、减、换块）→ 旧轮次失效，`counted` 清空；单纯重排不变（AC-27）。
- 同一块一轮最多计一次（AC-02）。
- 部分进度与总量是两个值：`counted.length` 与 `benchCount`，由 UI 决定播报哪个（AC-28）。

## Code Style

一段示例胜过三段描述：

```ts
// src/core/commands.ts
import type { BenchState, Cell, UnitId } from './state';
import { isFree, inBounds } from './grid';

export type RejectReason = 'occupied' | 'out-of-bounds' | 'not-on-bench' | 'not-in-tray';
export type Result<T> = { ok: true; value: T } | { ok: false; reason: RejectReason };

export function take(state: BenchState, unitId: UnitId, to: Cell): Result<BenchState> {
  const slot = state.tray.find((s) => s.unitId === unitId);
  if (!slot) return { ok: false, reason: 'not-in-tray' };
  if (!inBounds(state.bounds, to)) return { ok: false, reason: 'out-of-bounds' };
  if (!isFree(state.bench, to)) return { ok: false, reason: 'occupied' };

  const bench = new Map(state.bench).set(unitId, to);
  const tray = state.tray.map((s) => (s.slot === slot.slot ? { ...s, unitId: null } : s));
  return { ok: true, value: { ...state, bench, tray } };
}
```

约定：

- 文件 kebab-case，命名导出，无 class，无默认导出；只有 `index.ts` 对外。
- 状态不可变：`ReadonlyMap` / `ReadonlyArray`；reducer 返回新对象，失败原样返回。
- 拒绝用 `Result`，不抛异常；抛异常只留给不变量被破坏（程序 bug）。
- 数值只从 `unitIds.length` 来。代码里出现 `hue`、`label`、`color` 参与算术即为 bug。
- 注释英文，解释"为什么"，不复述代码。

## Testing Strategy

- 框架：jest-expo（随工程）；测试与源文件同目录，`*.test.ts`。
- 每个测试名以 AC 编号开头，例如 `AC-37: four in a row and 2x2 both match quantity 4`。
- 必须包含的"脏"夹具（干净整数夹具证明不了规则）：
  - 4 块长条 vs 2×2 都匹配 `quantity 4`；对 `quantity_shape 2×2` 只有方阵通过。
  - 3 块转角模板：4 个旋转方向通过，3 块长条不通过；`mirror=false` 时镜像转角按配置通过 / 不通过（L 形的镜像 ≠ 旋转，必须单独测）。
  - `addition_exact [3,4]`：3+4 通过、4+3 通过、5+2 不通过（但 `benchCount` 仍报 7）。
  - `addition_exact [2,2]`：两个不同组通过；同一组复用不通过。
  - 托盘满 / 空槽复用：取出、放回、再取出，槽位与身份守恒。
  - 拒绝路径：占格、越界、整组部分越界 → 状态引用相等。
  - 整组取放：托盘里的 [5, 3, 2, 4] 四个伙伴，`takeGroup` 5 与 2 后 `addition_exact [3,4]` 报 `groups-mismatch` 且 `benchCount === 7`；`returnGroup` 后再取 3 与 4 并合体 → 通过。
  - 点数：数到第 2 块时加入第 4 块 → 轮次失效，`counted` 为空。
- 覆盖率：`src/core` 行 / 分支 ≥ 95%，低于即失败。
- 不变量：每个命令测试末尾调用 `assertInvariants`。

## Boundaries

- **Always**：纯函数、确定性、零 RN / DOM 依赖；改规则先改本 spec 再改代码；标记完成前跑 `pnpm test:gate` 与 `pnpm typecheck`。
- **Ask first**：初始化 Expo 工程（`create-expo-app`，这是本模块实现的前置步骤）；新增任何依赖（`fast-check` 已批准，其余仍需问）；改变 `index.ts` 公开 API 形状；改邻接语义（4 邻接 → 8 邻接）；改 `MAX_UNDO`。
- **Never**：任何 git 命令；从颜色 / 标签 / 面积推导数值；修改输入状态；在 core 里用 `Date.now` / `Math.random`；为了让测试过而删测试。

## Success Criteria

1. `src/core` 全部测试通过，覆盖率 ≥ 95%，`tsc --noEmit` 零错误。
2. `pnpm lint:purity` 零命中：`grep -rnE "from ['\"](react|expo|@expo|react-native)|\\b(document|window)\\b" src/core`（原稿的裸 `expo` 会命中 `export`，2026-10-13 修正为只查 import 来源与整词）。
3. 上面"规则"一节每条至少一个同名 AC 测试。
4. `content` 模块能只靠 `index.ts` 导出的类型和 `judge()` 校验题目可解（接口冻结后由 `SPEC-content.md` 验证）。
5. 一个 `demo.test.ts` 用纯命令复现可玩切片四站：1 块、2 块、2×2、转角 Boss，再用两个组做 3+4，全部 `matched: true`。

## 已决问题（2026-10-13）

| # | 问题 | 决定 |
|---|---|---|
| 1 | `quantity_shape` 是否要求工作台**全部**单位组成模板 | 是。多余单位即不匹配（规则表"恰好组成一个簇"） |
| 2 | 旋转默认开、镜像默认关作为全局默认 | 接受。与 level-progression §4 一致；镜像按题显式开 |
| 3 | `MAX_UNDO = 8` | 保留。改值需 ask first |
| 4 | 引入 `fast-check` 做守恒属性测试 | 引入。仅 devDependency，仅测试文件 import |
| 5 | `bounds` 由 `content` 按题配置，core 不设默认 | 同意。`BenchState.bounds` 为必填 |
| 6 | 第二章托盘里的整组伙伴如何一次搬上工作台（2026-10-13 实现中发现，见 D-027） | `Group` 加 `shape`；不变量 3 放宽为"全在托盘或全在工作台"；新增 `takeGroup` / `returnGroup` 命令；`move` 组内单块即脱组 |

以上为用户回复"开始"时按建议默认采纳；任一条改动都是一行编辑，改前先更新本表。
