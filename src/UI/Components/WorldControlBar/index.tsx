import { Box, Button, CircularProgress, Divider, Menu, MenuItem, Typography } from "@mui/material";
import { useState } from "react";
import { useSelector } from "react-redux";
import { SIMULATION_SPEEDS } from "../../../config/simulation";
import Game from "../../../Game/Game";
import { RootState } from "../../../store";

export default function WorldControlBar({
  onReturnToMenu,
  onSave,
  onSaveGame,
  onManageSaves,
  onSettings,
  saving,
}: {
  onReturnToMenu: () => void;
  onSave: () => Promise<string>;
  onSaveGame: () => void;
  onManageSaves: () => void;
  onSettings: () => void;
  saving: boolean;
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
  const [saveMessage, setSaveMessage] = useState("");

  const handleSave = async () => {
    setSaveMessage("正在保存…");
    try {
      setSaveMessage(await onSave());
    } catch (error) {
      setSaveMessage(`保存失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

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
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
        gap: 0.5,
        minWidth: 0,
        borderBottom: "1px solid rgba(0, 0, 0, 0.2)",
      }}
    >
      <Button
        size="small"
        type="button"
        sx={{ minWidth: 0, px: 0.5 }}
        variant={worldRunning ? "outlined" : "contained"}
        disabled={catchUpActive || saving}
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
          disabled={catchUpActive || saving}
          onClick={() => Game.Core?.setSimulationSpeed(speed)}
          sx={{ minWidth: 0, px: 0.5 }}
        >
          {speed}×
        </Button>
      ))}
      <Button
        size="small"
        type="button"
        color="inherit"
        sx={{ minWidth: 0, px: 0.5 }}
        disabled={catchUpActive || saving}
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
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem disabled={saving || catchUpActive} onClick={() => void handleSave()}>
          {saving ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
          {saving ? "正在保存恢复档…" : "快速保存恢复档"}
        </MenuItem>
        <MenuItem disabled={saving || catchUpActive} onClick={onSaveGame}>保存游戏…</MenuItem>
        <MenuItem disabled={saving} onClick={onManageSaves}>存档管理</MenuItem>
        <Divider />
        <MenuItem disabled={saving} onClick={() => { setMenuAnchor(null); onSettings(); }}>设置</MenuItem>
        <Divider />
        <MenuItem disabled={saving} onClick={handleReturnToMenu}>新世界 / 返回主菜单</MenuItem>
      </Menu>
      {saveMessage ? (
        <Typography
          variant="caption"
          color={saveMessage.startsWith("保存失败") ? "error" : "success.main"}
          sx={{ gridColumn: "1 / -1", px: 0.5 }}
        >
          {saveMessage}
        </Typography>
      ) : null}
    </Box>
  );
}
