# 万国纪 · Wanguoji — Codex Project Instructions

## Project identity

《万国纪 · Wanguoji》是一个自主运行的架空历史沙盘。

玩家不是选择并操控某个国家，而是观察世界自行演化：

* 国家战争、扩张与灭亡
* 城市建立、围城、陷落与迁都
* 义军与新政权产生
* 王国、帝国、流亡与复国
* 王朝、君主、继承与改朝换代
* WorldEra / HistoryScroll / faction archive / ruler chronicle
* 长期运行后形成可回顾的历史

核心产品原则：

1. observation > micromanagement
2. emergent history > scripted intervention
3. historical narrative > excessive numerical complexity
4. long-running world > short match
5. clear historical feedback > flashy visuals
6. 不要轻易引入复杂经济、外交、科技树
7. 尽量复用现有 authoritative simulation，不建立第二套世界真相

## Technology

主要技术栈：

* React
* TypeScript
* Phaser Arcade Physics
* Redux Toolkit
* Vite
* Vitest
* Electron experimental desktop runtime

使用 pnpm。

修改前先检查：

* git status
* 最近 git log
* package.json version
* src/config/version.ts
* README.md
* ROADMAP.md
* CHANGELOG.md
* 与当前任务有关的真实源码和测试

不要仅依据旧聊天、旧报告或版本号猜测当前代码状态。

## Development philosophy

这是个人开源项目。

优先：

* 小而安全的修改
* 清晰的数据语义
* 可验证的历史一致性
* 长局稳定性
* 复用现有代码
* 避免为了“架构漂亮”进行无必要大重构

如果发现问题，应先分析根因，再决定是否修改。

不要因为用户提出一个主观想法就自动实现。

如果当前实现实际上合理，应说明原因。

## Source of truth

真实代码是最终 source of truth。

特别注意：

* Team / City / User / Player 等部分对象同时包含 gameplay state 与 Phaser runtime state。
* WorldHistory、WorldEra、DynastyRegistry、FactionRegistry、WorldEventSystem 等拥有影响未来演化的内部状态。
* 不允许通过 UI 显示结果反推并覆盖 canonical simulation state。
* 不建立一套与真实 Phaser / simulation path 脱离的第二模拟器。

历史事件必须正确区分不同视角：

* faction history
* city history
* ruler biography
* world history

一个事件对某实体有历史关系，不代表一定属于该实体的个人纪事。

## Time semantics

项目历史代码中很多变量名称包含：

* year
* xxxYear

但实际数值通常是 month index。

不要为了无关任务大规模 rename 旧 API。

新增 schema / persistence / API 时优先使用：

* worldMonth
* monthIndex
* foundedMonth
* accessionMonth
* endMonth

避免继续扩大 year/month 技术债。

## Persistence architecture

Save / Continue 必须遵循：

Live Runtime
→ versioned JSON-safe DTO
→ validation
→ hydration
→ Live Runtime

不能直接 JSON.stringify Redux state。

不能序列化 Phaser Scene / Sprite / Group / Physics Body 对象。

但决定 simulation outcome 的数值，例如：

* unit position
* velocity
* ownership
* cooldown
* sequence
* ruler state
* city state

属于 canonical gameplay state，必须正确持久化。

Hydration 不得重复产生：

* history events
* rulers
* cities
* faction identities
* random velocity
* ID sequences

不要把普通 new-world initialization 当作 hydration。

## Simulation balance

除非当前任务明确要求调整 balance，否则不要修改：

* war
* siege
* rebellion probability
* Empire Split probability
* restoration probability
* WorldCycle thresholds
* population growth
* emperor/unification conditions

发现 balance 问题时可以分析、记录和提出建议，但不要顺手调参。

长期优先通过 metrics / diagnostics 后再调 balance。

## Historical semantics

历史文字必须由真实 canonical facts 支撑。

不要为了让故事“听起来合理”而编造：

* 亲属关系
* 建国经历
* 继承关系
* 战功
* 复国经历

例如：

没有 parent / kin evidence 时，不要把普通 leader successor 写成“宗室”“亲戚”。

## Versioning

通常每个小版本只承担一个主要主题。

完成版本时：

* 更新 APP_VERSION
* 按项目当前规律更新 package version
* 更新 CHANGELOG

不要自行跨版本继续开发下一主题。

## Required verification

修改后至少运行：

* pnpm test
* pnpm build

已有测试不得为了让新实现通过而随意删除或弱化。

如果适合，增加针对真实根因的纯单元测试或 integration test。

## Browser / visual verification

不要用 CLI screenshot、Playwright 等方式强行代替用户真实 Chrome 试玩。

代码、unit test、build 可以由 Codex 完成。

涉及以下内容时，应在最终报告中明确列出人工 Chrome 检查项：

* 地图视觉结果
* 城市/势力 UI
* HistoryScroll
* ChapterBanner
* WorldEra
* 王室/君主详情
* Phaser runtime
* Save/Load 后肉眼地图一致性
* 后台运行表现

如果当前任务要求 Manual Chrome Gate：

完成代码后必须停止。

必须写：

【等待用户人工 Chrome 检查，收到用户回复前不得继续下一版本】

在用户回复之前：

* 不开始下一版本
* 不擅自扩展 scope
* 不把 test/build 通过视为视觉验证通过

## Response format after implementation

完成一个版本时，报告至少说明：

1. 根因
2. 修改内容
3. 未修改内容
4. tests
5. build
6. 风险
7. 人工检查项（如需要）

不要只回复“已完成”。
