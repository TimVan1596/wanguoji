import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Button, Divider } from "@mui/material";
import { RootState } from "../../store";
import { useDispatch, useSelector } from "react-redux";
import { colorToString } from "../../paid/theme";
import { formatWorldDate } from "../../Simulation/WorldTime";
import { dismissWorldResult } from "../../store/rootSlice";

export function Result({ onReturnToMenu }: { onReturnToMenu: () => void }) {
  const dispatch = useDispatch();
  const result = useSelector((state: RootState) => state.root.worldResult);
  const { styleTheme } = useSelector((state: RootState) => state.config);
  if (!result) {
    return <></>;
  }

  const title =
    result.type === "unification"
      ? `${result.teamName}统一天下`
      : `${result.teamName}确立天下霸权`;

  const handleNewWorld = () => {
    if (!window.confirm("结束当前世界并返回主菜单？")) {
      return;
    }
    dispatch(dismissWorldResult());
    onReturnToMenu();
  };

  return (
    <Box
      sx={{
        position: "fixed",
        width: "100vw",
        height: "100vh",
        background: "#00000082",
        zIndex: 100,
      }}
    >
      <Box
        sx={{
          position: "absolute",
          background: colorToString(styleTheme.backgroundColor, "#ebffe2"),
          p: 2,
          minWidth: "50rem",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <Typography variant="h3" align="center" gutterBottom>
          {title}
        </Typography>
        <Divider sx={{ m: 2 }}></Divider>
        <Typography variant="h5" align="center" gutterBottom>
          纪元 {formatWorldDate(result.monthIndex ?? result.year)}
        </Typography>
        <Typography align="center">
          最终人口 {result.population} · 领土 {result.territory} 格 ·{" "}
          {result.territoryPercent.toFixed(1)}%
        </Typography>
        <Typography align="center">
          主要历史事件 {result.historyEventCount} 条
        </Typography>
        <Box sx={{ display: "flex", justifyContent: "center", gap: 2, mt: 3 }}>
          <Button
            variant="contained"
            onClick={() => dispatch(dismissWorldResult())}
          >
            继续观察
          </Button>
          <Button variant="outlined" onClick={handleNewWorld}>
            新世界
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
