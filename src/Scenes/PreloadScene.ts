import Phaser from "phaser";
import Core from "../Game/Core";
import Game from "../Game/Game";
import MainScene from "./MainScene";

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super(PreloadScene.name);
  }

  preload() {
    this.load.svg("noFace", "/img/no-face.svg", {
      width: 64,
      height: 64,
    });
    this.load.image("star", "/img/star.png");
  }

  create() {
    Game.Core = new Core(this.game, this);
    this.scene.start(MainScene.name);
  }
}
