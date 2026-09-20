import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getFactionStability } from "../../../Components/City";
import Game from "../../../Game/Game";
import { colorToString } from "../../../paid/theme";
import {
  getActiveRankingFactions,
  getFactionStatusSummary,
} from "../../../Simulation/FactionRankingRules";
import {
  buildFactionRankingIdentity,
} from "../../../Simulation/FactionDisplayRules";
import { getPopulationCapacity } from "../../../Simulation/PopulationSystem";
import {
  calculateTerritoryMetrics,
  getFactionTerritoryMetric,
} from "../../../Simulation/TerritoryMetrics";
import DynastyRegistry from "../../../Politics/Dynasty";
import { RootState } from "../../../store";
import {
  setFactionDetailTab,
  setRightPanelTab,
  setSelectedFactionName,
} from "../../../store/rootSlice";
import formatNumber from "../../../utils/formatNumber";

const RANKING_GRID_TEMPLATE = "minmax(0, 1fr) 64px 58px 30px 36px";
const numericColumnSx = {
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  minWidth: 0,
};

export default function Teams() {
  const dispatch = useDispatch();
  const teams = useSelector((state: RootState) => state.root.teams);
  const selectedFactionName = useSelector(
    (state: RootState) => state.root.selectedFactionName
  );
  const worldMonth = useSelector((state: RootState) => state.root.worldMonth);
  const territorySnapshots = useRef<
    Record<string, { year: number; territory: number }[]>
  >({});
  const totalCells = Game.Core?.totalCells ?? 1;
  const rankedTeams = getActiveRankingFactions(teams);
  const territoryMetrics = calculateTerritoryMetrics(teams, totalCells);
  const statusSummary = getFactionStatusSummary(teams);
  const totalPopulation = teams.reduce((sum, team) => sum + team.users.size, 0);
  const territoryLeader = rankedTeams[0];

  useEffect(() => {
    teams.forEach((team) => {
      const snapshots = territorySnapshots.current[team.name] ?? [];
      const latest = snapshots[snapshots.length - 1];
      if (!latest || latest.year !== worldMonth) {
        territorySnapshots.current[team.name] = [
          ...snapshots,
          { year: worldMonth, territory: team.blocks.children.size },
        ].filter((snapshot) => worldMonth - snapshot.year <= 12);
      }
    });
  }, [teams, worldMonth]);

  return (
    <Box
      sx={{
        px: 1,
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <Box sx={{ mb: 1, p: 1, backgroundColor: "var(--gg-panel)" }}>
        <Typography fontSize="0.86rem">
          在国 {statusSummary.active} · 流亡 {statusSummary.exiled} · 已灭亡{" "}
          {statusSummary.extinct}
        </Typography>
        <Typography fontSize="0.86rem">
          总人口 {formatNumber(totalPopulation)}
        </Typography>
        <Typography fontSize="0.86rem">
          领土第一 {territoryLeader ? `${territoryLeader.displayName}` : "无"}
        </Typography>
      </Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: RANKING_GRID_TEMPLATE,
          px: 0.75,
          pb: 0.5,
          color: "var(--gg-text-muted)",
          fontSize: "0.76rem",
          columnGap: 0.5,
          alignItems: "center",
        }}
      >
        <span>势力</span>
        <Box component="span" sx={numericColumnSx}>人口</Box>
        <Box component="span" sx={numericColumnSx}>领土</Box>
        <Box component="span" sx={numericColumnSx}>城</Box>
        <Box component="span" sx={numericColumnSx}>稳</Box>
      </Box>
      <Box sx={{ display: "grid", gap: 0.5 }}>
        {rankedTeams.map((team, index) => {
          const color = colorToString(team.color);
          const territory = team.blocks.children.size;
          const territoryPercent = getFactionTerritoryMetric(
            territoryMetrics,
            team.name
          ).controlledTerritoryShare;
          const capacity = getPopulationCapacity(team);
          const population = team.users.size;
          const selected = selectedFactionName === team.name;
          const stability = getFactionStability(team);
          const rulerTitle = DynastyRegistry.getRulerTitleDisplay(team.name, worldMonth);
          const identity = buildFactionRankingIdentity(team, worldMonth, rulerTitle);
          const trend = getTerritoryTrend(
            territorySnapshots.current[team.name] ?? [],
            worldMonth,
            territory,
            totalCells
          );

          return (
            <Box
              key={team.name}
              title={`首都：${team.capitalCity?.name ?? "无"} · 城防：${
                team.capitalCity?.defense ?? 0
              }/${team.capitalCity?.maxDefense ?? 0}`}
              onClick={() => {
                dispatch(setSelectedFactionName(selected ? undefined : team.name));
                if (!selected) {
                  dispatch(setFactionDetailTab("overview"));
                  dispatch(setRightPanelTab("faction"));
                }
              }}
              sx={{
                minHeight: 44,
                px: 0.75,
                py: 0.55,
                display: "grid",
                gridTemplateColumns: RANKING_GRID_TEMPLATE,
                alignItems: "center",
                gap: 0.5,
                border: selected
                  ? "1px solid var(--gg-selected)"
                  : "1px solid var(--gg-border)",
                backgroundColor: selected
                  ? "rgba(47, 111, 237, 0.12)"
                  : "var(--gg-panel)",
                cursor: "pointer",
                opacity: 1,
                "&:hover": {
                  backgroundColor: "var(--gg-panel-strong)",
                },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.55, minWidth: 0 }}>
                <Box
                  sx={{
                    width: "0.8rem",
                    height: "0.8rem",
                    backgroundColor: color,
                    border: "1px solid rgba(0,0,0,0.35)",
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.35,
                      minWidth: 0,
                    }}
                  >
                    <Typography
                      component="span"
                      fontWeight={identity.prestigeWeight === 2 ? 800 : "bold"}
                      fontSize="0.9rem"
                      sx={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        minWidth: "4.5em",
                        maxWidth: "7.5em",
                      }}
                    >
                      {identity.displayName}
                    </Typography>
                    <Box
                      component="span"
                      sx={{
                        fontSize: "0.66rem",
                        px: 0.35,
                        py: 0.05,
                        border: "1px solid var(--gg-border)",
                        borderRadius: "4px",
                        lineHeight: 1.25,
                        flexShrink: 0,
                        color:
                          identity.prestigeWeight === 2
                            ? "#7a4b00"
                            : identity.prestigeWeight === 1
                            ? "var(--gg-text)"
                            : "var(--gg-text-muted)",
                        background:
                          identity.prestigeWeight === 2
                            ? "rgba(138,90,0,0.12)"
                            : "rgba(255,255,255,0.4)",
                      }}
                    >
                      {identity.badge}
                    </Box>
                    <Typography
                      component="span"
                      fontSize="0.7rem"
                      color="var(--gg-text-muted)"
                      sx={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}
                    >
                      #{index + 1} {trend}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.35, alignItems: "center", minWidth: 0 }}>
                    <Typography
                      component="span"
                      fontSize="0.68rem"
                      color="var(--gg-text-muted)"
                      noWrap
                      sx={{ minWidth: 0 }}
                    >
                      {identity.rulerTitle || "—"}
                    </Typography>
                  </Box>
                </Box>
              </Box>
              <Typography fontSize="0.78rem" noWrap sx={numericColumnSx}>
                {formatNumber(population)}/{formatNumber(capacity)}
              </Typography>
              <Typography fontSize="0.78rem" noWrap sx={numericColumnSx}>
                {territoryPercent.toFixed(1)}%
              </Typography>
              <Typography fontSize="0.78rem" sx={numericColumnSx}>{team.cities.length}</Typography>
              <Typography fontSize="0.78rem" sx={numericColumnSx}>{stability ?? "—"}</Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function getTerritoryTrend(
  snapshots: { year: number; territory: number }[],
  worldYear: number,
  territory: number,
  totalCells: number
) {
  const baseline =
    [...snapshots]
      .reverse()
      .find((snapshot) => worldYear - snapshot.year >= 10) ?? snapshots[0];
  if (!baseline) {
    return "—";
  }
  const delta = territory - baseline.territory;
  const threshold = Math.max(5, totalCells * 0.005);
  if (delta >= threshold) {
    return "↑";
  }
  if (delta <= -threshold) {
    return "↓";
  }
  return "—";
}
