import { describe, expect, it } from "vitest";
import { getTextureProbeSource } from "./TextureProbe";

describe("noFace texture probe", () => {
  it("defaults to SVG and selects PNG only for the explicit debug query", () => {
    expect(getTextureProbeSource("")).toBe("SVG");
    expect(getTextureProbeSource("?textureProbe=png")).toBe("SVG");
    expect(getTextureProbeSource("?debug=1&textureProbe=png")).toBe("PNG");
    expect(getTextureProbeSource("?debug=1")).toBe("SVG");
  });
});
