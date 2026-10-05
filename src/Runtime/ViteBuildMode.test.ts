import { describe, expect, it } from "vitest";
import { getViteBase, isDesktopBuildMode } from "./ViteBuildMode";

describe("Vite renderer base by build mode", () => {
  it("keeps web asset URLs root-relative and desktop URLs file-relative", () => {
    expect(getViteBase("production")).toBe("/");
    expect(getViteBase("desktop")).toBe("./");
    expect(getViteBase("desktop-debug")).toBe("./");
    expect(isDesktopBuildMode("desktop-debug")).toBe(true);
    expect(isDesktopBuildMode("production")).toBe(false);
  });
});
