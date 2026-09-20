import Phaser from "phaser";
import Game from "../Game/Game";

export default class MainScene extends Phaser.Scene {
  constructor() {
    super(MainScene.name);
  }

  create() {
    this.physics.world.setFPS(30);
    this.physics.world.timeScale = 1;
    this.physics.disableUpdate();
    Game.Core.init(this);
  }

  update(_time: number, delta: number): void {
    Game.Core.update(delta);
  }
}
