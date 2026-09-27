import { Box, Button, TextField, Typography } from "@mui/material";
import { FormEvent, KeyboardEvent, useState } from "react";
import { useSelector } from "react-redux";
import { getLocalUserId, sendLocalDanmu } from "../../../Live/LocalDanmaku";
import { RootState } from "../../../store";

const LOCAL_NAME_KEY = "gridgod-local-danmaku-name";

/** Legacy local-player identity and text-command entry, hosted under GodConsole advanced tools. */
export default function LocalDanmaku() {
  const teams = useSelector((state: RootState) => state.root.teams);
  const cards = useSelector((state: RootState) => state.config.cards);
  const worldRunning = useSelector((state: RootState) => state.root.worldRunning);
  const selectedFactionName = useSelector((state: RootState) => state.root.selectedFactionName);
  const [name, setName] = useState(() => localStorage.getItem(LOCAL_NAME_KEY) ?? "小明");
  const [command, setCommand] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const selectedTeam = teams.find((team) => team.name === selectedFactionName);
  const userId = getLocalUserId(name.trim() || "本地玩家");
  const currentUser = teams.flatMap((team) => [...team.users]).find((user) => user.id === userId);

  const send = (text: string) => {
    if (sendLocalDanmu(name, text)) {
      localStorage.setItem(LOCAL_NAME_KEY, name.trim() || "本地玩家");
      setCommand("");
    }
  };
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    send(command);
  };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();
    if (event.key === "Enter") submit();
  };

  return <Box component="form" onSubmit={submit} sx={{ minWidth: 0, p: 1, display: "flex", flexDirection: "column", gap: 0.75 }}>
    <Typography variant="caption" fontWeight={700}>本地角色 / 旧指令</Typography>
    <TextField size="small" label="本地角色名称" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={keyDown} disabled={!worldRunning} />
    <Typography variant="caption">当前身份：{currentUser ? `${currentUser.team.displayName}势力` : "尚未加入"}</Typography>
    <Button size="small" variant="outlined" disabled={!worldRunning || !selectedTeam || selectedTeam.isDie || !name.trim()} onClick={() => selectedTeam && send(currentUser ? `投靠 ${selectedTeam.name}` : selectedTeam.name)}>
      {currentUser ? `投靠${selectedTeam?.displayName ?? "未选择势力"}` : `加入${selectedTeam?.displayName ?? "未选择势力"}`}
    </Button>
    {currentUser ? <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 0.5 }}>
      <Button size="small" variant="outlined" disabled={!worldRunning} onClick={() => send("TP")}>返回主城</Button>
      <Button size="small" variant="outlined" disabled={!worldRunning} onClick={() => send("强化")}>随机强化</Button>
      <Button size="small" variant="outlined" disabled={!worldRunning || !cards} onClick={() => send("发兵")}>发兵</Button>
    </Box> : null}
    <Button size="small" variant="text" onClick={() => setAdvancedOpen((open) => !open)}>{advancedOpen ? "收起文本指令" : "展开文本指令"}</Button>
    {advancedOpen ? <><TextField size="small" label="旧指令" value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={keyDown} disabled={!worldRunning} /><Button type="submit" size="small" variant="outlined" disabled={!worldRunning || !name.trim() || !command.trim()}>发送文本指令</Button></> : null}
  </Box>;
}
