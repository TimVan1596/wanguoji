# v0.99931b · Faction Historical Judgment II

## 基线与冻结范围

起始 HEAD d248060，工作树干净，APP_VERSION v0.99931a2 / package 0.99.125 / WorldSave V12。用户已确认时代精选、全部历史、入口、快照提示、时代同步、保存读取及快速切换正常，记录人工 PASS。目标 v0.99931b / package 0.99.126；存档仍为 V12。

本轮不修改战争、围城、人口、叛乱、外交、继承、篡朝、分裂、复国、纳土、同源合邦、君主庙号谥号、永久史料统计、时代与精选、canonical事件、RNG及存档 DTO。无 LLM/API、无随机修辞。没有用户长局文件，也没有假称读取其存档。

## 根因审查

- ATTACK_DEFENSE_REVERSAL固定108，过半疆域HALF_WORLD_LOSS为92、久祚崩折LONG_RULE_COLLAPSE为103。即使国家经历更复杂，简单攻守反转也可能先占一个论点。
- 最多两条、不同轴的选择有助控制长度，但原 voice 直接拼接论点固定句子。城市虽进入文字，已核验亲征人物、具体年月、峰值比例和“失都与最后失国不是同一事件”的结构没有充分进入评论。
- 单纯增加同义句不能改变论述重心；相似轨迹仍应允许相近结论。本轮保留两条论点上限、既有HOUSE/政治终结事实和时间线，只补有限的事实组合及背景表达。

## 实际改变与证据

1. 新增纯派生论点 EXPANSION_CAPITAL_FINAL_LOSS：真实攻取敌都在实测疆域峰值之前/同月，峰值占世界至少一半，后来真实失都，再后来失去最后据点并流亡。支持事件ID、峰值记录及终结月均在论点上可追踪。116分使此完整链优先于简单反转；二者不重复进入精选论点。
2. ATTACK_DEFENSE_REVERSAL仍为普通两役的合法论点。真实两役相隔不超过10年时突出骤折，否则突出世局易势，使用真实年月和时距，不推论复仇、因果报应。满足原长期国祚崩折事实门槛时，其分值降至96，让久祚和多代延续103优先，而不删除战争事实。
3. HALF_WORLD_LOSS、LONG_RULE_COLLAPSE、EXILE_CONTINUITY使用各自实测峰值、真实失国月份/城市与终结间隔。史家曰在这些背景上作评论，不再只说“城池尽失而仍延其统”。
4. 人物继续来自 collectFactionNarrativeEvidence 对 acting faction、真实rulerId和任期的验证；战争人物证据来自 City.capture 的实际rulerId，不用当前君主补写。国家名继续按事件月份取nameHistory。缺失证据则不写人物、敌国或不存在的阶段。
5. 原UI、最多两轴、编年里程碑、FactionAssessmentArchive缓存与WorldHistory faction index不重构。新论点只做一次该国派生档案计算，未增加每帧/全世界扫描。

### 旧版与新版对照（纯夹具，非用户视觉验收）

- 燕式轨迹：旧先选“昔日兵锋抵临淄，后来蓟亦不能守”，只体现两役；新主论点围绕核验的燕王姬惟亲征、58年12月755格/61.6%、131年8月失蓟、302年2月失邯郸及其后47年1个月延续，比较扩张、失都、无土、终结四个阶段。
- 赵式轨迹：13年11月攻魏都与106年8月失己都的长时距，评论昔日得势不能替后世守都。
- 魏式轨迹：4年7月攻韩都与13年11月失己都相隔9年4个月，评论扩张所得与都城失守相距之近。
- 齐式轨迹：没有攻人首都的证据，不构造反转；9年9月失临淄，50年6月终结，40年9个月无土续统，比较土地丧失与政治终结。

这些差异来自事实结构与间隔；没有按国家名字写特殊模板。建国、王统、复国、合邦、纳土仍使用已有事实规则。

## 生死语义只读审查

`DynastyRegistry.markExtinct()`（src/Politics/Dynasty.ts）确实会将非dead的当前君主转为dead，并写“彻底灭亡”，方法自身未检查死亡事件。

全仓库共五处调用，不能只看流亡管理器：

- `WorldExiles.update`：shouldExileBecomeExtinct 要求残部<=0、合法性<=0且 hasClaimant=false。hasClaimant 对非dead/非abdicated的当前君主返回true，因此活着的在位君主阻止走到该调用。
- `DynastyRegistry.succeedRuler` 无后继分支：调用前已将 currentRulerId=null，getCurrentRuler返回undefined，该处不会无条件再写死前君。
- `City.destroyPermanently`（src/Components/City.ts:871附近）：城市可由updateDevastation进入永久毁坏路径。若毁坏的是ACTIVE势力的最后首都，没有下一首都候选且cities.length=0，则直接markExtinct；没有captured/natural/combat死亡判定、claimant检查或人物死亡证据门。当前君主带chronicle且尚活着时会被markExtinct改为dead。
- `Core.handleFactionExtinction` 临时政权分支（src/Game/Core.ts:533附近）：非正式国家最后城失守，直接markExtinct，没有独立人物死亡判定。
- 同方法正式国家终结分支（src/Game/Core.ts:575附近）：resolveCapturedRuler只在remnantPopulation>0时求值；残部为0时短路跳过被俘判定，随后直接markExtinct，亦未要求当前君主已死亡。

**结论：已确认独立的政治/生死语义缺陷存在可达代码路径。** 这不是本次叙事补丁造成的，也未声称已在用户存档复现。特别是最后首都因毁坏消失，无战斗死亡事实也可把君主写死。列为下一轮优先修复事项，需要单独厘清政治终结与人物生死并进行回归测试；本轮明确不改这些规则。MERGED/SUBMITTED通过行政退位路径，不调用markExtinct。

## 修改文件

- src/Historiography/FactionHistoricalArguments.ts：证据链选材、背景化评论和去重。
- src/Historiography/FactionHistoricalJudgmentII.test.ts：纯档案差异化、人物核验、时间/身份、JSON与WorldHistory导入一致、RNG、无未来反填及claimant保护测试。
- src/config/version.ts、package.json、desktop/DesktopSecurity.test.ts：版本。
- CHANGELOG.md、README.md、ROADMAP.md、本说明：PASS记录、当前Gate及风险。

## 自动验证

实际执行全部通过，保留所有已有测试，未删除或弱化断言：

- `VITEST_MAX_THREADS=4 VITEST_MIN_THREADS=1 pnpm test -- --run`：190文件、1211项测试通过。
- `pnpm build`：通过，音乐资源校验通过。
- `pnpm desktop:build`：通过，renderer资源、音乐校验和Electron编译通过。
- `pnpm desktop:compile`：独立执行通过。
- `pnpm desktop:renderer-debug-build`：通过，renderer资源、2份debug sourcemap与音乐校验通过。
- `git diff --check`与暂存差异检查：通过。

构建仅有原有500kB大包提示。自动验证未声称完成浏览器文学质量或视觉验收。

用户列出的 `pnpm desktop` 不是本仓库脚本；按真实脚本执行 desktop:build、desktop:compile、desktop:renderer-debug-build。没有启动Electron或以自动UI工具代替人工Gate。

## 风险与遗留

文学质量只能由用户判断。本版更具体的背景可能稍增长文字，仍限制两轴、有限论点与原版式；是否有溢出需要人工。史料不足时不补故事。不能从终结0领土推论渐进衰败；不能从同源推论宗室血缘。已确认的markExtinct政治/生死语义缺陷只记录，未改规则。

## 人工 Chrome/Electron 检查

运行 `pnpm desktop:start`，读取当前 V12 长局。不需要新世界，也不需要再跑数千年。

1. 天下势力→终结→燕→王室→国评。复制完整“史评”“史家曰”，检查61.6%鼎盛、失蓟、失邯郸、长期流亡等独特背景。
2. 依次打开赵、魏、齐的王室国评，复制各自完整“史评”“史家曰”，判断是否仍只是同段话换地名。
3. 有篡朝、复国、同源合邦或纳土国家，任选一个复制对应国评；没有则写“本档无对应样本”，不硬跑。
4. 看国史简述：年月顺序、历史国号、人物归属应正确，无补造人物/战事/动机。发现问题复制那一句。
5. 保存V12→读取，比较同一国家国评、史家曰、日期和终结对象一致。
6. 浏览历史卷轴、时代图鉴和游戏运行，观察明显新卡顿、白屏、文字溢出或其他UI异常。

### 人工回复模板

```text
燕：
史评：（复制“王室→国评→史评”全部文字）
史家曰：（复制全部文字）
独特事实/人物/时间：正常/异常（异常请贴具体句子）

赵：史评（原文） / 史家曰（原文）
魏：史评（原文） / 史家曰（原文）
齐：史评（原文） / 史家曰（原文）
三国评论辨识度：正常/异常（是否仍像仅换地名）

其他政治终结/转折样本：国家、类型、国评原文 / 本档无对应样本
国史简述：年月、国号、人物归属、真实性 正常/异常
Save/Load：正常/异常（文字和日期是否不变）
历史卷轴/时代图鉴/游戏运行：正常/异常
布局和性能：正常/异常（溢出、白屏、卡顿请说明）
最终人工Gate：PASS / 未通过
```

等待用户明确PASS之前，不开始宗室初始化、复国平衡、篡朝故事生成、政治宗谱增强或任何后续版本。
