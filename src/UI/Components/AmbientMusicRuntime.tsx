import { Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import WorldEra, { WorldEra as WorldEraRecord } from "../../Simulation/WorldEra";
import {
  AmbientMusicManager,
  AmbientMusicSnapshot,
  getAmbientMusicContext,
} from "../../Runtime/AmbientMusic";
import {
  readMusicPreferences,
  subscribeMusicPreferences,
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
  const context = getAmbientMusicContext(worldStarted, currentEra?.type);

  useEffect(() => {
    manager.activate();
    return () => manager.dispose();
  }, [manager]);
  useEffect(() => WorldEra.subscribe(setEras), []);
  useEffect(() => manager.subscribe(setSnapshot), [manager]);
  useEffect(() => subscribeMusicPreferences(setPreferences), []);
  useEffect(() => {
    manager.update({ active: true, context, preferences });
  }, [manager, context, preferences]);
  useEffect(() => {
    const unlock = () => { void manager.unlockFromUserGesture(); };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [manager]);
  const debug = new URLSearchParams(window.location.search).get("debug") === "1";
  if (!debug || !snapshot) return null;
  const scene = snapshot.context === "MENU" ? "MENU" : snapshot.context ? "WORLD" : "WORLD_PENDING_ERA";
  return (
    <Typography
      aria-label="Ambient music diagnostics"
      sx={{ position: "fixed", bottom: 4, left: 4, zIndex: 2000, px: 0.5, bgcolor: "rgba(0,0,0,.55)", color: "white", fontSize: 10 }}
    >
      Music: scene={scene} context={snapshot.context ?? "—"} mood={snapshot.mood ?? "—"} track={snapshot.trackId ?? "—"} master={snapshot.volume} gain={snapshot.trackGain.toFixed(2)} enabled={snapshot.enabled ? "yes" : "no"}
    </Typography>
  );
}
