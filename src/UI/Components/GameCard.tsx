import Box from "@mui/material/Box";
import { useEffect } from "react";
import Game from "../../Game/Game";
import GoldKey from "../../Game/GoldKey";
import MainScene from "../../Scenes/MainScene";
import PreloadScene from "../../Scenes/PreloadScene";

let game: Game;

const GameCard = () => {
  useEffect(() => {
    if (!game) {
      game = new Game({
        type: Phaser.AUTO,
        scale: {
          width: 1120,
          height: 1120,
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        backgroundColor: "#ffffff",
        parent: "game",
        scene: [PreloadScene, MainScene],
        physics: {
          default: "arcade",
          arcade: {
            // debug: true,
          },
        },
      });
      window.goldKey = new GoldKey(game);
    }
    return () => {
      if (game) {
        game.destroy(true);
        game = undefined as unknown as Game;
      }
      window.goldKey = undefined as unknown as GoldKey;
      Game.Core = undefined as unknown as typeof Game.Core;
    };
  }, []);

  return (
    <Box className="game-wapper">
      <Box
        id="game"
        sx={{
          marginBottom: "-5px",
        }}
      ></Box>
    </Box>
  );
};

export default GameCard;
