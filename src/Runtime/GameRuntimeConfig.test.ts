import { describe, expect, it } from "vitest";
import { PHASER_AUDIO_CONFIG } from "./GameRuntimeConfig";

describe("Phaser runtime config", () => {
  it("disables unused audio subsystem for both web and desktop game instances", () => {
    expect(PHASER_AUDIO_CONFIG).toEqual({ noAudio: true });
  });
});
