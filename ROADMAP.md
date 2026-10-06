# 万国纪 · Wanguoji 路线图

这份路线图记录 Public Alpha 之后的优先事项，不代表所有项目都有确定发布日期。

## 近期优先

### P0

- [x] IndexedDB 多槽存档、手动存档管理与双槽游戏时间自动存档。
- [x] Desktop Recovery 恢复档定时保存与关闭前保存。
- 核实或替换来源不明确的资产。
- Ambient Music I runtime / preferences 与经首轮试听整理的 CC0 曲目目录已加入；仍待 asianoriental2 与整体音乐体验人工验收，不视为最终 OST。

### P1

- [x] 世界级 seeded RNG 与存档续接随机状态；完整 replay 工具仍待后续规划。
- Electron 真后台继续运行验证。
- 在线试玩自动部署。
- [x] 外交基础、战略同盟与严格条件下的同源行政合邦；长局人工验收仍待完成。

## 当前人工验收

- v0.99927b1 Runtime Disposal 已人工通过：新世界 Electron 4×约1962年，无 Group.preUpdate `.size` Fatal、Renderer Fatal 或 disposal stalled；768年与1962年 disposal／orphan invariants 正常，live users/groups/registered groups 分别56与58。
- v0.99927b2 History Scalability 子目标已人工通过：历史 publish/notify 在1000+年近零；4228年、约9600 events／2700 rulers存档 Load后恢复60～65 FPS。Runtime Disposal invariants继续正常。1305年God Tab仍出现15 FPS／16 steps per frame，foreground pacing Gate未通过。
- v0.99927b3 Foreground Pacing & Simulation Debt Recovery：有界前台 accumulator、20条session incident、统一rolling 300帧口径。等待真实Electron Stage A新世界4×1000～1500年＋失焦返回／Save恢复；通过后Stage B约4228年V9存档4×100～200年。通过后结束v27b性能审计；下一版直接v0.99927c Dynastic Revolution Calibration，收到人工回传前不得开始下一版本或其他主题。

## 玩法后续

- 帝国整合期。
- 继续调整长王朝 / 分裂周期。

## 暂时不优先

- 复杂经济。
- 联盟共同作战、外交扩展与更复杂的国际关系。
- 科技树。
