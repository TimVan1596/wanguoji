import Game from "../Game/Game";
import {
  CITY_CAPITAL_LABEL_FONT_SIZE,
  CITY_LABEL_FONT_SIZE,
} from "../config/simulation";
import { store } from "../store";
import type City from "./City";
import Player from "./Player";
import Team from "./Team";

export default class Block extends Phaser.GameObjects.Rectangle {
  hp = 0;
  isHome: boolean = false;
  team: Team | undefined;
  hpText: Phaser.GameObjects.Text | undefined;
  teamName: Phaser.GameObjects.Text | undefined;
  defenseBarBack: Phaser.GameObjects.Rectangle | undefined;
  defenseBarFill: Phaser.GameObjects.Rectangle | undefined;
  city: City | undefined;
  isCityCenter = false;
  tween: Phaser.Tweens.Tween | undefined;
  hall: Phaser.GameObjects.Image | undefined;
  tile: Phaser.GameObjects.Image | undefined;
  constructor(scene: Phaser.Scene, x = 0, y = 0) {
    super(scene, x, y, Game.BlockSize, Game.BlockSize);
    this.setOrigin(0, 0);
    const blockColor = store.getState().config.styleTheme.blockColor;
    this.setFillStyle(blockColor !== undefined ? blockColor : 0xebffe2);
    this.setStrokeStyle(1, 0x000000, 0.1);
    this.scene.add.existing(this);
    this.scene.physics.add.existing(this, true);
    this.setInteractive({ useHandCursor: false });
    this.on("pointerdown", () => {
      if (!this.city) {
        Game.Core?.selectFaction(undefined);
      }
    });
  }

  setTile(tile: string) {
    if (this.tile) {
      this.tile.setTexture(tile);
    } else {
      this.setVisible(false);
      this.tile = this.scene.add
        .image(0, 0, tile)
        .setDisplaySize(Game.BlockSize, Game.BlockSize)
        .setDepth(this.depth + 1);
      Phaser.Display.Align.In.Center(this.tile, this);
    }
  }

  setIsHome(hall?: string) {
    if (hall) {
      this.scene.load.image(hall, hall);
      this.scene.load.once("complete", () => {
        this.hall = this.scene.add
          .image(0, 0, hall)
          .setSize(Game.BlockSize * 2, Game.BlockSize * 2)
          .setDisplaySize(Game.BlockSize * 2, Game.BlockSize * 2)
          .setDepth(this.depth + 2);
        Phaser.Display.Align.In.Center(this.hall, this);
        this._setIsHome();
      });
      this.scene.load.start();
    } else {
      this._setIsHome();
    }
  }

  _setIsHome() {
    this.hp = 5;
    this.isHome = true;
    this.teamName = this.scene.add
      .text(0, 0, `${this.team?.name}`, {
        fontSize: "48px",
        stroke: "#000000",
        strokeThickness: 5,
        fontStyle: "bold",
      })
      .setOrigin(0)
      .setAlpha(0.5)
      .setDepth(this.depth + 2);
    Phaser.Display.Align.To.BottomCenter(
      this.teamName,
      this.hall ? this.hall : this
    );
    this.hpText = this.scene.add
      .text(0, 0, `${this.hp}`, {
        fontSize: "32px",
        stroke: "#000000",
        strokeThickness: 5,
        fontStyle: "bold",
      })
      .setOrigin(0)
      .setDepth(this.depth + 3);
    Phaser.Display.Align.In.Center(this.hpText, this);
    // if (!this.team?.icon) {
    //   this.tween = this.scene.tweens.add({
    //     targets: this.teamName,
    //     alpha: 0,
    //     duration: 500,
    //     yoyo: true,
    //     repeat: -1,
    //     hold: 5000,
    //     delay: 5000,
    //     repeatDelay: 5000,
    //   });
    // }
  }

  setIsNotHome() {
    this.isHome = false;
    this.hpText?.setActive(false);
    this.hpText?.setVisible(false);
    this.tween?.stop();
    this.teamName?.setActive(false);
    this.teamName?.setVisible(false);
    this.hall?.setActive(false);
    this.hall?.setVisible(false);
  }

  setTeam(team: Team, player?: Player) {
    const oldTeam = this.team;
    if (this.city && this.city.ownerTeam !== team) {
      this.city.registerSiegeContact(
        team,
        Game.Core?.simulator?.year ?? 0,
        player?.role === "RULER" ? player.rulerId : undefined
      );
      return;
    }
    if (this.isHome) {
      this.hp--;
      oldTeam?.removeOneUser();
      if (this.hp <= 0) {
        this._setTeam(team);
        this.setIsNotHome();
        oldTeam?.obedience(team);
      }
    } else {
      this._setTeam(team);
    }
  }

  claimForTeam(team: Team) {
    this._setTeam(team);
    this.updateCityDisplay();
  }

  setCity(city: City, isCenter = false) {
    this.city = city;
    this.isCityCenter = isCenter;
    this.isHome = city.isCapital;
    if (isCenter && !this.teamName) {
      this.teamName = this.scene.add
        .text(0, 0, "", {
          fontSize: `${CITY_LABEL_FONT_SIZE}px`,
          stroke: "#000000",
          strokeThickness: 3,
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setAlpha(0.82)
        .setDepth(this.depth + 2);
      this.teamName.disableInteractive();
    }
    if (isCenter && !this.hpText) {
      this.hpText = this.scene.add
        .text(0, 0, "", {
          fontSize: "9px",
          stroke: "#000000",
          strokeThickness: 2,
          fontStyle: "bold",
        })
        .setOrigin(0.5)
        .setAlpha(0.65)
        .setDepth(this.depth + 3);
    }
    if (isCenter && this.teamName) {
      this.teamName.disableInteractive();
    }
    if (isCenter && !this.defenseBarBack) {
      this.defenseBarBack = this.scene.add
        .rectangle(0, 0, 28, 3, 0x111111, 0.38)
        .setOrigin(0.5)
        .setDepth(this.depth + 2);
      this.defenseBarFill = this.scene.add
        .rectangle(0, 0, 28, 3, 0xffffff, 0.82)
        .setOrigin(0, 0.5)
        .setDepth(this.depth + 3);
    }
    this.updateCityDisplay();
  }

  restoreCanonicalState(state: {
    owner?: Team;
    isHome: boolean;
    hp: number;
    city?: City;
    isCityCenter: boolean;
  }) {
    this.team?.blocks.remove(this);
    this.team = state.owner;
    if (state.owner) {
      Game.Core?.map?.blocksGroup.remove(this);
      state.owner.blocks.add(this);
      this.setFillStyle(state.owner.color);
    } else {
      Game.Core?.map?.blocksGroup.add(this);
      const blockColor = store.getState().config.styleTheme.blockColor;
      this.setFillStyle(blockColor !== undefined ? blockColor : 0xebffe2);
    }
    this.isHome = state.isHome;
    this.hp = state.hp;
    if (state.city) this.setCity(state.city, state.isCityCenter);
    else this.city = undefined;
    this.isCityCenter = state.isCityCenter;
    if (state.owner?.tile && this.scene.textures.exists(state.owner.tile)) this.setTile(state.owner.tile);
    if (state.isHome && !state.city) {
      this._setIsHome();
      this.hp = state.hp;
      this.hpText?.setText(`${this.hp}`);
      if (state.owner?.hall && this.scene.textures.exists(state.owner.hall) && !this.hall) {
        this.hall = this.scene.add.image(0, 0, state.owner.hall)
          .setSize(Game.BlockSize * 2, Game.BlockSize * 2)
          .setDisplaySize(Game.BlockSize * 2, Game.BlockSize * 2)
          .setDepth(this.depth + 2);
        Phaser.Display.Align.In.Center(this.hall, this);
      }
    }
    this.updateCityDisplay();
  }

  destroyRuntimeObjects() {
    this.tween?.stop();
    this.hall?.destroy();
    this.tile?.destroy();
    this.hpText?.destroy();
    this.teamName?.destroy();
    this.defenseBarBack?.destroy();
    this.defenseBarFill?.destroy();
    this.destroy(true);
  }

  clearCity(city: City) {
    if (this.city !== city) {
      return;
    }
    this.city = undefined;
    this.isCityCenter = false;
    this.isHome = false;
    this.setInteractive({ useHandCursor: false });
    this.removeAllListeners("pointerdown");
    this.on("pointerdown", () => {
      Game.Core?.selectFaction(undefined);
    });
    this.removeAllListeners("pointerover");
    this.removeAllListeners("pointerout");
    this.teamName?.setVisible(false).setActive(false);
    this.hpText?.setVisible(false).setActive(false);
    this.defenseBarBack?.setVisible(false).setActive(false);
    this.defenseBarFill?.setVisible(false).setActive(false);
  }

  updateCityDisplay() {
    if (!this.city) {
      return;
    }
    this.hp = this.city.defense;
    this.isHome = this.city.isCapital;
    const owner = this.city.ownerTeam;
    if (owner) {
      this.setFillStyle(owner.color);
    }
    this.setStrokeStyle(1, 0x111111, 0.18);
    const selectedCityId = store.getState().root.selectedCityId;
    const emphasized =
      this.city.isCapital ||
      this.city.zoneHighlighted ||
      this.city.underSiege ||
      selectedCityId === this.city.id;
    const cityText = this.city.isCapital ? `★ ${this.city.name}` : `● ${this.city.name}`;
    this.teamName?.setText(cityText).setVisible(this.isCityCenter).setActive(this.isCityCenter);
    this.teamName?.setFontSize(
      this.city.isCapital ? CITY_CAPITAL_LABEL_FONT_SIZE : CITY_LABEL_FONT_SIZE
    );
    this.teamName?.setFontStyle("bold");
    this.teamName?.setAlpha(emphasized ? 0.96 : 0.82);
    this.teamName?.setStroke("#000000", emphasized ? 4 : 3);
    this.hpText
      ?.setText(`${this.city.defense}/${this.city.maxDefense}`)
      .setVisible(false)
      .setActive(false);
    if (this.teamName) {
      Phaser.Display.Align.In.Center(this.teamName, this);
      this.teamName.y -= emphasized ? 4 : 0;
    }
    this.updateDefenseBar(emphasized);
  }

  private updateDefenseBar(emphasized: boolean) {
    if (!this.city || !this.defenseBarBack || !this.defenseBarFill) {
      return;
    }
    const shouldShow =
      this.isCityCenter &&
      (this.city.isCapital ||
        emphasized ||
        this.city.zoneHighlighted ||
        this.city.underSiege);
    this.defenseBarBack.setVisible(shouldShow).setActive(shouldShow);
    this.defenseBarFill.setVisible(shouldShow).setActive(shouldShow);
    if (!shouldShow) {
      return;
    }
    const ratio = Phaser.Math.Clamp(this.city.defense / Math.max(this.city.maxDefense, 1), 0, 1);
    const width = 28;
    this.defenseBarFill.width = Math.max(1, width * ratio);
    this.defenseBarFill.setFillStyle(this.city.ownerTeam?.color ?? 0xffffff, 0.86);
    Phaser.Display.Align.In.Center(this.defenseBarBack, this);
    this.defenseBarBack.y += 8;
    this.defenseBarFill.setPosition(this.defenseBarBack.x - width / 2, this.defenseBarBack.y);
  }

  private _setTeam(team: Team) {
    this.team?.blocks.remove(this);
    Game.Core.map?.blocksGroup.remove(this);
    this.setFillStyle(team.color);
    this.team = team;
    team.blocks.add(this);
    // set tile
    if (team.tile) {
      this.setTile(team.tile);
    }
  }

  update(): void {
    if (this.city) {
      return;
    }
    if (this.hpText) {
      this.hpText.setText(`${this.hp}`);
    }
  }
}
