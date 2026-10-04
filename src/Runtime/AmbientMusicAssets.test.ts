import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AMBIENT_MUSIC_TRACKS } from "./AmbientMusic";

describe("Ambient Music bundled asset manifest", () => {
  const tracks = Object.values(AMBIENT_MUSIC_TRACKS).flat();

  it("has at least one available track for each mood", () => {
    for (const mood of ["TENSION", "ORDER", "PEACE"] as const) {
      expect(AMBIENT_MUSIC_TRACKS[mood].length, mood).toBeGreaterThan(0);
    }
  });

  it("allows the intentionally silent MENU scene", () => {
    expect(AMBIENT_MUSIC_TRACKS.MENU).toEqual([]);
  });

  it("uses unique track IDs", () => {
    const ids = tracks.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses local public paths and references only files present in public/music", () => {
    for (const track of tracks) {
      expect(track.src).toMatch(/^(?:\.\/|\/)music\/[\w .-]+\.(?:mp3|ogg)$/i);
      const relativeAssetPath = track.src.replace(/^(?:\.\/|\/)/, "");
      expect(existsSync(resolve(process.cwd(), "public", relativeAssetPath)), track.src).toBe(true);
    }
  });

  it("keeps rejected and reserve candidates out of the public bundle source", () => {
    expect(readdirSync(resolve(process.cwd(), "public/music")).sort()).toEqual([
      "asianoriental1.ogg",
      "asianoriental2.ogg",
      "ninja theme.ogg",
      "treasure_hunter.mp3",
    ]);
    expect(existsSync(resolve(process.cwd(), "dev-assets/music-candidates/nightshift.mp3"))).toBe(true);
  });
});
