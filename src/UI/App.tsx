import Box from "@mui/material/Box";
import { useEffect, useRef } from "react";
import Game from "../Game/Game";
import { InitialPopulationMap } from "../Simulation/PopulationSystem";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import Config from "./Components/Config";
import ChapterBanner from "./Components/ChapterBanner";
import BackgroundCatchUpOverlay from "./Components/BackgroundCatchUpOverlay";
import GameCard from "./Components/GameCard";
import LeftSlider from "./Components/LeftSlider";
import { Result } from "./Components/Result";
import RightSlider from "./Components/RightSlider";

interface AppProps {
  initialPopulations: InitialPopulationMap;
  onReturnToMenu: () => void;
}

export default function App({ initialPopulations, onReturnToMenu }: AppProps) {
  return (
    <>
      <WorldStarter initialPopulations={initialPopulations} />
      <Result onReturnToMenu={onReturnToMenu}></Result>
      <Config></Config>
      <Box
        sx={{
          boxSizing: "border-box",
          height: "100vh",
          display: "flex",
          background: "var(--gg-background)",
        }}
      >
        <Box
          sx={{
            width: { xs: 250, xl: 270 },
            flex: "0 0 auto",
            borderRight: "1px solid var(--gg-border)",
            background: "var(--gg-panel)",
          }}
        >
          <LeftSlider></LeftSlider>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, position: "relative" }}>
          <GameCard />
          <ChapterBanner />
          <BackgroundCatchUpOverlay />
        </Box>
        <Box
          sx={{
            width: { xs: 310, xl: 330 },
            flex: "0 0 auto",
            borderLeft: "1px solid var(--gg-border)",
            background: "var(--gg-panel)",
          }}
        >
          <RightSlider onReturnToMenu={onReturnToMenu}></RightSlider>
        </Box>
      </Box>
    </>
  );
}

function WorldStarter({
  initialPopulations,
}: {
  initialPopulations: InitialPopulationMap;
}) {
  const teams = useSelector((state: RootState) => state.root.teams);
  const worldStarted = useSelector(
    (state: RootState) => state.root.worldStarted
  );
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || worldStarted || teams.length === 0 || !Game.Core) {
      return;
    }
    startedRef.current = true;
    Game.Core.startWorld(initialPopulations);
  }, [initialPopulations, teams, worldStarted]);

  return null;
}
