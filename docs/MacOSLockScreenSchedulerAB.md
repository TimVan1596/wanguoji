# v0.99927b5 macOS Lock-Screen Scheduler A/B

## 已记录的人工证据

本轮起点20f3efe／v0.99927b4／package0.99.107／WorldSaveV9，初始工作树干净。

b3 bounded foreground debt PASS：正常4×约60 FPS／4 steps；overload不再保存整步旧债务。

b4 Gate FAIL：正常前台约60 FPS／4 steps，debt近0、fixed CPU约1–2ms；长时间macOS锁屏后rolling FPS约22.5、frame avg44.4ms／p95 116.4ms，仍4／4 steps、fixed CPU1.74ms、低Core CPU、thermal nominal、AC。Phaser running=true／RAF running=true／isSetTimeOut=false／target60。unlock确实执行resetDelta，但随后1／5／10s callback FPS约5.7／6／14.3，focus后持续10～30 FPS。

这不是旧16-step spiral。TimeStep bookkeeping已重同步，底层cadence没有恢复。尚未证明RAF是唯一根因：unattributed包括render／WebGL／compositor／React／GC／OS调度，不能称为实测renderer CPU。b4遗漏的关键控制——低FPS时暂停世界10秒——本轮必须补做。

## 两个独立实验

| 模式 | scheduler | app suspension blocker |
| --- | --- | --- |
| A（已有b4结果） | RAF | OFF |
| B | RAF | ON / prevent-app-suspension |
| C | SET_TIMEOUT | OFF |

- `--wanguoji-prevent-app-suspension`仅在desktop debug launch且显式提供时启用。Main singleton owner只调用`powerSaveBlocker.start("prevent-app-suspension")`，id0也有效，重复start不创建第二个resource，actual will-quit时stop。诊断记录id／isStarted／requested／startReason／错误（如有），不凭flag假称ON。
- [Electron官方语义](https://www.electronjs.org/docs/latest/api/power-save-blocker)：prevent-app-suspension保持应用不被系统暂停，允许屏幕关闭；会改变系统节能／休眠行为，所以只用于显式debug A/B，不作为release默认。不使用prevent-display-sleep。
- `--wanguoji-force-timeout-loop`同样要求desktop debug。Main仅将allowlisted固定参数传入sandbox preload；contextBridge提供不可变启动metadata，Web query不能启用该实验。Game创建前merge `fps:{target:60,...existingFps,forceSetTimeOut:true}`，保留所有已有FPS字段，不runtime切换。
- 使用安装版Phaser3.55.2原有TimeStep／RequestAnimationFrame runner的timeout分支。没有monkey patch、第二game loop、setInterval simulation或physics调整。源码：`node_modules/phaser/src/core/TimeStep.js`及`src/dom/RequestAnimationFrame.js`。
- 两flag可显式同时提供，但首轮Gate不这样做。flag本身不打开debug；普通release／普通desktop debug默认仍RAF＋OFF。
- 保存现有b3／b4、power／wake／save／Runtime Lifetime诊断。scheduler同时显示requested启动模式与observed实际`raf.isSetTimeOut`，缺失观察保持unknown。继续显示actualFps／rawDelta／delta／targetFps／RAF状态。
- 为paused控制新增最近1s Core callback FPS，最多300 timestamps，在既有Core callback内采样，世界暂停也保留；不创建timer，不代表直接测量renderer CPU或原生RAF。wake的1／5／10s区间FPS、rolling300-frame FPS、近期1s FPS分别标注窗口。

WorldSave保持V9／IndexedDB2；启动metadata、blocker及诊断不入存档、不消耗RNG。SimulationDriver bounded accumulator／16-step cap／physics／WorldHistory／population／City／Dynasty／外交／革命参数／历史保留／renderer默认模式全不改。Save只继续观察已有耗时，无重构。

## 自动验证范围

默认、独立B／C及联合flags；release不被单独实验flag启用；preload allowlist与不可变metadata；blocker单次start／id0／shutdown；Game构造前merge；安装版Phaser runner实际选择RAF或timeout。同样callback输入下现有SimulationDriver执行步／WorldClock／WorldRandom／same-seed digest及V9 DTO一致。真实OS callback时间可能不同，不保证同样现实时间下两实验产生相同世界进度。b3与b4回归保留，全量tests/build通过仍不等同实机Gate通过。

## 启动方法

已有b4 A基线可以直接使用，不要求重复30分钟。先用正常退出流程关闭旧Electron进程，再运行B；单实例会将新启动请求交给旧窗口，旧Game的scheduler不会切换。

B：

```bash
pnpm desktop:start:debug:blocker
```

只有B持续低FPS且完成paused对照，才正常退出并重新启动C：

```bash
pnpm desktop:start:debug:timeout
```

两个脚本内显式放置flags，避免依赖pnpm参数透传规则。等价方式为先完成debug renderer build和desktop compile，然后直接启动：

```bash
pnpm exec electron desktop/dist/main.js --wanguoji-debug --wanguoji-prevent-app-suspension
pnpm exec electron desktop/dist/main.js --wanguoji-debug --wanguoji-force-timeout-loop
```

这两条是独立启动选项，不连续运行两个进程。没有自动视觉验收或headless长局替代。

## Stage B（RAF／blocker ON）

加载现有长局，4×运行，诊断确认`frame scheduler: RAF`、`app suspension blocker: ON / prevent-app-suspension`、`isStarted=true`。记录正常前台基线。

macOS锁屏至少15～20分钟，返回后回传：

- power／lock／unlock／thermal／speed limit／AC或battery、blocker id与状态。
- Phaser loop／RAF状态、wake source与before状态、unlock后1／5／10s callback FPS及实际elapsed。
- rolling FPS／avg／p95、最近1s observed callback FPS、rawDelta／delta。
- steps/frame、foreground accumulator／cap／dropped debt。
- Core CPU／fixed CPU／presentation CPU／unattributed frame，以及Runtime Lifetime。

若恢复约60 FPS：记录“blocker A/B positive”，立即停止，不做C，等待用户决定产品策略；不把blocker变成release默认。

若持续明显低FPS：**使用现有游戏暂停按钮，暂停世界10秒，保持Phaser loop运行。**回传暂停前后FPS、rawDelta、最近1s observed callback FPS、Core CPU、fixed CPU、presentation CPU、unattributed、running状态及完整诊断。

- paused仍约20 FPS：进一步排除simulation workload。
- paused迅速恢复约60 FPS：不能直接归因于纯RAF，应记录需要重新审阅simulation/render interaction，不调整玩法。

完成此对照后才退出B、启动C。

## Stage C（SET_TIMEOUT／blocker OFF）

重新启动独立C，加载同一长局，确认`frame scheduler: SET_TIMEOUT`、`raf.isSetTimeOut=true`、blocker OFF。同样4×，锁屏至少15～20分钟后回传与B相同数据。

若仍低FPS，再做相同暂停世界10秒对照。Save／Load正常性和现有Save phase数据继续记录，但本版不重写Save；当前正常FPS下保存耗时合理，异常低FPS时4MB／1.35s不足以证明独立Save问题。

## 判读与停止

- B成功：blocker A/B positive，停止等待用户产品策略。
- C恢复而RAF不恢复：只能称“证据支持RAF/compositor scheduling为主要变量”，不自动改release为timeout。
- blocker与timeout均无效、且paused也仍低FPS：记录“macOS lock-screen / Electron renderer scheduling known limitation”，结束v27b性能审计，不做b6。
- 任一实验崩溃或发现regression，完整回传状态与错误，不冒称Gate成功。

人工结果回来后再决定产品策略／限制记录；下一版本进入v0.99927c Dynastic Revolution Calibration，本轮不提前调整732 boundaries／stabilityEligible=0的门槛证据，也不自动开发下一版本。

【等待用户人工回传 v0.99927b5 macOS Lock-Screen Scheduler A/B Gate；
收到人工结果前不得开始 v0.99927c、
Diplomacy II、纳土归降、Faction Historiography 或 Era Atlas II。】
