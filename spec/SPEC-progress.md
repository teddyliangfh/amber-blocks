# Spec: progress

模块 id：`progress`（见 [CAPABILITY-MAP](CAPABILITY-MAP.md)）  
日期：2026-10-13  
状态：已审（2026-10-13，见 D-029），并已实现于 `src/progress/`（2026-10-13：17 个测试，Success Criteria 1–3 达成）。2026-10-14 依据实现审查补存储可靠性：局部修复解码、`sanitize`、`loadArchive`、`createSaver`、`resetNode`（见"存档"与已决问题 7、8）。6 个 Open Questions 按建议采纳，记录在文末"已决问题"。任务见 [tasks/plan.md](../tasks/plan.md) Task 18–21。

依赖：`content`（只经 `src/content/index.ts`）、`math-core`（只经 `src/core/index.ts`，取 `BenchState` / `Verdict` 类型）。消费者：`screens`（地图页、关卡页、家长区）、`blocks-ui`（取当前站的稳定作品）。

## Objective

记住"孩子走到哪了、每一站留下了什么、用哪种语言"，并让它在刷新 / 关闭浏览器后还在。它是一个纯 TS 的状态机 + 序列化编解码 + 一个存储端口；**不**判题（判题是 core 的事）、**不**出题（content 的事）、**不**知道屏幕。

它回答且只回答：

- 这一站是未到达、可开始、作答中还是已完成（AC-41）。
- 这一站上次提交后的稳定作品是什么（AC-42、AC-47）。
- 完成只记一次；重玩、撤销、切语言都不改历史完成集合（AC-41、AC-18）。
- 内容升级后旧进度怎么办（AC-47）。

成功的样子：`screens` 只用 `index.ts` 的 reducer 与查询函数就能画出地图与关卡页，所有规则在不起 RN、不起浏览器的情况下测完。

## Tech Stack

- TypeScript，`strict` + `noUncheckedIndexedAccess`（随工程）。
- 零运行时依赖；只 import `../core` 与 `../content`。不 import `react`、`react-native`、`expo-*`、DOM、`@react-native-async-storage/*`。
- 存储是一个端口 `ProgressStorage { getItem / setItem / removeItem }`（async，与 AsyncStorage 同形）；本模块提供 `memoryStorage()`。真正的 AsyncStorage 绑定（web 自动落 localStorage）放在 `screens` 模块，那里本来就是 RN 代码。
- 不使用 `Date.now()`、`Math.random()`。设备 seed 由调用方在首次创建时传入。

## Commands

```
Test:     pnpm test:progress            # = jest src/progress
Gate:     pnpm test:gate                # 三个目录各 95% 阈值
Typecheck pnpm typecheck
Purity:   pnpm lint:purity              # 扩到 src/progress，并加 @react-native-async-storage 到禁用列表
```

## Project Structure

```
src/progress/
  schema.ts         ProgressState、NodeProgress、NodeStatus、ProgressStorage
  unlock.ts         解锁规则与状态派生：statusOf、nextNodeOf、chapterCompletion
  reducer.ts        命令：enter / saveWork / complete / replay / newVariant / setLanguage
  codec.ts          serialize / deserialize（Map / Set / BenchState ↔ JSON），含 schemaVersion
  migrate.ts        contentVersion 升级策略
  store.ts          load(storage) / save(storage, state) / memoryStorage()
  index.ts          公开 API
  *.test.ts
```

## Domain Model

```ts
// schema.ts
export type NodeStatus = 'locked' | 'available' | 'in-progress' | 'completed';

export interface NodeProgress {
  readonly ref: PuzzleRef;                    // 进站时固定；换语言 / 回地图不变
  readonly work: BenchState | null;           // 最近一次提交后的稳定状态；null = 还没动过
}

export interface ProgressState {
  readonly schemaVersion: 1;                  // 本模块自己的存档格式版本
  readonly contentVersion: number;            // 存档对应的内容版本
  readonly seed: number;                      // 设备级，创建时一次性给定
  readonly language: Lang;                    // 默认 'zh'（D-022）
  readonly completedNodeIds: ReadonlySet<NodeId>;
  readonly current: NodeId | null;            // 孩子现在站在哪；null = 还没进过任何站
  readonly nodes: ReadonlyMap<NodeId, NodeProgress>;   // 只含进过的站
}

export interface ProgressStorage {
  readonly getItem: (key: string) => Promise<string | null>;
  readonly setItem: (key: string, value: string) => Promise<void>;
  readonly removeItem: (key: string) => Promise<void>;
}

// reducer.ts
export type ProgressCommand =
  | { type: 'enter';       nodeId: NodeId }                       // 进站：建 ref（variant 0），设 current
  | { type: 'saveWork';    nodeId: NodeId; work: BenchState }     // 每次 core commit 后由 UI 调用
  | { type: 'complete';    nodeId: NodeId; verdict: Verdict }     // 只有 verdict.matched 才生效
  | { type: 'replay';      nodeId: NodeId }                       // 已完成站重玩：作品清空，完成记录不变
  | { type: 'newVariant';  nodeId: NodeId }                       // attemptVariant + 1，作品清空（M2 不暴露给孩子）
  | { type: 'resetNode';   nodeId: NodeId }                       // 恢复入口：忘掉该站 ref 与作品，完成记录不变（2026-10-14）
  | { type: 'setLanguage'; language: Lang };
export type ProgressReject = 'locked' | 'not-entered' | 'not-matched' | 'not-completed' | 'unknown-node';
export function reduce(state: ProgressState, cmd: ProgressCommand, chapters = CHAPTERS): Result<ProgressState, ProgressReject>;

// unlock.ts
export function statusOf(state: ProgressState, nodeId: NodeId, chapters = CHAPTERS): NodeStatus;
export function nextNodeOf(nodeId: NodeId, chapters = CHAPTERS): NodeId | null;      // 地图次序的下一站（跨章）
export function chapterCompletion(state, chapterId, chapters = CHAPTERS): { done: number; total: number };
export function defaultCurrent(state, chapters = CHAPTERS): NodeId;                  // current 为 null 时：第一个 available

// codec.ts / migrate.ts / store.ts
export function serialize(state: ProgressState): string;
export function decodeArchive(json: string): { state: ProgressState; repairs: string[] } | null; // 头部坏 → null；节点局部修复
export function deserialize(json: string): ProgressState | null;                     // = decodeArchive(json)?.state ?? null
export function sanitize(state: ProgressState): { state: ProgressState; repairs: string[] };   // ref / 作品与当前题库一致性
export function migrate(stored: ProgressState, contentVersion: number, chapters = CHAPTERS): ProgressState;
export function createInitialState(seed: number, contentVersion = CONTENT_VERSION): ProgressState;
export const STORAGE_KEY = 'amber-blocks/progress';
export const BACKUP_KEY = 'amber-blocks/progress.corrupt';
export function loadArchive(storage: ProgressStorage, seed: number): Promise<Loaded>; // 永不 reject；Loaded = { state, issue, repairs, persist }
export function load(storage: ProgressStorage, seed: number): Promise<ProgressState>;   // = loadArchive(...).state
export function save(storage: ProgressStorage, state: ProgressState): Promise<void>;
export function createSaver(storage: ProgressStorage, onResult?: (r: SaveResult) => void): Saver; // 单写入者：save / reset / idle
export function memoryStorage(): ProgressStorage;
```

## 规则（每条都要有测试）

### 解锁与状态（AC-41、AC-46）

- 地图次序 = `CHAPTERS` 里章的顺序 × 章内 `nodes` 顺序。
- 第 1 章第 1 站始终解锁；其余站解锁条件：地图次序上的前一站 `completed`。章末 Boss 完成即开下一章第 1 站；不做家长跳章（M2）。
- `statusOf`：在 `completedNodeIds` → `completed`；否则进过（`nodes` 有记录）→ `in-progress`；否则解锁 → `available`；否则 `locked`。
- 解锁只看 `completedNodeIds`，不看作品、不看 `current`：预览 / 动画 / 半成品都解不开锁。

### 命令

- `enter`：`locked` → 拒绝；未进过 → 新建 `NodeProgress { ref: { contentVersion, chapterId, nodeId, attemptVariant: 0, seed }, work: null }`；已进过 → 只设 `current`，`ref` 与 `work` 原样（AC-42 未完成回来保持原题）。
- `saveWork`：未进过 → 拒绝；覆盖 `work`。只允许存稳定状态：调用方负责在 core `commit` 成功后调用，拖动中永远不调用；本模块不存 `History`，撤销栈不跨恢复（AC-30、AC-31）。
- `complete`：`verdict.matched === false` → 拒绝 `not-matched`；未进过 → 拒绝；已在集合里 → 返回**同一引用**（幂等，AC-41）；否则加入集合。不改 `work`，不改 `current`。
- `replay`：不在集合里 → 拒绝 `not-completed`；清空 `work`（`null`），`ref` 不变，集合不变，`current` 设为该站。
- `newVariant`：`ref.attemptVariant + 1`，`work` 清空；完成集合不变。M2 的 UI 不暴露此命令（D-028 决议 6），但代码与测试保留。
- `resetNode`（2026-10-14，恢复入口）：删除该站的 `NodeProgress`（ref 与作品），完成集合、`current` 不变；没进过 → 返回同一引用。下次 `enter` 按当前题库新建 ref。只给"这一站打不开"的恢复界面用。
- `setLanguage`：只改 `language`；`nodes`、`current`、集合一律不动（AC-18、AC-42）。
- 所有命令：输入不可变；拒绝时返回 `{ ok:false, reason }`，输入引用不变。

### 存档（AC-47）

- `serialize`：确定性 JSON（键按固定顺序，`Set` / `Map` 转排序数组，`BenchState` 的 `units` / `bench` / `groups` / `home` 转 entries）。`deserialize(serialize(s))` 深度相等。
- `decodeArchive` / `deserialize`（2026-10-14 改为局部修复）：JSON 解析失败、`schemaVersion` 不是 1、`contentVersion` 或 `seed` 不是有限数 → `null`，不抛。头部完好时损坏只影响局部：语言非法 → `zh`；`completedNodeIds` 里的非字符串项丢掉；`current` 非法 → `null`；某站 ref 结构坏 → 丢该站；某站作品结构坏或违反 core 不变量 → 该站保留 ref、作品置 `null`。每处修复记一条 `repairs`。
- `sanitize`（2026-10-14，迁移之后执行）：未知站、未知完成记录、未知 `current` 丢掉；`ref.nodeId` 与 key 不一致、`ref.chapterId` 不是该站所在章、`ref.contentVersion` 不是存档版本、`attemptVariant` 不是非负整数、`materialize(ref)` 抛错 → 丢该站；作品材料与 `materialize(ref).initial` 不符（bounds、单位 id 与 hue、托盘长度、home、组只能是本站伙伴或其子集）→ 保留 ref、作品置 `null`。无修复时返回同一引用。
- `migrate`（2026-10-14 改为按站，D-034）：返回 `{ state, setAside }`。`stored.contentVersion === contentVersion` → 原样返回同一引用；否则保留仍存在于目录中的 `completedNodeIds`，`contentVersion` 改为当前，再看 `CONTENT_CHANGES`（content 导出，每个版本列出它改了哪些站）从存档版本到当前版本是否每一步都有记录：
  - 能识别：每站 ref 的 `contentVersion` 改为当前（ref 与存档头不一致的不动，留给 `sanitize` 当损坏丢掉）；没变的站作品原样；变了的站作品与新材料（`materialize` 后 `sameMaterial`）一致才保留，否则作品置 `null`、ref 保留，记入 `setAside`；已不在目录里的变化站整站去掉并记入 `setAside`；`current` 保留（未知的由 `sanitize` 清掉），只有一个例外（Phase 19，D-070）：`current` 是已完成的站、它的下一站没完成时，`current` 移到下一站（"下一站"本来会把孩子带到那里）——内容版本 6 在合体岛最后加了 ch2-n8，全通的 v5 存档升级后地图停在 8 站。
  - v5 → v6（Phase 19）：`CONTENT_CHANGES[6] = [ch2-n5, ch2-n6, ch2-n7]`（改为"还差谁"）；新站 ch2-n8 不登记——旧存档里不可能有它的作品，没有可迁移的东西。三站的完成记录按站号保留；旧作品（3 + 2 / 4 + 1 / 3 + 4）与新材料不符就收起，作品册旧图保留（D-048）；托盘恰好洗成同样顺序的种子（约十分之一，例如 4242 的 7 站、3 的 6 站）旧作品照 D-034 原样保留——7 站的 3 + 4 仍然是对的，6 站的 4 + 1 不是 6，打开时是"回地图"（列入"需要 Ted 决定"）。全通的 v5 存档：ch2-n8 可进且是当前站，合体岛 7 / 8，奖杯与彩旗不显示，`/island/ch2` 回地图，打完 8 站恢复。
  - 不能识别（更新的构建写的、或某一步没登记）：只保留完成记录，清空 `nodes`、`current` 置 `null`，有作品的站记入 `setAside`。
- `loadArchive`：读取失败（reject 或同步抛错）→ 新档，`issue: 'read-failed'`，`persist: false`（不写，免得一次读失败覆盖好存档）；无存档 → 新档；头部坏 → 原串写 `BACKUP_KEY`（写失败忽略）后新档，`issue: 'corrupt'`；否则 `decodeArchive` → `migrate` → `sanitize`，有修复则备份原串到 `BACKUP_KEY` 并 `issue: 'repaired'`；`migrate` 收起了作品则原串另存 `UPGRADE_BACKUP_KEY`（`amber-blocks/progress.before-upgrade`），没有修复时 `issue: 'upgraded'`；`Loaded.upgraded` 列出被收起的站，供家长区显示。`load` 是它的 `.state`；两者都不 reject。`save` 只写 `serialize(state)`。2026-10-16（测评 K-1，D-057）：`issue` 为 `upgraded` 或 `repaired` 时，界面层（`screens/progress-store.tsx`）读完立刻经同一个 saver 写回一次，下次打开读到的就是当前版本、不再重复升级 / 修复（原串已在备份键里）；干净的存档读完不写。
- `createSaver`：唯一写入者，严格顺序。连续 `save` 合并为一次写最新状态，任何时刻最多一个写入在途，旧状态不可能晚于新状态落盘。写失败只经 `onResult` 报告，不 reject，下一次 `save` 照常重试。`reset(fresh)`：丢弃尚未开始的旧写入，等在途写入结束后 `removeItem` 再写 `fresh`，之后的 `save` 排在它后面（不会被吞）。`idle()` 在队列清空后 resolve。
- 存档只含稳定内容：`ref`、`work`、完成集合、语言、seed、版本。不含 `History`、拖动中间态、待播语音。

## Code Style

```ts
// src/progress/reducer.ts
export function reduce(state: ProgressState, cmd: ProgressCommand, chapters = CHAPTERS): Result<ProgressState, ProgressReject> {
  switch (cmd.type) {
    case 'complete': {
      if (!cmd.verdict.matched) return reject('not-matched');
      if (!state.nodes.has(cmd.nodeId)) return reject('not-entered');
      if (state.completedNodeIds.has(cmd.nodeId)) return { ok: true, value: state };   // idempotent: same reference
      const completedNodeIds = new Set(state.completedNodeIds).add(cmd.nodeId);
      return { ok: true, value: { ...state, completedNodeIds } };
    }
    // ...
  }
}
```

约定同前两模块：kebab-case、命名导出、无 class、只有 `index.ts` 对外、`Result` 不抛、注释英文说"为什么"。`Result` 这里带第二个泛型 `Result<T, R>` 以区分 core 的 `RejectReason`；若 core 的 `Result` 不便复用，本模块自定义同形类型。

## Testing Strategy

- jest-expo，同目录 `*.test.ts`，测试名以 AC 编号开头。
- 必含夹具：
  - 新档：`ch1-n1` available，其余 locked；`current` null，`defaultCurrent` = `ch1-n1`。
  - 顺序解锁：完成 n1 → n2 available，n3 仍 locked；完成 n4（Boss）→ `ch2-n1` available。
  - 幂等：对同一站 `complete` 两次，第二次返回同一引用；`chapterCompletion.done` 不变。
  - 假完成：`verdict.matched=false` 被拒绝；只存作品不完成 → 下一站仍 locked。
  - 重玩不倒退：n1、n2 完成后 `replay` n1 → n1 仍 completed，n2 状态不变，n1 `work` 为 null。
  - 作品保留：n1 `saveWork` 后 `enter` n2 再 `enter` n1 → `work` 与 `ref` 引用相等；`setLanguage` 后同样。
  - `newVariant`：`attemptVariant` 递增、`work` 清空、完成集合不变。
  - 编解码：含一个真实 `BenchState`（取自 `materialize` 后跑一半参考解）的状态 round-trip 深度相等；坏 JSON / 错 schemaVersion / 缺字段 → null。
  - 迁移：旧版本存档含 `ch1-n2`（仍存在）与 `ch9-n9`（不存在）→ 保留前者、丢后者、`nodes` 清空、版本更新；同版本 → 同一引用。
  - store：`memoryStorage` 上 `save` 再 `load` 相等；坏串 `load` → 新档且 `BACKUP_KEY` 有原串。
  - 内容升级（`upgrade.test.ts`，2026-10-14）：用 Phase 11 构建真实写出的 v1 存档夹具（`__fixtures__/`，冻结，不要用现有代码重生成）：10 站未完成作品 → 收起、`issue: 'upgraded'`、完成记录全在、原串进 `UPGRADE_BACKUP_KEY` 而非损坏备份、未变的 9 站作品原样；第一岛全部完成（10 / 17 有旧作品、合体岛 4 站半成品）→ 15 站都仍完成、10 / 17 新题、合体岛作品与托盘顺序不变；已发诱饵的构建写的 v1 存档 → 作品全保留；升级后保存再读不再报告；更新构建写的存档 → 只留完成记录；ref 与存档头不一致仍按损坏处理。
  - 可靠性（`reliability.test.ts`，2026-10-14）：读 reject / 同步抛错 → 内存模式；备份写失败仍可加载；审查复现（单站 `ref.contentVersion = 999`）→ 只丢该站，完成与语言保留；key / ref 不一致、外站作品、未知站；saver 乱序不可能（在途 + 合并）、写失败不 reject 且恢复、reset 等在途写入并丢弃排队旧状态、reset 后的新写入不被吞、reset 失败上报；`resetNode`。
- 覆盖率：`src/progress` ≥ 95%。

## Boundaries

- **Always**：纯函数、确定性；改规则先改本 spec；完成前跑 `pnpm test:gate` 与 `pnpm typecheck`。
- **Ask first**：改 `ProgressState` / `ProgressCommand` 形状；改 `STORAGE_KEY`；改迁移策略；加家长跳章；新增依赖。
- **Never**：git；在本模块里判题或出题；存 `History` / 拖动中间态；读 `hue` / 标签做任何决定；`Date.now` / `Math.random`。

## Success Criteria

1. `src/progress` 测试全过，覆盖率 ≥ 95%，`tsc --noEmit` 零错误，`pnpm lint:purity` 零命中。
2. 规则一节每条至少一个同名测试。
3. 一个 `demo.test.ts`：用 `materialize` + core 参考解 + `complete(verdict)` 把 M2 五站顺序打通，期间 `serialize` / `deserialize` 一次、`setLanguage` 一次，最后 `ch2-n1` completed、`chapterCompletion(ch1) = 4/4`。
4. `screens` 只靠 `index.ts` 就能写它的 spec（接口冻结后由 `SPEC-screens.md` 验证）。

## 已决问题（2026-10-13）

| # | 问题 | 决定 |
|---|---|---|
| 1 | AsyncStorage 绑定位置 | 放 `screens`；本模块只留端口 + 内存实现 |
| 2 | 内容升级策略 | 保留仍存在的完成记录；2026-10-14 细化为按站（D-034）：没变的站作品保留，变了的站作品对不上新材料才收起，并备份、在家长区列出 |
| 3 | 重玩已完成站 | 清空作品，`attemptVariant` 不变 |
| 4 | 坏存档 | 备份到 `BACKUP_KEY` 后新建，不弹错 |
| 5 | 家长跳章 | M2 不做，只顺序解锁 |
| 6 | `current` 为 null | 地图停在第一个 available 站 |
| 7 | 存储读写失败（2026-10-14 审查） | 读失败进入内存模式且不写；写失败只在家长区提示；所有写入经单一顺序队列；reset 与在途写入协调 |
| 8 | 存档语义校验（2026-10-14 审查） | 头部完好则局部修复：坏站丢弃或只丢作品，保留合法完成记录与语言；原串备份 |
