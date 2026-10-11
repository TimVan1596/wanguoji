# v0.99931e · Political Genealogy Visual Hierarchy

基线 HEAD `99889d1`，初始工作树干净，v0.99931d3 / package 0.99.133 / WorldSave V13。用户确认 d3 人工 PASS，国史合传冻结。本轮目标 v0.99931e / 0.99.134；不提交、不撤销用户暂存。

## 根因与事实约束

旧节点将所有身份、代数与姓名放在一行，仅当前君主有背景差异。旧末代标签依赖 `endReason === "彻底灭亡"`，无法完整表示 V13 政治终结、真实死亡与行政退位。旧篡朝标签只检查 relationType，缺少事件和 epoch 交叉核验。

宗谱结构由原 `buildPoliticalGenealogy` 决定，连线只表示记录的 parentId，不将 predecessorId 转为血缘。不同姓氏、同姓多阶段以及多根谱系均不合并。

## 只读身份规则

- 势力创始：首个 FOUNDING epoch 的 foundingRulerId，人物 relationType=FOUNDER，承统范围覆盖开端。
- 正式开国：本国 state-founded，月份等于国家正式建国月份，真实 rulerId 和任期匹配；与创始者分开。
- 称帝：本国 emperor-proclaimed 的真实当时君主。普通继任帝王不自动获得称帝标签。
- 篡朝开统：本国 dynasty-usurped + 同月 USURPATION epoch + 同一 foundingRulerId + 人物 USURPER。自然易姓不满足。
- 复国：本国 faction-restored，明确人物 ID 优先；旧事件无 ID 时仅在该月唯一实际承统者可确认时赋予。收复城市不等于复国。同月多位任期重叠则省略不猜测。
- 当前/储君：实际 currentRulerId / designatedHeirId 和适当人物状态；终结国家不展示有效当前或储君。流亡承统另有文字说明。
- 末代承统：国家真实 EXTINCT 终结月份与实际最后一位 reignOrdinal 人物；其政治任期已结束或有真实死亡。无可靠末代记录、重复代数或仍在位残余时不标记。生理死亡与政治身份独立。
- 合邦/纳土退位：本国 terminal event 的 SOURCE 角色与确切人物、abdicated、国家终结类型和月份匹配，复用 PoliticalTerminalChronicle。绝不表示战死。
- 合法庙谥：仍使用原 formatRulerRowName / formatPosthumousRulerName 和实际死亡门；不生成新称号。

人物 ID 不属于该王室、任期不覆盖月份、外国 actor 或未来事件均不借用当前君主补齐。身份记录保留 source（事件 ID 或 authoritative epoch/termination 引用），不持久化。

## 视觉与性能

姓名、最多两个关键身份、代数/流亡/生死未载分行；剩余身份、候选、旧朝宗亲、真实终结原因保留在节点原生悬停说明。多身份优先当前、储君、篡朝与终局；普通成员保持中性，少量金色、蓝灰、玫瑰灰、绿灰、紫灰边框背景区分主题。文字可换行，节点宽度有界，不新增筛选/模式/弹窗。

仅弹窗打开时获取本国 indexed history，批量计算并 useMemo；失效条件包含 history revision、worldMonth、国家 ID/状态/终结月份、正式建国月份及相关人物与 epoch 事实。Hydration/reset 导致 revision/事实改变后重算。不在递归节点内查询历史，不复制永久事件数据库，不修改图结构、缩放及父子线。

## 修改文件

- GenealogyNodePresentation.ts：纯身份派生及主题样式。
- GenealogyPersonCard.tsx：紧凑节点展示。
- FactionDetails/index.tsx：打开时批量派生并传递到递归节点。
- 对应两份测试：事实来源、边界、行政退位、V13 人物投影、RNG、图结构、百人节点与组件结构。
- version.ts、package.json、CHANGELOG、ROADMAP、本报告；DesktopSecurity.test.ts 同步本版 package 断言，未降低安全断言。

## 自动验证

最终完整执行 `VITEST_MAX_THREADS=1 VITEST_MIN_THREADS=1 pnpm test`：200 文件、1368 测试全部通过，115.50 秒。新增 16 项纯身份/组件测试；既有玩法、V13完整导出/校验/恢复及 canonical round-trip、国史、历史索引和宗谱控制测试全部保留通过。

`pnpm build`、`pnpm desktop:build`、`pnpm desktop:compile`、`pnpm desktop:renderer-debug-build` 全部 exit 0。只有既有大 chunk 提示；不将构建成功视为视觉或真人性能验收。

`git diff --check` 通过。`git diff --cached --check` 检出用户工作期间暂存的较早 GenealogyNodePresentation.ts 第43行尾空格；工作树已修正，但为了保留用户暂存未改写 index。暂存区还包含较早节点版本，提交前应重新核对并暂存最终工作树。未提交或重置 Git。

首轮全套测试的 package 旧版断言及新增 SSR 测试的开发 jsxDEV 适配已修正，最终全套重新运行通过；没有删除或弱化旧断言。自动验证不代表视觉 Gate。

## 人工 Chrome/Electron Gate

运行 `pnpm desktop:start:debug`，直接读取现有 V13 长局，无需新建或等待数百年。

1. 天下势力→终结→沂→王室→查看完整宗谱：查宋昭（势力创始）、宋景（正式开国）、宋景怀（末代流亡承统）；复制姓名、标签，描述是否容易识别。不能因覆灭显示战死。
2. 天下势力→在国→坂→王室→查看完整宗谱：查王玄平真实篡朝和当前君主；其他王氏君主不能全标篡朝。
3. 宋国欧阳谦：查真实篡朝；郸国钱翊：自然易姓不得标篡朝；郡国萧琮：纳土退位不得标战死/处死。已不存在对应样本则注明本档无样本。
4. 亲测 50%、100%、150%缩放、适应窗口、定位当今君主、滚动/拖动、多根分支、ESC/关闭重开、切换国家、Save→Load 后重开。
5. 确认历代君主、国史、历史卷轴、时代图鉴和继续运行未受影响。

```text
沂国宗谱：
宋昭：名称/标记/外观
宋景：名称/标记/外观
宋景怀：名称/标记/外观
特殊身份准确性：正常/异常

坂国宗谱：
王玄平：名称/标记/外观
当前君主：名称/标记/外观
篡朝与当前身份：正常/异常

宋国欧阳谦：正常/异常
郸国钱翊自然易姓：正常/异常
郡国萧琮纳土退位：正常/异常

缩放、适应窗口、定位：正常/异常
滚动、分支、关闭重开：正常/异常
节点是否清楚、不过度拥挤：正常/异常

V13保存、读取、继续运行：正常/异常
历代君主和国史：正常/异常
历史卷轴与时代图鉴：正常/异常

最终人工Gate：PASS/未通过
异常原文或具体界面位置：
```

## 风险与停止

证据不足的角色安全省略；悬停说明在触屏使用中的便利性、50%字号、长庙谥、多分支宽度、百人宗谱实际滚动性能仍须用户观察。没有改变存档结构、RNG、canonical history、人物生死、epoch、继承或任何 gameplay；国家及君主史评、Era Atlas 冻结不动。

【等待用户人工Chrome/Electron检查，收到用户明确PASS前不得继续下一版本】
【等待用户人工 Chrome 检查，收到用户回复前不得继续下一版本】
