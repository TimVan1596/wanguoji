import CircleMaskImage from "phaser3-rex-plugins/plugins/circlemaskimage";
import Game from "../Game/Game";
import { store } from "../store";
import {
  setFactionDetailTab,
  setRightPanelTab,
  setSelectedFactionName,
} from "../store/rootSlice";
import Team from "./Team";
import User from "./User";
import type { PlayerRole } from "./User";

export default class Player extends Phaser.GameObjects.Container {
  face: CircleMaskImage;
  factionRing: Phaser.GameObjects.Arc;
  crownMarker: Phaser.GameObjects.Text | undefined;
  static MinSpeed: number = 150;
  speed: number = Player.MinSpeed;
  user: User | undefined;
  logicalUnitId: string | undefined;
  role: PlayerRole = "NORMAL";
  rulerId: string | undefined;
  children: Player[] = [];
  speedCoefficient: number = 0;
  sizeCoefficient: number = 0;
  line?: Phaser.GameObjects.Line;
  flash: Phaser.Tweens.Tween;
  flashStar: Phaser.GameObjects.Image;

  constructor(
    public scene: Phaser.Scene,
    x: number,
    y: number,
    public team: Team,
    public parent?: Player
  ) {
    super(scene, x, y);
    this.factionRing = scene.add
      .circle(Game.BlockSize / 2, Game.BlockSize / 2, Game.BlockSize / 2 + 1)
      .setStrokeStyle(2, team.color, 0.85)
      .setDepth(this.depth + 1);
    this.face = new CircleMaskImage(scene, 0, 0, "noFace").setOrigin(0);

    this.add(this.factionRing);
    this.add(this.face);
    this.scene.add.existing(this);
    this.scene.physics.add.existing(this);
    this.Body.setCollideWorldBounds(true);
    this.Body.setBounce(1, 1);
    this.setDepth(5000);
    if (parent) {
      this.createOrUpdateLine();
    }
    const vec = this.scene.physics.velocityFromAngle(
      Math.random() * 360,
      this.speed
    );
    this.Body.setVelocity(vec.x, vec.y);
    this.setFace("noFace");
    this.flashStar = this.scene.add
      .image(Game.BlockSize / 2, Game.BlockSize / 2, "star")
      .setScale(2)
      .setAlpha(0);
    this.add(this.flashStar);
    this.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, Game.BlockSize, Game.BlockSize),
      Phaser.Geom.Rectangle.Contains
    );
    this.on("pointerdown", () => {
      if (this.role !== "RULER") {
        return;
      }
      store.dispatch(setSelectedFactionName(this.team.name));
      store.dispatch(setFactionDetailTab("house"));
      store.dispatch(setRightPanelTab("faction"));
    });

    this.flash = this.scene.add.tween({
      targets: this.flashStar,
      duration: 100,
      scale: { from: 0, to: 2 },
      alpha: { from: 0, to: 1 },
      yoyo: 1,
      hold: 100,
      loop: 0,
    });
    this.flash.stop();
  }

  speedUp(count = 1) {
    this.speedCoefficient += count;
    // 暂时解除速度限制
    let speed = 220 * Math.log(this.speedCoefficient + 1) + Player.MinSpeed;
    // const speed = this.speed + 50 * count;
    this.setSpeed(speed);
    this.children.forEach((v) => {
      v.setSpeed(speed);
    });
    Game.Core?.logicalUnitRegistry.updateSpeed(this.logicalUnitId, speed);
  }

  sizeUp(count = 1) {
    this.sizeCoefficient += count;
    let size = 0.8 * Math.log(this.sizeCoefficient + 1) + 1;
    // let size = this.scale + 0.1 * count;
    this.setBodySize(size);
  }

  setBodySize(size: number) {
    this.setScale(size);
    this.children.forEach((v) => v.setBodySize(size));
  }

  makeChild(count = 1) {
    if (this.team.homeBlock) {
      const { x, y } = this.team.homeBlock;
      for (let i = 0; i < count; i++) {
        const player = new Player(this.scene, x, y, this.team, this);
        // @ts-ignore
        const textureKey = this.face._textureKey;
        player.user = this.user;
        player.setFace(textureKey);
        player.setSpeed(this.speed);
        player.setTeam(this.team);
        player.setScale(this.scale);
        this.children.push(player);
      }
    }
  }

  tp() {
    if (this.team.homeBlock) {
      const { x, y } = this.team.homeBlock;
      this.setPosition(x, y);
      Game.Core?.logicalUnitRegistry.teleportPlayer(this, x, y);
      this.children.forEach((p) => p.setPosition(x, y));
    }
  }

  createOrUpdateLine() {
    if (!this.parent) return;
    if (this.line) {
      this.line.setTo(
        this.parent.x + Game.BlockSize / 2,
        this.parent.y + Game.BlockSize / 2,
        this.x + Game.BlockSize / 2,
        this.y + Game.BlockSize / 2
      );
    } else {
      this.line = this.scene.add
        .line(0, 0, 0, 0, 100, 100, 0xffffff)
        .setOrigin(0)
        .setAlpha(0.4)
        .setDepth(this.depth + 1);
    }
  }

  showFlash(count = 1) {
    if (this.parent) {
      this.flash.loop = this.parent.flash.loop;
    } else {
      this.flash.loop = Math.min(this.flash.loopCounter + count, 5);
    }
    if (this.flash.loop < 0) {
      this.flash.loop = 0;
    }
    this.flash.restart();
    this.children.forEach((v) => v.showFlash(count));
  }

  setSpeed(speed: number) {
    this.speed = speed;
    const v = this.Body.velocity.clone().normalize();
    this.Body.setVelocity(v.x * this.speed, v.y * this.speed);
  }

  setFace(faceKey: string) {
    try {
      this.face.setTexture(faceKey);
    } catch (error) {
      return;
    }
    this.face.setDisplaySize(Game.BlockSize, Game.BlockSize);
    this.Body.setCircle(Game.BlockSize / 2);
    this.setScale(1.2);
    this.children.forEach((v) => v.setFace(faceKey));
  }

  setUser(user: User) {
    this.user = user;
  }

  setRole(role: PlayerRole, rulerId?: string) {
    this.role = role;
    this.rulerId = rulerId;
    if (role !== "RULER") {
      this.crownMarker?.setVisible(false).setActive(false);
      return;
    }
    if (!this.crownMarker) {
      this.crownMarker = this.scene.add
        .text(Game.BlockSize / 2, -3, "♛", {
          fontSize: "10px",
          color: "#f6c945",
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(this.depth + 3);
      this.add(this.crownMarker);
    }
    this.crownMarker.setVisible(true).setActive(true);
    this.speedUp(1);
    this.sizeUp(1);
  }

  setTeam(team: Team) {
    this.team.players.remove(this);
    this.team = team;
    Game.Core?.logicalUnitRegistry.updateFaction(this.logicalUnitId, team);
    this.factionRing.setStrokeStyle(2, team.color, 0.85);
    this.team.players.add(this);
    this.children.forEach((v) => v.setTeam(team));
    if (!this.parent) {
      if (this.user?.team !== team) {
        this.user?.setTeam(team);
      }
    }
  }

  get Body() {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  exportMovementState(unitId: string) {
    const body = this.Body;
    return {
      unitId,
      factionId: this.team.name,
      userId: this.user?.id,
      parentUnitId: this.parent instanceof Player ? this.parent.logicalUnitId : undefined,
      x: this.x,
      y: this.y,
      vx: body?.velocity?.x ?? 0,
      vy: body?.velocity?.y ?? 0,
      speed: this.speed,
      scale: this.scale,
      radius: body?.radius ?? 0,
      speedCoefficient: this.speedCoefficient,
      sizeCoefficient: this.sizeCoefficient,
      role: this.role,
      rulerId: this.rulerId,
      faceKey: this.face?.texture?.key,
      alive: this.active,
      children: this.children.map((child) => child.logicalUnitId).filter(Boolean),
    };
  }

  applyHydratedMovementState(state: {
    x: number; y: number; vx: number; vy: number; speed: number;
    radius: number; scale: number; speedCoefficient: number; sizeCoefficient: number;
    role: PlayerRole; rulerId?: string; alive: boolean;
  }) {
    this.setPosition(state.x, state.y);
    this.setScale(state.scale);
    this.speed = state.speed;
    this.speedCoefficient = state.speedCoefficient;
    this.sizeCoefficient = state.sizeCoefficient;
    this.role = state.role;
    this.rulerId = state.rulerId;
    if (state.role === "RULER" && !this.crownMarker) {
      this.crownMarker = this.scene.add
        .text(Game.BlockSize / 2, -3, "♛", {
          fontSize: "10px", color: "#f6c945", stroke: "#000000", strokeThickness: 2,
        })
        .setOrigin(0.5)
        .setDepth(this.depth + 3);
      this.add(this.crownMarker);
    }
    this.crownMarker?.setVisible(state.role === "RULER").setActive(state.role === "RULER");
    this.Body.setCircle(state.radius);
    this.Body.setVelocity(state.vx, state.vy);
    this.Body.moves = true;
    this.setActive(state.alive);
    this.setVisible(state.alive);
    if (!state.alive) this.Body.enable = false;
  }

  update(): void {
    this.createOrUpdateLine();
  }

  destroyPlayerTree() {
    this.children.forEach((player) => player.destroyPlayerTree());
    this.children = [];
    this.line?.destroy();
    Game.Core?.logicalUnitRegistry.unregisterPlayer(this);
    this.team.players.remove(this);
    this.destroy(true);
  }
}
