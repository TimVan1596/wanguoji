# v0.99930 Faction Historiography

基线：dc1be4f / v0.99929a / package 0.99.117 / WorldSave V11。用户已确认 Political Terminal Chronicle 全部人工 PASS，Peaceful Submission 正式冻结。

本版：APP_VERSION v0.99930，package 0.99.118，WorldSave V12。V11及更旧直接拒绝，不迁移；IndexedDB version 仍为2。

## 终身史料与精度

FactionSnapshots 每12个月采样、最多500条，不能用于还原终身最高值。本版新增小型 FactionLifetimeRecord，每个 faction 一条，不复制 rulers、dynasties、身份历史或完整 WorldHistory。

| 永久字段 | 单位与来源 | 观测月份 |
| --- | --- | --- |
| peakPopulation | 人；Team.users.size | 独立月份，MONTHLY 或 PRE_TERMINAL |
| peakTerritoryBlocks | 格；ACTIVE Team.blocks.children.size，复用 TerritoryMetrics 的 cardinality 口径，非在国为0 | 独立月份，MONTHLY 或 PRE_TERMINAL |
| peakCityCount | 座；Team.cities.length | 独立月份，MONTHLY 或 PRE_TERMINAL |
| terminal | 真正终结前的人口、受控格数、城市数 | 真正政治终结月份 |

相等峰值保留最早实测月份。初始国家在初始化人口后观测，新势力在接受注册及创建完成时观测；常规更新在 authoritative monthly step。三种峰值可能有三个不同月份，分别展示。

世界总格数固定保存在 store 根状态中。最大疆域占世界比例 = peakTerritoryBlocks / totalWorldBlocks，内部是0..1的 fraction，UI乘100显示百分数。TerritoryMetrics.absoluteWorldShare 则是0..100百分数；FactionSnapshots.absoluteTerritoryShare是0..1。不得与 controlledTerritoryShare（已控制疆域为分母）混用。

UI明确标注“月度记录及终结前实测”，不声称捕获观测间瞬时极值。数值和月份由实际对象读取，不能从事件文本推算峰值。source随峰值持久化，单位由对应字段定义。

## 终结与事实证据

MERGED / SUBMITTED：行政转移前准备末次观测，Team政治终结之后冻结；重复准备同一边界不会用转移后的零值覆盖。EXTINCT：真正terminal时捕获与冻结。EXILED不封存，可以复国，峰值继续保留。接受国自己的记录仍从自己的月度事实更新。

时长分别读取现有创建、正式建国、终结和累计在国月份；国祚历时包含其中的流亡历时，累计在国排除真正流亡，但包含正式建国前的势力在国阶段，UI明确注明。

君主来自实际accession记录，heir/kin无即位记录不算君主。正式君主统计包含建国前即位、建国时仍在位的首领。多姓王统按已有house epochs计段和不同姓数，篡朝读取USURPATION起因；不会因国号变化拆分faction。称帝、流亡和复国来自已有身份/生命周期档案；称霸从该势力的历史索引读取本人actor的world-hegemony事件。

EXTINCT、MERGED、SUBMITTED分别叙述，不把退位写成死亡，不将合邦写成征服。只有原始终结事件明确记录残部消散时，才使用这一原因；不把最后攻城者自动当作最后绝统者。终结对象按终结月份解析历史国号。

## 纯展示分类与文案

分类返回key、证据字段和触发原因；不进行随机评分。这些是展示阈值，不影响玩法：短命≤5年，长期≥100年，长期流亡为已有流亡证据且累计非在国≥10年；显著退潮为记录疆域峰值≥3格且终结前不超过峰值四分之一。其余类型来自实际称帝/霸权、多姓王统、篡朝、复国≥2次、终局一城和canonical终结方式。

国评选择复国曲折、王统更替、帝制/霸权、长期延续等最主要事实；史家曰优先多次复国、多姓、长期帝国、长期流亡、短命临时势力、长期月录一城、霸权、显著退潮等不同分支，再结合独立终结方式。分支内用stable hash(factionId + profileKey)选择等义文案，不使用WorldRandom或Math.random，不引入LLM API。

仍ACTIVE或EXILED时不显示终局国评。PROVISIONAL终结显示“势力结语/势力回顾”，无正式国祚或虚构帝数。

## UI与性能

势力→王室顶部是默认折叠的国评，全文有固定数量段落；不会因数百位君主新增数百个评价DOM节点。每个冻结record只计算缓存一次，首次只查询该势力WorldHistory索引；hydrate/new world创建新的record对象，自然重建派生缓存。未加载王朝档案时不缓存不完整评价。

History终结事件展开时增加简短回顾，复用同一国评，不写入新历史事件。原有增量publish、20k事件分页和unseen机制不重构。

## Persistence

V12 DTO使用严格类型factionLifetime。Exporter直接输出永久观测；Hydrator直接恢复记录，不用滚动快照重新计算峰值。precheck验证记录数组、唯一且完整的factionId引用、世界总格数、非负安全整数峰值、整数月份与观测来源、终结日期和冻结状态。terminal之后的月份/峰值更新不被接受。canonical diff有独立factionLifetime子系统。失败precheck不teardown当前世界。

## 自动验证

新增覆盖初始/新势力、创建和复国不重置、60000个月/5000年窗口覆盖、同值最早月份、独立日期、.318/31.8%、三类终结前捕获与冻结、V12严格precheck及hydrate/export往返、V11拒绝、原runtime保留、事实分类与不同文案重点、无RNG消费、20k历史索引与单次缓存、静态UI结构。静态结构验证不是浏览器视觉验收。

自动验证通过：`VITEST_MAX_THREADS=4 VITEST_MIN_THREADS=1 pnpm test -- --run`，共 176 个测试文件、1085 项测试。`pnpm build`、`pnpm desktop:build`、`pnpm desktop:compile`、`pnpm desktop:renderer-debug-build` 均通过；`git diff --check` 通过。自动验证不代表人工 UI / 历史语义 Gate 通过。

## 人工 Gate：直接按下面做

运行 `pnpm desktop:start:debug`，因为WorldSave升级V12，需要创建新世界，4×运行。不要求重跑5000年验证存储。

### 检查1：找一个已终结国家

天下势力 → 终结 → 任选一个已终结的正式国家 → 王室 → 国评。

把国评全部文字直接复制给 ChatGPT。

### 检查2：检查历史数字

看势力存续、正式国祚、历代君主、王统次数、最高人口、最大疆域、最多城市，是否大致符合其历史。把这些数据复制给 ChatGPT。最高人口、疆域、城市应各有自己的日期；疆域百分比是占整个世界。

### 检查3：检查其他终结方式

最好分别找一个彻底灭亡国家、一个同源归并国家、一个纳土归附国家，打开势力 → 王室 → 国评，至少比较2种终结方式。

没有归并或纳土样本，不用硬跑几千年，只报告“本档没有对应事件”。不要修改概率。

### 检查4：历史卷轴

历史卷轴 → 大事，找到刚才国家的终结事件。展开检查是否有简短国祚回顾，是否与王室国评数字一致。把展开文字复制给 ChatGPT。

### 检查5：流亡国家

如果有正在流亡的国家：天下势力 → 流亡 → 任选一个 → 王室。确认没有被提前写成“彻底灭亡”。只回复正常 / 异常。

### 检查6：保存读取

保存当前V12世界，再读取。重新打开刚才终结国，确认国评数字、史家曰文案、历史终结方式保持一致。只回复正常 / 异常。

### 检查7：性能

打开国评、切换国家、浏览历史卷轴，观察明显卡顿、长时间白屏或布局溢出。只回复正常 / 异常。

样本不够时直接回传已有国评，注明尚未看到的终结类型，不无限长跑。不以CLI/headless冒充视觉验收。未经用户明确PASS，不进入下一版本。

【等待用户人工 Chrome 检查，收到用户回复前不得继续下一版本】

【等待用户人工回传 v0.99930 Faction Historiography Gate；通过前不得开始 Era Atlas II、Dynastic Narrative II、Ruler Political Evidence II、Restoration Audit 或 Initial Royal Household。】
