# 1. 项目定位

万国纪 · Wanguoji 是一个极简的自主历史/政权演化沙盘。

项目最初基于 open-block-war 改造，但目前已经发展为独立的单机历史模拟游戏。当前核心体验是：玩家可以完全旁观世界自行发展，也可以以上帝身份干预。

当前世界能够发生：

- 人口增长
- 领土扩张
- 战争
- 城市攻防
- 首都迁移
- 亡国
- 流亡
- 复国
- 王室继承
- 动态叛军
- 帝国分裂
- 多次统一
- 新城市建立
- 城市毁灭
- 长期世界循环

项目仍然坚持个人项目路线：简单、可玩、易继续开发，不追求复杂经济、外交、科技或真实历史复原。

# 2. 当前版本

当前稳定版本：

- 万国纪 · Wanguoji v0.9995
- `package.json`: `0.99.14`

最近几个仍影响当前架构的版本：

- v0.95：引入长期世界循环，包括 `WorldPhase`、多次统一 / 分裂、`ImperialStrain`、`Empire Split`、城市破坏度、城市永久毁灭、`ArchivedCities`、自然建立新城。
- v0.96：修复动态势力 registry crash，建立 `RuntimeFactionRegistry` 与 frozen config / Redux state 分离；增加 simulation smoke test、`WorldInvariant`、君主 `RulerChronicle`、城市列表。
- v0.961：修复城市点击生命周期，改为 map-level click resolver；统一 City Zone 外轮廓视觉；取消 founder 主边框；修复城市列表定位导致地图 zoom 改变的问题；简化历史筛选。
- v0.962：修复城市真实命名，禁止用户可见的 `新城6` 这类数字占位名；保护战国七个历史都城不可永久摧毁；增加 City Zone overlap / gap 防护；修复 runtime faction 国祚继承错误。
- v0.963：改善长局观看体验与历史可信度；城市列表选择不再移动镜头；增加天下势力列表；显示君主代数和月份级在位时长；修复 runtime faction 历史颜色；HistoryScroll 分批渲染；义军可见名去数字 suffix；降低连续君主战死链。
- v0.964：修复 EXTINCT 后 heir 仍被当成在位君主的问题；明确 RulerChronicle 只属于正式即位 ruler；新增 CityInteractionIndex 作为独立 grid 点击索引；势力详情增加返回列表。
- v0.965：修复 Phaser Scale.FIT / DOM canvas 缩放偏移下城市点击坐标换算；增加 dev-only City Click Probe；提升地图城市名可读性；HistoryScroll 默认压缩亡国/流亡链叙事；审计 EXILED heir；君主姓名生成加入少量双字 given name。
- v0.97：实现政权身份与国号演变；`Team.name` 继续作为不可变 factionId，新增 `displayName` / `identityStage` / `nameHistory`；真正 rebel-origin faction 长期稳定后可在同一 faction 上正式建国并获得国号；历史卷轴按事件月份解析当时名称。
- v0.971：改善势力档案与历史可读性；【政权】历史筛选只显示重大政权事件；新增 faction origin 元数据、SPLIT 临时政权建国、创建链叙事压缩、王室 master-detail、趋势坐标/重大事件节点、势力大事记和重要君主标签。
- v0.972：势力档案稳定性与精选历史 hotfix；修复 runtime faction 同步时 selection fallback 到“秦”；FactionDetails 改用安全数据 helper；HistoryScroll 默认【精选】；新增 significance 分级和轻量 `historyGroupId` 聚合。
- v0.973：Faction UI 稳定性与政权称谓 hotfix；修复 FactionDetails Hooks 顺序崩溃；左侧势力排行只显示 ACTIVE faction；PROVISIONAL ruler 称“首领”，STATE ruler 称“王”；建国事件表达定国号和称王；未建国势力概况显示轻量建国条件。
- v0.98：王权、帝权与政权合法性；新增 `sovereigntyRank` / `sovereigntyHistory`，支持 `LEADER -> KING -> EMPEROR`；强盛王国可称帝；never-formal provisional 失败后解散且不进入长期档案；帝国获得有限合法性 bonus；称谓和战死保护按历史 rank 解析。
- v0.981：王朝史书与历代名君；新增正式王/帝死后谥号与稀有庙号评定、历代名君、国势页、势力视角大事记、王室 inline accordion、覆灭叙事修复、王国/王朝称呼和同名政权档案区分。
- v0.982：势力档案精修与王朝表达；势力概况改为 summary + 身份沿革 / 当前国势 / 王朝记忆分区；王国显示帝号资格进度；谥号 soft dedupe；runtime 姓氏和国号候选扩展；王室列表显示在位时长 / 结束原因 / 事实标签；KING / EMPEROR 战死增加战场语境 gate。
- v0.983：史书正确性与长局运行；修复势力国势大事记征服者 / 被征服者视角颠倒；势力大事记先聚合同一 causal chain 再按 faction 视角格式化；身后名保存规则原因并增加少量悲剧性谥号；正式国号和同 Dynasty ruler givenName 更优先全史避重；WorldHistory 增加排序缓存和 faction 查询索引；后台 tab 运行完成架构诊断，避免只补月份造成 simulation/physics 状态分叉。
- v0.99：WorldEra · 天下时代；新增独立 `WorldEra` 历史叙事层，与 `WorldPhase` 分离；支持群雄争衡、双雄争霸、霸天下、王朝、一统和天下再裂；Era archive 按候选持续 / hysteresis 确认并 snapshot 名称；历史卷轴增加 Era 时间筛选和时代路线；WorldHistory 增加按世界月范围查询。
- v0.991：历史 UI 稳定性与 2000 年长局性能；FactionDetails 历代名君补年代并去掉重复姓名 / 空标签；HistoryScroll 顶部改为 compact tabs + 稳定 Era picker + 默认收起时代脉络；WorldEra 合并相邻同名同类型 Era，并用“格局确立，追溯始于……”解释 retrospective start；新增 dev-only LongRunProfiler；活世界循环减少 EXTINCT archive 扫描。
- v0.992：时代整流与王朝观赏性；ruler 自然寿命改为人物创建时确定，继位不再重抽任期，未即位 heir 也会自然死亡；WorldEra 普通候选确认 / 最短持有时间整体拉长，DUAL_RIVALRY 使用无序 pair identity，短命帝国不自动形成 X朝 Era；HistoryScroll 时代脉络改为带年代的纵向 compact timeline；新增极少数 Chapter Banner；势力列表强化临时政权 / 王国 / 帝国显示。
- v0.993：王朝周期与排行榜可读性；新增轻量 WorldCyclePressure，让分裂 40～80 年后稳定领先正式国家更容易整合天下，统一初期获得有限 grace，80 年后逐步进入 dynastic fatigue；该压力只影响现有 rebellion / ImperialStrain modifier，不用固定计时器强制统一或分裂；LongRunProfiler 补周期诊断字段；左侧势力排行重排 identity / 数字列，修复短国名被 ellipsis 和竖排 badge 挤压问题。
- v0.994：王朝秩序与史学判定校准；新增 `ReignOutcomeRules` 作为 RulerChronicle 标签和史评的唯一国势方向判定，修复领土增长却写成衰退；WorldCycle 支持 60%+ 领土 / 55%+ 城市的事实 dynastic order，小义军不立即打断统一秩序；称帝门槛提高到 20 年王国史、50% 领土 / 城市、70 稳定、领先 15pp 且连续 60 月；帝统奖励增强但保留崩解压力；WorldEra 改成约 30 年历史章节；身后名降低“在位长”权重；runtime Dynasty 姓氏生成抽成 `DynastySurnameGenerator`；左侧排行数字列继续修正对齐。
- v0.995：强权形成与时代章节；新增 `HegemonicMomentum`，正式王国 / 帝国长期领先后逐步获得有限城市围攻和占领整合优势；补充 state formation blocker 诊断与长期弱小 PROVISIONAL 衰亡压力；MULTIPOLAR WorldEra 保存 top3 主导集团 snapshot，长期“群雄争衡”在主导集团换代时可分章；LongRunProfiler 增加 momentum、siege multiplier、临时政权卡点和 overage provisional 诊断。
- v0.996：世界收敛与命名一致性；新增 `CityNameRegistry`，初始 / active / archived 城市名在同一 world session 内统一保留，动态建城不再复用已用名；`CityNameGenerator` 改为多 family 候选和 recent suffix cooldown；WorldCycle 增加 `Consolidation Leader` 阶段，让长期分裂中约 20% 第一强国获得轻量破局势能；修复 History Era picker 只剩“全部时代”的 initial Era / selection 稳定问题；新增 initial faction exposure 纯诊断 helper。
- v0.997：天下占比语义与收敛指标校准；新增 `TerritoryMetrics`，拆分 `absoluteWorldShare`（控制格子 / 固定世界格子）与 `controlledTerritoryShare`（控制格子 / 当前 ACTIVE faction 控制格子总和）；WorldCycle / Consolidation Leader / HegemonicMomentum / Dynastic Order / WorldEra / 称帝资格使用 controlled share，RulerChronicle / ReignOutcomeRules / 趋势图继续使用 absolute/raw territory；FactionSnapshots 保存双指标；WorldEra MULTIPOLAR 章节保存 `cohortLabelSnapshot`，History 时代脉络可显示“秦 · 赵 · 燕主导”；LongRunProfiler 增加 neutral / controlled blocks 和 top1/top2 share 诊断；仅记录 Background Logical Simulation 架构清单，未实现 hidden-tab catch-up。
- v0.998：Simulation Driver · 后台世界架构第一阶段；新增 `SimulationDriver`，前台 `Core.update(delta)` 改为 fixed-step accumulator 后调用 `AutoSimulator.advance(simulationDeltaMs)`；driver 提供 background debt / cap / catch-up chunk 的纯规则 seam；hidden catch-up 尚未启用，因为 Player movement、Arcade Physics、Player vs Block collision、Block occupation、City siege contact、battle / ruler battle interaction 仍由 Phaser frame / physics callback 掌权，不能只补月份或政治事件；本版不改变 v0.997 gameplay balance。
- v0.999：Logical Simulation Phase 2；新增 `LogicalUnitState`、`LogicalUnitRegistry`、`LogicalMovementSystem`、`LogicalSpatialIndex`、`LogicalOccupationSystem` 和 `LogicalSimulationCore`。单位 authoritative position / velocity 进入纯 logical state，`Core.update(delta)` 的 `SimulationDriver` step 先推进 logical movement、grid occupation、siege contact，再推进 `AutoSimulator.advance()`；Player 视觉从 logical state 同步。旧 Phaser Player-vs-Block collider callback 在 logical authority 开启时不再提交 gameplay，避免双触发。源码未发现独立 Player-vs-Player battle callback，本版不发明新 battle 规则；background catch-up 继续 NOT ENABLED，等待更完整 parity 和 battle extraction。
- v0.9991：Logical Simulation Parity Hotfix；用户真实 Chrome 验证发现 v0.999 前台 1x 速度变慢且地图快速马赛克化。根因是 v0.999 前台清零 Phaser body velocity 并改用 logical grid movement / occupation，而旧 v0.998 的 movement 和 occupation 实际由 Arcade body px/s velocity、collider physical response、separation / bounce 和 `Core.onPlayerOverlapBlock -> Block.setTeam` callback 共同定义，两者 contact semantics 不等价。本版将 `logicalGameplayAuthority` 默认关闭，恢复前台 v0.998 Phaser path；保留 logical 模块并增加 one-second movement、grid mapping、ordinary occupation entry、siege contact month dedupe 测试。background catch-up 仍 NOT ENABLED。
- v0.9992：Unified Simulation Driver Phase 3；继续保留 v0.9991 已验证正确的 Phaser Arcade Physics gameplay authority，但通过 `ArcadePhysics.disableUpdate()` 关闭 Scene UPDATE 自动 `World.update`，由 `SimulationDriver` fixed step 手动调用 `physics.world.update(time, fixedDeltaMs)`，然后继续让 Phaser POST_UPDATE 调 `World.postUpdate` 同步 body 到 GameObject。新增 `BASE_PLAY_RATE = 1.5`，调速通过 driver accumulator gain 完成，fixed dt 和 gameplay 参数不变。background catch-up 仍 NOT ENABLED，等待真实 Chrome 验证 foreground parity。
- v0.9993：Physics Step Lifecycle Stabilization；用户真实 Chrome 验证发现 v0.9992 的 2× / 4× 体感接近 1×。源码确认 `Body.preUpdate()` 每次 `World.update()` 都会从 GameObject 同步 body position，而 `Body.postUpdate()` 只在 Scene POST_UPDATE 把结果写回 GameObject；同一 render frame 多次 `World.update()` 会覆盖前面 step 的 body 位移。本版改为同帧首个 fixed step 调 `World.update(time, fixedDeltaMs)`，后续 fixed steps 调 `World.step(fixedDeltaSeconds)`，仍由自动 POST_UPDATE 统一 `World.postUpdate()`。`MAX_FOREGROUND_STEPS_PER_FRAME` 提高到 16。background catch-up 仍 NOT ENABLED。
- v0.9994：Background Progression · 历史追赶；用户真实 Chrome 验证 v0.9993 前台 1× / 2× / 4×、movement、collision、occupation 已恢复稳定，因此本版不再重启 v0.999 的 simplified logical grid authority。新增 `BackgroundProgressionController`：hidden 时记录 real timestamp、切走时 speed、paused 和 worldInstanceId；visible 后按 `elapsedRealMs * BASE_PLAY_RATE * hiddenSpeed / SIMULATION_FIXED_STEP_MS` 计算 fixed-step debt，并用同一个 `Core.advanceLogicalStep()` 分块追赶。每个恢复后的 render frame 继续使用 v0.9993 生命周期：首步 `World.update()`，后续 `World.step()`，POST_UPDATE 仍由 Phaser 自动 `World.postUpdate()` 统一 flush。catch-up 期间批量通知 WorldHistory / WorldEra，ChapterBanner 最多补播 3 个高优先级 landmark，overlay 轻量显示进度。当前能力已实现但必须等待真实 Chrome 人工验证。
- v0.9995：Electron Desktop Background Probe；用户真实 Chrome 已验证 v0.9994 Web return-time catch-up 能推进世界。本版新增独立 `desktop/` Electron shell，不复制 gameplay 源码，renderer 加载同一份 Vite / dist frontend。Electron BrowserWindow 使用 `webPreferences.backgroundThrottling=false`、`nodeIntegration=false`、`contextIsolation=true`；preload 只暴露 `window.gridGodDesktop` 和低频 heartbeat。新增 runtime mode：Web 继续 `WEB_CATCH_UP`，Electron 为 `DESKTOP_CONTINUOUS`，Electron visibilitychange 不创建 catch-up debt，恢复时也抑制首帧巨大 delta，避免用 v0.9994 catch-up 掩盖 Electron 后台失败。当前是 feasibility probe，必须等待真实 Electron 最小化人工验证。

不需要从 v0.1 重新理解全部历史，但要知道：项目已经从早期直播弹幕游戏演化成离线单机历史沙盘。`Live/Bilibili`、`Live/Douyu` 等旧目录可能仍在源码中，但当前主体验不依赖真实直播平台。

# 3. 当前游戏入口

当前开始菜单主要入口：

- 战国七雄
- 自定义世界

战国七雄初始国家：

- 秦
- 赵
- 燕
- 齐
- 魏
- 韩
- 楚

战国七雄历史都城：

- 秦：咸阳
- 赵：邯郸
- 燕：蓟
- 齐：临淄
- 魏：大梁
- 韩：新郑
- 楚：郢

这些战国初始都城目前带有历史城市保护元数据：

- `isHistoricCity`
- `isIndestructible`

它们可以被围攻、攻陷、易主、失去首都身份、积累 devastation，但不会进入永久毁灭并从地图消失。

# 4. 当前主要架构

以下是当前源码中的主要概念。接手时仍要以源码为准，不要只凭本文猜实现。

## Game / Core

`src/Game/Core.ts` 是当前运行时核心协调器。

主要职责：

- 初始化 Phaser map / teams / cities。
- 持有 runtime faction registry。
- 启停世界、暂停 / 倍速。
- 处理 selected faction / selected city。
- 处理 map-level city click / hover resolver。
- 协调 `AutoSimulator`、玩家、地图、城市、历史和 UI 状态。
- 注册 runtime faction 的物理碰撞。
- 执行开发期 `validateWorldState`。

`Core.teams` 现在应视为 runtime registry 的只读快照，而不是可以随意 push 的配置数组。

## Team

`src/Components/Team.ts` 是势力 / faction 的运行时对象。

关键内容：

- `name`
- `color`
- `status`: `ACTIVE | EXILED | EXTINCT`
- `factionType`: 常规国家 / 叛军 / 边境势力等
- `users`
- `players`
- `blocks`
- `cities`
- `rulerUser`
- lifecycle 字段：`firstFoundedYear`、`currentActiveSinceYear`、`lastExiledYear`、`restorationYears`、`extinctionYear`、`cumulativeActiveYears`

注意：很多字段名仍叫 `year`，但当前时间单位已经是 `worldMonth`。

`Team.isDie` 仍作为旧 API 兼容 getter 存在，语义是：

```ts
isDie = status !== ACTIVE
```

新逻辑应优先使用 `FactionStatus`。

## User

`src/Components/User.ts` 是玩家 / 单位的逻辑实体。

关键内容：

- `username`
- `team`
- `player`
- `loyalty`
- `role`: 普通单位或 ruler
- `rulerId`

单位死亡、投靠、迁移、回城等逻辑大多仍围绕 `User` 和 `Player`。

## Player

`src/Components/Player.ts` 是 Phaser 显示 / 物理对象。

当前 Player 视觉包含：

- 灰白主体头像
- faction color ring
- ruler crown marker

Player 负责移动、碰撞、显示、角色标记和销毁。

## Block

`src/Components/Block.ts` 是地图格子。

当前重要点：

- `Block.city?: City`
- `Block.setTeam(team, player?)`
- 如果格子属于城市防御区，敌军进入时不会直接占地，而是调用 `City.registerSiegeContact`。
- 城市点击不再依赖单个 Block 的 Phaser interactive 生命周期，而由 Core 的 map-level pointer resolver 根据 canvas-local pointer -> world coordinate -> grid coordinate -> CityInteractionIndex 解析。

## City

`src/Components/City.ts` 是城市实体。

城市现在是长期存在的战略节点，`fortifiedCells` 只是城市占据的地图区域。

核心字段包括：

- `id`
- `name`
- `founderFactionId`
- `ownerFactionId`
- `block`
- `fortifiedCells`
- `isCapital`
- `isHistoricCity`
- `isIndestructible`
- `defense`
- `maxDefense`
- `loyalty`
- `devastation`
- `captureCount`
- `history`

城市攻防、占领、迁都、亡国、复国、毁灭 / archive 都围绕 City 展开。

## Simulation

主要模块：

- `WorldClock` / `WorldTime`：当前权威时间为 `worldMonth`，提供年月格式化 helper。
- `PopulationSystem`：自然人口增长、初始人口生成，继续复用弹幕生成链路。
- `WorldEventSystem`：随机事件、复国、叛乱、Empire Split、世界统一 / 分裂、自然建城、城市生命周期入口。
- `RuntimeFactionRegistry`：独立 runtime mutable faction collection，避免修改 Redux / Immer frozen config array。
- `FactionRegistry`：创建 / 恢复 runtime faction，包括 rebel、frontier、split faction、新城市等。
- `StateNameGenerator`：义军正式建国时生成古风国号，禁止数字 fallback。
- `WorldPhase`：群雄割据、多国争霸、双雄对峙、天下一统、帝国分裂等叙事阶段。
- `WorldEra`：长期历史时代 archive。它是 derived historical layer，不驱动 simulation；每世界月按 ACTIVE factions 当前实力 O(active factions) 评估，普通 Era 需要持续成立，统一 / 帝国大分裂可作为 landmark override。
- `ImperialStrain`：大帝国统治压力。
- `CityLifecycle`：城市 devastation、恢复、永久毁灭判断等。
- `ArchivedCities`：当前 session 内存中的已毁灭城市档案。
- `WorldRemnants` / `WorldExiles`：残部和流亡状态。
- `FactionLifecycle`：ACTIVE / EXILED / EXTINCT 状态切换和国祚累计。
- `FactionIdentity`：不可变 factionId 与可变 display identity 的轻量规则，包括 `displayName`、`identityStage`、`sovereigntyRank`、`sovereigntyHistory`、`nameHistory`、origin、建国 / 称帝资格和 identity invariant。
- `HistorySignificanceRules` / `FactionEventRelation` / `FactionHistoryFormatter`：统一定义重大政权事件、势力事件关系和势力视角叙事，供历史筛选、国势大事记和趋势 marker 复用。
- `FactionDetails/model`：势力档案展示数据 helper，避免 UI snapshot 缺字段或缺 Team 原型方法时白屏。
- `RulerSignificanceRules` / `PosthumousRules`：确定性识别开国、称帝、复国、一统和长治开疆类重要君主；正式王/帝在统治结束后才评定谥号，庙号更稀有且同 Dynasty 去重；v0.982 起谥号对最近 Dynasty 记忆做 soft dedupe；v0.983 起身后名保存结构化原因，并支持少量事实驱动的悲剧性谥号。
- `TrendChartRules`：势力趋势图时间/数值刻度与 marker 范围 helper，继续复用 `FactionSnapshots`。
- `FactionArchiveLabels` / `RegimeStyle`：档案层同名正式政权前后区分，以及 KING=`X国`、EMPEROR=`X朝` 的纯显示 helper。
- `RulerBattleRules`：君主战死保护规则。v0.982 起 KING / EMPEROR 普通碰撞需要亲征围城或首都危机等战场语境才进入 fatality 判定；自然死亡和被俘处死不受影响。
- `FactionSnapshots`：势力历史趋势采样。
- `WorldInvariant`：开发期世界状态一致性检查。

## Politics

主要模块：

- `Dynasty`
- `Ruler`
- `RulerChronicle`
- `ExileRules`
- `SuccessionRules`

当前王室系统是轻量级系统，不包含婚姻、后宫、王位战争或复杂宗法。

它负责：

- 创建初始王室和君主。
- 生成继承人。
- 君主自然死亡 / 战死 / 被俘。
- 流亡王室继承。
- 复国后恢复 current ruler。
- 为君主记录 `RulerChronicle`，包括统治期间人口、领土、城市、稳定度变化以及重要事件。

## History

`src/History/WorldHistory.ts` 是统一历史事件系统。

`WorldEvent` 结构化保存事件，不应只依赖 title string。

事件通常包含：

- `id`
- `year` / `monthIndex`
- `type`
- `category`
- `title`
- `description`
- `importance`
- `actorFactionId`
- `targetFactionId`
- `previousOwnerFactionId`
- `conquerorFactionId`
- `founderFactionId`
- `cityId`
- `rulerId`
- `relatedFactionIds`
- `metadata`

注意：字段名 `year` 在很多事件中实际保存的是 worldMonth。

## UI

主要 UI 结构：

- 左侧：紧凑 faction ranking。
- 中间：Phaser 世界地图。
- 右侧：`历史 | 势力 | 城市 | 上帝` 四个 tab。
- `HistoryScroll`：历史卷轴，当前筛选为 `全部 / 战争 / 政权 / 上帝`；灾害事件仍出现在全部里。
- `FactionDetails`：势力详情、趋势、王室谱系和君主传记。
- `CityDetails`：无选中城市时显示天下城市列表；选中城市时显示城市详情；可查看 active city 或 archived city。
- `God controls`：上帝援军、复国、煽动叛乱、旧文本命令等。
- `WorldControlBar`：暂停 / 继续、1x / 2x / 4x、新世界菜单。

# 5. 关键数据流

## 单位生成

当前仍然尽量复用早期弹幕链路，不直接绕开核心规则。

典型路径：

```text
Local / God / simulation event
-> createLocalDanmu
-> Danmu.Apply
-> Team lookup
-> Team.makeUser
-> User
-> Player
```

自然人口、上帝援军、随机事件给人口，都应优先走这一条链路。

## 城市攻城

当前城市防御区不是普通领土格。

典型路径：

```text
enemy Player enters fortified cell
-> Block.setTeam detects block.city and enemy owner
-> City.registerSiegeContact
-> City.updateDefense / updateSiege
-> city-level siege damage by world time
-> defense decreases
-> City.capture when defense <= 0
-> owner / loyalty / capital / lifecycle / history update
```

不要把攻城重新改回 physics collision 高频直接 `defense--`。

## 动态势力

动态势力可能来自：

- 旧国复国
- 城市叛军
- 边境势力
- Empire Split

典型路径：

```text
WorldEventSystem
-> FactionRegistry / RuntimeFactionRegistry
-> runtime Team
-> Core.addRuntimeTeam
-> physics collider registration
-> UI ranking
-> PopulationSystem
-> WorldEventSystem
-> WorldHistory
```

禁止向 Redux / Immer frozen initial team array 直接 push。

## 王室

典型路径：

```text
Dynasty
-> current ruler
-> ruler User / Player
-> succession
-> exile / capture / restore
-> RulerChronicle
-> WorldHistory
```

流亡政权不能无限凭空生成继承人。EXILED 后只允许已有合法 heir / claimant 延续。

# 6. Faction 生命周期

当前核心状态：

```ts
ACTIVE
EXILED
EXTINCT
```

语义：

- `ACTIVE`：至少拥有 1 座 active city。
- `EXILED`：没有城市，但仍有实际复国力量，例如 remnants / claimant / exile state。
- `EXTINCT`：没有城市，也没有有效复国条件。

兼容字段：

```ts
isDie = status !== ACTIVE
```

但新代码应优先使用 `status`，不要再用 `isDie` 推导复杂政治语义。

复国与新势力不同：

- 复国：恢复旧 faction identity，保留原 `firstFoundedYear`、Dynasty、历史、颜色等；`currentActiveSinceYear` 更新为复国月份。
- 新 rebel / split / frontier faction：创建全新 runtime Team；`firstFoundedYear = current worldMonth`，不能继承母国国祚。

# 7. City 生命周期

城市核心身份：

- `founderFactionId`：原始创建 / 初始归属，永久不变。
- `ownerFactionId`：当前控制者，可因战争、复国、叛乱、分裂改变。

城市区域：

- `fortifiedCells` 是城市防御区。
- 任意 fortified cell 都应 `block.city === city`。
- defense > 0 时，防御区锁定为当前 owner，敌军进入只触发 siege，不直接改格子 owner。
- defense <= 0 后，整片防御区原子化易主。

城市属性：

- `defense`
- `maxDefense`
- `loyalty`
- `devastation`
- `captureCount`
- `history`

城市状态：

- active city：仍在地图上。
- archived destroyed city：已永久毁灭，从 active registry 移除，但历史档案保留。

历史城市保护：

- 战国七都为 `isHistoricCity` / `isIndestructible`。
- 它们 devastation 可上升，但不会永久毁灭。
- 普通新城在 devastation 达到阈值且满足 active city 数量保护条件时可以毁灭并进入 archive。

自然建城：

- 使用 `CityNameGenerator`。
- 禁止数字占位名。
- active + archived city 名称不得重复。
- 建城前使用 City Zone spatial validation，防止 fortified zone overlap，并保留最小 gap。

# 8. 时间

当前唯一权威模拟时间是：

```ts
worldMonth: integer
```

换算：

- `worldMonth = 0` -> 纪元 0 年 1 月
- `worldMonth = 11` -> 纪元 0 年 12 月
- `worldMonth = 12` -> 纪元 1 年 1 月
- `worldMonth = 39` -> 纪元 3 年 4 月

统一 helper 位于 `WorldTime` 相关模块，例如：

- `getWorldYear`
- `getWorldMonth`
- `formatWorldDate`
- `yearsToMonths`
- `monthsToYears`

现实速度：

- 1x：约 1 现实秒 = 1 世界月
- 2x：约 1 现实秒 = 2 世界月
- 4x：约 1 现实秒 = 4 世界月

注意：源码中仍有部分变量 / 参数名叫 `year`，但值已经是 `worldMonth`。修改时必须确认真实语义。

# 9. 当前测试

常用命令：

```bash
pnpm test
pnpm build
```

当前 v0.9995 自动测试结果：

- `pnpm test`：通过。
- `pnpm build`：通过。
- `pnpm desktop:build`：通过。

`pnpm build` 仍可能出现 Vite large chunk warning，目前不是构建失败。

如果要浏览器试玩：

```bash
pnpm dev
```

在沙箱环境下启动 dev server 可能遇到权限限制；真实本机运行时以浏览器控制台和长局观察为准。v0.9994 的 background progression 已经完成真实 Chrome 初步验证。

如果要 Electron Desktop Probe：

```bash
pnpm desktop:dev
pnpm desktop:start
```

v0.9995 Electron continuous background 必须等待用户真实 Electron 最小化人工验证；不能用 Web return-time catch-up 结果替代。

# 10. 开发原则

非常重要：

- 这是个人开发项目。
- 优先简单、快速、游戏性。
- 不追求复杂画面。
- 避免大规模重构。
- 优先复用当前系统。
- 一个版本解决一个主题。
- 每版完成后执行 `pnpm test` + `pnpm build`。
- 用户实际浏览器试玩结果优先于“代码理论正确”。
- 不允许为了快速实现新功能破坏长期模拟状态一致性。
- 动态 runtime 数据不能直接修改 Redux / Immer frozen config。
- 历史事件尽量由真实 simulation 数据生成，不使用 LLM 虚构历史。
- 不要在未确认源码当前实现前，按旧聊天记录或本文档直接改代码。

# 11. 当前已知技术债 / 风险

已知风险和注意点：

- Vite large chunk warning 仍存在。
- 长局真实浏览器测试比单元测试更重要，尤其是 4x 长时间运行。
- 动态 faction / city / dynasty / archived city 组合复杂，需要持续依赖 `WorldInvariant` 和新增测试。
- 部分旧字段仍叫 `year`，但值已经是 `worldMonth`。
- 早期 open-block-war 遗留结构 / 命名仍存在，例如部分 Live、Bilibili、Douyu、Card、paid/theme 目录；当前离线主流程不依赖真实直播平台。
- Redux / UI state 里可能持有 runtime object snapshot，但 runtime registry 必须保持独立可变集合。
- Phaser / Canvas / WebGL warning 需要结合真实浏览器控制台判断，不要只凭单元测试认为稳定。
- UI 仍是务实实现，不是完整设计系统。
- 城市、王室、动态势力都已经是长期状态对象，修 bug 时要特别注意清理旧世界状态和新世界重开。

# 12. 下一版本候选

不要直接实现。本节只是 ROADMAP。

v0.9995 已完成“Electron Desktop Background Probe”的代码实现，但仍必须等待真实 Electron 人工验证。

后续如果继续扩展，应先观察真实长局效果，再单独设计：

- 当前 simulation authority 清单如下：
  - `WorldClock` / `AutoSimulator` 推进 monthly logic，负责人口、历史观察、王朝、流亡、WorldEventSystem、WorldEra 等月级系统。
  - `SimulationDriver` 负责 fixed-step accumulator / debt；Web 前台和 Web catch-up 都调用同一个 fixed-step 入口。
  - Phaser Arcade Physics 继续掌握 Player movement、separation / bounce、Player-vs-Block contact、Block occupation、City siege contact 和现有 battle/death 触发路径。
  - v0.999 的 `LogicalUnitState` / `LogicalUnitRegistry` / `LogicalMovementSystem` / `LogicalSpatialIndex` / `LogicalOccupationSystem` 继续保留为 experimental / testable helpers，但不参与当前 authoritative gameplay。
  - Background progression 是 return-time catch-up：hidden 不持续渲染，visible 后分块补算真实 authoritative steps。
  - Electron Desktop Probe 是 continuous background 实验：Electron 模式下 visibilitychange 不创建 catch-up debt，必须用 fixedSteps / physicsSteps / worldMonth 在 minimized 期间持续增加来证明成功。
- 后续必须先等 v0.9995 Electron 人工验证，再决定 Worker Thread、Save/Continue、Public Alpha 或更深层解耦。
- Chapter Banner 已有极少数 landmark 版本，后续如需扩展必须继续保持克制，避免普通事件刷屏。
- 更深入的 2000 年性能专项仍需真实 profile 后再做；本版只做低风险 archive 扫描收窄和 dev-only stats。
- 后续可继续打磨庙号 / 谥号候选池和更多名君判定，但不要让庙号泛滥。
- 更丰富的国号来源与地域语义。
- 更完整的历史事件 historical name snapshot。

# 13. Codex 接手规则

以后新的 Codex 会话应按以下顺序接手：

1. 先读 `docs/HANDOFF.md`。
2. 再读 `README.md`。
3. 执行 `git status`。
4. 查看最近 `git log`。
5. 只阅读当前任务涉及的源码。
6. 修改前确认当前真实实现。
7. 不根据 HANDOFF 猜源码。
8. 完成后执行 `pnpm test` 和 `pnpm build`。
9. 不自动继续下一个版本。

本文档的目标是缩短接手时间，不是替代源码。若本文档与源码冲突，以当前源码为准。
