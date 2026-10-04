import type { WorldEraType } from "../Simulation/WorldEra";
import type { MusicPreferences } from "./MusicPreferences";

export type AmbientMusicMood = "TENSION" | "ORDER" | "PEACE";
export type AmbientMusicContext = "MENU" | AmbientMusicMood;

export const WORLD_ERA_MUSIC_MOOD: Record<WorldEraType, AmbientMusicMood> = {
  MULTIPOLAR: "TENSION",
  DUAL_RIVALRY: "TENSION",
  FRAGMENTATION: "TENSION",
  HEGEMONY: "ORDER",
  DYNASTIC: "ORDER",
  UNIFIED: "PEACE",
};

export function getMusicMoodForEra(type: WorldEraType | undefined): AmbientMusicMood | undefined {
  return type ? WORLD_ERA_MUSIC_MOOD[type] : undefined;
}

export function getAmbientMusicContext(worldStarted: boolean, eraType: WorldEraType | undefined): AmbientMusicContext | undefined {
  return worldStarted ? getMusicMoodForEra(eraType) : "MENU";
}

export function resolveAmbientMusicAssetUrl(path: string, baseUrl: string): string {
  if (/^(?:https?:|data:|blob:)/i.test(path)) return path;
  return `${baseUrl}${path.replace(/^\/+/, "")}`;
}

export interface AmbientMusicTrack {
  id: string;
  src: string;
  /** Static attenuation only; values above 1 are intentionally unsupported. */
  gain?: number;
}

export type AmbientMusicTrackCatalog = Record<AmbientMusicContext, AmbientMusicTrack[]>;

const bundledMusicAsset = (fileName: string) =>
  resolveAmbientMusicAssetUrl(`music/${fileName}`, import.meta.env.BASE_URL);

// Alpha soundtrack candidates supplied locally; attribution and source details live in ASSET_ATTRIBUTION.md.
export const AMBIENT_MUSIC_TRACKS: AmbientMusicTrackCatalog = {
  MENU: [],
  TENSION: [{ id: "ninja-theme", src: bundledMusicAsset("ninja theme.ogg") }],
  ORDER: [
    { id: "treasure-hunter", src: bundledMusicAsset("treasure_hunter.mp3") },
    { id: "asianoriental1", src: bundledMusicAsset("asianoriental1.ogg") },
  ],
  PEACE: [
    { id: "asianoriental2", src: bundledMusicAsset("asianoriental2.ogg") },
  ],
};

export function hasAmbientMusicTracks(
  context: AmbientMusicContext | undefined,
  catalog: AmbientMusicTrackCatalog = AMBIENT_MUSIC_TRACKS
): boolean {
  return context !== undefined && catalog[context].length > 0;
}

export interface MusicAudioChannel {
  src: string;
  currentTime: number;
  volume: number;
  loop: boolean;
  play(): Promise<void>;
  pause(): void;
  addEventListener(type: "ended", listener: () => void): void;
  removeEventListener(type: "ended", listener: () => void): void;
}

export interface AmbientMusicSnapshot {
  active: boolean;
  enabled: boolean;
  context?: AmbientMusicContext;
  mood?: AmbientMusicMood;
  trackId?: string;
  volume: number;
  trackGain: number;
}

export const AMBIENT_MUSIC_INITIAL_FADE_IN_MS = 2_000;
export const AMBIENT_MUSIC_PLAYLIST_FADE_IN_MS = 2_500;
export const AMBIENT_MUSIC_CONTEXT_CROSSFADE_MS = 12_000;
// Backward-compatible name for existing consumers/tests; Era transitions use this duration.
export const AMBIENT_MUSIC_CROSSFADE_MS = AMBIENT_MUSIC_CONTEXT_CROSSFADE_MS;
const FADE_TICK_MS = 100;

interface ChannelState {
  audio: MusicAudioChannel;
  endedListener: () => void;
  track?: AmbientMusicTrack;
}

export class AmbientMusicManager {
  private channels: [ChannelState, ChannelState];
  private activeIndex: number | undefined;
  private fadeTimer: ReturnType<typeof setInterval> | undefined;
  private desiredTrack?: AmbientMusicTrack;
  private unlocked = false;
  private active = false;
  private disposed = false;
  private context?: AmbientMusicContext;
  private preferences: MusicPreferences;
  private rotationIndex: Record<AmbientMusicContext, number> = { MENU: 0, TENSION: 0, ORDER: 0, PEACE: 0 };
  private listeners = new Set<(snapshot: AmbientMusicSnapshot) => void>();

  constructor(
    private readonly tracks: AmbientMusicTrackCatalog = AMBIENT_MUSIC_TRACKS,
    private readonly createAudio: () => MusicAudioChannel = () => new Audio(),
    private readonly now: () => number = () => Date.now(),
    private readonly startTimer: (callback: () => void) => ReturnType<typeof setInterval> = (callback) => setInterval(callback, FADE_TICK_MS),
    private readonly stopTimer: (timer: ReturnType<typeof setInterval>) => void = (timer) => clearInterval(timer),
    private readonly crossfadeMs = AMBIENT_MUSIC_CROSSFADE_MS,
    initialPreferences: MusicPreferences = { enabled: true, volume: 30 }
  ) {
    this.preferences = { enabled: initialPreferences.enabled, volume: clampVolume(initialPreferences.volume) };
    this.channels = [this.createChannel(), this.createChannel()];
  }

  subscribe(listener: (snapshot: AmbientMusicSnapshot) => void) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => { this.listeners.delete(listener); };
  }

  /** Recreate audio channels after React StrictMode's development effect remount. */
  activate() {
    if (!this.disposed) return;
    this.channels = [this.createChannel(), this.createChannel()];
    this.disposed = false;
    this.unlocked = false;
    this.active = false;
    this.context = undefined;
    this.activeIndex = undefined;
    this.desiredTrack = undefined;
  }

  getSnapshot(): AmbientMusicSnapshot {
    return {
      active: this.active,
      enabled: this.preferences.enabled,
      context: this.context,
      mood: this.context && this.context !== "MENU" ? this.context : undefined,
      trackId: this.desiredTrack?.id,
      volume: this.preferences.volume,
      trackGain: clampTrackGain(this.desiredTrack?.gain),
    };
  }

  update(options: { active: boolean; context?: AmbientMusicContext; preferences: MusicPreferences }) {
    const wasEnabled = this.preferences.enabled;
    const previousVolume = this.preferences.volume;
    const contextChanged = options.context !== this.context;
    this.active = options.active;
    this.context = options.context;
    this.preferences = { enabled: options.preferences.enabled, volume: clampVolume(options.preferences.volume) };

    if (contextChanged) this.selectTrackForContext();

    if (!this.active || !this.preferences.enabled) {
      if (wasEnabled && !this.preferences.enabled) this.fadeToSilence();
      else if (!this.active) this.fadeToSilence();
      this.publish();
      return;
    }

    if (this.activeIndex !== undefined && previousVolume !== this.preferences.volume && !contextChanged) {
      const activeTrack = this.channels[this.activeIndex].track;
      this.channels[this.activeIndex].audio.volume = calculateAmbientTrackVolume(
        this.preferences.volume,
        activeTrack?.gain,
        1
      );
    }
    if (!wasEnabled || !this.desiredTrack) this.selectTrackForContext();
    if (this.unlocked && (contextChanged || !wasEnabled || !this.desiredTrack)) {
      void this.playDesiredTrack(contextChanged ? this.crossfadeMs : undefined);
    }
    this.publish();
  }

  /** Call directly from a user gesture; browser autoplay restrictions are respected. */
  async unlockFromUserGesture() {
    this.unlocked = true;
    if (this.active && this.preferences.enabled) await this.playDesiredTrack();
    this.publish();
  }

  dispose() {
    if (this.disposed) return;
    this.clearFadeTimer();
    this.channels.forEach(({ audio, endedListener }) => {
      audio.removeEventListener("ended", endedListener);
      audio.pause();
      audio.src = "";
    });
    this.listeners.clear();
    this.activeIndex = undefined;
    this.desiredTrack = undefined;
    this.context = undefined;
    this.active = false;
    this.unlocked = false;
    this.disposed = true;
  }

  private createChannel(): ChannelState {
    const state: ChannelState = {
      audio: this.createAudio(),
      endedListener: () => undefined,
      track: undefined,
    };
    state.endedListener = () => this.handleEnded(state);
    state.audio.addEventListener("ended", state.endedListener);
    state.audio.volume = 0;
    return state;
  }

  private selectTrackForContext() {
    const pool = this.context ? this.tracks[this.context] : [];
    if (!pool?.length) {
      this.desiredTrack = undefined;
      return;
    }
    const cursor = this.rotationIndex[this.context!] % pool.length;
    const activeTrack = this.activeIndex === undefined ? undefined : this.channels[this.activeIndex].track;
    const offset = pool.length > 1 && pool[cursor].id === activeTrack?.id ? 1 : 0;
    const selected = pool[(cursor + offset) % pool.length];
    this.rotationIndex[this.context!] = (cursor + offset + 1) % pool.length;
    this.desiredTrack = selected;
  }

  private async playDesiredTrack(transitionMs?: number) {
    if (!this.desiredTrack || !this.active || !this.preferences.enabled) return;
    if (this.activeIndex !== undefined && this.channels[this.activeIndex].track?.id === this.desiredTrack.id) return;
    const nextIndex = this.activeIndex === 0 ? 1 : 0;
    const next = this.channels[nextIndex];
    next.audio.pause();
    next.audio.currentTime = 0;
    next.audio.src = this.desiredTrack.src;
    next.audio.loop = (this.context ? this.tracks[this.context].length : 0) <= 1;
    next.audio.volume = 0;
    next.track = this.desiredTrack;
    try {
      await next.audio.play();
    } catch {
      this.unlocked = false;
      return;
    }
    const oldIndex = this.activeIndex;
    this.activeIndex = nextIndex;
    const duration = transitionMs ?? (oldIndex === undefined
      ? AMBIENT_MUSIC_INITIAL_FADE_IN_MS
      : this.crossfadeMs);
    this.crossfade(oldIndex, nextIndex, duration);
    this.publish();
  }

  private crossfade(oldIndex: number | undefined, nextIndex: number, durationMs: number) {
    this.clearFadeTimer();
    const start = this.now();
    const oldChannel = oldIndex === undefined ? undefined : this.channels[oldIndex].audio;
    const oldStartVolume = oldChannel?.volume ?? 0;
    const nextChannel = this.channels[nextIndex].audio;
    const tick = () => {
      const progress = Math.min(1, Math.max(0, (this.now() - start) / durationMs));
      nextChannel.volume = calculateAmbientTrackVolume(this.preferences.volume, this.channels[nextIndex].track?.gain, progress);
      if (oldChannel) oldChannel.volume = Math.max(0, oldStartVolume * (1 - progress));
      if (progress >= 1) {
        this.clearFadeTimer();
        if (oldIndex !== undefined) {
          oldChannel!.pause();
          oldChannel!.currentTime = 0;
          this.channels[oldIndex].track = undefined;
        }
        this.publish();
      }
    };
    if (durationMs <= 0) {
      nextChannel.volume = calculateAmbientTrackVolume(this.preferences.volume, this.channels[nextIndex].track?.gain, 1);
      if (oldChannel) oldChannel.pause();
      return;
    }
    this.fadeTimer = this.startTimer(tick);
    tick();
  }

  private fadeToSilence() {
    if (this.activeIndex === undefined) return;
    const oldIndex = this.activeIndex;
    const old = this.channels[oldIndex].audio;
    const initialVolume = old.volume;
    const start = this.now();
    this.clearFadeTimer();
    const tick = () => {
      const progress = Math.min(1, Math.max(0, (this.now() - start) / this.crossfadeMs));
      old.volume = initialVolume * (1 - progress);
      if (progress >= 1) {
        this.clearFadeTimer();
        old.pause();
        old.currentTime = 0;
        this.channels[oldIndex].track = undefined;
        this.activeIndex = undefined;
        this.publish();
      }
    };
    if (this.crossfadeMs <= 0) {
      old.volume = 0;
      old.pause();
      this.channels[oldIndex].track = undefined;
      this.activeIndex = undefined;
      return;
    }
    this.fadeTimer = this.startTimer(tick);
    tick();
  }

  private handleEnded(channel: ChannelState) {
    if (channel !== (this.activeIndex === undefined ? undefined : this.channels[this.activeIndex])) return;
    const pool = this.context ? this.tracks[this.context] : [];
    if (pool.length <= 1) return;
    this.selectTrackForContext();
    void this.playDesiredTrack(AMBIENT_MUSIC_PLAYLIST_FADE_IN_MS);
  }

  private clearFadeTimer() {
    if (this.fadeTimer !== undefined) this.stopTimer(this.fadeTimer);
    this.fadeTimer = undefined;
  }

  private publish() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

function clampVolume(volume: number) {
  return Math.min(100, Math.max(0, Number.isFinite(volume) ? Math.round(volume) : 30));
}

export function clampTrackGain(gain: unknown): number {
  if (gain === undefined) return 1;
  return typeof gain === "number" && Number.isFinite(gain) ? Math.min(1, Math.max(0, gain)) : 1;
}

export function calculateAmbientTrackVolume(masterVolume: number, trackGain?: number, fadeProgress = 1): number {
  const master = Math.min(100, Math.max(0, Number.isFinite(masterVolume) ? masterVolume : 0)) / 100;
  const fade = Math.min(1, Math.max(0, Number.isFinite(fadeProgress) ? fadeProgress : 0));
  return Math.min(1, master * clampTrackGain(trackGain) * fade);
}
