# v0.99928a — Diplomacy II Gate Observability

APP_VERSION：v0.99928a；package：0.99.114；WorldSave：V10。

开始核对的实际基线为70efcdb，工作树干净。v28人工已确认动态期限、NAP升级Alliance、国势大事记排除普通外交及newest-first；renewal、威胁消失后的到期、冷却重签、续约V10读档、合邦联盟年龄及长期频率仍待人工。

## 原因与范围

诊断面板默认展开多个长文本section，占据游戏UI；外交事件已经记录可信度和接触证据，但详情没有充分展示。本版只改presentation/debug，不修改formation、duration、renewal、cooldown、Strategic Union、年度评价、relation cap或其他gameplay。

面板默认230px紧凑浮层，可以展开、全部收起、最小化，copy core/full保留。所有details默认collapsed；收起只重建UI子树。500ms诊断刷新、桌面轮询和订阅留在父组件，紧凑时继续收集；长文本和完整面板DOM仅展开时构造。compact/collapse状态仅React session state，不进Redux、WorldSave或localStorage。

外交详情只读取metadata：credibility、directContactA/B、adjacentPair、threatCapturedA/B、capitalFall。缺失证据不推测；capitalFall布尔值不确定是哪一方，只写双方之一的首都。双方与共同强敌名称按事件月份解析。续约保留原始起点、原/新到期月、续约期限和次数；联盟连续时长按eventMonth-originalStartedMonth计算，注明自连续外交关系起点计。

## 自动验证与边界

测试通过静态React输出、组件handler及AST检查默认compact、展开/最小化、collapse重挂载、父级collector持续挂载及copy按需序列化。纯详情测试覆盖真实/缺失证据、事件月份身份、连续时长、输入不变与RNG不变；既有V10及同seed测试继续运行。这些检查不能代替真实浏览器的DOM滚动、视觉布局、外交频率或Save/Load验收。

要求运行：pnpm test -- --run、pnpm build、pnpm desktop:build、pnpm desktop:compile、pnpm desktop:renderer-debug-build、git diff --check。

本轮自动验证结果：167个测试文件、1004项测试全部通过；上述Web/Desktop构建、独立Desktop compile、debug source map/asset校验及diff check均通过。构建仍有既有大chunk提示，不属于本版修改范围。人工Gate尚未通过，未运行GUI代替用户验收。

## 人工 Gate

运行`pnpm desktop:start:debug`，Load当前v28的V10世界，无需新开局；4×继续至总世界年龄约800～1200年。

1. 默认浮层应紧凑且不遮挡主要UI。展开后section全关闭；测试全部收起、最小化与复制核心/全部诊断。
2. 至少检查3条NAP/Alliance详情，核对共同强敌与CREDIBLE/SEVERE依据。如不合理，回传双方、威胁、credibility、directA/B、adjacentPair、capturedA/B、capitalFall及三方territory share，不先调参。
3. 寻找至少一条relation-renewed：原始关系起点不变、renewalCount增加、到期延长，叙事为续约/续盟。寻找一条威胁不再credible后到期的关系，确认没有立即重签。
4. 回传Diplomacy II的sessionCumulative和recent100Years：truceFormed、napFormed、allianceFormed、upgrades、truceRenewed、napRenewed、allianceRenewed、expired、cooldownBlocked、reformedAfterCooldown、samePairReformationCount、reformedWithin5Years、commonThreatCandidates、weakThreat、credibleThreat、severeThreat、noStrategicContactBlocked。
5. 同时回传activeRelationCount、activeRelationDensity、meanInitialDuration、medianInitialDuration、meanEffectiveContinuousDuration、longestContinuousRelation、shortestReformationGap，以及最近形成/升级/续约样本和blocker。
6. 国势大事记继续排除普通外交，最新在上；趋势图◆不被普通外交占位。
7. 选择renewalCount>0的active relation，Save→Load：status、startedMonth、originalStartedMonth、lastRenewedMonth、renewalCount、expiresMonth和pair memory必须保持。
8. 如自然出现同源长期Alliance，核对续约不重置alliance age；无样本不用人为制造。
9. 外交频率或同月扎堆若主观不合理，回传真实历史与诊断，不自动调参数。以上视觉、历史和真实读档由用户验收。

## 仅记录的 backlog

Deterministic Staggered Diplomacy Evaluation：当前worldMonth%12===0可能集中产生外交事件。未来若长期人工确认影响自然感，再考虑stableHash(pairKey)%12，并保持每pair每年最多一次。本版没有实现此机制。

【等待用户人工 Chrome 检查，收到用户回复前不得继续下一版本】

【等待用户人工回传 v0.99928a Diplomacy II Gate Observability；通过前不得开始 v0.99929 纳土归降、Faction Historiography、Era Atlas II 或 Ruler Political Evidence II。】
