import { Box, Button, Menu, MenuItem } from "@mui/material";
import { useState } from "react";
import { useSelector } from "react-redux";
import { SIMULATION_SPEEDS } from "../../../config/simulation";
import Game from "../../../Game/Game";
import { RootState } from "../../../store";

export default function WorldControlBar({
  onReturnToMenu,
}: {
  onReturnToMenu: () => void;
}) {
  const worldRunning = useSelector(
    (state: RootState) => state.root.worldRunning
  );
  const simulationSpeed = useSelector(
    (state: RootState) => state.root.simulationSpeed
  );
  const catchUpActive = useSelector(
    (state: RootState) => state.root.backgroundCatchUpActive
  );
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const handleReturnToMenu = () => {
    if (catchUpActive) {
      return;
    }
    if (!window.confirm("结束当前世界并返回主菜单？")) {
      return;
    }
    setMenuAnchor(null);
    Game.Core?.setWorldRunning(false);
    onReturnToMenu();
  };

  return (
    <Box
      sx={{
        p: 1,
        display: "grid",
        gridTemplateColumns: "1fr repeat(3, 0.72fr) 0.56fr",
        gap: 0.5,
        borderBottom: "1px solid rgba(0, 0, 0, 0.2)",
      }}
    >
      <Button
        size="small"
        type="button"
        variant={worldRunning ? "outlined" : "contained"}
        disabled={catchUpActive}
        onClick={() => Game.Core?.setWorldRunning(!worldRunning)}
        title={worldRunning ? "暂停" : "继续"}
        aria-label={worldRunning ? "暂停" : "继续"}
      >
        {worldRunning ? "⏸" : "▶"}
      </Button>
      {SIMULATION_SPEEDS.map((speed) => (
        <Button
          key={speed}
          size="small"
          type="button"
          variant={simulationSpeed === speed ? "contained" : "outlined"}
          disabled={catchUpActive}
          onClick={() => Game.Core?.setSimulationSpeed(speed)}
        >
          {speed}×
        </Button>
      ))}
      <Button
        size="small"
        type="button"
        color="inherit"
        disabled={catchUpActive}
        onClick={(event) => setMenuAnchor(event.currentTarget)}
        title="更多"
        aria-label="更多"
      >
        ⋯
      </Button>
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={handleReturnToMenu}>新世界 / 返回主菜单</MenuItem>
      </Menu>
    </Box>
  );
}
