export interface MusicPreferences {
  enabled: boolean;
  volume: number;
}

export const MUSIC_PREFERENCES_STORAGE_KEY = "wanguoji.music.preferences.v1";
export const DEFAULT_MUSIC_PREFERENCES: Readonly<MusicPreferences> = {
  enabled: true,
  volume: 30,
};

const listeners = new Set<(preferences: MusicPreferences) => void>();

function getStorage(): Pick<Storage, "getItem" | "setItem"> | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function clampMusicVolume(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_MUSIC_PREFERENCES.volume;
  return Math.round(Math.min(100, Math.max(0, numeric)));
}

export function parseMusicPreferences(value: unknown): MusicPreferences {
  if (!value || typeof value !== "object") return { ...DEFAULT_MUSIC_PREFERENCES };
  const candidate = value as Partial<MusicPreferences>;
  return {
    enabled: typeof candidate.enabled === "boolean" ? candidate.enabled : DEFAULT_MUSIC_PREFERENCES.enabled,
    volume: clampMusicVolume(candidate.volume),
  };
}

export function readMusicPreferences(
  storage = getStorage()
): MusicPreferences {
  try {
    const raw = storage?.getItem(MUSIC_PREFERENCES_STORAGE_KEY);
    return raw ? parseMusicPreferences(JSON.parse(raw)) : { ...DEFAULT_MUSIC_PREFERENCES };
  } catch {
    return { ...DEFAULT_MUSIC_PREFERENCES };
  }
}

export function writeMusicPreferences(
  value: Partial<MusicPreferences>,
  storage = getStorage()
): MusicPreferences {
  const preferences = parseMusicPreferences({ ...readMusicPreferences(storage), ...value });
  try {
    storage?.setItem(MUSIC_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // A local preference failure must never affect world state.
  }
  listeners.forEach((listener) => listener({ ...preferences }));
  return preferences;
}

export function subscribeMusicPreferences(listener: (preferences: MusicPreferences) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
