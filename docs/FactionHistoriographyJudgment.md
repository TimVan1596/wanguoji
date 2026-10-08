# v0.99930b — Historiographic Judgment & Terminal Wording

## 基线与根因

本轮初始检查：HEAD ae59066，工作树干净，APP_VERSION v0.99930a、package 0.99.119、WorldSave V12。执行期间仓库出现外部提交，未覆盖、回退或自行提交这些工作。

v30a国史简述、永久史料、生命周期和存档人工基本通过；史评与史家曰仍未通过。原实现按“起源→峰值→转折”的类别拼接句子，可能先写40年峰值、再写25年战事；少量终局分支使不同国家反复得到相同的流亡结语。

## 修改与边界

- `FactionHistoricalArguments.ts`：纯派生论点，每项保存argumentKey、真实事件ID、指标键、相关月份、叙事相关度和理由。优先识别攻守反转、久祚末路、帝制/霸权后失国、迁都、半壁失国、复国、王统更替与两种和平终结；分数只选文案，不参与模拟。
- `FactionNarrativeTimeline.ts`：统一编年节点，先选择最多7项，再按月及稳定同月规则排序。起源、建国、最终失国和终结是锚点，其他材料结合政治重要性、阶段代表性和选中论点取舍。峰值日期各自独立，不拼造同月鼎盛。
- `FactionHistoricalNarrative.ts`：国史回答经历，史评解释主要功业/局限/转折，史家曰表达有事实基础的反差。缺少事实时缩短，不补人物、动机、血缘或因果。
- `MergedEventPresentation.ts`及历史/君主纪事/势力详情展示：旧V12的MERGED从absorbedFactionId与absorbingFactionId解析“被吸收方并入吸收方（同源合邦）”；SUBMITTED为纳土归附。国号按事件/终结月解析，不按当前名称替换原文。
- 保留FactionAssessmentArchive缓存和WorldHistory势力索引；首次只构建该国派生档案，无每帧全世界历史扫描。正文最多7句，史评最多3项，史家曰最多两个不同主题。
- 更新APP_VERSION v0.99930b、package0.99.120、CHANGELOG、README、ROADMAP及版本断言。

不修改任何玩法、判定阈值、永久史料统计、时间口径、RNG、庙号谥号、地图或存档DTO。WorldSave仍V12，旧V12可直接读取；不另存叙事数据库，不新增历史事件。

## 自动测试与实际验证

新增`FactionHistoricalJudgment.test.ts`：郢/韩/楚/齐/州编年与质量场景、攻守角色核验、代表性论点排序、论点来源存在性、两姓不等于篡朝、缺失人物不编亲征、迁都地名消歧、政治节点优先、短史安全降级、JSON恢复后确定性及无RNG消费。

新增`MergedEventPresentation.test.ts`：旧V12合邦方向、历史名称、标题/详情一致、不改事件对象、与纳土区分、缺失ID不从旧标题猜双方。原叙事/个人纪事/势力详情测试仅更新展示预期，补强编年断言；冻结玩法测试保留。

验证命令及结果：

- `VITEST_MAX_THREADS=4 VITEST_MIN_THREADS=1 pnpm test -- --run`：180个测试文件、1134项测试全部通过；包含V12往返、same-seed、20k历史、档案缓存及冻结玩法回归。
- `pnpm build`：待记录。
- `pnpm desktop:build`：待记录。
- `pnpm desktop:compile`：待记录。
- `pnpm desktop:renderer-debug-build`：待记录。
- `git diff --check`：待记录。

## 遗留风险

相关度和论点组合是展示判断，不能保证文学质量自动达标。史料缺失时只能短评；同类事实仍可能形成相近论点。长史最多7个节点会取舍普通事件，完整历史不删。命令行验证不等于视觉、文采、实际保存读取或主观性能验收。

## 人工 Gate：直接读取现有V12长局

运行`pnpm desktop:start:debug`。不必新建世界或重跑数千年，无样本直接回复“本档无样本”。

1. **韩**：天下势力→终结→韩→王室→国评，复制国史简述、史评、史家曰。核对25年攻魏都大梁→40年峰值→59年失新郑→94年绝统，按时间排列；史论应体现攻守反转，而非只重复流亡35年。
2. **楚**：复制史评和史家曰，检查906年国祚、37君、852年兴亭失陷及906年终结。应与韩有实质区别，无称帝证据不得写成帝国。
3. **郢与燕**：分别复制史家曰。虽然都曾据世界过半，应因真实迁都、失都、人物与时间经历而有不同重点，不能仅换国名和流亡时长。
4. **州与董**：历史卷轴→大事→1161年1月，应明确“州并入董（同源合邦）”。再打开终结→州→王室，复制国家结局、国史简述、史评、史家曰。州是被吸收方，不得写成州吞并董或战败灭国，不得编造同宗血缘。
5. **保存和性能**：保存→读取V12，再看韩和州，文案、日期、合邦对象应完全相同。打开多个国评，观察卡顿、白屏、溢出。回复“Save/Load正常/异常”“性能正常/异常”。

所有UI、文采、历史语义、布局和真实Save/Load必须由用户人工Chrome检查。本轮自动验证后停止，不进入下一版本。

【等待用户人工 Chrome 检查，收到用户回复前不得继续下一版本】

【等待用户人工回传
v0.99930b Historiographic Judgment Gate；

通过前不得开始
Era Atlas II、
Dynastic Narrative II、
Ruler Political Evidence II、
Restoration Audit
或 Initial Royal Household。】
