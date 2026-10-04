import Box from "@mui/material/Box";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import WorldHistory from "../History/WorldHistory";
import WorldEra from "../Simulation/WorldEra";
import { GameScenario, scenarioToTeams } from "../Scenarios";
import { WorldLaunchRequest } from "../Persistence/WorldSaveWorkflow";
import { StoredWorldSaveRecord } from "../Persistence/WorldSaveRepository";
import { colorToString } from "../paid/theme";
import { RootState } from "../store";
import { applyScenario, clearScenario } from "../store/configSlice";
import { resetWorldState } from "../store/rootSlice";
import App from "./App";
import StartMenu from "./Components/StartMenu";
import DesktopLifecycleBridge from "./DesktopLifecycleBridge";
import AmbientMusicRuntime from "./Components/AmbientMusicRuntime";
import worldRandom, { generateWorldSeed } from "../Simulation/WorldRandom";

export default function WorldLaunchPage() {
  const dispatch = useDispatch();
  const [request, setRequest] = useState<WorldLaunchRequest>();
  const { styleTheme, theme } = useSelector((state: RootState) => state.config);

  const startNewWorld = (scenario: GameScenario, requestedSeed?: string) => {
    const seed = requestedSeed || generateWorldSeed();
    worldRandom.initialize(seed);
    dispatch(applyScenario({ name: scenario.name, teams: scenarioToTeams(scenario) }));
    dispatch(resetWorldState());
    WorldHistory.reset();
    WorldEra.reset();
    setRequest({ mode: "NEW_WORLD", scenario, seed });
  };

  const continueSave = (record: StoredWorldSaveRecord) => {
    dispatch(clearScenario());
    // Hydration performs its own full preflight before tearing down the live world.
    // Do not clear Redux/history first: an incompatible save must leave the current
    // simulation intact.
    setRequest({ mode: "CONTINUE_SAVE", record });
  };

  return (
    <>
      <DesktopLifecycleBridge />
      <AmbientMusicRuntime />
      {!request ? (
        <StartMenu onStartNewWorld={startNewWorld} onContinue={continueSave} />
      ) : (
        <Box
          className={theme}
          sx={{
            backgroundColor: colorToString(styleTheme.backgroundColor, "#ebffe2"),
            color: colorToString(styleTheme.textColor, "#000000"),
          }}
        >
          <App
            launchRequest={request}
            onLoadRecord={continueSave}
            onReturnToMenu={() => {
              dispatch(resetWorldState());
              WorldHistory.reset();
              WorldEra.reset();
              setRequest(undefined);
            }}
          />
        </Box>
      )}
    </>
  );
}
