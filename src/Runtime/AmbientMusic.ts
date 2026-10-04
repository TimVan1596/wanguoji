import type { WorldEraType } from "../Simulation/WorldEra";
import type { MusicPreferences } from "./MusicPreferences";

export type AmbientMusicMood = "TENSION" | "ORDER" | "PEACE";

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

export function resolveAmbientMusicAssetUrl(path: string, baseUrl: string): string {
  if (/^(?:https?:|data:|blob:)/i.test(path)) return path;
  return `${baseUrl}${path.replace(/^\/+/, "")}`;
}

export interface AmbientMusicTrack {
  id: string;
  src: string;
}

export type AmbientMusicTrackCatalog = Record<AmbientMusicMood, AmbientMusicTrack[]>;

// Tracks are added only after their exact files and licensing have been verified.
export const AMBIENT_MUSIC_TRACKS: AmbientMusicTrackCatalog = {
  TENSION: [],
  ORDER: [],
  PEACE: [],
};

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
  mood?: AmbientMusicMood;
  trackId?: string;
  volume: number;
}

export const AMBIENT_MUSIC_CROSSFADE_MS = 12_000;
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
  private mood?: AmbientMusicMood;
  private preferences: MusicPreferences;
  private rotationIndex: Record<AmbientMusicMood, number> = { TENSION: 0, ORDER: 0, PEACE: 0 };
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

  getSnapshot(): AmbientMusicSnapshot {
    return {
      active: this.active,
      enabled: this.preferences.enabled,
      mood: this.mood,
      trackId: this.desiredTrack?.id,
      volume: this.preferences.volume,
    };
  }

  update(options: { active: boolean; mood?: AmbientMusicMood; preferences: MusicPreferences }) {
    const wasEnabled = this.preferences.enabled;
    const previousVolume = this.preferences.volume;
    const moodChanged = options.mood !== this.mood;
    this.active = options.active;
    this.mood = options.mood;
    this.preferences = { enabled: options.preferences.enabled, volume: clampVolume(options.preferences.volume) };

    if (!this.active || !this.preferences.enabled) {
      if (wasEnabled && !this.preferences.enabled) this.fadeToSilence();
      else if (!this.active) this.fadeToSilence();
      this.publish();
      return;
    }

    if (this.activeIndex !== undefined && previousVolume !== this.preferences.volume && !moodChanged) {
      this.channels[this.activeIndex].audio.volume = this.preferences.volume / 100;
    }
    if (moodChanged || !wasEnabled || !this.desiredTrack) this.selectTrackForMood();
    if (this.unlocked) this.playDesiredTrack();
    this.publish();
  }

  /** Call directly from a user gesture; browser autoplay restrictions are respected. */
  async unlockFromUserGesture() {
    this.unlocked = true;
    if (this.active && this.preferences.enabled) await this.playDesiredTrack();
    this.publish();
  }

  dispose() {
    this.clearFadeTimer();
    this.channels.forEach(({ audio, endedListener }) => {
      audio.removeEventListener("ended", endedListener);
      audio.pause();
      audio.src = "";
    });
    this.listeners.clear();
    this.activeIndex = undefined;
    this.desiredTrack = undefined;
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

  private selectTrackForMood() {
    const pool = this.mood ? this.tracks[this.mood] : [];
    if (!pool?.length) {
      this.desiredTrack = undefined;
      return;
    }
    const cursor = this.rotationIndex[this.mood!] % pool.length;
    const activeTrack = this.activeIndex === undefined ? undefined : this.channels[this.activeIndex].track;
    const offset = pool.length > 1 && pool[cursor].id === activeTrack?.id ? 1 : 0;
    const selected = pool[(cursor + offset) % pool.length];
    this.rotationIndex[this.mood!] = (cursor + offset + 1) % pool.length;
    this.desiredTrack = selected;
  }

  private async playDesiredTrack() {
    if (!this.desiredTrack || !this.active || !this.preferences.enabled) return;
    if (this.activeIndex !== undefined && this.channels[this.activeIndex].track?.id === this.desiredTrack.id) return;
    const nextIndex = this.activeIndex === 0 ? 1 : 0;
    const next = this.channels[nextIndex];
    next.audio.pause();
    next.audio.currentTime = 0;
    next.audio.src = this.desiredTrack.src;
    next.audio.loop = (this.mood ? this.tracks[this.mood].length : 0) <= 1;
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
    this.crossfade(oldIndex, nextIndex);
    this.publish();
  }

  private crossfade(oldIndex: number | undefined, nextIndex: number) {
    this.clearFadeTimer();
    const start = this.now();
    const oldChannel = oldIndex === undefined ? undefined : this.channels[oldIndex].audio;
    const oldStartVolume = oldChannel?.volume ?? 0;
    const nextChannel = this.channels[nextIndex].audio;
    const tick = () => {
      const progress = Math.min(1, Math.max(0, (this.now() - start) / this.crossfadeMs));
      nextChannel.volume = (this.preferences.volume / 100) * progress;
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
    if (this.crossfadeMs <= 0) {
      nextChannel.volume = this.preferences.volume / 100;
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
    const pool = this.mood ? this.tracks[this.mood] : [];
    if (pool.length <= 1) return;
    this.selectTrackForMood();
    void this.playDesiredTrack();
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
