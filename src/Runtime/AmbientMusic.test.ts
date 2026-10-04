import { describe, expect, it } from "vitest";
import { CURRENT_SAVE_SCHEMA_VERSION } from "../Persistence/WorldSaveSchema";
import { APP_VERSION } from "../config/version";
import { getSettingsVersionLabel } from "./SettingsVersion";
import {
  AmbientMusicManager,
  AmbientMusicTrackCatalog,
  getMusicMoodForEra,
  MusicAudioChannel,
  resolveAmbientMusicAssetUrl,
} from "./AmbientMusic";
import {
  clampMusicVolume,
  DEFAULT_MUSIC_PREFERENCES,
  MUSIC_PREFERENCES_STORAGE_KEY,
  parseMusicPreferences,
  readMusicPreferences,
  writeMusicPreferences,
} from "./MusicPreferences";

class FakeAudio implements MusicAudioChannel {
  src = "";
  currentTime = 0;
  volume = 0;
  loop = false;
  playCount = 0;
  pauseCount = 0;
  private ended = new Set<() => void>();
  async play() { this.playCount += 1; }
  pause() { this.pauseCount += 1; }
  addEventListener(_type: "ended", listener: () => void) { this.ended.add(listener); }
  removeEventListener(_type: "ended", listener: () => void) { this.ended.delete(listener); }
  finish() { this.ended.forEach((listener) => listener()); }
}

const catalog: AmbientMusicTrackCatalog = {
  TENSION: [{ id: "tension-1", src: "./music/tension.ogg" }],
  ORDER: [{ id: "order-1", src: "./music/order.ogg" }],
  PEACE: [{ id: "peace-1", src: "./music/peace.ogg" }],
};

describe("Ambient Music I", () => {
  it("maps each confirmed WorldEra type to one of three moods", () => {
    expect(getMusicMoodForEra("MULTIPOLAR")).toBe("TENSION");
    expect(getMusicMoodForEra("DUAL_RIVALRY")).toBe("TENSION");
    expect(getMusicMoodForEra("FRAGMENTATION")).toBe("TENSION");
    expect(getMusicMoodForEra("HEGEMONY")).toBe("ORDER");
    expect(getMusicMoodForEra("DYNASTIC")).toBe("ORDER");
    expect(getMusicMoodForEra("UNIFIED")).toBe("PEACE");
    expect(getMusicMoodForEra(undefined)).toBeUndefined();
  });

  it("does not select a new track for a same-mood Era change, but transitions from ORDER to PEACE", async () => {
    const channels: FakeAudio[] = [];
    const manager = new AmbientMusicManager(catalog, () => {
      const audio = new FakeAudio(); channels.push(audio); return audio;
    }, Date.now, () => 0 as unknown as ReturnType<typeof setInterval>, () => undefined, 0);
    manager.update({ active: true, mood: getMusicMoodForEra("HEGEMONY"), preferences: { enabled: true, volume: 30 } });
    expect(channels.reduce((sum, channel) => sum + channel.playCount, 0)).toBe(0);
    await manager.unlockFromUserGesture();
    expect(channels.reduce((sum, channel) => sum + channel.playCount, 0)).toBe(1);
    manager.update({ active: true, mood: getMusicMoodForEra("DYNASTIC"), preferences: { enabled: true, volume: 30 } });
    expect(channels.reduce((sum, channel) => sum + channel.playCount, 0)).toBe(1);
    manager.update({ active: true, mood: getMusicMoodForEra("UNIFIED"), preferences: { enabled: true, volume: 30 } });
    await Promise.resolve();
    expect(channels.reduce((sum, channel) => sum + channel.playCount, 0)).toBe(2);
    expect(manager.getSnapshot().trackId).toBe("peace-1");
    manager.dispose();
  });

  it("does not play while disabled and clamps runtime volume", async () => {
    const channels: FakeAudio[] = [];
    const manager = new AmbientMusicManager(catalog, () => {
      const audio = new FakeAudio(); channels.push(audio); return audio;
    }, Date.now, () => 0 as unknown as ReturnType<typeof setInterval>, () => undefined, 0);
    manager.update({ active: true, mood: "ORDER", preferences: { enabled: false, volume: 140 } });
    await manager.unlockFromUserGesture();
    expect(channels.reduce((sum, channel) => sum + channel.playCount, 0)).toBe(0);
    expect(manager.getSnapshot().volume).toBe(100);
    expect(clampMusicVolume(-10)).toBe(0);
    expect(clampMusicVolume(25.4)).toBe(25);
    expect(clampMusicVolume(110)).toBe(100);
    manager.dispose();
  });

  it("crossfades channels and rotates a completed playlist without reusing world RNG", async () => {
    const channels: FakeAudio[] = [];
    let now = 0;
    let nextTimerId = 1;
    const timers = new Map<number, () => void>();
    const manager = new AmbientMusicManager({
      ...catalog,
      TENSION: [
        { id: "tension-1", src: "./music/tension-1.ogg" },
        { id: "tension-2", src: "./music/tension-2.ogg" },
      ],
    }, () => {
      const audio = new FakeAudio(); channels.push(audio); return audio;
    }, () => now, (callback) => {
      const id = nextTimerId++;
      timers.set(id, callback);
      return id as unknown as ReturnType<typeof setInterval>;
    }, (id) => { timers.delete(id as unknown as number); }, 1000);
    manager.update({ active: true, mood: "ORDER", preferences: { enabled: true, volume: 30 } });
    await manager.unlockFromUserGesture();
    now = 1000;
    [...timers.values()].forEach((tick) => tick());
    manager.update({ active: true, mood: "PEACE", preferences: { enabled: true, volume: 30 } });
    await Promise.resolve();
    now = 1500;
    [...timers.values()].forEach((tick) => tick());
    expect(channels[0].volume).toBeCloseTo(0.15);
    expect(channels[1].volume).toBeCloseTo(0.15);
    now = 2000;
    [...timers.values()].forEach((tick) => tick());
    expect(channels[0].pauseCount).toBeGreaterThan(0);
    expect(channels[1].volume).toBeCloseTo(0.3);
    manager.dispose();

    const playlistChannels: FakeAudio[] = [];
    const playlist = new AmbientMusicManager({
      ...catalog,
      TENSION: [
        { id: "tension-1", src: "./music/tension-1.ogg" },
        { id: "tension-2", src: "./music/tension-2.ogg" },
      ],
    }, () => { const audio = new FakeAudio(); playlistChannels.push(audio); return audio; }, Date.now,
    () => 1 as unknown as ReturnType<typeof setInterval>, () => undefined, 0);
    playlist.update({ active: true, mood: "TENSION", preferences: { enabled: true, volume: 30 } });
    await playlist.unlockFromUserGesture();
    playlistChannels[0].finish();
    await Promise.resolve();
    expect(playlist.getSnapshot().trackId).toBe("tension-2");
    expect(playlistChannels.reduce((sum, channel) => sum + channel.playCount, 0)).toBe(2);
    playlist.dispose();
  });

  it("uses default preferences for missing or invalid storage and round-trips valid preferences", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
    };
    expect(readMusicPreferences(storage)).toEqual(DEFAULT_MUSIC_PREFERENCES);
    const saved = writeMusicPreferences({ enabled: false, volume: 55 }, storage);
    expect(saved).toEqual({ enabled: false, volume: 55 });
    expect(values.has(MUSIC_PREFERENCES_STORAGE_KEY)).toBe(true);
    expect(readMusicPreferences(storage)).toEqual(saved);
    values.set(MUSIC_PREFERENCES_STORAGE_KEY, "not-json");
    expect(readMusicPreferences(storage)).toEqual(DEFAULT_MUSIC_PREFERENCES);
    expect(parseMusicPreferences({ enabled: "yes", volume: 999 })).toEqual({ enabled: true, volume: 100 });
  });

  it("shows the imported runtime version and keeps music preferences outside WorldSave", () => {
    expect(getSettingsVersionLabel()).toBe(`当前版本：${APP_VERSION}`);
    expect(CURRENT_SAVE_SCHEMA_VERSION).toBe(1);
  });

  it("resolves bundled music under the current Web/Desktop asset base", () => {
    expect(resolveAmbientMusicAssetUrl("music/track.ogg", "/")).toBe("/music/track.ogg");
    expect(resolveAmbientMusicAssetUrl("music/track.ogg", "./")).toBe("./music/track.ogg");
    expect(resolveAmbientMusicAssetUrl("https://example.com/track.ogg", "./")).toBe("https://example.com/track.ogg");
  });
});
