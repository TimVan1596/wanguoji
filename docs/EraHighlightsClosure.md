# v0.99931a2 · Era Highlights & Entry Consolidation

## 基线与前置人工结果

真实起始 HEAD 为 4c729da，APP_VERSION v0.99931a1、package 0.99.124、WorldSave V12。已有暂存 docs/EraAtlasChronicleBorders.md 修改予以保留。用户明确补验时代切换、对应地图实际点击、Save/Load、10时代切换性能均正常，满足本轮前置条件。

## 根因与修正

旧 eraChronicleQuery 按全局 MAJOR/LANDMARK 从最近一页取事件，普通攻城也可具有 major，不能代表整个时代。保留旧查询及回归测试，新增展示层 eraHighlights：

- 读取完整时代月份范围，截止 min(endMonth, worldMonth)，复用 indexed getEventWindow 和 groupHistoryNarratives。
- 天下统一、时代格局、称帝、篡朝优先；建国、复国、政治终结其次；真实失都、迁都和重大领土节点也可入选。普通攻城不因标题或 importance 自动提升。
- 同一战争链使用现有组合叙事；失国和几十年后的绝统仍分别记录。
- 分类别、早中晚三个阶段各保留最多10个候选，确定性权重加有限类别/阶段奖励，选取最多10件；不凑数，最后按年月倒序、eventId稳定排序。
- 完整范围分批读取，每批200条并遵循完整月份/历史组边界；缓存最多8份有限结果，按 store、revision、eraId、开始月份、查询截至月份区分。导入/重置 revision 使旧缓存失效。
- 图鉴中的“查看本时代全部历史”关闭图鉴，使用唯一 selectedEraId 选中原时代，切到全部历史，保留势力筛选；旧历史分页/阅读锚点仍由既有逻辑管理。
- 大事二级“时代”按钮隐藏；旧查询支持仍保留，遗留 UI 值回退全部大事。时代筛选、原事件和对应地图入口不删除。
- 事件实际月份晚于 capturedMonth 才显示“地图快照之后”，展开明确说明地图未反映该事件带来的疆域变化。

## 修改范围

eraHighlights.ts / 测试、EraChronicle 与组件测试、EraAtlasDialog 与组件测试、HistoryScroll/index、HistoryMajorEventFilters 展示入口、版本/package、DesktopSecurity 版本断言、CHANGELOG 和本说明。

不修改 WorldHistory canonical events、全局 HistorySignificanceRules、WorldEra 算法、Canvas 国境线、历史快照、RNG、国评、任何 gameplay 或 WorldSave V12。

## 自动验证

实际验证全部通过：

- `VITEST_MAX_THREADS=4 VITEST_MIN_THREADS=1 pnpm test -- --run`：189文件、1200项测试通过。
- `pnpm build`：通过，音乐资源校验通过。
- `pnpm desktop:build`：通过，renderer资源、音乐校验与Electron编译通过。
- `pnpm desktop:compile`：独立执行通过。
- `pnpm desktop:renderer-debug-build`：通过，renderer资源、2份debug sourcemap与音乐校验通过。
- `git diff --check`、暂存差异检查：通过。

构建只有既有500kB bundle提示，本轮不扩展拆包。新增测试覆盖普通战事排除、真实失都、早期政治事件、组合去重、终结独立、类别阶段覆盖、时间上限、缓存重载、20k事件/100时代窗口查询、RNG/档案一致、Save/Load派生结果一致、入口回退及完整历史保留。组件测试检查快照时间警示和单事件详情身份。

## 遗留风险

精选是有限的展示层摘要，权重和阶段奖励能保证不被普通攻城淹没，但选材是否代表用户实际长局仍需人工判断。超密集同月/同组窗口允许超过200条以保持分组完整，不是硬截断历史。并不生成逐月地图，也不以快照解释后续事件的土地归属。

## 人工 Chrome Gate

继续原 V12 存档，运行 `pnpm desktop:start:debug`。不需要新世界或重跑数千年。

1. 历史卷轴→时代图鉴，选择112年1月～224年7月“武霸天下”。复制左侧时代精选全部年月和标题，检查没有普通攻城刷屏。
2. 换一个有建国、称帝、篡朝或亡国的时代，复制3～5条政治转折；没有则写“本档无对应样本”。
3. 点击“查看本时代全部历史”，确认关闭图鉴并选中刚才时代，普通攻城仍可查。回复“全部历史正常/异常”。
4. 确认时代图鉴按钮保留、大事→时代二级按钮消失；大事、战争、外交、全部和时代下拉仍能用。回复“入口正常/异常”。
5. 找一条晚于地图记录月份的事件，检查“地图快照之后”及展开提示；早于或等于快照不应误标。回复“时间标注正常/异常”。
6. 下一时代→下一时代→上一时代，检查精选、地图、统计、时代轴同步。回复“切换正常/异常”。
7. 保存→读取 V12，同一时代精选、地图国号、国境线、领土比例不变。回复“Save/Load正常/异常”。
8. 快速切换10时代，无明显卡顿、白屏或旧精选残留。回复“性能正常/异常”。

自动测试不能替代这些视觉结果。等待用户人工回传 v0.99931a2 Era Highlights Gate，之前不得进入 Historical Metadata 或其他后续版本。
