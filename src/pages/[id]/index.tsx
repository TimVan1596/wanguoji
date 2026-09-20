import App from "../../UI/App";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../store";
import Box from "@mui/material/Box";
import { applyScenario } from "../../store/configSlice";
import { colorToString } from "../../paid/theme";
import { useState } from "react";
import WorldHistory from "../../History/WorldHistory";
import WorldEra from "../../Simulation/WorldEra";
import {
  GameScenario,
  scenarioToInitialPopulations,
  scenarioToTeams,
} from "../../Scenarios";
import StartMenu from "../../UI/Components/StartMenu";
import { resetWorldState } from "../../store/rootSlice";

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

  const { styleTheme } = useSelector((state: RootState) => state.config);
  const { theme: themeClassName } = useSelector(
    (state: RootState) => state.config
  );
  if (!scenario) {
    return <StartMenu onStart={handleStart} />;
  }

  return (
    <Box
      className={themeClassName}
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
