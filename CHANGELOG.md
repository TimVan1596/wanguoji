# Changelog

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
