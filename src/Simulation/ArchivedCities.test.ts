import { describe, expect, it } from "vitest";
import ArchivedCities from "./ArchivedCities";

describe("archived cities", () => {
  it("preserves destroyed cities in archive", () => {
    ArchivedCities.reset();
    const archived = ArchivedCities.archive(
      {
        id: "city-xinzheng",
        name: "新郑",
        founderFactionId: "韩",
        ownerFactionId: "秦",
        foundedYear: 0,
        captureCount: 3,
        history: [
          {
            year: 0,
            type: "founded",
            title: "韩建立新郑",
            newOwnerFactionId: "韩",
          },
        ],
      } as any,
      1200
    );
    expect(archived.name).toBe("新郑");
    expect(ArchivedCities.get("city-xinzheng")?.lastOwnerFactionId).toBe("秦");
  });
});
