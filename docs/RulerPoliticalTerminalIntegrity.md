# v0.99931c · Ruler Political Terminal Integrity — 审计与待批准设计

## 状态与停止点

2026-10-11 检查本地 HEAD `9666449`，工作树干净。APP_VERSION `v0.99931b1`、package `0.99.127`、WorldSave V12。用户已明确回传 v31b1 人工 PASS，国家史论与史家曰文风冻结。

本轮尚未实施修复、更新版本或迁移存档。依据用户请求第五节：如果必须升级 schema、执行不可逆迁移或存在无法解决的兼容风险，先停止编码、提交设计，等待明确批准。

结论：完整修复至少需要新的持久化政治身份，改变当前 RulerStatus 契约，应采用 V13。仅改展示、继续借用 dead/abdicated/kin，均无法完整关闭 P0。本文件是可审阅方案，不是已发布 v31c 的完成报告。

## A. 全部 markExtinct 调用路径

| 调用位置 | 实际前置事实 | 没有死亡证据仍写 dead 的风险 |
| --- | --- | --- |
| Core.ts:533–534，未正式建国势力失去最后城 | 人口已转移/解散，remnants 置零，直接终结 | **直接可达**；没有 resolveCapturedRuler 或自然死亡判定 |
| Core.ts:575–576，正式国家失去最后城 | remnantPopulation=0 时，布尔短路跳过 resolveCapturedRuler | **直接可达**；终结国家不证明当前君主死亡 |
| 同一个 Core 分支，remnantPopulation>0，但无继承资格 | resolveCapturedRuler 写真实被俘处死、succeedRuler 尝试继承 | 若真实当前君主已死且没有继承人，currentRulerId 已清空，随后 markExtinct 不会把另一个人补写死亡。不能把这一真实死亡一并抹掉 |
| City.ts:871–872，最后首都永久毁坏 | 无新首都、无城市 | **直接可达**；城毁没有人物死亡判定 |
| WorldExiles.ts:119–120，流亡终结 | remnants<=0、legitimacy<=0、!hasClaimant | 正常可达流亡终结，但**不能据此声称该路径还持有活着的当前君主**：hasClaimant 把非 dead/abdicated 的当前君主视为 claimant，通常须先在真实死亡/继承耗尽后清空当前 ID |
| Dynasty.ts:475–476，继承耗尽并且无残部 | succeedRuler 已执行真实自然死亡/战死/处死，且 currentRulerId 已置 null | 正常路径不会再把活君主写死；保留真实前任死亡 |

共同根因是 Dynasty.ts:262：有当前君主且有 chronicle 时，非 dead 君主直接写 status=dead、endYear=终结月、endReason=彻底灭亡；随后 finishRulerChronicle 将该政治原因写入 deathCause，生成零国力终结快照，并调用 finalizeRulerPosthumousNames。

补充风险：若有当前君主但缺 chronicle，方法不结束其人物任期，仅清 currentRulerId，会残留 ruling/exiled 人物状态。正常有序君主有 chronicle，缺档案情况需通过 precheck 拒绝或专门处理，不能依赖这一分支来实现未知生死。

幂等性：正常首次结束后 currentRulerId=null，重复调用不会再找到该君主。若输入错误地保留一个 dead currentRulerId，markExtinct 仍会重写 chronicle 终结快照和庙谥号；即使不覆盖 endReason，也会污染原有死亡时国力。修复应明确保护已结束人物记录，不能只依赖当前指针为空。

## B. 时间字段事实表

所有下列 year 字段实际是月索引。

| 字段/消费者 | 当前真实语义 | 问题 |
| --- | --- | --- |
| Ruler.endYear | succeedRuler 的死亡月；markAdministrativeEnd 的合邦/纳土退位月；markExtinct 的国家终结月 | 已是混合的“任期/记录结束月”，不能统一解释为死亡月 |
| politicalEndYear | 行政退位结束月；未即位候选自然死亡时亦写该月 | 字段存在不等于确有政治任期，也不等于死亡 |
| naturalDeathYear/plannedEndYear | 创建人物时生成的预定寿限；ACTIVE/EXILED 月度处理到期时实际执行自然死亡 | 终结后不会继续处理该人物；不能拿预定寿限倒造已经发生的死亡事件 |
| RulerChronicle.endSnapshot | 任期结束时国力 | 应允许在生死未知时完成任期快照 |
| RulerChronicle.deathCause | succeedRuler 写去世/战死/被俘处死；markExtinct 也写彻底灭亡 | 政治原因污染死亡原因，不能将它当独立证据反证同一个错误 |
| RulerHistoriography、RulerChronicle、大事记任期过滤 | 用 endYear 截止任期与关联事件 | 这类使用合理，应保留政治截止 |
| RulerRank/Provisional diagnostics | 用 endYear 统计已完成任期 | 不应统一改成只统计死者 |
| RoyalPresentation / FactionDetails | 年龄取 endYear-birth，dead→享年，abdicated→退位时，其余→当前年龄 | 误标 dead 会凭空给出享年；新状态须显示任期结束时年龄，生死另作说明 |
| WorldRecords.longest-life | endYear 存在就进入最长寿候选，包括 abdicated | 独立的同类死亡推断错误，应仅在可信死亡年龄范围计算，不以政治结束年龄充寿命 |
| PosthumousRules | endYear/accessionYear/chronicle 存在就允许评定，无独立死亡门 | 终结即可授谥；改变死亡门不应改变真实死者的庙谥评分规则 |
| HistoricalRulerDisplay / HistoryRenderRules / notable posthumous list | 有 endYear 和存量庙谥即可展示 | 需要统一死亡证据门，不能只修王室详情一处 |

## C. 影响范围与证据边界

- RulerTenureEvidence.diedInExile 只检验 endYear、dead、循环末的 exiled 布尔值，不检验死亡依据。若同月 faction-extinct 已被处理，exiled 会清零，diedInExile 可能为 false 而 extinctInExile=true；不能把它当作可靠的独立死亡证据。正确做法是在可信死亡月判断当时是否流亡，政治断统另算。
- RulerHistoriography 的 isFinalized 来自 endYear；非 abdicated 的已结束人物使用“身后”“其一生”“终其一生”，voice 仅给 abdicated 替换这些词。生死未载人物不能继承这些措辞。政治评议仍可完成，用“任期结束时”“承统期间”。不修改本轮已冻结的国家史家曰。
- markExtinct 的零快照仍可表达已经无城土的政治终点，但不能据此宣称人物去世，也不能把流亡月份计为在国治理；现有 activeRuleMonths/exileMonths 拆分应保留。
- 王统终结不能推出宗族灭绝。archiveHeirs 已把未即位合法候选转 kin、清继承资格，而非杀死他们；这是合理部分。宗谱 parentId/predecessorId 图边来自档案，未发现此方法凭空造血缘，但人物“已故”、庙谥、年龄标签会受污染。
- 直接使用 kin 来归档末王不合理：kin 表示宗亲成员，UI 还称其在世；abdicated 表示退位，也不能代表被动政治终结。
- 真正自然死亡、战死、被俘处死经 succeedRuler 写明确原因。resolveCapturedRuler 调用 addRulerCaptured，其 description 明记处死，虽然标题仅说“被俘”；不能只从标题猜测生死。
- 无继承人的自然死亡可能只留下 dynasty-line-ended，且该事件没有可靠 rulerId。它的文字说家主去世，是政治/死亡关联线索，但不能仅凭同国同月直接匹配任意人物。
- 没有当前君主的最终灭亡只结束国家/王统，不新建人物或死亡。
- Dynasty.update 已排除 EXTINCT，DynastyInvariant 已禁止终结国家 currentRulerId。修复必须维持这两个约束，明确 hasClaimant 不把新状态当合法继承资格；不改复国、继承及灭亡阈值。

## D. 最小正确模型（待批准）

建议 V13，仅新增必要人物终结语义，不建立新的模拟系统：

1. RulerStatus 加 `politically-ended`：已结束政治任期，未确认死亡，也不声称主动退位。原 ruling/exiled/heir/kin/dead/abdicated 含义保留。
2. endYear/endMonth 继续作为既有任期/档案截止，不做大规模旧 API rename；正式即位者政治结束统一填 politicalEndYear/politicalEndMonth。
3. 独立保存已确认 `deathMonth` 与 `deathReason`，仅真实死亡处理赋值；兼容记录应标注其来源是 legacy-recorded，不能声称有并不存在的 eventId。实际事件 ID 有且匹配时才附证据引用。
4. `naturalDeathYear` 保留预定寿限的原义，不能充实际 deathMonth。新状态未知生死，不再每月追补寿限或创建新的死亡事件。
5. markExtinct 只结束政治任期，冻结 chronicle，不向 deathCause 塞政治原因；不调用授谥。清 currentRulerId、合法继承候选及 ruler unit，保留旧人物、亲属和原历史事件。
6. 真实自然/战场/处死路径保持原规则、时间、随机 draw，只补真实死亡记录。政治结束晚于已记录死亡时不可覆写该死亡或其终结快照；重复终结也不重新授谥或新增事件。
7. 合邦/纳土继续 abdicated 与原 endReason。后续明确死亡记录如果确有来源，也不得覆盖其此前退位时间；当前版本不新增退位后人生模拟。
8. 年龄：可信死亡→享年；合邦/纳土→退位时年龄；未知→任期结束时年龄，另显示生死未载；仍在任→当前年龄。不展示未知人物“当前仍活着”的年龄。
9. 庙谥评定增加可信死亡门；真实死者现有功过/庙谥评分不变。旧不可信称号原值保存在兼容审计资料中，不冒充有效死后称号，也不直接永久删除。
10. 史评与任期快照仍可最终化，death/政治终结用不同证据判断；避免任期未知生死人物承担整个国家跨代的衰亡责任。个人大事记继续用人物 ID、角色和任期范围，不让新状态串入继承或人物生成。

为何不能留 V12：enum 扩充、新死亡字段及消费者解释均改变持久化语义。当前 save.dynasties 使用宽松 Record DTO，validator 未严格枚举所有人物状态，技术上能塞未知值并不构成旧 V12 的安全兼容承诺。旧程序可能将新状态显示为普通君主、当作 claimant，或按 endYear 授谥。

拟发布 APP v0.99931c/package0.99.128；仅在获批后更新。不得无批准自行升级 CURRENT_SAVE_SCHEMA_VERSION。

## E. V12 安全读取与不可恢复的事实

未拿到用户长局存档文件。本审计不能判断燕或其他具体末王究竟属于哪种记录，只能提供可验证规则。不能声称已修复用户存档。

| V12 证据 | 可确认事项 | 禁止推断 |
| --- | --- | --- |
| 同一 rulerId/factionId/月份的 ruler-succession，previousRulerId 匹配，reason=natural/combat/captured | 有明确已发生死亡及原因，可保留真实 dead | 不能拿继任君主 ID 当亡君；不能改真实死亡 |
| ruler-captured 的真实 rulerId、targetFactionId 和月份吻合，现有架构正文确记处死 | 被俘处死，不只是被俘 | 不按词面或 relatedFactionIds 任意归人 |
| endReason=去世/自然去世/战死/被俘处死，chronicle 原因一致，时序无冲突 | 是现有死亡处理的明确档案；若获批，可作为 legacy-recorded 死亡保存 | 不能声称有独立死亡事件或精确史料来源 ID；与终结/人物证据冲突时需停下报告 |
| dead+endReason=彻底灭亡、chronicle.deathCause=彻底灭亡、同月国家 EXTINCT，且无与本人匹配的明确死亡记录 | 与已审计的误标路径一致，可识别“死亡结论无依据” | **只能降为生死未载，不能恢复为确定活着**；也不能倒造死亡/主动退位 |
| 已有 abdicated+合邦退位/纳土退位，终结双方和月份对应 | 政治退位，应完整保留 | renewal/合邦/纳土与人物死亡无关 |
| 只有 dead 或 endYear，原因缺失，事件无人物 ID，或来源互相矛盾 | 资料不足，需要只读警告/拒绝自动转换 | 不能因没找到事件就认定活着，不能用预定寿限或当前世界月自动补死亡 |

原死亡标签、称号和已写入 WorldHistory 一旦带错误，可能已经被后续叙事引用。无可靠证据不能保证恢复真实生理死亡月或既有授谥依据；“不知道”本身必须保留。不能把两个互相复制的字段当两份独立证据。

推荐的兼容流程（同样待批准）：

- V12 原文件/IndexedDB 槽只读，不自动覆盖、不因本轮 schema 单独升 IndexedDB version。
- 提供 V12 只读检查，输出逐人物证据与冲突报告；只读界面不推进世界，不消费随机数，不做 runtime 新世界初始化。
- 用户备份原 V12，明确选择转换后，对 clone 做 V12→V13 PRECHECK；按上述强证据规则转换，有歧义记录不猜，保留只读或拒绝可运行导入并显示诊断。
- 对识别出的误标：保留原字段/庙谥等兼容审计记录，V13有效人物状态改为 politically-ended、实际死亡字段为空，政治截止沿用原终结月。其余原始历史事件不改写，不重授谥。兼容审计数据结构也须作为正式 DTO 验证，不能临时塞 debug 字段。
- 输出到**新 V13 槽/文件**，原 V12 不动。转换成功后才 hydrate；任何未知状态、错误引用、日期冲突在 prepareForHydration 前拒绝，原 live world 保持完整。
- 旧 V12 若要继续可运行，不能在旧语义上仅隐藏“dead”：需明确转换，不能伪称完整修复后的 V12 同格式续玩。

这是可逆的文件操作策略，并不意味着旧史料能无损恢复。保留备份是为了保留原档案，非授权删除旧事实。

## 拟修改文件与校验要求（尚未修改）

| 范围 | 最小职责 |
| --- | --- |
| Dynasty.ts / RulerChronicle.ts | 分开实际死亡与政治结束；保护已结束记录；禁止未知状态继承 |
| RulerTenureEvidence / RulerLegacyEvidence / RulerHistoriography | 在国/流亡和死亡分别判断；任期评议避免身后措辞 |
| PosthumousRules / HistoricalRulerDisplay / HistoryRenderRules / WorldRecords | 可信死亡门；最长寿不是最长政治档案；旧授谥与有效称号分开 |
| RoyalPresentation / FactionDetails | 生死未载、任期结束年龄；保留真实退位、死亡、宗谱边 |
| WorldSave DTO / Exporter / Validator / Hydrator / canonical diff | 正式 V13 字段与关联约束，克隆输入兼容层，PRECHECK完整，round-trip稳定 |
| Core / City / WorldExiles / FactionLifecycle / FactionRegistry | 重点回归现有调用边界；不改国家终结、复国、战争及继承条件 |

precheck 至少检验：状态枚举、月索引整数与上下界、deathReason/deathMonth配对、死亡证据人物/势力/月份一致、政治结束不早于即位、可信 dead 必有实际死亡资料、终结势力没有在位/合法继承指针、未知生死人物不凭空拥有有效授谥、兼容原始记录唯一且可追溯。死亡晚于退位可以合法存在，不能强制所有 deathMonth=endMonth。

无死亡证据的政治结束无需查每月全世界历史。迁移只做一次按人物/势力索引核验，运行时真实死亡处理提供来源；缓存使用现有索引，不新建永久历史数据库。

## 验证计划与当前结果

本轮只运行既有基线测试，未新增或弱化测试，不以现有通过说明缺陷已修复。未实施源码修复，因此本次不声明 build、V13 round-trip 或人工 Gate 已完成。

实际结果：`VITEST_MAX_THREADS=4 VITEST_MIN_THREADS=1 pnpm test -- --run` 通过，191个测试文件、1219项测试，50.74秒。`git diff --check` 与 `git diff --cached --check` 均通过。仅新增本审计文档；APP/package/schema未变。

获批后的回归必须覆盖用户列出的自然死亡、战死、处死、流亡自然死亡、最后城失陷、最后首都毁坏、残部消散、无君主终结、合邦退位、纳土退位；检查状态、实际/政治年月、年龄、个人史评/史家曰、授谥门与宗谱。

额外覆盖：真实死亡重复终结不覆盖；无 chronicle 的 malformed record PRECHECK拒绝；新状态不成为 claimant或创建君主；无新增历史人物/终结事件/RNG；旧档强证据与歧义分开；原槽不覆盖；导出→校验→hydrate→导出canonical一致。现有战争、继承、复国、政治终结、国家国评和时代精选全部回归。

实施获批后再执行 pnpm test、pnpm build、desktop:build、desktop:compile、desktop:renderer-debug-build、git diff --check、git diff --cached --check。仓库没有 pnpm desktop 通用脚本，用这三个真实 desktop 脚本。

## 获批并实施后的人工 Gate（现在不要求用户试玩未修复版本）

届时使用 `pnpm desktop:start:debug`；如选择 V13方案，先按获批的备份/转换流程处理现有长局，不默认升级或要求重新长跑。

A. 燕末王：天下势力→终结→燕→王室→历代君主→末代君主，复制姓名/称号、在位/在国/流亡时间、终结原因、年龄、庙谥、史评、史家曰、大事记。王统终结不能冒充死亡或授谥；47年1个月是国家经历，不能未经人物任期核实直接给末王。

B. 魏/郑：复制末王身份、终结原因、年龄和史评，检查相同问题。

C. 元：合邦末王仍退位，不写死亡、战败或流亡。

D. 真实战死/被俘处死：复制原事件及人物详情，确认真实死亡未被抹掉。无样本直接注明。

E. 燕/元国家国评不变；新槽 Save→Load 人物、结束原因、有效庙谥及史评一致；历史卷轴、图鉴、宗谱、运行布局正常。旧 V12 原槽仍保留。

```text
燕末王原文：（姓名/称号、年月、原因、年龄、庙谥、史评、史家曰、大事记）
生死/授谥语义：正常/异常
在国与流亡时长及归责：正常/异常
魏或郑末王原文：（身份、原因、年龄、史评）
元末王原文：（身份、原因、年龄）
合邦退位语义：正常/异常
真实死亡原事件及人物原文：（或本档无样本）
真实死亡保持：正常/异常/无样本
国家国评：正常/异常
新槽Save/Load：正常/异常
旧V12原槽保留：正常/异常
历史卷轴/图鉴/宗谱/运行布局：正常/异常
最终人工Gate：PASS / 未通过
```

## 需要明确批准的选择

建议批准：V13新人物政治终结状态与实际死亡字段，并允许V12原档只读、备份后按可验证证据克隆转换为新V13槽；证据冲突/不足不猜，不覆盖原档案。

也可选择暂不升级：保留本审计及P0，停止实施。不能以只改“享年”标签宣称完整修复。

收到设计批准后才开始源码和自动验证；自动验证后仍须独立人工Gate。本轮P0未关闭。
