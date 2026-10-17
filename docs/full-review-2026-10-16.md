# Amber Blocks · 全方位测评（第四轮，2026-10-15 → 2026-10-16）

只评不改。对象：Phase 17 完成后的工作区（内容版本 4，54 suites / 657 tests）。方法与边界见第 1 节；所有"孩子会…"都是【假设】并附验证法（第 7 节）。截图在 `docs/review-assets/r4-*.png`。

## 0. 结论

三句话：
1. **"可玩"仍然成立，而且比上一轮更扎实**：空进度顺序通关 19 站、两个岛收尾、作品册、沙盒、家长区全部走通，故意犯的每一类错都拿到了对应的卡片和点亮，全程控制台 0 error / 0 warning；上一轮的 13 项建议（A–M）在代码里都能找到落点，闭合率按条数约 61%（严格）/ 75%（加权），没有回归。
2. **"游戏"变好了，"教学"没有跟上**：三层奖励补齐（专属动作、前进仪式、岛收尾、奖杯、作品册、沙盒）把"奖励 / 多巴胺"从 4 拉到 7；但 19 站里没有一站要求点数，重复点同一块会被系统替孩子数下去，合体岛 6/7 站只要对徽章数字，3 号站"错 = 绿（成功色）"——引擎的数学纪律 9 分，让孩子做数学的设计 4 分。
3. **真正会把孩子卡住的只有布局**：iPhone SE 竖屏（375×553）岛收尾页的唯一按钮整个在首屏外，没有滚动暗示；同一视口 17 站积木 34 px、Android 360×640 的 5×5 站把托盘压到 61 px 高，横屏岛尾按钮折行出侧栏，iPad 横屏"下一站"右侧被沙丘装饰挡住。这些是 D-037（工作台按材料）之后布局预算没有重分配的后果，一个 `layout.ts` 任务能收掉大半。

### 评分卡（1–10；置信度 高 / 中 / 低，低 = 需真机或孩子才能确认）

| 维度 | 本轮 | 上轮（2026-10-15） | Δ | 置信度 | 一句话 |
|---|---|---|---|---|---|
| 可玩性 | 8.5 | 8 | +0.5 | 中 | 手感、判定、纠错成熟；再玩一次仍是同一副牌 |
| 趣味性 | 6 | 5 | +1 | 低 | 每站有可预期的不同；动词仍单一，后半程 12 站同构 |
| 难度递进 | 7 | 6 | +1 | 中 | ∧ 形已修成"矮 ∩ + 长平台"；合体岛 Boss 后回落 |
| 奖励 / 多巴胺 | 7 | 4 | +3 | 中 | 三层都有了；落地质量：可被第二下点击跳过、进站音两次、小块上动作读不出 |
| UI 设计 | 7 | 8 | −1 | 中 | 新页面语法延续得好；空沙坑成了整屏最大空面积，8 处字形 / emoji 与手绘图标混用 |
| UX 设计 | 7 | 7 | 0 | 中 | 帮助体系好；"点卡片 = 求助"仍是隐藏约定；选错伙伴对的和（5+2）不点亮 |
| 色彩 | 8 | 8 | 0 | 中 | 9 / 10 号已修；3 号黄四处 < 1.5:1；3 号站"错 = 绿" |
| 玩法深度 | 6 | 5 | +1 | 高 | 多步变身、沙盒、作品册；无拆分、无换题 |
| 教学有效性（新） | 6 | — | — | 中 | 0/19 站要求点数；同块连点被静默修正 |
| 四岁可操作性（新） | 7 | — | — | 低 | 390 以上 ≥ 45 px；SE / 360 / 横屏大数站 34–41 px |
| 动效（新） | 7 | — | — | 中 | 有纪律；过关瞬间六件事同帧、阻尼比 0.25 的云朵"泄气" |
| 声音（新） | 7 | — | — | 低 | 结构清楚；success 与 drop 同毫秒、低频在手机喇叭上存疑、同一叮咚响两次 |
| 可用性 / 无障碍（新） | 7 | — | — | 中 | 88% 控件 ≥ 44；云朵只有数字字形可点；hitSlop 在 web 无效 |
| 性能（新） | 7 | — | — | 中 | 拖拽 / 过关 / 滚动 4× 降速零长任务；首屏全靠 2.4 MB JS；前进仪式两次 200–300 ms 挂载 |
| 健壮性（新） | 8 | — | — | 高 | 存档层最硬；升级不落盘、旧档作品册为空、只有 /play 有错误边界 |
| 双语（新） | 7 | — | — | 中 | 一张表、切换即时；360 宽英文底栏溢出、"one blocks" |
| 家长体验与隐私（新） | 7 | — | — | 中 | 零外部请求；家长门不可发现；manifest 与横屏矛盾；重置后语言回中文 |
| 代码质量 / 架构（新，本人复核范围缩减） | 7 | — | — | 中 | 纯度边界守住、无内部导入绕过、无 XSS 面；手势层零自动化、无 CI、RN 仍 rc、9 个未用依赖 |
| 规格 / 文档一致性（新） | 5 | — | — | 高 | 规格停在 10-13 / 10-14，缺三页三模块；level-progression 5–9 站仍是旧表 |

### Top 5 优先事项

1. **岛收尾页与关卡页在小屏 / 横屏的出屏**（P1）：375×553 `/island/ch1` 的"去合体岛"在 y=559（屏高 553）之外、无滚动暗示（`r4-18`）；667×331 / 667×375 / 1024×768 的"数字岛完成了 / 合体岛完成了"在 168 px 侧栏折两行出屏；1024×768 与 1280×800 "下一站"右侧 25–40% 被沙丘装饰（`pointer-events: auto`、`left: -40`）挡住。落点 `IslandDoneScreen.tsx`（按钮移出 ScrollView 做固定页脚）、`LevelScreen.tsx`（横屏短文案 + `numberOfLines`）、`LevelScreen.tsx` ground 层 `pointerEvents="none"`。0.5 天。
2. **布局预算重分配**（P1→P2）：D-037 之后 cell 按材料算、多余高度全进托盘：390×844 的 1 站托盘 68% 空沙、3+4 站 74%；反过来 375×553 的 17 站 34 px、360×640 的 17 站 39 px、5×5 站托盘被压到 61 px。落点 `blocks-ui/layout.ts`（托盘高按排布封顶、compact chrome 省 30–40 px、工作台 / 托盘整体居中）。1 天 + 真机核对。
3. **点数的教学闭环**（P2）：`layout.ts:276` 的半格容差把"再点同一块"也算进去（`r4-14`），一一对应的典型错误被静默修正——两行补丁；再决定是否让 4 个 Boss 以"数完才出现下一站"（`COUNT_TO_PASS` 常量，需 Ted 决定）。0.5–1 天。
4. **错误态的非文字指向**（P2）：3+4 站放 5+2 后"我们先找 3 和 4"什么都不点亮；多了 / 选错伙伴 / 卡住 三类在自动态无光圈；"点卡片 = 求助"没有任何可见提示；菜单 ⚙ 短按零反馈。落点 `hints.ts`（partners 分支补 focus）、`AnswerFeedback.tsx`（3 s 后喇叭脉冲两次，不加语音）、`ui.tsx`（⚙ 短按一声 tap + 小晃）。1 天。
5. **前进仪式与过关瞬间的打磨包**（P2）：第二下点击跳过整段仪式（`MapScreen.tsx:447`）、同一叮咚 0.9 s 内两次、success 与 drop 同一毫秒、错的作品被"下一站"带走存档（D-038 的副作用）、升级后的存档不落盘（每次打开都提示"已升级"）。五个 ≤ 1 小时的小补丁，合计 0.5 天。

P0：无。P1：Top 5 第 1 条（两个视口）；第 2 条的 34 px 在真机核对前按 P1 对待。

## 1. 边界：做了什么、没做什么

**没做的（先说清楚）**
- **没有听过任何声音**：音效只记录了 Web Audio 振荡器的起始频率与时刻，语音只记录了 `speechSynthesis.speak` 收到的文本 / 声音名 / 语速 / 音调（选中 "Tingting"，rate 0.9，pitch 1.1）。"刺不刺耳""像不像"一律未验。
- **没有真机**：全部在桌面 Chrome（headed，chrome-devtools MCP）里用模拟视口 + `mobile,touch` 仿真；触摸是脚本化 PointerEvent（pointerdown → 14 次 pointermove → pointerup，`setPointerCapture` 打桩），长按是合成 TouchEvent。iOS Safari 的地址栏伸缩、长按放大镜、音频解锁、添加到主屏幕、真指头在 34–45 px 块上的命中率都没碰。
- **没有孩子**：所有"孩子会 / 不会 …"都标为【假设】，每条附一个可观察的验证方法（第 7 节汇总）。成人脚本的操作速度不代表儿童结果。
- **没有部署**：Vercel 未部署，`vercel.json` 的重写规则只按文件静态核对；本地 `tools/serve-dist.mjs` 不压缩，所以 Fast 3G 的加载数字是上界（见 J）。
- **没有改一行源码**，没有运行任何 git 命令；新增的只有本报告与 `docs/review-assets/r4-*.png`。

**做了什么**
- 门禁基线：`pnpm lint`（0 问题）、`pnpm typecheck`（通过）、`pnpm lint:purity`（零命中）、`pnpm test:gate`（54 suites / 657 tests 全过，8.1 s；覆盖率 content 98.42 / core 100 / progress 99.01 / screens 94.78）、`pnpm build:web`（8 静态路由，dist 4.6 MB，JS 2,418,232 B / gzip 596 KB）、`expo-doctor`（19/20，14 个包版本漂移；`npx expo-doctor` 被本机 rtk hook 改写，要用 `rtk proxy npx expo-doctor`）。
- 主视口 390×844 从空进度顺序通关全部 19 站，每一类错误都故意犯过（多 / 少 / 形状 / 没接 / 选错伙伴 / 卡住 / 放不下 / 误拖整组 / 过关后再动 / 同一块连点）；两个岛收尾页、全通地图、作品册（含放大）、沙盒（摆、拉开、点数、收回、撤销、离开再回、刷新）、家长区（长按进入、从哪里开始、语言、音效、重置）各走一遍。控制台全程 0 error / 0 warning。
- 视口矩阵：375×553、360×640、667×331、667×375、768×1024、1024×768、1280×800 各一名评审员走 地图 → 7 个代表站 → 岛收尾 → 作品册 → 沙盒 → 家长区（第 3 节 B / E / I 与附录 8.1）。
- 旧档升级：v1 两份冻结夹具 + 按 `upgrade.test.ts` 构造的 v2 / v3 存档种入 localStorage 再打开（K）。
- 减少动效、深色模式各走一遍主路径（G / I）；健壮性场景 11 组（K）。
- 性能：Lighthouse 移动端（a11y / best-practices / SEO）；CPU 4× 下拖拽、过关（含专属动作）、地图跳跃、作品册滚动各一次 trace；Fast 3G 首屏（J）。
- 静态分析：17 个维度各一名评审员读代码 / 规格 / 文档 / 前四份复审，因用量限制，原计划的逐条对抗式复核没有跑完；第 3 节里标"★已复核"的是主评审亲自在浏览器或代码里核实过的条目，其余为各维度评审员的证据（path:line、截图）。
- 工具说明：本轮 impeccable 与 ui-ux-pro-max 两个插件在本会话未启用，评审员直接读取其 critique / audit / harden 启发式与 ux-guidelines.csv 文件应用；better-colors、game-feel、motion-design、animate-expo、puzzle、mobile-native、spec-driven-development、web-design-guidelines、react-native-best-practices 为项目自带 skill。
- 浏览器被另外两个会话的 chrome-devtools 服务共享（同一个 Chrome，进程 68865）：首次打开时出现过一次来历不明的拖拽，此后用 isTrusted 事件日志监测，主视口全程 0 次外来输入。

**视口矩阵**

| 视口 | 对应设备 | compact | 用途 |
|---|---|---|---|
| 390×844 ×2 mobile touch | iPhone 12–15 Safari 无栏 | 否 | 主视口，空进度全通 |
| 375×553 ×2 | iPhone SE Safari 有栏 | 是 | 最矮竖屏 |
| 360×640 ×2 | Android 小屏 | 是 | 最窄 |
| 667×331 ×2 landscape | iPhone SE 横屏 | — | 最矮横屏 |
| 667×375 ×2 landscape | iPhone 8 横屏 | — | 横屏 |
| 768×1024 ×2 | iPad 竖屏 | 否 | 首次测 |
| 1024×768 ×2 landscape | iPad 横屏 | 否 | 首次测 |
| 1280×800 ×1 | 桌面 | 否 | sanity |
## 2. 三个人物走查（主视口 390×844，依据本轮实际操作与截图；"卡住 / 高兴 / 无感"是对孩子反应的【假设】）

### 2.1 第一次打开的四岁孩子（不识字、没人示范）

- 打开地图：一个红色的"1"睁着眼，上面有个黄色标记在上下浮动，右下一个大橙色 ▶。【高兴】会点 ▶ 或点那个红块——两条路都进第 1 站（实测点 ▶ 进 /play/ch1-n1）。底栏左边的 ⚙ 短按没有任何反应（设计如此）；【无感】。
- 第 1 站：云朵上一个"1"，托盘三个闭眼红块，工作台空。约 2 秒后一只手把一块虚影拖到工作台中央再收回（实测 2.0 s 出现、6.3 s 收起）。孩子照做：块被拿起时变大、眼睛睁开，放下"咚"一声，立刻"叮"的和弦、笑脸、彩纸、云朵变绿，底栏冒出两个药丸（再玩一次 / 下一站）。【高兴】但两件事同一帧发生，"咚"被"叮"盖住（success 与 drop 同一毫秒排程）。
- 孩子的默认动作是"全部拿出来"：三块都放上去。卡片变成白底琥珀边 + 💡，块的脸变成挑眉歪头，"hmm?"两声。"下一站"还在（白色）。【卡住】——卡片上写着"多了 2 块 / 比 1 多了，放回一块"，孩子不识字；没有任何东西在闪。只有碰到卡片才会听到"比一多了，放回一块"并看到两块亮起来（实测点亮 2 块）。假如他碰了"下一站"（白色药丸），就直接去第 2 站，错误被带着走但记录仍算完成。
- 点"下一站"：画面回到地图，标记沿三块踏脚石跳到"2"，"2"睁眼"叮咚"，约 0.9 秒后自动进站，进站又"叮咚"一次。【高兴】（跳跃）→【无感】（两次同样的进站音）。若孩子习惯连点两下，第二下会直接进站、看不到跳（D 评审复现 91 ms 第二下即跳过；主评审 90 ms 第二下落在地图挂载前则无效——取决于时机）。
- 第 2 站放两块后点块：念"一""二"，第二下"一共两块"、ta-da、两块一起眨眼，左上出现"再数一遍"。【高兴】。但如果他对同一块连点，第二下照样念"二"（countTarget 半格容差把邻块算进来）——一一对应的典型错误被系统替他改正，他看到的是"我点哪里都在数"。
- 第 3 站（4 方阵）：孩子摆成一排，卡片 💡"数量对了，再看看形状"，1.3 秒后右上角的小图亮了一圈。【卡住】——要把 48×48 的小图和工作台上 73 px 的四块对上号。把一块拖到被占的格子：摇头 + 低音"咚咚"，卡片不变（放不下 ≠ 错）。
- 第 4 站 ★：同样的流程，过关时音乐多四个音、云朵戴星、彩纸更多、三块"叠罗汉"（跳 16/25/34 px——半块高，不太看得出）。【无感】Boss 感主要靠星星。
- 第 5 站：托盘里第一次出现一整条黄色的 3 和四个红块；5 秒后示范手搬的是整条 3（实测 demo-ghost 3 格）。孩子抓一块黄的，整条跟着走。【高兴/困惑】。放 3 + 2 块过关；再放一块，"多了 1 块"，点卡片后亮的是那一块单块。
- 第 6 站：方阵摆好 → 跳一下、"叮"、云朵 pop、卡片变成蓝色"变个样子！"、小图换成一行四格并点亮，但脸没有笑、没有彩纸、没有"下一站"。【卡住】——"对了但没过"的状态只能靠小图换图读出来；挪动一块后小图的光圈就灭了。
- 第 8 站 ★：示范手搬整条 4。孩子先拿 4 和 3，"还差 1 块"；再拿单块凑 8，"数量对了，再接起来"——亮的是 4 那一条（不是分开的 3 和 1）。两个 4 叠成砖：长出轮子、开出右边再从左边开回来。【高兴】这是全图最明显的"后果"。4 + 3 + 1 拼成砖同样过关、同样开车。
- 第 9–12 站：握把 + 诱饵。放多了卡片说"多了 n 块"，点卡片才知道送谁回去（"把 4 送回去，换 2 过来"并点亮两者）。孩子不点卡片就只能试错。17 过关：10 站起来挥手，顶部盖到卡片下缘；按钮写着"数字岛完成了"。
- 岛收尾页：12 个角色在跳，中间是自己拼的 17，彩纸；一句话点了才念。按"去合体岛"：地图上 17 和 1+1 同屏，标记跨岛跳过去。【高兴】。
- 合体岛 1+1：先拿了大的 3，"多了 1 块"；点卡片"把 3 送回去"并点亮 3。两个 1 分开放，"数量对了，再接起来"，1.2 秒后两个都亮；推到一起，云朵变成"1 + 1 = 2"。【高兴】但两块仍是两张脸两个徽章。
- 合体岛 Boss "5"：云朵只写 5。单放 5 →"数量够了，再找对伙伴"，点卡片亮 5。4 + 2 → "多了 1 块"，点卡片"把 4 送回去，换 3 过来"。4 + 1 过关"4 + 1 = 5"。
- 3+4 ★：放 5 + 2 接在一起（也是 7）→"数量够了，再找对伙伴 / 我们先找 3 和 4"，点卡片只念、**什么都不亮**。【卡住】——这是全程唯一一次求助没有任何视觉指向。3 + 4 推拢 →"3 + 4 = 7"，两条转圈，"合体岛完成了"→ 收尾页"所有的岛都完成了！"→ 回地图，底部挂起彩旗和奖杯。

### 2.2 第三天回来的四岁孩子（全通存档）

- 地图打开直接停在最后一站（当前站 3+4），所有站都是笑脸 + ✓，底部彩旗奖杯。▶ 进的是 3+4（已完成态：作品还在、"再玩一次 / 合体岛完成了"）。【无感】——没有"今天玩哪个"的提示；想玩别的站要在 2000 px 长的地图上自己滚动找。
- 作品册按钮（左下）出现了：19 张卡两列；点开 8 砖会开车、点 17 挥手、点云朵数字才说话（"三加四，一共七"）。【高兴】是"我的东西"；但看完只能 × 或回地图，不能从作品直接进那一站再拼。
- 自由玩：10 块红的 1 号，三块接起来变黄、长一张脸；拉开一块变回两张脸；点数念到"一共三块"；"全部收回"一步清空、撤销全回来；离开再进、刷新后摆法还在。【高兴】最像玩具的一页；但没有伙伴，关卡里学的"搬整条、合体"在这里做不了，也没有彩纸和声音奖励。
- 再玩一次任何一站：同一副牌、同一顺序（`replay` 不换 variant；`newVariant` 没有入口）。【无感】。
- 地图上最便宜的"今天不一样"（刚完成的站 ✓ 落下、奖杯揭幕）都没有：✓ 和奖杯在回到地图前已经在那里了。

### 2.3 陪玩的家长

- 想关声音 / 换英文：没有任何界面提示 ⚙ 要长按 600 ms（提示只在无障碍 hint 里）；短按毫无反应会被当成"坏了"。长按进入后，语言 / 全屏 / 从哪里开始 / 音效 / 存档 / 重置 都是清楚的文字区块，"从哪里开始"只改起点不改完成记录（实测 completed 仍 19、current 改成 ch2-n1），但选了岛中间的站后，同岛更早的站仍锁着（实测选 2-3 后 2-1 / 2-2 locked）。
- "重置进度"需二次确认（Clear / Cancel）；重置后语言也回到中文（English 家长会被切回中文）。
- 选 English 后，关卡、地图、作品册、沙盒、家长区文案全部切换；html lang 仍是 zh-CN，标签页标题为空。
- 想知道"孩子学到了什么"：家长区没有任何记录（完成了几站只在地图岛牌上写 12/12、7/7）；作品册是唯一的"证据"。
- 想在孩子卡住时帮忙：卡片文字对家长是清楚的（"把 4 送回去，换 2 过来"），点卡片会念并点亮；菜单里有"撤销 / 帮助 / 重新挑战"。
- 隐私：整轮网络请求只有同源的 html / js / css / ttf / png，没有任何外部域名、字体 CDN 或追踪（见 M 维度）。
## 3. 分维度发现

严重度：P0 四岁孩子无法前进或数据损坏；P1 需要成人介入才能继续；P2 打磨；P3 小瑕疵。★ = 主评审亲自在浏览器或代码里复核过。成本为粗估。

### A. 学习科学与教学有效性 — 教学有效性 6（新）；难度递进 7（↑1）；玩法深度 6（↑1）；置信度 中

PRD §3 九个目标 ↔ 实现：goal 3（数量 ↔ 数字符号）在数字岛散块站成立；goal 6（形状）成立但 5 个模板全是矩形 / 转角；goal 9（主动探索）靠沙盒 / 撤销 / 再玩一次成立；goal 1 / 2（一一对应、基数）**只有机制没有要求**；goal 4（部分—整体）只有"合"没有"拆"；goal 5（守恒）只有 ch1-n6 一站；goal 7 / 8 未实现（PRD 标为后续，合理）。Numberblocks 三个锚点：Ep10 How to Count → 自愿点数（部分）；Ep11 Stampolines → 仅 ch1-n6；Ep12 The Whole of Me → 无。

| # | 严重度 | 发现 | 证据 | 建议 / 成本 |
|---|---|---|---|---|
| A-1 | P2 | 19 站里 0 站要求点数或说出总量；教学核心全靠孩子自发 | `src/core/judge.ts` 四分支只比对 `benchCount` / 簇 / 组；`level-session.ts` 的 `solvedNow` 与 `round` 无关 | 不全局强制。加常量 `COUNT_TO_PASS: ReadonlySet<NodeId>`（`catalog/index.ts`，默认 4 个 Boss），这些站的"下一站"等 `countProgress.complete` 后才出现（已完成站仍按 D-038 常驻），按钮出现前显示一只点块的手、不加语音。0.5–1 天。**需要 Ted 决定** |
| A-2 ★ | P2 | 对同一块连点会得到新数词：`countTarget` 的半格容差把"点在已数块中心"也吸到相邻未数块（手指到邻块边缘正好 = 0.5 cell） | `src/blocks-ui/layout.ts:266–300`；主视口 ch1-n2 同一块点两次 → "一""二""一共 两 块"；A 评审 ch1-n3 连点 4 次 → chip 3（`r4-14`） | `layout.ts:276` 后加 `if (hit !== null && counted.has(hit)) { return null; }`，容差只对缝隙 / 边界生效，已数块做一次"数过了"眨眼；补测试。2–3 h |
| A-3 | P2 | 散块站"簇色 = 托盘色 = 小图色"是颜色匹配路径；"还差 n 块 / 多了 n 块"把比较替孩子算好 | `content/material.ts` 散块全染 `hueFor(target)`；`Stage.tsx:329` 簇按大小变色；`copy.ts feedback.fewer/more` 带差值 | (a) 散块站托盘改染 `hueFor(1)`（`material.ts` 一行，与握把站备用块一致，簇变色保留作奖励；升 `CONTENT_VERSION`）；(b) 差值只在求助第二级说。各 1–3 h。先按第 7 节观察再定 |
| A-4 ★ | P2 | 合体岛 6/7 站题面 = 徽章数字（云朵 "3 + 4" ↔ 徽章 3、4），比颜色更直接的捷径；和由系统揭示，从不要求数；等价组成 5+2=7 被判"再找对伙伴"且无承认 | 主视口 ch2-n7 放 5+2 接边 →"数量够了，再找对伙伴 / 我们先找 3 和 4"；`judge.ts judgePairs`；`solvedEquation` | 文案先行：`hints.ts:79` partners 分支改"{x} 加 {y} 也是 {n}！再找 {a} 和 {b}"（2 h）；Boss 3+4 题面改两个无数字剪影、合体后等点数再显示算式（1 天，接 A-1） |
| A-5 | P2 | ch1-n9–n12 实际是 2–3 加数的加法（9 = 5+4、17 = 10+5+2），超出第一章"不要求加法"的声明；孩子可行路径是按卡片反馈搜索 | `chapter-1.ts:27–30`；PRD §3.3 / §4.3.2；主视口 n12 放 10+5+4 →"多了 2 块"→ 点卡片"把 4 送回去，换 2 过来" | 云朵旁常驻该数的伙伴画法轮廓（10 上 5 下；17 = 10+5+2 三段），孩子照图搬，判定不变（符合 PRD §4.3.2 的"标注握把"）。1–2 天 |
| A-6 | P2 | ch1-n5（首个握把站）用"数单块"的自然策略会卡死：托盘只有 4 个单块 < 5，第一条纠正是"这样拼不到 5" | `chapter-1.ts:21` `extra: 2` → 单块 = 5−3+2 = 4；纯模块复现 L2 "先放回 1 块，再把 3 搬过来" | `extra: 2 → 3`（5 单块，数单块与 3+2 都通，握把变"省力"而非"必须"）；升版本登记 ch1-n5。1 h |
| A-7 | P3 | 守恒只有 ch1-n6 一站，两步之间没有"数一数"的邀请；Boss 后两站（3+2、4+1）正是 Boss 自由和里刚见过的分法，难度回落 | `chapter-1.ts` 只有 n6 `sequence`；`chapter-2.ts` n4 allowed [[2,3],[4,1]] → n5、n6 | n7 塔加第二步横放；合体岛调序 1+1 → 2+1 → 2+2 → 3+2 → 4+1 → ★自由和 → ★3+4。各 1–2 h + 版本迁移 |
| A-8 | P3 | 部分—整体只有"合"没有"拆"（Ep12 锚点无对应） | core 无 split；todo 第三档 P 有意推迟 | 维持"真机 + 孩子之后再做" |

错误反馈文案：所有标题都是状态描述，没有否定词；puzzled 脸不哭不怒；放不下不算错——**符合 PRD §5**。唯一带"不"的是"这样拼不到 n"，而它正出现在 A-6 的场景里。

### B. 四岁儿童的认知与运动 — 四岁可操作性 7（新）；置信度 低（尺寸高，手指行为低）

19 站 × 8 视口的格子 / 托盘块 / 徽章 / 最长拖拽表见附录 8.1。读表：390×844 以上全部 ≥ 45 px，iPad 一律 84（`MAX_CELL`）；低于代码自定的 40 px 指尖下限（`layout.ts:20 TRAY_MIN_BLOCK`）只出现在 375×553（n8 39、n11 39、**n12 34**）、360×640（n12 39）和横屏 667（n11 / n12 40–41）。一次过关最少手指动作：数字岛 50、合体岛 21（含"下一站"），全程没有双指 / 长按 / 滑动列表。

| # | 严重度 | 发现 | 证据 | 建议 / 成本 |
|---|---|---|---|---|
| B-1 ★ | P1（真机核对前） | 小手机 / 横屏上大数站格子与托盘块 34–41 px，徽章 17–21 px、点数圆 14 px | 375×553 ch1-n12 实测 block 34×34、徽章 17 px / 字 10.9 px（`r4-19`）；360×640 n12 39 px；667×331 n12 40 px（`r4-21`）；`layout.ts:16 MIN_CELL = 28`，工作台没有 40 下限 | 不缩材料改预算：compact 竖屏 `LEVEL_CHROME.compact` feedback 70→56、footer 64→48 可让 SE 的 n12 34→38；n11 / n12 在 compact 优先 side 排布；真机测 39 px 抓取率后再定。半天 |
| B-2 ★ | P2 | 云朵上只有数字字形可点（"1" = 24×70 px），云朵本体 112×80 不响应；点数字是唯一重听题目的入口 | `LevelScreen.tsx:466–472` `<Text accessibilityRole="button" onPress={onPrompt}>` 在 `<Cloud>` 内；Lighthouse 也只认字形 | 把 `onPress` / role / testID 挪到包住 Cloud 的 `Pressable`，`Text` 只留样式。≤ 1 h |
| B-3 ★ | P2 | 多了 / 选错伙伴 / 卡住 三类错误在自动态（0.9 s 后）没有任何指向线索，恢复依赖"点卡片 = 求助"的隐藏约定；上轮建议的喇叭脉冲未做 | 主视口 n12 放 19 块 `spot: 0`，点卡片后 2 个光圈；`hints.ts lookHere` 对 count-mismatch 返回空；`AnswerFeedback.tsx` 无脉冲 | adjust 态静止 3 s 后卡片喇叭圆盘脉冲两次（复用 Spotlight 的 withRepeat），只在本站第一次出错时；不自动念纠正。2 h |
| B-4 | P2 | 关卡内"撤销 / 帮助"只在 ≡ 菜单且是纯文字药丸；沙盒的撤销却是常驻图标键 | `LevelScreen.tsx:560–576`；`SandboxScreen.tsx:42`；todo 第 13 条 | 菜单项加 Icon（undo 已有，help 画一个灯泡），或关卡底栏左侧放 52 px 撤销键。半天。**需要 Ted 决定** |
| B-5 | P3 | 横屏反馈卡喇叭 26 px、详情 12 px（整卡可点，只是"这是按钮"不可读） | `AnswerFeedback.tsx:27` narrow 26 | narrow 改 32。10 min |
| B-6 | P3 | 伙伴徽章与点数序号是两套白底小圆数字（34–45 px 格上 10.9 / 9 px 字） | `PartnerView.tsx:109`、`CountMark.tsx:9` | 点数进行中把徽章淡到 0.4。1 h |
| B-7 | P3 | iPad 最长拖拽 541–567 px；手机最长 388 px（390×844 n12） | 附录 8.1 | 不改；真机看单手持平板的孩子是否换手 |

不识字能否独立完成：从地图进站、拖块、过关、下一站、沙盒、作品册这条主路径可以；"为什么不对、该动哪一个"只在文字 + 按需语音里。错误后恢复：少了（蓝卡，继续拖）、形状（小图点亮）、没接（分开的块点亮）、放不下（摇头 + 咚）能自己恢复；多了 / 选错伙伴 / 卡住 要点卡片才有指向（B-3）。

### C. 可玩性 / 关卡与系统设计 — 可玩性 8.5（↑0.5）；趣味性 6（↑1）；置信度 中

曲线（seed 4242；附录 8.6）：最少拖拽 数字岛 **36**（上轮 50）、合体岛 14；单站上限 6（上轮 9）；托盘对象上限 8（上轮 11）。拖拽从上轮的 ∧ 变成"矮 ∩ + 长平台"（1→6 在第 6–7 站封顶，第 8 站起连续 12 站 2–3 次）；决策是 0→1→2 的两级台阶（第 3 站、合体岛各上一级）。体力与脑力不再倒挂——上轮核心问题**已修**；新问题是后半程平：合体岛 7 站里 6 站度量完全相同。

| # | 严重度 | 发现 | 证据 | 建议 / 成本 |
|---|---|---|---|---|
| C-1 | P2 | 后半程 12 站拖拽 2–3 / 决策 1–2 全平，合体岛 6/7 同构，两个 Boss（3 转角、3+4）比普通站更轻或同构 | 附录 8.6；`chapter-2.ts:10–18` 六站都是 `addition_exact` + 2 干扰；`cheer.ts:22–29` 只有 8 / 17 有变身 | 2-7 改 `sum_composition` 7（allowed [[3,4],[5,2]]，Boss = "7 有两种拼法"，与 8 砖呼应）；3 转角做 `sequence: [CORNER_3, LINE_3]`。内容 0.5 天 + 版本 5 迁移 0.5 天 |
| C-2 ★ | P2 | 合体岛 4/7 站的干扰对恰好也等于目标（2-3 的 3+1、2-5 的 1+4、2-6 的 2+3、2-7 的 5+2），孩子拼对总量却被判"再找对伙伴" | `chapter-2.ts`；主视口 2-7 放 5+2 实测；`judge.ts:91–97` 只认操作数 | **需要 Ted 决定**：有意（练"读数字"）→ 规格写明 + 卡片改肯定句；无意 → 干扰改 [3,5] / [1,5] / [2,5] / [5,1]。1 h + 迁移 |
| C-3 | P2 | "再玩一次"同一副牌；`newVariant` 零引用，且接上也换不出题（1–7 站 variant 0/1 完全相同，其余只换托盘顺序） | `LevelScreen.tsx:327` 只派发 `replay`；`envelope.ts` 单元素池 | 先给每站一个池（`targets: [2, 3]`、`templates: [SQUARE, LINE]` 非 sequence、合体 `pairs: [[2,1],[3,1]]`），再接"换一题"按钮。2 天 |
| C-4 ★ | P3 | 家长选岛中间的站后，同岛更早的站仍锁着（选 2-3 → 2-1 / 2-2 locked） | 主视口实测 aria-label；`unlock.ts:28–35` | `unlock.ts:32` 加一项：`index < indexOf(current)` 也开。1 h |
| C-5 | P3 | 作品册没有"再拼一次"；沙盒没有伙伴——两者都是"看"不是"回去玩" | `AlbumScreen.tsx:199` 只有回地图；`sandbox.ts:17` | 放大视图加"再拼一次"圆钮 → `/play/[nodeId]`（0.5 天）；沙盒伙伴见第 5 节 #10 |
| C-6 ★ | P3 | 诱饵是"软"的：8 砖 4+3+1 也成砖、也开车；文档却写"要自己挑" | 主视口 ch1-n8 实测（`r4-05` 同款车）；`validate.ts:67` | 对学习是好事；改两处文案 + 加一条 "4+3+1 matched" 测试锁住行为。1 h |

Boss 判断：8 砖（两条 4 叠砖、4+3+1 也行）和自由和 5 是"想法"；3 转角、17、3+4 是"更大的数 + 一颗星 + 动作"。

### D. 奖励与动机 — 奖励 / 多巴胺 7（↑3）；置信度 中

时间线（主视口实测）：松手 → +5 ms success 五音与 drop 两音同时排程 → 下一帧云朵变绿 + pop、脸笑、卡片 ✓、彩纸、按钮淡入 → 0–900 ms 专属动作 → 1600 ms 按钮呼吸；点"下一站" → 地图挂载（CPU 4× 下 308 ms）→ +892 ms 标记落地 + 睁眼 + arrive → +1805 ms 关卡挂载再响 arrive。三层：即时层最强；中层（前进仪式、每数动作）已落地但有漏；长层（岛收尾、奖杯、作品册）全部"悄悄出现"。PRD §5 逐条（不倒计时 / 排行榜 / 随机箱 / 索取式表情、动画不锁操作、自然结束点、过关靠点击）全部成立，唯一边缘是 900 ms 自动进站的定时器（只在孩子点"下一站"之后）。

| # | 严重度 | 发现 | 证据 | 建议 / 成本 |
|---|---|---|---|---|
| D-1 ★ | P2 | 前进仪式会被"下一站"的第二下点击整个跳过（标记不跳、不睁眼、无进站音）；主评审 90 ms 第二下落在地图挂载前则无效——取决于时机 | `MapScreen.tsx:447–450` 覆盖层从挂载第一帧生效；D 评审第二下 91 ms → 182 ms 已在 `/play/ch1-n4` | `goNext` 前 300 ms 不响应（`mounted = useRef(Date.now())`），之后仍"点任何地方立即进入"。0.5 h。【假设】孩子会连点 |
| D-2 | P2 | 重排后 5 / 9 / 合体岛 n4–n6 五站的 wave 在 2–3 个对象上不成立，合体岛三站连续同一动作；3 与 5 两个 Boss 无专属动作；stand 从中心放大像"胀大" | `cheer.ts:12–16`；`juice.ts:65–77`；`PartnerView.tsx:102` 内层无 transformOrigin；`r4-06` 10 站起时盖到卡片 | 对象数 < 4 时 wave→pair；stack 幅度 `min(24+14i, 72)`；Boss 3 / 5 各一个专属；stand 加 `transformOrigin: '50% 100%'`。2–4 h |
| D-3 | P2 | 地图上"刚完成的站"没有变化时刻（✓ 和笑脸在回到地图前已就位）；下一站"睁眼"只是 sleepy→calm 瞬切 + 140 ms pop | `LevelScreen.tsx:198` 过关即 complete；`MapScreen.tsx:198–202` check 无动画 | `StopDot` 加 `justDone` → ✓ 用 `usePop` 落下，`ADVANCE.startMs` 250→400；睁眼用现成的惊喜脸 `lifted` 过渡。2 h |
| D-4 ★ | P3 | 同一进站 jingle 0.9 s 内两次（地图落地 + 关卡挂载）；success 与 drop 同毫秒、success 在前 | 主视口时间线；`MapScreen.tsx:308`、`LevelScreen.tsx:136`、`:230` 早于 `Stage.tsx:127` | 地图落地改轻音或不响；success / fanfare 延后 100 ms（`sfx.ts` 每个 `at` + 0.1）。1 h |
| D-5 | P3 | 彩纸从工作台几何中心起而非作品中心；收尾页 Boss 作品做通用 hop 不做车 / 挥手；作品册按钮与奖杯首次出现无动静；变身站第一步脸不笑 | `LevelScreen.tsx:542`、`IslandDoneScreen.tsx:150–163` 未传 cheer、`MapScreen.tsx:458,445`、`hints.ts:79` tone building | 各 0.5–1 h |

### E. 视觉设计 / UI — UI 设计 7（↓1）；UX 设计 7（0）；置信度 中

六界面的玩具语法（云朵 / 气泡卡 / 木框毛毡 / 沙坑 / 硬底边按钮 / 手绘图标）在作品册、沙盒、岛收尾三个新页面延续得好；扣分的两件事都在前几份复审里被点过、本轮未收口。

| # | 严重度 | 发现 | 证据 | 建议 / 成本 |
|---|---|---|---|---|
| E-1 ★ | P2 | 工作台按材料缩小后，沙坑成了整屏最大的空面积：390×844 的 1 站托盘 288 px 高只用 92（68% 空），2 站 36%，5 站 61%，3+4 站 74%（`r4-13`），沙盒 58%；iPad 竖屏 3 行站空 290–384 px（`r4-24`） | `computeGeometry` 只优化 cell，剩余高度全进托盘（`layout.ts:48–54`）；cell 已到 `MAX_CELL=84` | 托盘高按 `layoutTray` 行数封顶，工作台 + 托盘整体垂直居中，下面交给已有的 `ground` 沙丘；`resolveDrop` 仍用大矩形当"放回"命中区（画小判大）。0.5–1 天 |
| E-2 | P2 | 图标两套：11 个手绘 `Icon` 与 8 处文本字形 / emoji（★ 皇冠、✓、✦ ↗ 💡 ✓、"★ 数字岛 ★"、"z z"、👆）；★ 实测落到系统字体 | `MapScreen.tsx:170,200,221`、`LevelScreen.tsx:466`、`AnswerFeedback.tsx:12`、`IslandDoneScreen.tsx:134`、`AlbumScreen.tsx:85,116,180`、`DemoHand.tsx:60` | `icons.tsx` 加 star / check / bulb / hand / sparkle 五个，替换 8 处；先把 `styles.crown` 加 `fontFamily: FONT.display`。0.5 天 |
| E-3 | P2 | `@font-face` 无 `font-display`（Lighthouse FontDisplay 也报）；dist 还带 300/400/500 三份未请求的 ttf | `_layout.tsx:16` 注释与实际不符；`document.fonts` display 为 auto；`_layout-*.js` 引用 5 个 ttf | `useFonts({ Fredoka_700Bold: { uri, display: FontDisplay.SWAP } … })`；直接 require 两份 ttf。1 h |
| E-4 ★ | P2 | 作品册放大按作品的工作台尺寸画整张毛毡，作品缩在左上角（8 砖只占 213×127 / 330×291，`r4-26`）；iPad 上放大图反而比关卡里小（cell 52 vs 84） | `AlbumScreen.tsx:110 showcaseGeometry(…, entry.work.bounds)` | 放大前用 `pictureOf(work)` 外接框 + 各留 1 格平移到左上角（`migrate.ts onMat` 已有同类逻辑）。2–3 h |
| E-5 ★ | P2 | 地图底栏悬浮在站点上没有底衬：首屏 ch1-n6 被作品册 / 自由玩按钮压住半张脸（`r4-01`）；375×553 ⚙ 与 n5 重叠；667×331 scrollTop 0 时 ch1-n2 整个被盖（`r4-22`）；底栏内层 `leftButtons / rightButtons` 不是 box-none，站点经过时有一段不可点 | `MapScreen.tsx:451–465` | 底栏加半透明沙色 / 渐变底衬，内层容器 `pointerEvents="box-none"`，自动滚动把当前站居中偏上。1 h |
| E-6 | P3 | 同一个绿色牌子字重不一致（地图 800、作品册 / 沙盒 / 岛收尾 400，中文回落字体看得出）；家长区站点芯片用题号而非站序（两个"4"）且是唯一没有硬底边 / 点击音的按钮；沙盒工具标签 12 px / 4.19:1 | `MapScreen.tsx:480` vs `AlbumScreen.tsx:210` 等；`ParentScreen.tsx:160,226`（`r4-28`） | 三处加 `fontWeight: '800'` 或抽 `Sign` 组件；芯片写 `${i+1}·${label}` 并用 `lip()` + tap 音。各 15 min–1 h |
| E-7 | P3 | 关卡卡片仍是标题 + 详情两行文字（对不识字的孩子 362×84 里只有 44 px 的符号盘可读）；形状题的小图才是题目却只有 48×48；工作台三层装饰叠加、点阵 1.36:1 | `AnswerFeedback.tsx:38–39`；`Stage.tsx:519–522` | 上轮建议维持：卡片只留符号 + 短标题，详情点喇叭才读；形状题小图进云朵。半天 |

### F. 色彩 — 8（0）；置信度 中

对比度表（WCAG，fill 对毛毡 / 沙 / 天空 / 白卡，edge 对毛毡）见附录 8.2。上轮三条已修（10 号丁香紫 2.27:1、9 号长春花蓝 2.53:1、调整卡白底琥珀边）；3 号黄仍是唯一一个 fill 对所有底 < 1.5（1.15–1.47）、edge < 3（1.92–2.44）的颜色，它的 pale 态在地图上底 1.08 / 边 1.24——★3 Boss 站是最难找到的站（`r4-17`）。

| # | 严重度 | 发现 | 证据 | 建议 / 成本 |
|---|---|---|---|---|
| F-1 ★ | P2 | 3 号站"对 = 黄（≈ 调整卡琥珀），错 = 绿（= 成功色）"：多放一块整簇按簇大小变成 4 号绿 + puzzled 脸 + 白卡（`r4-15`）；4 号站拿起的块是绿、工作台 3 块是黄、吸附虚影也是绿（`r4-16`） | `Stage.tsx:296` vs `:329`；4 号 edge vs leafDeep ΔE 0.045、fill vs preview ΔH 8° | (a) 把非成功的绿去掉：虚影改中性（`Stage.tsx:535` `rgba(43,54,69,0.10)` + `inkSoft` 边）、计数芯片字 / 边改 `ink`（1 h）；(b) 超过目标的簇不按簇大小上色而保留目标色 + puzzled——**需要 Ted 决定**（半天） |
| F-2 | P2 | 3 号黄 fill 对所有底 < 1.5:1、edge < 3:1，是唯一一个；地图睡着的 ★3 站最难找 | `palette.ts:24`；附录 8.2；`r4-17` | 只动 edge / pale：`edge: '#9C7B08'`（毛毡 3.72、沙 3.15、白 4.00）；地图睡着站描边用 `colors.edge`。2 h |
| F-3 | P2 | `palette.test.ts` 的底 / 边 / pale / 色相阈值只守 9、10 两色，pale 文字量的不是渲染对（实际 deep@0.75 压 pale@0.92 压沙 = 2.58–3.19，无一到 4.5） | `palette.test.ts:42–62`；`MapScreen.tsx:188,198` 双层透明 | 把 `['n9','n10']` 换成全部 hue（n3 会红，倒逼 F-2）；pale 断言先合成；加语义守门（leaf / preview / amber 与每个 fill ≥ 15°）；删 `:198` 的 `opacity: 0.75`。2 h |
| F-4 | P3 | 5 号蓝 vs 9 号长春花蓝正常视觉 ΔE_ok 0.060（ΔL 0），deutan 0.011——全调色板最近的一对；色盲下调色板退化为暖 / 冷两组，但数字 / 徽章 / 点数序号兜底 | 附录 8.2 色盲矩阵（Machado 2009） | 9 号 `#8F94ED`（vs 5 升到 0.091）；不建议再调整体。0.5 h |
| F-5 | P3 | 死 token：`BlockColors.text`（零调用，n5 / n7 / n9 对 fill 只有 2.6–2.8）、`THEME.lock / lockText` | grep 零命中 | 删掉或加断言。15 min |

### G. 动效 — 7（新）；置信度 中

全部 36 条动效的时长 / 缓动 / 线程 / reduced-motion 表见附录 8.3。系统有纪律：一条 `EASE_OUT`、命名弹簧、全部 Reanimated worklet（web 上同在主线程 rAF）、庆祝靠显式事件 tick、托盘 ↔ 工作台同一视图 FLIP。减少动效：17 处 `useReducedMotion`，本轮打桩 `prefers-reduced-motion` 走主路径实测——过关无彩纸、积木 transform 全程恒等、云朵不 pop、按钮不呼吸、地图标记直接到位、示范手只在原位闪（opacity）；覆盖完整（★）。深色模式：应用完全无视系统深色（html / body / 按钮 / 站点颜色与浅色一致，`color-scheme` 未声明，`r4-30`）——对儿童游戏可接受，夜间亮度交给系统。

| # | 严重度 | 发现 | 证据 | 建议 / 成本 |
|---|---|---|---|---|
| G-1 ★ | P2 | 过关瞬间六件事同帧起跑、同一块积木叠三条弹簧（外层 SETTLE 回落 + 挤压层 BOUNCE splat + cheer 跳 / 转），没有主角 | 逐帧采样：36–52 ms 内 outer scale 1.08→1.0、squash 0.86/1.14、hop ty −2→−22、云朵 1.04→1.32、彩纸挂载、按钮淡入；7 个振荡器同帧 | `useCheer` 所有 move 起点加 `CHEER_AFTER_LAND = 140`，Confetti `withDelay(140)`，云朵 pop 保持 0 ms 当主角：落地 splat → 云朵 pop → 起跳 + 彩纸。2–3 h |
| G-2 | P2 | 庆祝弹簧阻尼比 0.25–0.34：云朵 1→1.32（195 ms）→ **0.78**（636 ms）→ 1.0（886 ms），"pop"变成"涨一下再泄气" | `juice.ts:154 {damping 7, stiffness 200}` ζ 0.25；实测 badge scale 序列 | `usePop` 改 `{ damping: 12, stiffness: 200 }`（ζ 0.42）；juice SETTLE `{14, 240}`；两处 BOUNCE `{11, 320, 0.5}`。1 h |
| G-3 | P2 | cheer 幅度是绝对 px，块边 32–84 px：首站 84 px 块只升 22 px（0.26 身高）；34 px 块上 spin 的眼睛 3–4 px 看不出转了一圈 | `juice.ts:40–91` 全部字面量；附录 8.1 cell 表 | `useCheer` 加 `size` 参数，幅度乘 `clamp(size/60, 0.7, 1.4)`。2 h |
| G-4 | P2 | 错误态零动效：puzzled 脸、adjust 卡、tone 换色都是硬切，唯一动态信号是一次 adjust 音 | `Face.tsx:84–131` 按 mood 换子树；`AnswerFeedback.tsx` 无 Animated | puzzled 切入时头块做一次轻版 wiggle（±5°，200 ms），加 `puzzledTick`。3–4 h |
| G-5 ★ | P3 | 进站掉落首帧闪现：积木先在原位画 2 帧再瞬移到上方掉下（`useEffect` 画后才设 ty） | rAF 采样 t=190/192 ms `translateY(0)`，t=201 ms `-50.4px`；`use-draggable.ts:129` | `useEffect` → `useLayoutEffect`。0.5 h |
| G-6 | P3 | 岛收尾页 Boss 作品"挂载即庆祝"与掉落叠在一起且用默认 hop；作品册 `CHEER_AFTER_MS` 450 对散块多的作品仍在掉落中；多步站小图换样硬切；放大收起 / 示范手消失 / 路由切换无过渡；进站 0.6 s 内抓块延迟 splat 会在手里触发 | `IslandDoneScreen.tsx:150–164`、`AlbumScreen.tsx:35`、`LevelScreen.tsx:472–480`、`_layout.tsx:20`、`use-draggable.ts:135` | 各 0.5–1 h（`cancelAnimation(sx/sy)` 于 onStart；Stack `animation: 'fade'` 在 web 需验证） |

### H. 声音 — 7（新）；置信度 低（没有听）

音效总表（频率 / 滑音 / 起始 / 时长 / 波形 / 增益 × 0.22）见附录 8.4；语音：选中 Tingting（zh）/ Samantha（en，桌面 Chrome 会选 Google 联网音色），rate 0.9，pitch 1.1，"两"已生效（"一共 两 块""拼出 两 块"）。峰值：单音 −25…−16 dBFS，success + drop 同毫秒最坏 −10.7 dBFS，远离削波；音效比系统 TTS 低约 8–15 dB——"压在语音下面"做到了，可能压得太多。

| # | 严重度 | 发现 | 证据 | 建议 / 成本 |
|---|---|---|---|---|
| H-1 ★ | P2 | 过关音与落下音同一毫秒排程、过关在前：第一音 C5 被全表最响的 drop（330→220 triangle + 1320 咔）盖住，先"对了"再"落地" | 主视口每次过关 sfx 记录；`LevelScreen.tsx:230` 早于 `Stage.tsx:127` | `notesFor('success'/'fanfare')` 每个 `at` + 0.1（`sfx.test.ts` 上限仍满足）。0.5 h |
| H-2 | P2 | 低音音效（blocked 140–200 Hz、adjust 349–440 Hz 纯 sine、drop 220–330 Hz）在手机喇叭（< 300 Hz 大幅衰减）可能几乎听不见，"放不下 / 需要调整"失去听觉信号 | `sfx.ts:65,72–73,93–94` | blocked 加 `{ f: 400, to: 320, dur: 0.06, type: 'square', gain: 0.15 }`；adjust 改 triangle。1 h + 真机 |
| H-3 | P2 | 再数一遍 / 移动积木后旧数词与"一共 n 块"继续念；点数队列逐句排队不合并（10 块点完还要念 3–5 s） | `LevelScreen.tsx:314–322` 与 `:206–247` 无 `voice.stop()`；`SandboxScreen.tsx:160–168` 同 | `onRecount` 开头 `voice.stop()`（两处）；集合变化且有数词在队列时 stop；数词 rate 1.1 或队列 ≥ 2 时只留最新。1–2 h |
| H-4 | P2 | iOS Safari `cancel()` 后紧接 `speak()` 可能丢句或卡 paused（代码路径风险，未真机复现） | `speak.ts:82–90` 同步 cancel + speak | cancel 后 `synth.resume?.()`，`speak` 延 50 ms。1–2 h；先按 8.7 听测清单第 10 条测 |
| H-5 | P2 | counted 的收尾 G5→C6 正是 success 第 3–4 音：数完一个错答案也像半个过关；adjust 第二音上扬收尾与 pickup 同方向，【假设】被当成"对了" | `sfx.ts:87–88` vs `:100–101`；`:93–94` | counted 收尾改成相对最后点数音的属→主（sine）；adjust 第二音改下滑 A4→F4 做对照组。0.5 h |
| H-6 ★ | P3 | 同一进站 jingle 两次（见 D-4）；首次触摸前的音效全部丢失（深链接 / 刷新关卡页无进站音，地图第一次 ▶ 无 tap）；点数 15–17 的高八度 triangle 层 2.1–2.6 kHz；英文 "one. one blocks"；`audioSession = 'playback'` 会打断家长手机的后台音乐；岛收尾与 Boss 用同一段 fanfare | `sound.ts:52` 事件表无 touchstart / pointerdown；`sfx.ts:80`；`copy.ts:38`；`sound.ts:44–47`；`IslandDoneScreen.tsx:98` | 各 0.2–1 h；playback vs ambient **需要 Ted 决定** |

Ted 的 5 分钟真机听测清单在第 7 节末尾（8.7）。

### I. 可用性与无障碍 — 7（新）；置信度 中

Lighthouse 移动端（/）：Accessibility 88、Best Practices 100、SEO 73；失败项 `document-title`（空）、`meta-viewport`（`user-scalable=no`）、`label-content-name-mismatch`（站点 aria-label "ch1-n4 completed" vs 可见 "3"）。触摸目标：26 种按钮里 23 种 ≥ 44（88%）；不达标：云朵数字 24×70、菜单 ⚙ 40×40、家长区小站 48×40。

| # | 严重度 | 发现 | 证据 | 建议 / 成本 |
|---|---|---|---|---|
| I-1 ★ | P2 | `hitSlop` 在 RN-web 是空操作：`ui.tsx:41,96` 的 `hitSlop={8}` 不生效，DOM 命中区 = 可见尺寸；菜单 ⚙ 实际 40×40、家长区小站 40 高 | `node_modules/react-native-web/dist/exports/Pressable` 无 hitSlop；实测 DOM | 删掉或改 `padding: 8, margin: -8`；⚙ `size={48}`；chip `height: 44`。0.5 h |
| I-2 | P2 | 缩放被禁（`maximum-scale=1, user-scalable=no`）：WCAG 1.4.4 违反；但 iOS Safari 本就忽略它，真正挡住捏合的是 `touch-action: none`；对四岁双指误缩放是正收益 | `+html.tsx:12`、`global.css:22` | 保留，在 D-xxx 记一条决策（"禁缩放：拖拽优先，家长区文字 ≥ 15 px 作补偿"）。0.2 h |
| I-3 ★ | P2 | 家长门长按 600 ms：短按零反馈（无声无动），界面上没有任何提示（只在 `accessibilityHint`）；iOS 长按呼出菜单靠 `-webkit-touch-callout: none` 挡住（未真机）；【假设】孩子常按住不放 → 误入家长区后两次点击即可清空全部进度 | `ui.tsx:78–103`；`ParentScreen.tsx:201–209` 二次确认只有文字 | ⚙ 短按一声 tap + 120 ms 小晃仍不打开；重置确认改成"长按 1.5 s 清空"。1 h |
| I-4 | P3 | 可访问名：菜单按钮 label 英文 "menu"；站点 label 是内部 id + 英文状态；`accessibilityState` 不映射 `aria-disabled`；家长区 chip 用 `aria-selected`（button 不合法）；沙盒禁用键无 `aria-disabled`；积木无任何 role（拖拽无单指替代，WCAG 2.5.7，已知边界） | `LevelScreen.tsx:551`、`MapScreen.tsx:174`、`ParentScreen.tsx:155`、`SandboxScreen.tsx:41` | 各 10–30 min；积木 a11y 不建议本轮做 |
| I-5 | P3 | 最小字号：沙盒工具标签 12 px、横屏卡片详情 12 px、`recountLabel` 12 px；`html lang` 固定 zh-CN；`document.title` 为空 | grep fontSize；`+html.tsx:8` | 12→13/14；lang 随 `state.language`；`<Head><title>` 或 `document.title` 赋值。1 h |
| I-6 ★ | P3 | 安全区：`useSafeAreaInsets` 只在关卡 / 地图 / 家长区用了 top；compact 竖屏（375×553、360×640）底栏按钮底边距屏底 2–3 px；地图底栏 `insets.bottom + 16` | VP-375 / VP-360 实测 | compact 页脚底部 ≥ 8 px。10 min |

### J. 性能 — 7（新）；置信度 中

数字见附录 8.5。要点：dist 4.6 MB、JS 2.42 MB（gzip 596 KB）两个 1 MB bundle 占 95%；Fast 3G + CPU 4×（本地无压缩）冷开关卡页 **14.98 s 才有第一块可拖**，到齐前没有任何文字（线上 br 压缩估 4–5 s）；作品册冷加载 LCP 1.06 s（CPU 4×）全是 JS 解析；交互 trace（CPU 4×）：5 次拖拽、过关 + fanfare + 彩纸 + 小车、作品册 19 卡滚两遍——**零长任务、最大帧间隔 18–39 ms**；唯一卡点是前进仪式：地图挂载 308 ms + 关卡挂载 198 ms（1× 约 77 / 50 ms），Stack 同时保留两张地图；heap 18 / 21 MB 无增长。

| # | 严重度 | 发现 | 证据 | 建议 / 成本 |
|---|---|---|---|---|
| J-1 ★ | P2 | 首屏完全依赖 2.4 MB JS，到齐前空白；无 service worker，断网 / 二次打开仍全量下载（html 无 cache 头） | 8.5；`dist/index.html` 预渲染空壳 | `+html.tsx` 纯 CSS 占位（天空 + 云 + 标题，1 h）；Vercel 给 `_expo/static/**` 加 `immutable`（0.5 h）；最小 service worker 预缓存（**需要 Ted 决定**是否进范围） |
| J-2 ★ | P2 | 前进仪式两次长任务（308 / 198 ms @4×），跳跃起步前一次停顿；两张地图同时在内存 | trace-map-hop 窗口 7 个长任务、1 帧 51 ms；DOM 两个 `map-trophy` | `StopDot` / `Face` memo、只给当前 / 下一站 blink；或仪式做成关卡页内覆盖层，落地后才 replace。2–3 h |
| J-3 | P3 | `icon-512 / icon-180` 都是同一张 1024×1024、780 KB；dist 多打三份 Fredoka；本地 `serve-dist.mjs` 不压缩导致所有本地网络数字偏慢 | `public/`；`_layout-*.js`；`tools/serve-dist.mjs` | 各 0.3–0.5 h |

### K. 健壮性与状态 — 8（新）；置信度 高

存档层是最硬的一块：读失败 / 超时 / 写失败 / 重置竞争 / 坏档备份 / 未知版本都有分支、测试与文案。本轮实证（★）：v1 两份冻结夹具、v2 全通、v3（5/6/8/9 有旧作品 + 作品册 2 + 沙盒 3）种入后：完成记录全保留、语言保留（v3 英文）、作品册 2 条与沙盒 3 块保留、被收起的站与家长区文案逐站正确（"数字岛 第 10 站、第 12 站" / "stop 5, 6, 8, 9"）、`progress.before-upgrade` 备份出现；直开锁定站 `/play/ch2-n7`、不存在的 `/play/xyz`、未完成的 `/island/ch1` 都回到 `/`；私密模式（Storage 抛错）→ 家长区"读取存档失败（可能是隐私模式…）" + "重新读取存档"按钮，游戏可玩。

| # | 严重度 | 发现 | 证据 | 建议 / 成本 |
|---|---|---|---|---|
| K-1 ★ | P2 | **升级不落盘**：迁移只发生在内存，存档里仍是旧 contentVersion（v1 夹具二次加载 `cv` 仍 1、长度 7090 与备份相同），所以每次打开都重新迁移、家长区每次都显示"存档已自动升级…已收起"，直到孩子做出第一个改动 | 四份夹具 `/parent` 重载后 status / upgraded 文案不变，`localStorage` 两键等长 | `progress-store.tsx` 在 `issue === 'upgraded' || 'repaired'` 时立即 `save(state)` 一次（经同一 saver）。0.5 h |
| K-2 | P2 | 旧存档升级后作品册为空：`migrate` 不回填 `album`，19 站全通的 v2 存档也显示"拼对一站，作品就会住到这里"（进站才补录） | `migrate.ts`；v2 夹具 `/album` 空 | migrate 时把 `nodes[*].work` 中仍 matched 的作品回填进 album（用 `judge` 核一次）。2–3 h |
| K-3 | P2 | 无离线壳：添加到主屏幕后断网打开是浏览器错误页；家长区文案"像 App 一样"抬高了预期 | 无 service worker；`ParentScreen.tsx homeTip` | 见 J-1 |
| K-4 | P3 | 只有 `/play` 有 `ErrorBoundary`；多标签页最后写入者赢；直开 `/parent` 时"返回"无历史可回；未来 `schemaVersion` 当作 corrupt（回滚部署后文案误导）；`read-timeout` 之后迟到的成功读取被丢弃；沙盒 / 作品册损坏沿用"有几站…已重置这些站"文案（todo #14）；`/play/ch1-n1/` 尾斜杠本地与 Vercel 行为不同 | K 小节 #3–#9 | 各 0.3–1 h |

### L. 双语 — 7（新）；置信度 中

所有儿童句子在 `copy.ts` 一张表（`copy.test.ts` 锁占位符对等），7 个屏幕各自有 zh/en 表，`state.language` 贯穿；切语言即时、不重置积木（★）。

| # | 严重度 | 发现 | 证据 | 建议 / 成本 |
|---|---|---|---|---|
| L-1 | P2 | 360 / 375 宽英文下 ch1-n12 答对底栏 "Number Island done!" + "Play again" 并排溢出屏幕（`r4-29`）；横屏 168 px 侧栏里 "Join Island is done!" 折两行出屏（G/VP） | canvas 实测 Fredoka 700 19 px 宽度；`LevelScreen.tsx:447,668` | 岛尾短文案（"Done!" / "Island done"）或 `numberOfLines={1}` + `adjustsFontSizeToFit`。1 h |
| L-2 ★ | P3 | 英文 "one. one blocks"（ch1-n1 点卡片）；zh "还不到 二，再拿一块"（量词外的 2 读"二"合理但与"两块"不一致）；`document.title` 空、`html lang` 固定 | `copy.ts:38`；主视口 speech 记录 | 加 `feedback.matched.quantity.one`；其余见 I-5。0.5 h |
| L-3 | P3 | "语音语言 / Voice language" 实际切整个界面；`MENU.close` zh "继续" / en "Play" 语义漂移；菜单 label "menu" 英文；`count.progress` 死 key；重置后语言回到中文 | `ParentScreen.tsx:19,51`；`LevelScreen.tsx:29`；主视口重置实测 | 文案各 5 min；重置保留语言（`reset` 时带上 `language`）0.3 h |

### M. 家长体验、安全与隐私 — 7（新）；置信度 中

隐私：/、/play、/album 的全部请求同源（html / js / css / ttf / png / favicon），无外部域名、字体 CDN、追踪、Linking（★）。家长五件事（换语言、关音效、全屏、从某站开始、重置）进去后都能不看文档完成；问题在"进去"这一步和几处文案。

| # | 严重度 | 发现 | 证据 | 建议 / 成本 |
|---|---|---|---|---|
| M-1 ★ | P2 | 家长区入口不可发现：长按提示只在 `accessibilityHint`，短按零反馈；README 的说明家长不会读 | `ui.tsx:93`；主视口短按实测无反应 | 首次打开地图时在 ⚙ 旁显示一次"按住 ⚙ 进家长区"的小气泡（localStorage 记一次）；短按给反馈（I-3）。1 h |
| M-2 | P2 | `manifest.json orientation: "portrait"` 与 `app.json orientation: "default"`、横屏布局、spec"竖屏优先不锁"矛盾：添加到主屏幕后横屏被锁死 | `public/manifest.json`；`LevelScreen` 有完整横屏布局 | 改 `"orientation": "any"` 或删掉。5 min |
| M-3 | P2 | 新部署后旧标签页客户端导航懒加载旧 hash 路由块 → 404 → 白屏（需成人刷新）；无 cache 头 | `entry-*.js` 懒加载 5 个路由块；`vercel.json` 无 headers | `vercel.json` headers：html `no-cache`，`_expo/static/**` `immutable`；路由块加载失败时 `location.reload()` 兜底。1 h |
| M-4 ★ | P3 | 图标：`icon-512.png` 与 `icon-180.png` 是同一张 1024×1024、780 KB；重置后语言回中文（L-3）；"音效：开"按钮同时是状态和动作；"语音语言"标题不准；chip 两个"4"；`corrupt` 文案"已备份"家长无法触达；沙盒 / 作品册损坏文案不准（todo #14）；`vercel.json` `/album` `/sandbox` 规则与 `cleanUrls` 重复 | M 小节 | 各 5–30 min |

### N. 代码与架构质量 — 7（新，主评审自查，范围缩减）；规格一致性 5；置信度 中

因用量限制，原计划的三名代码评审员没有跑完；以下是主评审用 grep + 其它维度已核实的事实拼出的清单，**不是完整的高档位 code review**。

| # | 严重度 | 发现 | 证据 | 建议 / 成本 |
|---|---|---|---|---|
| N-1 ★ | — | 做得对的：core / content / progress 的纯度边界守住（`lint:purity` 零命中），screens / blocks-ui 没有一处绕过模块入口直接 import 内部文件；无 `dangerouslySetInnerHTML` / innerHTML；URL 参数只经 `makeNodeId` 断言后交给 `enter`，非法 id 回地图；存档经 codec 校验再进 Map（无原型污染路径）；657 个测试、core 100% 覆盖、fast-check 守恒属性 | grep；K 实证 | — |
| N-2 | P2 | 手势层零自动化：`use-draggable.ts`（223 行）没有测试文件，Stage / MapScreen / ParentScreen / AlbumScreen / IslandDoneScreen 不在覆盖率统计里，`progress-store.tsx` 81.9%；本轮发现的 B-1 / E-5 / VP 出屏问题没有一个会被现有测试抓到（布局测试只量纯函数几何，不量真实 DOM） | `package.json collectCoverageFrom`；`ls src/blocks-ui/*.test.*` | 给 use-draggable 补 jsdom 四结果测试（moved / same / rejected / blocked）；加一条"岛收尾页与关卡页在 PHONES 每个视口按钮都在屏内"的 jsdom 版面测试。1 天 |
| N-3 | P2 | 无 CI（无 `.github/workflows`）；RN 仍固定 `0.88.0-rc.4`；expo-doctor 14 包漂移（4 个 minor） | `ls .github`；`package.json:25` | GitHub Actions 跑 lint + typecheck + purity + test:gate + build:web（1 h）；发布前 `expo install --fix` 评估 RN 正式版（0.5–1 天含回归） |
| N-4 | P3 | 9 个依赖零 import：expo-image、expo-symbols、expo-glass-effect、@expo/ui、expo-web-browser、expo-device、expo-linking、expo-constants、expo-system-ui（模板残留；是否进 bundle 取决于 autolinking / metro tree-shaking，未量） | grep `from '<dep>` 零命中 | 逐个移除并重跑 build:web 比较 `__common` 体积。1 h |
| N-5 | P3 | LevelScreen（675 行）与 SandboxScreen（333 行）重复：点数轮次、示范手计时、Stage props、几何、安全区、横屏分栏各一份；AlbumScreen / IslandDoneScreen 的只读 Stage 各一份 | 两文件对照 | 抽 `useCountingRound` / `useDemoHand` / `useStageGeometry` 三个 hook；接受一定重复（本轮不建议大重构）。1 天 |
| N-6 | P3 | 死代码 / 死 token：`reducer.newVariant` 无 UI；`juice.useHop` 只是别名；`BlockColors.text`、`THEME.lock/lockText`、`count.progress` key 零调用；`core/inventory.ts`、`progress/demo-helpers.ts`、`content/schema.ts` 0% 覆盖（类型 / 占位文件） | F-5、L-3、覆盖率报告 | 删或加断言。0.5 h |
| N-8 ★ | P3 | `MapScreen` 在渲染期调用 `setAsked`（render-phase setState）：有 `asked === undefined` 守卫所以幂等，StrictMode 双渲染也安全，但它把"读一次路由参数"藏在渲染里；`advance` 一旦读到就不再随参数变化（同一地图实例收到第二个 `?from&to` 会被忽略） | `MapScreen.tsx:284–288` | 改成 `useState(() => advanceOf(params, state))` 需要 state 先就绪——现状可接受，记一行注释即可。0.2 h |
| N-9 ★ | P3 | `Stage` 每次渲染重建全部 `Gesture.Pan()` / `Tap()`（`use-draggable.ts:75–77` 自述），拖动跨格时 `setPreview` 让整个 Stage（17 站 ~6 对象 + 25 槽位 + 30 点阵）重渲染；CPU 4× 下未见长任务（J.3），但这是低端安卓最先掉帧的地方 | `Stage.tsx:170–205`、`use-draggable.ts:172–185` | 预览层单独成组件、只订阅 `preview` 状态；`units` / `partners` 数组用 `useMemo` 按 `state` 缓存。2 h。先真机看再做 |
| N-10 ★ | P3 | 非空断言与 `as Cell` 集中在三处且都有前置保证（`allOnBench` 过滤、`advanceOf` 校验过的 id、`looseOnBench` 来自 bench keys）；`LevelScreen` 的两处 `eslint-disable react-hooks/exhaustive-deps`（进站 effect 只按 `puzzle` 跑、enter 掉落只在挂载时跑）是有意的，注释写清了理由 | `Stage.tsx:143–156`、`MapScreen.tsx:400–403`、`LevelScreen.tsx:140`、`use-draggable.ts:139` | 不改；把两处 disable 的理由补成测试（"保存作品不重建会话"已有） |
| N-7 ★ | P2（规格） | 规格停在 2026-10-13 / 10-14：`SPEC-screens.md` 结构树缺 AlbumScreen / IslandDoneScreen / SandboxScreen / `/island` `/album` `/sandbox` 路由，仍写"角落小菜单（地图 / 语言 / 全屏 / 帮助 / 撤销）"（D-043 已精简）、调整卡图标写 ↻（代码是 💡）；`SPEC-blocks-ui.md` 缺 DemoHand / Confetti / cheer / WorkPicture / picture；`SPEC-content.md` 的 bounds 规则（ch1 6×5 / ch2 8×6）已被 D-037 推翻；`SPEC-progress.md` 缺 album / sandbox / startAt；`SPEC-audio-i18n.md` 缺 sfx；`CAPABILITY-MAP.md` 状态行停在 10-13 | 各文件 | 规格已不能作为真相来源；按 D-037…D-055 回写一次（半天），并把"改代码必改规格"写进 todo 的 checkpoint 模板 |

### O. 文档一致性 — 5（新）；置信度 高

| 文件:行 | 过时 / 矛盾 | 现状 | 建议 |
|---|---|---|---|
| `docs/level-progression.md:37–38` | 形状花园 "6、4、9 / Boss 8"，大伙伴山 "10、7、12" | v4 是 5(3+单块)、4 变身、6 塔、8 砖(4+4)；9、10、12、17；没有 7 站 | 重写 §3 表，或在文首标"候选路线，现状见 README" |
| `docs/level-progression.md:105` | "第二章 8 个示例节点"、"预览过关" | 合体岛 7 站；预览过关早已删除 | 删改 |
| `docs/learning-stages.md`（v0.3，2026-10-12） | "尚未做正式双语语音 / 真机 / 儿童验证" | 语音已做（speechSynthesis）；真机 / 儿童仍未 | 更新状态行 |
| `docs/prd.md` §5.2 | "语音建议采用准备好的短音频" | 实际 `speechSynthesis`（D-031） | 改为现状 + 说明 |
| `docs/prd.md` §7 / §12 | 作品墙是"候选 / 不是当前必须决定" | 作品册已上线（Phase 16） | 同步（todo #9） |
| `README.md:53` | 下一步 1 指向 "Phase 11 末尾列出的待验证项" | 待验证项已滚到 Phase 15–17 | 改指向 |
| `README.md` 当前实现 | "单块与整组伙伴分别拖动…诱饵伙伴要自己挑" | 诱饵是软的（C-6） | 一句话改"凑到就算" |
| `AGENTS.md` | "Use bunx if bun.lock present" | 项目用 pnpm，无 bun.lock | 无害，可删 |
| `spec/CAPABILITY-MAP.md` | "expo-audio 待 audio-i18n 再装"、状态 2026-10-13 | 用 Web Audio 合成，未装 expo-audio | 更新 |
| `spec/SPEC-screens.md:44` 等 | 见 N-7 | — | — |
| `tasks/todo.md` Phase 16/17 | "harness 在会话草稿目录…系统清理后就没了" | 本轮同样（复现脚本不在仓库） | 把 Playwright / devtools 的 harness 收进 `tools/`（需 Ted 决定） |

### P. 与前四份复审对账 — 见第 4 节

### Q. 竞品参照（来源是我的记忆，不代表这些产品的当前版本）

| 产品 | A 学习科学 | C 可玩性 / 关卡 | D 奖励 | E 视觉 |
|---|---|---|---|---|
| Numberblocks 官方 app（Learning Apps / Hide and Seek） | 每个数字是有名字、会说话的角色，"数字 = 角色"的记忆点强；Amber 的伙伴有脸但没名字、不说"我是五" | 以短片段 + 迷你游戏为主，深度浅；Amber 的拖放判定更"真" | 奖励是角色互动与集齐，Amber 刚补上作品册 | 官方 IP 美术；Amber 的原创玩具语法已成体系 |
| Khan Academy Kids | 每个活动有明确的"要求孩子做"（点数必须点完、说出总数）并自适应难度；Amber 0 站要求点数 | 活动量大、每个活动 1–2 分钟；Amber 19 站约 20 分钟一轮 | 收集贴纸 + 角色引导，有"今天的路径"；Amber 第三天回来没有"今天玩哪个" | 插画统一、角色常驻引导；Amber 没有引导角色 |
| DragonBox Numbers | 把数字做成可拆可合的"Noom"：拆分是核心动词；Amber 只有合没有拆 | 沙盒 + 任务双轨，沙盒里什么都能拆；Amber 沙盒无伙伴 | 完成任务解锁沙盒物件；Amber 沙盒常开、无解锁 | 角色化数字、触感反馈强 |
| Moose Math | 每个小游戏对应一个明确技能（数、比较、加），家长报告；Amber 家长区没有"练了什么" | 商店 / 城市建造作为元循环；Amber 地图是线性路径 | 建造城市 = 长层奖励；Amber 奖杯是终点不是过程 | 卡通、色彩饱和 |

三条可借鉴的具体机制：
1. **"数完才走"的最小版本**（Khan Kids）：只在 4 个 Boss 要求点完再出现"下一站"（A-1 的 `COUNT_TO_PASS`）；与 PRD §5"过关靠点击前进"兼容——点数本身就是点击。0.5–1 天。
2. **拆分动词先进沙盒**（DragonBox）：沙盒加一个 7 的伙伴，允许从伙伴上拖走一块（core 加 `split` 或让沙盒用散块材料拼成"伙伴"的视觉），不判题；再决定要不要"拆开岛"。1–2 天（需 Ted 决定 #10）。
3. **"今天从这里开始"的角色引导**（Khan Kids / Moose）：第三天回来时地图上当前站的角色说一句（点了才说，符合语音红线）并有一次小动作；加"作品册 → 再拼一次"直达。0.5 天。

### VP. 七个视口的交叉发现（主视口 390×844 之外）

| 视口 | 结果 | 特有问题 |
|---|---|---|
| 375×553（SE，compact） | 全部路由无横向溢出；作品册 / 沙盒 / 菜单在屏内 | **P1** `/island/ch1` 按钮 y=559 > 553 出屏、无滚动暗示（`r4-18`）；**P1** n12 34 px（`r4-19`）；底栏 ⚙ 与 n5 重叠；页脚距屏底 2–3 px |
| 360×640（Android，compact） | 无溢出；按钮都在屏内 | n12 39 px；**n6 托盘被压到 61 px 高、托盘块 45**（`r4-20`；★ 主评审复核：bench 325×325 / cell 65，tray 336×61，托盘块 45×45）；n7 托盘 260 px 只用 42；作品册按钮盖住 n6；合体岛算式 22 px vs 数字 48 px |
| 667×331（SE 横屏） | 菜单两列在屏内；作品册 4 列 | 岛尾按钮折两行 y 261→344 > 331（`r4-21`；★ 主评审复核："数字岛完成了" 162×84，底边 344，屏内只露上半，底部仍可点中）；scrollTop 0 时 ch1-n2 整个被底栏盖住（`r4-22`）；作品册"回地图"盖住 4 张卡；托盘块 40–41 |
| 667×375（横屏） | 同上 | n12 cell 41、托盘 25 个槽位但工作台下方 146 px 空着（side 排布把所有对象都塞进托盘）；岛尾按钮右缘越过侧栏 5 px；底栏内层拦截站点点击 |
| 768×1024（iPad 竖） | 无任何出屏 / 溢出；cell 固定 84 | 托盘空沙 290–384 px（`r4-24`）；岛收尾页下方 400 px 空白；放大图 cell 52 < 关卡 84；家长区"返回"刚好在折线下 |
| 1024×768（iPad 横） | 无溢出 | **"下一站"右侧 25–40% 被舞台沙丘装饰挡住**（`pointer-events: auto`、`left: -40`，`r4-23`）；侧栏 168 px 文字 15 / 12 px 偏小；最后一站压岛底边；彩纸粒子落到视口外撑高滚动容器 |
| 1280×800（桌面 sanity，★） | 不崩、无横向溢出、cell 84 | 同样的"下一站"右侧死区（80% / 95% 处命中沙丘）；岛尾按钮 160×82 折两行 |

## 4. 与前四份复审的对账表

状态口径：已修 / 部分 / 未修 / 回归 / 决策保留，证据在代码里核实（不只信 todo 自述）。闭合率：implementation + child-UI 两份 36 条 → 已修 22 / 部分 10 / 未修 4 / 回归 0，严格 61%、加权 75%；play + game 两份的 §4 / §5 条目见下表（第一档 A–G、第二档 H–M 全部已修，第三档 N / P / R 未做）。**修复引入的新问题**：D-037 空沙坑与小屏 34 px；D-038 错作品可被带走；D-041 连点跳过与进站音两次；D-043 ⚙ 零反馈；D-044 重排后 wave / stack 在 2–3 个对象上不成立；D-035 的半格容差把同块连点也算数。

### 4.1 实现审查（2026-10-14）与儿童 / 游戏 / UI 复审（2026-10-14）

| # | 历史发现 | 状态 | 当前证据 | 评语 |
|---|---|---|---|---|
| I-1 | P1 搬出整组制造虚假独立槽位，托盘重排 | **已修** | `src/blocks-ui/tray.ts:20-39` `trayObjects` 开题一次定对象集（伙伴一对象 / 单块一槽），`:78-125` `trayView` 只改占用；`tray.test.ts:109` 即复审复现（ch1-n10 搬出一个 5，其余对象位置 / 比例不变） | 按建议原样落地，连回归测试都是复审的 repro |
| I-2 | P2 托盘只检查宽度不检查高度 | **已修** | `layout.ts:228-239` `fitTray` 同时比较 `rowsHeight ≤ innerHeight`，每行取自己最高项，行距计入；`layout.test.ts:2-4` 对 `PHONES × CHAPTERS` 全题库跑边界 | 已修；代价是工作台随之缩小、托盘空沙（§3 R-2） |
| I-3 | P2 成功反馈重复；`solved = justMatched \|\| completed`；replay / newVariant 无入口 | **部分** | 反馈：`LevelScreen.tsx:204-247` `update(next, solvedNow)` 只在 `solvedNow` 时 `setCelebration` / `play('success')`，`:442` `solved = session.verdict.matched` 只看当前 verdict；replay：`:326-327` `onRechallenge → dispatch({type:'replay'})`，菜单 `restart`（`:605`）+ 卡上 `again`（`:487-489`）；**newVariant**：`reducer.ts:111` 有，`grep newVariant src` 非测试零引用 | 三件修了两件半；"换一题"仍是有管道没有水（todo 第三档 N） |
| I-4 | P2 存储失败白屏 / 未处理拒绝 / 无写队列 | **已修** | `progress-store.tsx:28,68,76,80,130` `mode: 'memory'` + `issue`；`store.ts:97-140` `createSaver` 单写者、合并连续 save、reset 排在在途写之后；`reliability.test.ts:77-93,193-210` 读拒绝 / 同步抛 / 乱序 / 写失败 | 完整；失败只在家长区提示，孩子路径不受影响 |
| I-5 | P2 存档只校验结构不校验引用 | **已修** | `sanitize.ts:50-57` `checkNode` 核 `ref.nodeId === key`、`chapterId`、`contentVersion`、`attemptVariant`；`sameMaterial`（`:20-40`）核作品材料；`reliability.test.ts:103` 即复审的 ref 999 repro；`LevelRecovery.tsx` 关卡兜底页 | 完整 |

| # | 建议 | 状态 | 当前证据 | 评语 |
| I-P1 | 整组点数补上 | **已修** | `Stage.tsx:393` benchPartners `onTapBlock → tapAt(group.unitIds[i])`；B 小节实测 10 伙伴逐块念数 | 完整 |
| I-P2 | 加法成功显示 a + b = n | **已修** | `level-session.ts` 导出 `solvedEquation`；`LevelScreen.tsx` 云朵标题用它 | 算式有了；"变成 7"的积木层事件仍无（R 项，todo 推荐下轮） |
| I-P3 | 帮助语按材料类型区分 | **已修** | `hints.ts:111-146` `canFill` 按托盘里剩余伙伴 / 单块算可达性；`copy.ts:63-65` `hint.count-mismatch.fewer / more / hint.fewer.partner`、`hint.swap.partner`、`hint.stuck.named`；本轮脚本 ch1-n5 单块 4 块 → "先放回 2 块，再把 3 搬过来" | 文案已按材料分；但 n5 这条正好暴露 D-044 的新问题（§3 R-1） |
| I-P4 | 帮助更易发现：可见喇叭、新题型首次短示范 | **部分** | 喇叭：`AnswerFeedback.tsx:31-35` 画成 40 / 34 / 26px 按钮；示范：`LevelScreen.tsx:34-39,171-186` 空工作台 5s（首站 1.8s）出示范手，每次进站最多 2 次，`DemoHand` 搬整个伙伴（`Stage.test.web.tsx:66`）；**不按"题型首次出现"触发**，任何站空台都示范 | "点卡片 = 帮助"仍是隐藏约定（B-3）；示范不是复审说的"新题型首次" |
| I-P5 | 允许重新点数 | **已修** | `level-session.ts:142` `recount`；LevelScreen 有 48px `again` 按钮 + 标签 | 完整 |
| I-P6 | 地图定位当前关卡 | **已修** | `MapScreen.tsx:325-345` `islandTops` + `scrollTo(centre − viewport/2)` | 完整 |
| I-P7 | 家长可选章节 | **已修** | `ParentScreen.tsx:139-170` 岛 / 站两级 `startAt`；`reducer.ts:100-102` 只改 `current`；D-046 | 完整；C#5 指出从中段开始时前面站锁态显示是残留边角 |
| I-P8 | 自由和文案边界 | **已修** | `copy.ts:36` `prompt.sum_composition` "找两个伙伴，拼出 {n}" | 完整 |
| I-E1 | 保留 core / content / progress 纯 TS 边界 | **已修（维持）** | `package.json:55` `lint:purity` 门禁，本轮零命中 | 维持且上了门禁 |
| I-E2 | 测试投入界面集成（Stage、手势 hook、页面、ProgressProvider） | **部分** | 覆盖率统计 `package.json:99-118` 加入了 `LevelScreen.tsx`、`SandboxScreen.tsx`、`progress-store.tsx`、`hints.ts`、`tray.ts`；**`Stage.tsx`、`use-draggable.ts`、`MapScreen.tsx`、`ParentScreen.tsx`、`AlbumScreen.tsx` 不在统计内**；`use-draggable.ts` 无任何测试文件（`ls src/blocks-ui/*.test.*`）；`Stage.test.web.tsx` 5 个用例 | 复审点名的四类里，手势 hook 完全没测，Stage 测了但不计覆盖；"94.8% screens"不含 Map / Parent / Album |
| I-E3 | 真机检查 Safari 地址栏 / 转屏 / 拖拽中断 / 首次语音 / 主屏恢复 | **未修** | README「已知缺口」首条原样；本轮 r4 仍是桌面无头浏览器 | 两轮未动，是当前最大未知 |
| I-E4 | 原生端 `createSilentVoice` | **未修（范围外）** | `src/screens/voice.ts:8` | 明确不在范围，README 已列 |
| I-E5 | RN 固定 0.88.0-rc.4，发布前做兼容检查 | **未修** | `package.json:25` 仍 `0.88.0-rc.4`；本轮基线 expo-doctor 19/20、14 包漂移 | 两轮未动 |
| I-E6 | 修好 lint 初始化；CI 连续跑门禁 | **部分** | `eslint.config.js` 在，lint 0；**无 `.github/workflows`**，`vercel.json` 也没接门禁 | lint 修了，CI 没有 |
| I-E7 | README / PRD / spec 矛盾（5 站 / 19 站、托盘一行 / 两行） | **部分** | README 已有「当前实现」「已知缺口」，`grep "5 站"` 零命中，托盘描述已改"按宽高排布"；**`spec/SPEC-screens.md:44` 仍写调整卡图标 ↻，代码是 💡**（`AnswerFeedback.tsx:12`）；todo 自认 `docs/level-progression.md` 5–9 站描述过时 | 主干统一了，spec 有一处与代码相反 |
| C-1 | 提示指向物体：分层帮助，先鼓励，求助时点亮，再求助示范 | **已修** | `hints.ts:385-409` `guidanceFor(session, 1\|2)`：L1 只点亮不泄露（形状小图、要接的两伙伴），L2 点名并点亮要送回 / 拿来的伙伴；`LevelScreen.tsx:350-363` 点卡片 / 帮助 → L2；`Stage.tsx:499` `Spotlight` | 两级做了；复审的第三级"再示范一次拖动方向"没有（示范手只在空台） |
| C-2 | 单块与整组长得太像：首次整组示范 + 组外轮廓 / 握把 | **已修** | `PartnerView.tsx:38-47` 同色底板 + `partner-grip`；`DemoHand` 搬整个伙伴（`Stage.tsx:417-437`，`Stage.test.web.tsx:66,85`） | 完整；是否被理解仍需孩子（B 未验 #3） |
| C-3 | 错误放置与数学错误区分 | **已修** | `use-draggable.ts:14-17,84-91` `'blocked'` 摇头弹回；B 实测 200/180Hz 音、卡片不变；`LevelScreen.tsx:114` 纠正 `interrupt:false` | 完整 |
| C-4 | 大数可操作性：真机验证、命中容差 / 局部放大、家长选内容 | **部分** | 容差：`layout.ts:266-300` `COUNT_SLOP 0.5` 吸最近未数块；家长选内容：I-P7；**375×553 的 17 站仍 34px**（B §1 表）、真机未验 | 两件软修，核心（真指头命中率）仍未知；容差本身引入 R-3 |
| C-5a | 重复游玩：Boss 作品独特动作 / 造型册 | **已修** | `cheer.ts` 按数字动作 + 8 车 / 17 挥手（D-045）；`AlbumScreen.tsx` + 存档 `album` 字段 | 完整 |
| C-5b | "再玩一次"会变记位置，另给"换个摆法 / 再找一种组合" | **未修** | `reducer.ts:95-98` `replay` 清 work 重摆同一副牌；newVariant 无 UI（I-3） | 与 I-3 同根 |
| C-5c | 第一次整组题少一个干扰因素 | **已修** | `chapter-1.ts:23` ch1-n5 `handles:[3]` 无 decoy；`validate.ts:67` 只在握把和恰好等目标时强制诱饵 | 完整；但 n8 Boss 同时上形状 + 握把 + 诱饵（C 对账已指） |
| C-5d | 章节收尾："数字岛完成了" + 回顾作品 + 介绍下一章 | **已修** | `IslandDoneScreen.tsx`；`LevelScreen.tsx:386-391` 岛末站转收尾页；D-042 | 完整 |
| C-U1 | 目标与参考更像一个任务 | **部分** | 小图从 11px/格 放大到 20 / 16 / 15（B 对账）；求助时 `Spotlight` 点亮小图；仍是云朵旁小框 | E.4 有量化 |
| C-U2 | 压缩重复信息：一条主指令 + 数量状态 | **部分** | `copy.ts:47-55` 去重为"数量对了，再接起来 / 再找对伙伴"单句；但卡片仍标题 + 详情两行（`AnswerFeedback.tsx:101-104`） | 文案收了，层级没收 |
| C-U3 | ↻ 一符三义 | **部分** | 调整 → `💡`（`AnswerFeedback.tsx:12` emoji），再数 / 再玩 → 手绘 `again`（`icons.tsx:57`） | 三义拆成两义；emoji 跨平台渲染不可控（E-2） |
| C-U4 | 重听 18px 扬声器太小 | **已修** | `AnswerFeedback.tsx:32` 40 / 34 / 26px 圆按钮 | 完整（横屏窄卡 26px 仍偏小，B-5） |
| C-U5 | 组数字与点数序号区别开 | **部分** | `layout.ts:317` `labelSpot` 徽章进轮廓右下、点数圆右上；仍两套数字 | 位置分开，没做"数完突出总量再淡化序号" |
| C-P2a | 布局测试用旧 24px 提示栏 | **已修** | `chrome.ts:6-21` `LEVEL_CHROME` 唯一来源；`devices.ts:40-48` `stageSizeOf` 减 `portraitChrome`；`LevelScreen.tsx:638-666`、`AnswerFeedback.tsx:78` 同一常量 | 按建议"统一布局预算常量"落地 |
| C-P2b | 材料变了 CONTENT_VERSION 没升，旧作品被当损坏清空 | **已修** | `catalog/index.ts:13` `= 4`，`:18-30` `CONTENT_CHANGES` 逐版登记站；`migrate.ts:85-120` 变了的站作品能放下就保留（`onMat`），否则 `setAside`（升级，非损坏）；`upgrade.test.ts:38,150` 用 Phase 11 冻结 v1 夹具 + v2 夹具跑到 `CONTENT_VERSION`；fingerprint 测试防漏升 | 完整；v3→v4 没有独立夹具，靠 v1→v4 端到端覆盖（`upgrade.test.ts:53`） |
| C-V | 待验证：纠正语音"静止"判断不覆盖拖动过程 | **已修** | `correction-voice.ts:30-36` `pause(reason:'menu'\|'drag')`；`LevelScreen.tsx:366-368` `onDragActive → corrections.pause(active,'drag')`；另 `speech-policy.ts` `AUTO_SPEECH.correction=false` 后纠正本就不自动说 | 修了，且被 D-036 架空：现在纠正只点亮不说话 |
| C-N1 | 下轮优先 1：真实布局预算 + 旧档升级回归 | 已修 | = C-P2a + C-P2b | 不计入闭合率（聚合项） |
| C-N2 | 下轮优先 2：首次拖动 / 整组示范 + 指向物体帮助 + 无效落点 | 已修 | = C-2 + C-1 + C-3 | 同上 |
| C-N3 | 下轮优先 3：Boss 收尾 / 作品收藏闭环 | 已修 | = C-5a + C-5d | 同上 |

### 4.2 试玩复审（2026-10-14）与儿童游戏视角复审（2026-10-15）

| # | 复审条目 | 状态 | 当前证据 | 评语 |
|---|---|---|---|---|
| 1 | 横屏菜单超出视口（P1）：7 个按钮纵排无高度限制 | **已修** | `LevelScreen.tsx:592-627`：`menuCard` `maxHeight: '100%'`（:670）+ `ScrollView bounces={false}`；横屏 `menuItemsWide` 换行成两列（:672-673）；菜单只剩 4 项 + ⚙（:601-606）。VP-667x331.md:36 实测 667×331 五个按钮 y 104 / 171 全在屏内 | 按建议做了"可滚 + 紧凑双列"，而且 K 把项数砍到 4，问题根源一起没了 |
| 2 | 庆祝可被重排重触发（P2）：`useHop` 依赖 index；重新挑战不清 tick | **已修** | `juice.ts:29-34` `played` ref：`tick === played.current` 不重放，index 只定 stagger；`LevelScreen.tsx:220,236,306,334` 重排 / 不对 / 撤销 / 重新挑战都 `setCelebration(0)`；`solves` 单调递增（:218,227） | 正是建议的"动画消费明确的成功事件" |
| 3 | 形状参考每格 11px 太小 | **已修** | `LevelScreen.tsx:470` `step = landscape ? 15 : compact ? 16 : 20`，注释写明"it was 11px a cell"；`templatePreview` 带 `Spotlight`（:479） | 竖屏 20px/格，4 方阵 48px 宽；仍在顶栏云朵旁，不在工作台附近（见 §2 4.5） |
| 4 | 轮廓放到工作台附近 + 点击重播提示 | **部分** | 重播：卡片整体是 `Pressable onPress={onReplay}`（`AnswerFeedback.tsx:41-46`）→ `onAskHelp`（`LevelScreen.tsx:348-364`）；工作台上的目标轮廓没有（`Stage.tsx` 只有 `demo-ghost` 示范手） | "点卡片重播"有了；"轮廓在工作台附近"未做 |
| 5 | 帮助入口要清楚的小灯泡 / 喇叭 | **部分** | `AnswerFeedback.tsx:12` adjust 符号 `💡`、:35 喇叭 `Icon speaker` 画成按钮；但复审 10-15 §4.6 追加的"3 s 后喇叭脉冲"没有（`usePulse` 只用在 `Block.tsx:77` 点数上） | 入口可见但仍是"点卡片 = 求助"的隐藏约定；B.md B-3 同一结论 |
| 6 | 提示时把对应伙伴轻量高亮 | **已修** | `hints.ts:239-258 lookHere` level 1 点亮分开的块 / 要接的伙伴；level 2 `focus.objects` 点名要送回 / 要拿的伙伴（:324-334）；`Stage spotlight`（`LevelScreen.tsx:533`） | MAIN n10/n11/n12 实测"把 4 送回去，换 2 过来"同时点亮工作台与托盘对象 |
| 7 | 总量表达：合体后短暂总量高亮 / 整体轮廓 | **未修** | 合体后仍两色两脸，只有云朵算式 `solvedEquation`（`LevelScreen.tsx:433`）；`Stage.tsx` 无合体闪框 | 即 game-review R，todo 推荐下一轮 |
| 8 | 10 / 12 / 17 搬现成伙伴即过关，点数非必需；试玩时观察 | 决策保留 | `judge.ts` 只看数量 / 形状 / 接边；D-038 没有强制点数 | 复审自己也说"默认不强制"，不算缺口；儿童观察未做（§5） |
| 9 | 回地图后视野在数字岛开头，当前站不可见 | **已修** | `MapScreen.tsx:322-345`：首次布局后 `scrollTo` 到 `defaultCurrent` / 前进时两站中点；MAIN"岛收尾 ch1"实测 ch1-n12 (y 282) 与 ch2-n1 (y 484) 同屏 | 按建议"滚动定位当前站" |
| 10 | 家长选章节 / 从某站开始 | **已修** | `ParentScreen.tsx:141-170` 每岛一个按钮 + 每站一个 chip → `dispatch startAt`；`unlock.ts:25-29` `current` 与进过的站开着 | = game-review M，D-046 |
| 11 | 19 关后缺章节收尾 | **已修** | `LevelScreen.tsx:386-391` 整岛完成跳 `/island/[chapterId]`；`IslandDoneScreen.tsx:96-98` fanfare、:136 引导点了才说；全通彩旗奖杯 `MapScreen.tsx:353,445` | = game-review I，D-042 |
| 12a | 验证优先级 1：修横屏菜单 + 实际界面响应式检查 | **已修** | 同 #1；本轮 VP-* 七个视口小节 | — |
| 12b | 优先级 2：限定庆祝事件、形状参考、帮助入口 | **已修 / 部分** | #2 已修、#3 已修、#5 部分 | — |
| 12c | 优先级 3：真机 Safari | **未做** | README.md:18 仍写"未在真机 Safari / Android 上试玩"；todo 每个 Checkpoint 的"未验证"都重复 | 需 Ted |
| 12d | 优先级 4：家长陪同儿童玩代表关卡 | **未做** | README.md:20"没有儿童试玩结果" | 需 Ted |

| 结论 | 对应项 | 状态 | 一句话 |
|---|---|---|---|
| 动作同质、过关动画每站相同 | J、O、L（同量变身） | 已修 | 每数一动作 `cheer.ts:7-19`；4 站两步题；沙盒是第二个动词（随便拼）。质量问题见 §4 #3 |
| 难度 ∧ 形：5–9 站拖 33 次 | L | 已修 | `chapter-1.ts:23-30`，单块 ≤ 6；握把题 5 / 8 / 9 |
| 奖励只有即时层 | H、I、Q、J | 已修 | 前进仪式、岛收尾、作品册、奖杯都在；仪式落地质量见 §4 #4 #5 |
| 界面尺度为最难的题设计 | A | 已修 | `content/bench.ts` `fitBench`；1 站 3×3 84px（MAIN n1）。副作用见 §4 #1 |
| 色彩两处失手 | E | 部分 | 9 / 10 换色 `palette.ts:37-38`；3 号黄 1.37:1 未动（todo 自记） |
| § | 要改的 | 状态 | 证据 | 评语 |
| 4.2 | 点徽章 / 伙伴说"我是五"，角色有名字 | **未做** | `Stage.tsx` 点伙伴走 `tapAt → onTapUnit`（点数）；`PartnerView.tsx:108` 徽章 `pointerEvents="none"`；无"我是 n"文案 | 复审的"最低成本一步"没做；J 做的是动作不是台词。与 speech-policy 一致，不建议加自动语音，但"点了才说"不违反 |
| 4.2 | 拆 / 变身 / 叠 / 转 等新动词 | 部分 | 变身：`chapter-1.ts:24` `sequence: true`；拆：`core/index.ts` 无 split（P 未做） | — |
| 4.3 | 合体岛第三种变化（三伙伴 / 拆开再合） | **未做** | `chapter-2.ts` 7 站题型未变 | 依赖 P |
| 4.3 | 合体岛提示先不显示数字，合体后点数再出算式（至少 Boss） | **未做** | `LevelScreen.tsx:433` 云朵从进站就显示 `3 + 4` | "靠颜色就能排除诱饵"的问题原样 |
| 4.5 | 卡片只留符号 + 短标题，详情只在点喇叭时读 | **未做** | `AnswerFeedback.tsx:37-38` 标题 + 详情都常显；`SYMBOL.start` 仍是 `✦`（:12） | 文字层级未减 |
| 4.5 | 开题时工作台中央淡淡目标轮廓 3 s | **未做** | `Stage.tsx` 只有 `demo-ghost`（示范手） | — |
| 4.5 | 合体瞬间"变成 7" | 未做-计划中 | = R | — |
| 4.6 | 第一次出错 3 s 后喇叭脉冲 / 明确灯泡按钮 | **未做** | 见 §1 #5 | B.md B-3 |
| 4.6 | 新题型（形状 / 整组 / 合体）首次一次可跳过的示范 | 部分 | D：示范手搬"参考解第一步"（`LevelScreen.tsx:437-438`、`Stage.tsx:426-437`）；但触发仍是统一的 5 s 闲置（:36-39），不是"首次进入新题型" | 形状站示范手搬的仍是一块，没有摆形状的示范 |
| 4.7 | 语义撞色：调整卡改白底琥珀描边 | 已修 | `AnswerFeedback.tsx:82-84` | 绿 = 4 = 成功未动（复审也只建议改卡） |
## 5. 「需要 Ted 决定」逐条推荐（tasks/todo.md Phase 17 末尾 1–15 条）

| # | 条目 | 推荐 | 理由 |
|---|---|---|---|
| 1 | 10 号颜色（D-039 改丁香紫，放弃"10 是白的"） | **维持丁香紫** | 任何白色在毛毡上都到不了 1.5:1（F 实算）；"10 是白的"是 Numberblocks 的记忆点但不是 PRD 要求；孩子看得见比记忆点重要 |
| 2 | 关卡里没有回地图（D-043） | **维持，但给菜单 ⚙ 短按一个反馈**（I-3） | 儿童菜单 4 项是对的；回地图是家长动作；问题不在缺按钮而在"按了没反应" |
| 3 | 过关回地图后 0.9 s 自动进站（D-041） | **维持 0.9 s，加 300 ms 防连点**（D-1） | 时长本身要孩子验证（第 7 节）；连点跳过是实测到的漏洞 |
| 4 | 8 砖由两个 4 组成（D-044） | **维持** | 4+3+1 也成砖、也开车（C-6）——"两个 4"只是材料叙事，不限制孩子，正合 PRD"任意摆法" |
| 5 | 旧存档 5/6/8/9 站作品被收起（内容版本 4） | **维持；先修 K-1 升级落盘** | 迁移逻辑正确（本轮四份夹具实证）；但不落盘导致每次打开都提示"已升级"，比收起作品更打扰 |
| 6 | 撤销回到对的样子时作品册也更新（D-048） | **维持** | 作品册是"最新一次拼对的样子"，撤销回到对就是一次拼对 |
| 7 | 进站时补录旧作品进作品册（D-048） | **改为升级时回填**（K-2） | v2 全通存档打开作品册是空的，要一站站进去才补；migrate 回填一次更诚实 |
| 8 | 作品册标题"我的作品 / My builds" | **维持** | 没有更好的两字词；E-6 的字重统一更重要 |
| 9 | PRD 要不要同步作品册 | **同步**（O） | PRD §7 / §12 还写"候选"，而规格、README、todo 都已是现状；三处不一致会误导下一轮 |
| 10 | 沙盒材料（10 单块、无伙伴、无配色） | **先不加配色；加一个 7 的伙伴做"拆"实验**（Q-2） | 簇变色 = 数量是沙盒最好的教学奖励，配色会破坏它（D-051 的理由成立）；"拆"是 PRD §3 goal 4 唯一缺的半边，沙盒是零判定成本的试验场 |
| 11 | 沙盒入口位置（▶ 左边 vs 左组） | **维持右边** | 360 宽左组再加一个会过中线（D-054 实测）；本轮 7 个视口都没发现 ▶ 被误触，只是底栏盖站点（E-5，与位置无关） |
| 12 | 沙盒作品要不要进作品册 | **暂不** | 需要"拍下来"的动作和一个站 id 之外的键；先看孩子在沙盒待多久（第 7 节） |
| 13 | 撤销：沙盒常驻 vs 关卡在菜单 | **统一到关卡底栏左侧放撤销图标键**（B-4） | 两处入口两种样子是孩子要学两次的东西；撤销在关卡里也是高频动作（放错 → 拖回 = 撤销的替代，但撤销更省力） |
| 14 | 家长区修复文案对沙盒 / 作品册不准 | **改**（K-4） | 一行文案："自由玩的摆法 / 作品册里有几张坏了，已收起" |
| 15 | 沙盒里的示范手 | **去掉** | 沙盒没有题，示范"拖一块上去"对已经过了第 1 站的孩子是噪音；D-053 的"不加任何新的自动语音"精神也适用于自动动画 |

本轮新增需要 Ted 决定的：A-1（4 个 Boss 数完才出现下一站）、A-3(a)（散块站托盘不按目标色染）、C-2（合体岛等于目标的干扰对是否有意）、F-1(b)（超过目标的簇不按簇大小变色）、H-6（audioSession playback vs ambient）、J-1(d)（要不要 service worker / 离线）、D-038 的副作用（错的作品能被"下一站"带走存档——建议 `onNext` 时若当前不对就只回地图不前进）。

决策复核（D-037…D-055，在实际体验里是否成立）：D-037 成立但副作用是空沙坑与小屏 34 px（E-1 / B-1）；D-038 成立但错作品可被带走（P2 列表）；D-039 成立；D-040 成立（示范手搬整组、握把、徽章在轮廓内都实测到）；D-041 成立但可被连点跳过、进站音两次；D-042 成立但 375×553 按钮出屏（P1）；D-043 成立但 ⚙ 零反馈；D-044 成立，曲线已修，副作用是 wave 动作在 2 个对象上不成立；D-045 部分成立（8 / 17 清楚，3 / 5 Boss 无专属）；D-046 成立，边角是同岛更早的站仍锁；D-047–D-050 成立（本轮 v1–v3 夹具实证），缺口是升级不回填作品册；D-051–D-055 成立（沙盒流程全部实测），示范手与撤销入口见 #13 / #15。
## 6. 优先级清单

### 第一档：1–2 天

| # | 事项 | 落点 | 成本 |
|---|---|---|---|
| 1 | 岛收尾页按钮做固定页脚；横屏岛尾短文案 + `numberOfLines`；舞台 `ground` 层 `pointerEvents="none"`（P1 + 两个 P2） | `screens/IslandDoneScreen.tsx`、`screens/LevelScreen.tsx` | 0.5 天 |
| 2 | 升级落盘（K-1）、`onNext` 当前不对只回地图不前进（D-038 副作用）、连点 300 ms 防跳过（D-1）、地图落地不响 arrive（D-4）、success 延后 100 ms（H-1） | `screens/progress-store.tsx`、`LevelScreen.tsx`、`MapScreen.tsx`、`audio-i18n/sfx.ts` | 0.5 天 |
| 3 | `countTarget` 同块连点不吸附（A-2）；`recount` / 集合变化 `voice.stop()`（H-3）；ch1-n5 `extra: 3`（A-6） | `blocks-ui/layout.ts`、`LevelScreen.tsx`、`SandboxScreen.tsx`、`content/catalog/chapter-1.ts`（+ 版本 5） | 0.5 天 |
| 4 | 5+2 等价组成的 partners 分支补点亮与肯定句（A-4 / C-2）；adjust 态 3 s 后喇叭脉冲（B-3）；⚙ 短按反馈（I-3）；云朵整朵可点（B-2）；hitSlop 改 padding（I-1） | `screens/hints.ts`、`AnswerFeedback.tsx`、`ui.tsx`、`LevelScreen.tsx` | 0.5 天 |
| 5 | 非成功绿去掉（虚影中性、计数芯片 ink）（F-1a）；3 号 edge / pale（F-2）；`palette.test.ts` 守全部 hue + 渲染对（F-3）；地图 pale 字去掉 0.75（F-4） | `blocks-ui/Stage.tsx`、`palette.ts`、`palette.test.ts`、`MapScreen.tsx` | 0.5 天 |
| 6 | manifest `orientation: any`、icon 真实尺寸、`vercel.json` cache 头、`font-display: swap`、去掉三份未用 ttf、`document.title` / `html lang` | `public/manifest.json`、`public/*.png`、`vercel.json`、`app/_layout.tsx`、`app/+html.tsx` | 0.5 天 |

### 第二档：3–5 天

| # | 事项 | 落点 | 成本 |
|---|---|---|---|
| 7 | 布局预算重分配：托盘高按排布封顶、工作台 + 托盘居中、compact chrome 省 30–40 px、side 排布只为托盘里的对象留位、8 列时允许吃边距；配一条"PHONES 每视口按钮在屏内"的版面测试 | `blocks-ui/layout.ts`、`chrome.ts`、`layout.test.ts`、新 jsdom 版面测试 | 1.5 天 |
| 8 | 过关瞬间编排：落地 → 云朵 pop → 起跳 + 彩纸（140 ms 错开）；阻尼比改 0.42–0.45；cheer 幅度随 cell；对象 < 4 时 wave→pair；Boss 3 / 5 专属；stand transformOrigin 底部；puzzled 轻晃；首帧闪现 `useLayoutEffect` | `blocks-ui/juice.ts`、`cheer.ts`、`Confetti.tsx`、`PartnerView.tsx`、`use-draggable.ts`、`Face.tsx` | 1.5 天 |
| 9 | 地图：底栏底衬 + 内层 box-none + 当前站居中偏上；刚完成的站 ✓ 落下、下一站惊喜脸；奖杯 / 作品册按钮首次出现的动静 | `screens/MapScreen.tsx` | 0.5 天 |
| 10 | 作品册放大按作品外接框；放大视图加"再拼一次"；岛收尾页 Boss 作品用专属动作并错开掉落 | `screens/AlbumScreen.tsx`、`IslandDoneScreen.tsx` | 0.5 天 |
| 11 | 图标统一：手绘 star / check / bulb / hand / sparkle 替换 8 处字形 / emoji；牌子字重；家长区 chip 语法与序号 | `screens/icons.tsx`、`AnswerFeedback.tsx`、`MapScreen.tsx`、`ParentScreen.tsx` 等 | 0.5 天 |
| 12 | 规格与文档回写（N-7 / O）；use-draggable jsdom 测试；GitHub Actions 门禁 | `spec/*.md`、`docs/*.md`、`src/blocks-ui/use-draggable.test.web.tsx`、`.github/workflows` | 1 天 |

### 第三档：下一阶段（先看孩子）

| # | 事项 | 前提 |
|---|---|---|
| 13 | `COUNT_TO_PASS`（4 个 Boss 数完才走）+ Boss 3+4 题面去数字、合体后点数再揭示算式（A-1 / A-4） | Ted 决定 + 第 7 节观察 1、3 |
| 14 | 内容池 + "换一题"（C-3）；合体岛 Boss 改 `sum_composition` 7、3 转角两步（C-1）；合体岛调序（A-7） | 版本 5 迁移 |
| 15 | 大数站的伙伴画法轮廓（A-5）；散块站托盘不按目标色染（A-3a） | 观察 4、5 |
| 16 | 沙盒加 7 的伙伴做"拆"实验 → 拆分命令 → 拆开岛（Q-2 / A-8） | Ted 决定 #10 |
| 17 | 首屏占位 + service worker 离线壳（J-1 / K-3）；RN 正式版与依赖清理（N-3 / N-4） | 部署 Vercel 后 |
| 18 | 合体瞬间"变成 7"的视觉事件（上轮 R，仍未做；可复用簇变色的 220 ms 渐变 + pop） | 与 13 一起定 |
## 7. 真机与儿童验证清单

每条对应一个本报告的【假设】；写清观察什么、怎样算通过。建议带孩子玩：1、2、4 方阵、5、8 砖、10、1+1、自由和 5、3+4，一次 15 分钟。

| # | 假设（来源） | 观察 | 通过标准 |
|---|---|---|---|
| 1 | 孩子会用簇色 / 托盘色匹配而不数（A-3） | 2 站、7 站在卡片出现前问"几块？" | 两站都能说出数量 = 假设不成立 |
| 2 | 孩子会对同一块连点，被静默修正（A-2） | 7 / 8 站点数时看手指是否停在同一块、点亮是否"跑到"别的块、孩子有没有察觉 | 出现 ≥ 1 次且孩子没察觉 = 假设成立，优先修 |
| 3 | 合体岛孩子只找徽章数字（A-4） | 遮住徽章玩 2-5；或看 2-5 / 2-6 从进站到第一次抓取是否先看云朵 | 遮住后完不成 = 成立 |
| 4 | 四岁不能规划 10+5+2（A-5） | 记录 17 站首次过关前放回次数与求助次数 | 放回 ≥ 3 或求助 ≥ 2 = 成立 |
| 5 | 首遇伙伴（5 站）先拿单块并卡在"这样拼不到 5"（A-6） | 记录首个命令是 take 还是 takeGroup、是否出现 stuck 卡 | 出现 stuck 且孩子停手 > 10 s = 成立 |
| 6 | 34–41 px 块抓不稳（B-1） | iPhone SE / 小安卓：17 站、8 站、12 站各拖 5 次，记录首次按下抓到目标、误抓邻块、掉落 | 误抓 ≥ 1/5 = 升 P1 |
| 7 | 孩子不会自发点卡片（B-3） | 出错后 30 s 内是否点卡片 / 数字；记录中位延迟 | 50% 的错误 30 s 内没点 = 做喇叭脉冲 |
| 8 | 孩子想听题会点云朵而不是数字笔画（B-2） | "点一下让它说话"，记录首次命中 | 首次没命中 ≥ 2/5 = 成立 |
| 9 | 孩子会连点"下一站"（D-1） | 5 次过关记录 pointerdown 间隔 < 400 ms 的比例 | ≥ 1/5 = 成立 |
| 10 | 0.9 s 自动进站太快 / 睁眼没被注意（D-3） | 进站后问"刚才谁醒了？"；看视线是否落到下一站 | 答不出 ≥ 3/5 = 延长到 1.4 s 并加惊喜脸 |
| 11 | 动作在 34–53 px 块上读不出；云朵"泄气"可见（G-2 / G-3） | 60 fps 录屏慢放：首站过关只看积木区，成人说出"它做了什么" | 说不出 = 幅度随 cell |
| 12 | 3 号站"错 = 绿"让孩子更确信（F-1） | 4 块贴上后看是否伸手按白色"下一站"或等彩纸 | 按按钮 ≥ 2/5 = 做 F-1(b) |
| 13 | ★3 睡着的站找不到（F-2） | 地图首屏"3 在哪里？"计时，与"6 在哪里？"比 | 慢 2 倍以上 = 成立 |
| 14 | 空沙坑读成"空坑"、iPad 块偏小（E-1） | 1 站、3+4 站、iPad 上问"沙坑里还有东西吗"；看是否伸手去抓空沙 | 定性记录 |
| 15 | 岛收尾页孩子不会自己滚（VP-375 P1） | iPhone SE：30 s 内是否自己下滑找到按钮 | 没有 = P1 成立 |
| 16 | 孩子误长按 ⚙ 进家长区（I-3） | 15 分钟里记录 ⚙ 长按次数 | ≥ 1 = 加重置长按确认 |
| 17 | 第三天回来没有"今天玩哪个"（PERSONAS 2.2） | 观察打开地图后 20 s 内做什么 | 直接按 ▶ 进最后一站并立刻退出 = 做"从哪开始"的引导 |
| 18 | 音：低频 bonk / adjust 听不见、success 盖住 drop、同一叮咚两次、数词落后手指（H） | 见下方 5 分钟听测 | 见各条 |
| 19 | iOS Safari：长按放大镜、`cancel()` 丢句、`audioSession playback` 打断音乐、静音键、地址栏伸缩、横竖屏切换、添加到主屏幕后横屏被锁（M-2） | 真机逐项 | 记录 iOS 版本 |
| 20 | 真机性能：首屏、过关瞬间掉帧、前进仪式停顿（J） | iPhone 12 / 中端 Android 各一台 | 首屏 < 4 s、过关无可见卡顿 |

### 7.1 Ted 的 5 分钟真机听测（iPhone Safari 外放，先调到 TTS 舒服的音量）

| # | 操作 | 预期听到 | 通过标准 |
|---|---|---|---|
| 1 | 冷打开地图，按 ▶ 进第一站 | ▶ 的"咔哒"可能没有；进站"叮—咚"必须有 | 进站音有 = 过 |
| 2 | 静音拨键拨到静音，再进一站 | 仍有叮咚 | 有 = playback 生效；无 = 记 iOS 版本 |
| 3 | 后台放 Apple Music，再进一站 | 音乐被停掉或继续混音 | 记录，由 Ted 定 playback / ambient |
| 4 | 拿起一块、放到工作台、再拖到已占的格 | 上滑啾 / "咔" + 低沉落地 / 两声低 bonk | 三者都分得清 = 过；bonk 听不见 = H-2 |
| 5 | 5 站放 4 块停手 | 两声软"嗯？"（上扬） | 听得见 = 过；听成"对了" = 改下滑 |
| 6 | 5 站放满 5 块，1 秒内连点 5 块 | 五个上行音 + "一二三四五" + "一共五块" | 最后一个数词落后手指 ≤ 1.5 s = 过 |
| 7 | 2 站放两块后点数 | "一 二 一共两块" | 读"两"不读"二" = 过 |
| 8 | 2 站放第二块（过关） | 落地"咔"与琶音几乎同时 | 能听出第一音 C5 = 过；只听到"咔"接高音 = H-1 |
| 9 | 点"下一站" | 地图叮咚、0.9 s 后进站再叮咚 | 觉得重复 = D-4 |
| 10 | 点云朵数字两次（隔 0.5 s），再点卡片 | 每次都出声 | 有一次哑 = H-4 |
| 11 | 点数到一半按"再数一遍"立刻再点 | 旧数词继续念完才念新"一"（当前行为） | 记录是否困扰 |
| 12 | 17 站数到 15–17 | 最高三个音 | 不刺耳 = 过 |
| 13 | 家长区切 English，回关卡点云朵 | 温和女声 "Make two" | 不是 Albert / Fred = 过 |
| 14 | 家长区"音效：关"，拖一块 | 无音效，点数仍说数词 | 过 |
## 8. 附录

### 8.1 触摸尺寸表（站 × 视口；计算值，375×553 / 390×844 / 667×331 已在浏览器核对）

**工作台格子 px**

| 站 | 390x844 | 375x553 | 360x640 | 667x331 | 667x375 | 768x1024 | 1024x768 | 1280x800 |
|---|---|---|---|---|---|---|---|---|
| ch1-n1 | 84 | 84 | 84 | 84 | 84 | 84 | 84 | 84 |
| ch1-n2 | 84 | 84 | 84 | 84 | 84 | 84 | 84 | 84 |
| ch1-n3 | 73 | 70 | 67 | 81 | 84 | 84 | 84 | 84 |
| ch1-n4 | 84 | 80 | 84 | 84 | 84 | 84 | 84 | 84 |
| ch1-n5 | 61 | 58 | 56 | 79 | 79 | 84 | 84 | 84 |
| ch1-n6 | 73 | 56 | 65 | 61 | 70 | 84 | 84 | 84 |
| ch1-n7 | 61 | 48 | 56 | 59 | 70 | 84 | 84 | 84 |
| ch1-n8 | 61 | 39 ⚠ | 56 | 47 | 47 | 84 | 84 | 84 |
| ch1-n9 | 61 | 58 | 56 | 63 | 77 | 84 | 84 | 84 |
| ch1-n10 | 61 | 48 | 56 | 63 | 77 | 84 | 84 | 84 |
| ch1-n11 | 61 | 39 ⚠ | 56 | 41 | 48 | 84 | 84 | 84 |
| ch1-n12 | 61 | 34 ⚠ | 39 ⚠ | 41 | 41 | 84 | 84 | 84 |
| ch2-n1 | 84 | 80 | 84 | 81 | 84 | 84 | 84 | 84 |
| ch2-n2 | 73 | 70 | 67 | 79 | 84 | 84 | 84 | 84 |
| ch2-n3 | 73 | 64 | 67 | 79 | 84 | 84 | 84 | 84 |
| ch2-n4 | 61 | 58 | 56 | 63 | 77 | 84 | 84 | 84 |
| ch2-n5 | 61 | 58 | 56 | 79 | 79 | 84 | 84 | 84 |
| ch2-n6 | 61 | 58 | 56 | 79 | 79 | 84 | 84 | 84 |
| ch2-n7 | 45 | 43 | 42 | 59 | 59 | 84 | 84 | 84 |

**托盘最小可抓块 px（cell × 托盘比例）**

| 站 | 390x844 | 375x553 | 360x640 | 667x331 | 667x375 | 768x1024 | 1024x768 | 1280x800 |
|---|---|---|---|---|---|---|---|---|
| ch1-n1 | 84 | 71 | 84 | 84 | 71 | 84 | 84 | 84 |
| ch1-n2 | 84 | 67 | 74 | 84 | 71 | 84 | 84 | 84 |
| ch1-n3 | 73 | 49 | 67 | 41 | 70 | 84 | 84 | 84 |
| ch1-n4 | 84 | 42 | 57 | 51 | 71 | 84 | 84 | 84 |
| ch1-n5 | 61 | 51 | 56 | 42 | 61 | 84 | 84 | 84 |
| ch1-n6 | 73 | 42 | 45 | 61 | 49 | 84 | 84 | 84 |
| ch1-n7 | 61 | 41 | 56 | 43 | 43 | 84 | 84 | 84 |
| ch1-n8 | 61 | 39 ⚠ | 41 | 41 | 41 | 84 | 84 | 84 |
| ch1-n9 | 61 | 45 | 56 | 41 | 42 | 84 | 84 | 84 |
| ch1-n10 | 61 | 41 | 52 | 41 | 42 | 84 | 84 | 84 |
| ch1-n11 | 61 | 39 ⚠ | 46 | 40 | 41 | 84 | 84 | 84 |
| ch1-n12 | 51 | 34 ⚠ | 39 ⚠ | 40 | 40 | 78 | 84 | 84 |
| ch2-n1 | 84 | 42 | 61 | 41 | 71 | 84 | 84 | 84 |
| ch2-n2 | 73 | 46 | 67 | 42 | 63 | 84 | 84 | 84 |
| ch2-n3 | 73 | 41 | 67 | 42 | 54 | 84 | 84 | 84 |
| ch2-n4 | 61 | 41 | 56 | 41 | 42 | 84 | 84 | 84 |
| ch2-n5 | 61 | 51 | 56 | 42 | 44 | 84 | 84 | 84 |
| ch2-n6 | 61 | 51 | 56 | 42 | 44 | 84 | 84 | 84 |
| ch2-n7 | 45 | 43 | 42 | 47 | 59 | 84 | 84 | 84 |

**伙伴徽章 px（labelSpot.size；无伙伴为 –）**

| 站 | 390x844 | 375x553 | 360x640 | 667x331 | 667x375 | 768x1024 | 1024x768 | 1280x800 |
|---|---|---|---|---|---|---|---|---|
| ch1-n1 | - | - | - | - | - | - | - | - |
| ch1-n2 | - | - | - | - | - | - | - | - |
| ch1-n3 | - | - | - | - | - | - | - | - |
| ch1-n4 | - | - | - | - | - | - | - | - |
| ch1-n5 | 31 | 25 | 28 | 21 | 30 | 42 | 42 | 42 |
| ch1-n6 | - | - | - | - | - | - | - | - |
| ch1-n7 | - | - | - | - | - | - | - | - |
| ch1-n8 | 31 | 20 | 20 | 20 | 20 | 42 | 42 | 42 |
| ch1-n9 | 31 | 23 | 28 | 20 | 21 | 42 | 42 | 42 |
| ch1-n10 | 31 | 20 | 26 | 20 | 21 | 42 | 42 | 42 |
| ch1-n11 | 31 | 20 | 23 | 20 | 20 | 42 | 42 | 42 |
| ch1-n12 | 25 | 17 ⚠ | 20 | 20 | 20 | 39 | 42 | 42 |
| ch2-n1 | 34-42 | 17-21 ⚠ | 24-30 | 16-20 ⚠ | 28-35 | 34-42 | 34-42 | 34-42 |
| ch2-n2 | 29-37 | 18-23 ⚠ | 27-34 | 17-21 ⚠ | 25-32 | 34-42 | 34-42 | 34-42 |
| ch2-n3 | 29-37 | 16-20 ⚠ | 27-34 | 17-21 ⚠ | 22-27 | 34-42 | 34-42 | 34-42 |
| ch2-n4 | 24-31 | 16-20 ⚠ | 22-28 | 16-20 ⚠ | 17-21 ⚠ | 34-42 | 34-42 | 34-42 |
| ch2-n5 | 24-31 | 20-25 | 22-28 | 17-21 ⚠ | 17-22 ⚠ | 34-42 | 34-42 | 34-42 |
| ch2-n6 | 24-31 | 20-25 | 22-28 | 17-21 ⚠ | 17-22 ⚠ | 34-42 | 34-42 | 34-42 |
| ch2-n7 | 23 | 22 | 21 | 23 | 30 | 42 | 42 | 42 |

**最长拖拽 px（托盘最远对象中心 → 工作台中心）**

| 站 | 390x844 | 375x553 | 360x640 | 667x331 | 667x375 | 768x1024 | 1024x768 | 1280x800 |
|---|---|---|---|---|---|---|---|---|
| ch1-n1 | 209 | 199 | 209 | 299 | 198 | 209 | 209 | 209 |
| ch1-n2 | 280 | 230 | 220 | 299 | 216 | 233 | 233 | 233 |
| ch1-n3 | 250 | 207 | 232 | 288 | 266 | 297 | 297 | 297 |
| ch1-n4 | 284 | 190 | 218 | 288 | 240 | 263 | 263 | 263 |
| ch1-n5 | 214 | 192 | 199 | 214 | 261 | 327 | 327 | 327 |
| ch1-n6 | 323 | 229 | 244 | 300 | 282 | 356 | 356 | 356 |
| ch1-n7 | 251 | 188 | 233 | 238 | 254 | 396 | 396 | 396 |
| ch1-n8 | 364 | 202 | 245 | 259 | 259 | 403 | 403 | 546 |
| ch1-n9 | 280 | 233 | 260 | 226 | 245 | 382 | 382 | 429 |
| ch1-n10 | 351 | 247 | 249 | 226 | 245 | 454 | 382 | 382 |
| ch1-n11 | 373 | 214 | 283 | 323 | 233 | 428 | 428 | 550 |
| ch1-n12 | 388 | 248 | 298 | 321 | 321 | 541 | 567 | 518 |
| ch2-n1 | 280 | 186 | 218 | 271 | 235 | 258 | 258 | 258 |
| ch2-n2 | 247 | 206 | 229 | 208 | 265 | 321 | 321 | 321 |
| ch2-n3 | 259 | 185 | 240 | 225 | 265 | 359 | 359 | 359 |
| ch2-n4 | 307 | 219 | 285 | 238 | 257 | 412 | 412 | 356 |
| ch2-n5 | 232 | 233 | 215 | 256 | 263 | 294 | 356 | 433 |
| ch2-n6 | 232 | 206 | 215 | 225 | 230 | 321 | 321 | 359 |
| ch2-n7 | 188 | 181 | 177 | 210 | 239 | 329 | 329 | 429 |


按钮尺寸：RoundButton 48 / 58 / 70（hitSlop 在 web 无效）、PillButton 109–188×57、菜单 ⚙ 40、家长区小站 48×40、作品册卡 169×153（390）/ × 48、沙盒三键 52。

### 8.2 对比度表（WCAG 2，F 评审实算）

| hue | fill | 毛毡 `#FFF6E4` | 沙 `#F4E3B7` | 天空 `#CFE9F7` | 白卡 `#FFFFFF` | board `#FFFBF2` | edge | edge/毛毡 | edge/沙 | OKLCH L / C / H |
|---|---|---|---|---|---|---|---|---|---|---|
| n1 | #F0533B | 3.26 | 2.75 | 2.77 | 3.50 | 3.39 | #B63724 | 5.49 | 4.64 | 0.65 / 0.197 / 31° |
| n2 | #F7923A | 2.14 | 1.81 | 1.82 | 2.30 | 2.23 | #C26A1C | 3.64 | 3.07 | 0.75 / 0.156 / 57° |
| **n3** | #F9D23C | **1.37** | **1.15** | **1.16** | **1.47** | **1.42** | #C7A215 | **2.27** | **1.92** | 0.87 / 0.162 / 94° |
| n4 | #52C462 | 2.07 | 1.75 | 1.77 | 2.23 | 2.16 | #2F8F3D | 3.82 | 3.23 | 0.73 / 0.172 / 146° |
| n5 | #3FA8E8 | 2.45 | 2.07 | 2.09 | 2.63 | 2.55 | #1F6FA8 | 5.02 | 4.24 | 0.70 / 0.133 / 240° |
| n6 | #8B6BE0 | 3.71 | 3.13 | 3.16 | 3.98 | 3.85 | #5B3FAE | 7.07 | 5.97 | 0.61 / 0.171 / 293° |
| n7 | #F06BAE | 2.64 | 2.23 | 2.24 | 2.83 | 2.74 | #B8407E | 4.80 | 4.06 | 0.71 / 0.178 / 351° |
| n8 | #45C6C0 | 1.94 | 1.64 | 1.65 | 2.08 | 2.01 | #1F8C87 | 3.79 | 3.20 | 0.76 / 0.111 / 191° |
| n9 | #789BEF | 2.53 | 2.14 | 2.15 | 2.72 | 2.63 | #4560A2 | 5.67 | 4.79 | 0.70 / 0.130 / 266° |
| n10 | #D18EDB | 2.27 | 1.92 | 1.94 | 2.44 | 2.36 | #86528E | 5.42 | 4.57 | 0.74 / 0.130 / 322° |


色盲模拟（Machado 2009 severity 1.0，OKLab ΔE × 100；< 12 并排才可分）：

| 重点对 | 正常 | 红色盲 protan | 绿色盲 deutan | 蓝色盲 tritan |
|---|---|---|---|---|
| 1 红 vs 2 橙 | 13.4（ΔL 10） | 14.6 | **9.9** | 12.5 |
| 4 绿 vs 8 青 | 12.3 | 12.2 | 11.6 | **3.8** |
| 6 紫 vs 9 长春花 | 11.8 | 11.9 | 9.1 | 11.8 |
| 9 长春花 vs 10 丁香 | 12.9 | **3.1** | 8.0 | 17.5 |
| 6 紫 vs 10 丁香 | 15.2 | 12.7 | 16.3 | 15.9 |
| 7 粉 vs 1 红 | 14.1 | 16.3 | 13.7 | **9.1** |
| 5 蓝 vs 9 长春花 | **6.0** | **2.9** | **1.1** | **3.3** |
| 5 蓝 vs 10 丁香 | 17.8 | **2.6** | 7.1 | 19.7 |
| 2 橙 vs 4 绿 | 23 | **7.6** | **6.1** | 27 |
| 1 红 vs 4 绿 | 32 | 21 | **7.2** | 37 |
| 7 粉 vs 8 青 | 29 | 17 | **4.0** | 32 |
| 8 青 vs 10 丁香 | 22 | 12.2 | **4.6** | 21 |
| 2 橙 vs 7 粉 | 19 | 19 | 16 | **4.8** |
| 4 绿 vs 5 蓝 | 23 | 22 | 21 | **4.1** |


pale 态（地图睡着的站，实际合成色）：

| hue | pale | 实际底（pale@0.92 压沙） | 底 / 沙 | fill 边 / 底 | 字（deep@0.75） | 字 / 底 | 不加 0.75 时 deep / 底 |
|---|---|---|---|---|---|---|---|
| n1 | #F9BAB1 | #F9BDB1 | 1.28 | 2.15 | #C75947 | 2.62 | 3.63 |
| n2 | #FCD3B0 | #FBD4B1 | 1.09 | 1.66 | #BE7640 | 2.59 | 3.76 |
| **n3** | #FDEDB1 | #FCECB1 | **1.08** | **1.24** | #A48B38 | 2.81 | 4.31 |
| n4 | #BAE7C0 | #BFE7BF | 1.07 | 1.63 | #4F9858 | 2.58 | 3.77 |
| n5 | #B2DCF6 | #B7DDF1 | 1.13 | 1.83 | #458BBA | 2.59 | 3.75 |
| n6 | #D1C4F3 | #D4C6EE | 1.26 | 2.48 | #7961BE | 3.07 | 4.74 |
| n7 | #F9C4DF | #F9C6DC | 1.17 | 1.91 | #BC5C8A | 2.81 | 4.06 |
| n8 | #B5E8E6 | #BAE8E2 | 1.05 | 1.56 | #439690 | 2.62 | 3.85 |
| n9 | #CBD9F8 | #CEDAF3 | 1.11 | 1.93 | #6176AA | 3.19 | 5.14 |
| n10 | #E8D0EB | #E9D2E7 | 1.11 | 1.72 | #956A9A | 3.09 | 4.86 |


### 8.3 动效表（G 评审盘点；RM = 是否尊重减少动效）

| # | 文件:行 | 触发 | 时长 / 参数 | 缓动 / 弹簧（ζ = 阻尼比） | RM |
|---|---|---|---|---|---|
| 1 | use-draggable.ts:150-161 onBegin | 手指触到 | 90ms 挤压 0.93 | EASE_OUT | ✓ |
| 2 | use-draggable.ts:162-171 onStart | 拖动激活（>6px） | lift 120ms；scale→1.08 / 1.04；tilt 3° | LIFT {14,260,.5} ζ0.61 | tilt ✓，scale 不减（手指驱动，可接受） |
| 3 | use-draggable.ts:172-185 onUpdate | 跟手 | 每帧 tx/ty 直写 | — | — |
| 4 | use-draggable.ts:79-94 settle | 松手 | lift→0 160ms；scale→rest；tx/ty→0（非 moved） | SETTLE {18,220,.6} ζ0.78 | 不减（手指驱动） |
| 5 | use-draggable.ts:87-91 shake | 松手 `blocked` | -7°/+7°/-3.5° 60+90+80ms + spring | SETTLE | ✓ |
| 6 | use-draggable.ts:108-125 FLIP | rest 变化（被接受的移动） | 从手指处弹到格子 + splat 1.14/0.86 70ms | LAND {15,240,.6} ζ0.63；BOUNCE {7,320,.5} ζ0.28 | ✓ 直接到位 |
| 7 | use-draggable.ts:129-139 enter | 挂载（Stage `arriving` 900ms 内） | ty=-0.6cell → 0，延迟 80+min(i,14)×35ms；+120ms splat | LAND + BOUNCE；**useEffect（画后）+ eslint-disable 只跑一次** | ✓ |
| 8 | use-draggable.ts:190-199 onFinalize | 点数轻点（未成拖动） | 挤压回弹 | BOUNCE | — |
| 9 | juice.ts:22-97 useCheer | `celebrateTick` 新值（played ref 防重放） | hop：splat(i×55) + 跳 24px；spin：-22px + 360° 520ms；pair：-26/-18；stack：16+9i≤60px，i×110；wiggle：±12° + 10px；wave：-18/-12；stand：scaleY 1.3 240ms 停 380/760ms；car：x→900px 650ms ease-in, →-900 0ms, →0 750ms | EASE_OUT；LAND {10,260,.5} ζ0.44；SETTLE {9,240} ζ0.29；spin 用 inOut(cubic)；**car 去程 `Easing.in(quad)`**（唯一 ease-in，开走加速——合理） | ✓ 全不动 |
| 10 | juice.ts:105-115 useWheels | 同上 car | 轮子 180ms 显、CAR_MS-380 后 200ms 隐 | timing | ✓ |
| 11 | juice.ts:118-128 usePulse | 点数一块（count 变） | 1.16 90ms + spring | {11,260} ζ0.34 | ✓ |
| 12 | juice.ts:133-143 useWink | 数完（counts） | 0→1 90ms，停 60，→0 130ms | EASE_OUT | ✓ |
| 13 | juice.ts:146-158 usePop | 云朵：过关 / 数完 / 地图下一站睁眼 | 1.32 140ms + spring；-6°/+6° 90+120ms + spring | **{7,200} ζ0.25 过冲 45%、{8,200} ζ0.28** | ✓ |
| 14 | juice.ts:161-176 useBob | 地图标记常驻 | ±6px，周期 1300ms 循环 | inOut(quad) | ✓ |
| 15 | juice.ts:180-195 useBreathe | 过关 1600ms 后"下一站" | 1→1.07→1 各 650ms 循环 | inOut(quad) | ✓ |
| 16 | Block.tsx:63-76 BlockBody | 簇变色（两个 1 变 2） | 色 220ms + pop 1.12 90ms + spring | BOUNCE {8,300,.5} ζ0.33 | ✓ |
| 17 | Block.tsx:33-40 LiftShadow | 由 lift 驱动 | opacity 0.2·lift，下移 0.16cell | 跟 lift | 跟 lift |
| 18 | Face.tsx:38-46 眨眼 | calm 脸挂载 | 2.2–5.5s 随机等待，闭 70ms 开 90ms 循环 | timing | ✓ |
| 19 | Face.tsx:47-50 lifted / together | lift / wink 值 | 睡脸↔惊喜脸 opacity 交叉；眼 scaleY | 跟驱动值 | 跟驱动值 |
| 20 | Face.tsx:84-131 mood 切换 | calm/happy/sleepy/puzzled | **硬切，无过渡** | — | — |
| 21 | DemoHand.tsx:28-46 | 空工作台闲 1.8s（首站）/ 5s | 1800ms 一程 + 450ms 停，共 2 程；0.12–0.84 淡入出；0.22–0.74 easeInOut 平移 + 0.5cell 弧 + 0.9 按压 | 手写 easeInOutQuad | ✓ 只在托盘闪 |
| 22 | Confetti.tsx:72-89 | tick 新值 | 18 片 1000ms / Boss 36 片 1300ms / 收尾 40 片 1400ms；抛物线 g=520；0.7 后淡出 | linear（物理自算） | ✓ 不渲染 |
| 23 | Spotlight.tsx:14-21 | 提示点亮 | 1→0.3 420ms 往返 6 次（≈2.5s）后常亮 | timing | ✓ 常亮 |
| 24 | Stage.tsx:106-111 `arriving` | 进站 | 900ms **JS setTimeout**，决定 enter 延迟 | — | — |
| 25 | Stage.tsx:65-77 CarWheels | car | 同 #9/#10，`key={celebrateTick}` 重挂 | — | ✓ |
| 26 | MapScreen.tsx:92-115 TravelMarker | `?from&to` | 250ms 后 4 跳 × 150ms，弧高 18px | linear 参数 + sin 弧 | ✓ duration 0（仍等 250ms 再瞬移） |
| 27 | MapScreen.tsx:303-315 | 同上 | 落地 850ms 响 arrive + 睁眼 pop；+900ms 自动进站 | **JS setTimeout** | 照常 |
| 28 | MapScreen.tsx:150-168 StopDot wiggle | 点锁定站 | -8/+8/-5° 60+90+80ms + spring | {10,260} ζ0.31 | ✓ |
| 29 | MapScreen.tsx:118-125 Marker | 常驻 | useBob | — | ✓ |
| 30 | IslandDoneScreen.tsx:29-45 Cheer | 挂载 | 300+i×90ms 起，跳 0.45size 180ms + spring，重复 3 次 | {9,260} ζ0.28 | ✓ |
| 31 | IslandDoneScreen.tsx:150-164 | 挂载 | 只读 Stage `celebrateTick={1}`（**未传 cheer → 默认 hop**）+ enter 掉落 + 40 片彩纸 | — | ✓ |
| 32 | AlbumScreen.tsx:96-102, 121 Zoom | 点卡片 | FadeIn 140ms；450ms（JS setTimeout）后 cheerOf + success 音；**收起无 exiting，硬切** | Reanimated 默认 ReduceMotion.System | ✓（库级） |
| 33 | LevelScreen.tsx:493 actions | 过关 / 已完成 | FadeInDown 220ms | 库级 System | ✓（库级） |
| 34 | ui.tsx:14-16 lip | 按压 | translateY 3px + 阴影 4→1，**即时无动画** | — | — |
| 35 | Cloud.tsx | — | **无任何动效**（tone 换色即时；pop 在外层 badgeWrap） | — | — |
| 36 | 路由 Stack（_layout.tsx:20） | 换页 | web 默认无转场，硬切 | — | — |


### 8.4 音效表（sfx.ts；峰值 = 0.22 × gain）

| 音效 | 音符（Hz，音名） | 滑音 | 起始 ms | 时长 ms | 波形 | gain → 峰值（dBFS） | 触发点 |
|---|---|---|---|---|---|---|---|
| pickup | 420→760（G#4→F#5） | 上滑 | 0 | 90 | sine | 0.5 → 0.110（−19） | `Stage.tsx:115` 拖动激活 |
| drop | 330→220（E4→A3）；1320（E6） | 下滑；无 | 0；0 | 80；30 | triangle；sine | 0.7 → 0.154（−16）；0.18 → 0.040（−28） | `Stage.tsx:86` 落在工作台 |
| return | 660→330（E5→E4） | 下滑 | 0 | 140 | sine | 0.45 → 0.099（−20） | 放回 / 飞回托盘；沙盒"全部收回"一声 |
| blocked | 200→160（G3→D#3）；180→140（F#3→C#3） | 下滑 ×2 | 0；110 | 100；120 | triangle | 0.6 → 0.132（−18）；0.5 → 0.110（−19） | 放不下；地图锁定站 `MapScreen.tsx:162` |
| count(k) | `countPitch(k)` + 高八度 | 无 | 0；0 | 180；100 | sine；triangle | 0.5 → 0.110；0.3 → 0.066 | 每次点数 |
| counted | count(k) + 783.99（G5）+ 1046.5（C6） | 无 | 160；250 | 100；240 | triangle | 0.4 → 0.088；0.45 → 0.099 | 数完最后一块 |
| adjust | 392（G4）；349.23→440（F4→A4） | 无；上滑 | 0；150 | 130；200 | sine | 0.45 → 0.099；0.4 → 0.088 | 答案**变成**需要调整时一次（`LevelScreen.tsx:239-241`） |
| success | 523.25 / 659.25 / 783.99 / 1046.5（C5 E5 G5 C6）+ 2093（C7） | 无 | 0 / 90 / 180 / 270 / 300 | 120 / 120 / 120 / 380 / 250 | triangle ×4 + sine | 0.45 / 0.45 / 0.45 / 0.5 / 0.1 | 过关、多步站每步、作品册放大 0.45 s 后 |
| fanfare | C5 C5 E5 G5 E5 C6 + G6 C7 | 无 | 0 / 120 / 240 / 360 / 540 / 660 / 700 / 820 | 100 / 100 / 100 / 160 / 100 / 500 / 400 / 350 | triangle ×6 + sine ×2 | 0.45…0.55；0.12 / 0.1 | Boss 过关；岛屿收尾页挂载 `IslandDoneScreen.tsx:98` |
| arrive | 659.25（E5）；987.77（B5） | 无 | 0；80 | 80；140 | sine | 0.35 → 0.077（−22） | 进站；地图标记落地 `MapScreen.tsx:308` |
| tap | 880→990（A5→B5） | 上滑 | 0 | 40 | sine | 0.25 → 0.055（−25） | `ui.tsx:40,69` 按钮 `onPressIn` |


| k | 基音 | 高八度层 | k | 基音 | 高八度层 |
|---|---|---|---|---|---|
| 1 | 261.6 C4 | 523 C5 | 10 | 659.3 E5 | 1319 E6 |
| 5 | 392.0 G4 | 784 G5 | 12 | 784.0 G5 | 1568 G6 |
| 7 | 493.9 B4 | 988 B5 | 14 | 987.8 B5 | 1976 B6 |
| 8 | 523.3 C5 | 1047 C6 | 15 | 1046.5 C6 | 2093 C7 |
| 9 | 587.3 D5 | 1175 D6 | 16 | 1174.6 D6 | 2349 D7 |
| | | | 17 | 1318.5 E6 | **2637 E7** |


### 8.5 性能数字

#### 2 冷加载（390×844，CPU 4×）

| 条件 | 页面 | DOMContentLoaded / load | 首个文字 | 首个 `stage` | 首块可拖 | 备注 |
|---|---|---|---|---|---|---|
| Fast 3G + CPU 4×（无压缩） | /play/ch1-n7 | 14.68 s | 14.92 s | 14.92 s | **14.98 s** | 两个大 bundle 分别在 13.7 s / 14.3 s 到齐；到齐前页面没有任何文字（静态预渲染的 html 只有空壳） |
| 无网络限制 + CPU 4× | /album（19 张卡） | — | — | — | LCP 1,055 ms（TTFB 32 + 渲染延迟 1,023） | 长任务 9 个，最长 197 ms（JS 解析 / hydrate） |
| 无限制 + CPU 4×（上轮 D-049 实测对照） | /album 从地图进入 | 564–593 ms 画出 19 张静态卡 | | | | 本轮未重测 |

推算：Vercel 会对 js 做 br/gzip（596 KB），Fast 3G（1.6 Mbps）约 3–4 s 到齐，再加 ~1 s hydrate（CPU 4×）→ 真机慢网络首屏约 4–5 s。没有 service worker，第二次打开仍要下载（只靠 HTTP 缓存；dist 文件名带 hash 但 html 无 cache 头，见 M）。

#### 3 交互 trace（CPU 4×，网络不限；只统计 performance.mark 标出的交互窗口，排除 trace 启动与 harness 注入的开销）

| 场景 | 窗口 | 主线程忙 | 长任务（≥ 50 ms） | 最长 | 帧间隔 > 33 ms | 最大帧间隔 |
|---|---|---|---|---|---|---|
| 拖拽 5 次（ch1-n7 单块，每次 254–323 px） | 3.9 s | 1.82 s | **0** | — | 0 | 18 ms |
| 过关 + fanfare + 彩纸 + 8 砖小车（ch1-n8） | 3.4 s | 1.28 s | **0** | — | 0 | 18 ms |
| 点"下一站" → 回地图 → 跳 4 下 → 自动进站（n8→n9） | 3.0 s | 3.27 s | **7** | 308 ms（地图挂载，点击后 17 ms）；198 ms（关卡挂载，2.4 s）；120 / 101 / 95 / 66 / 56 ms | 1 | 51 ms |
| 作品册 19 张卡上下滚两遍 | 3.2 s | 0.66 s | 0 | — | 3 | 39 ms |
| 作品册冷加载（reload） | 5.5 s | 2.5 s | 9 | 197 ms | 5 | 66 ms |

读法：拖拽、过关庆祝、滚动在 4× 降速下都没有长任务——Reanimated worklet（web 上也在主线程 rAF 跑）加上每次跨格才 `setPreview` 的策略足够。**唯一的卡点是前进仪式**：地图挂载 308 ms、关卡挂载 198 ms（1× 下约 77 / 50 ms），正好落在孩子等待标记跳的 1.75 s 里，表现为跳跃起步前的一次停顿（trace 里 1 帧 51 ms）。原因（代码）：`router.replace('/')` 卸载 LevelScreen 并挂载整张地图（19 个 StopDot 各含 Face、脚本化 SVG 样式）；Stack 又保留着上一个地图实例（DOM 里两个 `map-trophy`），所以内存中同时有两张地图。

#### 4 内存与 DOM
- 主视口通关 19 站 + 作品册 + 沙盒后：JS heap 18 / 21 MB（`performance.memory`），DOM ~700–800 节点。没有增长迹象（每站 commit 只写一次存档，Confetti / DemoHand 都有 cleanup）。
- 作品册页 DOM：19 张 `WorkPicture` 静态缩略图（上轮已选静态而非 19 个 Stage）。


Lighthouse（移动端，/）：Accessibility 88、Best Practices 100、SEO 73、Agentic 33；失败项 document-title、meta-viewport、label-content-name-mismatch、meta-description、robots.txt、llms.txt。

### 8.6 拖拽 / 决策曲线表（C 评审，seed 4242；替代解 = 伙伴子集 + 散块能凑到目标的组合数）

| 站 | 题 | 动词 | 最少拖拽 | 决策 | 托盘对象 | 诱饵 | 替代解 | 工作台 |
|---|---|---|---|---|---|---|---|---|
| 1 | 拼出 1 | take | 1 | 0 | 3 散 | – | 1 | 3×3 |
| 2 | 拼出 2 | take | 2 | 0 | 4 散 | – | 1 | 3×3 |
| 3 | 4 方阵 | take | 4 | 1 | 6 散 | – | – | 5×3 |
| 4 ★ | 3 转角 | take | 3 | 1 | 5 散 | – | – | 4×3 |
| 5 | 5 = 3 + 1 + 1 | takeGroup + take | 3 | 1 | 1 伙伴 + 4 散 | – | 1 | 6×3 |
| 6 | 4 方阵 → 4 长条 | take + move | 6（4 + 2） | 2 | 6 散 | – | – | 5×5 |
| 7 | 6 塔 | take | 6 | 1 | 8 散 | – | – | 6×4 |
| 8 ★ | 8 砖 = 4 + 4 | takeGroup | 2 | 2 | 3 伙伴 + 1 散 | 3 | 4+3+1 也成砖（judge 实测 matched） | 6×5 |
| 9 | 9 = 5 + 4 | takeGroup | 2 | 1 | 3 伙伴 + 2 散 | 3 | 3 | 6×3 |
| 10 | 10 = 5 + 5 | takeGroup | 2 | 1 | 3 伙伴 + 2 散 | 4 | 3 | 6×3 |
| 11 | 12 = 10 + 2 | takeGroup | 2 | 1 | 3 伙伴 + 2 散 | 3 | 2 | 6×4 |
| 12 ★ | 17 = 10 + 5 + 2 | takeGroup | 3 | 1 | 4 伙伴 + 2 散 | 4 | 3 | 6×5 |
| 2-1 | 1 + 1 | takeGroup | 2 | 2 | 3 伙伴 | 3 | – | 4×3 |
| 2-2 | 2 + 1 | takeGroup | 2 | 2 | 3 伙伴 | 4 | – | 5×3 |
| 2-3 | 2 + 2 | takeGroup | 2 | 2 | 4 伙伴 | 3、1（3+1=4 被拒） | – | 5×3 |
| 2-4 ★ | 找两个拼出 5 | takeGroup | 2 | 3 | 5 伙伴 | 5、4、1 | 2+3 / 4+1 | 6×3 |
| 2-5 | 3 + 2 | takeGroup | 2 | 2 | 4 伙伴 | 1、4（1+4=5 被拒） | – | 6×3 |
| 2-6 | 4 + 1 | takeGroup | 2 | 2 | 4 伙伴 | 2、3（2+3=5 被拒） | – | 6×3 |
| 2-7 ★ | 3 + 4 | takeGroup | 2 | 2 | 4 伙伴 | 5、2（5+2=7 被拒） | – | 8×3 |


| 段 | 站 | 拖拽 | 决策 | 托盘对象 |
|---|---|---|---|---|
| 数字岛 1–4 | 1、2、4□、3∟ | 1、2、4、3 | 0、0、1、1 | 3–6 |
| 数字岛 5–8 | 5(3+1+1)、4□→4—、6 塔、8 砖(4+4) | 3、6、6、2 | 1、2、1、2 | 5、6、8、4 |
| 数字岛 9–12 | 9、10、12、17 | 2、2、2、3 | 1、1、1、1 | 5、5、5、6 |
| 合体岛 | 1+1 … 3+4 | 2 × 7 | 2（自由和 5：3） | 3–5 |


### 8.8 升级路径实证（v1 / v2 / v3 → v4，主评审浏览器实测）

| 存档 | 完成记录 | 当前站 | 作品册 | 沙盒 | 家长区文案 | 被收起的站 | 备份键 |
|---|---|---|---|---|---|---|---|
| v1 ch1-finished（冻结夹具） | 15 保留 | ch2-n4 | 空 | 无字段 | "题库更新过，存档已自动升级…" + "…下次进去从头摆：数字岛 第 10 站、第 12 站" | 10、12（ch2-n4 作品保留） | progress.before-upgrade 7090 B |
| v1 n10-unfinished（冻结夹具） | 9 保留 | ch1-n10 | 空 | 无字段 | 同上 + "第 9 站、第 10 站" | 9、10 | 3430 B |
| v2 全通（10/12/17 有作品） | 19 保留 | ch2-n7 | **空**（K-2） | 无字段 | 同上 + "第 10 站" | 10（12、17 作品保留） | 7957 B |
| v3（1–8 完成，5/6/8/9 旧作品，作品册 2，沙盒 3，英文） | 8 保留 | ch1-n9 | 2 张（1、2）保留 | 3 块保留 | 英文 "The puzzles were updated…" + "stop 5, 6, 8, 9" | 5、6、8、9 | 5134 B |

二次加载：四份存档的 contentVersion 仍是旧值、长度与备份相同，文案再次出现（K-1 升级不落盘）。
