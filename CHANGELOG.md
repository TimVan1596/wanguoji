# Changelog

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
