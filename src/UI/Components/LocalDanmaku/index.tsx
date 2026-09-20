import {
  Box,
  Button,
  TextField,
  Typography,
} from "@mui/material";
import { FormEvent, KeyboardEvent, useState } from "react";
import { useSelector } from "react-redux";
import {
  getLocalUserId,
  sendGodReinforcements,
  sendLocalDanmu,
} from "../../../Live/LocalDanmaku";
import Game from "../../../Game/Game";
import DynastyRegistry from "../../../Politics/Dynasty";
import WorldRemnants from "../../../Simulation/WorldRemnants";
import { REBEL_LOYALTY_THRESHOLD } from "../../../config/simulation";
import { RootState } from "../../../store";

const LOCAL_NAME_KEY = "gridgod-local-danmaku-name";

export default function LocalDanmaku() {
  const teams = useSelector((state: RootState) => state.root.teams);
  const cards = useSelector((state: RootState) => state.config.cards);
  const worldRunning = useSelector(
    (state: RootState) => state.root.worldRunning
  );
  const selectedFactionName = useSelector(
    (state: RootState) => state.root.selectedFactionName
  );
  const selectedCityId = useSelector(
    (state: RootState) => state.root.selectedCityId
  );
  const [name, setName] = useState(
    () => localStorage.getItem(LOCAL_NAME_KEY) ?? "小明"
  );
  const [text, setText] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const selectedTeam =
    teams.find((team) => team.name === selectedFactionName) ?? teams[0];
  const selectedCity = teams
    .flatMap((team) => team.cities)
    .find((city) => city.id === selectedCityId);
  const selectedCityFounder = selectedCity?.founderTeam;
  const selectedCityRemnants = selectedCityFounder
    ? WorldRemnants.get(selectedCityFounder.name)
    : undefined;
  const selectedCityDynasty = selectedCityFounder
    ? DynastyRegistry.get(selectedCityFounder.name)
    : undefined;
  const selectedCityHasClaimant = selectedCityFounder
    ? DynastyRegistry.hasClaimant(selectedCityFounder.name)
    : false;
  const userId = getLocalUserId(name.trim() || "本地玩家");
  const currentUser = teams
    .map((team) => [...team.users])
    .flat()
    .find((user) => user.id === userId);
  const canUseWorld = worldRunning;
  const canTargetFaction = Boolean(
    canUseWorld && selectedTeam && !selectedTeam.isDie
  );

  const sendCommand = (command: string) => {
    if (!sendLocalDanmu(name, command)) {
      return;
    }
    localStorage.setItem(LOCAL_NAME_KEY, name.trim() || "本地玩家");
    setText("");
  };

  const handleSubmit = (event?: FormEvent) => {
    event?.preventDefault();
    sendCommand(text);
  };

  const handleJoinOrObey = () => {
    if (!selectedTeam) {
      return;
    }
    sendCommand(currentUser ? `投靠 ${selectedTeam.name}` : selectedTeam.name);
  };

  const handleReinforcements = (count: number) => {
    if (!selectedTeam) {
      return;
    }
    sendGodReinforcements(selectedTeam.name, count);
  };

  const handleSupportRestoration = () => {
    if (!selectedCity) {
      return;
    }
    Game.Core?.simulator?.restoreFactionByGod(selectedCity);
  };

  const handleFoundRebel = () => {
    if (!selectedCity) {
      return;
    }
    Game.Core?.simulator?.foundRebelByGod(selectedCity);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      handleSubmit();
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{
        p: 1,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <Typography fontWeight="bold" variant="h5" align="center">
        上帝控制台
      </Typography>
      <Typography fontSize="0.95rem">
        当前选择：{selectedTeam ? `${selectedTeam.displayName}势力` : "无"}
      </Typography>
      <Button
        type="button"
        variant="contained"
        disabled={!canTargetFaction}
        onClick={() => handleReinforcements(1)}
      >
        +1援军
      </Button>
      <Button
        type="button"
        variant="text"
        onClick={() => setMoreOpen((open) => !open)}
      >
        {moreOpen ? "收起更多操作" : "更多操作"}
      </Button>
      {moreOpen ? (
        <>
          <TextField
            size="small"
            label="我的角色"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={handleInputKeyDown}
            disabled={!worldRunning}
          />
          <Typography fontSize="0.95rem">
            我的阵营：{currentUser ? `${currentUser.team.displayName}势力` : "尚未加入"}
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
            {[5, 10].map((count) => (
              <Button
                key={count}
                type="button"
                variant="contained"
                disabled={!canTargetFaction}
                onClick={() => handleReinforcements(count)}
              >
                +{count}
              </Button>
            ))}
            <Button
              type="button"
              variant="outlined"
              disabled={!canTargetFaction || !name.trim()}
              onClick={handleJoinOrObey}
            >
              {currentUser
                ? `投靠${selectedTeam?.displayName ?? ""}`
                : `加入${selectedTeam?.displayName ?? ""}`}
            </Button>
            <Button
              type="button"
              variant="outlined"
              disabled={!canUseWorld || !currentUser}
              onClick={() => sendCommand("TP")}
            >
              返回主城
            </Button>
            <Button
              type="button"
              variant="outlined"
              disabled={!canUseWorld || !currentUser}
              onClick={() => sendCommand("强化")}
            >
              随机强化
            </Button>
            <Button
              type="button"
              variant="outlined"
              disabled={!canUseWorld || !currentUser || !cards}
              onClick={() => sendCommand("发兵")}
            >
              发兵
            </Button>
          </Box>
          {selectedCity ? (
            <Box
              sx={{
                border: "1px solid var(--gg-border)",
                p: 1,
                display: "grid",
                gap: 0.75,
              }}
            >
              <Typography fontWeight="bold" fontSize="0.9rem">
                城市干预：{selectedCity.name}
              </Typography>
              <Button
                type="button"
                variant="outlined"
                disabled={
                  !canUseWorld ||
                  !selectedCityFounder?.isDie ||
                  !selectedCityRemnants ||
                  !selectedCityDynasty ||
                  !selectedCityHasClaimant
                }
                onClick={handleSupportRestoration}
              >
                扶持{selectedCityFounder?.displayName ?? ""}国复国
              </Button>
              <Button
                type="button"
                variant="outlined"
                disabled={
                  !canUseWorld ||
                  selectedCity.loyalty > REBEL_LOYALTY_THRESHOLD ||
                  selectedCity.isInCaptureGrace(Game.Core?.simulator?.year ?? 0)
                }
                onClick={handleFoundRebel}
              >
                煽动叛乱
              </Button>
            </Box>
          ) : null}
          <Button
            type="button"
            variant="text"
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            {advancedOpen ? "收起高级命令" : "展开高级命令"}
          </Button>
          {advancedOpen ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <TextField
                size="small"
                label="命令"
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={handleInputKeyDown}
                disabled={!canUseWorld}
              />
              <Button
                type="submit"
                variant="outlined"
                disabled={!canUseWorld || !name.trim() || !text.trim()}
              >
                发送文本命令
              </Button>
            </Box>
          ) : null}
        </>
      ) : null}
    </Box>
  );
}
