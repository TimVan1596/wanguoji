import Phaser from "phaser";
import Core from "../Game/Core";
import Game from "../Game/Game";
import MainScene from "./MainScene";
import { resolvePublicAssetUrl } from "../Runtime/PublicAssetUrl";
import { getTextureProbeSource } from "../Runtime/TextureProbe";

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super(PreloadScene.name);
  }

  preload() {
    if (getTextureProbeSource() === "PNG") {
      this.load.image("noFace", resolvePublicAssetUrl("img/no-face.png"));
    } else {
      this.load.svg("noFace", resolvePublicAssetUrl("img/no-face.svg"), { width: 64, height: 64 });
    }
    this.load.image("star", resolvePublicAssetUrl("img/star.png"));
  }

  create() {
    Game.Core = new Core(this.game, this);
    this.scene.start(MainScene.name);
  }
}
