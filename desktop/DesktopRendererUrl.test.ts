import { describe, expect, it } from "vitest";
import { getDesktopRendererUrl } from "./DesktopRendererUrl";

describe("desktop renderer launch URL", () => {
  it("leaves normal desktop URLs free of diagnostics parameters", () => {
    expect(getDesktopRendererUrl("file:///app/dist/index.html")).toBe("file:///app/dist/index.html#/");
    expect(getDesktopRendererUrl("http://localhost:5173/")).toBe("http://localhost:5173/");
  });

  it("adds debug query before the production hash route", () => {
    expect(getDesktopRendererUrl("file:///app/dist/index.html", { debug: true }))
      .toBe("file:///app/dist/index.html?debug=1#/");
    expect(getDesktopRendererUrl("file:///app/dist/index.html", { debug: true, avatarRenderer: "plain" }))
      .toBe("file:///app/dist/index.html?debug=1&avatarRenderer=plain#/");
  });

  it("adds debug query to the Vite development URL", () => {
    expect(getDesktopRendererUrl("http://localhost:5173/", { debug: true }))
      .toBe("http://localhost:5173/?debug=1");
  });
});
