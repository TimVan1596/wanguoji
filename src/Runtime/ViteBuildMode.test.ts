import { describe, expect, it } from "vitest";
import { getViteBase } from "./ViteBuildMode";

describe("Vite renderer base by build mode", () => {
  it("keeps web asset URLs root-relative and desktop URLs file-relative", () => {
    expect(getViteBase("production")).toBe("/");
    expect(getViteBase("desktop")).toBe("./");
  });
});
