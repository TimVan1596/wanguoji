# v0.99927b2 History / Frame Scalability

后续人工结论：History Scalability 子目标已通过，1000+年 history notify近零；4228年、约9600 events／2700 rulers的V9存档Load后恢复60～65 FPS。Runtime Disposal仍通过。1305年God Tab下15 FPS／16 steps per frame属于尚未关闭的foreground pacing问题，由v0.99927b3处理；本文件保留b2当时的测量／Gate记录，新的人工Gate见 [ForegroundPacingDebtRecovery](ForegroundPacingDebtRecovery.md)。

## 人工基线

公开基线 a3d20fb，APP_VERSION v0.99927b1 / package 0.99.104 / WorldSave V9。
用户已确认新世界 Electron debug 4×连续运行约1962年，没有 Group.preUpdate `.size` Fatal、Renderer Fatal 或 disposal stalled。
768年和1962年 disposal／orphan invariants 均正常，liveUsers/liveUserGroups/registeredUserGroups 分别56／58。
本版没有修改已通过的 disposal／Slaves／Phaser 生命周期。

长局 frame degradation 仍待关闭：768年约66 FPS，frame avg/p95 15.1/16.5ms；1962年约47.4 FPS，21.1/28.9ms，max148.9ms。
同期历史1618→4151、君主475→1219，active cities与units近似不变，runtime资源有界、heap下降。
因此本轮测量历史与帧成本，没有继续按资源泄漏假设清理。

## 可重复结构测量

WorldHistoryScalability.test.ts 在修改前记录一次 append 的操作：

| 历史条数 | 排序输入长度 | 发布条数 | 测试环境耗时 |
| --- | --- | --- | --- |
| 1,000 | 1,001 | 1,001 | 0.862ms |
| 5,000 | 5,001 | 5,001 | 3.302ms |
| 20,000 | 20,001 | 20,001 | 8.462ms |

耗时包含 spy 开销，不是 Electron frame 证据，也不作为 CI 时间阈值。
最终测试断言 runtime revision/append subscribers 不调用全量 getEvents、Array.sort 或 Array.slice，追加只发布一条记录；示例最终耗时0.062/0.020/0.039ms。
即使 History Tab 已关闭，ChapterBanner 原来仍常驻订阅并扫描全历史；它现在只处理当前 append batch，不扫描旧记录或读档重播。
History/Faction Tab 条件挂载、effect 返回 unsubscribe；重复订阅／卸载验证 listener count 回到0。

HistoryNarrativeScalability.test.ts 另测得5,000条历史、250个覆灭锚点产生254次全历史扫描。
改用 month/group 候选索引后只有四次锚点筛选；文案、group predicate、事件顺序不变。
一次只读对照审计使用固定种子150组混合月份／跨月group fixture，结果与 a3d20fb 旧实现逐项 JSON 完全一致。
保留现有叙事测试，并新增分页、筛选、时代、同月稳定顺序与跨月group的完整 reference 对照。

## 数据与查询边界

- canonical events 仍完整且按原插入顺序 export；新索引不写入 save，reset/import 重建。
- 派生 ascending month index 增量插入，普通新月份 append；同月／追溯事件二分插入，倒序查询保持原 stable tie 顺序。追溯插入可能移动索引后缀，但不排序或发布完整历史。
- getEvents/getEventsForFaction/getEventsBetween 保留完整查询接口；legacy snapshot subscription 保留兼容，但实际 runtime UI 已全部改为轻量订阅。
- HistoryScroll 以200条候选窗口处理完整月份和显式事件链，找到当前可见数量加一个结果即停止；加载更早增加可见数量。稀疏筛选可能扫描更多索引，但逐窗口分组／过滤，不先复制完整历史。
- 窗口边缘必须保留完整 narrative chain，极大的单月／显式组可能超过200条；不以截断叙事事实来换性能。
- 王室／个人档案仍按需读取完整历史，防止遗漏其他势力参与的同一事件链；打开“天下纪录”仍需完整档案。这些显式全档案用途不宣称常数成本。
- CurrentRulerLookup 仅缓存当前 ruler 的 array position。每次读实际slot并验证id；变更／重排时回到linear查找，hydration/reset清空。没有改候选选择、宗亲归档、ruler数组、月度频率或RNG。

## 帧归属与保存诊断

仅 development／desktop-debug 开启 FrameAttribution：固定17个phase，300帧rolling样本，Core reset/hydration重置，不存档、不读RNG，不修改renderer。
包含 Core CPU、fixed simulation CPU、manual Arcade physics、logical simulation、AutoSimulator.advance、checkpoint、visual sync、labels/focus/player/block presentation、dev validation、history notify与UI query。
Core CPU 包含fixed与presentation；AutoSimulator含它内部的history notify；这些嵌套阶段不能直接相加。

`unattributed frame time = max(0, frame delta - current Core CPU)` 是近似残差，包含帧等待、renderer、React、GC和未测工作，不能解释为测得的renderer CPU。UI query通常在Core之外、下一次采样时汇总，属于残差中的已识别活动，不应重复相加。
正常build不采样。原 frame performance 的presentation字段仍是Core减fixed的旧口径；新增真实 presentation 子阶段请看Frame attribution。
保存保留既有safe-boundary／export+serialize／IndexedDB write／total duration，新增debug session-only phase（safe boundary、export/validate、serialize、write、idle）；没有改autosave timeout或保存语义。

## 必须由用户完成的 Electron Gate

执行 `pnpm desktop:start:debug`。自动测试／build不代表视觉、Phaser长局或主观流畅度验收。

Stage A：新世界4×运行到至少1000～1500年，在约500／1000／1500年复制完整诊断：

- FPS、frame avg/p95/max，>25/33/50/100ms frames。
- total fixed/month avg/p95；physics、simulation、history publish、presentation、unattributed frame attribution。
- history event count、total ruler count和Runtime Lifetime invariants。
- 打开History、滚动、加载更早；切Faction／City／God再回History，比较帧率和流畅度。

Stage A没有明显regression后才做Stage B：加载原约3451年V9存档，4×连续推进至少500年，中途不人为Save/Load重置runtime；开始／结束各复制完整诊断。
检查History相对其他Tab、save/autosave冻结、late-session autosave、runtime有界、same-seed checkpoint、Save/Load。
如果明显变慢，先复制诊断，再Save→Load同世界比较；不得省略Load前证据。

【等待用户人工回传 v0.99927b2 History / Frame Scalability Gate；
收到回复前不得开始 v0.99927c Dynastic Revolution Calibration、
Diplomacy II、纳土归降、Faction Historiography 或 Era Atlas II。】
