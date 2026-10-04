import { Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import WorldEra, { WorldEra as WorldEraRecord } from "../../Simulation/WorldEra";
import {
  AmbientMusicManager,
  AmbientMusicSnapshot,
  getMusicMoodForEra,
} from "../../Runtime/AmbientMusic";
import {
  readMusicPreferences,
  subscribeMusicPreferences,
  MUSIC_PREFERENCES_CHANGED_EVENT,
} from "../../Runtime/MusicPreferences";
import { useSelector } from "react-redux";
import { RootState } from "../../store";

export default function AmbientMusicRuntime() {
  const worldStarted = useSelector((state: RootState) => state.root.worldStarted);
  const [eras, setEras] = useState<WorldEraRecord[]>([]);
  const [preferences, setPreferences] = useState(readMusicPreferences);
  const [snapshot, setSnapshot] = useState<AmbientMusicSnapshot>();
  const manager = useMemo(() => new AmbientMusicManager(), []);
  const currentEra = eras.find((era) => era.endMonth === undefined);
  const mood = getMusicMoodForEra(currentEra?.type);

  useEffect(() => WorldEra.subscribe(setEras), []);
  useEffect(() => manager.subscribe(setSnapshot), [manager]);
  useEffect(() => subscribeMusicPreferences(setPreferences), []);
  useEffect(() => {
    const refresh = () => setPreferences(readMusicPreferences());
    window.addEventListener(MUSIC_PREFERENCES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(MUSIC_PREFERENCES_CHANGED_EVENT, refresh);
  }, []);
  useEffect(() => {
    manager.update({ active: worldStarted, mood, preferences });
  }, [manager, worldStarted, mood, preferences]);
  useEffect(() => {
    if (!worldStarted) return;
    const unlock = () => { void manager.unlockFromUserGesture(); };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [manager, worldStarted]);
  useEffect(() => () => manager.dispose(), [manager]);

  const debug = new URLSearchParams(window.location.search).get("debug") === "1";
  if (!debug || !worldStarted || !snapshot) return null;
  return (
    <Typography
      aria-label="Ambient music diagnostics"
      sx={{ position: "fixed", bottom: 4, left: 4, zIndex: 2000, px: 0.5, bgcolor: "rgba(0,0,0,.55)", color: "white", fontSize: 10 }}
    >
      Music: mood={snapshot.mood ?? "—"} track={snapshot.trackId ?? "—"} enabled={snapshot.enabled ? "yes" : "no"}
    </Typography>
  );
}
