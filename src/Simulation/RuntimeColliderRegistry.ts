import { destroyOwnedCollider } from "./DestroyOwnedCollider";
export interface RuntimeCollisionGroup { getChildren(): unknown[] }
export interface RuntimeCollisionFaction {
  name: string;
  status: string;
  terminationReason?: string;
  blocks: RuntimeCollisionGroup;
}
interface OwnedCollider { destroy(): void; world?: unknown }

/** Owns only Core colliders. Archive shells remain available to persistence/UI. */
export class RuntimeColliderRegistry {
  private pendingTerminals = new Set<RuntimeCollisionFaction>();
  private entries: Array<{
    collider: OwnedCollider;
    source: RuntimeCollisionFaction;
    group: RuntimeCollisionGroup;
    targets: RuntimeCollisionGroup[];
  }> = [];

  register(source: RuntimeCollisionFaction, group: RuntimeCollisionGroup,
    targets: RuntimeCollisionGroup[], create: () => OwnedCollider) {
    this.entries.push({ collider: create(), source, group, targets });
  }

  scheduleTerminal(faction: RuntimeCollisionFaction) {
    if (faction.status === "EXTINCT") this.pendingTerminals.add(faction);
  }

  /** Called between fixed steps, never while Arcade is iterating collider targets. */
  flushTerminal() {
    this.pendingTerminals.forEach((faction) => this.releaseTerminal(faction));
    this.pendingTerminals.clear();
  }

  releaseTerminal(faction: RuntimeCollisionFaction) {
    if (faction.status !== "EXTINCT") return;
    this.entries = this.entries.filter((entry) => {
      // Never discard actual units/territory, including exiled remnants.
      if (faction.blocks.getChildren().length === 0) {
        for (let index = entry.targets.length - 1; index >= 0; index--) {
          if (entry.targets[index] === faction.blocks) entry.targets.splice(index, 1);
        }
      }
      const emptySource = entry.source === faction && entry.group.getChildren().length === 0;
      if (emptySource || entry.targets.length === 0) {
        destroyOwnedCollider(entry.collider);
        return false;
      }
      return true;
    });
  }

  detachAfterWorldTeardown() { this.entries = []; this.pendingTerminals.clear(); }
  snapshot() {
    return { colliders: this.entries.length,
      pendingTerminalFactions: this.pendingTerminals.size,
      targetReferences: this.entries.reduce((sum, entry) => sum + entry.targets.length, 0) };
  }
}
