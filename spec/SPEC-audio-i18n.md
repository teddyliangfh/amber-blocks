# Spec: audio-i18n（精简版，D-030 自主推进）

模块 id：`audio-i18n`。日期：2026-10-13。状态：已实现并在浏览器验证（2026-10-13，Checkpoint 6）；助手自审，边实现边修订。

## Objective

把 content 的语义 key 变成当前语言的一句话声音。M2 目标是手机网页：使用浏览器内置 `speechSynthesis`（iOS Safari / Chrome 离线声音，运行时零网络）。预生成 mp3（edge-tts）在本机被企业代理证书挡住，保留为后续增强（D-031）。

## 结构

```
src/audio-i18n/
  speak.ts   Voice 端口（say / stop / isSupported）+ web 实现 + 静音实现；speakKey(voice, key, lang, params, { interrupt })
  index.ts
```

## 规则

- 文本来自 `format(key, lang, params, { numbers: 'word' })`：数字读汉字 / 英文单词。
- 打断规则（AC-05、AC-29）：提示与反馈 `interrupt: true`（新句子取消旧句子）；点数数词 `interrupt: false`（排队，顺序一致，不叠加）。
- 切语言：先 `stop()`，再按新语言播放（AC-18）。
- 不支持 / 被浏览器拒绝 / 静音：静默返回，界面照常可用（AC-06、AC-16）。
- 首次用户手势解锁：首个 `say` 由用户点击触发（地图点站、点大数字）。
- 选声音（2026-10-14，用户试玩"配音太可怕"）：不再取列表里第一个本地声音。Apple 系统把特效 / Eloquence 声音排在前面（zh-CN 第一个是 "Eddy"，en-US 是 "Albert"），孩子听到的是机器人怪声。`pickVoice` 按名字排序：优先温和女声 / 童声（zh：Xiaoyi、Xiaoxiao、Tingting / 婷婷、Yu-shu、Lili、Google 普通话、Meijia；en：Ana（童声）、Jenny、Aria、Ava、Samantha …），同名里 Premium > Enhanced / Natural > 普通，再看是否本地；特效、老年、Eloquence 声音（Albert、Zarvox、Eddy、Grandpa、Rocko …）永不选；粤语（zh-HK）不用于中文。都没有时不指定声音，交给浏览器按语言选默认。音调 `pitch = 1.1`，比原声略亮、不尖。
- 纠正提示用 `interrupt: false` 排队，不打断点数数词和题目播报（时机见 SPEC-screens"可见答题反馈"）。
- 原生端（Expo Go）暂为静音实现；接 `expo-speech` 时只换 Voice 实现。
- 音效（`sfx.ts`，Web Audio 合成，D-036）：过关 `success` 与 Boss `fanfare` 的每个音整体晚 `SOLVE_AFTER = 0.1` 秒，让促成答案的那一下落地声（`drop`）先响（2026-10-16 测评 H-1）；地图上前进标记落地只响一下 `tap`，进站音 `arrive` 只在关卡打开时响一次（D-4）。
- 比较音 `compare`（Phase 23c，D-128）：`play('compare', rail, [child])` 先响孩子那个数的点数音、`COMPARE_STEP`（0.28 秒）后再响比较台的数：多是高→低、少是低→高、一样是同音两声；排队 `play('compare', 4, [1, 3])` 从小到大三声。关卡页在过关第二拍（彩纸时）响。
- 停止（2026-10-16 测评 H-3）：点"再数一遍"、或一次改动让工作台上的块变多 / 变少而本轮已有数词时，界面先 `stop()`，旧数词和"一共 n 块"不再接着念。

## 验证

- `speak.test.ts`：打断 / 排队逻辑用假 `speechSynthesis` 验证；文本与 key 一致；按 2026-10-14 在 macOS Chrome 读到的真实声音列表验证选中 Tingting / Samantha、从不选特效声音、Enhanced 与在线童声优先、只剩特效声音时不指定。
- 浏览器（Playwright 无头 Chromium，macOS 声音列表）：`speak` 被替换为记录函数，实际选中 "Tingting"、pitch 1.1。真机 iPhone 上的实际发声未听验。
- 浏览器：中 / 英各听一遍提示、数词与反馈。
