# v0.99928 — Diplomacy II: Durable Relations, Credible Threats & Renewal

## Baseline / frozen Gate

Verified baseline: HEAD12f7b97, clean tree, v0.99927d2 / package0.99.112 / WorldSaveV9.
User closed the entire v27 Dynastic Revolution Gate: naturally reachable usurpation; living displaced heir, independent houses, epochs/name/banner history, major/era discovery, unseen/paging, strict archived-city recovery followed by zero-repair reload, referential integrity all passed. These rules and validated v27 runtime/performance work remain frozen.

## Existing rules audited

Diplomacy evaluates every12months, deterministically, without formation RNG. Truce36 / NAP96 / Alliance120months were fixed; truce→NAP and NAP→Alliance each required24months. Maximum2active relations/faction,2new relations/upgrades/evaluation,1alliance/faction. Common-threat size ratio2.5 and weak-faction share18% remain. Old NAP accepted a distant large third faction; old alliance required both adjacency/recent capture or capital-fall contacts. Expiry removed the pair immediately; there was no renewal or memory.

## Factual policy

Pure `evaluateCommonThreatCredibility` uses existing territory shares, orthogonal adjacency, recent36-month capture/capital-fall events and current continuous relationship age. No opinion/minister/hidden war model.

- NONE: threat share less than2.5×the larger partner (minimum denominator1%).
- WEAK: size advantage without common strategic pressure. No NAP.
- CREDIBLE: exactly one directly exposed partner, plus A/B adjacency or at least24months continuous relation.
- SEVERE: both partners directly exposed. Direct means actual adjacency or recent bilateral capture/capital-fall evidence.
- NAP needs CREDIBLE or SEVERE and existing weak-share gate.
- Alliance needs NAP≥24months with SEVERE; CREDIBLE needs NAP≥72months and the same recorded threat. One-alliance cap remains.

Capture direction, capital-fall evidence, contact booleans and shares are recorded in history/diagnostics. Capital fall and territory advantage affect term length; no unrecorded threat growth or friendship is narrated.

## Terms / continuity / renewal

Pure whole-year durations:
- TRUCE:2years + up to2years additional capture pressure +1year if either stability≤40 +1year for capital fall; cap5years.
- NAP:6years +2SEVERE +1both-exposed +2advantage≥5× +1prior relation status≥72months; cap12years.
- Alliance:8years +3SEVERE +1both-exposed +2advantage≥5× +1prior status≥72months; cap15years.

Current status `startedMonth` changes only on upgrade; `originalStartedMonth` persists throughout the chain. Annual evaluation first processes bounded formations/upgrades, then separately renews near-expiry relations (≤12months). This avoids renewing a NAP and upgrading it in the same boundary. Renewal consumes no formation slot, retains both starts, extends previous expiry by the computed term, increments renewalCount, records lastRenewedMonth. Current UI labels renewed expiry separately from the initial treaty term and exposes the chain/renewal dates. Alliance age in Strategic Union remains worldMonth−startedMonth; union rules are untouched.

TRUCE renewal requires remaining recent capture evidence and low stability; old evidence ages out of the36-month window, so peaceful truces cannot renew indefinitely. NAP/Alliance require current credible pressure; a vanished/extinct threat cannot qualify, though another genuine common threat can replace it with explicitly recorded evidence.

Expiry creates one latest memory/pair: last status/reason/threat, endedMonth, cooldownUntilMonth. Cooldown is ceil(effective current-status term/36)×12, clamped TRUCE12–24 / NAP24–48 / Alliance24–60months. Terminal merger removes all associated relations/memories. Memory is bounded by unordered known faction pairs, not an append-only archive; historical events retain the full lifecycle.

## History and national trajectory

New `relation-renewed` is NORMAL and queryable in History→外交 with signing/upgrades/expiry; it cannot become major merely from its metadata. Renewal prose explicitly says续盟/续约, never first alliance formation. Metadata records previous/new expiry, extension, starts/count, signers and actual factual context.

Presentation-only power-chronicle selector excludes all ordinary diplomacy regardless of canonical MAJOR significance. It retains founding/usurpation/emperor/capital/restoration/collapse/merger/major territorial/world changes with actual faction relation. Conqueror collapse requires the victim to be an actual formal state at that month (authoritative stateFoundedMonth or recorded historical evidence). Power chronicle is newest-first; trend markers reuse the selector, retain chronological axis and10-marker limit. History canonical/index/paging remains unchanged.

## Persistence / diagnostics

APPv0.99928 / package0.99.113 / WorldSaveV10. V9andolder directly rejected before teardown; no migration. IndexedDB database version stays2. Source API aliases namedV1…V9 point to current DTO only, never legacy acceptance.
Continuity, renewal and bounded pair memory export/import with the canonical diplomacy subsystem and recursive canonical diff. Session observations never save or draw RNG; debug off does not allocate observation collections.

Diplomacy II diagnostics show session cumulative and exact last1200world-month buckets, formation/upgrades/renewals/expiry/cooldown/churn/threat counts, initial term mean/median, effective continuous durations (completed observed chains + current active chains), active density/0–2relation counts and alliance count. Lifecycle and blocker samples retain at most10each; term histogram has only legal whole-year values, recent month buckets at most1201. Density is a snapshot, not historical session state. Diagnostics reset on new world/load.

## Automatic verification / limits

Tests cover remote threat rejection, credible/severe contact, lower-risk long-NAP prerequisite, deterministic term bounds/granularity, renewal identity and cap independence, no-pressure expiry, cooldown reformation, persistent metadata and malformed rejection, actual hydrator/exporter round-trip with structural Phaser adapters, same-seed debug on/off registry state/RNG, unchanged union age, canonical diff, narrative significance, newest-first power chronicle and chronological markers. Existing20k-history/disposal/debt/wake tests remain. CLI cannot accept real UI/diplomatic frequency/Save-Load semantics.

## Manual Gate — new world only

Run `pnpm desktop:start:debug`, use a NEW V10world at4× for800–1200years. V9saves are intentionally unsupported.

1. Observe an emerging hegemon: distant unexposed states should not mass-sign NAP; genuinely exposed partners should still cooperate. Copy complete Diplomacy II diagnostics and factual samples.
2. Inspect multiple truce/NAP/alliance terms in their allowed whole-year ranges, not fixed3/8/10years.
3. Find1–2renewals; History→外交 shows续盟/续约, NORMAL visual weight. Threat disappears→no automatic renewal. Peaceful truce should expire. Near-expiry renewal preserves start/age/pair and does not create a duplicate.
4. History→外交 retains signing, upgrade, renewal and expiry. History→大事 is not flooded by renewal. Power chronicle excludes ordinary diplomacy, newest first; chart ◆markers prefer genuine national trajectory.
5. Save/reload an active renewed relation: status, startedMonth, originalStartedMonth, expiresMonth, lastRenewedMonth, renewalCount, pair memory/cooldown all retained. Check map and historic identity visually.
6. If same-origin alliance naturally occurs, renewal must not reset alliance age or alter established merger semantics. Confirm same-seed checkpoint/RNG.
7. If frequency or terms feel wrong, return diagnostics+actual historical samples; do not auto-tune or continue features.

【等待用户人工 Chrome 检查，收到用户回复前不得继续下一版本】
【等待用户人工回传 v0.99928 Diplomacy II Gate；
通过前不得开始纳土归降、Faction Historiography、Era Atlas II 或 Ruler Political Evidence II。】
