# v0.99931c1 · Ruler Tenure & Historical Role Integrity

## 基线及范围

开始时真实 HEAD `50e4ef1`，工作树干净，APP_VERSION v0.99931c / package 0.99.128 / WorldSave V13。恢复工作时用户已提交初步修正至 `f8e74b5`，继续保留其提交和 staging；Codex 不提交、不重置、不改动用户暂存操作。

用户明确确认 v31c 人工 PASS，V13 人物生死模型冻结。本轮目标 v0.99931c1 / package 0.99.129，V13 不变；只修改由现有任期、人物和历史事件派生的个人角色与评论。

## 根因与一致定义

| 项目 | 原判定/措辞 | 本轮修正 |
| --- | --- | --- |
| SHORT_REIGN | 在国治理 activeRuleMonths ≤ 60 | 承统总时长 totalTenureMonths ≤ 60，包含实际流亡承统；恰好五年用“不超过五年” |
| LONG_EXILE | 流亡≥60个月且超过在国月份 | 判定不变；全程流亡仅在 activeRuleMonths = 0 时表述，无在国治绩推论 |
| LAST_RULER | diedInExile、extinctInExile 或笼统 endReason 足以成立 | 独立国家最终覆灭时的最终任期持有者：匹配本国 faction-extinct 与任期结束月，或人物自身 politically-ended/政治终结事实；排除后继正式君主和行政退位 |
| 长期流亡评论 | 无条件称“王统未绝是其身后最重要的遗留” | 不从流亡死亡推断后继是否存在；有明确终结事实时说明王统终结，且不将失国或全史责任归给末代继统者 |
| 年轻战死者 | finalAge≤25也能进入短祚评论 | 只有真正 SHORT_REIGN 可使用短祚评论；年轻不等于短期承统 |

LAST_RULER 的消费者只在 RulerHistoriography 的角色/人物评论中；RulerChronicle 标签直接消费 SHORT_REIGN，流亡标签消费 EXILED_RULER。这里的 LAST_RULER 不是每个 house epoch 的末君，也不是“曾失国”的所有君主。合邦和纳土的末代行政退位仍由原政治终结纪事表达，不套用覆灭/亡国评论。actual diedInExile 继续是可信死亡与当时流亡状态的交集，不能等同于国家终结。

PosthumousRules 使用的是独立 RulerLegacyEvidence，不使用这里的 LAST_RULER。庙谥评分、授予条件及所有模拟消费者未修改；本轮只纠正人物标签和相关评论，避免借角色修复调整评分。

## 用户案例的预期

- 宋景怀：453个月承统，0个月在国，453个月流亡。LONG_EXILE 保留，无 SHORT_REIGN；全程流亡文字明确。若原档存在同月本国终结事件并且没有后继正式君主，LAST_RULER 成立，评论不再宣称死后王统继续。
- 宋恺：62个月承统，22个月在国，40个月流亡。无 SHORT_REIGN；流亡经历保留，但不符合 LONG_EXILE 的60个月门槛。
- 宋武：313个月正常在国任期不属于短祚；真实死亡、享年、庙谥和人物关系仍由冻结的 V13 事实决定。

没有读到用户私有长局文件，不声称已核对其具体事件 metadata。以上以人工提供的事实为预期，自动测试使用独立合成证据。

## 修改文件与自动验证

- RulerHistoriography.ts：派生角色、全程流亡及终结评论、短祚措辞。
- RulerHistoriography.test.ts：原危局终结测试补真实本国终结事件，保留原责任区分断言，不再依赖不合法的旧死亡原因。
- RulerTenureHistoricalRoleIntegrity.test.ts：承统/在国/流亡、五年边界、合法后继、同月继承边界、未知生死、合邦/纳土、复国、多次流亡、年轻战死、JSON DTO 一致性和 RNG。
- WorldSaveReferentialIntegrity.test.ts：在实际 export/validate/hydrate 路径核对派生标签及全部个人评论，并核对宗谱、lifetime、history 与 RNG 不变。
- version、package、CHANGELOG、ROADMAP、前置 Gate 文档与本开发文档。

未新增 canonical 字段；不改变 schema、IndexedDB、死亡或任期计算、国家国评、时代、战争、外交、人口、继承、篡朝、复国、归并、纳土、随机数消费。测试允许 mock Phaser 资源构建，但使用真实 DTO、Validator、Hydrator、Exporter 与派生函数，不冒充浏览器验收。

自动验证结果在完成后补录。本机 Vitest 0.34.6 用 VITEST_MAX_THREADS=4 / VITEST_MIN_THREADS=1 限制并发，使用真实 desktop:build / desktop:compile / desktop:renderer-debug-build 脚本。

## 人工检查：直接读取现有 V13 长局

运行 `pnpm desktop:start:debug`。无需新世界，无需再模拟数百年。

1. 【天下势力→终结→沂→王室→历代君主→宋景怀】：复制承统/在国/流亡时长、全部人物标签、完整史评和史家曰。确认37年9个月不再“短祚”，长期流亡身份保留，不说其死后王统继续，不归责沂国全部衰亡。
2. 同路径查看宋恺：复制承统总时长、在国/流亡、人物标签、史评和史家曰。5年2个月承统不能因只在国1年10个月而称短祚。
3. 同路径查看宋武：复制26年1个月任期、真实死亡原因、享年、标签和史评，检查正常在国君主没有回归。
4. 保存→读取V13→继续若干月份，检查宗谱、历史卷轴、国家国评、时代图鉴及人物史评布局。

可直接填写：

```text
宋景怀：
承统/在国/流亡：
全部人物标签：
史评全文：
史家曰全文：
短祚及末代表述：正常/异常（异常请复制原句）

宋恺：
承统/在国/流亡：
全部人物标签：
史评全文：
史家曰全文：
短祚表述：正常/异常

宋武：
任期、死亡原因、享年：
标签与史评原文：
正常在国判断：正常/异常

V13保存、读取、继续运行：正常/异常
政治宗谱：正常/异常
历史卷轴、国家国评、时代图鉴：正常/异常
人物史评布局：正常/异常
最终人工Gate：PASS/未通过
```

遗留限制：没有可核验的本国终结事实时，不猜测其末代身份；不从实际死亡或后世国史推断个人责任。史评自然程度和真实布局仍须人工确认，不以 CLI、截图或 headless 自动验收替代。

【等待用户人工 Chrome/Electron 检查，收到用户明确 PASS 前不得继续下一版本】
