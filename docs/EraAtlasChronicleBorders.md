# v0.99931a1 Era Atlas Chronicle & Borders

## 基线与冻结范围

初始HEAD200fe83，工作树干净，APP_VERSION v0.99931a / package0.99.123 / WorldSaveV12。

v31a地图布局、国号、城市文字、时代轴、前后切换、时代筛选、Save/Load与10时代快速切换人工正常，旧纵向时代脉络已删除。**大事→时代→对应地图的实际点击未获独立回传，本轮必须补验。**

本版只改图鉴展示与只读查询；不改SnapshotV1、WorldEra确认、canonical WorldHistory事件、国评、任何玩法或RNG。WorldSave仍V12，IndexedDB版本不变，不反填历史人口/君主。

## 实现与数据语义

- EraAtlasDialog：宽屏左侧280～310px时代大事、中间完整地图、右侧210～220px诸国统计，底部单行文字时代轴。中窄屏可打开大事，下方按需展示侧栏；窄屏统计和大事互斥显示，优先保留地图，不增加整窗滚动。
- EraChronicle / eraChronicleQuery：使用WorldHistory.getEventWindow的月份索引，每窗口200条并保留完整历史链，复用groupHistoryNarratives/getHistorySignificance；排除普通外交形成/续约/到期，不只检查importance字符串。每页10条，查看更多切换到更早一页，不积累无界DOM。游标最多保留一个分组窗口；极端同月/同group可按既有窗口语义扩展。完整月份游标不依赖数组位置，避免世界继续运行或回溯插入造成旧索引错页；已显示更早页暂不跟随新增事件，可点击回到最近大事刷新。
- 查询范围是startMonth至min(endMonth或worldMonth, worldMonth)，不查询未来。闭合时代的上限固定；时代大事属于整段历史，地图只表现capturedMonth。标题同时区分时代范围、时代确立记录和地图记录。
- 图鉴沿用shared selectedEraId；大事组件以eraId为key，切换即重置分页和展开；hydration/new-world的history reset通知也清空旧页/详情，订阅卸载时释放。只显示当前页；缺事件有明确空状态，不凑史料。
- HistoryEventDetails：原HistoryScroll的EventDetails/EventText及其辅助函数原样提取共享，避免第二套详情格式。图鉴卡片标题/详情取同一eventId/object，国家国号与颜色按event month解析；人物只使用已记录metadata/经既有formatter核验的ruler ID，不取现任君主补造。
- EraMapBorders：从analyzeEraSnapshot已解码的owners派生右/下边缘，WeakMap按快照identity缓存。同国邻格不画线，国与国边深色、国与无主边淡色；无行省/地形/全图网格。批量两条路径，底色→边界→国号→城市/首都。
- 国界开关默认开启，只是弹窗session状态，切时代保留。关闭不改变owner/palette/cities。CSS缩放与显示尺寸变化时补偿绘制线宽，约1px显示宽度；没有每帧解码、边界DOM或100时代Canvas预绘制。

## 自动验证

新增EraMapBorders.test.ts、eraChronicleQuery.test.ts、EraChronicle.test.tsx。扩展EraAtlasDialog SSR结构测试；既有国家标签、城市边界、面积、选择、20k历史索引及120时代单Canvas测试保留。

测试覆盖：仅真实国界/淡色中立边、无棋盘/重复/越界、批量绘制顺序/首都金环、开关不改冻结DTO、缓存及Save/Load重建/RNG不变；起止与worldMonth上限、分组攻城失都流亡不重复、普通外交排除、每页10条/20k世界仅查对应窗口、完整月游标在追加/回溯后不重复错页、事件月份国号、空状态及两条展开详情不串。

实际验证：

- `VITEST_MAX_THREADS=4 VITEST_MIN_THREADS=1 pnpm test -- --run`：188个文件、1192项测试全部通过。
- `pnpm build`：通过，音乐资源检查通过。
- `pnpm desktop:build`：通过，renderer/音乐资源检查与Electron编译通过。
- `pnpm desktop:compile`：独立执行通过。
- `pnpm desktop:renderer-debug-build`：待完成。
- `git diff --check`：当前通过，最终复核。

构建只有既有500kB bundle提示，本版不做无关拆包。


## 风险

三栏下的地图大小、细国界对比度、密集文字和矮屏工具栏仍需真实Chrome检查。史料窗口按既有完整月/历史组规则查询，极端同月可超过200条临时数据，但不绘制全部历史DOM。不生成逐月地图；大事发生在快照之后时，中央地图不会显示该事件后的疆域。

## 人工Gate：现有V12世界，不重新长跑

运行`pnpm desktop:start:debug`，读取现有长局。

1. **完整弹窗截图**：历史卷轴→时代图鉴，选择4626年6月起的群雄争霸时代，保持100%。左时代大事、中历史地图、右诸国统计、下时代轴都应出现，地图完整且不被压得很小。
2. **国境线截图**：开启“显示国界”，看竹、翟、秦之间的边界；关闭后边界消失而底色不变。回传一张开启国界的截图。
3. **复制2～3条大事**：逐一展开，复制年月、标题及全部详情。时间应在本时代范围，名称符合事件月份，同组战事不重复；不得误认地图是该事件当月的回放。
4. **历史时间**：检查时代开始/确立与地图记录月份是否分别标明，例如4626年6月起、4636年6月地图。回复“历史时间正常/异常”。
5. **时代同步**：下一、下一、上一，左大事、地图、诸国统计、时间轴全部同步，无旧详情残留。回复“切换正常/异常”。
6. **必须补验实际事件跳转**：关闭图鉴→历史卷轴→大事→时代，点击某条真实时代事件的“查看对应时代地图”。确认打开的就是该事件时代，不是当前/最近时代。回复“时代事件正常/异常”。缺快照应明确说明，不能借邻图。
7. **Save/Load**：保存→重载同一V12，再开该时代，地图、大事与国界可正常显示。国界开关不是存档字段，重开默认开启。回复“Save/Load正常/异常”。
8. **性能**：快速切10时代，观察卡顿、白屏、地图重绘失败、标签溢出、大事错误残留；回复“性能正常/异常”。不要求跑几千年。

自动测试不代表浏览器视觉通过。不得CLI/headless替代人工。未回传前不做SnapshotV2、V13、历史人口君主或其他后续主题。

【等待用户人工 Chrome 检查，收到用户回复前不得继续下一版本】

【等待用户人工回传 v0.99931a1 Era Atlas Chronicle Gate；收到回复前不得开始下一版本。】
