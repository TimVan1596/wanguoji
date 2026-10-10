# v0.99931 — Era Atlas II

## 基线、范围与事实边界

初始HEAD 6b7c62c，工作树干净，APP_VERSION v0.99930b1、package0.99.121、WorldSave V12。v30b1人工正式PASS，Faction Historiography全系列冻结。执行期间仓库出现外部提交，保留现有工作，不回退或覆盖。

本版APP_VERSION v0.99931、package0.99.122，WorldSave仍V12，EraMapSnapshotV1结构不变。只修改历史地图派生展示和浏览。时代分类/确认、历史事件生成、世界演化、人口、外交、战争、王统、国评、合邦、纳土、复国及RNG均不改。

已有地图只冻结capturedMonth、尺寸、factionPalette、ownerRuns和cities。时代地图在确认时产生；startMonth是追溯格局起点，不能拿它冒充地图日期。本版分别写“时代范围”“时代确立记录：confirmedMonth”“地图快照：capturedMonth”。人口和当时君主没有记录，明确显示“当前快照未记录”，不用今天数据猜过去，也不生成缺失地图。

## 实现与文件

- `src/Simulation/EraAtlasLayout.ts`：只读解码ownerRuns，统计控制格数/占世界地图比例/快照城市数。比例分母固定widthCells×heightCells，单位内部0～1、展示乘100，中立地不剔除；palette中的0格成员保留。格数降序，factionId稳定并列排序。
- 同模块以迭代洪泛识别连通块，取最大块，再计算距实际边界的深度。按深度选候选，文字实测矩形必须完整落在该块内，不能跨外国或中立地；避开首都标识和其他国号，字号递减，微小/超长标签安全隐藏。大图更多标签，缩略图仅前4主要势力；同一国家不重复写在飞地上，国号宽度不超过整图35%（小图28%）。
- 派生数组按不可变snapshot identity缓存于WeakMap；读档新对象自然重算，不写存档。每国最多尝试512个内部候选点；不缓存Canvas图片、不逐帧重算。若找不到可放文字的位置，保留图例而隐藏地图文字，不牺牲事实正确性。
- `EraMapRenderer.ts`：继续Canvas格子绘制，用快照displayName/color，国号描边增强对比；保留城市位置/首都金环。没有current faction、TerritoryMetrics、users或ruler输入。
- `EraAtlasMap.tsx`：渲染effect只依赖snapshot/full，缩放仅改变CSS，不重画或重算地图；默认完整适配，按钮可切100/150/200%，放大后容器滚动。没有第二套game loop或鼠标滚轮缩放。
- `EraAtlasDialog.tsx`：同一弹窗前后导航、输入框之外左右键、关闭、绝对占比图例与横向文字时代轴。按startMonth/confirmedMonth/id排序，首末禁用，缺失地图可照常选择但不显示邻图。选中节点自动进入可视区域，原生滚轮横向移动、触摸滚动，监听器退出时清理。
- `eraSelection.ts`：继续唯一EraSelectionUIState，新增OPEN_ERA_MAP/NAVIGATE_MAP，不引入第二selectedEraId。事件有eraId时精确匹配，缺失ID不猜相邻时代；旧世界格局事件无eraId时只按真实发生月所属时代映射。
- `HistoryScroll/index.tsx`：时代脉络、时代筛选、对应事件入口与弹窗共享选择；只渲染当前选中大图和一张选中缩略图。时代轴无100张Canvas。地图导航只改时代UI状态，原战争/外交/大事/类型/势力过滤继续组合，经现有queryHistoryPage索引查询。
- `historyEventListMemo.ts`：纳入时代列表和打开地图回调，防止订阅新时代表后事件入口仍停在旧memo状态。
- 更新APP_VERSION、package、DesktopSecurity版本断言、CHANGELOG、README/ROADMAP人工状态与本文。

## 测试与自动验证

新增EraAtlasLayout.test.ts：历史国号/旗色、含中立地的格数和百分比、0格图例、并列排序、内部位置、环状领土与飞地、微小/长标签、首都避让、大小图策略、确定性、无RNG、缓存与JSON恢复一致。

新增EraAtlasDialog.test.tsx：120时代仅1个Canvas的非视觉markup结构检查、首末按钮、确立日期与快照日期、无快照不借邻图、20k世界史下组合过滤仍走bounded window。补充EraMapRenderer、eraSelection和historyEventListMemo测试。SSR仅检查结构和事实字段，未模拟浏览器视觉。

实际命令与结果：

- 针对性测试：5个文件、24项通过。
- `VITEST_MAX_THREADS=4 VITEST_MIN_THREADS=1 pnpm test -- --run`：待记录。
- `pnpm build`：待记录。
- `pnpm desktop:build`：待记录。
- `pnpm desktop:compile`：待记录。
- `pnpm desktop:renderer-debug-build`：待记录。
- `git diff --check`：待记录。

## 风险与性能观察口径

标签是有限的内部矩形布局，不是复杂GIS排版。细长疆域、长国号和首都占满的小块可能无标签，列表仍有名称/旗色/面积。城市名可能密集，需人工观察实际地图。字体度量取浏览器Canvas真实measureText，不保证各设备字体呈现完全相同。

自动测试证明缓存/结构有界，不证明切换无卡顿。需要定位性能时分别观察：首次analyzeEraSnapshot/layoutEraCountryLabels计算、renderEraMapSnapshot的Canvas绘制、React提交与布局；可在浏览器Performance/React Profiler检查调用栈，不把总切换时间全部归于解码。没有额外每帧profiler或无界图片缓存。

## 人工 Gate：直接读取现有V12长局

运行`pnpm desktop:start:debug`。不用新开局，不用再跑数千年。缺少快照直接报告“该时代无历史地图”，不从当前世界补造。

### 检查1：地图上的国号

历史卷轴→时代脉络→选多国并存时代→查看大图。观察主要国家颜色区域是否直接有国号，清晰且没有落在外国领土。请回传一张完整大地图截图。

### 检查2：领土百分比

在同一弹窗下方国家列表，复制排名前三的国家名称、占世界地图百分比、格数。观察与地图大小是否大致相符。中立地存在时各国比例之和小于100%正常。

### 检查3：前后时代

同一弹窗连续点击“下一时代→下一时代→上一时代”。核对时代名称、颜色、国号和日期同步变化。回传切换后一张完整地图截图；也可检查左右键，输入框内左右键不应被拦截。

### 检查4：横向时代轴

在大图下方左右滚动时代轴，点击明显不同的时代。地图应正确跳转，节点高亮同步。回复“时代轴正常/异常”。

### 检查5：时代事件整合

历史卷轴→大事→时代，找到时代事件，点击“查看对应时代地图”。应进入对应时代，而非最近时代或当前时代。回复“时代事件正常/异常”。原全部时代、按时代、势力、战争、外交等筛选应继续可用。

### 检查6：旧V12存档

保存→重新读取，再打开同一个历史时代。检查国号、旗色、比例、城市一致。回复“Save/Load正常/异常”。

### 检查7：性能与布局

快速切换10个时代，观察卡顿、白屏、地图未渲染、国号/城市标识遮挡和弹窗超屏；默认地图完整可见，放大可滚动查看。回复“性能正常/异常”，有问题注明时代或截图。

需要回传：国号截图、切换后截图、前三国比例/格数、时代轴、时代事件、Save/Load、性能七项。所有视觉与真实保存读取必须用户亲自检查，自动测试不代表Gate通过。

【等待用户人工 Chrome 检查，收到用户回复前不得继续下一版本】

【等待用户人工回传
v0.99931 Era Atlas II Gate；

收到回复前不得开始下一版本。】

通过前不开始v0.99931a Era Atlas Historical Metadata、Dynastic Narrative II、Ruler Political Evidence II、Restoration Audit或Initial Royal Household。
