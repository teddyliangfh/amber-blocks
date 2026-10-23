# Amber Blocks：形状玩法教学法调研（Shape Island 决策前）

日期：2026-10-22。研究范围：4 岁（及 4.5–5 岁）儿童的 2D 形状能力、三种拼片体系、课程锚点、Numberblocks 形状处理、提示反馈。所有未被来源直接支持的判断标注【推断】。

---

## 0. 一页结论

1. **4 岁 = Clements & Sarama 形状组合轨迹的 Piece Assembler（拼块者）**：能把整块拼进"每块都画了轮廓"的拼图，靠试错；"两块合成一个部位"（Picture Maker）约 5 岁；"预判哪块能放"（Shape Composer）约 5–6 岁 [S1][S2][S3]。Amber Blocks 现有 5 个形状站正好落在 Piece Assembler → 早期 Picture Maker 区间，方向正确，只是量太少。
2. **心理旋转 4 岁还在随机水平，5 岁才出现**（触屏任务，Frick 等 2013）[S5]；镜像判别 3–7 岁普遍混淆，斜向最难 [S8]。现有判定"允许旋转、镜像可选"应保持为默认；不要做"必须自己旋到正确朝向"的关卡。
3. **七巧板对 4 岁偏早**：45° 角 + 不等边长，对低龄操作与拼合更难；pattern blocks（30° 倍数）是公认的更易入口；而 Amber Blocks 的单位方块多联骨牌（polyomino）是 90° 网格，比两者都容易对齐，且天然带"块数 = 数字"的语义 [S9]【推断：polyomino 比 pattern blocks 更易这一比较无直接研究】。
4. **Numberblocks 自己就是 polyomino 教法**：Four 是正方形、Nine/Square Club 讲平方数、Twelve 讲行列排法（"way of the rectangle"）、Step Squads 讲三角数 [S14][S15][S16][S17]。沿这条线扩形状最安全：同样 n 块、不同外形。
5. **"面积 = 数块"在 4 岁只以"数一数用了几块"成立**；把格子按行列结构化来理解面积是 7–8 岁（Grade 2）的事 [S11]【推断：年龄段依 Clements & Sarama 2014 书中年龄表，本次未能在线核对】。
6. **课程锚点**：ACARA v9 Foundation AC9MFSP01（sort, name, create familiar shapes；从环境物体中认出并说理由）[S19][S20]；Year 1 AC9M1SP01（make, compare, classify）[S21]；EYLF V2.0 Outcome 5.4（符号与规律系统；开始认识简单形状名称）[S22]。"Foundation-ready"= 能在物体和拼图里认出并造出圆、方、长方、三角，不需要名称操练。
7. **"鬼影轮廓"是研究范式与 Building Blocks 软件都在用的做法**（Ghost Puzzle 的"洞"；Building Blocks 把不合适的块变透明，让下面的轮廓露出来）[S6][S7][S13]，但应作为帮助阶梯的第 2–3 级，不是默认常显——"助力两难"（assistance dilemma）：给太多帮助会导致浅层学习 [S25]。
8. **建议**：不做"七巧板式 Shape Island"的大改。优先 (a) 在现有数字语义内把形状站从 5 个扩到 ~15 个（tetromino 全集、pentomino 子集、两伙伴合影、对称一半）；(b) 之后做一个小而独立的"几何拼片角"（三角/正方形拼房子，2–3 片、无数字脸、播报"用了 3 片"），满足 PRD §4.5 的语义隔离。

---

## 1. 四岁能做什么 / 不能做什么

| 技能 | 典型年龄 | 证据 | 对 Amber Blocks 的含义 |
|---|---|---|---|
| 把整块拼进"每块都有轮廓"的拼图（trial-and-error） | 4 岁（Piece Assembler） | LT 站点描述："Fills simple puzzles in which all shapes are outlined, often using trial and error" [S2]；年龄表 [S3] | 主路径。影子里每块的格线可见即是 4 岁的合理默认（帮助级别 1）。 |
| 用两块合成图中一个部位 / 两块填一个洞 | 5 岁（Picture Maker） | [S3] | 4.5 岁后再上"两个伙伴拼一个影子"（现有 2×4 brick 已是此级）。 |
| 预判"哪块能放"，有意使用旋转/翻转 | 5–6 岁（Shape Composer） | [S1][S3] | 不作为通关要求；可当 boss 的"加分"而非门槛。 |
| 用几块替换一块（6 三角 = 1 六边） | 6 岁（Substitution Composer） | [S3] | 本阶段不做。 |
| 认出典型圆/方/三角 | 3 岁；4 岁可认一些非典型方/三角和部分长方，但通常不认"菱形" | LT Shape Recognizer—Circles, Squares, Triangles [S4]；van Hiele Level 0：按整体外观识别，45° 倾斜的正方形被叫"钻石" [S12] | 识别靠匹配，不靠名称；影子/拼片保持轴对齐，不用斜放的正方形考孩子。 |
| 心理旋转（不动手想象旋转） | 4 岁随机水平；5 岁出现并能从练习获益 | Frick, Ferrara & Newcombe 2013 触屏范式 [S5] | 任何"必须旋到对的朝向"的判定都是在考 5 岁技能。旋转应由系统容忍（现状）或一键完成。 |
| 物理试错旋转去配合洞 | 3→5 岁正确率 54%→83% | Frick, Hansen & Newcombe 2013 Ghost Puzzle [S6] | 可以给"旋转过的影子"，但要允许多次试放、无惩罚。 |
| 镜像判别 | 3–7 岁混淆；斜向镜像最难 | Frontiers 2018 综述 [S8] | `mirror optional` 保持；S/Z 这种镜像对只做"翻过来一样"的展示，不判错。 |
| 照模型复制 2D/3D 结构 | 3 岁已可测（TOSA） | Verdine 等 2014 [S10] | "照样子拼"可做，但评分要只看块数 + 形状等价，不看绝对位置。 |
| 从部件拼出"看起来像"某形状 | 4 岁 | LT "Constructor of Shapes from Parts—Looks Like" [S4]【推断：年龄依书】 | 自由创作（Make a Picture）值得保留，无判错。 |
| 拼图游戏 → 空间能力 | 26–46 月的拼图游戏预测 54 月的空间变换能力 | Levine 等 2012 [S24] | 多做形状关有依据；家长陪玩时的空间语言是额外增益。 |
| 拖放精度 | 4 岁明显差于 5 岁；目标尺寸显著影响表现 | MNSU 2014 论文 [S27]；Sesame 2012：tap 最直觉，pinch/多指难 [S26] | 拼片要大、吸附要宽松；旋转不用双指手势。 |
| 面积 = 数块 | 4 岁：只是计数；把覆盖按行/列结构化 ≈ 7–8 岁 | 面积轨迹层级 [S11]【推断：年龄】 | 只说"用了几块"，不说"面积"。 |

---

## 2. 三种拼片体系对比

| | 七巧板 Tangram | Pattern Blocks | 单位方块多联骨牌 Polyomino（现状） |
|---|---|---|---|
| 几何 | 7 片，角为 45° 倍数，边长 1、√2、2 不等 | 6 种，角为 30° 倍数，边长统一 | 90° 网格，边长统一 |
| 拼合难度 | 最高；"varied side lengths … harder for young children to manipulate and combine" [S9] | 较低："offer a more accessible entry point for young children" [S9] | 最低【推断】：整数格吸附，无斜边 |
| 典型目标年龄 | 评测机构：My First Tangrams 5+、Tangram Quest 6+、Tangram Pro 9+ [S28]；Osmo Tangram 5–12 / 6–10 [S29]；25–48 月只有叙事辅助的小型试点 [S30] | K–2 常规教具 [S9] | Numberblocks 目标 3–6 岁【推断：节目定位】 |
| 教什么 | 组合/分解、旋转翻转、面积守恒（高阶） | 组合、替换（6 三角 = 六边）、对称、规律 | 数量守恒、同量异形、行列/长方形、对称 |
| 与数字语义 | 冲突：7 片 ≠ 数字 7 的角色 | 冲突：片数 ≠ 面积 | 一致：块数 = n |
| 4 岁判断 | 不建议作为主体 | 可作次要"几何拼片角" | 主体 |

**裁决**：对 4 岁，把力气花在 polyomino 形状集上；几何拼片只做一个 2–3 片的"房子/船"分区（PRD §4.5 已规划），不引入 7 片七巧板。实证上，学前儿童的虚拟七巧板研究（Weng 等 2020）在幼儿园样本上得到的是"参与度更高、完成更快"，但任务是嵌在故事书里的轮廓填充 [S31]——这与"鬼影轮廓 + 叙事"的做法一致，而非证明自由七巧板适合 4 岁。

---

## 3. 推荐的形状学习轨迹（Shape 扩展，按顺序）

数域 ≤ 7，每步只加一个新动作；带 * 的是现有站已覆盖。

1. *同量变形*（已有）— 技能：数量不变性（4 块横着竖着都是 4）。活动：拿 4 块随便改形，数字不变。
2. *单块进影子，每格可见*（Piece Assembler）— 技能：整体轮廓匹配。活动：3 块 L 形影子，拖 3 个单块填满（格线常显）。
3. **一个伙伴进旋转过的影子**— 技能：方向/物理旋转。活动：把"3"伙伴放进竖着的 L 影子；任意旋转/镜像都判对，系统吸附到最近合法朝向。
4. **4 的五种样子**（free tetromino：I、O、T、S、L）— 技能："同一个 4 有很多形状"（Numberblocks 式）。活动：集邮式 5 站，每站一个影子，全部用同样 4 块；完成后并排回看"都是 4"。
5. *两伙伴拼一个影子*（已有 2×4 brick）— 技能：组合（早期 Picture Maker）。活动：2+2 → 2×2 方形；2+1 → 角。
6. **影子只有外轮廓、无格线**（Simple Decomposer，5 岁）— 技能：从整体里看出分解。活动：同一个 4 影子，先给格线，再给无格线版本作为进阶。
7. **5 块 pentomino 精选**（+、L、U、T）— 技能：更大的整体匹配，仍 ≤ 7。活动："+ 形"要先想中间那块放哪。
8. **拼另一半**（对称）— 技能：反射/对称（ACARA Year 2 才正式要求，这里只做体验）[S21]【推断】。活动：左半已有 2 块，拖 2 块到右边让它"照镜子"；竖轴对称。
9. **几何拼片角**（独立分区，不进数字岛）— 技能：拼片组合（Piece Assembler，用三角/正方形）。活动：三角做屋顶 + 正方形做墙 = 房子；拼片无脸、无数字；语音只说"用了 2 片"。
10. **自由创作画**（Make a Picture）— 技能：自发构图、空间语言。活动：无目标、无判错、可保存；家长按钮播放"你用了几块？"类提问（Levine 的空间语言效应 [S24]）。

4.5–5 岁后可解锁：6 块 2×3 ↔ 3×2 ↔ 1×6 的"长方形家族"，7 块"不能排成长方形"的体验（Numberblocks Seven 的梗）【推断】。

---

## 4. 与数字的联系（形状玩法如何不脱离数学）

- **面积即块数**：对 4 岁，只做"数一数用了几块"（cardinality），这与面积轨迹的第一层（覆盖并计数）相容，不要引入"面积"一词或行列结构 [S11]【推断：年龄】。
- **"4 是正方形"**：Numberblocks 把 Four 设定为正方形（四条边四个角），Flatland（S3E16）让 Four"成为真正的正方形"学 2D 形状 [S14]；Nine（S2E4）讲"数字 9 与正方形"[S15]；Square Club（S4E6）1、4、9、16 都是平方数 [S16]。Amber Blocks 的 2×2 站已对齐此线；9 超出 ≤7 数域，留作后续。
- **等量异形**：The Way of the Rectangle（S3E23）Twelve 教大家"把块排成行和列"，Four 发现自己是"特殊的长方形"[S17]；S5 还有 How Rectangly!、Rectangle Racers，S9 The Rectangular Wreck（长方形与周长）[S18]。→ 6 = 2×3 = 3×2 = 1×6 是 6 岁前就能"摸到"的长方形家族。
- **Step Squads**：Fifteen / Step Squads（S3）把三角数做成阶梯形 [S17]。≤7 数域内 1、3、6 可做阶梯；"3 块角"其实就是最小阶梯。
- **对称**：对称影子仍然只数块（左 2 + 右 2 = 4），把反射动作和加法组成天然连在一起【推断】。
- **边界**：几何拼片角里不出现数字伙伴的脸和颜色；"用了 3 片"用不同于数字播报的句式和音色，避免孩子把"三角形"和"3"绑定（PRD §4.5）。
- **衍生节目**：Alphablocks（字母）、Colourblocks（颜色，角色是"friendly shapes"但学习目标只列颜色）、Wonderblocks（编码）都没有专门的形状玩法 [S23]。Blocks Universe 里形状始终挂在 Numberblocks 的数字身上，这与 Amber Blocks 的原则一致。

---

## 5. 提示与反馈建议（面向不识字的 4 岁）

1. **放错不响失败音，块轻弹回或停在原处**；Building Blocks 软件的做法是把不合适的块变半透明、让底下的轮廓露出来 [S13]。这正是"鬼影"的温和版本。
2. **三级帮助阶梯**（与现有 3 tap 一致）：① 影子里格线常显（Piece Assembler 默认）；② 点帮助：缺的格子轻脉动 + 伙伴半透明；③ 再点：直接演示一块滑入（Numberblocks 式"看一遍"），再把块收回让孩子自己放。
3. **旋转**：不用双指旋转手势（Sesame：pinch/多指对学前儿童困难 [S26]）；要么判定容忍任意旋转（现状），要么单击伙伴转 90°。
4. **反馈时机**：松手后判定，拖动中不报；Sesame 建议即时反馈与超时后的提示（time-out suggests next step）[S26]。超时（~8–10 s 无操作）再给第 ② 级，而不是一开始就给【推断：秒数】。
5. **成功反馈要"回看"**：拼成后让影子消失、伙伴整体亮一下、播报"4，一样是 4"；等量异形的站结束时把本岛拼过的形状并排回放。
6. **语音优先、无文字**：所有提示用语音 + 动画，不出现文字说明 [S26]。
7. **鬼影轮廓是否好实践**：是——它既是测评范式（Ghost Puzzle 的"洞"[S7]），也是课程软件的反馈手段 [S13]；风险只在"常显"。

---

## 6. 风险与反模式

- **命名操练**：ACARA F 的 "name" 是在环境里认出并说理由 [S19][S20]，不是闪卡；对不识字的孩子，名称应由语音顺带说出，不做判题项。
- **旋转手势 / 必须旋到正确朝向**：4 岁心理旋转随机 [S5]，双指手势难 [S26]。
- **七巧板过早**：评测机构给 5+/6+/9+ [S28]，45° 斜边对拖放和吸附都不友好 [S9]。
- **过度脚手架**：助力两难——帮助减少挫败但可能导致浅层学习与不愿自己解题 [S25]；鬼影常显 + 自动吸附 = 孩子不需要看形状。做法：先不给，按需加。
- **"拼片数 = 数字角色"混淆**：PRD §4.5 已警告；不要让三角形拼片带数字脸或与数字同色。
- **菱形/斜放正方形**：van Hiele 0 的孩子把斜放正方形叫钻石 [S12]；影子保持轴对齐。
- **镜像判错**：3–7 岁本就混淆 [S8]，判错只会制造挫败。
- **把形状岛做成第二套系统**：polyomino 扩展能复用现有 judge / 模板 / 帮助阶梯；一个独立 Shape Island（七巧板）要新建拼片物理、角度吸附、新判定，与"一个岛教一个新动作"原则冲突【推断】。

---

## 7. 课程对照

| 代码 / 框架 | 内容 | Amber Blocks 对应 |
|---|---|---|
| ACARA v9 Foundation **AC9MFSP01** | "sort, name and create familiar shapes; recognise and describe familiar shapes within objects in the environment, giving reasons" [S19]；熟悉形状 = 圆、正方形、长方形、三角形 [S20] | 步骤 2–5、9（create familiar shapes；方形/长方形来自块） |
| ACARA v9 Foundation **AC9MFSP02** | "describe the position and location of themselves and objects in relation to other people and objects within a familiar space" [S19] | 步骤 3、8 的"上面/旁边/左右"语音【推断】 |
| ACARA v9 Year 1 **AC9M1SP01** | "make, compare and classify familiar shapes; recognise familiar shapes and objects in the environment, identifying the similarities and differences" [S21] | 步骤 4、6、7（同一个 4 的不同形状；比较） |
| ACARA v9 Year 1 **AC9M1SP02** | 给出和跟随方位指令 [S21] | 不覆盖 |
| EYLF V2.0 **Outcome 5.4** | "Children begin to understand how symbols and pattern systems work"；"begin to identify and use the names of basic colours and simple shapes"；"begin to sort, categorise, order and compare collections" [S22] | 全部形状站 |
| EYLF V2.0 **Outcome 5.3** | "use simple tools and techniques to shape, assemble and join materials" [S22] | 步骤 9、10 |
| EYLF V2.0 **Outcome 4** | 好奇、坚持、问题解决等学习性向 [S32] | 无惩罚、可重试的设计 |

"Foundation-ready" 的形状玩法 = 在拼图和环境里认出并造出四种熟悉形状、能说"为什么是方形"（四条边一样）、能比较两种排法的异同；不要求菱形、不要求角度、不要求名称测验。

---

## 8. 来源

- [S1] https://files.eric.ed.gov/fulltext/ED594902.pdf — Clements, Sarama 等 2019 形状组合学习轨迹效能研究；层级定义与随机对照证据。
- [S2] https://www.learningtrajectories.org/math/composing-2d-shapes/piece-assembler — Piece Assembler 层级原文描述与示例活动（pattern block / tangram puzzles）。
- [S3] https://compdecomp.weebly.com/2d-shapes.html — 组合/分解各层级的年龄表（Pre-Composer 0–3、Piece Assembler 4、Picture Maker 5、Shape Composer 5、Substitution Composer 6…）；二手整理，年龄与 Clements & Sarama 书一致。
- [S4] https://www.learningtrajectories.org/math/2d-shapes/shape-recognizercircles-squares-and-triangles — 4 岁左右的形状识别层级描述（非典型方/三角，通常不认菱形）。
- [S5] https://pubmed.ncbi.nlm.nih.gov/23306783/ — Frick, Ferrara & Newcombe 2013：3½–5½ 岁触屏心理旋转，4 岁随机、5 岁出现。
- [S6] https://sonar.ch/documents/305957/files/FrickHansenNewcombe_CogDev13pp.pdf — Frick, Hansen & Newcombe 2013：Ghost Puzzle，3→5 岁正确率 54%→83%。
- [S7] https://www.spatiallearning.org/tools/ghost-puzzle — Ghost Puzzle 工具页：3.5–10 岁、"洞 + 鬼影"范式。
- [S8] https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2018.00140/full — 镜像混淆 3–7 岁、斜向最难的综述。
- [S9] https://www.learningtrajectories.org/documents/1712762945261.pdf — Learning Trajectories "Pattern Blocks and Tangrams"：30° vs 45°、pattern blocks 更易、两套分开。
- [S10] https://pmc.ncbi.nlm.nih.gov/articles/PMC3962809 — Verdine 等 2014：3 岁照模型复制结构（TOSA）与数学能力相关。
- [S11] https://ncm.gu.se/wp-content/uploads/2020/06/19_2_035056_koleza.pdf — Sarama & Clements 面积轨迹层级名称（primitive coverer → row and column → array）。
- [S12] https://en.wikipedia.org/wiki/Van_Hiele_model — Level 0 视觉化、原型识别、斜放正方形被叫"钻石"。
- [S13] https://www.museumofplay.org/app/uploads/2022/01/1-3-article-building-blocks-cognitive-building-blocks.pdf — Sarama & Clements（American Journal of Play）：Building Blocks 软件即时反馈，不合适的块透明化露出轮廓（本次仅经搜索摘要确认）。
- [S14] https://www.tvmaze.com/episodes/1543633/numberblocks-3x16-flatland — Flatland：Four 到平面国"成为真正的正方形"，2D 形状。
- [S15] https://numberblocks.fandom.com/wiki/Nine_(episode) — Nine（S2E4）：数字 9 与正方形。
- [S16] https://numberblocks.fandom.com/wiki/Square_Club_(episode) — Square Club（S4E6）：1、4、9、16 平方数俱乐部。
- [S17] https://simkl.com/tv/653510/numberblocks/episode-23/ — The Way of the Rectangle：Twelve 教行列排法；同站 Fifteen / Step Squads 三角数（episode 28/30）。
- [S18] https://numberblocks.fandom.com/wiki/The_Rectangular_Wreck — S9 长方形与周长；"正方形是长方形"。
- [S19] https://www.australiancurriculum.edu.au/content/dam/en/curriculum/ac-version-9/downloads/mathematics/mathematics-scope-and-sequence-f-10-v9.docx — ACARA v9 F–10 范围与序列：AC9MFSP01 / AC9MFSP02 原文。
- [S20] https://drpaulswan.com.au/quickguide-ac9/foundation/ac9mfsp01/ — AC9MFSP01 解读：熟悉形状 = 圆、方、长方、三角；create 可为画/印/捏。
- [S21] https://www.qcaa.qld.edu.au/downloads/aciqv9/mathematics/curriculum/ac9_maths_yr1_as_cd_alignment.pdf — Year 1 AC9M1SP01 / AC9M1SP02 原文。
- [S22] https://aussiechildcarenetwork.com.au/articles/childcare-programming/eylf-outcome-5-children-are-effective-communicators-v2-0 — EYLF V2.0 Outcome 5.1–5.5 子条目（二手整理）。
- [S23] https://en.wikipedia.org/wiki/Colourblocks — Colourblocks 学习目标只列颜色；Blocks Universe 分工。
- [S24] https://news.uchicago.edu/story/puzzle-play-helps-boost-learning-important-math-related-skills — Levine 等 2012：26–46 月拼图游戏预测 54 月空间变换能力。
- [S25] https://link.springer.com/doi/10.1007/s10648-007-9049-0 — Koedinger & Aleven 2007 assistance dilemma：先扣留、按需加帮助。
- [S26] https://joanganzcooneycenter.org/?p=19607 — Sesame Workshop 2012 学前触屏最佳实践：tap 最直觉、避免 pinch、语音+视觉辅助不识字者、超时提示。
- [S27] https://cornerstone.lib.mnsu.edu/etds/354 — 4–5 岁 iPad 拖放实验：5 岁优于 4 岁，目标尺寸显著影响。
- [S28] https://www.commonsensemedia.org/app-reviews/my-first-tangrams-hd — 评测机构对七巧板 app 的年龄建议（5+；Tangram Pro 9+；ACCM Tangram Quest 6+）。
- [S29] https://blog.playosmo.com/what-age-is-osmo-good-for/ — Osmo Tangram 套件 5–10 / 6–10 岁定位。
- [S30] https://dl.acm.org/doi/pdf/10.1145/2930674.2936006 — 25–48 月七巧板跨媒体试点（n=8）：叙事帮助理解抽象图形。
- [S31] https://onlinelibrary.wiley.com/doi/10.1111/jcal.12411 — Weng 等 2020：学前虚拟 vs 实体七巧板，虚拟组参与度高、完成更快。
- [S32] https://www.education.wa.edu.au/dl/m4okgz9q — EYLF V2.0 Outcome 4 学习性向（好奇、坚持、问题解决）。
