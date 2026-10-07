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
- v0.99927b3 Foreground debt fix 已人工 PASS：正常4×约60 FPS／4 steps；overload整步debt不再积累。2911年macOS锁屏返回约7.5 FPS，但4 steps、accumulator=0、Core约2.14ms，属于尚未定位的frame cadence问题。
- v0.99927b4 Gate FAIL：nominal／AC／RAF running、resetDelta已执行，锁屏后仍10～30FPS；低Core CPU及4steps排除旧debt spiral，render／compositor／OS根因未定。
- v0.99927b5已人工回传：RAF＋blocker锁屏约18min后rolling~56FPS，unlock1／5／10s~17.5／50.5／58.2；timeout＋OFF锁屏约12min后rolling~52.6FPS，callback~39.8／51.2／51.6，均可正常游戏。v27b性能审计正式结束，不做b6；所有修复冻结，两个实验保留opt-in，release默认RAF＋OFF不变。
- v0.99927c Dynastic Revolution Calibration：取消稳定度25独立硬门，保留合法successor／STATE／ACTIVE／有城／succession-crisis／真实vulnerability；概率为基础4／6／10／14%＋事实加成，cap18%，eligible boundary最多一次draw。V9不变。
- 等待v27c新世界默认desktop debug4×800～1500年人工Gate：hard eligibility／roll attempts／chance buckets／最近samples及真实篡朝历史身份、旧宗亲、epoch与Save/Load。没有篡朝但已roll不自动提高概率；hard eligibility=0则回传证据。通过前不进入Diplomacy II、纳土归降、Faction Historiography或Era Atlas II。

## 玩法后续

- 帝国整合期。
- 继续调整长王朝 / 分裂周期。

## 暂时不优先

- 复杂经济。
- 联盟共同作战、外交扩展与更复杂的国际关系。
- 科技树。
