import Game from "../Game/Game";
import Npc from "./Npc";
import Team from "./Team";
import User from "./User";
import ColliderReference from "./ColliderReference";
import { resolvePublicAssetUrl } from "../Runtime/PublicAssetUrl";

export interface Slave {
  name: string;
  speed: number;
  scale: number;
  face: string;
  level: string;
}

export default class Slaves extends Phaser.GameObjects.Group {
  npcs: Map<string, Npc> = new Map();
  private colliderReference = new ColliderReference<Phaser.Physics.Arcade.Collider>();

  get collider() {
    return this.colliderReference.current;
  }

  constructor(public scene: Phaser.Scene, public user: User, deferCollider = false) {
    super(scene);
    this.runChildUpdate = true;
    this.scene.add.existing(this);
    if (!deferCollider) this.addCollider();
  }

  addCollider() {
    const map = Game.Core.map;
    if (!map) return;
    const otherTeamsBlock = Team.GetOtherTeams(this.user.team).map(
      (team) => team.blocks
    );
    this.colliderReference.getOrCreate(() =>
      this.scene.physics.add.collider(
        this,
        [map.blocksGroup, ...otherTeamsBlock],
        //@ts-ignore
        Game.Core.onPlayerOverlapBlock.bind(Game.Core)
      )
    );
  }

  detachColliderAfterWorldTeardown() {
    this.colliderReference.detachAfterWorldTeardown();
  }

  makeSlave(slave: Slave) {
    const slaveId = `${slave.name}-${slave.level}`;
    if (this.npcs.has(slaveId)) {
      const npc = this.npcs.get(slaveId);
      npc?.makeChild();
    } else {
      const npc = new Npc(
        this.scene,
        0,
        0,
        this.user.team,
        this,
        this.user.player
      );
      npc.user = this.user;
      npc.setBodySize(slave.scale);
      npc.setSpeed(slave.speed);
      this.scene.load.image(slave.name, resolvePublicAssetUrl(slave.face));
      this.scene.load.once("complete", () => {
        npc.setFace(slave.name);
      });
      this.scene.load.start();
      npc.tp();
      npc.setColorByLevel(slave.level);
      this.npcs.set(slaveId, npc);
    }
  }

  get Count() {
    let count = 0;
    this.npcs.forEach((npc) => {
      count += npc.children.length + 1;
    });
    return count;
  }

  private clearOwnedUnits() {
    this.npcs.forEach((v) => {
      v.destroyPlayerTree();
    });
    this.clear(true, true);
    this.npcs.clear();
    this.colliderReference.destroyOwned();
  }

  dispose() {
    if (!this.scene) return;
    this.clearOwnedUnits();
    this.destroy(false, false);
  }

  reset() {
    this.clearOwnedUnits();
    this.addCollider();
  }
}
