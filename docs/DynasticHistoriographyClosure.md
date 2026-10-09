# v0.99930b1 — Dynastic Historiography Closure

## 本轮基线与人工反馈

初始HEAD b048626，工作树干净，APP_VERSION v0.99930b、package0.99.120、WorldSave V12。开发期间出现外部提交，保留已有工作，不覆盖或回退。

v30b的峰值、计时、编年、攻守反转、三种终结及主要史论与Save/Load已经人工正常。本版仅修王统相关事实一致性，不继续泛化文学修订。

## 代码审计与根因

- `WorldHistory.addEvent`向canonical events追加，月度索引对同月用二分插入；势力查询顺序不等于日级真实时间。`collectFactionNarrativeEvidence`又以month/eventId稳定排序，`FactionNarrativeTimeline`最后对同月按kind排序，因此FINAL_LOSS会排到USURPATION之前。
- `DynasticRevolution.getRevolutionEligibility`明确要求STATE、ACTIVE、cityCount>0；篡朝记录来自继承边界的真实canonical事件。这允许派生叙事把在国政治事件置于最终失国之前，不允许补造具体日期或声称篡朝导致失国。
- 王统论点原分数为篡朝98/普通易姓87，低于攻守反转108和重复迁都100；最多两个主题时，周的篡朝会落选。董的久祚、半壁与自然王统变化也可能只剩规模论点。
- 王室标题固定为“当前王统”；实际最新epoch已经取houseEpochs最后项，无须从houseName推断或改档案。

本轮未获得浏览器存档原始事件输入；周956年6月、州1087年/1161年的事实来自用户人工回传，测试重建这些角色与月份组合。代码审计确认展示排序可复现上述矛盾，不声称已经检查用户浏览器中的原始存档。

## 修改文件与规则

- `src/Historiography/FactionNarrativeTimeline.ts`：同月稳定依赖阶段为起源→正式建国→在国事件→最终失国→终结。其他无依赖节点继续稳定排序；不是新增真实时间，不改canonical事件顺序、月份、ID。
- `src/Historiography/FactionHistoricalArguments.ts`：只新增两个有限论点。
  - SAME_MONTH_USURPATION_LOSS：真实本国篡朝事件与最终失国同月，保留双方事件ID；优先突出新王统接位与无土境地的反差，不陈述因果。
  - FORMER_OPPONENT_UNION：仅MERGED，canonical接受方ID与过去实际攻都事件targetFactionId相同，行动角色属于本国，战争早于合邦；无此前战争、只是同名、身份相反、后来战争或SUBMITTED均不使用该论点。
  - 有真实篡朝事件时王统论点优先于普通迁都；长期正式国祚且曾据世界半数以上、两姓零篡朝的组合保留国家与王统的区别。没有篡朝事件不由改姓推断暴力夺权。
- `src/Historiography/FactionHistoriography.ts`：派生证据携带现有terminationTargetFactionId，只用于稳定ID核验，不新增canonical数据。
- `src/UI/Components/FactionDetails/RoyalPresentation.ts`与`index.tsx`：EXTINCT生命周期（涵盖EXTINCT/MERGED/SUBMITTED三种终结原因）显示“末代王统”；ACTIVE/EXILED仍显示“当前王统”。内容继续取真实最新epoch。
- 更新版本、package版本断言、CHANGELOG及本文。

不修改已通过的正文编年选材、终身史料统计、生命周期、缓存/索引路径。外交、继承、革命、复国、合邦、纳土、战斗、人口、RNG、庙号谥号、地图及Era Atlas均冻结。WorldSave仍V12，DTO/Exporter/Hydrator/Validator未改变。

## 新增测试

`src/Historiography/DynasticHistoriographyClosure.test.ts`：周同月顺序、反向输入和字母ID不影响依赖、真实篡朝进入史评、无因果/宫廷虚构、不同月不误判、董两姓零篡朝、州攻董都后合邦及六种反例、事件月份国号、canonical对象不变、无RNG消费、JSON恢复派生结果一致与schema12断言。

`RoyalPresentation.test.ts`新增三种终结原因的末代标题/真实最新epoch，以及ACTIVE/EXILED当前标题。韩、郢、燕/迁都、楚及全部冻结玩法回归继续运行，旧测试不删除或弱化。

## 自动验证结果

- 针对性测试：6个文件、74项全部通过。
- `VITEST_MAX_THREADS=4 VITEST_MIN_THREADS=1 pnpm test -- --run`：181个测试文件、1152项全部通过，包含既有V12往返、20k历史缓存、same-seed及冻结玩法回归。
- `pnpm build`：通过，音乐资源检查通过。
- `pnpm desktop:build`：通过，renderer资源检查、音乐资源及Electron编译通过。
- `pnpm desktop:compile`：独立执行通过。
- `pnpm desktop:renderer-debug-build`：通过，renderer资源、2份debug sourcemap及音乐资源检查通过。
- `git diff --check`：通过，暂存差异亦无空白错误。

构建仅有已有的bundle超过500kB提示，本版不做无关拆包重构。

## 遗留风险与人工边界

同月依赖排序仅表达现有规则允许的政治阶段，不恢复未记录的日级时间。旧档若缺少稳定接收方ID、攻都角色或篡朝事件，就不生成对应特定论点。叙事筛选仍有长度限制，文学感、真实世界文字和UI不能由命令行验收。

## 人工 Gate：直接读取现有V12长局

运行`pnpm desktop:start:debug`。不需新建世界，不需再跑数千年。

1. **周**：天下势力→终结→周→王室→国评。复制956年6月附近国史简述、完整史评和史家曰。检查刘氏→张氏篡朝先叙述，再说同月失去最后据点；不能暗示篡朝导致亡国。
2. **董**：天下势力→终结→董→王室。复制王统标题、史评和史家曰。应显示“末代王统”，保留两姓零篡朝，不写暴力夺权。
3. **州**：天下势力→终结→州→王室→国评。复制史评和史家曰。应反映1087年攻董都、1161年并入董（同源合邦），不能写反方向、战败灭国或凭空和解。
4. **保存读取**：保存→重新读取V12，再打开三国，文字与数字应一致。回复“Save/Load正常”或“Save/Load异常”。
5. **性能与视觉**：切换三国国评、展开王统，观察卡顿、白屏、长文溢出。回复“性能正常”或“性能异常”。缺少样本直接注明，不要求追加长跑。

【等待用户人工 Chrome 检查，收到用户回复前不得继续下一版本】

【等待用户人工回传
v0.99930b1 Dynastic Historiography Gate；

通过前不得开始
v0.99931 Era Atlas II、
Dynastic Narrative II、
Ruler Political Evidence II、
Restoration Audit
或 Initial Royal Household。】
