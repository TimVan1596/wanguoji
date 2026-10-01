import { describe, expect, it } from "vitest";
import { getAvatarRendererMode } from "./AvatarRendererMode";

describe("avatar renderer diagnostic mode", () => {
  it("defaults to the existing circle-mask renderer", () => {
    expect(getAvatarRendererMode("")).toBe("circle-mask");
    expect(getAvatarRendererMode("?avatarRenderer=plain")).toBe("circle-mask");
  });

  it("uses plain images only when explicitly requested with debug=1", () => {
    expect(getAvatarRendererMode("?debug=1&avatarRenderer=plain")).toBe("plain");
    expect(getAvatarRendererMode("?debug=1&avatarRenderer=circle-mask")).toBe("circle-mask");
  });
});
