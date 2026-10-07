# v0.99927c Dynastic Revolution Calibration

## 基线与根因

本轮真实起点05f63fb／v0.99927b5／package0.99.108／WorldSaveV9，工作树干净。

v27b性能审计正式结束。用户b5回传：RAF＋prevent-app-suspension锁屏18min后rolling~56 FPS／fixed CPU1.3ms／steps3.7，unlock1／5／10s callbacks17.5／50.5／58.2；timeout＋blocker OFF锁屏12min后rolling52.6／steps3.96，callbacks39.8／51.2／51.6。两者主观可正常游戏，保留为显式debug／compatibility实验，不更改release默认RAF＋OFF。Terminal disposal、collider lifecycle、WorldHistory索引发布、bounded accumulator、wake resetDelta与A/B诊断均冻结；不做b6或新performance审计。

篡朝多轮长局分别93／180／463／732+ succession boundaries，旧stabilityEligible／fullyEligible／rollFailed／usurpation均0。真实源码在继承人选择之后，以stability>25直接阻断；没有机会进入4%draw，因此不能归因于抽签运气。本版只移除这个独立硬门。

## 硬门与概率

必须同时满足：既有规则选出的eligible lawful successor；STATE；ACTIVE；cityCount>0；已有succession-crisis；至少一项真实vulnerability evidence。未满足任一门：chance0、不draw、继承逻辑继续按原路径。

crisis与evidence继续复用现有SuccessionRules（幼年继承人的既有危机加权、真实历史换君链），不新增宫廷／大臣／prestige模拟。RECENT_SUCCESSION_CHAIN只使用真实历史transition，不把幼年加权伪写为换君次数。零城不是ONE_CITY_REMAINING。

| 稳定度 | 基础chance |
| --- | --- |
| >60 | 4% |
| 46–60 | 6% |
| 31–45 | 10% |
| <=30 | 14% |

已有事实加成：被俘前君+3个百分点、仅余一城+3、真实近期换君链+2、幼年合法继承人+2、前君战死+1。总chance cap18%。加成按证据种类各一次；不会每个evidence分别roll。基础与加成用整数百分点计算，避免严格`roll < chance`边界出现浮点累计误差。

基础档位不是最终chance。例如稳定度80＋幼年继承人＋一城：4+2+3=9%；稳定度20同样事实：14+2+3=19，cap为18%。现有succession-crisis通常同时满足minor或真实换君链证据，因此4%基础档位常对应至少6%实际chance；诊断分别记录base与final，不误称实际4%。高稳定但无危机绝不篡朝。

纯函数`getDynasticRevolutionChance(context, preRollEligibility)`不修改状态、不消费RNG。`evaluateDynasticRevolution`仅在原succession boundary调用，eligible只调用一次WorldRandom.next，随后保存返回的chance与实际roll供诊断观察。不在月更新／UI／debug额外抽签。成功之后原有新house／新君／国号／颜色生成本来就会使用RNG，不属于额外revolution hazard roll，本版没有改变这些生成路径。

## Canonical保持

Dynasty.succeedRuler与consumeHeir的实际流程没有重写。USURPATION仍保留displaced living successor／旧朝宗亲，不伪造死亡或parent；新旧house多root、house epochs、国号及旗色history、factionId／外交pair、旧Era palette、featured history event、王室badge与文案均沿用原路径。无合法继承人的NEW_HOUSE仍自然易姓，不写篡朝。

WorldSaveV9／IndexedDB2保持。只有规则与session diagnostics变化，无新canonical字段或迁移。b5 V9旧存档可Load，之后适用本版概率规则；不承诺跨版本后续轨迹与旧规则完全相同。本版same-seed／RNG续接仍要求同版本、相同输入完全可重复。

## Revolution Gate diagnostics

主计数：successionBoundaryCheckCount、hardEligibleBeforeRollCount、rollAttemptCount、rollFailedCount、usurpationCount。保留辅助hasLegitimateSuccessor／crisis／vulnerability独立计数与hard blocker次数；移除stabilityEligibleCount、fullyEligibleBeforeRollCount旧名称、STABILITY_TOO_HIGH。

正常每个hard eligible boundary一次roll，因此hardEligibleBeforeRollCount=rollAttemptCount；rollAttemptCount=rollFailedCount+usurpationCount。这里usurpationCount是本session结果，外层revolution.usurpationCount仍为存档累计epochs，口径不同。

chanceBuckets.base记录4／6／10／14档；final记录4～18整数百分比实际chance；modifierAppliedCount／cappedCount与这些档位重叠，不能相加当总样本。base／final各自总和均应等于rollAttemptCount。

recentEligibleBoundaries最多10条：factionId／当时名称／month／stability／crisisLevel／evidence／base／modifier／computedChance／capped／actual rollResult／successor age months／succession reason／usurpation。recentBoundaryChecks另保留最近10条所有boundary，含blockers和未roll情况，供hard eligibility持续为0时定位。两组均只是观察已计算result、snapshot深复制，new world／Load重置，不入save、不draw。

原debug面板与复制核心／全部诊断会包含更新后的cumulativeGate，未新增UI功能或改历史展示。

## 自动验证

固定context覆盖高／中／低稳定度、minor／captured／one-city／combat／换君链、分档边界、cap与严格roll边界。固定有序分位roll sanity验证严重事实提高chance、结果低频有界且可重复；不是Monte Carlo，不构造真实世界保证事件。

真实Dynasty succession结构测试覆盖stability80时roll0.08成功进入9%chance已有canonical path；无继承人自然NEW_HOUSE、无危机正常继位、旧合法继承人存活、无假父边、epoch/name/color历史与旧palette保持。已有V9校验／round-trip、same-seed续接、debug on/off canonical输出及RNG一致测试保留。

自动测试不是人工视觉／历史语义验收。

## Manual Gate（完成自动验证后停止）

```bash
pnpm desktop:start:debug
```

默认scheduler，新世界4×约800～1500年。不要求blocker／timeout实验，不做CLI/headless长局替代。

回传完整cumulativeGate：

- successionBoundaryCheckCount
- hardEligibleBeforeRollCount
- rollAttemptCount
- rollFailedCount
- usurpationCount
- chanceBuckets（base／final／modifier／capped）
- recentEligibleBoundaries；若hard eligibility为0则另附recentBoundaryChecks与blockerCounts。

自然发生USURPATION时人工确认：

1. 旧合法继承人仍存在，没有伪造死亡。
2. 新旧house无虚假血缘边。
3. 当前王统／历代王统epochs、起止日期与篡朝起始原因正确。
4. 新君显示篡朝／易代，不假称开国。
5. 改国号后当前用新名，篡朝前事件仍用旧名。
6. 易帜后当前地图新色，旧月份历史／Era palette仍旧色。
7. HistoryScroll重大事件及君主关联事件事实正确。
8. Save／Load保持epoch、displaced successor、name/color历史与genealogy；same-seed checkpoint可续接。

1500年未发生但hard eligibility／roll attempts>0、仅rollFailed：机制已经可达，不自动提高chance；回传样本由用户判断频率。若hard eligibility仍0：回传最近boundary evidence，不继续自行调门。不要把测试里forced roll的篡朝称为自然长局验证。

【等待用户人工回传 v0.99927c Dynastic Revolution Calibration Gate；
通过前不得开始 Diplomacy II、纳土归降、
Faction Historiography 或 Era Atlas II。】
