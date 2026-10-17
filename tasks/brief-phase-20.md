# Brief · Phase 20：质量 + 招牌时刻（给开发 agent）

> 来源：[docs/play-review-2026-10-18.md](../docs/play-review-2026-10-18.md)（第五轮试玩测评）第 2、3、5 节"第 1 批"。本 brief 只做第 1 批；第 2、3 批（Boss 花样、数字性格、换一题、新岛）**不在本轮范围**。

## 你的角色与目标

你是 Amber Blocks（给一位四岁、还不识字的孩子做的中英双语数学积木游戏，Expo SDK 58 + React Native Web，手机网页优先）的开发 agent。本轮目标：**修掉试玩里最影响孩子的质量问题，并做出全作的招牌时刻"合体变身"**。完成后孩子应该能感到：

- 拼对后不会"先庆祝、再被收回"；
- 求助是一级一级来的，不是一上来就报答案；
- 两个伙伴接上以后，会变成一个新的数字角色；
- 点什么都有回应；
- 最终 Boss 可以把两种拼法并排摆着。

## 开工前必读

1. `AGENTS.md`（Expo 规则：动到 Expo / RN API 前，先查 `https://docs.expo.dev/versions/v58.0.0/` 对应页面，不凭记忆写）。
2. `docs/play-review-2026-10-18.md` 第 2、3 节：每一项的问题、建议、落点都在里面。
3. `docs/discussion-and-decisions.md` 最后 15 条（D-059 至 D-073），尤其 D-035 / D-036（语音只在点击时说）、D-063 / D-064、D-068 / D-069 / D-071（还差谁、两种拼法）、D-072 / D-073。
4. `tasks/todo.md` 末尾的 Phase 19、D-072、D-073 记录：了解写法和门禁格式。
5. 代码地图：
   - 判题 `src/core/judge.ts`（纯函数，本轮**不改**）。
   - 关卡会话 `src/screens/level-session.ts` 和 `src/content/steps.ts`。
   - 提示 `src/screens/hints.ts`；纠错语音 `src/screens/correction-voice.ts`。
   - 关卡页 `src/screens/LevelScreen.tsx`；舞台 `src/blocks-ui/Stage.tsx`、`layout.ts`、`juice.ts`、`Block.tsx`、`PartnerView.tsx`。
   - 文案 `src/content/copy.ts`（所有中英句子都在这一张表）；音效 `src/audio-i18n/sfx.ts`。
   - 其他页面：`src/screens/{IslandDoneScreen,ParentScreen,SandboxScreen,MapScreen,ui,icons}.tsx`；存档 `src/progress/store.ts`。

## 硬约束

- **不执行任何 git 命令**（不 add、不 commit、不 stash、不 checkout、不 push）。Ted 自己做 git。工作区里已有未提交的 D-072 / D-073 改动，要在它们之上继续改，**不能回退**。
- 不加新依赖，不改 `package.json`。
- core（`src/core`）、content、progress 保持纯净：`pnpm lint:purity` 必须零命中。`judge.ts` 不改。
- 存档 `schemaVersion` 不变，不加存档字段；`CONTENT_VERSION` 保持 6，本轮不改 catalog。
- 不加任何自动语音：新句子只在孩子点按时说（D-036）。音效可以加。
- 每个"还没拍板的产品取舍"都放进**一个命名常量**，配一行文档注释，写上默认值和改法；下面已列出默认值。
- 外科式改动：没被任务点到的代码保持原样；顺手发现的问题记进 todo 的"已知遗留"，不要顺手修。
- 尊重减少动效：新动画都要有 `reduced` 分支，只用透明度或颜色，不做位移和缩放。

## 任务（按顺序做，每个小节结束跑一次门禁）

### 20-1 判题与反馈（先做，都是 S，只有 1 是 M）

1. **两种拼法可以并排**（报告 Q1）
   - 在 `level-session.ts` 里加一层：`step ≥ 1` 时，先从台面剔除"恰好由某个 `used` 拼法组成、两个伙伴已接好、自成一簇"的那部分，再用 `questionAt` 判剩下的部分。core 不动。`sameWayAgain` 和求助也走同一份"剔除后的台面"。
   - "先把第一对送回再拼"仍然要被接受。
   - 过关时云朵显示两行：`3 + 4 = 7` / `5 + 2 = 7`。作品册存的就是两种并排的台面，自然包含两种。
   - `startSession` 从存档推断步骤时也用同一个函数，这样刷新后第一种不会丢。
   - ways 语境下的求助不再说"再找 5 和 2"引孩子去堆叠，改成"在旁边再拼一个 7"（新 copy key）。
   - 测试（`level-session.test.ts`）：两对并排且互不相贴时判 matched；两对贴成 14 块一簇时仍判"多了"；送回第一对再拼也 matched；刷新推断。
2. **庆祝分两拍**（Q2）：常量 `SOLVE_SETTLE_MS = 600`（`LevelScreen.tsx`）。落下即判对时，立刻给 success 音和笑脸；彩纸、专属动作、"下一站"淡入延后 `SOLVE_SETTLE_MS`。期间 `onDragActive(true)` 就取消第二拍。完成记录和解锁保持即时派发。相应调整 `LevelScreen.test.web.tsx` / `LevelScreen.sound.test.web.tsx` 里"立即庆祝"的断言（用 fake timers）。
3. **求助逐级升**（Q3）：同一个答案状态下，按点卡片或"帮助"的次数升级。答案一变就清零（沿用现有 `helpLevel` 清零机制）。
   - 第 1 下：说第一级句子（f.detail），并点亮相关积木。数量不对时，自动给台面上的块依次亮出数字标签（复用点数标签和 count 音，不念数词）。
   - 第 2 下：只点名要送回的（`hint.send`）。
   - 第 3 下：现有完整句（`hint.swap.pair` / `hint.bring`）。
   - 常量 `HELP_LADDER_STEPS = 3`；设成 1 等于现状（第一下就给完整句）。
   - 17 Boss 空台求助：除了重复题目，再说"先搬最大的伙伴"，并点亮最大的那个。
   - `hints.test.ts` 的属性测试"照着帮助做总能完成"必须继续成立。
4. **求助语音不被掐断**（Q4）：`correction-voice.ts` 的 speaker 回调返回 boolean，只有真的出声时才写 `spokenSig`；LevelScreen 的 speaker 返回 `AUTO_SPEECH.correction`。孩子做完被点名的"送回"后，保持对"要拿的那个"的点亮，直到下一次提交。`LevelScreen.sound.test.web.tsx` 补一个用例：正式策略下，求助后做第一步，不触发 `stop`。
5. **自由和 Boss 不报差数**（Q5）：`hints.ts:92` 的条件改为 `fewer && (puzzle.given !== undefined || q.kind === 'sum_composition')`，并更新 hints 测试。
6. **看到的 = 听到的**（Q6）：
   - 散块少了时，正文与标题一致（差 > 1 时不再说"再拿一块"）。
   - 成功时点卡片：先念 matched 句，再念卡片正文，或者两者统一成同一句，二选一，以"念出来的就是写着的"为准。
   - 新增单数 key，修掉英文的 "one. one blocks"；"Let us find" 改成 "Let's find"；家长区"语音语言"改成"语言 / Language"；英文菜单 close 改成 "Keep playing"。
7. **承认孩子的发现**（报告 F5）：
   - groups-mismatch 且台上两个相贴伙伴之和等于目标时：tone 改成 `'building'`（蓝卡，不响 adjust 音，不出困惑脸），标题用新 key"{x} 加 {y} 也是 {n}！"，正文"再找 {a} 和 {b}"，复用两种拼法第一步的小庆祝（stepHop）。
   - quantity / quantity_shape 过关、台上有 ≥ 2 个部分（伙伴或散块簇）时，matched 句从左到右列出部分："5、3 和 1，一共 9 块" / "5, 3 and 1, 9 in all"。
   - 两步守恒站（ch1-n6）最后一步过关句改成"变了样子，还是 {n} 块"。

### 20-2 界面与手感（都是 S）

8. **菜单和底栏加图标**（Q7）：`PillButton` 加可选 `icon?: IconName`。菜单对应：继续 = play，帮助 = 新画的 bulb，撤销 = undo，重新挑战 = again，回地图 = map。底栏：下一站 = play，回地图 = map，岛完成 = star（新画）。顺手把 `AnswerFeedback.tsx` 的 💡 emoji 换成 bulb 图标。新图标照 `icons.tsx` 现有的手绘风格。
9. **↻ 不再一图两义**（Q8）："再数一遍"换成新的 `count` 图标（一根手指加三个小点）。"再玩一次"清空前，如果当前答案是对的，就把它压进撤销历史，撤销能拿回来。
10. **岛收尾页防连点**（Q9）：`IslandDoneScreen` 按钮打开后 800ms 内不响应（照 `MapScreen` 的 `openedAt + SKIP_AFTER_MS` 写法，常量单独命名）。地图奖杯改成可点，进入 `/island/ch2`。
11. **家长区清空更安全**（Q10）："清空"改成普通样式，"取消"改为 accent；确认按钮放到提示文字下方，与"重置进度"间距 ≥ 60px。清空前把原串写进 `amber-blocks/progress.before-reset`（照 `store.ts` 的 `backup()`）；本次留在家长区期间显示"撤销清空"。不改存档 schema。
12. **点托盘里的角色有回应**（Q11）：托盘里的单块或伙伴被点时，小跳一下，念自己的数词（单块念"一"，伙伴念自己的数）。不计入点数，不影响判题。要保证和拖动不冲突（`use-draggable` 的 6px 阈值已经把点和拖分开）。
13. **落点就近吸附**（Q12）：单块或伙伴落在被占的格子上时，在 1 格范围内找可放的位置；伙伴优先选能贴住台上已有伙伴的位置。找不到才弹回。改动只在 `Stage.tsx` 的 `dropUnit` / `dropPartner` 和 `layout.ts` 附近，core 不动。`layout.test.ts` 补用例。
14. **小修**（Q14、Q15）：
    - `+html.tsx` 内联天空色 + 标题的纯 CSS 占位，消除冷启动白屏。
    - `+html.tsx` 加 `<meta name="robots" content="noindex, nofollow">`；`vercel.json` 加 `X-Robots-Tag: noindex`。两处用同一条注释说明，以后公开时删掉。
    - 菜单 `accessibilityLabel` 改为走 MENU 表的"菜单 / Menu"。
    - 地图 ⚙ 改成 `<ParentGate muted …>`，并删掉 `styles.parentButton` 的 opacity，与 D-073 的菜单做法一致。
    - README"已知缺口 / 下一步"里"未部署 Vercel"的说法改成已部署。

### 20-3 招牌时刻（M）

15. **合体变身**（报告 F1，本轮最重要的一项）
    - 常量 `MERGE_ON: 'success' | 'touch' = 'success'`，写在 `blocks-ui`，配文档注释。
    - 答对时（`'success'`），对工作台上每个"含伙伴的簇"：接缝先亮约 220ms，两张脸对视眨一下眼，然后整簇渲染成一个角色：颜色 `hueFor(簇总数)`；握把底板合成一块；只在头格留一张笑脸；一个徽章写总数。接着做这个数字的过关动作（复用 `useCheer`）。
    - 纯展示派生：单位身份、存档、判题都不变（PRD §4.3"合体保留同一批单位身份"）。可以用 core 现成但还没有调用方的 `mergedGroup` 或簇信息派生。
    - 拖走其中任何一个伙伴，立刻按同样的渐变分回原色、原脸、原徽章。
    - quantity 站分开摆的块不强行聚拢，只有接在一起的簇才变。
    - 作品册（`WorkPicture`）和岛收尾页的 Boss 作品用同一套"合体后"的渲染。8 砖要显示成一个青色的 8。
    - 减少动效：没有闪和眨眼，直接换色。
    - 新增 `join` 音效（`sfx.ts`）：依次响 `countPitch(a)`、`countPitch(b)`，再响 `countPitch(a+b)` 叠一层泛音，和变身同步。`sfx.test.ts` 补断言。
16. **自由玩冒数字**（报告 F6 第一条）：沙盒里每次落下后，如果某个簇大小变了，这个簇的头块上方冒一个 0.8 秒的数字气泡（和伙伴徽章同一个样式），同时响 `join` 音。拆开时两个簇各冒一次。不说话。

## 不做（留给下一轮或等 Ted）

- "还差谁"站示范手的改动（D-068，等 Ted 拍板）。
- 8 列工作台边距、17 站小屏块尺寸、3 号黄、成功绿（上轮待定项）。
- `COUNT_TO_PASS`、自动读题开关、离线壳、正式图标美术。
- 任何 catalog / 内容版本变更：Boss 花样、新站、新岛、换一题、伙伴图鉴、故事站。

## 测试与门禁

- 先写或改测试，再改实现。凡是**改了期望的旧测试，逐条列在 todo 里**，写明为什么改（照 Phase 19"改了期望的旧测试（逐条）"的格式）。
- 每个小节（20-1 / 20-2 / 20-3）结束都跑：`pnpm lint`、`pnpm typecheck`、`pnpm lint:purity`、`pnpm test:gate`（覆盖率门禁不能降）、`pnpm build:web`。最后一次的数字记进 todo。
- **浏览器实测**（真实流程，不只看测试）：用内建浏览器 `preview_start {name: "expo-web"}`。从清空 localStorage 的新存档开始，视口 375×812 为主，再抽查 360×640 和 667×331 横屏。必须走到的流程：
  - ch1-n2 多拖一块：庆祝不先出现再被收回；
  - ch1-n5、ch2-n5 连点卡片三下：三级求助；
  - ch2-n1：1+1 合体变成一个橙色的 2；
  - ch1-n8：砖变成一个青色的 8；
  - ch2-n8：两种拼法并排过关，云朵两行；
  - 岛收尾页连点：不会被跳过；
  - 家长区清空后撤销；
  - 沙盒连块：冒数字；
  - 英文模式抽一站。

  控制台 0 error。关键截图存 `docs/review-assets/p20-*.png`。

## 交付时更新这些文档

- `docs/discussion-and-decisions.md`：从 D-074 起，每个行为变更一条（两种拼法并排、庆祝两拍、求助阶梯、合体变身、就近吸附、清空备份……），写清修订了哪条旧决定。
- `tasks/todo.md`：新增"Phase 20"一节，照 Phase 19 的格式写：每项勾选、改了期望的旧测试、门禁数字、浏览器走查、"需要 Ted 决定"、"只能真机确认"。
- `spec/SPEC-screens.md`（以及受影响的 `SPEC-blocks-ui.md`）：同步行为描述。
- `README.md`"当前实现"：同步玩法描述。

## 完成的标准

- 第 20-1 至 20-3 节的 16 项都已实现，或明确写了"没做 + 原因"。
- 门禁全绿，浏览器走查清单全部有截图。
- 最后给 Ted 的汇报要简短：改了什么、哪些常量是待拍板的默认值、哪些只能真机确认、没做什么。不要提交，也不要执行 git。
