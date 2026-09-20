import Box from "@mui/material/Box";
import { Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { APP_VERSION } from "../../../config/version";
import { formatWorldDate, formatWorldDuration } from "../../../Simulation/WorldTime";
import { formatWorldPhase } from "../../../Simulation/WorldPhase";
import WorldEra, { WorldEra as WorldEraRecord } from "../../../Simulation/WorldEra";
import { RootState } from "../../../store";

export default function Title() {
  const { gameName } = useSelector((state: RootState) => state.config);
  const worldMonth = useSelector((state: RootState) => state.root.worldMonth);
  const worldPhase = useSelector((state: RootState) => state.root.worldPhase);
  const [eras, setEras] = useState<WorldEraRecord[]>([]);
  useEffect(() => WorldEra.subscribe(setEras), []);
  const currentEra = eras.find((era) => era.endMonth === undefined);
  const eraDuration =
    currentEra !== undefined
      ? formatWorldDuration(Math.max(0, worldMonth - currentEra.startMonth))
      : undefined;
  return (
    <Box
      sx={{
        p: 1,
        borderBottom: "1px solid var(--gg-border)",
      }}
    >
      <Typography fontWeight="bold" align="center" fontSize="1.15rem">
        万国纪 · Wanguoji {APP_VERSION}
      </Typography>
      <Typography fontWeight="bold" align="center" fontSize="0.86rem">
        {gameName} · 纪元 {formatWorldDate(worldMonth)}
      </Typography>
      <Typography
        align="center"
        fontSize="0.78rem"
        color="var(--gg-text-muted)"
        title={
          currentEra
            ? `${formatWorldDate(currentEra.startMonth)}～今 · 已持续${eraDuration}\n${currentEra.explanation}`
            : undefined
        }
      >
        时代：{currentEra ? currentEra.name : formatWorldPhase(worldPhase)}
        {currentEra ? ` · ${formatWorldDate(currentEra.startMonth)}～今` : ""}
      </Typography>
      <Typography align="center" fontSize="0.7rem" color="var(--gg-text-muted)">
        世界格局：{formatWorldPhase(worldPhase)}
      </Typography>
    </Box>
  );
}
