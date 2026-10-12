# v0.99931n1 宗室废立历史与人物生命周期闭环

## 交付状态

- 目标版本：APP `v0.99931n1` / package `0.99.145` / WorldSave V14。
- v0.99931n人工 Chrome Gate 已由用户明确 PASS；本版仍等待用户人工复验。
- V14 schema 不变，旧存档兼容策略不变。
- 未修改宗室废立资格、概率、抽签顺序、冷却、RNG、自然寿命分布、王统、国号、旗色或庙谥授予规则。

## 根因

`RulerLifeValidation`把即位方式`accessionCause="DEPOSITION"`和离位状态错误地绑在一起：曾通过废立登基的人进入`deposed`或后来真实死亡时，会被校验器拒绝。即位方式与离位方式是独立事实，应同时保留。

人物档案已有同一条`ruler-deposed` canonical事件，却只把血缘显示为“前君之子承统”；史评事实派生没有按事件中的旧君/新君ID将该事件作为两种人物角色纳入。衰退史评的定性总结和疆域段落也可能重复说明同一结果。

## 修改内容

- V14校验允许DEPOSITION即位人物后续处于`ruling`、`deposed`、`dead`或既有受支持状态；不会删除`accessionCause`。真实死亡约束仍由独立生命校验执行。
- 废立事件事实派生要求本国、月份、两个真实人物ID/姓名、同王统、前君废位月、后君即位月、前后任期关系及可核验亲属关系全部吻合。前君以`SUBJECT`角色、夺位者以`DIRECT_ACTOR`角色引用同一事件ID。
- 人物页保留“继承关系”，另显示“即位方式”或“离位方式”。死亡月份仍由真实死亡事实展示，不将废位写成死亡。
- 史评明确呈现被废者/夺位者身份；史家曰单独讨论政治位置与可见结果，并说明不能由任内收缩推定废立动机。评语不使用姓名专属文案。
- 重度失土人物保留稳定度回升、疆域及城市数字，但避免相邻文字重复表达同一衰退结论。
- 新增同一人物先废立登基、再被废、随后自然死亡的真实`DynastyRegistry.update`月度流程测试，以及V14严格校验、恢复、再次导出canonical一致测试。

## 事实边界与未改内容

亲属关系只用已记录的父系/旁系谱系数据推导；缺失关系时不伪称父子、兄弟或叔伯。废立前君继续存活由独立死亡月份证明；其后死亡时保留原废位月和`endReason="被废"`。同一王统的废立不创建王统、国号或旗色变更。

没有新增人物、政变动机、权臣、将领、拥立、密谋或其他历史事件。canonical`ruler-deposed`事件及V14结构均未修改。

## 自动验证

针对性用例已运行：

- `pnpm exec vitest run src/Politics/RulerHistoriography.test.ts src/Politics/RulerPoliticalTerminalIntegrity.test.ts src/Politics/DynasticCandidateRules.test.ts src/Persistence/WorldSaveValidator.test.ts`
- `pnpm exec vitest run src/Persistence/WorldSaveReferentialIntegrity.test.ts -t 'successive deposition'`

验证结果：`pnpm test`通过（211个测试文件、1558项测试）；`pnpm build`通过；`pnpm desktop:build`通过；独立`pnpm desktop:compile`通过；`pnpm desktop:renderer-debug-build`通过；`git diff --check`与`git diff --cached --check`通过。打包构建有既有约3.18MB renderer chunk体积警告，资源和source map校验通过。

测试中的四种子120年王室观察使用政治专用测试适配器，不运行战争、人口、城市、外交或分裂模拟；它不能证明本版废立自然发生率，本版也没有改动概率。双重废立成功路径由真实`DynastyRegistry.update`测试固定危机事件驱动，作为业务集成回归，不包装成自然发生样本。

## 人工 Chrome/Electron Gate

运行`pnpm desktop:start:debug`，读取v0.99931n既有V14长局。检查燕国299年姬湛/姬武、秦国710年嬴谦/嬴弼；查看即位方式、离位方式、实际死亡、史评和史家曰；若有自然样本，再检查曾夺位后被废者。最后执行V14保存、读取、继续运行。

不得以CLI截图、Playwright或自动视觉检查代替人工Gate。

```text
版本：v0.99931n1 / WorldSave V14
当前世界年月：

燕国299年事件：
（原文）

姬湛：
（即位、被废、死亡、史评、史家曰）

姬武：
（即位、史评、史家曰）

秦国710年事件：
（原文）

嬴谦、嬴弼：
（相关人物记录）

二次被废的同一君主：
（真实案例／本档无自然样本）

V14保存、读取、继续运行：正常／异常
政治宗谱、国史、历史卷轴：正常／异常
人物史评布局与性能：正常／异常

最终人工Gate：PASS／未通过

异常原文与具体界面：
```

**【等待用户本人Chrome/Electron人工检查，收到明确“最终人工Gate：PASS”前不得进入下一版本】**
