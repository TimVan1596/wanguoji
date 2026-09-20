import Box from "@mui/material/Box";
import { Box as MuiBox, Tab } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../../store";
import { setRightPanelTab } from "../../../store/rootSlice";
import CityDetails from "../CityDetails";
import FactionDetails from "../FactionDetails";
import HistoryScroll from "../HistoryScroll";
import LocalDanmaku from "../LocalDanmaku";
import WorldControlBar from "../WorldControlBar";

export default function RightSlider({
  onReturnToMenu,
}: {
  onReturnToMenu: () => void;
}) {
  const dispatch = useDispatch();
  const rightPanelTab = useSelector(
    (state: RootState) => state.root.rightPanelTab
  );

  return (
    <Box
      sx={{
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <WorldControlBar onReturnToMenu={onReturnToMenu}></WorldControlBar>
      <MuiBox
        role="tablist"
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          borderBottom: "1px solid var(--gg-border)",
        }}
      >
        {[
          ["history", "历史"],
          ["faction", "势力"],
          ["city", "城市"],
          ["god", "上帝"],
        ].map(([value, label]) => (
          <Tab
            key={value}
            value={value}
            label={label}
            onClick={() => dispatch(setRightPanelTab(value))}
            sx={{
              minWidth: 0,
              maxWidth: "none",
              whiteSpace: "nowrap",
              fontSize: "0.82rem",
              px: 0.5,
              color:
                rightPanelTab === value
                  ? "var(--gg-selected)"
                  : "var(--gg-text)",
              borderBottom:
                rightPanelTab === value
                  ? "2px solid var(--gg-selected)"
                  : "2px solid transparent",
            }}
          />
        ))}
      </MuiBox>
      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {rightPanelTab === "history" ? <HistoryScroll></HistoryScroll> : null}
        {rightPanelTab === "faction" ? <FactionDetails></FactionDetails> : null}
        {rightPanelTab === "city" ? <CityDetails></CityDetails> : null}
        {rightPanelTab === "god" ? <LocalDanmaku></LocalDanmaku> : null}
      </Box>
    </Box>
  );
}
