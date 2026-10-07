# v0.99927d1 — History Major Events UX + Revolution Semantic Gate

## 人工基线（校准冻结）

真实起点954dcb5／v0.99927d／package0.99.110，工作树干净。目标v0.99927d1／0.99.111，WorldSave V9保持。

用户1005年新世界4×：239 boundaries／10 eligible draws／9failed／1usurpation，expected count0.50、expected per1000y约0.497、estimated interval2010.7y。已证明自然可达；不再修改概率、硬门、risk multiplier、evidence modifier或普通继承规则。

真实事件9867月（822年4月）：factionId沅陵义军，当时国号陵，陆氏→欧阳氏；被排除合法继承人沅陵义军-ruler-535，新君沅陵义军-ruler-544。CRISIS、稳定度56、minor successor95月龄＋前君战死，chance9%、roll0.0027454844675958157。本轮不制造另一次事件替代它。

## 审计与实现

HistoryScroll已subscribeRevision，数据正常动态发布；问题是发现入口与旧历史浏览反馈。保留b2增量发布、ordered/faction/month indexes与bounded windows，不重构canonical WorldHistory。

顶层大事／战争／外交／全部；更多区域保留上帝事件。大事复用isFeaturedHistoryEvent，secondary为全部大事／建国／称帝／易代／复国／亡国／归并／时代。易代只选dynasty-usurped。没有全文搜索或额外canonical分类。

queryHistoryPage继续使用最多200条的窗口（叙事组和同月完整性依既有规则可扩展），先保留原叙事合并再选secondary类型。无叙事链的建国／称帝／易代／归并可在窗口predicate提前选择，稀疏易代查询不复制所有无关历史。亡国保留capture／exile／extinction的既有grouping，无重复死亡叙事。时代、势力与类型可组合；仍提供加载更早历史。

篡朝展示为LANDMARK＋【篡朝】；此提升仅影响presentation，不改事件importance或save。标题／description仍使用canonical事件内容。新增事实详情只读metadata：前君结局、稳定度、证据、old/new house、被排除继承人及档案ID、实际国号／旗色变更。没有记录的字段不补写、不推测。

顶部32px以内跟随最新。离开顶部后冻结当前page revision，append只对当前筛选的delta进行新事件计数；不持有全历史seen-id集合。回到最新按钮显示在列表上方，不参与卡片布局；点击回顶部、清unseen并取最新页。滚回顶部也恢复跟随。旧历史加载更多保留当前页的月份上界，并用可见卡片anchor保持位置。切primary／secondary／faction／era重置条数、展开项、unseen及列表滚动。

unseen是UI会话状态，不进WorldSave／RNG。按符合筛选的append叙事计数；不同批次补充同一链不重新扫描全历史对计数去重，不把提示当canonical事件总数。

## 自动验证与边界

纯函数／store／结构测试验证类型映射、外交排除战争、亡国合并、复合筛选、5k／20k append无full-sort／full-array publish、稀疏query只拷贝匹配窗口、订阅清理、UI follow/unseen/reset模型、事实详情与V9 round-trip。模型与source wiring测试不证明浏览器真实滚动或视觉已通过。

本版不改篡朝、继承、战斗、人口、外交、WorldSave、Desktop性能、Save优化、history retention、Era Atlas II或后续玩法。2445年低FPS／unlock卡顿继续作为known performance debt，本轮不处理。

## Manual Gate — 使用现有真实事件存档

不要再跑800～1500年寻找事件。若1005年世界仍未保存，用户先保存；再加载该V9世界，用真实浏览器／原desktop环境查看。

1. 历史卷轴：清除势力限制、选择全部时代，然后“大事→易代”。应直接找到822年4月附近的陵（internal id沅陵义军）王统易代。确认陆氏→欧阳氏与【篡朝】。
2. 展开：前君战死、稳定度56、幼年合法继承人、旧合法继承人仅被排除而未死亡；国号与易帜只在真实metadata发生变化时展示。
3. 势力→王室：查找internal factionId对应当前政权；欧阳氏当前王统、陆氏历史王统、9867月epoch边界、ruler-535仍在宗谱、无假parent关系、ruler-544为USURPER，君主大事记正确。
4. 历史身份：若当月改号／易帜，前后事件名称及颜色按历史月份保持，旧记录不被当前身份覆盖。
5. 保存→重载：epoch、旧／新house、被排除继承人、历史事件、名称／颜色history均保持。
6. 4×运行几分钟：顶部新事件自动更新；向下阅读时不被新事件拉走；符合当前筛选的新事件出现“↑ N条新事件·回到最新”；点击清零并返回顶部。测试切primary／secondary／faction／era后条数、展开、scroll与unseen重置。

事件仍找不到时先确认全部时代与势力限制已清除，并回传筛选状态和事件详情，不自行调概率。所有滚动、地图颜色、谱系视觉及历史语义均由用户判断；CLI/headless不能宣布Gate通过。

【等待用户人工 Chrome 检查，收到用户回复前不得继续下一版本】
【等待用户人工回传 v0.99927d1 History Major Events + Revolution Semantic Gate；
收到回复前不得开始 Diplomacy II、纳土归降、
Faction Historiography 或 Era Atlas II。】
