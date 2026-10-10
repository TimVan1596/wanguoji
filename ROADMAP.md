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

- v0.99929 Peaceful Submission及v0.99929a终结纪事人工全部PASS，正式冻结。
- v0.99930b1人工正式PASS，Faction Historiography全系列冻结。v0.99931地图国号、比例、前后导航、时代轴、Save/Load和快速切换人工PASS，布局FAIL。v0.99931a布局、国号、城市文字、导航、入口、Save/Load及10时代切换人工正常。v0.99931a1仅增加时代大事和历史国界，V12不变，等待[人工Gate](docs/EraAtlasChronicleBorders.md)并独立补验大事→时代→对应地图点击，通过前不进入下一版本。

- v0.99928 Diplomacy II全系列人工PASS并冻结，包括v28b时间文案和Strategic Union续约年龄连续性。
- v0.99929a Political Terminal Chronicle Closure：历史终结对象、退位措辞与双方君主个人纪事修复，[现有 V11 长局人工 Gate](docs/PoliticalTerminalChronicleClosure.md)已PASS，修复范围已冻结。
- v0.99929 Peaceful Submission已人工PASS：不同源正式国家极端不对称/长期和平/接壤时纳土，独立SUBMITTED终结、退位档案和WorldSaveV11。[人工Gate](docs/PeacefulSubmission.md)已完成，玩法规则冻结。

- v0.99927 Dynastic Revolution系列完整人工通过，校准及历史/谱系/persistence Gate正式冻结。
- v0.99928 Diplomacy II规则与WorldSaveV10保留，长局人工Gate已通过。v29纳土与v29a终结纪事Gate均已通过。

- v0.99927b1 Runtime Disposal 已人工通过：新世界 Electron 4×约1962年，无 Group.preUpdate `.size` Fatal、Renderer Fatal 或 disposal stalled；768年与1962年 disposal／orphan invariants 正常，live users/groups/registered groups 分别56与58。
- v0.99927b2 History Scalability 子目标已人工通过：历史 publish/notify 在1000+年近零；4228年、约9600 events／2700 rulers存档 Load后恢复60～65 FPS。Runtime Disposal invariants继续正常。1305年God Tab仍出现15 FPS／16 steps per frame，foreground pacing Gate未通过。
- v0.99927b3 Foreground debt fix 已人工 PASS：正常4×约60 FPS／4 steps；overload整步debt不再积累。2911年macOS锁屏返回约7.5 FPS，但4 steps、accumulator=0、Core约2.14ms，属于尚未定位的frame cadence问题。
- v0.99927b4 Gate FAIL：nominal／AC／RAF running、resetDelta已执行，锁屏后仍10～30FPS；低Core CPU及4steps排除旧debt spiral，render／compositor／OS根因未定。
- v0.99927b5已人工回传：RAF＋blocker锁屏约18min后rolling~56FPS，unlock1／5／10s~17.5／50.5／58.2；timeout＋OFF锁屏约12min后rolling~52.6FPS，callback~39.8／51.2／51.6，均可正常游戏。v27b性能审计正式结束，不做b6；所有修复冻结，两个实验保留opt-in，release默认RAF＋OFF不变。
- v0.99927c Dynastic Revolution Calibration：取消稳定度25独立硬门，保留合法successor／STATE／ACTIVE／有城／succession-crisis／真实vulnerability；概率为基础4／6／10／14%＋事实加成，cap18%，eligible boundary最多一次draw。V9不变。
- v27c人工2445年：589 boundaries／8 crisis／6 draws／0篡朝，六次chance期望约0.50。v0.99927d只开放前君战死／被俘＋孤城复合低风险入口（shock¼／instability½），最高crisis不变，新增session期望频率诊断；V9不变。2445年低FPS／unlock卡顿仅记known performance debt。
- v27d自然可达已确认：1005年世界10draws／1篡朝／expected0.50；9867月陵政权陆氏→欧阳氏。校准冻结，不再改概率与门槛。
- v0.99927d1人工已通过易代UI、旧宗亲／无假血缘及unseen滚动。当前阻断：唐→夏V9坏block city引用导致teardown后Load失败；时代筛选混入empire-split叛乱建势叙事。
- v0.99927d2修复monthly销毁后重建zone、export/preflight active-city完整性与严格archived-ref副本恢复；时代只保留世界级事件。V9不变。等待现有存档repair／安全拒绝、再保存重载0repair及城市毁灭／时代／paging人工Gate。通过前不进入v0.99928或其他玩法。

## 玩法后续

- 帝国整合期。
- 继续调整长王朝 / 分裂周期。

## 暂时不优先

- 复杂经济。
- 联盟共同作战、外交扩展与更复杂的国际关系。
- 科技树。

## 外交观察 backlog（未实现）

**Deterministic Staggered Diplomacy Evaluation**：当前年度评价使用worldMonth%12===0，同月两条NAP符合现有配额，不能据此判断过密。只有长局人工确认每年同月扎堆影响历史自然感后，才考虑pair-specific deterministic phase=stableHash(pairKey)%12，保持每pair每年最多一次。本版只记录，不实现、不调整频率。
