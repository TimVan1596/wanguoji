import { Accordion, AccordionDetails, AccordionSummary, Box, Button, MenuItem, TextField, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import City, { getFactionStability } from "../../../Components/City";
import Team from "../../../Components/Team";
import Game from "../../../Game/Game";
import { formatWorldDate } from "../../../Simulation/WorldTime";
import GodActionService, { describePoliticalAvailability } from "../../../Simulation/GodActionService";
import { RootState } from "../../../store";
import { setSelectedCityId, setSelectedFactionName, updateTeams } from "../../../store/rootSlice";
import LocalDanmaku from "../LocalDanmaku";

type LogEntry = { date: string; text: string };

export default function GodConsole({ saving }: { saving: boolean }) {
  const dispatch = useDispatch();
  const state = useSelector((root: RootState) => root.root);
  const teams = state.teams;
  const [log, setLog] = useState<LogEntry[]>([]);
  const [customPopulation, setCustomPopulation] = useState("1");
  const [customStability, setCustomStability] = useState("0");
  const busy = !state.worldStarted || saving || state.backgroundCatchUpActive || !Game.Core?.simulator;
  const selectedTeam = teams.find((team) => team.name === state.selectedFactionName);
  const cities = useMemo(() => teams.flatMap((team) => team.cities), [teams]);
  const selectedCity = cities.find((city) => city.id === state.selectedCityId);
  const activeCities = selectedTeam?.cities.filter((city) => !city.destroyed && city.ownerFactionId === selectedTeam.name) ?? [];
  const stability = selectedTeam ? getFactionStability(selectedTeam) : undefined;
  const political = describePoliticalAvailability(selectedCity, state.worldMonth);

  const record = (result: ReturnType<typeof GodActionService.addPopulation>, subject: string) => {
    if (!result.success) return;
    setLog((current) => [{ date: formatWorldDate(state.worldMonth), text: `${subject} ${result.message}` }, ...current].slice(0, 10));
  };
  const population = (delta: number) => {
    if (busy || !selectedTeam) return;
    const result = delta > 0 ? GodActionService.addPopulation(selectedTeam, delta) : GodActionService.removePopulation(selectedTeam, -delta);
    record(result, selectedTeam.displayName);
  };
  const adjustStability = (delta: number) => {
    if (busy || !selectedTeam) return;
    record(GodActionService.changeStability(selectedTeam, delta), selectedTeam.displayName);
  };
  const cityAction = (field: "loyalty" | "defense" | "devastation", operation: "delta" | "set" | "full", value: number) => {
    if (busy || !selectedCity) return;
    record(GodActionService.changeCity(selectedCity, field, operation, value), selectedCity.name);
  };
  const selectFaction = (name: string) => {
    dispatch(setSelectedFactionName(name || undefined));
    if (state.selectedCityId && cities.find((city) => city.id === state.selectedCityId)?.ownerFactionId !== name) dispatch(setSelectedCityId(undefined));
  };
  const factionMutationLocked = busy || !selectedTeam || selectedTeam.isDie;
  const cityMutationLocked = busy || !selectedCity || selectedCity.destroyed;
  const summary = (title: string) => <Typography fontSize="0.9rem" fontWeight={700}>{title}</Typography>;
  const grid = { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 0.5, "& .MuiButton-root": { minWidth: 0, px: 0.35, whiteSpace: "nowrap", fontSize: "0.72rem" } } as const;

  return <Box sx={{ height: "100%", minHeight: 0, minWidth: 0, overflowY: "auto", overflowX: "hidden", p: 0.75, display: "flex", flexDirection: "column", gap: 0.75, boxSizing: "border-box" }}>
    <Typography variant="subtitle1" fontWeight={800}>God Console</Typography>
    <Box sx={{ display: "grid", gap: 0.5, minWidth: 0 }}>
      {summary("目标")}
      <TextField select size="small" label="目标势力" value={selectedTeam?.name ?? ""} onChange={(event) => selectFaction(event.target.value)}>
        <MenuItem value="">未选择势力</MenuItem>{teams.map((team) => <MenuItem key={team.name} value={team.name}>{team.displayName}{team.isDie ? "（已灭亡）" : ""}</MenuItem>)}
      </TextField>
      <TextField select size="small" label="目标城市" value={selectedCity?.id ?? ""} onChange={(event) => {
        const city = cities.find((item) => item.id === event.target.value);
        dispatch(setSelectedCityId(city?.id));
        if (city) dispatch(setSelectedFactionName(city.ownerFactionId));
      }}>
        <MenuItem value="">未选择城市</MenuItem>{cities.map((city) => <MenuItem key={city.id} value={city.id}>{city.name} · {city.ownerTeam?.displayName ?? city.ownerFactionId}</MenuItem>)}
      </TextField>
      <Typography variant="caption">目标势力：{selectedTeam?.displayName ?? "未选择势力"} · 城市：{selectedCity?.name ?? "未选择城市"}</Typography>
    </Box>

    <Box sx={{ borderTop: "1px solid var(--gg-border)", pt: 0.5 }}>
      {summary("人口")}
      <Typography variant="caption">人口：{selectedTeam?.users.size ?? "—"} / {selectedTeam ? Game.Core?.simulator?.getPopulationCapacity(selectedTeam) ?? "—" : "—"}（自然容量；God 干预可突破）</Typography>
      <Box sx={grid}>{[-50, -10, -5, -1, 1, 5, 10, 50].map((delta) => <Button key={delta} size="small" variant="outlined" disabled={factionMutationLocked} onClick={() => population(delta)}>{delta > 0 ? "+" : ""}{delta}</Button>)}</Box>
      <Box sx={{ display: "flex", gap: 0.5, mt: 0.5 }}>
        <TextField size="small" type="number" label="自定义 delta" value={customPopulation} onChange={(event) => setCustomPopulation(event.target.value)} sx={{ minWidth: 0, flex: 1 }} />
        <Button size="small" disabled={factionMutationLocked || !Number(customPopulation)} onClick={() => population(Number(customPopulation))}>执行</Button>
      </Box>
    </Box>

    <Box sx={{ borderTop: "1px solid var(--gg-border)", pt: 0.5 }}>
      {summary("稳定度 · 由城市忠诚派生")}
      <Typography variant="caption">当前：{stability ?? "—"}{!activeCities.length && selectedTeam ? "（无有效城市）" : ""}</Typography>
      <Box sx={grid}>{[-20, -10, -5, 5, 10, 20].map((delta) => <Button key={delta} size="small" variant="outlined" disabled={factionMutationLocked || !activeCities.length} onClick={() => adjustStability(delta)}>{delta > 0 ? "+" : ""}{delta}</Button>)}</Box>
      <Box sx={{ display: "flex", gap: 0.5, mt: 0.5 }}><TextField size="small" type="number" label="调整 delta" value={customStability} onChange={(event) => setCustomStability(event.target.value)} sx={{ minWidth: 0, flex: 1 }} /><Button size="small" disabled={factionMutationLocked || !activeCities.length || !Number(customStability)} onClick={() => adjustStability(Number(customStability))}>执行</Button></Box>
    </Box>

    <Box sx={{ borderTop: "1px solid var(--gg-border)", pt: 0.5 }}>
      {summary("城市干预")}
      <Typography variant="caption">{selectedCity ? `${selectedCity.name} · 忠诚 ${selectedCity.loyalty} · 城防 ${selectedCity.defense}/${selectedCity.maxDefense} · 破坏 ${selectedCity.devastation}` : "未选择城市"}</Typography>
      <Typography variant="caption" display="block">忠诚</Typography><Box sx={grid}>{[-10, 10, 0, 25, 50, 75, 95].map((value) => <Button key={`l${value}`} size="small" disabled={cityMutationLocked} onClick={() => cityAction("loyalty", value === -10 || value === 10 ? "delta" : "set", value)}>{value === -10 || value === 10 ? (value > 0 ? "+" : "") + value : `设${value}`}</Button>)}</Box>
      <Typography variant="caption" display="block">城防 · Authority: City.defense</Typography><Box sx={grid}>{[-1, 1].map((value) => <Button key={value} size="small" disabled={cityMutationLocked} onClick={() => cityAction("defense", "delta", value)}>{value > 0 ? "+" : ""}{value}</Button>)}<Button size="small" disabled={cityMutationLocked} onClick={() => cityAction("defense", "set", 1)}>设1</Button><Button size="small" sx={{ gridColumn: "span 2" }} disabled={cityMutationLocked} onClick={() => cityAction("defense", "full", 0)}>满城防</Button></Box>
      <Typography variant="caption" display="block">破坏度</Typography><Box sx={grid}>{[-10, 10, 0].map((value) => <Button key={`d${value}`} size="small" disabled={cityMutationLocked} onClick={() => cityAction("devastation", value === 0 ? "set" : "delta", value)}>{value === 0 ? "清零" : (value > 0 ? "+" : "") + value}</Button>)}</Box>
    </Box>

    <Box sx={{ borderTop: "1px solid var(--gg-border)", pt: 0.5 }}>
      {summary("政治干预")}
      <Button fullWidth size="small" disabled={busy || !selectedCity || political.rebellion !== "可尝试"} onClick={() => {
        const result = GodActionService.foundRebel(selectedCity);
        if (result.success) setLog((current) => [{ date: formatWorldDate(state.worldMonth), text: result.message }, ...current].slice(0, 10));
      }}>煽动叛乱</Button><Typography variant="caption" display="block">{political.rebellion}</Typography>
      <Button fullWidth size="small" disabled={busy || !selectedCity || political.restoration !== "可尝试"} onClick={() => {
        const result = GodActionService.restoreFaction(selectedCity);
        if (result.success) setLog((current) => [{ date: formatWorldDate(state.worldMonth), text: result.message }, ...current].slice(0, 10));
      }}>扶持复国</Button><Typography variant="caption" display="block">{political.restoration}</Typography>
    </Box>

    <Box sx={{ borderTop: "1px solid var(--gg-border)", pt: 0.5 }}>{summary("最近操作")}{log.length ? log.map((entry, index) => <Typography key={`${entry.date}-${index}`} variant="caption" display="block">{entry.date}　{entry.text}</Typography>) : <Typography variant="caption">本次会话暂无操作</Typography>}</Box>
    <Accordion disableGutters><AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 36, "& .MuiAccordionSummary-content": { my: 0.5 } }}><Typography variant="caption">本地角色 / 旧指令（高级）</Typography></AccordionSummary><AccordionDetails sx={{ p: 0, minWidth: 0 }}><LocalDanmaku /></AccordionDetails></Accordion>
  </Box>;
}
