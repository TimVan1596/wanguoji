# v0.99927b1 Runtime Disposal lifecycle evidence

Baseline: HEAD 6531421, Phaser 3.55.2, desktop debug bundle index-8f3d5ca3.js / .js.map.
The user's worldMonth=114 stack names Dit.preUpdate; no exact stack column was provided.
Mapping the existing Dit class declaration (generated line 6264, zero-based column 101381)
resolves to src/Components/Slaves.ts:24 (constructor). Slaves inherits Group.preUpdate without an override.
Mapping the generated `this.children.size` expression (line 540, zero-based column 3372)
resolves to phaser/dist/phaser.js:29092, corresponding to phaser/src/gameobjects/group/Group.js:523.
These positions identify the baseline bundle; later builds rename symbols.

## Proven failure order

- Group.preUpdate: `if (!this.runChildUpdate || this.children.size === 0)`.
- Group.destroy queues UpdateList.remove, then sets scene and children undefined; active remains true.
- UpdateList.sceneUpdate iterates its active array, checking only active before invoking preUpdate.
- ProcessQueue.update removes active entries first, then inserts pending entries.
- Thus destroying a pending Group before activation leaves a destroyed active entry after PRE_UPDATE.
  Real installed Phaser classes reproduce the same `.size` TypeError. Synchronous destruction during
  an earlier object's preUpdate likewise invalidates a later Group still held by the current iteration.
- Scene Systems.step emits PRE_UPDATE, then UPDATE (including UpdateList.sceneUpdate), calls
  MainScene.update → Core.update (manual Arcade fixed steps and monthly simulation), then emits POST_UPDATE.
  User death in that Core path can therefore destroy a newly created still-pending group in the same frame.
  The user's exact death ordering is not available; both unsafe schedules are covered structurally.

## Ownership and safe destruction

Death immediately removes the User from gameplay ownership (existing User path). Slaves.dispose
sets active=false and runChildUpdate=false, requests UpdateList removal, releases collider and child units,
and schedules its own final destruction. No replacement collider is created. Late makeSlave/reset/addCollider
calls cannot reactivate it. Core owns registrations and a deduplicated pending map; pending cardinality is
bounded by registered runtime user groups, rather than accumulated historical deaths. All pending work drains
at the same scene's POST_UPDATE; this is a scene boundary, not the end of a single fixed step.

At that boundary, pending UpdateList insertion is detached before Group.destroy. A remaining active reference
is inactive, so it cannot enter preUpdate while its queued removal waits for the next PRE_UPDATE. No engine
null guard, exception suppression, forced queue.update or simulation step is used. Paused hydration/reset
also flushes pending disposal, and farm groups use the same quiescent pending-insertion handling.
Destroy listeners release registration references; repeated binding/reset/dispose is idempotent.

Runtime Lifetime reports deferred disposals, peak, registered groups, oldest scene-frame age and a warning
at three stalled frames (using Core's scene-frame counter). Actual live user groups and preUpdate eligibility
invariants are observational; they neither throw fatal nor mutate canonical state or RNG. Pending inactive
terminal groups are separately counted, rather than treated as live or orphaned groups.

Tests use installed Group, UpdateList, ProcessQueue and Clock, with scene event ordering and mocked units/physics
callbacks. They validate resource lifecycle and canonical projection/RNG equality, not real Electron rendering.
WorldSave remains V9. Both real Electron manual stages are mandatory:

1. New world, 4×, 100–150 years without Save/Load. No Fatal/undefined.size; disposal drains, orphan count zero,
   live group counts track live users, groups/colliders remain bounded, basic UI works. If it fails, return Fatal
   and Runtime Lifetime immediately; do not proceed to the long-run stage.
2. Only after Stage A passes: load the approximately 3451-year V9 world, 4×, 800–1200 years without manual reload.
   Every 200–300 years capture Lifetime and aggregate/phase timings. If slow, capture diagnostics before
   Save→Load, then compare the same world. Check late autosave, Save/Load, same-seed checkpoints and all four Tabs.
