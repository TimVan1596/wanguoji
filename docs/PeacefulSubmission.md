# v0.99929 — Peaceful Submission / 纳土归附

APP_VERSION v0.99929 · package 0.99.116 · WorldSave V11。

起始真实基线f809702（v0.99928b/package0.99.115/V10），工作树干净。用户已人工通过Diplomacy II全系列，包括Strategic Union续约年龄连续性和v28b签约/升级/续约文案，现正式冻结。

## 语义与实现

EXTINCT为战争覆灭/流亡残部消散；MERGED保留同源Strategic Union；SUBMITTED为不同源正式国家通过长期和平关系行政纳土。统一canonical terminationTargetFactionId/terminationMonth，不新增第二套submitted target。内部runtime status仍为既有terminal EXTINCT，由terminationReason明确区分。

复用已有territory metrics的controlledTerritoryShare、areSameOriginFactions、areFactionsTerritoriallyAdjacent和evaluateCommonThreatCredibility。百分比沿用现有受控领土分母，未另建世界规模指标。

硬门：双方ACTIVE、STATE、有城；不同源；NAP或Alliance当前有效，连续关系分别至少96/60个月（从originalStartedMonth计，续约/升级不会重置）；接壤；最近60月无city-captured/capital-fallen双边事实。弱国一城、份额≤8%、稳定≤55；强国份额≥25%；弱份额≤强份额¼。

两路径都保留上述极弱条件。若Alliance记录的共同威胁当前仍CREDIBLE/SEVERE，标ALLIANCE_PROTECTION；否则走ASYMMETRIC_PEACEFUL_RELATION，不虚构外敌。严格可信威胁函数仍要求2.5倍优势，保护型在强国≥25%下自然较难；不因此改冻结外交参数。

年度确定性评价，最多1次SUBMITTED：Alliance优先→连续关系更久→领土份额差更大→弱国稳定更低→弱/强factionId稳定排序。不抽WorldRandom，不逐月重复评价。同源候选明确SAME_ORIGIN_USES_STRATEGIC_UNION，既有合邦条件不改。

复用行政吸收mechanics：城市历史单独submitted，不增加captureCount；blocks/users转给接受国，population mutation cause FACTION_SUBMISSION。末代君主status=abdicated，endYear/politicalEndYear为纳土月、endReason=纳土退位；heirs/exiled候选转kin，候选池退出，档案/epoch/真实parent edge保留，不连接接受国谱系。人口中的ruler unit转NORMAL，人物不写死。源势力停farms并释放terminal colliders，Diplomacy.removeFaction清理关系/记忆。

faction-submitted为重大politics事件，metadata保存双边关系/连续期/续约数、核验无战争窗口、双方当时领土/城市/弱国稳定、可选真实威胁和双方君主。历史标题/详情按事件月份身份解析。接受国国势可见“X纳土来归”，不新增国评。

天下势力改“终结”，区分覆灭/归并/纳土；纳土详情提供对象/时间/末代退位君主，旧国号/王统/君主/宗谱/历史仍可浏览。

## Persistence / Diagnostics

V11保存统一终结字段、退位档案、行政城市/blocks/人口归属与Diplomacy清理。V10及更旧在PRECHECK拒绝，无migration，不先teardown旧世界。IndexedDB版本仍2。源码保留既有legacy type/factory aliases，它们都生成V11，不代表旧DTO兼容。

Peaceful Submission debug区：sessionCumulative/recent100Years的candidateChecks/eligibleCount/submissionCount及各blocker计数，最多10个最近年度候选，含实际双方、relation、连续月份、territory/cities/stability、sameOrigin、warFreeMonths和可选可信威胁。诊断按最多101个年度采样桶保留最近100年，在新世界/读档reset，不进入存档，不抽RNG。未启用debug不记录样本。

NO_PRESSURE_PATH保留计数项；当前两个路径共享严格极弱门，未满足时由具体实力/稳定/关系blocker解释，不加另一套隐藏压力评分。

## 自动验证边界

规则矩阵、有效NAP/Alliance、实际威胁保护路径、同源互斥与旧合邦、稳定排序、每年度最多一次、debug on/off同seed/RNG、诊断有界；实际Dynasty/Team terminal方法与编排、实际City行政方法；V11实际hydrate/export结构往返、退位/kin档案、旧版本preflight拒绝；20k历史中的纳降有界查询、历史身份与国势。Phaser渲染/真实滚动/宗谱视觉/真实Save-Load仍须人工。

运行：pnpm test -- --run、pnpm build、pnpm desktop:build、pnpm desktop:compile、pnpm desktop:renderer-debug-build、git diff --check。

## 人工 Gate：请直接按下面做

运行`pnpm desktop:start:debug`。因为V11，创建新世界，4×运行。最多到1500年；出现纳土事件就可立即停止，不继续寻找更多样本。

1. **找事件**：历史卷轴→大事→纳降，找“X纳土归附Y”。复制标题及展开后的全部文字回传。
2. **提交国状态**：天下势力→终结→X，复制国家名称、状态、归附对象、归附时间。
3. **末代君主**：X→王室→末代君主，必须“纳土退位/归附退位”，不能死亡/战死/被俘/彻底灭亡。复制顶部信息。
4. **宗谱**：查看完整宗谱，确认X旧王室没有与Y王室伪造父子/血缘。回传“宗谱正常”或“宗谱有问题”。
5. **地图**：X原城市和领土应全部变成Y颜色，无旧色孤岛。回传“地图转移正常”或“地图有残留”。
6. **保存读取**：纳土后Save→Load再打开X，仍纳土于Y、君主退位、地图归Y。回传“Save/Load正常”或“Save/Load异常”。

如果1500年没有纳土：不要继续跑。世界诊断→展开→Peaceful Submission，把整块JSON原样复制回传，无需解释。不自行调门槛或开始下一版。

地图、UI、宗谱与历史语义由用户真实浏览器验收，CLI/headless不能宣布通过。

【等待用户人工 Chrome 检查，收到用户回复前不得继续下一版本】

【等待用户人工回传 v0.99929 Peaceful Submission Gate；收到回复前不得开始 Faction Historiography、Era Atlas II、Dynastic Narrative II 或 Ruler Political Evidence II。】
