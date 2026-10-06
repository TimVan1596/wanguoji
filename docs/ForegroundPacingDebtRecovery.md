# v0.99927b3 Foreground Pacing & Simulation Debt Recovery

## 基线与人工结论

HEAD f517297 / v0.99927b2 / package0.99.105 / WorldSave V9；开始时工作树干净。
History Scalability已通过：append不再全量sort/publish、叙事索引正常、1000+年notify近零。
4228年／9626 events／2706 rulers的V9存档Load后恢复60～65 FPS。不能把1305年15 FPS归因于长历史规模。
Runtime Disposal继续通过：deferredUserGroupDisposals、orphanedUserGroups、disposedUserGroupsStillEligibleForPreUpdate均0，warnings为空。
本版未修改WorldHistory、History filtering UX、Slaves disposal或Phaser对象生命周期。

失败证据：1001年约60.6 FPS／3.94 steps per frame；1305年约15.1 FPS／66ms／16 steps per frame，fixed CPU7.7ms、physics6.4ms。
God Tab、history query／notify近零、focused=false、visibility=visible、FOREGROUND且background catchUpDebt=0。
foreground accumulator与background catch-up是两种不同债务；此前后者为0不能证明前者为0。

## 修改前的真实driver reproduction

先运行旧SimulationDriver的新结构测试，再修改实现。固定4×、BASE_PLAY_RATE2、fixed step1000/30ms、cap16：

| stall（输入driver） | 执行步数 | 剩余scaled foreground debt |
| --- | --- | --- |
| 250ms | 16 | 1466.667ms |
| 500ms | 16 | 3466.667ms |
| 1000ms | 16 | 7466.667ms |
| 5000ms | 16 | 39466.667ms |

100ms/frame持续5秒产生13333.333ms债务；再输入66.667ms/frame持续40秒，每帧仍16步，债务几乎原值。
在这个delta下，每帧新增scaled时间等于16步消费量，因此旧debt无法下降；更慢输入还会继续增长。
这证明旧driver允许持续追债，并非声称CLI复现了Electron的15 FPS视觉现象或确定了所有长帧原因。
最终测试保留旧算术reference与新driver对照，reference不实现第二套世界模拟。

## 有界策略

每个running foreground frame沿原路径执行最多16个fixed steps。
执行后若仍有整步时间，丢弃整步debt，保留不足一个fixed step的余量；暂停时不注入时间。
正常60FPS speed1/2/4保持1/2/4步，fractional phase不清零；长帧后的下一次正常60FPS输入恢复约4步，不追偿过去stall。
实际推进率在overload时可低于墙钟目标速度，固定step精度、4×选择、BASE_PLAY_RATE和physics均保持。
没有跳过canonical months／events／RNG draws，只是不执行未提交的wall-clock debt。
snapshot stop-and-discard仍清零全部未提交accumulator；它不是overload，不计入dropped debt。
runCatchUpChunk和BackgroundProgressionController保持原有独立debt、预算、visibility与OS-resume语义。
V9既有driver DTO仍只有accumulatorMs；没有新增canonical字段、schema或IndexedDB版本。

如果输入本身持续66.667ms，4×自然可能仍执行16步；关键是恢复正常输入后不再携带过去债务。
本策略不能保证消除其他renderer／OS／GC长任务；新incident与帧归属供人工判断。

## 诊断口径

只在development／desktop-debug记录，不消费RNG，不写入save；world reset/hydration重置统计。

- foregroundAccumulatorMs／Steps：当前保留余量，正常running frame结束后小于一个fixed step。
- lastRawFrameDeltaMs：Phaser TimeStep.rawDelta（unsmoothed）；lastDriverFrameDeltaMs：传入driver的Scene delta（可能平滑，或visibility suppression后为0）。lastScaledDeltaMs：实际注入driver的scaled模拟时间。
- foregroundStepCapHit：本帧到达16步budget；不等于必然丢弃debt。exact16步无额外债务可cap=true、drop=0。
- consecutiveStepCapFrames、totalStepCapFrames、peakForegroundAccumulatorMs、droppedForegroundDebtMs、largestSingleDroppedDebtMs：session统计；peak为本帧消费前的临时积累，drop的ms是scaled模拟时间。
- lastDebtIncidentWorldMonth及最近最多20条incident：worldMonth为该foreground frame开始时的月份；包含raw／driver／scaled delta、消费前后accumulator、steps、drop、focus／visibility、minimized、save phase、right panel tab。
- minimized由现有debug面板IPC刷新缓存提供，附minimizedObservedAt（Unix ms）；没有可用观测时未知，不用document.hidden推断。没有新增逐帧IPC、timer或listener。

RuntimePerformance原来rolling600帧，FrameAttribution rolling300帧；现在均rolling300帧，读取同一个rawDelta。
simulation输入仍沿用原Scene delta，测量口径改变不改变simulation pacing。
FPS／avg／p95／max／steps per frame／CPU为rolling窗口；long frames>25/33/50/100ms与总frame count是session cumulative。
所以FPS60但累计long frames很多并不矛盾。FrameAttribution嵌套项仍重叠，unattributed仍是近似残差。

## Electron与stall trigger审计

desktop/main.ts早已设置backgroundThrottling:false。本版只补配置回归测试，没有改BrowserWindow、Web、focus/blur、minimize/restore、DESKTOP_CONTINUOUS或suspend policy。
Phaser3.55.2 TimeStep.js还可能在失焦／cooldown时clamp／smooth Scene delta，因此focused=false本身不能直接证明Chromium throttling。
manual Arcade／AutoSimulator／City founding仍通过原step路径；Save仍在safe boundary执行export/serialize/write。
保存暂停时driver不注入时间；恢复后若Scene delta变大，同一通用foreground保护处理。没有Save专属时间真相、City founding重写或autosave timeout变化。
incident savePhase记录当帧观察，不将长帧未经证实地归因于autosave；恢复后phase可能已是idle。

## 自动验证与人工边界

测试覆盖60FPS speed1/2/4、四档stall、throttled→normal恢复、repeated spikes、fractional carry、cap/drop与20条事件上限、reset、paused、background debt、snapshot停止、debug on/off实际执行步数／WorldClock／digest／RNG、V9 JSON续接对照和Electron配置。
真实Electron focus、Tab、长局与Save/Load视觉行为必须由用户验收，自动测试不替代。

Stage A：`pnpm desktop:start:debug`，新世界4×至少1000～1500年。
回传rolling FPS／frame avg/p95、steps/frame、foreground accumulator ms/steps、cap hit/consecutive、dropped debt、fixed／physics CPU和Runtime Lifetime。
必须做一次切到其他应用一段时间再返回：观察很快恢复约4 steps/frame与正常FPS，不允许持续16步追债。
必须观察一次Save／autosave前后：短暂长帧可以接受，完成后不得进入持续低FPS追债。

Stage A通过后才做Stage B：加载原4228年左右V9存档，4×推进100～200年。
检查约10k历史、accumulator不持续增长、steps/frame约4、History／Faction／City／God切换、Save/Load和same-seed checkpoint。
通过本Gate后结束v27b性能审计，下一版直接进入v0.99927c；当前必须停止等待回传。

【等待用户人工回传 v0.99927b3 Foreground Pacing & Debt Recovery Gate；
通过前不得开始 v0.99927c Dynastic Revolution Calibration、
Diplomacy II、纳土归降、Faction Historiography 或 Era Atlas II。】
