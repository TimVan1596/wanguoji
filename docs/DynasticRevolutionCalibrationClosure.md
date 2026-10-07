# v0.99927d — Dynastic Revolution Calibration Closure

本轮真实基线：e09022f／v0.99927c／package0.99.109／WorldSave V9，工作树干净。目标v0.99927d／0.99.110，V9／IndexedDB2不变。

## 人工结果与审阅

用户新世界4×约2445年：589 succession boundaries，142 vulnerability eligible，8 crisis eligible，6 hard eligible／roll attempts，6 failures，0 usurpations。NO_SUCCESSION_CRISIS581、SUCCESSOR_NOT_VULNERABLE447为独立计数，不是逐级漏斗。

六次最终chance约7／6／6／15／10／6%，合计期望约0.50；全部失败概率约59.1%。随机零次不是普遍提高概率的理由。原代码只允许succession-crisis；581／589边界被这一层级挡住，不能用现有六次draw判断概率是否过低。

既有SuccessionRules的真实最近继承计数包含当前一次：>=3为crisis、2为instability、1为shock；现有minor权重也进入crisis。故minor与真实连续换君已经在最高层，不能用它们伪造下层新证据。本轮不修改普通继承与危机等级规则。

## 最小复合入口

仍必须有真实合法successor、STATE、ACTIVE、有城和真实vulnerability。最高crisis路径及原contextual chance完全保持。

shock或instability只在两个独立事实同时成立时进入：

- 现任统治因combat或captured结束；
- 当前国家恰好仅余一城。

普通死亡＋孤城、仅战死／被俘＋多城、低稳定但缺乏复合证据，都不能进入该低层入口。没有每月／UI抽签，也没有新增政治模拟。

最终chance：原基础档位＋原事实加成，先cap18%，再乘tier系数：crisis1，compound instability0.5，compound shock0.25。最高层不提高；新层不超过9%／4.5%。相同其他条件下shock<instability<crisis。每个eligible succession boundary最多一个WorldRandom draw；成功后沿用原新王统生成所需RNG。

NO_SUCCESSION_CRISIS保留为兼容blocker名称，含义明确为“既不具最高危机，也无足够下层复合暴露”；crisisEligibleCount继续只数原最高层，lowerRiskEligibleCount额外数hard-eligible下层。样本记录riskTier／riskMultiplier／实际computedChance与既有crisisLevel，不伪称shock为crisis。

## Session-only期望诊断

cumulativeGate新增worldMonth、sessionStartMonth、elapsedWorldYears。新世界从0计；hydrate从存档worldMonth计，计数与期望重置。UI查询用当前canonical worldMonth，暂停不推进分母，即使当前没有新boundary也能更新经过年数。不进入save，也不消费RNG。

- eligibleRollsPer1000Years = rollAttemptCount ×1000 / elapsedWorldYears
- expectedUsurpationCount = 所有实际draw boundary的computedChance之和（成功／失败都算；硬门失败不算）
- expectedUsurpationsPer1000Years = expectedUsurpationCount ×1000 / elapsedWorldYears
- estimatedWorldYearsPerExpectedUsurpation = elapsedWorldYears / expectedUsurpationCount
- actualUsurpationsPer1000Years = session usurpationCount ×1000 / elapsedWorldYears

分母为0时对应rate为null；期望为0时estimated years为null，表示暂不可估计。chance buckets区分原base档位、最终百分比（包含折扣小数）和三个tier；最近eligible／all-boundary样本各最多10条。Repeated UI读取不重复累加。

这些量是已观察机会的条件期望，不是未来保证或精确置信区间；零实际事件仍需同时看期望机会数。旧存档累计epoch数与session usurpationCount不同口径。

## 范围与风险

不改战斗、人口、普通继承、外交、历史事实语义、Save schema、Desktop scheduler或性能实现。原USURPATION canonical路径完整保留。2445年低FPS／unlock后卡顿记录为known performance debt，本轮不处理。

复合入口的自然频率尚未知；不能为了让Gate出现事件再加概率或硬制造死亡。自动forced-roll测试只验证路径，不能代替视觉或自然长局。

## WAITING FOR USER MANUAL GATE

浏览器：`pnpm dev`，打开本地页面并启用debug诊断（`?debug=1`）；或沿用`pnpm desktop:start:debug`默认scheduler。新世界正常4×运行，约800～1500年复制核心／完整诊断，回传：

- worldMonth／elapsedWorldYears／sessionStartMonth
- successionBoundaryCheckCount
- crisisEligibleCount／vulnerabilityEligibleCount／lowerRiskEligibleCount
- hardEligibleBeforeRollCount／rollAttemptCount／rollFailedCount
- expectedUsurpationCount／eligibleRollsPer1000Years
- expectedUsurpationsPer1000Years／estimatedWorldYearsPerExpectedUsurpation
- usurpationCount／actualUsurpationsPer1000Years
- recentEligibleBoundaries／chanceBuckets；若仍无机会则加blockerCounts／recentBoundaryChecks

A：自然频率验收不要求随机必定看到一次篡朝。综合hard eligibility、tier、抽签数量及期望频率判断；当前不预设必须每N年发生一次。只出现rollFailed时回传，不自动提高概率。hard eligibility仍0则回传事实，不自行再扩展入口。

B：如果自然出现篡朝，人工观察：国家id／领土关系继续存在，王统epoch正确更替；旧合法继承人真实存在，没有伪造死亡或血缘；当前国号／旗色改变而旧事件仍显示旧名旧色；王室当前／历代王统、新君badge、政治宗谱多root、君主大事记与历史卷轴重大事件事实正确；保存／重载后身份、epoch、档案、谱系及历史一致。

上述视觉与历史语义必须用户完成；命令行测试／构建不能宣布验收通过。

【WAITING FOR USER MANUAL GATE】
【等待用户人工 Chrome 检查，收到用户回复前不得继续下一版本】
在用户明确回传前，不进入Diplomacy II、纳土归降、Faction Historiography或Era Atlas II。
