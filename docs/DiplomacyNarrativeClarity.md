# v0.99928b — Diplomacy Narrative Clarity

APP_VERSION v0.99928b · package 0.99.115 · WorldSave V10。

## 已冻结的人工结论

起始真实HEAD为3b99c61，工作树干净。用户已确认Diplomacy II PASS：动态期限、可信/严重共同威胁、外交频率、TRUCE/NAP/ALLIANCE自然续约、到期、冷却、数十年连续关系及Save/Load正常。最近100年shortestReformationGap=36个月，active relation density约0.267。玩法正式冻结。

## 根因和修正

真实升级使用upgradeMonth+allianceDuration；真实续约使用previousExpiresMonth+renewalDuration。旧文案未明确两种时间起点，chain renewalCount也容易被理解成当前Alliance的续盟次数。历史详情又重复了标题正文。

本版仅改纯presentation formatter：

- 首次签约显示约期与记录的明确到期年月。
- NAP→Alliance说明关系升级、新盟约起点及新到期日；详情列原关系/当前status/连续关系起点。
- 续约说明“原约期再延X年，新的到期日为…”，详情列关系类型、连续起点、status起点、旧到期日、延长、新到期日、chain续约次数与最近续约月。
- 当前关系summary不把chain次数写成Alliance专属次数；连续起点等于status起点时不重复两行开始日期。
- 旧V10事件在展示时读取已记录metadata和事件月份身份，不重写保存的事件或metadata。展开外交卡片直接展示事实证据和时间详情，跳过重复旧正文。

不修改formation、credibility、duration、renewal、expiresMonth、cooldown、caps、Strategic Union、RNG、schema及任何gameplay。缺失字段不推测，不从renewalCount重建某status的续约次数。

## 自动检查与人工边界

测试涵盖初签期限/到期、升级月起算/原始起点保留、三种续约的旧到期/再延/新到期、chain次数、日期去重、旧事件月份身份、输入JSON不变与RNG不变。既有V10 round-trip、外交规则和完整测试仍需通过。

执行pnpm test -- --run、pnpm build、pnpm desktop:build、pnpm desktop:compile、pnpm desktop:renderer-debug-build及git diff --check。命令行测试不能证明真实布局与玩家理解通过。

本轮结果：168个测试文件、1011项测试全部通过；Web build、Desktop build、独立compile、debug renderer build及asset/source map校验全部通过；工作树和暂存区diff check通过。构建仅保留已有大chunk提示。对比起始基线，外交规则、Strategic Union、Simulation、Persistence和Runtime没有修改。

## 人工 Gate：直接使用现有长局

运行`pnpm desktop:start:debug`，加载当前V10世界，不创建新世界、不重新跑1300年。

1. 找1204年NAP、1206年Alliance或同类样本。应一眼看懂原NAP被升级关系取代，Alliance期限从升级月重新起算，不是叠加旧NAP剩余期；详情同时保留连续关系起点。
2. 找1285年郡、燕续盟13年或同类样本。应显示“原约期再延13年”与新的明确到期年月；详情核对旧到期日、status开始、chain开始、次数和最近续约月。
3. 找1290年谯县义军、赵续订停战3年或同类样本。应显示“原约期再延3年”与新到期年月，不写成自本月起3年。
4. 检查关系badge/summary，次数应为“连续关系已续约N次”；NAP续约后升级Alliance不能被误称为Alliance已续盟N次。
5. 确认无UI溢出、重复大段正文或遮挡，旧国号/旗色仍按事件月份展示。日期字段缺失的旧事件不应被凭空补造。

不以CLI/headless代替视觉、文案理解或真实存读档验收。不自动开始下一玩法版本。

【等待用户人工 Chrome 检查，收到用户回复前不得继续下一版本】

【等待用户人工回传 v0.99928b Diplomacy Narrative Clarity Gate；通过前不得开始 v0.99929 Peaceful Submission、Faction Historiography、Era Atlas II 或 Ruler Political Evidence II。】
