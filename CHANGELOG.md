# Changelog

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
