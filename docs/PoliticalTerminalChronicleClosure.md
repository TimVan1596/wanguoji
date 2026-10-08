# v0.99929a Political Terminal Chronicle Closure

基线 bc8a178 / v0.99929 / package 0.99.116 / WorldSave V11。
目标 v0.99929a / package 0.99.117，WorldSave 保持 V11。

## 根因与修复

终结目标 ID 是稳定标识，顶部使用当前 displayName，王朝记忆直接显示 ID，均可能把终结时的“鄄”显示成“秦”。现在通过 terminationMonth 查询 nameHistory；没有目标记录或终结月份时保留 ID，避免猜测身份。

endYear 是统治结束时间，并不证明死亡。年龄标签按 status：dead 显示享年，abdicated 显示退位时年龄，其余显示当前年龄。退位评述中的身后与一生改为政治任期措辞，身后称号只展示给 dead；不改任何谥号、庙号生成规则。

个人纪事白名单遗漏 faction-merged / faction-submitted。现在两种事件以高优先级保留，并通过真实势力角色、事件月份和已记录君主 ID 归属。旧 V11 归并没有君主 ID：提交方必须有同月合邦退位记录，吸收方必须在当月实际任期内；任期已结束的前君和之后即位的君主不领该事件。不写回事件、不使用当前君主替代历史君主。

包含义军阶段的累计标签改为势力存续，计时数值不变。正式国家纪录的国祚统计不变。

## 冻结范围

纳土、归并、外交、复国、继承、篡朝、战斗、人口、RNG 与 WorldSave schema 均不修改。不增加国评、时代地图、人物政治评价系统或性能重构。

## 自动验证

覆盖 MERGED / SUBMITTED 的历史身份、双方君主纪事、错误任期和错误 ID 拒绝、旧 V11 归并展示、终结事件优先保留、退位/死亡年龄与评述、原数据和 RNG 不变；全套测试包含既有 same-seed、纳土/合邦冻结规则和 V11 round-trip。

自动测试与构建结果将在完成后记录。自动验证不代表浏览器视觉或真实 Save/Load Gate 通过。

## 人工 Gate

直接读取现有 V11 长局，无需重新跑数千年。

1. 天下势力 → 终结 → 张：复制“纳土归附于”一行，必须显示鄄。
2. 张 → 王室 → 张承绍：复制年龄与大事记末尾；必须显示“退位时44岁”与4797年纳土纪事。
3. 鄄 → 王室 → 4797年当时君主：复制受纳张的纪事；不得由当前君主误领旧事件。
4. 如有归并事件，核对归并双方当时君主大事记；没有样本无需重跑长局。
5. 宗谱、地图、Save → Load 分别回复正常/异常。无法做历史前后地图对照时明确注明。

【等待用户人工 Chrome 检查，收到用户回复前不得继续下一版本】

【等待用户人工回传 v0.99929a Political Terminal Chronicle Gate；收到回复前不得开始 v0.99930、Era Atlas II、Dynastic Narrative II、Ruler Political Evidence II 或 Restoration Audit。】
