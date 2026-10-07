# v0.99927d2 — Persistence Referential Integrity + Era Filter Hotfix

## 实际基线与人工结论

起点fa154f0／v0.99927d1／package0.99.111／WorldSaveV9，工作树干净。目标v0.99927d2／0.99.112；V9不变。

人工已通过：自然篡朝、被排除合法继承人存活、无假血缘、王统UI、unseen提示及旧陈氏／新贺氏独立树。失败：时代筛选包含叛乱建势；真实唐→夏篡朝存档因秦-city-312-2不存在于active cities，在HYDRATE_CITIES抛错，旧世界已teardown。

## 已复现的生命周期根因

真实City.updateDefense先调用updateDevastation。后者可destroyPermanently并清空fortifiedCells、归档并从team.cities删除。但updateDefense未再次检查destroyed，继续calculateMaxDefense；一旦zone tier变化就rebuildFortifiedZone，重新setCity到map blocks。结构测试对实际City方法复现：城市已destroyed但全地图仍有13个refs。

修复：updateDevastation后立即terminal return；rebuildFortifiedZone拒绝destroyed city；永久销毁除当前zone外也扫描真实地图清理同一对象的残留city／center／home指针。额外stale cells只解除指针，不推测或重写领土归属。当前zone原有claim规则保持。正常active城市防御、规模、capture／revolt／merge／人口等规则不变。

正常expand/shrink没有复现遗留引用；实测actual capture→revolt→administrativeMerge→10次capture→destroy最终全地图无该city引用。Team.removeCity只是所有权transfer时脱离原队列，不应把每次移交当永久销毁。

## 出入库完整性

exportWorldSave在生成DTO前检查现有core.allCities authority与全地图block refs：必须是同一个active city对象，且block属于该city.fortifiedCells。未知／已归档／非zone指针明确报Cannot export block reference to non-active city...／outside fortifiedCells，不sanitize。BlockSaveProjection接受active-city allowlist并拒绝不在其中的city。派生Map/Set只用于这一检查，不是第二套city truth。

strict validateWorldSave：block.cityId仅允许save.cities；archivedCities仍可用于历史事件引用。中心需要active city；capital引用active city且owner正确；zone coordinates必须对应真实block refs，无重复或不一致；block owner／city owner／founder仍走已有faction validator。几何preflight检查完整地图、整数坐标、重复坐标及当前runtime兼容性；zone reference检查集中在validator。

未知引用PRECHECK_FAILED抛错，发生在prepareForHydration之前。测试保存旧month、teams、units、cities、WorldHistory和RNG，并确认拒绝后完全保持原样。无需teardown后猜测重建。

## 极窄旧V9安全恢复

仅当非active block.cityId匹配同一存档archivedCities中的已销毁city（真实id、合法destroyedMonth不晚于存档月、foundedMonth不晚于destroyedMonth及history数组）才允许修复clone：删除cityId、isCityCenter=false、isHome=false、homeHitPoints=0（合法non-city/non-home HP）。保留block owner、所有历史、王统、谱系、RNG与其他canonical内容。不创建active city，不做schema migration。

仓库读取入口用normalization副本验证，但返回原记录；hydrator PRECHECK再normalization并正式验证。绝不写回IndexedDB原记录。下一次用户正常保存才形成干净snapshot。

debug/core-copy诊断：hydration repairs.summary=`stale archived city refs repaired: N`；staleArchivedCityBlockRefs／cityIds；unresolved refs含最多20条coordinates／owner／cityId，active/archived IDs各最多100条。每次Load重置该报告，不入save、不draw。HydrationReport也返回修复报告。

秦-city-312-2是否真在用户存档archive中尚待实际Load确认。不存在或不能证明已销毁时拒绝，不猜；当前runtime仍保持。测试的mock Phaser资源不能代替实际浏览器Save/Load地图验收。

## 时代过滤语义

时代只显示world-era-started／world-unification／world-hegemony／world-fractured。移除empire-split，因为其既有founding grouped narrative可写成叛乱建立义军，属于势力事件。canonical empire-split未删除，全部大事仍可见；不新增Tab或重构paging/index/unseen/scroll anchor。

## 自动验证

实际City生命周期全地图扫描；pre-fix monthly destruction复现；export/hydrate/export（实际persistence函数＋结构runtime doubles）active refs round-trip；archive修复后再存再读0repair；未知ref拒绝不碰旧runtime；坏capital／owner／zone／center precheck；严格exportallowlist；repair无RNG；既有same-seed tests保留。历史regression覆盖4种founding group排除、4种世界格局包含、all-major保留、paging/unseen不回归。

## Manual Gate（完成自动验证后停止）

A. 优先直接重新加载现有唐→夏篡朝malformed V9。若秦-city-312-2有明确archived记录应成功，复制repair N／city IDs，核对worldMonth、唐→夏事件、陈氏→贺氏epoch、陈翊存活、无假血缘、历史名称颜色。保存→重载，第二次repair必须为0。

B. 若不是已归档city，禁止强修；回传PRECHECK_FAILED、active／archived IDs、bad block coordinates／owner／cityId。当前正在玩的worldMonth、teams、units、cities、history应仍完整且可继续。

C. 新世界4×实际运行到一次永久城市毁灭，再保存／加载；或使用确定性测试场景复现此路径。不得再出现unavailable active city；自动结构测试不等于实机视觉通过。

D. 历史“大事→时代”只显示世界级格局／时代，不出现“大规模叛乱、建立义军”；全部大事仍可找到原事件。

E. 向下滚动并继续4×，unseen提示、回到最新及按200条加载更早历史仍正常。

所有UI、scroll、地图及真实Save/Load由用户人工浏览器验证。本轮不调篡朝概率、继承、战斗、人口、谥号／庙号、外交或后续玩法，不处理performance debt，不升V10。

【等待用户人工 Chrome 检查，收到用户回复前不得继续下一版本】
【等待用户人工回传 v0.99927d2 Persistence Integrity + History Era Filter Gate；
通过前不得开始 v0.99928 Diplomacy II、
纳土归降、Faction Historiography 或 Era Atlas II。】
