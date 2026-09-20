import Game from "../Game/Game";
import Player from "./Player";
import Slaves from "./Slaves";
import Team from "./Team";

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
    public rulerId?: string
  ) {
    this.sourceTeam = team;
    this.player.role = role;
    this.player.rulerId = rulerId;
    this.load();
    this.slaveGroup = new Slaves(Game.Core.scene, this);
  }

  load() {
    if (this.isFaceLoadDone) {
      this.player.setFace(this.FaceKey);
      return;
    }
    if (this.face) {
      Game.Core.scene.load.image(this.FaceKey, this.face);
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

  setTeam(team: Team) {
    this.team.users.delete(this);
    this.team = team;
    this.team.users.add(this);
    Game.Core?.logicalUnitRegistry.updateFaction(this.player?.logicalUnitId, team);
    if (this.player?.team !== team) {
      this.player?.setTeam(team);
    }
  }

  // 投靠
  obedience(team: Team) {
    if (this.team === team) return;
    if (team.isDie) return;
    this.setTeam(team);
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

  destroyUser(silentRulerDeath = false) {
    if (this.role === "RULER" && !silentRulerDeath) {
      const shouldDestroy = Game.Core?.handleRulerCombatDeath(this) ?? true;
      if (!shouldDestroy) {
        this.tp();
        return false;
      }
    }
    this.team.users.delete(this);
    if (this.team.rulerUser === this) {
      this.team.rulerUser = undefined;
    }
    Game.Core?.recordUserDeathForDiagnostics();
    Game.Core?.logicalUnitRegistry.unregisterUser(this);
    this.slaveGroup.reset();
    this.player.destroyPlayerTree();
    return true;
  }
}
