import { deriveMilitaryLifeSchedule } from "../Politics/MilitaryLifeRules";
import Game from "../Game/Game";
import Player from "./Player";
import Slaves from "./Slaves";
import Team from "./Team";
import { resolvePublicAssetUrl } from "../Runtime/PublicAssetUrl";
import type { PopulationMutationContext } from "../Simulation/PopulationTransitionAudit";
import { deriveUserBornMonth } from "../Politics/MilitaryCommandRegistry";
import MilitaryCommandRegistry from "../Politics/MilitaryCommandRegistry";
import { getLogicalGridCoordinate } from "../Simulation/LogicalUnitState";

export type PlayerRole = "NORMAL" | "RULER";

export default class User {
  isFaceLoadDone = false;
  score = 0;
  private destroyed = false;
  militaryPersonId?: string;
  readonly bornMonth: number;
  sourceTeam: Team;
  slaveGroup: Slaves;
  constructor(
    public id: number,
    public name: string,
    public team: Team,
    public player: Player,
    public face?: string,
    public loyalty = 70,
    public role: PlayerRole = "NORMAL",
    public rulerId?: string,
    options: { deferRuntime?: boolean; bornMonth?: number; militaryPersonId?: string } = {}
  ) {
    const spawnMonth = Game.Core?.simulator?.year ?? 0;
    this.bornMonth = options.bornMonth ?? deriveUserBornMonth(id, name, team.name, spawnMonth);
    this.militaryPersonId = options.militaryPersonId;
    this.sourceTeam = team;
    this.player.role = role;
    this.player.rulerId = rulerId;
    if (!options.deferRuntime) this.load();
    this.slaveGroup = new Slaves(Game.Core.scene, this, Boolean(options.deferRuntime));
  }

  load() {
    if (this.isFaceLoadDone) {
      this.player.setFace(this.FaceKey);
      return;
    }
    if (this.face) {
      Game.Core.scene.load.image(this.FaceKey, resolvePublicAssetUrl(this.face));
      Game.Core.scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
        this.isFaceLoadDone = true;
        this.player.setFace(this.FaceKey);
      });
      Game.Core.scene.load.start();
    } else {
      this.isFaceLoadDone = true;
      this.player.setFace("noFace");
    }
  }

  setTeam(team: Team, populationMutation: PopulationMutationContext = { cause: "UNATTRIBUTED" }) {
    if (this.team === team) {
      if (!team.users.has(this)) team.users.add(this);
      return;
    }
    const previousTeam = this.team;
    MilitaryCommandRegistry.onUserTransfer(this, team.name, populationMutation.month ?? Game.Core?.simulator?.year ?? 0);
    const previousCount = previousTeam.users.size;
    const nextCount = team.users.size;
    this.team.users.delete(this);
    this.team = team;
    this.team.users.add(this);
    if (!populationMutation.deferPopulationAudit) {
      Game.Core?.simulator?.recordPopulationMutation(previousTeam, previousCount, previousTeam.users.size, {
        ...populationMutation,
        relatedFactionId: team.name,
      });
      Game.Core?.simulator?.recordPopulationMutation(team, nextCount, team.users.size, {
        ...populationMutation,
        relatedFactionId: previousTeam.name,
      });
    }
    Game.Core?.logicalUnitRegistry.updateFaction(this.player?.logicalUnitId, team);
    if (this.player?.team !== team) {
      this.player?.setTeam(team);
    }
  }

  // 投靠
  obedience(team: Team, populationMutation: PopulationMutationContext = { cause: "LIVE_TRANSFER" }) {
    if (this.team === team) return;
    if (team.isDie) return;
    this.setTeam(team, populationMutation);
    this.slaveGroup.reset();
    this.sourceTeam = team;
    this.score = 0;
    this.player.tp();
  }

  tp() {
    this.player.tp();
    this.slaveGroup.children.each((player) => {
      //@ts-ignore
      player.tp();
    });
  }

  get FaceKey() {
    return `${this.id}-${this.name}`;
  }

  get isDestroyed() {
    return this.destroyed;
  }

  /** Exact live binding; a recycled numeric User ID is never sufficient. */
  matchesMilitaryLife(person: import("../Politics/MilitaryCommandRegistry").MilitaryPerson) {
    const entry = this.player.logicalUnitId ? Game.Core?.logicalUnitRegistry.getEntry(this.player.logicalUnitId) : undefined;
    return !this.destroyed && person.status !== "DEAD" && this.role === "NORMAL" && this.militaryPersonId === person.personId &&
      this.id === person.sourceUserId && this.bornMonth === person.bornMonth && this.name === person.name &&
      this.team.name === person.factionId && this.team.users.has(this) && this.player.user === this && this.player.active &&
      this.player.team === this.team && this.player.role === "NORMAL" && !this.rulerId && !this.player.rulerId &&
      entry?.player === this.player && entry.state.alive && entry.state.unitId === this.player.logicalUnitId &&
      entry.state.userId === this.id && entry.state.factionId === this.team.name && entry.state.role === "NORMAL";
  }

  destroyUser(silentRulerDeath = false, populationMutation: PopulationMutationContext = { cause: "UNATTRIBUTED" }) {
    if (this.destroyed) return false;
    if (populationMutation.cause === "NATURAL_DEATH") {
      const person = this.militaryPersonId ? MilitaryCommandRegistry.getPerson(this.militaryPersonId) : undefined;
      const month = populationMutation.month;
      if (!person || month === undefined || month % 12 !== 0 || month < deriveMilitaryLifeSchedule(person).naturalDeathMonth || !this.matchesMilitaryLife(person)) return false;
    }
    if (this.role === "RULER" && !silentRulerDeath) {
      const shouldDestroy = Game.Core?.handleRulerCombatDeath(this) ?? true;
      if (!shouldDestroy) {
        this.tp();
        return false;
      }
    }
    const team = this.team;
    const before = team.users.size;
    const unitId = this.player.logicalUnitId;
    const core = Game.Core;
    const logicalEntry = unitId ? core?.logicalUnitRegistry.getEntry(unitId) : undefined;
    const logicalState = logicalEntry?.state;
    const logical = core?.logicalGameplayAuthority && logicalState && logicalState.unitId === unitId && logicalState.alive &&
      logicalState.factionId === team.name && logicalState.userId === this.id ? logicalState : undefined;
    const x = logical ? logical.logicalX : core?.logicalGameplayAuthority ? undefined : this.player.x;
    const y = logical ? logical.logicalY : core?.logicalGameplayAuthority ? undefined : this.player.y;
    const hasPosition = x !== undefined && y !== undefined && Number.isFinite(x) && Number.isFinite(y);
    const grid = hasPosition ? getLogicalGridCoordinate(x!, y!, Game.BlockSize) : undefined;
    const militaryPerson = this.militaryPersonId
      ? MilitaryCommandRegistry.getPerson(this.militaryPersonId)
      : undefined;
    const verifiedMilitaryPersonId = militaryPerson?.sourceUserId === this.id &&
      militaryPerson.bornMonth === this.bornMonth && militaryPerson.name === this.name && militaryPerson.factionId === team.name && militaryPerson.status !== "DEAD"
      ? militaryPerson.personId
      : undefined;
    const casualty = (populationMutation.cause === "SIEGE_LOSS" || populationMutation.cause === "BATTLE_DEATH" || populationMutation.cause === "NATURAL_DEATH")
      ? {
          victimUserId: this.id,
          victimLogicalUnitId: unitId,
          victimMilitaryPersonId: verifiedMilitaryPersonId,
          victimPosition: hasPosition && grid ? {
            x: x!, y: y!, gridX: grid.gridX, gridY: grid.gridY,
            source: logical ? "LOGICAL" as const : "PHASER" as const,
          } : undefined,
          populationBefore: before,
          populationAfter: before - 1,
          destroyed: true as const,
        }
      : undefined;
    this.destroyed = true;
    MilitaryCommandRegistry.onUserDestroyed(this, populationMutation.month ?? Game.Core?.simulator?.year ?? 0, populationMutation.cause);
    const removedFromPopulation = team.users.delete(this);
    Game.Core?.simulator?.recordPopulationMutation(team, before, team.users.size, {
      ...populationMutation,
      casualty: removedFromPopulation && populationMutation.damageSource ? casualty : undefined,
    });
    if (team.rulerUser === this) {
      team.rulerUser = undefined;
    }
    Game.Core?.recordUserDeathForDiagnostics();
    Game.Core?.logicalUnitRegistry.unregisterUser(this);
    this.slaveGroup.dispose();
    this.player.destroyPlayerTree();
    return true;
  }
}
