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
import { applyScenario } from "../store/configSlice";
import { resetWorldState } from "../store/rootSlice";
import App from "./App";
import StartMenu from "./Components/StartMenu";

export default function WorldLaunchPage() {
  const dispatch = useDispatch();
  const [request, setRequest] = useState<WorldLaunchRequest>();
  const { styleTheme, theme } = useSelector((state: RootState) => state.config);

  const startNewWorld = (scenario: GameScenario) => {
    dispatch(applyScenario({ name: scenario.name, teams: scenarioToTeams(scenario) }));
    dispatch(resetWorldState());
    WorldHistory.reset();
    WorldEra.reset();
    setRequest({ mode: "NEW_WORLD", scenario });
  };

  const continueSave = (record: StoredWorldSaveRecord) => {
    dispatch(resetWorldState());
    WorldHistory.reset();
    WorldEra.reset();
    setRequest({ mode: "CONTINUE_SAVE", record });
  };

  if (!request) {
    return <StartMenu onStartNewWorld={startNewWorld} onContinue={continueSave} />;
  }

  return (
    <Box
      className={theme}
      sx={{
        backgroundColor: colorToString(styleTheme.backgroundColor, "#ebffe2"),
        color: colorToString(styleTheme.textColor, "#000000"),
      }}
    >
      <App
        launchRequest={request}
        onReturnToMenu={() => {
          dispatch(resetWorldState());
          WorldHistory.reset();
          WorldEra.reset();
          setRequest(undefined);
        }}
      />
    </Box>
  );
}
