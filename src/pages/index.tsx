import Box from "@mui/material/Box";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import WorldHistory from "../History/WorldHistory";
import WorldEra from "../Simulation/WorldEra";
import {
  GameScenario,
  scenarioToInitialPopulations,
  scenarioToTeams,
} from "../Scenarios";
import App from "../UI/App";
import StartMenu from "../UI/Components/StartMenu";
import { colorToString } from "../paid/theme";
import { RootState } from "../store";
import { applyScenario } from "../store/configSlice";
import { resetWorldState } from "../store/rootSlice";

export default function () {
  const dispatch = useDispatch();
  const [scenario, setScenario] = useState<GameScenario>();

  const handleStart = (nextScenario: GameScenario) => {
    dispatch(
      applyScenario({
        name: nextScenario.name,
        teams: scenarioToTeams(nextScenario),
      })
    );
    dispatch(resetWorldState());
    WorldHistory.reset();
    WorldEra.reset();
    setScenario(nextScenario);
  };

  const { styleTheme, theme } = useSelector((state: RootState) => state.config);
  if (!scenario) {
    return <StartMenu onStart={handleStart} />;
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
        initialPopulations={scenarioToInitialPopulations(scenario)}
        onReturnToMenu={() => {
          dispatch(resetWorldState());
          WorldHistory.reset();
          WorldEra.reset();
          setScenario(undefined);
        }}
      />
    </Box>
  );
}
