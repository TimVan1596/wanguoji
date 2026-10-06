import Game from "../Game/Game";
import Player from "./Player";
import Slaves from "./Slaves";
import Team from "./Team";
import { resolvePublicAssetUrl } from "../Runtime/PublicAssetUrl";
import type { PopulationMutationContext } from "../Simulation/PopulationTransitionAudit";

export type PlayerRole = "NORMAL" | "RULER";

export default class User {
  isFaceLoadDone = false;
  score = 0;
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
    options: { deferRuntime?: boolean } = {}
  ) {
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
    const previousCount = previousTeam.users.size;
    const nextCount = team.users.size;
    this.team.users.delete(this);
    this.team = team;
    this.team.users.add(this);
    Game.Core?.simulator?.recordPopulationMutation(previousTeam, previousCount, previousTeam.users.size, {
      ...populationMutation,
      relatedFactionId: team.name,
    });
    Game.Core?.simulator?.recordPopulationMutation(team, nextCount, team.users.size, {
      ...populationMutation,
      relatedFactionId: previousTeam.name,
    });
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

  destroyUser(silentRulerDeath = false, populationMutation: PopulationMutationContext = { cause: "UNATTRIBUTED" }) {
    if (this.role === "RULER" && !silentRulerDeath) {
      const shouldDestroy = Game.Core?.handleRulerCombatDeath(this) ?? true;
      if (!shouldDestroy) {
        this.tp();
        return false;
      }
    }
    const team = this.team;
    const before = team.users.size;
    team.users.delete(this);
    Game.Core?.simulator?.recordPopulationMutation(team, before, team.users.size, populationMutation);
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
