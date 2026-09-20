import { Box, Button, Typography } from "@mui/material";
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type City from "../../../Components/City";
import Game from "../../../Game/Game";
import { colorToString } from "../../../paid/theme";
import ArchivedCities from "../../../Simulation/ArchivedCities";
import { selectCityFromList } from "../../../Simulation/CitySelection";
import {
  CityListFilter,
  getVisibleCities,
} from "../../../Simulation/CityListRules";
import { formatWorldDate } from "../../../Simulation/WorldTime";
import { RootState } from "../../../store";
import { setSelectedCityId } from "../../../store/rootSlice";

export default function CityDetails() {
  const dispatch = useDispatch();
  const [filter, setFilter] = useState<CityListFilter>("all");
  const selectedCityId = useSelector(
    (state: RootState) => state.root.selectedCityId
  );
  const teams = useSelector((state: RootState) => state.root.teams);
  const cities = teams.flatMap((team) => team.cities);
  const city = cities.find((item) => item.id === selectedCityId);
  const archivedCity = selectedCityId
    ? ArchivedCities.get(selectedCityId)
    : undefined;
  if (!city) {
    if (archivedCity) {
      const founderTeam = teams.find((team) => team.name === archivedCity.founderFactionId);
      const lastOwnerTeam = teams.find((team) => team.name === archivedCity.lastOwnerFactionId);
      return (
        <Box sx={{ p: 1, borderTop: "1px solid #00000022" }}>
          <Button size="small" onClick={() => dispatch(setSelectedCityId(undefined))}>
            ← 返回城市列表
          </Button>
          <Typography fontWeight="bold">城市档案：{archivedCity.name}</Typography>
          <Typography fontSize="0.9rem">
            原属：{founderTeam?.displayName ?? archivedCity.founderFactionId}
          </Typography>
          <Typography fontSize="0.9rem">
            最后归属：{lastOwnerTeam?.displayName ?? archivedCity.lastOwnerFactionId}
          </Typography>
          <Typography fontSize="0.9rem">
            建立：{formatWorldDate(archivedCity.foundedMonth)}
          </Typography>
          <Typography fontSize="0.9rem">
            毁灭：{formatWorldDate(archivedCity.destroyedMonth)}
          </Typography>
          <Typography fontSize="0.9rem">
            易手：{archivedCity.captureCount} 次
          </Typography>
        </Box>
      );
    }
    return <CityList cities={cities} filter={filter} onFilterChange={setFilter} />;
  }

  const owner = city.ownerTeam;
  const founder = city.founderTeam;
  const attacker = teams.find((team) => team.name === city.attackingFactionId);

  return (
    <Box sx={{ p: 1, borderTop: "1px solid #00000022" }}>
      <Button size="small" onClick={() => dispatch(setSelectedCityId(undefined))}>
        ← 返回城市列表
      </Button>
      <Typography fontWeight="bold" variant="h6">
        {city.isCapital ? "★ " : "● "}
        {city.name}
      </Typography>
      <Typography fontSize="0.9rem">
        当前归属：
        <FactionName name={owner?.displayName ?? "无"} color={owner?.color} />
      </Typography>
      <Typography fontSize="0.9rem">
        原始归属：
        <FactionName name={founder?.displayName ?? city.founderFactionId} color={founder?.color} />
      </Typography>
      <Typography fontSize="0.9rem">
        城市身份：{city.isCapital ? "首都" : "普通城市"}
      </Typography>
      <Typography fontSize="0.9rem">
        城防：{city.defense} / {city.maxDefense}
      </Typography>
      <Typography fontSize="0.9rem">
        城市防御区：{city.fortifiedCells.length} 格
      </Typography>
      <Typography fontSize="0.9rem">
        忠诚：{city.loyalty}
      </Typography>
      <Typography fontSize="0.9rem">
        破坏度：{city.devastation} / 100
      </Typography>
      <Typography fontSize="0.9rem">
        状态：{city.loyaltyStatus}
      </Typography>
      <Typography fontSize="0.9rem">
        建立：{formatWorldDate(city.foundedYear)}
      </Typography>
      <Typography fontSize="0.9rem">易手：{city.captureCount} 次</Typography>
      <Typography fontSize="0.9rem">
        围攻：
        {city.underSiege && attacker ? (
          <>
            正在被
            <FactionName name={attacker.displayName} color={attacker.color} />
            围攻
          </>
        ) : (
          "无"
        )}
      </Typography>
      <Typography sx={{ mt: 1 }} fontWeight="bold">
        城市历史
      </Typography>
      <Box sx={{ maxHeight: "8rem", overflowY: "auto" }}>
        {[...city.history]
          .sort((a, b) => b.year - a.year)
          .map((event, index) => (
            <Typography key={`${event.year}-${event.type}-${index}`} fontSize="0.85rem">
              {formatWorldDate(event.year)} {event.title}
            </Typography>
          ))}
      </Box>
    </Box>
  );
}

function CityList({
  cities,
  filter,
  onFilterChange,
}: {
  cities: City[];
  filter: CityListFilter;
  onFilterChange: (filter: CityListFilter) => void;
}) {
  const visibleCities = getVisibleCities(cities, filter);
  return (
    <Box sx={{ p: 1, borderTop: "1px solid #00000022" }}>
      <Typography fontWeight="bold">天下城市</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 0.4, my: 0.75 }}>
        {[
          ["all", "全部"],
          ["capital", "首都"],
          ["siege", "围攻"],
          ["abnormal", "异常"],
        ].map(([value, label]) => (
          <Button
            key={value}
            size="small"
            variant={filter === value ? "contained" : "outlined"}
            onClick={() => onFilterChange(value as CityListFilter)}
            sx={{ minWidth: 0, px: 0.5, fontSize: "0.72rem" }}
          >
            {label}
          </Button>
        ))}
      </Box>
      <Box sx={{ display: "grid", gap: 0.4, maxHeight: "24rem", overflowY: "auto" }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1.5fr 0.8fr 0.7fr 0.8fr 0.7fr 0.7fr",
            gap: 0.5,
            fontSize: "0.74rem",
            color: "var(--gg-text-muted)",
          }}
        >
          <span>城市</span>
          <span>归属</span>
          <span>身份</span>
          <span>城防</span>
          <span>忠诚</span>
          <span>破坏</span>
        </Box>
        {visibleCities.map((item) => (
          <Box
            key={item.id}
            onClick={() => selectCityFromList(Game.Core, item.id)}
            sx={{
              display: "grid",
              gridTemplateColumns: "1.5fr 0.8fr 0.7fr 0.8fr 0.7fr 0.7fr",
              gap: 0.5,
              alignItems: "center",
              fontSize: "0.78rem",
              p: 0.55,
              border: "1px solid var(--gg-border)",
              borderRadius: "var(--gg-radius)",
              cursor: "pointer",
              background: item.underSiege ? "rgba(255,59,48,0.08)" : "var(--gg-panel)",
              "&:hover": {
                borderColor: "var(--gg-selected)",
              },
            }}
          >
            <span>{item.isCapital ? "★ " : "● "}{item.name}</span>
            <span>{item.ownerTeam?.displayName ?? item.ownerFactionId}</span>
            <span>{item.isCapital ? "首都" : "城市"}</span>
            <span>{item.defense}/{item.maxDefense}</span>
            <span>{item.loyalty}</span>
            <span>{item.devastation}</span>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function FactionName({ name, color }: { name: string; color?: number }) {
  return (
    <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
      {color !== undefined ? (
        <Box
          component="span"
          sx={{
            width: "0.75rem",
            height: "0.75rem",
            backgroundColor: colorToString(color),
            border: "1px solid #00000055",
          }}
        />
      ) : null}
      {name}
    </Box>
  );
}
