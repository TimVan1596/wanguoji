import { describe, expect, it } from "vitest";
import { resolvePublicAssetUrl } from "./PublicAssetUrl";

describe("public asset URL resolution", () => {
  it("uses the selected build base for local public assets", () => {
    expect(resolvePublicAssetUrl("/img/no-face.svg", "/")).toBe("/img/no-face.svg");
    expect(resolvePublicAssetUrl("img/no-face.svg", "./")).toBe("./img/no-face.svg");
  });

  it("leaves remote and non-http resources untouched", () => {
    for (const url of ["https://example.test/face.png", "data:image/png;base64,AA==", "blob:https://example.test/id", "//cdn.example.test/a.png"]) {
      expect(resolvePublicAssetUrl(url, "./")).toBe(url);
    }
  });
});
