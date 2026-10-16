# Changelog

## v0.99931s · 真实旧地响应与王朝复国

- 零残部、正合法性、尚有真实合法继统者的正式流亡国家，可在合格旧都/长期统治地的既有危机窗口，转属一名三格半径内、具有有效逻辑单位的既存独立普通User恢复国统。排除君主、军政人物、活动编组成员和依附单位，不生成响应人口、不伪造残部。
- 共用原城市年度单draw、历史机会公式及9%/战乱3%单候选上限，多旧国风险不相加；保留保护期与冷却。准备人口转属先于城市易主及原占领国最后一城后果，转属失败回退；同月到寿的前君通过原死亡继位链处理。
- 复国事件明确区分旧地居民与原残部，保存实际User/逻辑单位、原占领国、当月君主/王统、历史持有及危机依据，关联同组城市事件。现有复国统计新增旧地响应漏斗，并分来源随访12/60月存续。
- APP v0.99931s / package 0.99.154 / WorldSave V15不变，已有V15可读取。r1人工Gate已PASS（90.25年会话）；本版等待用户人工Chrome/Electron Gate。

## v0.99931r1 · 长期王朝轻度残部保护

- 按用户批准B2，生产18月残部检查启用a=0.25：复用真实国家/当前王统正式在国年资，本次流亡240月内逐渐退出保护；证据不足或流亡起点矛盾时回退45%。每次仍只抽签一次，原周期、单次损耗、合法性和复国资格/概率上限不变。
- 现有王朝记忆显示保护状态、当前衰减率和剩余月份；复国统计增加真实生产检查、保护/回退/到期检查、命中、概率范围与最近3条样本。会话统计读档重置，不决定概率，不写入存档。
- 同次流亡重复通知不重置资源时钟；真实复国后再次流亡按新起点计算。保留a=0及a=0.5条件对照，不启用其他生产倍率。
- APP v0.99931r1 / package 0.99.153 / WorldSave V15不变，已有V15可继续读取；用户已明确人工Chrome/Electron Gate PASS。

## v0.99931r · 王朝真实年资与复国机会诊断（B1）

- 正式国家和当前王统年资从真实流亡/复国区间派生，排除临时政权阶段及流亡时间；证据矛盾时显示“历史证据不足”，不补造年资。流亡国家现有“王朝记忆”区域显示年资、流亡资源和真实继统主体。
- 扩展现有复国统计：资源检查、首次归零、资格阻断、真实城市draw、条件期望、执行结果和有界12/60月连续在国随访；区分会话统计与canonical历史累计。
- 新增基线/轻度/中度可运行资源对照，仅作条件模型。生产保持a=0、45%衰减和原18月周期，不调整复国概率、资格、人口、寿命或WorldSave V15。
- APP v0.99931r / package 0.99.152。用户已明确人工Chrome/Electron Gate PASS，并批准B2。

## v0.99931q2 · 军政人物伤亡选择与死亡事实归因

- 国家围城与敌对占领人口损耗改用基于势力、世界月、损耗来源、可用城市ID及当前User稳定身份的确定性排序，不依赖 `Team.users` Set插入顺序、不调用 `Math.random()`或 `WorldRandom`。两条既有损耗入口均保留原扣人口规则；敌对占领没有城市ID时不虚构城市。
- 仅在实际销毁成功时，为有界的本次会话人口审计记录受损User、可核验逻辑单位/军事人物ID、权威位置、人口前后数及触发城市。UI明确区分损耗触发城市与受损者位置，并说明位置不证明参战。该审计不写入WorldSave、不创建canonical历史事件。
- User真实销毁增加运行时幂等保护；受保护君主的既有死亡判定仍最多执行一次，失败不标记死亡。军事人物身份引用需匹配当前User、势力及有效人物记录；真实损耗后沿用既有人物死亡与编组清理流程。
- APP v0.99931q2 / package 0.99.151 / WorldSave V15。未调整围城伤害、2个月损耗间隔、单次人口扣除、人口增长、寿命、RNG算法或存档结构。普通人口自然寿命及个人守城/参战证据仍未实现。实现、验证及人工入口见[开发报告](docs/MilitaryCasualtyLifeAttributionImplementation.md)。等待人工Chrome/Electron Gate。

## v0.99931q1 · 军事指挥有效性与围城人口损耗核验

- 围城规则审计确认每座城市独立按2个月有效伤害间隔扣1名守方人口；同月重复接触被城市月度汇总，多城同月损失属于并行围城，不改人口/围城参数。人口审计现在按触发城市分开记录，记录的是损失触发城市，不代表死者当时守在该城。
- 军令初选目标改为编组成员中心至合法敌城的直线距离最近，距离相同按稳定城市ID；保留原单位速度、移动、占领、围城、外交限制与攻陷路径。增加会话期命令、转向步进、目标接触、围城接触、攻陷、失效和长期远距无进展诊断，不消费随机数、不进入V15。
- 军政人物按现役、离任、已故排序，状态内按最近任职/死亡月份及personId确定；分开显示本国现役人数、活动编组、历史任职人物和全世界会话累计诊断。地图定位文案说明军令自动执行；查看目标城仅移动镜头中心并高亮，保留缩放。
- 已故人物显示“享年”和中性死亡原因说明，同时保留原始原因代码；`SIEGE_LOSS`不再暗示个人亲自守城。姓名沿用既有人口名字及稳定personId，不在晋任时改名。
- APP v0.99931q1 / package 0.99.150 / WorldSave V15。未调整基础围城伤害、伤亡间隔、战争概率、寿命或RNG；开发报告见[军事指挥与围城审计](docs/MilitaryCommandCombatAuditQ1.md)。等待用户人工Chrome/Electron Gate。

## v0.99931q · 真实军事指挥人物与军权体系

- 既有 User 达到确定性成年年龄后可在年度检查中晋任；任命不生成人口，永久 personId 与可复用 User.id 分离。首版每国最多2名现役指挥官、2支编组，每编组最多12个既存逻辑单位。
- 指挥编组会获得真实敌方城市目标，并在 Phaser 固定步进及逻辑移动/占领路径中改变成员单位速度方向；外交禁止敌对行动时不推进围城。城市历史事件只关联真实贡献编组，人物履历不把任内国家战果自动算作个人战功。
- 增加任职、离任、死亡档案与军政人物详情页定位；成员转属/战损即时解绑，国家终结解除命令，不把运行时清理写作死亡。
- WorldSave 升为 V15，严格保存并校验 User 出生月、人物/编组身份、成员单位、目标城市、历史攻城引用和ID序列。按用户授权拒绝 V14 及更早存档，不迁移、删除或覆盖旧文件。
- 自动化测试与人工检查入口见[Stage B开发报告](docs/MilitaryCommandPoliticalActorsImplementation.md)。等待用户新建V15七国世界，在【天下势力→存续国家→军政人物】检查真实任命、编组移动、攻城归属和V15往返；不包含军队拥立或任何新夺权机制。

## v0.99931p1 · 终结势力档案的紧凑展示

- 【天下势力→终结】改为双行紧凑卡片：首行突出势力名称和完整终结年月，次行显示终结类型与累计在国时长，并以次级文字显示初建年月。
- 移除终结档案的城市列和重复“已终结”标签；复国次数大于0时显示，按复国次数排序时包括0次并明确展示排序值。名称过长时省略显示，悬停可查看完整档案名称。
- 保留原有终结月份来源、六种排序、详情点击身份和其他分页布局；V14 Schema及模拟规则不变。
- APP v0.99931p1 / package 0.99.148 / WorldSave V14。自动验证和人工检查路径见[开发报告](docs/TerminalFactionArchiveCompactP1.md)。

## v0.99931p · 终结势力档案排序与时间展示

- 【天下势力→终结】默认按真实终结月份由近到远，并可切换终结时间正序、累计在国长短、建立时间和复国次数排序；筛选先于排序，终结日期缺失时在两种日期顺序中均列末尾。
- 彻底覆灭读取 `extinctionYear`，同源合邦与纳土归附读取 `terminationMonth`；字段维持世界月份单位，不新增 V14 字段。终结列表显示类型和时间，其他分页沿用原有排序。
- 排序使用既有累计在国月份与 `restorationYears.length`，同值按建立月份、稳定 factionId 确定；排序状态只保存在当前界面会话。
- APP v0.99931p / package 0.99.147 / WorldSave V14。自动验证及人工检查路径见[开发报告](docs/TerminalFactionArchiveSortingP.md)。

## v0.99931o · 君主多维治绩与历史评价重构

- 在既有 `RulerHistoricalEvidence` / `politicalFacts` 派生证据上，将人物评价按政治身份、任内国势、可核实的重要事件和真实结局组织；保留旧评价中有证据的判断，并在疆域与城市变化方向不一致时并列说明，避免把城市失守事件数当作净城市变化。
- 真实 `city-captured` 与 `capital-fallen` 记录区分本人有 `rulerId` 的行动和任内国家事件；攻陷都城按事件当月 `wasCapital` 标记识别。灭国、残部解散和流亡分别记录，并利用同一历史组避免把相关攻城与终局重复叙述。外交签约仍只说明签署事实，不推断外交收益。
- 史家曰纳入被废者后续真实生存/死亡及夺位者的任期结果与生命结局，避免以政治身份单独覆盖其后的统治结果。
- 王室人物卡片分列王位结局与真实生命结局；宗室废立即位时隐藏重复的继位背景，保留血缘、即位方式和离位方式。
- 增加基于真实 `WorldHistoryStore` 事件构造的个人攻城归属、当月都城身份、匿名攻城者排除及政治评价集成回归。未修改庙号/谥号规则、V14 Schema、模拟规则或 RNG。
- APP v0.99931o / package 0.99.146 / WorldSave V14。人工 Chrome/Electron Gate 待用户验收，入口与回传模板见[开发报告](docs/RulerMultidimensionalAssessmentO.md)。

## v0.99931n1 · 宗室废立历史与人物生命周期闭环

- 修正V14人物校验：`accessionCause="DEPOSITION"`可与后续`deposed`或真实死亡状态并存，保留最初即位方式；废位与后来真实死亡仍使用各自月份和事实。
- 君主个人页分别展示血缘关系、废立即位方式和废立离位方式；史评、史家曰按前君/夺位者角色引用同一`ruler-deposed`事件，保守表述废立与任内国势，不推断动机。
- 改进重度收缩人物的史评组织，避免相邻段落重复表达同一衰退结论。未改V14 schema、废立概率、RNG、庙谥和政治模拟规则。
- 增加连续两次宗室废立、曾以废立即位者再被废并自然死亡的Dynasty月度集成覆盖及V14严格校验/导出恢复往返覆盖。
- APP v0.99931n1 / package 0.99.145 / WorldSave V14。等待用户使用既有n版V14长局进行人工 Chrome/Electron Gate。

## v0.99931n · 在位废立与真实宗室夺位

- 新增仅由已存在、同一王统且关系可核验的成年宗室参与的在位废立；每12个月评估，需真实本国政治冲击与现实脆弱性，抽签后成功/失败均冷却60个月。
- 被废君主进入独立`deposed`状态并继续存活，保留人物ID、血缘、原任期及预定寿命；到期后才记录真实自然死亡并进入身后称号流程。废立只写入一条`ruler-deposed`权威事件，不改变王统、国号或旗色。
- WorldSave升为V14。用户授权不再兼容V13及更早存档；旧档明确拒绝读取、不迁移、不覆盖或删除。诊断入口为【右下角世界诊断→宗室废立诊断】。
- 生产采用保守风险：0.5%起步，每多一个独立危机事件组增加0.5%，上限1.5%；2%–6%仅作完整自然模拟对照研究，不为追求发生数调参。
- APP v0.99931n / package 0.99.144 / WorldSave V14。自动验证结果及多种子观察见[阶段B开发报告](docs/InReignDepositionImplementation.md)；等待用户新建七国世界进行人工 Chrome/Electron Gate。

## v0.99931m1 · 政治履历归因修正与史评闭环

- 旧V13易代证据展示按稳定顺序去重，不回写原始 metadata；未知证据不解释，不同日期/城市的失都事实分别保留。篡朝资格、概率和 RNG 不变。
- 政治履历只接收身份链完整的本国事实：继承候选死亡要求本君为父君且候选有真实死亡记录；篡朝、分裂、失都、被迫迁都、复国、纳土/合邦及外交均核对真实国家角色。外交本人签署要求签署君主与签署方 faction ID 匹配；续约不计为新的签署协议。
- 默认人物大事记优先显示经签署人和双方国家证实的初次协议，确保签约统计能在展开记录中逐项查到。史评与史家曰纳入篡朝身份，并将任内疆域/城市变化作为独立结果叙述，不推断因果；无指定储君证据时仍称继承候选。
- APP v0.99931m1 / package 0.99.143 / WorldSave V13。玩法、模拟概率、canonical 历史、RNG、存档结构及庙谥规则不变。用户提供的吴君昭旧V13样本仍需人工核验事件ID、完整签约记录及界面输出，见[开发报告](docs/RulerPoliticalBiographyAttributionM1.md)。

## v0.99931m · 君主政治履历与史评归因

- 以纯派生政治事实补充人物史评证据：区分人物直接行为与任内国家事件，按事件ID、月份、势力、人物角色及证据层级保留来源。人物统计新增本人签署的协议、任内重大分裂、被迫迁都、本人篡朝开统及继承候选先逝；续约不另计签约，失都事件不与迁都重复合计。
- 篡朝与同月普通继位只在月份、势力、新君和前君ID全部吻合时于个人大事记合并；原始历史记录保留。易代标题使用事件当月旧/新国号，准确显示真实改号。
- “储君”改为“继承候选”，现有生产记录没有足够权威身份字段证明被记人物是正式指定储君。
- 去重篡朝资格中对同一前君暴力结局的重复证据码；初始化2%诊断基础概率桶并防止缺桶导致非法数值。资格、风险公式、抽签、随机数、WorldSave V13 Schema及庙谥算法不变。
- v31l人工Gate已PASS：914.50年/216次继位，19次近期失都、1次重大分裂、26次暴力前君、23次政治重创资格；30次抽签、期望1.140次、实际篡朝1次。v31l篡朝机制冻结。
- APP v0.99931m / package 0.99.142 / WorldSave V13。审计边界、证据缺口、测试与人工检查入口见[开发报告](docs/RulerPoliticalBiographyAttribution.md)。

## v0.99931l · 篡朝政治重创资格重构

- v31k 人工 Gate 已通过，但511.33年、101次继位仅有1次旧复合入口，v31k新增入口为0；旧入口要求失都与重大分裂同时发生，且再叠加孤城与低稳定度。
- 不新增第四种入口；将v31k政治重创资格改为“至少一项有本国身份/事件组/城市/月证据的近期重大冲击 + 多信号政治脆弱性”。近期失都、重大分裂、前君战死/被俘处死分别可作严重冲击；同一历史事件组只计一次。
- 脆弱性根据当前城市数量、幸存城市忠诚均值所代表的稳定度、真实继位频繁/合法继承人未成年组合判定。新层单次风险为2%～6%，按独立冲击与脆弱信号分层；原最高级和战死/被俘孤城公式、优先级不变。
- 会话诊断增加有失都、重大分裂、暴力前君、现实脆弱性、新资格等真实继位累计数；候选预览明确不统计新入口。事件只冻结实际冲击的来源ID、月份、城市和类别，V13通用标量元数据往返，不改schema。
- APP v0.99931l / package 0.99.141 / WorldSave V13。完整自然世界多种子可达率尚未验证，见[机会重构开发报告](docs/DynasticRevolutionOpportunityRework.md)。

## v0.99931k · 篡朝政治危机与夺统事件强化

- v31j已获用户人工PASS，复国风险冻结；v31k实现的独立政治冲击入口已获用户人工PASS。用户实测511.33年、101次继位、旧复合资格1次、新入口0次，证明功能正常但未改善自然发生率。
- 前君任内近十年有真实失都和另一次至少两城的帝国分裂，事件组与城市证据独立；成年合法继承、正式在国建制、仅余至多两城、稳定度≤45时，获得原基础风险十分之一、最高1.5%的单次夺统机会，实际为1%或1.4%。原最高级危机及战死／被俘加孤城入口不变。
- 新事件冻结失都、分裂来源ID与月份、前君真实结局、新君及被排除继承人身份，以连贯中文呈现；保留旧继承人和原宗谱，不制造死亡、血缘或宫廷人物。
- 世界诊断新增中文篡朝会话摘要，沿用复制全部诊断；只在真实继位时使用本国历史索引，不在候选预览中扫描历史。
- APP v0.99931k / package 0.99.140 / WorldSave V13；自然长局新增路径发生率尚未证实，等待[开发报告与人工验收](docs/DynasticPoliticalCrisis.md)。

## v0.99931j · 复国可达性与流亡终局一致性

- v31i已获用户人工PASS：112.33年观察中低忠诚城市与复国候选均为零；据此修复前置过滤，不提高全局叛乱门槛。
- 仅真实流亡旧都／长期统治地，忠诚度29～39、破坏度≥70且近60个月至少两次真实易主或占领国稳定度≤40，获得独立、有衰减的年度风险，最高3%；多个候选共享最高单项概率。
- 残部与合法性同时归零的流亡国家，在正常月度推进中政治终结；仍有宗室不等于独立政权仍有恢复能力。不制造君主死亡，不在读取时修改旧历史，单项归零规则保持。
- 复用真实恢复链和V13事件元数据，新增战乱旧地依据；诊断区分城市检查、历史候选、合格、尝试、失败、成功和流亡政治终结，单项／多项阻断独立列示。
- APP v0.99931j / package 0.99.139 / WorldSave V13；受控业务验证不代表自然发生率。见[开发及人工验收报告](docs/RestorationReachabilityExileTerminal.md)。

## v0.99931i · 故都与长期统治地复国

- v31h已获用户人工PASS：实际观察233.5年，战略同盟合邦2次、互不侵犯新路径0次，95次同源互不侵犯年度候选未通过全部资格；保留参数，不借本轮放宽。
- 保留原建城者复国与普通义军路径；增加正式旧都且累计持有至少十年、或完整时间线证明累计持有至少三十年的历史联系，仅向有残部、合法继统及正合法性的流亡国家开放。
- 新资格从城市原有建立、攻陷、收复及行政转移记录派生，校验当前归属与易主计数；矛盾、缺失、已毁城市不放行，不新增存档状态。
- 一城一次抽签，新增旧都／长期统治权重分别为原基础的0.5／0.25，并有限衰减、加成与最高9%上限；多候选共享最高单项概率上限，未新增合格历史候选时保持原抽签顺序。
- 复用真实政治恢复、君主与人口生成链；执行失败不提前扣除残部，新复国事件记录实际城市历史依据。沿用世界诊断与复制全部报告入口，新增中文复国统计。
- APP v0.99931i / package 0.99.138 / WorldSave V13；自然长局发生率尚未验证，等待[人工验收](docs/HistoricalCityRestoration.md)。

## v0.99931h · 同源长期和平归并

- 用户正式授权阶段B实验实现；v31g已人工通过，阶段A历史记录保留。
- 保留原战略同盟合邦及其选择优先级，新增严格同源、正式在国建制、连续互不侵犯至少120个月、接壤、弱强领土比≤35%、弱方一城，以及可信共同压力或原有极弱条件的和平归并。
- 通过真实签约与续约事件证明当前互不侵犯阶段持续有效，另核对120个月双边战事；缺少证据、关系中断或矛盾记录均不放行，不以停战年限冒充。
- 复用行政合邦、末君退位及外交清理；新事件记录真实互不侵犯依据，旧历史不改写。沿用世界诊断和复制入口，分别计数两条路径，并提供中文摘要。
- 世界存档仍为V13；新路径已通过真实年度执行与存档往返集成验证，自然长局发生率尚未证实。详见[开发与人工验收报告](docs/SameOriginPeacefulReunificationImplementation.md)。


## 未发布研究 · v0.99931h Stage A

- v31g 已获用户明确人工 PASS，关闭前置 Gate。人工未观察到同源NAP，不能将其记为零次。
- 审计同源NAP形成、升级、续约及V13契约；新增四seed真实外交流程受控测试与只读参数矩阵，不能作为自然长局发生率。
- 尚无合理自然同源NAP候选证据，按阶段条件停止，未实施归并新规则；APP/package保持v31g/0.99.136、V13不变。见[阶段A报告](docs/SameOriginPeacefulReunification.md)。

## v0.99931g · Peaceful Political Transition Observability

- v31f 用户整体人工 PASS：已回传秦幼子、魏/楚兄弟储君及其余四国无指定储君，V13 与历史 UI 正常；未声称收到完整创始者年龄明细。
- 新增纳土与同源合邦年度运行时资格漏斗：观察月份、外交候选基础、资格、独立国家对、选择、成功、失败及单一/多项阻断。保留合邦先于纳土、实际选择顺序和全部真实门槛。
- 纳土复用现有检查；不将未执行的 NO_PRESSURE_PATH 作为实际阻断。同源合邦记录全部 ACTIVE 组合、正式同盟、同源及两者交集；压力的两条替代路径分别观察。
- 加入仅去掉一城、仅放宽领土门槛以及仅放宽合邦压力的只读反事实，不执行事件、不改变 RNG。
- 诊断仅在调试启用时累计，不持久化；100个年度桶、有限候选样本与有容量/下界说明的独立对计数。旧历史资格不可回溯，存档保留事件与本次会话次数分开。
- 复用世界诊断及核心/全部复制报告。APP v0.99931g / package 0.99.136 / WorldSave V13；等待[和平政治转型诊断人工 Gate](docs/PeacefulPoliticalTransitionObservability.md)。

## v0.99931f · Initial Royal Household Integrity

- v31e 政治宗谱身份、缩放/定位、V13 Save/Load 与历史 UI 已获用户人工 PASS，关闭前置 Gate。
- 仅新世界七个 INITIAL 势力采用小规模年龄约束宗室：可无候选、仅子女、仅兄弟或两者兼有；最多新增三人，初始合法候选最多两人，指定储君至多一人。不填满既有 candidateCap。
- 兄弟具有真实共同父辈记录；长辈为活着、未曾承统的 kin，不补造死亡，不计入君主代数或创始者。亲子出生年龄沿用18～40岁，寿限已过的初始人物不入册。
- 阻止亲子生年派生失败时补造成人子女；亲属链必须存在真实祖先记录，合法继位优先级、寿限分布和政治概率保持不变。宗谱悬停补充年龄与未承统身份。
- 后续新势力沿用原初始化；V13 Hydration 不回填或重复生成宗室。新增真实 startWorld→导出→校验→两次恢复及继续运行回归。
- 24个固定种子、每版168国、同为120年政治流程对照保留继承危机和自然易姓；不是战争/人口完整平衡验收。初始化 RNG 路径改变，同版本同种子可重现。
- APP_VERSION v0.99931f / package 0.99.135 / WorldSave V13；待[初始宗室人工 Gate](docs/InitialRoyalHouseholdIntegrity.md)。

## v0.99931e · Political Genealogy Visual Hierarchy

- 前置 v0.99931d3 国史合传人工 PASS，冻结文章与史论。
- 政治宗谱以只读批量证据区分势力创始、正式开国、称帝、真实篡朝、复国、当前君主、储君及末代承统/合邦退位/纳土退位。
- 节点采用克制的边框和背景层级，最多直接展示两个关键身份，其余保留在悬停说明；移除旧“彻底灭亡”字符串亡国判定。
- 保留历史姓名和合法庙谥格式、父子连线、多根宗谱、缩放/适应/定位/关闭行为。WorldSave V13、人物/epoch/历史及 RNG 均不变。
- 自动验证与人工清单见 [开发报告](docs/PoliticalGenealogyVisualHierarchy.md)，视觉 Gate 等待用户。

## v0.99931d3

- v31d2 统一国史人工 PASS，继续读取既有 V13 长局；只修文章组织、历史称谓和末段评议。
- 《X国史》按开创与建国、经营与政治变化、失国与终局等事实关系自然分段，末段独立评议；无新增按钮、栏目、模式或弹窗。
- 史论从真实峰值与失土跨度、王统自然交替与同月终结、攻守反转、相关连续分裂与后来篡朝、复国及行政终局选一个有证据的核心主题，记录来源 ID、指标及月份；存续/流亡只作阶段性评论。
- 人物首次引用使用真实任期和当月国号/政治等级，复用历史称号 formatter；真实死亡及既有合法称号才以“后谥／后世庙号”追述，不将身后称谓冒充当时身份。
- 合并开端建势与同月分裂、同组失都/失国及相关同月句子，保留不同事实；最终文章与称谓依赖按需缓存，仍有长度上限。
- APP_VERSION v0.99931d3 / package 0.99.133 / WorldSave V13。模拟、RNG、canonical history、人物生死、庙谥授予、时代与旧国评均不变。等待[分段国史与史论人工 Gate](docs/ChronicleChaptersJudgment.md)。

## v0.99931d2

- v31d1 人工功能 PASS：沂、郸、坂的王统事实及 V13 存档、宗谱和历史 UI 正常；用户明确要求取消双视角切换，改为一篇国史合传。
- 王室直接显示《X国史》、一行年月和统一正文，删除该页国家国评/王统摘要按钮、历史王统选择和多重折叠；全文位于储君、候选与历代君主之前。
- 从本国历史索引、永久峰值、核验过的王统阶段与真实人物重新选材，不拼接旧史评和两套史家曰。编年交代开创、正式建国、代表性国势和战争转折、自然易姓/真实篡朝、流亡复国及终局或当前承统。
- 同月交替与终结只按政治依赖组织叙述，不补日级顺序。真实死亡另依V13实际记录，和平合邦/纳土保持行政终结语义，ACTIVE/EXILED不预写结局。
- 一国文章按需缓存、正文有界；原国家国评、王统和个人评价模块及其他消费者保留，canonical history、RNG、模拟、V13 DTO和时代规则不变。
- APP_VERSION v0.99931d2 / package 0.99.132 / WorldSave V13。等待[原长局国史合传人工 Gate](docs/UnifiedHistoricalChronicle.md)。

## v0.99931d1

- v31d 王统总评人工 PASS：沂国宋氏人数、建国与终结，郸国自然易姓、阶段切换，以及 V13 Save/Load 和历史 UI 已确认正常。
- 王室合并为单一“国史与王统”区域：共用王统一览，小型切换查看国家国评全文或王统摘要；删除独立当前/历代王统重复标题与第二篇完整王统史论。
- 单王统摘要只保留一条传承结语，多王统保留开创、政治交替和阶段结局；不复述国家峰值、迁都与失城流水账，不再附另一篇史家曰。
- 同月开始、终结显示“开始并于同月终结”，不将0个月变成1个月。正式建国只在发生于所选王统阶段时列入一览，人物依实际任期核验。
- 国家国评原有统计、国史简述、史评和史家曰全文保留，历代君主及完整宗谱功能不变；沿用已有事实档案和缓存，不修改模拟、RNG、原始历史或V13结构。
- APP_VERSION v0.99931d1 / package 0.99.131 / WorldSave V13。等待[现有长局人工 Gate](docs/RoyalArchiveInformationArchitecture.md)。

## v0.99931d

- v31c1 人工 PASS：宋景怀全程流亡不再短祚，宋恺按总承统时间判断，宋武死亡与正常任期保留；V13 Save/Load 及历史 UI 正常，Gate 关闭。
- 新增王统总评：以真实 houseEpoch、实际即位者和本国历史索引派生独立政治阶段评价，区分阶段起点、正式建国、自然易姓、真实篡朝、流亡复国与三种国家终局。
- 王室增加小型可折叠展示，默认最新阶段，多阶段按需选择；只挂载所选阶段正文，不改变政治宗谱样式。
- 同月交界按开创人物/任期/ordinal 归属，不重复计算前后即位者，不推断日级先后；同姓复国阶段不制造人物或血缘。同月实际死亡与政治终结分别表述。
- 不归用国家永久人口、城市或领土峰值。评价缓存按 dynasty 身份、历史 revision、月份和人物/阶段摘要失效，不消费 RNG，不写 canonical history。
- APP_VERSION v0.99931d / package 0.99.130 / WorldSave V13；玩法、国家国评、个人史评、庙谥与时代规则冻结。等待[现有V13长局人工 Gate](docs/DynastyHouseEpochHistoriography.md)。

## v0.99931c1

- v31c / V13 新世界、继承、实际死亡、Save/Load 与历史 UI 已获用户人工 PASS；人物生死模型冻结。
- 短祚依据承统总时长（不超过60个月），不再把在国时间短或长期流亡承统误判为短祚；长期流亡仍依据实际流亡月份。
- 末代身份依据实际国家终结与最终任期归属，流亡死亡本身不再等于末代；同月有后继正式君主时不将终结归给前任。合邦/纳土退位与覆灭分开。
- 全程流亡明确无在国治理时期；评论不再无依据宣称王统在其身后继续，也不把全部国史归责于末代流亡君主。
- APP_VERSION v0.99931c1 / package 0.99.129 / WorldSave V13；玩法、人物生死、庙谥规则、国家国评、时代与 RNG 均不变。
- 新增任期/角色/标签/人物史评/史家曰与 V13 实际 hydration 一致性回归，等待[现有V13长局人工 Gate](docs/RulerTenureHistoricalRoleIntegrity.md)。

## v0.99931c

- v0.99931b1 史家曰、精确统计、V12 Save/Load 与运行布局已获人工 PASS，文风正式冻结。
- 政治终结与真实死亡分离：新增 politically-ended，结束任期、继承资格和 ruler unit，但不制造死亡、血缘或授谥；实际死亡独立记录 deathMonth/deathReason，真实死亡不被后续国家终结覆盖。
- 自然死亡、战死、被俘处死与候选自然死亡保留原有路径和 RNG；合邦及纳土仍为退位。王室年龄、个人史评/史家曰、庙谥号展示及最长寿记录使用可信死亡事实。
- 用户授权 WorldSave V13，V12 及更旧直接拒绝、不迁移、不删除旧数据。V13 严格校验独立死亡/政治字段、任期快照及引用；失败在 teardown 前保护原运行世界。IndexedDB 版本仍 2。
- 新增真实生命周期与 V13 初始化/export/validate/hydrate 回归；所有冻结玩法、国家文学叙事及时代规则不变。
- APP_VERSION v0.99931c / package 0.99.128 / WorldSave V13。等待[新建七国世界人工 Gate](docs/RulerPoliticalTerminalIntegrity.md)。

## v0.99931b1

- v31b国家史评差异化、V12 Save/Load、历史卷轴/图鉴/运行布局已获人工PASS；史家曰文学质量尚待本轮验收。
- 仅改史家曰语言：用天下六成有余/天下过半、四十余载/未及十载等事实概括替代裸百分数与精确月份；独立数值表达函数不对整段文本、姓名或专名做正则替换。
- 保留人物核验与历史国号。燕式失都表述改为“曾失”，不从一次失守断言以后没有收复；元式评论明确“盛时”疆域与后来同源合邦，不把过去峰值当成合邦前夕国力。
- 史评、统计、编年简述、论点权重/选择、canonical历史及玩法均不变；旧数字文风断言改为同时检验史评精度与评论概括，既有事实校验保留。
- APP_VERSION v0.99931b1 / package0.99.127 / WorldSave V12。markExtinct政治终结写dead缺陷仅列P0待修，禁止混入文风补丁。
- 等待[现有V12长局人工文风Gate](docs/HistorianVoiceStyleClosure.md)，无需重新长跑。

## v0.99931b

- v0.99931a2时代精选、入口、快照提示、时代同步、V12 Save/Load与快速切换10时代已获用户人工PASS，Era Highlights规则冻结。
- 国家史论按真实证据链增强：过半疆域、攻敌都、失己都、最后据点失守为独立阶段时，优先论述完整盛衰，不再以简单攻守反转盖过这些经历。
- 攻守反转区分短期骤折与相隔多年易势；长期国祚与累世君主的已证实反差可优先于附带战例。史家曰使用事件月份国号、核验人物、日期、城市、实测峰值与失国后延续月份，不使用随机同义文案。
- 延续现有最多两轴论点、编年简述、国家档案缓存及faction历史索引；完整证据链不再重复选简单攻守反转。UI版式不变，所有历史原始记录及玩法不变。
- 只读全仓库审查markExtinct：最后首都因毁坏消失、最后城市陷落且无残部等路径未要求人物死亡证据，可把政治终结直接写成当前君主dead；列为下一轮优先修复，不在本轮改生死规则。
- APP_VERSION v0.99931b / package0.99.126 / WorldSave V12。新增燕、赵、魏、齐的可核验纯档案测试；等待[现有V12长局人工史论Gate](docs/FactionHistoricalJudgmentII.md)。

## v0.99931a2

- 用户已补验 v31a1 前后时代切换、时代事件对应地图跳转、V12 Save/Load 与快速切换性能正常。
- 左侧改为“时代精选”：独立展示权重覆盖整个时代，复用历史分组，普通攻城和日常外交不作填充；按类别与时代阶段选取最多10件，最终年月倒序。
- 按200条完整月份/历史组窗口读取当前时代，保留有限候选与最多8份精选缓存；历史 revision、时代范围及查询截至月份变化时重算。
- “查看本时代全部历史”关闭图鉴并选中同一时代的全部历史；保留势力过滤、分页与未读提示。移除“大事→时代”二级入口，时代下拉与原事件地图跳转继续保留。
- 快照之后的精选显示时间提醒，明确地图未反映后续事件的疆域变化。
- APP_VERSION v0.99931a2 / package 0.99.125；WorldSave V12、历史原始记录、全局重要度及所有玩法规则不变。视觉和选材质量等待人工 Gate。

## v0.99931a1

- v31a地图布局、国号、城市标签、时代轴、导航、筛选、Save/Load和快速切换人工正常；大事→时代→对应地图点击仍须本轮独立补验。
- 图鉴宽屏增加时代大事/历史地图/诸国统计三栏，窄屏折叠侧栏、优先保留完整地图；底部时代轴与既有selectedEraId不变。
- 时代大事按真实起止月份及当前worldMonth上限读取有界窗口，复用历史分组与significance，排除普通外交，每页10条、游标查看更多；共享原历史事件格式与详情，切时代重置旧页/展开，不改任何canonical事件。
- 地图单独标注地图记录月份，文字事件不冒充逐月地图。国号、颜色与城市仍取冻结快照；大事使用事件月份身份与已记录人物事实。
- 默认开启显示国界，按缓存owner格的右/下不同归属边批量绘线；同国无网格，无主边缘较淡，先画边界再画国号/城市。开关为UI session偏好，缩放后保持约1px视觉线宽，不存档、不消费RNG。
- APP_VERSION v0.99931a1 / package0.99.124 / WorldSaveV12与SnapshotV1不变；时代判定、国评及所有玩法冻结，等待[人工图鉴大事与国界Gate](docs/EraAtlasChronicleBorders.md)。

## v0.99931a

- v31历史国号、旗色、面积、前后导航、时代轴与Save/Load人工PASS；本版仅修图鉴布局，时代与玩法全部冻结。
- 响应式96vw/92dvh弹窗：顶部紧凑工具栏、主体地图与220px诸国侧栏、底部48px文字节点时代轴。100%地图按实测可用宽高完整contain，不拉伸；150/200%才允许地图内部滚动。窄屏可展开统计。
- 诸国默认仅名称/旗色/世界比例，格数与城市数按需展开。时代轴只调整自身scrollLeft，避免scrollIntoView带动祖先弹窗跳动。
- 删除旧纵向时代脉络与重复缩略图，历史顶部统一时代图鉴入口；全部时代默认打开按真实时间排序的最新时代，保留同一selectedEraId、时代筛选及事件对应地图入口。无快照明确提示。
- 城市文字使用实测文本边界、画布内候选位置与确定性避让，无法容纳安全隐藏；城市点与首都金环坐标不变。复用既有快照派生缓存和国号定位，不增加全历史扫描。
- APP_VERSION v0.99931a / package0.99.123 / WorldSave V12及EraMapSnapshotV1不变。等待[现有长局人工布局Gate](docs/EraAtlasUIClosure.md)，自动测试不代替视觉检查。

## v0.99931

- v0.99930b1人工正式PASS，Faction Historiography全系列冻结。本版仅Era Atlas II展示与浏览，不修改时代判定、历史生成或任何玩法。
- 从冻结ownerRuns派生格数/绝对世界占比/快照城市数，历史国号与颜色只取factionPalette，保留0格图例势力；不反填人口或君主。
- Canvas国号使用最大连通领土块和边界深度选点，按实测文字矩形检查领土容纳、地图边界及首都标识；小国/长国号安全隐藏，缩略图仅少数主要国家，大图显示更多。
- 同一大图支持前后时代、左右键、100/150/200%滚动查看及横向文字时代轴；按startMonth/confirmedMonth/id稳定排序，无快照时代仍可选择并明确缺失，不展示邻图。
- 时代脉络、历史时代筛选、事件地图入口与弹窗共用EraSelectionUIState；保留bounded history page查询及全部原过滤器。确立记录使用confirmedMonth，地图年月使用capturedMonth。
- snapshot identity派生缓存，不存Canvas图片、不逐帧解码或布局，时间轴不渲染全部缩略图。APP_VERSION v0.99931 / package0.99.122 / WorldSave V12和EraMapSnapshotV1均不变，等待[现有长局人工地图Gate](docs/EraAtlasII.md)。

## v0.99930b1

- v30b永久史料、编年、攻守反转、主要史论、三种终结与Save/Load人工正常；本版仅收尾王统事实一致性，不扩展文学模板或玩法。
- 同月编年增加稳定事实依赖阶段：开创/建国、在国政治事件、最终失国、终结；篡朝必须在最终流亡前叙述，不虚构日级顺序或因果关系。
- 真实篡朝与最终失国同月，优先形成王统方立而国土旋失的事实论点；有记录的重大王统变化不再被普通迁都机械挤出。长期半壁、多姓零篡朝国家保留王统延续论点，不把自然易姓写成夺权。
- 新增有限FORMER_OPPONENT_UNION论点：同一稳定接受方ID、过去真实攻取其首都、后来MERGED行政合邦，表达攻都与合邦的反差，不编和解动机或血缘。
- 终结势力王室标题改为末代王统，读取真实最后epoch；ACTIVE/EXILED仍为当前王统。APP_VERSION v0.99930b1 / package0.99.121 / WorldSave V12不变；规则、史料口径、RNG、存档DTO全部冻结，等待[王统叙事人工Gate](docs/DynasticHistoriographyClosure.md)。

## v0.99930b

- v0.99930a国史简述、永久峰值、生命周期与V12往返人工正常；史评与史家曰文学质量仍待验收。本版仅修改派生叙事和终结展示。
- 新增有来源的历史论点：事件ID、指标键、月份、筛选分数与理由；按攻守反转、久祚末路、半壁失国、迁都、王统更替、复国与政治终结组合选取史论，区分史评和史家曰，避免把所有流亡国家写成同一句。
- 国史材料统一为Timeline Milestone，先择取代表性节点，再按月稳定排序，最多7句；保留事件月份身份、真实人物核验与亲征证据，不添加因果、动机或血缘。
- MERGED展示统一为同源合邦，旧V12事件从absorbedFactionId/absorbingFactionId解析被吸收方与吸收方；历史卷轴、君主纪事、势力终结状态、王朝记忆和国评使用一致方向。SUBMITTED仍为纳土归附。
- APP_VERSION v0.99930b / package0.99.120 / WorldSave V12不变。玩法、永久史料口径、RNG及存档DTO冻结；新增论点质量、编年与旧事件展示回归，等待[现有长局人工史论Gate](docs/FactionHistoriographyJudgment.md)。

## v0.99930a

- v0.99930永久史料、峰值、国祚、流亡终结与Save/Load人工正常；国评/史家曰叙事Gate未通过，本版只修事实叙事。
- 新增collectFactionNarrativeEvidence与buildFactionHistoricalNarrative，首次从该国事件索引收集真实角色、事件月份、城市、人物ID与来源metadata；按起源/盛时/政治转折/终局构建3～6句国史简述，史评与史家曰突出实际兴亡轨迹，不再主要按寿命标签选套话。
- 亲征人物仅使用档案中属于真实行动方且处于当时任期的已记录ruler ID。国号与身份按事件月份解析；无失国/绝统证据不补写，无人物证据不编名，多姓王统不等于篡朝。
- EXTINCT不再用最终零领土推断渐进衰退；MERGED/SUBMITTED仍可只读比较行政终结前观测值。终结历史简短回顾增加独特转折，不新增重复事件。
- 修正终结/流亡描述与展开详情中的历史国号；分组历史不重复回放含内部势力名的原始标题。卡片标题、描述和详情共享自身event ID/object，新增韩/齐事件隔离测试。
- APP_VERSION v0.99930a / package0.99.119 / WorldSave V12不变。永久峰值/计时/所有玩法/庙号谥号/RNG/桌面性能不修改，沿用档案缓存和历史分页。等待[现有V12世界人工叙事Gate](docs/FactionHistoriographyNarrativeII.md)。

## v0.99930

- v0.99929a Political Terminal Chronicle人工全部PASS；纳土、同源合邦、历史身份、退位纪事、宗谱、行政地图与V11 Save/Load正式冻结。
- 新增永久FactionLifetimeRecord：按月读取users.size、受控block cardinality和cities.length，独立保留各峰值最早月份与观测来源；不依赖500条年度快照或debug开关，不扫描全地图/全历史。
- MERGED / SUBMITTED行政转移前捕获末次国力、政治终结后冻结，EXTINCT在真正终结时冻结，EXILED可继续复国与更新。
- 新增纯事实国家历史证据、可解释历史类型、2～4句国评与确定性史家曰；区分势力历时、正式国祚历时、累计在国，统计实际君主/王统与独立峰值日期。终结对象使用历史国号，不把退位写成死亡，不臆造灭国者。
- 王室顶部新增折叠国评/势力结语；终结事件展开增加简短回顾，不新增重复历史事件。派生评价按冻结记录缓存，首次按势力索引查史料，保留现有分页与增量历史路径。
- WorldSave升级V12，严格precheck唯一记录、势力引用、整数月份/非负峰值/世界格数基数与终结冻结状态；V11及更旧直接拒绝，无迁移，IndexedDB仍2。APP_VERSION v0.99930 / package0.99.118。玩法、RNG及所有后续主题不修改；等待[人工Gate](docs/FactionHistoriography.md)。

## v0.99929a

- 政治终结展示按 terminationMonth 解析接受国历史国号，MERGED / SUBMITTED 的顶部、生命周期与王朝记忆不再被目标国未来改名污染。
- 君主年龄按真实 status 区分享年、退位时年龄与当前年龄；退位评述使用任期措辞，不因 endYear 推定死亡。包含临时阶段的累计标签改为“势力存续”，不改计时。
- 纳土与归并进入双方当时君主的个人大事记并优先保留；记录的君主 ID 优先，旧 V11 归并按势力角色、任期与合邦退位记录只读归属，不回填当前君主。
- APP_VERSION v0.99929a / package 0.99.117 / WorldSave V11。玩法、RNG、存档 schema 与政治终结触发规则保持不变；使用现有长局完成 [Political Terminal Chronicle Gate](docs/PoliticalTerminalChronicleClosure.md)。

## v0.99929

- Diplomacy II全系列人工PASS并冻结，包括可信威胁/期限/升级/续约/冷却、Save-Load、联盟年龄连续性、国势叙事与频率。
- 新增不同源ACTIVE正式国家的确定性和平纳土：双方有城、接壤，Alliance连续关系≥60月或NAP≥96月，近60月无双边城邑攻陷。弱国一城/领土≤8%/稳定≤55，接受国≥25%，弱强比≤¼。复用controlledTerritoryShare和现有地理/可信威胁函数，不新增战争真相或RNG。
- 年度最多一次SUBMITTED，按Alliance/连续关系时长/实力差/弱国稳定/稳定ID排序；有当前真实credible/severe第三方时标联盟保护路径，否则极端强弱和平归附。同源仍只走既有Strategic Union MERGED，条件冻结。
- 独立纳土行政转移城市/blocks/users，人口cause FACTION_SUBMISSION；末代君主abdicated/纳土退位，heirs→kin，旧王室保留，无假血缘、不生成征服事件。清理Diplomacy和terminal runtime资源。
- canonical统一terminationReason EXTINCT/MERGED/SUBMITTED与terminationTargetFactionId/terminationMonth。WorldSaveV11，V10及更旧PRECHECK拒绝，无迁移；IndexedDB仍2。统一字段/退位档案/行政归属验证与hydrate-export往返。
- 大事→纳降及事件月份身份/事实详情；天下势力终结列表以覆灭/归并/纳土区分，详情保留旧王室和末代退位君主，接受国国势可见纳土来归。防止WorldHistory观察把SUBMITTED错误追加为灭亡。
- debug-only session/recent100y计数、完整blocker计数与最多10条候选，不存档、不抽RNG。APP_VERSION v0.99929 / package0.99.116。未改外交/革命/继承/战斗/人口balance或其他后续主题。真实新世界最多1500年人工Gate必须完成后停止。

## v0.99928b

- Diplomacy II manual Gate PASS: dynamic terms, credible/severe threats, reasonable frequency, natural TRUCE/NAP/ALLIANCE renewals, expiry/cooldown, decades-long continuity and Save/Load. Recent100year shortest reformation gap36months, active relation density~0.267. Gameplay frozen.
- Presentation-only signing prose includes the actual expiry date; NAP→Alliance explicitly replaces the prior relation and starts the new term at the upgrade month. Recorded precondition/current/continuous start dates appear in details.
- Renewal explicitly extends the previous expiry, with old/new expiry, extension, status start, chain start/count and last renewal month. Badge counts are labeled continuous-chain renewals, never inferred Alliance-specific renewals.
- Existing V10 history titles are projected from recorded metadata with event-month identities; expanded diplomatic cards skip repeated narrative and retain factual metadata details. No stored event rewrite, relation mutation or RNG draw.
- APP_VERSION v0.99928b / package0.99.115 / WorldSaveV10 unchanged. All gameplay, persistence schema and diplomacy lifecycle remain frozen. Existing long-world manual narrative Gate required; no new world or long rerun.

## v0.99928a

- Recorded the ongoing Diplomacy II manual Gate: varied6/9-year NAP and12-year Alliance, NAP→Alliance upgrade, diplomatic-free newest-first power chronicle have passed. Natural renewal, threat disappearance/expiry/cooldown, renewed V10Save-Load, union age continuity and800–1200-year frequency remain pending. No diplomatic calibration.
- Debug overlay defaults to a230px compact RUNNING/PAUSED/version strip. Expand/minimize and collapse-all are session-local presentation state; every diagnostic detail defaults collapsed. Full report DOM/previews are lazy while polling/subscriptions and independent Core/Diplomacy/performance/runtime collectors stay active. Copy core/full remains on demand in the expanded panel.
- History signing/renewal details expose recorded credibility, direct contact for each party, adjacency and directional city capture/capital-fall flags only when evidenced. Parties and threat use event-month identity. Renewal shows original chain start, old/new expiry, extension/count, and continuous relationship age measured from originalStartedMonth, never from renewal.
- Backlog only: Deterministic Staggered Diplomacy Evaluation, potentially stableHash(pairKey)%12 if later manual evidence warrants it. No staggered scheduling is implemented.
- APP_VERSIONv0.99928a / package0.99.114; WorldSaveV10 unchanged, existing V10world continues. Formation/duration/renewal/cooldown/caps/annual cadence/Strategic Union and all gameplay remain frozen. Browser/Electron observability and the original long-run Gate must be completed manually.

## v0.99928

- Froze the complete v27 Dynastic Revolution Gate after user acceptance of natural usurpation, preserved lawful kin/independent houses, epoch/name/banner/history identity, major/era/unseen/paging and archived-city repair followed by clean reload.
- Diplomacy II replaces distant-size-only NAP eligibility with pure factual WEAK/CREDIBLE/SEVERE common-threat assessment. CREDIBLE needs one direct exposure plus pair adjacency/aged continuity; SEVERE needs both exposures. Alliance retains24-month NAP minimum, requiring72months and the same threat when only CREDIBLE. Annual deterministic formation, active relation caps and Strategic Union rules remain; no added RNG.
- Whole-year deterministic TRUCE24–60 / NAP72–144 / ALLIANCE96–180month terms use capture/capital-fall/stability/territory/contact/continuity evidence. Near-expiry annual renewal runs separately from formation quota, extends expiry and preserves status start/chain start. Peaceful truce cannot renew without remaining war-recovery facts; vanished strategic pressure prevents automatic NAP/alliance renewal.
- Canonical diplomacy now stores originalStartedMonth, renewalCount/lastRenewedMonth and one latest memory/pair with bounded status-specific reformation cooldown. Alliance renewal preserves age for unchanged union eligibility. NORMAL relation-renewed history records real extension/evidence/signers; diplomacy filtering includes signing/upgrade/renewal/expiry, without renewal flooding major history.
- Presentation-only power chronicle and trend markers exclude ordinary diplomacy, retain real national trajectory and formal-state conquest facts; power chronology is newest-first while chart markers remain chronological. Incremental history/index/paging is unchanged.
- Session-only Diplomacy II diagnostics provide cumulative/recent100year lifecycle/duration/churn/threat metrics, density and10bounded lifecycle/blocker samples. Debug state does not persist or consume RNG.
- APP_VERSION v0.99928 / package0.99.113 / WorldSaveV10. V9andolder are directly rejected without migration; IndexedDB remains2. New continuity/memory fields round-trip through canonical export/hydration/validator/diff. Combat/succession/revolution/population/rebellion/posthumous/desktop/performance and downstream themes remain frozen.
- Mandatory real browser/Electron Gate: NEW V10world4×800–1200years, factual network/variable terms/renewal/expiry/History/power/markers/Save-Load/union-age/same-seed observations. Return metrics and samples if frequency feels wrong; no automatic tuning or next feature.

## v0.99927d2

- Reproduced the save-blocking stale City pointer: updateDevastation permanently destroyed/archived a city, but the same updateDefense call proceeded to a changed zone tier and reattached13 map cells. Return immediately after terminal devastation, reject destroyed-zone rebuilds, and clear same-city pointers across the map during permanent teardown. Active city/capture/revolt/merge gameplay rules remain unchanged.
- Export checks active-city object/zone membership and rejects stale pointers before creating a DTO; BlockSaveProjection accepts an authoritative allowlist. Strict validation requires block references to active save.cities, checking center/owner/capital/zone relationships before hydration teardown.
- Narrow V9 PRECHECK repair clones only proven archived destroyed-city block references, clears city/center/home and sets non-city HP0, preserving ownership/history/dynasty/RNG. Repository admission validates the clone but returns the original stored record; no IndexedDB rewrite. Unknown refs reject as PRECHECK_FAILED while the old runtime stays intact. Repair count/IDs and unresolved coordinates are copied in debug diagnostics; saving then reloading produces zero repairs.
- Era subtype now includes only world-era-started/unification/hegemony/fractured. Empire-split and rebellion founding narratives remain in all major events, never the world-level era filter. Paging/index/unseen/scroll UX are retained.
- APP_VERSION v0.99927d2 / package0.99.112; WorldSave V9 unchanged. Dynastic Revolution probability/succession/combat/population/posthumous/diplomacy and downstream features are frozen. Manual Gate must reload the existing Tang→Xia sample, verify archive evidence/repair or safe rejection, save/reload0repair, city destruction and era/unseen semantics.

## v0.99927d1

- Froze v27d calibration after the user's natural usurpation at month9867 / year822 month4: Ling (internal factionId沅陵义军), 陆氏→欧阳氏, minor lawful successor + combat predecessor, stability56, chance9%. The year1005 run has239 boundaries/10 attempts/9 failures/1 usurpation, expected count0.50. No odds, succession, combat, population, diplomacy or Save changes.
- History primary navigation is now major events / war / diplomacy / all; God remains secondary. Major subtypes expose founding, emperor, revolution, restoration, extinction, merger and era. Queries retain incremental revision/append subscriptions and bounded indexed windows, selecting narrative subtypes after existing grouping; isolated anchors are narrowed before copying. No full archive publication/sort, search engine or canonical history truncation.
- Usurpation is a presentation LANDMARK with a clear 篡朝 badge and metadata-only factual details, retaining historical identity and canonical prose. Old-house/new-house, predecessor outcome, stability/evidence, displaced heir/archive ID and actual rename/banner transitions are visible.
- Near-top browsing follows newest; older browsing freezes page revision and tracks matching append deltas. A return-to-latest button clears unseen and scrolls up; filter changes reset paging/expanded cards/scroll/unseen. UI state never enters saves or RNG. Browser anchoring and actual scrolling remain manual acceptance items.
- APP_VERSION v0.99927d1 / package0.99.111; WorldSave V9 unchanged. Required manual Gate uses the existing V9 world with the actual event, not another800–1500-year search. Verify history/royal archive/genealogy/identity/Save-Load and dynamic scroll before any next gameplay version.

## v0.99927d

- Reviewed the 2445-year Calibration Gate: 589 boundaries, 142 vulnerability eligible, 8 crisis eligible, 6 attempts/all failed, 0 usurpations. Six chances total about0.50 expected events; zero outcomes alone do not justify raising all probabilities. The original crisis-only gate blocked581 boundaries.
- Highest succession-crisis eligibility and its contextual chance remain unchanged. Lower shock/instability tiers require BOTH a combat/captured predecessor boundary and exactly one remaining city, alongside the existing lawful successor/STATE/ACTIVE gates. Chance is the existing capped profile multiplied by0.25/0.5 respectively; no ordinary succession rule change and exactly one eligible-boundary draw.
- Session-only Gate diagnostics add elapsed world years, attempted/expected/actual events per1000years, summed attempted chance, years per expected event, tier counts and actual fractional-percent buckets. Load resets observations and starts the denominator at the saved month; no save schema or RNG changes. Existing canonical archive/epoch/identity/history path stays intact.
- APP_VERSION v0.99927d / package0.99.110; WorldSave V9 unchanged. Low FPS/unlock stalls at year2445 are recorded as known performance debt only; no performance, combat, population, diplomacy or downstream feature work.
- WAITING FOR USER MANUAL GATE: new world4×800–1500years, assess expected frequency without requiring a random usurpation. If one occurs, manually inspect displaced living kin, genealogy, house epochs, historical name/color, royal UI/chronicles/HistoryScroll and Save/Load. Automatic checks do not close the manual Gate.

## v0.99927c

- Closed the v27b performance audit using the user's b5 results: RAF + explicit blocker recovered after ~18min lock (rolling~56 FPS, fixed CPU~1.3ms, steps~3.7; unlock1/5/10s callbacks~17.5/50.5/58.2 FPS); timeout without blocker also remained usable after ~12min lock (rolling~52.6 FPS, steps~3.96; callbacks~39.8/51.2/51.6 FPS). Both remain opt-in debug/compatibility experiments; RAF/OFF release default and all validated lifecycle/history/debt/wake fixes are frozen. No b6.
- Removed stability<=25 as an independent revolution hard gate: multiple independent manual runs had 93/180/463/732+ succession boundaries but zero stability/full eligibility or rolls. Existing lawful successor, STATE/ACTIVE/positive city count, succession-crisis and recorded vulnerability gates remain authoritative.
- Pure contextual chance uses base4/6/10/14% at stability>60/46–60/31–45/<=30, plus recorded captured3 / one-city3 / real succession-chain2 / minor2 / combat-death1 percentage points, capped18%. Integer percentage points preserve strict roll boundaries; exactly one WorldRandom draw per eligible succession boundary and none elsewhere. Zero-city states no longer claim ONE_CITY_REMAINING evidence.
- Session-only diagnostics now report hardEligibleBeforeRollCount, rollAttemptCount, failures and usurpations, separate base/final chance distributions, modifier/capped counts, the last10 eligible samples with crisis/chance/actual draw/age/reason, and last10 all-boundary samples for zero-eligibility analysis. Removed stabilityEligibleCount and STABILITY_TOO_HIGH. Debug reads spend no RNG and reset on new world/load.
- Existing canonical usurpation path, displaced living kin, distinct roots/house epochs, regime name/banner history, historical identity, featured event and badges/prose remain unchanged. Natural heirless NEW_HOUSE remains natural. Fixed-quantile frequency sanity tests are deterministic, not Monte Carlo or real-world occurrence guarantees.
- APP_VERSION v0.99927c / package0.99.109; WorldSave V9 / IndexedDB2 unchanged. No Desktop performance/scheduler changes, diplomacy, ruler death, population, City/Dynasty balance outside revolution chance, history retention or Save rewrite.
- Mandatory real Electron Gate: default pnpm desktop:start:debug, new world4×800–1500y; return cumulative gate/chance buckets/eligible samples and verify actual usurpation archive/kinship/epochs/badge/name/color/history/Save-Load. If rolls all fail, mechanism is reachable: do not raise chance automatically. If hard eligibility stays zero, return recent evidence; no further unilateral tuning or next theme.

## v0.99927b5

- Recorded b4 manual Gate FAIL: normal foreground ~60 FPS / 4 steps with ~1–2ms fixed CPU; after extended macOS lock, rolling ~22.5 FPS / 44.4ms / p95 116.4ms despite 4 steps, ~1.74ms fixed CPU, nominal thermal state, AC power and an active RAF loop. unlock resetDelta ran, but 1/5/10s callback rates were ~5.7/6/14.3 FPS and subsequent focus stayed ~10–30 FPS. Debt is fixed; underlying scheduler/render/compositor/OS cause remains unproven.
- Added two independent, explicit desktop-debug A/B launch flags. --wanguoji-prevent-app-suspension owns at most one Electron prevent-app-suspension blocker, records id/isStarted/start reason and releases it on actual will-quit. No prevent-display-sleep, no default blocker for release or ordinary debug.
- --wanguoji-force-timeout-loop passes allowlisted immutable launch metadata through the sandboxed preload. Game creation merges fps.forceSetTimeOut:true (target60 default, preserving existing FPS fields) before Phaser constructs its TimeStep. Web/release/default debug remain unchanged; no runtime switch, RAF patch, alternative simulation loop or physics change.
- Diagnostics explicitly show actual blocker OFF/ON and observed RAF/SET_TIMEOUT separately from requested launch mode, preserving all b4 power/wake/loop/save observations. A bounded recent1s Core callback cadence sample also remains available while the world is paused, for the mandatory10s paused control; no extra timer or renderer observer.
- Added deterministic structural tests using installed Phaser TimeStep/runner boundaries for scheduler selection and equal callback input -> identical executed steps, WorldClock, RNG, digest and V9 DTO. Retained b3 debt and b4 wake tests; runtime timing and macOS visual acceptance remain manual.
- APP_VERSION v0.99927b5 / package0.99.108; WorldSave V9 / IndexedDB2 unchanged. Gameplay/balance/history/retention/disposal/Save/renderer defaults unchanged. Added dedicated desktop:start:debug:blocker and desktop:start:debug:timeout scripts to avoid CLI forwarding ambiguity.
- Mandatory Gate: existing b4 RAF/OFF is A; B is RAF/ON, existing long save4×, lock15–20min. If B positive, stop for user product decision without C. If still slow, pause world10s and copy diagnostics, then restart C timeout/OFF and repeat. Do not adopt either experiment as release default. If both fail and paused remains slow, record macOS lock-screen/Electron renderer scheduling known limitation and end v27b audit; no b6. Wait for manual results before v27c.

## v0.99927b4

- Recorded b3 foreground debt PASS: normal 4× ~60 FPS / ~4 steps, overload no longer retains whole-step debt. The ~2911-year macOS lock-return incident instead measured ~7.5 FPS / ~132.8ms raw frames, 4 steps, zero accumulator/cap, ~2.14ms Core CPU and ~130.7ms unattributed time. Scheduler/OS cause remains unproven; b3 debt algorithm is unchanged.
- Main process now sends an allowlisted desktop-wake on resume, unlock-screen and user-did-become-active. Renderer calls the installed Phaser 3.55.2 TimeStep.resetDelta only, without loop restart, driver reset, world progression or an extra catch-up path. Existing suspend PAUSE/CATCH_UP semantics remain unchanged; focus is observation-only.
- Debug-only bounded power/lifecycle observations include lock count/timestamps, user active/inactive, resume/focus, thermal state, advertised CPU speed limit and battery/AC. No initial CPU speed value is invented when no OS notification exists.
- Debug-only TimeStep/RAF diagnostics expose actual installed fields (_coolDown presented as coolDown), and last 20 wake observations with before values and 1/5/10-second interval callback FPS / loop samples / first-normal-frame latency. Sampling runs on existing Core frames; delayed callbacks report actual elapsed time. No added polling loop, timers, PerformanceObserver or renderer monkey patch.
- APP_VERSION v0.99927b4 / package 0.99.107; WorldSave V9 and IndexedDB 2 unchanged. No history, disposal, gameplay, physics, balancing, revolution or Save rewrite. backgroundThrottling:false remains; no powerSaveBlocker/A-B flag because App Nap attribution is not yet established.
- Mandatory real Electron Gate uses an existing long save: foreground, 1–2min ordinary focus-away, 2–5min macOS lock/unlock, 1/5/10s recovery and paused comparison if still low FPS, then a normal-FPS long-world Save timing. Stop before v27c. If Gate passes, end the v27b audit; next user-authorized theme is Dynastic Revolution Calibration, never changed here.

## v0.99927b3

- Recorded the v27b2 manual result: History Scalability passed; append publication and narrative indices remain intact, notification cost is near zero at 1000+ years, and a ~4228-year V9 world with ~9626 events/~2706 rulers returns to ~60–65 FPS after Load. Runtime Disposal invariants remain zero/healthy. The remaining failure was foreground pacing at ~1305 years (~15 FPS, 16 steps/frame) with God Tab open and near-zero history work.
- Reproduced old foreground accumulation before editing: 250/500/1000/5000ms stalls retain ~1.47/3.47/7.47/39.47 seconds of scaled debt; five seconds at 100ms/frame builds ~13.33 seconds, which remains after another 40 seconds at 15 FPS and the 16-step cap. This proves the driver permits persistent debt; the original Electron incident still needs the new diagnostics for direct attribution.
- Foreground now executes at most the existing 16 fixed steps, discards remaining unexecuted whole-step wall-clock debt and retains fractional carry. Normal 60 FPS speed1/2/4 pacing is unchanged; overload intentionally advances less simulated time per wall-clock second. Background debt/chunk semantics and snapshot stop-and-discard remain unchanged; no simulated months, RNG draws or committed world state are skipped.
- Added debug-only session foreground accumulator/raw input/scaled time/cap/debt/drop counters and the last 20 incidents with world month, focus/visibility, cached minimized observation, save phase and selected Tab. These observations do not enter V9 or consume RNG. Background catch-up debt remains separately labelled.
- Aligned frame performance and attribution to rolling 300-frame windows and labelled long-frame/frame-count counters as session cumulative. Both observe Phaser rawDelta; the simulation still receives the existing smoothed Scene delta. Raw/driver/scaled deltas are distinct in debt diagnostics. Electron already used backgroundThrottling:false, so focus/minimize/suspend/runtime policy is unchanged and configuration is covered by tests.
- APP_VERSION v0.99927b3 / package 0.99.106; WorldSave V9 and IndexedDB 2 unchanged. No history/filtering/disposal/physics/balance/diplomacy/revolution/name/era changes; City founding and Save were audited as possible stall triggers without being rewritten.
- Mandatory real Electron Gate: Stage A new world4× to1000–1500 years, focus-away/return and Save/autosave recovery observation; only after Stage A passes, Stage B the ~4228-year V9 save4× for100–200 years with Tab/Save-Load/checkpoint checks. Stop before v0.99927c until the user returns results. After this Gate passes, end the performance audit and proceed only under the next user task to Dynastic Revolution Calibration.

## v0.99927b2

- Recorded the user’s v0.99927b1 manual disposal pass: a new Electron debug world ran at 4× to approximately 1962 years, with no Group.preUpdate size fatal, Renderer Fatal or stalled disposal. At 768/1962 years all disposal/orphan invariants remained normal and live/registered user group counts matched 56/58 live users. The validated lifecycle is unchanged.
- Measured full-history sorting/copying on every append at 1k/5k/20k events, including the always-mounted ChapterBanner subscriber. Runtime UI now subscribes to revisions or appended records; canonical insertion-order events remain complete. Derived ordered indices handle stable equal-month ordering and retrospective inserts. HistoryScroll queries bounded windows with complete month/group chains for paging, era and faction filters; complete archives remain available for biographies and explicitly opened world records.
- Measured 254 full-history narrative scans at 5k events with 250 collapse anchors; derived month/group candidates reduce this to four scans without changing predicates, source event order or narrative facts. 150 deterministic mixed fixtures matched the baseline implementation exactly.
- Added bounded debug frame timings for Core/fixed/physics/simulation/checkpoint/visual sync/presentation subphases/validation/history notification/UI query and an explicitly approximate unattributed frame residual. Nested timings overlap. Save export/serialize/write phase and existing save durations are exposed; no renderer monkey patch or timeout change.
- Cached only the current-ruler array position using a derived WeakMap, reset on hydration. The complete ruler archive, candidate selection/order, RNG and monthly update semantics remain unchanged. Structural tests compare the cache with linear lookup.
- APP_VERSION v0.99927b2 / package 0.99.105; WorldSave remains V9, IndexedDB remains 2. Gameplay/balance/diplomacy/revolution thresholds and probabilities/history retention/historical identity/lifecycle are unchanged.
- Mandatory real Electron Gate: Stage A new world 4× to 1000–1500 years with diagnostics at ~500/~1000/~1500 and History paging/tab comparisons; only after no regression, Stage B the ~3451-year V9 save for at least 500 continuous years with initial/final diagnostics, autosave/Save-Load/checkpoint/resource checks. Automated checks do not replace this Gate.

## v0.99927b1

- Confirmed the reported Dit symbol is Slaves in the v0.99927b desktop debug source map; its inherited Phaser 3.55.2 Group.preUpdate reads children.size. Group.destroy clears children without deactivating the group, while UpdateList removal is queued. ProcessQueue removes active entries before pending insertion, reproducing an active destroyed group and the same undefined.size fatal.
- User death now immediately terminalizes Slaves (inactive, no child updates, no collider or owned units) and queues final destruction at that Scene's POST_UPDATE, after UpdateList and Core scene.update. Core disposal ownership/pending sets are deduplicated, bounded by registered runtime user groups, drained each frame and cleared at quiescent reset/hydration; they never enter saves or draw RNG. Final destruction detaches pending insertion so removal cannot be followed by zombie activation. Quiescent hydration uses the same safe handling for farm groups.
- Upgraded lifecycle tests to the installed real Phaser Group/UpdateList/ProcessQueue event order, including the failing old sequence, in-iteration death, pending activation, 100 simultaneous/repeated deaths, transfer reset, repeated hydration and same-seed digest/RNG checks. Runtime Lifetime now reports actual live user groups, deferred count/peak/frame age and non-fatal invariant warnings; inactive pending disposals are distinct from orphan groups.
- Preserved v0.99927b terminal faction collider release, Clock timer release, destroyed City Graphics guard and phase profiling. No performance/gameplay parameter, autosave timeout, Canvas/WebGL or history-retention changes. APP_VERSION v0.99927b1 / package 0.99.104; WorldSave remains V9.
- The user's worldMonth=114 Renderer Fatal blocks the v0.99927b Gate. Mandatory real Electron Stage A: new world at 4× for 100–150 years without Save/Load; only after that passes, Stage B: the approximately 3451-year V9 save at 4× for 800–1200 continuous years. Automated lifecycle tests do not replace either manual Gate. See docs/RuntimeDisposalLifecycle.md for source-map/lifecycle evidence.

## v0.99927b

- Measured a reproducible runtime leak: the previous User death path reset Slaves, recreating a collider and retaining an empty Phaser update-list group for each dead user. A 100-death structural reproduction retains 100 groups/colliders; terminal disposal now retains zero. Transfer resets still retain one valid live group/collider. Slave tree disposal also unregisters actual units and removes stale parent edges.
- Core now owns faction collider registrations and releases empty terminal sources/targets at extinction/merger, preserving any actual territory/units and exiled remnants. Phaser 3.55.2 pending insertion is detached before owned collider destruction to prevent dead pending entries becoming permanent active-queue references. Hydration detaches ownership after world teardown without double destruction.
- Farm termination explicitly removes timers from Clock rather than only nulling callbacks; timer DTO counters remain intact. Core's store-refresh timer registration replaces its owned prior event. Destroyed City visuals cannot be recreated by stale refresh calls; existing archive/interaction teardown is retained.
- Added debug-only Long-Run Runtime Lifetime counts: session months/steps, display and nested object types, bodies, collider queues/references, timers, scoped listeners, cities/zones/index, groups/players, orphaned user groups, subsystem collections and optional heap. These observations neither drain engine queues nor consume RNG nor enter saves.
- Debug/development builds aggregate City, Population and WorldEvent phases into monthly bounded 300-sample rolling timings. Nested subphases are included in their parent times and must not be summed twice. Canonical update ordering/frequency is unchanged.
- APP_VERSION v0.99927b / package 0.99.103; WorldSave remains V9 and IndexedDB remains 2. No diplomacy, population/rebellion balance, ruler hazards, revolution gates/odds, history retention or historiography changes; autosave timeout unchanged.
- Structural tests locate concrete resource accumulation; they do not prove that all observed City/Population slowdown is resolved. Real Electron 4× 800–1200-year continuous-session Gate from the user's approximately 3451-year V9 save remains required, with pre/post-load diagnostics if slowdown recurs. No next version before user feedback.

## v0.99927a

- Fixed ruler-biography diplomacy summaries that resolved old participants and common threats through current displayName. Biographies, faction chronicles and HistoryScroll diplomacy narratives now resolve the event month through shared historical identity presentation; colored history uses month-specific color history, including common-threat tokens.
- Added debug-only cumulative, independent succession gate counts and blocker frequencies, plus the ten latest fully eligible boundaries with faction/month/stability/evidence/reason/successor age in months. Observations consume no additional RNG, do not enter save DTOs, and reset on new world/load. Counts are independent gates, not a sequential funnel; full eligibility requires all gates.
- Royal house epochs now have one current/history presentation, full historical month ranges and no redundant epoch headers in the ruler list. Rare reign statistics show only positive counts, with a neutral empty message; assessment evidence is untouched.
- APP_VERSION v0.99927a / package 0.99.102. WorldSave remains V9, IndexedDB remains 2, stability <=25 and the 4% usurpation draw remain unchanged. No battlefield risk, diplomacy gameplay, population or posthumous/temple-name rule changes.
- The user's approximately 980-year v0.99927 run verified natural house succession (姬氏→廖氏, 439年11月) but observed zero true usurpations; the full Dynastic Revolution Gate is still pending. v0.99927a requires a real new-world Electron 4× 800–1200-year Gate with cumulative diagnostics. Do not tune gates or odds without user review.

## v0.99927

- Added succession-boundary Dynastic Revolution for ACTIVE states with a living recorded legitimate successor, stability at most 25, and an existing succession crisis. Eligible boundaries draw once at 4% using WorldRandom; ineligible boundaries spend no revolution draw. Minor succession reuses existing crisis weighting, while historical chain evidence counts only real transitions.
- Authoritative house epochs distinguish founding, natural heirless house succession, and usurpation. Displaced legitimate heirs remain living archive/genealogy records, leave the current candidate pool, and never become fabricated parents of the usurper. Natural NEW_HOUSE keeps the existing regime name and banner.
- True usurpation reuses the formal state-name generator and historical deduplication, preserves faction IDs/diplomacy, and records name/color history. Current blocks, ruler/unit rings and city zones refresh; historical event tokens/charts resolve month-specific colors and captured Era palettes remain intact. Ruler archives record the real regime name at reign end so same-month usurpation does not relabel the predecessor’s historical title; posthumous/temple-name judgments are unchanged.
- Added factual, featured dynasty-usurped events, ruler chronicle inclusion, royal house epoch dividers, usurper/displaced-kin badges, and observational revolution counts/latest event/candidate and last-boundary blockers without RNG consumption.
- WorldSave is V9 for epochs, displaced lineage and banner history. V8 and older are rejected without migration; IndexedDB remains version 2. Battlefield exposure, ruler death risks/cooldowns, combat/population balance, diplomacy mechanics and posthumous/temple-name rules are unchanged.
- v0.99926b1 manual Battlefield Exposure Gate passed in the user's approximately 520-year new-world run. v0.99927 requires a new-world Electron 4× 600–1000-year Dynastic Revolution Gate; automated checks do not replace it. If no usurpation occurs, return blocker diagnostics without lowering thresholds.

## v0.99926b1

- Personal battlefield exposure now comes only from accepted City siege contacts carrying the current ruler's actual RULER id. A canonical lastPersonalSiegeContactMonth survives monthly contact clearing and is valid only in the contact month and following month; faction-wide or unrelated sieges no longer imply personal participation.
- Ordinary capital siege alone no longer enables battlefield death checks for any rank. Existing severe capital-crisis and captured/final-collapse paths remain intact. Risks (LEADER 0.35 / KING 0.25 / EMPEROR 0.08), 12-month hazard interval, accession grace and chain cooldown are unchanged.
- Added completed-ruler diagnostics grouped by recorded sovereignty rank at accession, with combat ratios and tenure median/range; current faction titles never rewrite historical rank. Shared transition months use the latest recorded rank, missing evidence remains unclassified, and provisional session/recent-100-year summaries remain available.
- WorldSave is V8 for personal exposure state; V7 and older saves are rejected without migration. IndexedDB remains version 2. No other gameplay, rendering, historiography, or UI features changed.
- Required new-world Electron 400–600-year Battlefield Exposure Gate remains pending.

## v0.99926b

- LEADER ordinary collisions no longer imply battlefield fatality context. Eligible siege/capital-siege hazards use a 0.35 risk instead of guaranteed death, remaining above KING 0.25 and EMPEROR 0.08.
- Added per-ruler canonical hazard check months: All ranks check at most once per 12 game months, preserving the higher cumulative hazard of LEADER under comparable exposure. Ineligible contacts spend no draw or hazard window. Existing severe capital-collapse and captured-ruler terminal paths remain intact, as do accession/chain protection and non-hereditary LEADER_SUCCESSOR rules.
- WorldSave is V7 to preserve hazard cooldown deterministically across hydration; V6 and older saves are rejected without migration. IndexedDB remains version 2.
- Added session-only completion baselines (reset on new world/load) and recent 100-year provisional-ruler completion summaries, including combat ratios, tenure range/median, and up to five anomalous factions; cumulative history remains available.
- No diplomacy, combat/population tuning, Dynastic Revolution, rendering pipeline, history retention, or unrelated UI changes. Required Electron survival gate remains pending.

## v0.99926a4

- Bounded diagnostic previews now use incremental container frames and global reference deduplication, with depth/node/item/key/output budgets and guarded property/enumeration access. Core fields fail independently.
- Core, full, and hydration clipboard reports are generated only on copy clicks; diagnostic panel rendering no longer eagerly builds them.
- Added a local diagnostics panel error boundary with reset and console logging; panel failures do not invoke the global renderer fatal pause.
- Preserved Phaser input compatibility, snapshot-month autosave titles, iterative/on-demand genealogy, HistoryScroll memoization, debug source maps, and DOM/map input isolation. No gameplay, RNG, WorldSave V6, balance, or history-retention changes.
- Automated validation does not replace the required 2004-year-save Electron long-run manual gate.

## v0.99926a3

- Backported Phaser 3.60's null-camera and missing-render-list input sorting guards to the pinned Phaser 3.55.2 InputPlugin, installed idempotently before game creation and guarded by the exact engine version.
- Autosave titles now derive from the stored snapshot world month rather than the scheduled boundary; newly created autosaves no longer persist the boundary as a user-facing label.
- No gameplay, physics, WorldSave schema, Canvas/WebGL renderer, diplomacy, or ruler-survival changes.

## v0.99926a2

- Source-map analysis traced the reported recursive stack pattern to diagnostic serialization; full diagnostics now serialize deep and cyclic values iteratively.
- Political genealogy construction now uses iterative, cycle-safe traversal and runs only when the full genealogy dialog is opened; the Royal view no longer builds or embeds a second genealogy tree.
- History Scroll dynasty refresh now follows history changes rather than every world month, and the 200-event presentation subtree is memoized independently from live era/month headers.
- Fatal crash reports include current dynasty ruler count and included genealogy node/depth diagnostics; the last simulation subsystem is explicitly labeled as context, not crash-source attribution.
- No gameplay, diplomacy thresholds, history retention, or WorldSave V6 changes.

## v0.99926a1

- Added source maps to the dedicated Electron debug renderer build only; regular Desktop and release/package builds remain without renderer maps.
- Added fatal renderer/window/rejected-promise and React ErrorBoundary diagnostics with full stack, paused-world crash screen, and Electron terminal reporting.
- Replaced recursive Player/Npc tree propagation, destruction, and diagnostics traversal with iterative traversal, including cycle/revisit and depth metrics.
- Replaced large-array spread extrema in long-run/history diagnostics with iterative reductions; genealogy builder already guards malformed parent cycles and now has explicit cycle coverage.
- Added debug runtime subsystem marker and Electron Canvas2D / bad-image warning counters. No gameplay, WorldSave V6, diplomacy thresholds, or history retention changes.

## v0.99926a

- Added bounded debug-only rolling timings for monthly simulation subsystems and reduced profile-only scale scans to LongRunProfiler snapshot months while preserving monthly bottleneck accumulation.
- Added debug summaries for same-origin alliance absorption blockers, long-run world scale, and provisional-ruler outcomes by faction; these remain observational and are not persisted.
- Throttled repeated identical Electron renderer warnings with periodic repeat summaries while preserving immediate errors and distinct warnings. Audited Canvas readback sources; no project-owned `getImageData` caller was found, so no context option or renderer path was changed.
- No diplomacy/union thresholds, ruler survival, history retention, gameplay, or WorldSave V6 changes.

## v0.99926

- Added finite strategic alliances after a sustained non-aggression pact and a shared, territorially or historically relevant strategic threat; alliance signing/expiry is recorded in WorldHistory and signatory ruler chronicles.
- Added conservative same-origin administrative absorption after a long alliance, current border adjacency, a prolonged bilateral-war-free period, clear territorial/city asymmetry, and continuing common pressure or an exceptionally weak faction. City, territory, and population transfers are administrative; absorbed factions and dynastic archives remain recorded with an explicit MERGED terminal outcome, not an extinction/death narrative.
- Added provisional-leader combat-death and completed-tenure debug metrics. WorldSave schema is V6 for alliance and merger state; V5 and older schemas are rejected without migration. No gameplay tuning, ruler historiography, or Dynastic Revolution changes.

## v0.99925a

- Extended truces to 36 months and non-aggression agreements to 96 months; agreement terms and dates are rendered from their recorded month ranges.
- Diplomacy signing history now records the actual trigger evidence and both signatory rulers' historical titles; signing events appear in signatory biographies with moderate priority.
- Added compact active treaty badges to faction ranking and full signing/expiry terms to faction overview; ordinary truces remain normal significance while common-threat non-aggression events are major but not landmarks.
- No alliance, union, gameplay balance, or WorldSave schema changes.

## v0.99925

- Added canonical, symmetric bilateral diplomacy with finite truces and non-aggression pacts, periodic fact-based formation rules, expiry, and WorldHistory records.
- Routed hostile occupation and siege contact/damage through diplomacy permission while leaving administrative ownership, revolt, restoration, and hydration paths outside the gate.
- Persisted active agreements and evaluation month in WorldSave V5; V4 and older schemas are rejected without migration. Added faction overview and debug diplomacy diagnostics.
- No alliance, shared war obligations, merger, gameplay balance, or frozen ruler historiography changes.

## v0.99924h4d

- Isolated Phaser map pointer handling to native events whose down/up/move target is the current game canvas and require a valid canvas down/up sequence before map selection.
- Added debug-only last map-pointer target, acceptance reason, selected-faction, and right-panel before/after diagnostics.
- No genealogy dialog, succession, WorldSave schema, or gameplay changes.

## v0.99924h4c

- Rebuilt the full genealogy viewer with the same standard MUI Dialog, DialogTitle, and DialogContent pattern used by the manually verified Era Atlas viewer; the dialog host and open state now live in FactionProfile outside the keyed dynasty tree.
- Added debug-only genealogy viewer lifecycle diagnostics, including the actual MUI close reason and explicit, Escape, backdrop, faction-change, or host-unmount source.
- No succession, genealogy data, WorldSave schema, or gameplay changes.

## v0.99924h4b

- Replaced the genealogy Dialog with MUI Modal + ClickAwayListener + Paper: all Paper interactions remain open, while outside clicks, Escape, and the explicit close button close it.
- Predeceased succession-candidate commentary now reports the actual count instead of a fixed “two” phrase; it does not imply formal designation.
- No succession rules, genealogy data, WorldSave schema, or gameplay changes.

## v0.99924h4a

- Restricted genealogy dialog close behavior to explicit close, Escape, or a backdrop click whose event target is the backdrop itself; dialog content, canvas, nodes, and controls do not close it.
- No succession, genealogy data, WorldSave schema, or gameplay changes.

## v0.99924h4

- Kept the genealogy preview toolbar fixed within the faction-details column and placed the tree in its own horizontal scroll viewport.
- Replaced the full-screen genealogy view with a large centered dialog featuring bounded zoom, fit-to-window sizing, current-ruler location, and centered layout for smaller trees.
- No succession rules, WorldSave schema, gameplay, or ruler historiography changes.

## v0.99924h3

- Added a single age-eligible dynastic bootstrap candidate for initial rulers even in one-city/crisis starts; later crisis periods still do not expand candidate pools.
- Restricted active candidates and normal succession to recorded children, grandchildren, siblings, nephews, uncles, and cousins; distant collateral kin now use the existing house/leader succession fallback.
- Pruned political genealogy presentation to rulers, current/designated/active candidates, and connecting ancestors; added a full-screen scrollable genealogy viewer and removed the textual succession-line list. WorldSave remains V4; no gameplay balance, posthumous, or historiography rules changed.

## v0.99924h2

- Active succession candidates are now capped by political stage (PROVISIONAL 2, STATE/KING 4, STATE/EMPEROR 6); living relatives outside the shortlist remain recorded as kin, and shortlist/designation are reevaluated for each new ruler.
- Same-tier succession prefers the older recorded birth month; recorded parent links now distinguish nephew, uncle, and cousin relationships where evidence supports them.
- Genealogy now exposes separate bloodline and succession edges, including cross-branch succession, and uses recorded chronicle facts for node labels. WorldSave is V4 for the canonical living-kin status; V3 and older saves are rejected without migration, and no gameplay balance rules changed.

## v0.99924h1

- Distinguished one formally designated heir from the bounded pool of other same-house succession candidates, with designation date persisted for accurate tenure display.
- Added relationship-grounded heir/candidate labels, succession-background summaries, and a political genealogy tree built only from recorded parent links and rulers/candidates.
- Bumped WorldSave to V3 to persist canonical heir designation; no migration is provided, and succession selection, candidate limits, and seeded RNG behavior remain authoritative.

## v0.99924h

- Retained a bounded set of living, relationship-grounded same-house succession candidates and prioritized direct children, grandchildren, siblings, then recorded collateral kin before the existing new-house fallback.
- Added explicit succession relation labels and history wording for grandchildren and siblings; candidate selection ties use the seeded world RNG.
- Bumped WorldSave to V3 to persist the designated heir and appointment month alongside the existing candidate and parent-reference graph; V2 is rejected without migration. No gameplay balance, diplomacy, or frozen historiography changes.

## v0.99924g1

- Unified each manual Arcade physics fixed tick on Phaser's `World.update()` lifecycle, followed by `World.postUpdate()` body synchronization; physics time is now synthetic and derived only from fixed simulation steps, including after hydration.
- Added bounded debug-only decade fingerprints of faction status/population, city and territory ownership, current rulers, and world RNG state/position; fingerprints are not saved and do not affect simulation.
- No logical gameplay authority switch, gameplay tuning, or WorldSave schema change (schema remains V2).

## v0.99924g

- Added a world-scoped `mulberry32-v1` random stream and optional user-specified world seed; debug diagnostics expose the seed, algorithm, and draw position.
- Routed canonical simulation, population, faction, succession, naming, and initial unit-velocity random decisions through the seeded stream; presentation-only randomness remains separate.
- Bumped WorldSave schema to V2 to persist the seed and RNG state/position; V1 saves are rejected without migration, and the IndexedDB database layout version is unchanged.
- No population balance, WorldEra threshold, frozen ruler-history, music, or gameplay-rule changes.

## v0.99924f

- Added a bounded, session-only Population Transition Audit that attributes known spawns, transfers, removals, and restoration changes, then reconciles monthly faction `users.size` deltas and records unexplained differences as `UNATTRIBUTED`.
- Added recent significant population changes to the debug diagnostics; audit data is not authoritative, does not enter WorldSave, and does not modify population rules.
- Removed rejected soundtrack files from `public/music/` and moved the inactive Night Shift candidate to `dev-assets/`; active/pending catalog assets remain bundled.
- No population balance, WorldSave schema, historiography, or diplomacy changes.

## v0.99924e

- Added an application-layer ambient music runtime that maps confirmed WorldEra types to three moods, rotates same-mood tracks, and crossfades on mood changes after a user gesture.
- Added persistent application-only BGM enable/volume preferences and a Settings runtime-version display sourced from `APP_VERSION`.
- Revised the Alpha soundtrack catalog after user audition: MENU is intentionally silent, Ninja Theme is the TENSION candidate, Treasure Hunter and Asianoriental1 are ORDER candidates, and Asianoriental2 remains provisional for PEACE.
- Marked rejected and reserve audio in asset attribution without deleting files; no playback-engine, gameplay, WorldEra-threshold, or WorldSave-schema changes.

## v0.99924d5

- Founder battle-death wording now uses the recorded time from formal state/faction founding to death before describing a founding as recent.
- Removed unsupported claims that a newly founded state or provisional faction had unfinished political integration; later founder deaths receive neutral, evidence-grounded wording.
- Kept provisional faction founders distinct from formal state founders; no gameplay, posthumous-rule, or WorldSave schema changes.

## v0.99924d4

- Prioritized very large territorial expansion over generic tragic-death commentary, with expansion as the main judgment and battle death only as a closing outcome.
- Removed unsupported “premature”/“sudden” age implications from ordinary expansion-and-tragedy wording; short-reign tragic phrasing remains gated by short-reign evidence.
- No gameplay or WorldSave schema changes.

## v0.99924d3

- Prevented STEWARD from overlapping with meaningful expansion; assessment, tags, and historian voice now prioritize EXPANDER, including explicit large-scale territorial gains.
- Added a semantic-dominance override to the immediate generic-epithet diversity gate: a strong repeated epithet remains eligible when alternatives are substantially weaker, while close-score alternatives still support diversity.
- Distinguished faction founders from state founders in ruler relationship/lineage labels and expansion scale wording, using the ruler's recorded state-founding evidence and state-formation timing rather than current faction naming.
- World Records historical identity behavior remains on the d2 shared resolver and is covered by regression tests; no save schema or gameplay changes.

## v0.99924d2

- Added a same-dynasty immediate-repeat gate for common posthumous epithets; an evidence-supported alternative takes precedence, disaster epithets may repeat, and a repeat is allowed only at the explicit semantic-override score.
- Distinguished provisional faction founders from formal state founders in assessments, battle-death conclusions, and “史家曰”; only formal state-foundation evidence receives “开国” wording/tags.
- Composed young-accession and accession-crisis wording without repeating “承统”, and added deterministic mixed/contested-reign commentary plus broader stable-hash wording variants.
- World Records ruler labels use historical faction names and sovereignty ranks at the relevant record month, with a shared display resolver for living leaders, kings, emperors, and posthumous identities.
- No gameplay tuning, WorldSave schema, or succession-mechanics changes.

## v0.99924d1

- Split founder-expander “史家曰” into evidence-gated variants: governance-cost wording appears only when `governanceCost` is true; otherwise the commentary stays with founding and expansion achievements.
- No gameplay, epithet, save-schema, diplomacy, or simulation changes.

## v0.99924d

- Gated stable-governance credit, long-stability posthumous candidates (including 顺), and stewardship roles on contraction-adjusted evidence; raw stability values remain unchanged for display/gameplay.
- Refined accession-crisis classification and made crisis-plus-expansion assessments acknowledge both inherited weakness and subsequent expansion; inherited-high retreat with a stable residual core is not described as a ruler-created peak.
- Strengthened dynasty-local soft epithet diversity while retaining evidence-based repeats; military epithets now require corresponding personal/conquest evidence.
- Added deterministic, finalized-ruler-only “史家曰” commentary from derived historical evidence, without personality claims or persisted data.
- No gameplay balance, WorldSave schema, dynasty mechanics, or era-rule changes.

## v0.99924c

- Split left-panel status counts into founded states (active/exiled/extinct) and currently active provisional factions; the faction ranking still includes all active factions.
- Kept non-accessed heirs in dynasty data while moving the main dynasty list to formal rulers, showing living heirs compactly, and recording a structured heir-death event in the parent ruler's chronicle.
- Rendered city history from structured ownership/ruler IDs and the faction/ruler identity at the event month; old incomplete entries retain their frozen-title fallback.
- Added controlled Settings dialogs from the main menu and world menu, with Desktop suspend policy kept in app-local settings and Save Manager remaining separate.
- No gameplay tuning, WorldSave schema, era rules, or succession mechanics changes.

## v0.99924b1

- Recreate the world-launch runner when a new launch/load request arrives, so in-game slot loads hydrate in the already-mounted application.
- Keep the live world and history intact until the hydrator's preflight succeeds; failed preflight leaves the old world available, while post-teardown failure does not resume it.
- Replace Electron-incompatible `window.prompt` rename with an inline MUI editor, trimmed non-empty names, and a 64-character limit.
- Opening the in-game Save Manager pauses the current world; ordinary close restores its prior running state and speed, while a load keeps the newly hydrated world's state authoritative.
- No save-slot policy, WorldSave schema, or gameplay changes.

## v0.99924b

- Added IndexedDB multi-slot persistence with a metadata-only slot index; the existing `current` record is preserved and inferred as `RECOVERY` during the v1→v2 database upgrade, without changing WorldSave schema V1.
- Added UUID-based manual saves, rename/delete/load management, newest-valid Continue fallback, and two rotating game-time autosaves at 200-year boundaries.
- Kept five-real-minute Desktop autosave and close-save on the `current` Recovery slot; all save destinations reuse the active-world persistence authority and exclusive snapshot workflow.
- No gameplay balance, simulation rules, canonical save schema, or packaged app identity changes.

## v0.99924a

- Added electron-builder packaging with stable appId/executable identity, asar runtime file filters, macOS arm64 DMG/ZIP targets, Windows x64 NSIS target, and a manual artifact-only GitHub Actions workflow.
- Added a stable packaged `Wanguoji` userData profile, production-only restrictive CSP, sandboxed BrowserWindow, denied popup/unexpected navigation, and standard application menus with DevTools only in development/diagnostic launches.
- Added temporary application icons and optional environment-driven signing/notarization configuration; no credentials or automatic Release publishing are included.
- WorldSave schema V1 and gameplay/simulation rules are unchanged. Installed-app IndexedDB persistence and packaged endurance require manual macOS acceptance; Windows artifacts are not Windows-device validation.

## v0.99924

- Added fixed-capacity rolling frame diagnostics (frame delta percentiles, long-frame counts, simulation steps/frame, and CPU samples) plus world/history scale counters for long-run comparison.
- Split save timing into safe-boundary wait, export/serialization, IndexedDB write, and total duration without changing the save boundary or persistence workflow.
- Added an opt-in Desktop PNG probe for the shared `noFace` texture; production/default remains SVG, and no renderer/plugin/Phaser upgrade or gameplay change was made.
- Promoted Electron from a background probe to a continuous runtime foundation with single-instance activation, product window title, 5-minute IndexedDB autosave, and save-before-close protection.
- Added main-process heartbeat/autosave/suspend diagnostics and explicit OS suspend catch-up using the existing bounded Web catch-up debt calculation; ordinary Desktop visibility changes still create no debt.
- Kept the existing renderer simulation driver, save validator/hydrator, WorldSave schema, and all game rules unchanged.
- Electron remains unpackaged and requires manual macOS/Windows runtime verification.

## v0.99923d2

- Provisional `LEADER_SUCCESSOR` history now preserves combat death, natural death, or execution after capture, and uses “继任首领” rather than dynastic succession wording.
- Reworked provisional succession descriptions and ruler-detail labels to distinguish non-hereditary leadership from direct lineage; formal direct-child and new-house wording remains unchanged.
- No succession mechanics, history schema, simulation, Era Atlas, World Records, or Historiography changes.

## v0.99923d1

- Added an explicit Era detail collapse action that clears Era selection and restores unfiltered HistoryScroll events.
- Toggling the selected timeline Era now deselects it; switching/closing Era selection also closes any open map dialog, while collapsing the timeline list preserves the selected Era.
- No Era map data, classification, simulation, World Records, or save-schema changes.

## v0.99923d

- Added one immutable logical ownership map snapshot when a WorldEra is confirmed, timestamped at `confirmedMonth` and encoded as deterministic row-major palette-index RLE with frozen historical faction names/colors and city markers.
- Added snapshot-only Canvas thumbnail/full-map rendering in HistoryScroll, an explicit pre-Atlas fallback for old eras, and debug size/run diagnostics; no screenshots are stored.
- Extended optional WorldEra save data and validation without changing WorldSave schema version; old eras without snapshots remain valid.
- No Era classification, WorldCycle, combat, defense, playback, or World Records rule changes.

## v0.99923c

- Added derived ruler tenure evidence separating total succession tenure, active rule, and exile; lifecycle counting uses faction exile/restoration events only and deduplicates grouped events.
- Updated ruler biographies, current-ruler summaries, posthumous evaluation, and tags to use shared exile-aware historiography evidence; tags no longer maintain separate expansion/decline/steward thresholds.
- Refined exile, restoration, inherited-crisis, and founder battle-death assessments without changing canonical history or save schema.
- No WorldCycle, combat, defense, playback, naming, World Records, or era-rule changes.

## v0.99923b

- Expanded live-derived World Records with ruler, polity, city, and era curiosities, reusing Historiography evidence and historical identity resolvers.
- Added grouped-event deduplication, city turnover/capital-fall records, normalized major-event era density, and deterministic tied-holder presentation.
- Grouped the HistoryScroll records into compact sections with per-section expansion; derivation remains lazy while the records panel is closed.
- No simulation balance, historiography wording, or save-schema changes.

## v0.99923a

- Route all future no-heir dynasty replacements through the existing weighted surname generator, including formal-state `NEW_HOUSE` succession; saved identities remain untouched.
- Refined posthumous epithet semantics for child rulers facing brief terminal crises, peaceful long reigns, territorial expansion, and personal military evidence; added graded recency/frequency penalties.
- Corrected assessment language to distinguish inherited high-position decline from a ruler-created peak, identify moderate recovery, and scale expansion claims to absolute territory share.
- No World Records expansion, simulation-balance changes, or save-schema changes.

## v0.99923

- Replaced ruler fact-list assessments with deterministic, evidence-derived historiography covering political role, peak-and-retreat, forced capital loss, state collapse, succession shocks, and inherited crisis.
- Added a shared render-time ruler evidence API and living-ruler “在位评议”; no persistence schema or simulation balance changes.
- Stopped personal city captures from being recorded as a ruler’s death location.

## v0.99922e2

- Based on v0.99922e1, increased only the base city defense value from 3 to 5.
- Shifted fortified-zone thresholds to preserve the previous map geometry at the correspondingly increased defense values; siege, capture, new-city defense initialization, and save-schema behavior remain unchanged.

## v0.99922e1

- Replaced flat temple-name score competition with historical role precedence for founders, first emperors, early imperial consolidators, restorers, renewal rulers, and mature/stable reigns.
- Derived imperial ordinal from ruler reign intervals and faction sovereignty history; `reignOrdinal` no longer stands in for emperor sequence.
- Preserved dynasty-level temple-name uniqueness with same-role fallbacks; existing finalized ruler titles and save schema are unchanged.

## v0.99922e

- Increased the shared foreground/background base playback rate from 1.5 to 2.0 while preserving 1×/2×/4× controls, the 30 Hz fixed-step authority, and the foreground step cap.
- Added runtime debug playback-rate diagnostics; selected speed and save schema remain unchanged.

## v0.99922d

- Separated posthumous-name evidence into expansion, military, governance, disorder, and terminal-outcome dimensions; demographic collapse alone no longer qualifies a ruler for 灵.
- Replaced the global temple-name score cutoff with role-based eligibility and dynasty-unique role candidates, including strict 成祖 conditions.
- Added objective accession-age wording, mixed expansion/governance-cost assessment, and session-only Historical Echo denominators.
- Enforced CityNameRegistry reservations at City construction and added active-city registry consistency diagnostics without changing save schema.

## v0.99922c

- Expanded and categorized historical city-name candidates, with weighted category and candidate selection instead of fixed array order.
- Added soft diversity penalties for recent suffixes, similar forms, and known historical aliases while preserving world-wide reserved-name uniqueness.
- Added session-only city-name generation diagnostics without changing save data.

## v0.99922b1

- Removed inferred “last city” details from capital-transition narratives.
- Restricted collapse-group membership to the collapsing faction and preserved explicit final-city evidence only.
- Made grouped HistoryScroll details aware of capital-transition versus faction-collapse semantics.

## v0.99922b

- Added capital relocation context with old/new capital, cause, conqueror, and ruler evidence.
- Grouped capital fall and relocation into one retrospective history narrative while preserving raw events.
- Added parentId-based royal lineage display and retrospective ruler title resolution for HistoryScroll.
- Suppressed ephemeral succession clauses when a collapse reaches final extinction.

## v0.99922a

- Corrected non-HAN ruler names to use curated atomic given-name pools without clan-prefix duplication.
- Reworked runtime surname generation into explicit culture/category selection with weighted HAN reuse penalties and rare minority/compound rates.
- Added session-only name culture, surname, and Historical Echo diagnostics without changing save schema or existing identities.

## v0.99922

- Added low-frequency Historical Echo state naming with weighted cultural affinities.
- Added lightweight name-culture derivation and distinct minority-culture ruler name pools.
- Preserved existing faction, dynasty, ruler, and WorldCycle persistence semantics.

## v0.99921h

- Unified ordinary and de facto state formation under one continuous eligibility timer.
- Applied unified administrative strain protection consistently to Empire Split and city loyalty paths.
- Added Dynastic Order continuity, sole-blocker, provisional, and top-empire stability telemetry.

## v0.99921g

- Added cumulative Dynastic Order blocker and top-empire stability/strain diagnostics.
- Unified consolidation administrative strain semantics across Empire Split and city loyalty recovery/decay.
- Added bounded runtime-only administrative protection for the actual consolidation momentum owner.

## v0.99921f

- Separated literal one-polity monopoly from persistent Dynastic Order semantics.
- Added independent literal-monopoly and Dynastic Order profiler episodes and diagnostics.
- Added dynastic internal-pressure telemetry without changing fatigue parameters.
- Fixed historical naming for capital-relocated rendering.

## v0.99921e

- Added cumulative consolidation bottleneck telemetry for long-run measurement.
- Added bounded late-fragmentation pressure and consolidation memory floor without changing post-unification fatigue balance.
- Added a constrained de facto state-formation path for durable large provisional powers.
- Fixed capital-relocated history rendering to resolve the faction name at event month.

## v0.99921d

- Rebased session-only profiler latches after hydration so snapshot/restore does not duplicate cycle or era transitions.
- Corrected initial fragmented baseline and same-type MULTIPOLAR stale diagnostics semantics.
- Separated momentum candidates from owners and restricted strategic modifiers to the actual momentum owner.

## v0.99921c

- Fixed Phaser ProcessQueue teardown for colliders destroyed while still pending, with explicit stale-collider diagnostics.
- Preserved Era stale diagnostics start time across consecutive mismatched observations.
- Added regression coverage for hydration teardown lifecycle edge cases.

## v0.99921b

- Removed duplicate historical ruler names from World Records and strengthened empty-era title fallbacks.
- Improved evidence-based ruler assessment and compact biography title/legacy presentation.
- Reworked faction ranking rows into a denser two-line layout while preserving canonical ordering and WorldCycle balance.

## v0.99921a

- Corrected WorldCycle family telemetry and paired completed unified/fragmented episodes for long-run summaries.
- Fixed World Records historical ruler and era naming, added lazy record derivation, and reversed era presentation order.
- Polished dynasty presentation ordering and compact faction-ranking identity layout without changing canonical order or cycle balance.

## v0.99921

- Kept confirmed WorldEra chapters authoritative while replacement candidates mature, preventing unexplained historical gaps.
- Added competitive chapter minimum-age handling, hard-transition precedence, profiler transition telemetry, and debug-only long-run summary metrics.
- Preserved WorldCycle as the causal simulation layer without changing its balance parameters.

## v0.99920b

- Corrected provisional leader succession to create an unrelated dynasty house when no usable heir exists.
- Grouped capital loss and relocation under a shared transition history group when relocation actually succeeds.
- Added an injectable low-frequency classical prestige branch to future state naming while preserving organic naming and existing names.

## v0.99920a

- Unified WorldEra rendering around authoritative era records and confirmed-month faction naming.
- Made faction chronology city captures self-explanatory from the viewed faction perspective.
- Added historical ruler display resolution, formal-record eligibility, posthumous assessment context, longer ChapterBanners, and more readable city tooltips.

## v0.99920

- Added shared ruler legacy evidence and score classification for ruler identity, significance, and historical presentation.
- Expanded given-name material with soft recent-token avoidance while preserving injected deterministic rolls and existing saved names.
- Preserved mandatory ruler landmarks in chronicle selection, added optional full-event viewing, and merged repeated posthumous evidence reasons.
- Updated notable-ruler ranking to use effective latest snapshots and legacy evidence.

## v0.99919a

- Refined God Console V2 target selection, panel navigation, compact sections, and faction/city summaries.
- Preserved God-tab navigation when selecting cities on the map and made faction stability targets preserve city loyalty differences.

## v0.99919

- Added a canonical GodActionService and a dedicated GodConsole with explicit faction/city targets, paused-world actions, population and city interventions, derived stability controls, political action reuse, and a session-only action log.
- Population interventions use PopulationSystem's persisted counters and canonical Team.makeUser/User.destroyUser paths; no save schema changes were needed.
- Kept LocalDanmaku available under a collapsed local-role/legacy-commands section.
- GodConsole owns its vertical scrolling; God Console V2 long-form sections can grow without horizontal overflow in the existing right panel.

## v0.99918a

- Made the five WorldControlBar controls shrink evenly within the existing right panel and reduced button horizontal padding without hiding speed controls.
- Anchored the more menu at the button's bottom-right and aligned its top-right to open inward near the viewport edge.
- Preserved v0.99918 Save/Continue diagnostics; God Console V2 should give its content `height: 100%`, `minHeight: 0`, and `overflowY: auto` to avoid clipping by the current parent overflow contract.

## v0.99918

- Added persistent single-slot world saves using IndexedDB.
- Added Continue from the start menu.
- Added manual in-world saving at a safe simulation boundary.
- Added explicit NEW_WORLD / CONTINUE_SAVE bootstrap separation.
- Existing canonical WorldSaveV1 hydration remains the persistence authority.

## v0.99917h

- Defined canonical HP authority for active city blocks.
- Exported city-associated block HP from authoritative City.defense rather than a potentially stale Block.hp projection.
- Preserved independent Block.hp for non-city/home blocks.
- Added canonical block/city persistence consistency regression tests.

## v0.99917g

- Fixed hydration collider teardown against Phaser Arcade ProcessQueue deferred removals.
- Drained the public collider queue before and after Core-owned world collider destruction and verified the active queue is empty.
- Added regression coverage for already-destroyed colliders still present in the active queue.

## v0.99917f

- Added bounded path-level canonical WorldSave diffs with per-subsystem counts while preserving array order.
- Added debug runtime liveness, resume/snapshot probes, hydration-stage reporting, and a one-click copyable hydration report.
- Clarified Farms TimerEvent persistence through elapsed/startAt; added timer contract and repeated controller lifecycle regressions without changing timer cadence.

## v0.99917e

- Fixed hydration teardown double-destroy of Arcade Physics colliders by assigning world teardown a single collider owner.
- Separated world collider teardown from retained slave-group references and added repeated teardown / slave collider lifecycle regression coverage.
- Added hydration teardown stage context to runtime errors.

## v0.99917d

- Defined the WorldEventSystem V1 persistence contract and corrected hydration preflight shape validation for month maps and WorldCycle state.
- Added real WorldEventSystem JSON export/import round-trip and preflight regressions for malformed imported state.

## v0.99917c

- Corrected WorldSaveV1 population persistence validation to match the authoritative `PopulationSystem` counter-map DTO.
- Added population export/import and malformed-counter regression coverage.

## v0.99917b

- Canonicalized exported snapshot clock state to a paused exact-zero boundary so hydration accepts the same safe boundary that export validates.
- Added regression coverage for IEEE-754 residuals, negative tiny residuals, and stale running flags.

## v0.99917a

- Stop debug snapshot requests at the next complete WorldClock month boundary and discard only unconsumed foreground frame debt.
- Added jittered 1× / 2× / 4× snapshot-boundary coverage and request diagnostics; formal save UI and IndexedDB remain out of scope.

## v0.99917-alpha

- Added a dedicated, paused WorldSaveV1 runtime hydration path with preflight validation and exact map geometry checks.
- Rebuilt faction, block, city, political/history stores, users, units, and physics state without replaying world events.
- Added a debug-only in-memory snapshot/reload probe and canonical export comparison; formal save UI and IndexedDB remain out of scope.

## v0.99916-alpha

- Added a versioned JSON-safe WorldSaveV1 export foundation and referential validator.
- Defined a paused, complete-month/fixed-step snapshot boundary; runtime hydration and save UI remain out of scope.
- Exposed canonical export state from simulation/history registries without serializing Phaser objects.

## v0.99915-alpha

- Constrained Empire Split city selection to the shared regional radius.
- Unified current ruler snapshot derivation.
- Added evidence-aware epithet competition without changing simulation balance.

## v0.99914-alpha

- Unified ruler current/terminal snapshot derivation.
- Added historical faction context to chapter banners.
- Recorded only cities that actually transferred during an empire split.

## v0.99913-alpha

- Bounded ruler chronicles to political faction participation after exile.
- Added current ruler snapshots and formal-ruler filtering to world records.
- Corrected active-lifetime units and relation-aware succession context.

## v0.99912-alpha

- Reused grouped collapse narratives in ruler chronicles with faction context.
- Corrected ruler and world-record faction naming and ongoing-era duration.
- Added factual heir context without inventing birth-order labels.

## v0.99911-alpha

- Added faction-context wording for ruler chronicle conquest and collapse events.
- Moved trend history markers into a separate event lane.
- Made the objective world-records panel collapsed by default.

## v0.99910-alpha

- Added conquest and rebel-suppression milestones to ruler chronicles.
- Tightened posthumous epithet evidence so minor losses alone do not imply disorder.
- Separated trend event markers from data coordinates and added objective world records.

## v0.9999-alpha

- Prioritized canonical political milestones in ruler chronicles.
- Rendered ruler events using historical faction names at the event month.
- Normalized extinct-faction terminal ruler snapshots to zero political power.

## v0.9998-alpha

- Kept active factions alive when a ruling line ends but territory remains.
- Added minimal succession relation metadata and minor-ruler unit protection.
- Added era transition grace and type-specific confirmation durations.

## v0.9997-alpha

- Separated live power-balance eras from formal political identity requirements.
- Added stale-era exit grace and clearer formation-vs-current era presentation.
- Added canonical ruler event highlights and expanded ruler assessments.

## v0.9996-alpha

- Fixed linked heir birth dates so parent-child ages remain chronologically consistent.
- Added long-run WorldEra diagnostics for Public Alpha investigation.

## v0.9995-alpha

- Wanguoji public alpha preparation.
- Autonomous world simulation.
- Territorial warfare.
- City / siege system.
- Faction lifecycle: active states, collapse, exile, remnants, restoration and rebel-origin states.
- Kingdoms / empires.
- Dynasties / rulers.
- Historical archive.
- WorldEra.
- Web background progression via return-time catch-up.
- Experimental Electron Desktop Background Probe.
