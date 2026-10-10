# v0.99931c · Ruler Political Terminal Integrity / WorldSave V13

## 授权与实际基线

用户明确批准直接升级 V13，放弃全部 V12，不做迁移、只读兼容、转换、克隆或备份工具。此授权取代先前审计的待批准阻断。v0.99931b1 文风人工 PASS，国家史论及史家曰冻结。

实施开始核对本地 HEAD `50b82ec`、干净工作树、APP_VERSION v0.99931b1 / package 0.99.127 / V12。实施过程中已有本地提交 `0407b3e`、`d56fc9e`、`406c3dc`，继续在真实本地状态上完成；Codex 未提交、重置、回退或覆盖用户 Git 操作。目标 APP_VERSION v0.99931c / package 0.99.128 / WorldSave V13。

## 根因及可达路径

旧 markExtinct 不区分政治终结与死亡，把当前君主设置为 dead、endReason=彻底灭亡、chronicle.deathCause=彻底灭亡，然后立即授庙谥号。endYear 实际已同时用于死亡、合邦及纳土退位，不能据其存在推定死亡。

| 真实调用路径 | 是否证明死亡 | 本版处理 |
| --- | --- | --- |
| Core：未正式建国势力最后城市被攻陷 | 否 | 结束政治任期，生死未载 |
| Core：正式国家最后城市被攻陷且无残部，未进入被俘处死分支 | 否 | 结束政治任期，生死未载 |
| City.destroyPermanently：最后首都永久毁坏且没有新首都 | 否 | 结束政治任期，生死未载 |
| WorldExiles：残部、正统性和 claimant 已满足既有终结条件 | 否 | 清理政治资格；不新增死亡。正常路径通常已无当前君主 |
| Dynasty.succeedRuler：自然死亡、战死、被俘处死后无继承者 | 是，死亡已发生 | 保留实际死亡及快照、称号；后续国家终结不得覆盖 |
| 合邦 / 纳土的行政任期终结 | 否 | 保留 abdicated 与合邦退位 / 纳土退位 |

国家失国、流亡、复国、彻底终结条件均未修改。没有人物死亡依据时既不能写 dead，也不能擅自写主动退位。王统断绝不等于整个宗族死亡。

## V13 语义

| 状态 / 字段 | 含义 |
| --- | --- |
| ruling / exiled | 在国或流亡中仍有政治任期 |
| politically-ended | 政治任期结束，生死未载；没有合法继承资格 |
| abdicated | 既有同源合邦 / 纳土退位 |
| dead | 已实际发生死亡，必须有 deathMonth + deathReason |
| endYear / DTO endMonth | 任期截止；未即位候选死亡时保留既有记录截止语义 |
| politicalEndYear / DTO politicalEndMonth | 曾正式即位者的政治任期截止，与 endMonth 一致 |
| deathMonth | 实际死亡的世界月份索引；没有死亡则不填 |
| deathReason | 去世 / 自然去世 / 战死 / 被俘处死之一；不得填彻底灭亡等政治原因 |
| naturalDeathYear / plannedEndYear | 预定寿限，不是已发生死亡的证据 |

实际死亡在政治任期之后时，DTO 可以保留更晚的 deathMonth；本版没有增加退位后的生活模拟。未知生死人物不按当前年月继续增长年龄。

markExtinct 清理当前 office、候选与指定继承人、ruler unit；候选保留 kin 与原有 parentId。已有实际死亡、快照、死亡原因、称号不可覆盖；重复调用幂等。无当前指针但仍有在位/流亡 office 的异常残余也关闭。指向不存在人物的 currentRulerId 显式报错；缺少 chronicle 的记录关闭政治身份但不伪造即位快照，正式 ordinal 缺必要史料时严格校验拒绝保存。

## 下游修复

- 王室：真实死亡月份计算享年，并独立展示实际死亡日期/原因；退位显示退位时年龄；未知显示政治任期终结时年龄、生死未载。
- 个人史评与史家曰：任期可以最终评价，无实际死亡时不使用身后、一生、卒于等死亡判断；仍按本人任期切分在国/流亡月份，不把整个国家历史算给末代君主。
- RulerTenureEvidence.diedInExile 需要实际死亡记录；同月真实死亡后国家终结不抹掉流亡中死亡事实。
- PosthumousRules 先验证实际死亡，评分和授号规则本身不重调；展示历史称号也需要实际死亡记录。
- 最长寿君主只包含可信死亡记录，不把退位或政治终结年龄当寿命。
- 谱系关系及政治终结原事件不重写，不创建新人物或新死亡事件。

## 存档与数据安全

主 DTO 为 WorldSaveV13，RulerSaveV13 明确持久化死亡及政治结束字段。历史源码 API 名称的 alias 仅供既有调用编译，全部生成/接受的 DTO schema 都是 13，不是旧版本兼容。

Exporter 使用明确人物投影，完整保存独立字段；Hydrator 仅恢复已验证字段，不猜测死亡，不做新世界初始化。Canonical diff 本来覆盖整个 dynasty 子树，新字段自然纳入比较。

PRECHECK 验证状态枚举、实际死亡字段、出生/即位/政治结束/死亡月份、chronicle 快照、死后称号、继承资格、人物和事件引用。已终结国家不得保留 ruling/exiled/heir 或 currentRulerId。无效数据在 prepareForHydration 前拒绝，旧世界的年月、teams、units、cities、history 和 RNG 保持。PRECHECK_FAILED 保留诊断记录但不再永久阻止保存；teardown 后失败仍禁止保存半成品世界。

V12 明确拒绝：**此存档为旧版V12，当前V13不支持读取，请新建世界。** 其他旧 schema 也拒绝。没有开发迁移工具；没有自动删除旧文件或数据库；IndexedDB 版本仍 2。

## 实际修改文件

- 生命周期与证据：Politics/Dynasty.ts、RulerLifeState.ts、DynastyInvariant.ts、RulerTenureEvidence.ts、RulerLegacyEvidence.ts、RulerHistoriography.ts、RulerEndReasonSummary.ts。
- 称号与客观记录：Politics/PosthumousRules.ts、HistoricalRulerDisplay.ts；History/HistoryRenderRules.ts、WorldRecords.ts。
- UI：UI/Components/FactionDetails/index.tsx、RoyalPresentation.ts。
- Core.ts：PRECHECK_FAILED 不再永久阻止完整旧世界继续保存；teardown 后的未完成 hydration 仍阻断。
- 保存：Persistence/WorldSaveSchema.ts、RulerSaveProjection.ts、RulerLifeValidation.ts、WorldSaveValidator.ts、WorldSaveExporter.ts、WorldSaveHydrator.ts、WorldSaveRepository.ts（旧 V12 单一明确拒绝提示，不处理旧档）。
- 新测试：Politics/RulerPoliticalTerminalIntegrity.test.ts；原有 WorldSaveReferentialIntegrity.test.ts、RoyalPresentation.test.ts 增加集成/显示断言；既有测试夹具补实际死亡事实、修正旧的“有 currentRulerId 却已 dead”等不合法数据。既有冻结玩法断言未删除或弱化。
- 版本及文档：config/version.ts、package.json、CHANGELOG、ROADMAP、README、本文件。

## 自动验证

最终结果见本节追加的验证记录。Vitest 使用 VITEST_MAX_THREADS=4 / VITEST_MIN_THREADS=1，避免长测试套件无限并发。

新增集成测试使用真实 DynastyRegistry、Core.handleFactionExtinction、City.destroyPermanently、WorldExiles、Exporter、Validator 和 Hydrator；Phaser/UI runtime 依赖以测试 stub 隔离。这证明代码路径与 DTO 语义，不代表真实浏览器视觉或 Electron 运行已经验收。

覆盖自然死亡、战死、被俘处死、流亡自然死亡、候选自然死亡、无残部最终攻城、未建国势力终结、最后首都毁坏、继承耗尽、无当前君主、两种行政退位、重复终结、已有死亡不覆盖、未知年龄冻结、庙谥号死亡门、最长寿排除未知、个人任期、无虚假亲属关系、七国真实君主初始化及 V13 round-trip、V12 / 无效 V13 的 pre-teardown 拒绝。

## 未修改与剩余风险

所有战争、人口、外交、继承顺序、篡朝、分裂、复国、灭亡、合邦与纳土条件/概率不变；没有新 RNG draw。国家史论、时代图鉴、Era Highlights、庙谥评分体系和布局冻结。没有退位后的生活模拟；生死未载不会自动追补死亡，也不能保证宗族成员后来的真实寿命。内部史料损坏不通过猜测修复。

自动验证通过后仍等待用户；P0 的代码修复和真实 UI Gate 分开报告，不提前宣称人工闭环。

## 人工 Chrome / Electron Gate

运行 `pnpm desktop:start:debug`。**先新建七国世界，再保存新的 V13。旧 V12 不用于验收。**

1. 新建七国世界、4×运行。天下势力→王室，查看至少两个当今君主，复制姓名、身份、年龄、在位信息。应有合理的在位君主，不显示已故或政治终结。
2. 如自然出现终结国家：天下势力→终结→该国→王室→历代君主→末代君主，复制姓名/称号、任期、在国/流亡、终结原因、年龄、庙谥号、史评、史家曰及大事记。没有真实死亡应显示生死未载，不凭空显示享年或授谥。没有样本写“本档暂无”，不盲等几百年。
3. 有自然去世、战死或处死样本时，复制历史卷轴原事件及对应君主信息，检查死亡原因和享年一致；无样本注明即可。
4. 保存 V13 前记录当前年月、阵营数、当前君主；读取后核对人物与历史，再运行若干月份。不得重复人物/终结事件或无法继续。
5. 检查政治宗谱、君主史评、国家国评、历史卷轴、时代图鉴、运行和布局是否异常。

可复制填写：

```text
新建七国世界：正常/异常
当前君主A：姓名、年龄、身份、在位信息
当前君主B：姓名、年龄、身份、在位信息
终结国家案例：国家名称及末代君主原文／本档暂无
政治终结与死亡是否分离：正常/异常/暂无人工样本
真实死亡案例：事件原文及君主原文／本档暂无
真实死亡记录：正常/异常/暂无人工样本
新V13保存：正常/异常
新V13读取：正常/异常
读取后继续运行：正常/异常
政治宗谱：正常/异常
君主史评与国家国评：正常/异常
历史卷轴与时代图鉴：正常/异常
最终人工Gate：PASS/未通过
异常原句及具体界面位置：
```

【等待用户人工Chrome/Electron检查，收到用户明确PASS前不得继续下一版本】

不启动王统总评、政治宗谱 UI、初始宗室、篡朝叙事、复国平衡或其他版本。
