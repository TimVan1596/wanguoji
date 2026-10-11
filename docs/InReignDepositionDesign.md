# 在位废立与真实宗室夺位：阶段 A 设计

> 状态：设计提案，等待用户明确批准。本文没有实现任何玩法、存档或版本改动。

## 1. 审计结论与真实代码约束

### 1.1 人物状态、死亡与任期

`src/Politics/Dynasty.ts` 当前 `RulerStatus` 为 `ruling | exiled | heir | kin | dead | abdicated | politically-ended`。`Ruler` 同时保存预定自然寿命 `naturalDeathYear`、真实死亡 `deathMonth/deathReason`、任期 `accessionYear/endYear`、政治任期 `politicalStartYear/politicalEndYear`、关系 ID、在位序号、史册及身后称号。

`Dynasty.succeedRuler()` 是死亡继位流程，不适合废立：它会把前君标为 `dead`，填写死亡年月与原因，结算身后称号，归档候选人，并添加正常继位／易姓历史。不能通过调用后再删死亡字段来模拟废位。

`RulerLifeValidation.ts` 与 `RulerLifeState.ts` 明确区分任期结束和死亡：真实死亡字段只能与 `dead` 同存；`abdicated` 只接受“合邦退位”或“纳土退位”；`politically-ended` 只接受“政治终结”；有庙号或谥号必须有真实死亡。`endMonth` 与 `politicalEndMonth` 对已登基君主必须一致。新增废位语义应是明确的新状态及终止原因，而不是重用前三者。

`Dynasty.update()` 当前只给在位君主检查自然寿命，并给未登基的 `heir/kin` 归档自然死亡。`archiveNaturallyDeadHeirs()` 还要求 `reignOrdinal` 未定义。故被废的前君保留其在位序号后，不能经过普通宗室死亡归档路径；需显式覆盖已登基但离任者。

`ensureActiveHeir()` 会从已有记录的宗亲里选候选，并在合适情形补建宗亲。废立夺位人必须在评估开始前就存在；废立评估不得调用补建逻辑来产生候选。现行候选规则 `getRecordedKinRelation()` 与 `selectActiveDynasticCandidateIds()` 只承认有父系记录的近亲关系，排除没有明确关系证据的旁支，也要求与当前君主同一 `houseName`。这适合作为首版身份来源边界。

### 1.2 政治连续性与运行时单位

`Dynasty` 的 `currentRulerId` 是现任的权威指针；`houseEpochs` 记录王统阶段，当前阶段应只因真实异姓篡朝／复国等既有转换而改变。同王统宗室废立不应新建 epoch。`heirIds/designatedHeirId` 是活跃继位候选集合，成功废立后必须重建或重新校验，不能让被废者留在候选里。

君主在地图上的活动身份是 `Team.rulerUser` 及其 `User` / `Player` 的 `RULER` 角色和 `rulerId`。`Team.removeRulerUnit(true)` 可静默移除单位而不制造战死；它只应在 `currentRulerId` 与地图君主同步的原子转换中调用。被废君主继续作为历史人物保存在 `dynasty.rulers`，不再以在位君主单位活动。

`Ruler.chronicle.endSnapshot` 必须与 `endYear` 同月。被废者应保留原始 `accessionYear`、任期起点、在位序号和完整 chronicle；于废立月设置任期结束及终止快照。未来真实死亡另写 `deathMonth/deathReason`，不得改写任期终止月份或删除被废身份。

### 1.3 事件、月份循环与存档

`WorldHistory` 当前有 `ruler-died`、`ruler-acceded`、`ruler-succession`、`dynasty-usurped` 等事件，没有表达活人废位的 canonical 类型。用死亡继位或异姓篡朝事件代替都会混淆事实。应新增单一 `ruler-deposed`（或批准后采用的等价名称）事件，携带 faction、月份、旧君 ID、新君 ID、危机证据事件 ID、王统／国号是否变化等事实。首版仅允许同王统废立，事件应明确记为王统未更换、国号未更换。

`AutoSimulator.advance()` 每个世界月先更新 `WorldEventSystem`、外交和周期性国家转换，再更新人口、城市防御，后调用 `DynastyRegistry.update()`，随后更新流亡、历史快照。现有继位都由 Dynasty 月度更新承担。废立评估应放在 dynasty 每月生命周期中，但只有指定的年界检查点才运行，且在当月自然死亡和 combat/captured 继位处理之后，避免同月已死君主再被废。危机证据只能取评估月及此前的事件窗口。

当前 `CURRENT_SAVE_SCHEMA_VERSION` 是 13；`RulerSaveV13` 投影采用 `endMonth` 与 `deathMonth` 分列；Validator 只接受当前版本并严格验证 ruler status；Hydrator 在预检通过后恢复 Dynasty 与 WorldHistory，且检查 canonical 事件数不变。当前保存链并未提供自动把任意旧版本另存为当前版本的宽泛迁移器。新增废位状态和冷却状态必须在 DTO、validator、export/import、hydrate 与 repository 的版本路由中共同实现。

## 2. 推荐的最小机制

首版只评估：正式国家阶段、国家仍有城市且处于 ACTIVE、现任君主仍生存、同一 `houseName` 下存在真实且有资格的已记录宗室、并有经历史事件和当前国家状态共同支持的政治危机。临时义军、流亡无土政权、已终结国家不参与。

废立是“在位君主被现存宗室替代”，不代表新王统，也不代表旧君死亡。首版不推断军队拥立、密谋、朝会或具体个人动机；危机事实只用作政治背景。废立者本人必须有稳定 ID、姓名、生月、有效近亲证据、同 faction 的 Dynasty 所属关系、当前存活状态和在位资格。年龄应按代码既有月龄规则设成年门槛；初版建议 16 岁以上，并沿用系统现有上限和死亡检查，不另造独立寿命制度。候选最多检查 2 人，先按 `getRecordedKinRelation()` 的亲近优先序和既有 designated/candidate 优先级排序；同级冲突使用一次有界 `WorldRandom` 选取。

政治暴露至少需要两类证据同时成立：

1. **当前脆弱性**：低稳定度（建议起始门槛 `≤40`）或近期显著失城／只剩少量城市（建议 `≤2` 城）。阈值是待数据校准的保守初值，不是结论。
2. **真实近期冲击**：例如近 36 个月本国真实失都、重大帝国分裂、或多次真实内乱／城市失守；证据必须由事件 faction 角色和事件 ID 核实，不从当前国情反推历史动机。继位频繁可作为加权证据，但不能单独触发。

同一事件 ID 只能贡献一次；同一围城造成的失都与失城不构成两份独立冲击。所有证据需为本 faction、月份不晚于评估月份，近期窗口先取 36 个月。具体哪些事件可计入，阶段 B 需依照 `WorldHistory` 生产事件构造写白名单适配器和归属测试。

## 3. 评估周期、冷却、候选和风险

- **周期**：每 12 个世界月的年界检查一次；不是每年无条件抽签。先做资格筛选，只有全项通过才调用 RNG。
- **冷却**：一次符合资格的废立风险抽签后，60 个月内不再评估该 faction。为保证存档读写和继续运行一致，最近一次抽签月份属于权威状态，建议保存在 Dynasty 的 `lastDepositionAttemptMonth`。冷却从失败或成功抽签月起算；资格不成立时不启动冷却。
- **候选上限**：最多 2 名事前已存在、存活、年满 16 岁、无既往任期、关系可证明且 house 相同的宗室。找不到候选时零抽签。
- **风险区间**：先以 0.5%～1.5% 单次年界风险作实验起点，绝对上限 2%。风险随独立冲击证据类别增加而分级，但不得因同一事实重复叠加；一次评估最多一抽。首轮长跑用于检验资格可达性、尝试次数、成功数和自然死亡／内乱边界，不以目标政变数量反推提高概率。若风险设计需要本次概率层级，建议采用基础 0.5%、第二独立冲击类别 +0.5%、高强度复合证据再 +0.5%，封顶 1.5%；2% 仅在实测后经单独批准使用。
- **失败**：只有抽签失败与冷却时间是模拟事实；没有经证实的现实事件时，不记失败政变、密谋者受罚或历史事件，不改变候选人、稳定度、人物生命和继承安排。诊断可统计失败次数，但不得消耗额外 RNG。
- **成功**：只替换现任君主，维持 factionId、当前国号、颜色及 house epoch；不得触发 `dynasty-usurped`、易姓、易帜或“自然继位”措辞。

上述阈值和概率只是谨慎首轮实验参数。仓库现有篡朝资格观测可作背景，但没有在位废立历史样本，不能从旧篡朝数据直接证明本机制的自然频率合理。阶段 B 必须报告完整模拟是否包含真实战争、围城、城市丢失、内乱与分裂子系统；若测试关闭这些系统，则不能声称验证了自然可达性。

## 4. 政治状态转换与提交顺序

```text
每月正常世界事件 / 城市与国家更新
  → 处理现任君主真实自然死亡、战死或被俘处死
  → 若仍有在位君主且到年界：检查冷却、当前脆弱性、历史冲击、候选
  → 不合格：不抽 RNG；合格：只抽一次并写入抽签月份
       ├─ 失败：仅冷却；无 canonical 政变事件
       └─ 成功：预检转换计划 → 原子提交下述所有权变更 → 校验不变量 → 追加唯一 ruler-deposed 事件
  → 正常刷新继承候选、单位、历史快照和存档状态
```

成功转换建议由独立 `deposeRuler` / `commitDeposition` 执行，不调用 `succeedRuler()`：

1. **准备计划，不写历史**：重新验证 `currentRulerId`、旧君为本国 ACTIVE 的 ruling 且没有真实死亡字段；新君 ID 已存在、存活、同王统、关系合格、此前未登基；faction 仍 ACTIVE 且有城市；证据事件均早于等于当前月。捕获待变更对象的快照。
2. **冻结前任任期**：旧君 `status=deposed`；`endYear=politicalEndYear=worldMonth`，`endReason="被废"`；写入 chronicle `endSnapshot`。不得设置 `deathMonth/deathReason`、死亡原因、身后称号或死亡事件。保留 `naturalDeathYear` 和人物关系。
3. **开始新任期**：新君从 `heir/kin` 转成 `ruling`，设置新的 accession/political start、唯一 reign ordinal、`predecessorId=旧君ID` 与真实 relationType；初始化 chronicle 的 accession/latest snapshot。relationType 应表达同宗承位，可使用已有关系值而新增 accession-cause 字段（例如 `accessionCause: "DEPOSITION"`），防止史册把普通承继误写成自然继位。
4. **更新权威指针与候选**：设置 `currentRulerId=新君ID`；从 `heirIds/designatedHeirId` 清除新君并重选其他可继候选；禁止旧君重新进入候选池。`houseName/houseEpochs` 不变。
5. **重绑地图统治身份**：静默移除旧 `rulerUser`（不调用战斗死亡）；创建/绑定新 RULER User/Player，使其 `rulerId` 指向新君。若单位更新或 invariant 失败，恢复步骤 2–5 的内存快照并保持旧地图身份；canonical 事件尚未写入。
6. **提交唯一历史事实**：验证 `currentRulerId`、状态、任期快照、候选和单位身份一致后，追加一个 `ruler-deposed` 事件，含 factionId、month、旧/新 rulerId、双方真实姓名、relationType、证据 event ID、`houseChanged=false`、`nameChanged=false`。人物纪事通过该事件 ID 归属双方各自角色，展示层针对同一 event ID 去重，不再另外发一条普通继位事件。
7. **后续正常月度生命周期**：阶段 B 完成存档往返与 invariant 后，再允许世界继续运行。

若提交阶段无法完成，应回滚人物、Dynasty、单位和当前指针，不写成功事件；随机抽签已发生这一事实可以保留，冷却仍有效。历史事件最后追加，保证不会出现“事件已写而当前君主未换”的状态。需验证队伍单位重建是同步且可回滚；如 runtime API 不能安全回滚，需先将全部可能失败检查移到副作用前。

## 5. 被废君主的后续生死与史册

废位结束的是任期，不是生命。`deposed` 人物保留在 Dynasty 和宗谱，保留身份、亲属关系、年龄及自然寿命计划；无 `deathMonth/deathReason` 时必须继续显示为生存，不获庙号、谥号或史称。

`Dynasty.update()` 需增设有界扫描：只检查曾有 `reignOrdinal`、`status="deposed"`、无死亡事实且预定自然死亡月已到的记录。到期时按实际自然死亡流程写真实死亡月份与 `自然去世` 原因、置为 `dead`、追加 `ruler-died`；不更改原任期结束月及废立事件，不把此人作为候选。不能用普通 `kin` 死亡归档，因为后者会混淆登基史。

该扫描按 Dynasty 中有限的正式在位记录遍历，每月 O(已记录君主数)，长局规模应在性能测试中量测；不得每帧跑，也不得全历史事件反复扫描。死亡月份与废位同月时，月度顺序先处理原在位者自然死亡，再评估废立；同月自然死亡使其不能成为被废目标。废位完成后，后续月份才能检查其自然死亡。真实死亡后保留 `endReason="被废"` 与独立 death 字段，posthumous 规则只在真实死亡记录产生后工作。

## 6. WorldSave 兼容性结论：推荐 V14

### 方案比较

| 方案 | 语义结果 | 结论 |
|---|---|---|
| V13 原样 | V13 status 枚举、LifeValidation、保存 DTO 与旧读取器均不认识 `deposed`；把它塞入 `abdicated` 或 `politically-ended` 会违反现有语义。仅写任期字段也无法证明废位原因或保留可校验的自然死亡状态。 | 不接受 |
| 沿用 V13 并放宽字符串 | 类型较宽松不等于语义契约允许；会让旧校验器拒绝或误解释数据，也无法区分 voluntary abdication、political terminal 与 deposition。 | 不接受 |
| 新增 V14 | 明确新增 `deposed` 状态、废位原因/继任原因、冷却月份以及 `ruler-deposed` 事件校验；可把 V13 输入安全规范化后在显式新保存时导出 V14。 | **推荐** |

V14 的最小新增权威数据建议：

- ruler status 新值 `deposed`，且要求有真实 accession、reign ordinal、endMonth、politicalEndMonth、endReason=`被废`、与 endMonth 同月的 chronicle endSnapshot；禁止 death 字段和 posthumous title，直到真实死亡流程发生。
- ruler 的 `accessionCause="DEPOSITION"`（或等价的明确来源字段），验证它必须对应唯一 `ruler-deposed` 事件中的 newRulerId；事件必须对应旧君终止任期。
- dynasty 的可选 `lastDepositionAttemptMonth`，只在实际抽签时更新，验证为不晚于世界当前月的安全整数。是否存于 Dynasty 或独立 politics state，可在阶段 B 代码设计时确定，但必须是 authoritative 且可往返的数据。
- `ruler-deposed` canonical event 必须验证同一 faction、唯一旧/新君、日期和身份引用；不得同时出现伪造的 ruler-death 或 house-epoch 改朝事实。

V14 应继续读取原始 V13。读取期间不回写原文件，也不补造废立状态、死亡、冷却历史或事件；V13 的 canonical 人物/王统/事件导入后原样保留。用户明确执行新的保存时，导出的当前格式成为 V14；同一 V13 world 经导入后无新增事件时，语义字段和 canonical history 应可对账，不能把 V13 源文件静默覆盖。实现时应明确存档 slot 的格式升级提示/记录和恢复备份行为，避免用户误以为原始 V13 文件被改写。

这不是阶段 A 授权升级存档的许可。阶段 B 必须先单独设计批准 V14 DTO、旧 V13 读取路径、V14 strict validator、export/import 版本路由、canonical round-trip 及旧档继续运行测试；若无法保证 V13 读取且 V14 写入路径清楚，应停止实现并提交新设计 Gate。

## 7. 预计阶段 B 涉及文件

- **政治身份与规则**：`src/Politics/Dynasty.ts`、`DynastyInvariant.ts`、`DynasticCandidateRules.ts`、`SuccessionRules.ts`（只复用可验证规则，不改普通继承）、可能新增独立 `InReignDeposition.ts` 与纯函数测试。
- **危机证据**：`WorldHistory.ts` 事件归属适配、城市/分裂/内乱生产事件构造、事件窗口查询；新增资格函数与反例测试。不能直接从 UI diagnostics 反向生成事实。
- **地图身份**：`Team.removeRulerUnit()`、`Team.makeUser()`、`User`/`Player`/logical unit registry 和相关 invariant；确认移除旧君不触发 `handleRulerCombatDeath`。
- **事件与展示**：`WorldHistory.ts` 事件类型、添加方法、event metadata 校验；HistoryScroll、FactionDetails、RoyalPresentation、政治宗谱、RulerChronicle/个人纪事及历史筛选格式化。事件关系应按旧君/新君角色呈现，不能伪装成死亡继位或异姓篡朝。
- **保存与恢复**：`WorldSaveSchema.ts`、`RulerLifeValidation.ts`、`WorldSaveValidator.ts`、`RulerSaveProjection.ts`、`WorldSaveExporter.ts`、`WorldSaveHydrator.ts`、repository/workflow/version routing、canonical diff；增加 V13→runtime→V14 导出及 V14 round-trip 测试。
- **月份顺序和 diagnostics**：`AutoSimulator.ts` / `DynastyRegistry.update()` 调用时机、世界诊断展示（若阶段 B 最小闭环要求可观察）；诊断仅汇总、不消耗 RNG。
- **回归测试**：`Dynasty.test.ts`、`DynastyInvariant.test.ts`、`DynasticCandidateRules.test.ts`、`RulerPoliticalTerminalIntegrity.test.ts`、WorldHistory、保存验证/恢复/工作流、FactionDetails/HistoryScroll 与真实月份集成测试。

## 8. 对既有功能的影响边界

应保持：正常死亡继位、战死/被俘处死继位、`dynasty-usurped` 的异姓篡朝、纳土/合邦退位、流亡与复国、国号/颜色历史、庙谥授予算法及 V13 旧事实。不得改变战争、城市、人口、外交、自然寿命、继承优先级或篡朝概率。

新增风险主要在：旧 ruler unit 移除是否触发人物死亡副作用；前君是否被错误纳入继承候选；新君是否出现重复 RULER 单位；同月死亡和废立先后；任期结束快照与后续死亡月字段冲突；事件一次提交但政治指针未同步；V13 slot 的读取、V14 保存及版本显示不一致；历史摘要将同宗废位写作易姓。上述都应在阶段 B 建立明确 invariant 和集成测试。

## 9. 阶段 B 验证范围（仅供批准后执行）

按用户合同覆盖：活君废位与未死亡；事前存在的真实宗亲、关系与资格；非宗亲拒绝；同姓不改 house/name/color；失败无成功事件；同一月最多一次、60 月冷却；普通继位/异姓篡朝/合邦/纳土不回归；后续真实自然死亡和身后称号时序；world history、人物纪事、宗谱、王室、地图 ruler 单位一致；真实 WorldHistory→Dynasty→事件→V13 load/V14 save 的集成路径；同月死亡顺序；确定性及 RNG diagnostics；V13 读取、V14 strict validate/restore/re-export canonical round-trip。

还需多 seed 长跑验证自然资格次数和尝试数。若运行器关闭战争、围城、城市或分裂，就必须明确限制；不使用自动浏览器或截图代替人工 Chrome/Electron Gate。代码、测试和 build 完成后按用户要求停止，等待人工 PASS。

## 10. 用户需要批准的事项

1. 是否采用独立 `deposed` 状态与 `endReason="被废"`，并维持真实死亡字段完全独立？
2. 是否批准同王统、同 faction、且事前已存在的最多 2 名真实宗室作为首版夺位人，并排除异姓权臣/将领/临时生成者？
3. 是否接受年界资格评估、60 月抽签冷却、两类危机证据门槛，以及 0.5%～1.5% 的首轮风险实验范围？
4. 是否批准明确升级 WorldSave V14，同时继续只读兼容原 V13、显式新保存才输出 V14？
5. 是否批准上述范围进入阶段 B；批准不包含将领、权臣、摄政、外戚、联盟拥立或全面战争政治模拟？

## 推荐结论

**推荐实现方案：** 使用独立 `deposed` 生命周期状态表达强制废位；保留旧君真实存活与原任期史；只允许事前已存在、关系可信、同一王统的合格宗室成为新君；按年界检查真实危机和现状，合格后单次抽签并冷却；通过同步事务式状态转换完成旧君结任、新君即位、地图单位重绑及唯一 canonical 事件；以后由正式在位人物生命周期扫描记录旧君真实自然死亡。

**是否需要 V14：** 需要。V13 不包含被废状态、被废而生存的严格生命周期、抽签冷却及新事件语义；放宽现有字段会破坏 V13 契约。V14 继续读取 V13，迁移只在显式保存为新格式时发生。

**需要用户批准的范围：** 请确认上方 1–5 项，尤其是 V14 和阶段 B 的最小玩法范围。当前仍处于阶段 A，尚未实现废立。
