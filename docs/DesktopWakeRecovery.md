> b4人工Gate FAIL：unlock resetDelta已执行，锁屏后callback cadence仍低；进入 [b5 macOS Scheduler A/B Gate](MacOSLockScreenSchedulerAB.md)。下文保留b4实现及原验收清单。

# v0.99927b4 Desktop Wake & Frame Scheduler Recovery

## 已确认与尚未确认

基线 HEAD 283545f；b3 foreground debt fix 人工 PASS。正常4×约60 FPS、4 steps/frame，overload不再保留整步debt。

约2911年macOS锁屏返回后，7.5 FPS、raw frame avg132.8ms／p95 207.7ms，却仅4 steps/frame、foregroundAccumulator=0、cap=false；fixed CPU1.98ms／Core CPU2.14ms／presentation0.15ms／unattributed130.7ms。这排除了旧16-step追债症状，但没有证明具体OS、RAF或renderer根因。unattributed包含调度／render／React／GC／未测量工作，不能称为实测renderer CPU。

## 实现边界

- Main监听resume、unlock-screen、user-did-become-active，发送固定`gridgod:desktop-wake`。Preload只暴露该频道的订阅及unsubscribe，不暴露任意IPC authority。
- Renderer验证source/timestamp/递增sequence；同一或旧sequence不重复执行。仅在DESKTOP_CONTINUOUS调用安装版Phaser 3.55.2 `game.loop.resetDelta()`，不会restart RAF、reload、reset SimulationDriver、推进WorldClock或调用WorldRandom。
- resetDelta重置lastTime/time、FPS采样计数与deltaHistory，并设置delta=0、_coolDown=panicMax；不立即把actualFps改成60，也不证明系统RAF能恢复。普通focus由Phaser既有focus生命周期负责，本版IPC只观察focus恢复，不另加reset。
- b3 bounded accumulator与fractional carry原样保留。resume-after-suspend的既有PAUSE／CATCH_UP仍独立运行，本版wake没有新增补算路径。
- Release只有必要wake订阅／reset，无新逐帧诊断采样、timer、轮询、PerformanceObserver。Web不注册desktop bridge，不受影响。
- Debug main记录lock次数／最新lock/unlock/user-active/inactive/resume/focus时间、thermal状态及最新变化时间、CPU speed limit及最新变化时间、battery/AC。初始thermal仅macOS读取，speed limit未通知时保持未知，不伪造100%。
- Debug renderer读取running／started／actualFps／targetFps／rawDelta／delta／实际 `_coolDown`（展示coolDown）／panicMax／raf.isRunning／raf.isSetTimeOut。不存在的字段保持undefined。最多20条wake记录，最多20个pending观察，各3个采样点，无无限增长。10s后若仍未见正常frame，继续在既有callback观察首次恢复，60s后标记expired停止观察。
- 1／5／10s采样使用既有Core callback与monotonic clock，阈值从renderer收到wake算起；同时记录OS事件timestamp、renderer receivedAt与dispatchLatencyMs。观察FPS为相邻采样区间Core callbacks/sec；Phaser actualFps单独展示。阻塞后只能报告实际elapsed，不能重建错过的1s窗口。firstNormalFrame latency包含dispatch估算延迟；定义为首次rawDelta>0且<=25ms，不能用它代替5／10s持续恢复检查。系统墙钟调整可能影响dispatch估算。
- Core callback cadence/rawDelta是Phaser-loop诊断，未monkey-patch原生RAF，不能仅据Core FPS断言浏览器RAF是唯一原因。
- 默认backgroundThrottling:false保持；无powerSaveBlocker，无prevent-display-sleep。当前证据不足以确认App Nap，因此未加入A/B launch flag。
- WorldSave V9／IndexedDB2不变，诊断不存档。WorldHistory、disposal、City／population／physics gameplay、外交、革命25阈值／4%均不动；Save仅观察现有phase和耗时，不重写。

Electron事件与payload来源：[官方 powerMonitor API](https://www.electronjs.org/docs/latest/api/power-monitor)。Phaser实现依据本仓库安装的`node_modules/phaser/src/core/TimeStep.js`及`src/dom/RequestAnimationFrame.js`。

## 自动验证范围

- 真实安装版TimeStep初始化与resetDelta测试；重复／无效wake、allowlisted preload订阅与卸载。
- Main OS生命周期wiring、初始/变更power观察、debug off只留必要恢复事件、所有监听清理。
- 20条诊断上限、1／5／10s实际elapsed与callback FPS、snapshot隔离、无缺失字段伪造。
- wake前后V9 DTO／WorldClock／fractional carry／RNG完全不变，debug on/off实际执行步结果与same-seed digest一致。
- 既有foreground stall／后台补算／snapshot stop-and-discard及全量tests/build仍须通过。

自动验证不代表Electron锁屏、主观流畅度或Save视觉通过。

## 人工Gate（使用已有长局存档）

运行`pnpm desktop:start:debug`。不需要重新长跑3000年。

### A 正常前台

4×确认rolling FPS接近60、steps/frame约4、Core CPU正常。复制核心/全部诊断，包含power、Desktop wake/Phaser loop、foreground debt、Frame attribution、Runtime Lifetime及save phase。

### B 普通失焦

切换到其他应用1～2分钟后返回，回传1s／5s／10s实际FPS、Phaser loop、foreground debt、wake source。focus记录是观察，不会额外reset。要求不持续低FPS。

### C macOS锁屏

锁屏2～5分钟，解锁返回。完整回传：

- lock-screen/unlock-screen次数与时间、user active/inactive、resume、wake source及dispatch延迟。
- thermal状态／speed limit／battery或AC（未获通知字段如实未知）。
- Phaser running／started／RAF状态／coolDown／rawDelta／delta／actualFps。
- 1／5／10s observed callback FPS、rolling FPS、steps/frame、Core CPU、unattributed frame、foreground debt。

约10秒应明显恢复合理帧率。若仍7～20 FPS，先暂停游戏再观察10秒；paused仍低FPS会进一步证明不是simulation workload。复制完整诊断后停止，不继续猜测或改玩法。

### D 正常FPS下保存

恢复正常FPS后，对同一2000～3000+年世界手动保存一次，回传serialized bytes、safe-boundary、export/serialize、IndexedDB write、total及保存前后FPS。若7～10MB仍持续>2s，记录证据，另由用户决定是否开展独立Save Scalability；本版不提前重构。

没有实现powerSaveBlocker A/B flag，故本轮不要求E。即使未来A/B有效，也不能据此改release默认休眠语义。

## Gate后路线

只有人工确认前台／失焦／锁屏恢复均合理，才结束v27b performance audit。下一任务直接v0.99927c Dynastic Revolution Calibration：732 boundaries、stabilityEligible=0、fullyEligible=0、usurpation=0，是后续stability gate校准证据，本版绝不调整。

【等待用户人工回传 v0.99927b4 Desktop Wake & Frame Scheduler Recovery Gate；
通过前不得开始 v0.99927c Dynastic Revolution Calibration、
Diplomacy II、纳土归降、Faction Historiography 或 Era Atlas II。】
