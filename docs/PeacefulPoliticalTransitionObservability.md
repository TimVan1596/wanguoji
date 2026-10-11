# v0.99931g · Peaceful Political Transition Observability

## 状态与基线

开始时真实 HEAD `2d6fe49`，工作树与暂存区干净，APP v31f / package 0.99.135 / WorldSave V13。用户明确回传 v31f 最终人工 PASS：秦4岁儿子、魏34岁弟弟、楚28岁弟弟为储君，其余四国没有指定储君；V13与历史 UI 正常。关闭该 Gate，但未声称已收到七国所有创始者年龄和完整亲属明细。

工作期间用户自行提交 `9487f2b`、`6fc1fa0`；保留全部提交。Codex 未执行提交、暂存、重置或改写暂存区。目标 APP v0.99931g / package 0.99.136 / WorldSave V13。自动验证完成，人工诊断 Gate 等待回传。

## 审计结论：实际门槛与顺序

### 纳土

`AutoSimulator.update` 在每12个月调用 PeacefulSubmissionSystem；重复同月或非年度更新不会再次评估。没有随机抽签。所有 ACTIVE 国家两两检查，双方必须正式 STATE、仍有城市且非 isDie；同源明确阻断。

有效 ALLIANCE 连续外交关系至少60个月，NON_AGGRESSION 至少96个月，使用 originalStartedMonth，不因续约重置。还必须接壤、最近60个月无真实双边 city-captured/capital-fallen；强方领土至少25%，弱方恰好一城、领土不超过8%、稳定度不超过55，弱方领土不超过强方25%。这里的领土比例是现有 TerritoryMetrics 的 controlledTerritoryShare，分母为已归属领土，不是整个世界格子。

共敌只区分 ALLIANCE_PROTECTION 和 ASYMMETRIC_PEACEFUL_RELATION 两种事实路径，后者不强制共敌。NO_PRESSURE_PATH 没有进入实际 getSubmissionBlockers，已从诊断初始化的真实阻断清单中去掉；不新增该门槛。

全部合格候选按 ALLIANCE优先→连续外交更久→国力差更大→稳定度更低→稳定 factionId 排序，每次至多尝试首项。正式执行入口 executePeacefulSubmission；唯一 false 守卫为任一方非 ACTIVE。

### 同源合邦

每12个月，在纳土之前执行。findStrategicUnionCandidate 只扫描当前 ALLIANCE，按 startedMonth→双方ID排序，选择首个合格对；不随机抽签。同源来自直接分裂父方/共同父方，不是血缘证明。

必须双方 ACTIVE、同源、接壤，同盟至少60个月（用 startedMonth，不把此前NAP计作同盟年限），双边无战争至少60个月；弱方领土不超过强方60%、城市数不超过强方；还须满足下列其一：

- 现有共同威胁仍有关联：威胁领土至少为双方较大领土的2.5倍，且分别接壤或有近期战争接触；这是原有大小/接触判定，不是 Diplomacy II 的 CREDIBLE/SEVERE 函数。
- 极弱：弱方≤8%、≤1城、稳定度≤45。

代码没有额外的 STATE 身份硬门；本版如实报告，未擅自增加。实际 finder 还跳过受控格数相等的组合；旧 diagnose 可能漏报该跳过，本版只修诊断的 EQUAL_TERRITORY_STRENGTH，不改实际选择。

合邦行政执行入口仍为 AutoSimulator.mergeFaction；纳土随后读取清理后的外交关系和改变后的势力状态。事件、城市/人口/地块转移顺序完全保留。

合邦战争检测按已有事件参与势力集合，纳土按 actor/target；未将这两种真实口径擅自统一。合邦近期战争可能同时产生 ALLIANCE_TOO_SHORT 与 RECENT_BILATERAL_WAR，计数允许重叠。

## 原因为什么不能凭旧诊断判断

纳土旧 getDiagnostics 只有 checks/eligible/submission 和阻断；只在 debugProfileEnabled 时累积，没有选择/失败/独立对口径。同源合邦原来只有最多5组当前候选，没有会话漏斗。存档没有保存历史资格；缺少事件无法区分“没有外交机会”和“门槛未过”。所以目前不能以用户千年存档中事件少，直接认定某条规则过严。

本版保留既有 getPeacefulSubmissionDiagnostics、5组合邦样本等消费者，新增统一运行时观测，不另建历史事实存储。

## 漏斗与口径

两类系统各自提供：observedWorldMonths、evaluationTicks、pairChecks、preliminaryEligiblePairs、fullyEligibleChecks、uniqueEligiblePairs、selectedAttempts、successfulTransitions、executionFailures、blockerCounts、soleBlockerCounts、failureCounts、Top5阻断、最近10个候选、recent100Years。

- 纳土 pairChecks：年度 ACTIVE 的实际两两检查；preliminary：有效NAP/ALLIANCE，不代表资格通过。
- 合邦 pairChecks：实际被扫描的正式ALLIANCE且双方ACTIVE组合；preliminary：同时同源。另列 allNationalPairs、sameOriginPairs、formalAlliancePairs、allianceAndSameOriginPairs，避免将不存在同盟的组合冒充已查资格候选。
- fullyEligibleChecks 为年度重复检查；独立组合按排序后的稳定ID识别，不因方向、续约或连续合格而重复算新对。
- fullyEligibleChecksWithoutSelection 为合格检查减去实际尝试，可见年度至多选一项的差别。
- 失败包括实际非ACTIVE守卫、合邦返回后未形成MERGED状态、异常类型；异常照常抛出，不吞掉、不重试。未知回调false明确标为 CALLBACK_RETURNED_FALSE_WITHOUT_REASON，不编造业务失败原因。
- 多阻断之和可超过pairChecks；soleBlocker只在唯一阻断时增加。无样本通过率/频率为0，不出现NaN。

只有调试配置启用才累计详细资格漏斗；普通模式不额外扫描组合。新建或V13 importState重置会话。实际推进月份逐月记录，不把加载以前的几千年或未观察的间隔纳入分母。

## 只读反事实

纳土：

1. 只去掉“恰好一城”，其余门槛全部按真实函数判定。
2. 只将三条领土门槛改为强方≥20%、弱方≤12%、弱方≤强方40%，仍须一城、低稳定、真实外交/和平/接壤/不同源等。参数用于辨别三个领土条件共同形成的筛选，不是建议或实际改参。

分别给出该假设的合格检查数与相对实际资格的新增检查数。不会把 WEAKER_TOO_LARGE 次数直接当成新增成功数，城市不符和领土超标有明确分离。

合邦：只在其他真实门槛均通过时统计“缺少共同威胁”“不极弱”，并另计只被 NO_PRESSURE_TRIGGER 阻断的新增合格检查。两条压力路径是 OR；两个缺失指标可同时出现，不能相加当作独立候选或成功事件。

所有反事实都不参与选择、执行或RNG。

## 历史与频率

本次会话频率 = 本次实际成功数 / 实际观测月份 ×1200。年度检查次数与旧历史年份没有混用。

存档 canonical faction-submitted / faction-merged 事件按类型可靠计数，显示为 retainedCanonicalHistory，与会话结果分开。因为没有独立证明历史区间完整性，frequencyPer100Years 为 null，并明确“旧历史资格不可回溯”；不声称保留事件数就是完整世界发生率。

首次读取或历史变化时使用 WorldHistory.getEventWindow 分批计数；相同revision和事件数复用结果，不在每帧重扫历史。读取世界清缓存。

## 内存与性能

计数只在已有月度观察/年度检查更新，不每帧查资格。最多100个年度桶（当前观察历年及前99年，含当年未满12个月；只实际观察月份作为分母），最近候选10项。会话独立对容量4096；每个年度独立对容量256，最近窗口合并容量4096；溢出明确 uniquePairCountIsLowerBound，不假装精确。独立对合并结果按年度与资格revision缓存。

异常分类有限；不保留每条无关外交事件；所有数据不进入WorldSave。Canvas、国史、人物与王统数据不改。

## 自动验证与真实模拟限制

- 全套 `VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1 pnpm test`：202文件、1398测试通过；未放宽超时或削弱旧断言。
- pnpm build、desktop:build、desktop:compile、desktop:renderer-debug-build 全通过。资产与调试source-map检查通过，保留既有大chunk提示。
- git diff --check、git diff --cached --check 均通过；暂存区检查为空，没有为通过检查改写暂存内容。
- 后补一个更严格断言：真实新世界启用/禁用诊断时导出的V13及RNG完全相同；对应持久化测试32项重跑通过。

新增17项测试覆盖反事实、压力 OR、漏斗、独立对溢出、100年边界、reset、真正执行失败、报告复制与历史查询缓存。真实AutoSimulator年度路径验证两种成功事件与先合邦后纳土；开启/关闭诊断对 history、dynasty、diplomacy、终结状态、RNG 的结果一致。真实新局Exporter→Validator→Hydrator→Exporter保持canonical，恢复时清会话，不回填资格。

运行种子 `transition-runtime-order`：构造3个国家、有真实外交关系的可验证场景，分别观察119→120月的一次年度更新；不同源场景纳土成功1次，同源场景合邦成功1次，纳土看到合邦后的状态。两类各启用/禁用诊断重复。守卫失败夹具在选中后让接受方非ACTIVE，真实执行返回false，失败1、成功0、没有终结事件。

这些测试复用真实AutoSimulator、Diplomacy及行政转移/终结代码，但省略空间战斗、人口、时代演化、月度继承及世界目标子系统。它们证明执行与观测一致性，**不是真实自然长局事件率**。2万条历史数据也仅是查询性能夹具。

**本轮未取得可靠的完整Phaser/Electron多seed千年自然长跑数据。** 不提供伪造平均存续国数、自然外交次数、每百年转型率或门槛排名。最值得讨论的实际限制暂无证据；需原长局继续10～20年取得候选基础、sole blocker与反事实增量后再判断。合邦没有STATE硬门、两种战争关联口径不同仅作为现有机制审计记录，未顺手修玩法。

## 修改文件

- PoliticalTransitionObservations.ts / .test.ts：有界运行时漏斗、频率与缓存。
- PeacefulSubmissionSystem.ts：复用现有结果观察、纳土反事实；规则和排名不改。
- StrategicUnionSystem.ts / .test.ts：补齐诊断skip与压力观察，不修改finder和canForm规则。
- AutoSimulator.ts：原周期/原顺序接入观测、reset、保留事件计数。
- PeacefulSubmissionExecution.test.ts、WorldSaveReferentialIntegrity.test.ts：真实执行、canonical、恢复与旧历史隔离测试；业务执行函数不改。
- Core.ts、WorldDiagnosticsPanel.tsx / .test.ts、DiagnosticsReport.ts / .test.ts：既有诊断入口和复制功能。
- version.ts、package.json、DesktopSecurity.test.ts、CHANGELOG、ROADMAP、本报告。

WorldSave V13 schema/持久化字段、canonical事件内容、游戏概率与门槛、同源规则、继承、人物生死、庙谥、国史、地图、随机数消费均不改。运行时诊断是附加读数，不决定模拟。

## 用户人工 Chrome/Electron Gate

运行 `pnpm desktop:start:debug`，继续原V13长局，不用新建数千年世界。

1. 在右下角【世界诊断】点击【展开】，找到并展开 **Peaceful Political Transition Diagnostics**。复制该块全文；也可以点击已有【复制核心诊断】或【复制全部诊断】，粘贴其中同名段落。
2. 首次加载应看到会话起点为加载年月、观察月份和资格检查为零或仅加载后实际推进的量；历史事件数单独列示。确认納土和同源合邦各有统计，旧历史资格不可回溯说明存在。
3. 继续运行约10～20个世界年，再复制同一块。观察检查次数与实际月份增长，成功/历史事件不凭空增加，无明显卡顿。不需等待真正转型。
4. 新七国世界正常运行一段时间，保存V13→读取→继续运行；会话明确reset，王室/国史/宗谱/历史卷轴保持正常。

```text
原V13长局：
当前世界年月：

和平政治转型诊断摘要：
（直接复制调试面板原文）

继续运行后的世界年月：

继续运行后的诊断摘要：
（直接复制调试面板原文）

纳土候选与阻断：正常/异常
同源合邦候选与阻断：正常/异常
会话统计与历史统计区别：正常/异常

V13保存、读取、继续运行：正常/异常
国史、政治宗谱、历史卷轴：正常/异常
运行性能：正常/异常

最终人工Gate：PASS/未通过
异常原文或界面位置：
```

自动测试不是浏览器视觉验收。未进行CLI截图、Playwright或自动视觉Gate。

【等待用户人工 Chrome 检查，收到用户回复前不得继续下一版本】

【等待用户人工Chrome/Electron检查，收到用户明确PASS前不得继续下一版本】
