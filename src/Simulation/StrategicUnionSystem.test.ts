import { describe, expect, it } from "vitest";
import { diagnoseStrategicUnionCandidates, findStrategicUnionCandidate } from "./StrategicUnionSystem";
import type Team from "../Components/Team";

function team(name: string, count: number, startX: number, parentFactionId: string, cities: number): Team {
  const entries = Array.from({ length: count }, (_, index) => ({
    x: (name === "threat" && index < 2 ? index === 0 ? -1 : 2 : index === 0 ? startX : 100 + index * 7) * 32,
    y: 0,
  }));
  return {
    name, status: "ACTIVE", isDie: false,
    origin: { type: "SPLIT", parentFactionId },
    blocks: { children: { entries, size: entries.length } },
    cities: Array.from({ length: cities }, () => ({ loyalty: 70 })),
  } as unknown as Team;
}

describe("strategic union candidate selection", () => {
  const alliance = {
    factionAId: "strong", factionBId: "weak", status: "ALLIANCE" as const,
    startedMonth: 0, expiresMonth: 120, reason: "COMMON_THREAT_ALLIANCE" as const,
    commonThreatFactionId: "threat",
  };
  const threat = team("threat", 70, 100, "elsewhere", 4);
  const strong = team("strong", 15, 0, "same-house", 3);
  const weak = team("weak", 5, 1, "same-house", 1);
  const input = {
    teams: [strong, weak, threat], relations: [alliance], totalCells: 90, worldMonth: 72,
    recentEvents: [] as never[], blockSize: 32,
  };

  it("selects a weaker adjacent same-origin ally only after a long peaceful alliance and continuing pressure", () => {
    expect(findStrategicUnionCandidate(input)).toMatchObject({
      absorbingFaction: strong, absorbedFaction: weak,
      commonThreatFactionId: "threat", bilateralWarFreeMonths: 60,
    });
  });

  it("rejects nonadjacent allies, unrelated origins, and parity", () => {
    expect(findStrategicUnionCandidate({ ...input, teams: [strong, team("weak", 5, 40, "same-house", 1), threat] })).toBeUndefined();
    expect(findStrategicUnionCandidate({ ...input, teams: [strong, team("weak", 5, 20, "different-house", 1), threat] })).toBeUndefined();
    expect(findStrategicUnionCandidate({ ...input, teams: [team("strong", 10, 0, "same-house", 2), team("weak", 10, 1, "same-house", 2), threat] })).toBeUndefined();
    expect(findStrategicUnionCandidate({ ...input, relations: [{ ...alliance, startedMonth: 13 }] })).toBeUndefined();
  });

  it("reports explicit blockers without changing eligible candidate selection", () => {
    const diagnostics = diagnoseStrategicUnionCandidates(input);
    expect(diagnostics[0]).toMatchObject({
      factionAId: "strong", factionBId: "weak", sameOrigin: true,
      adjacent: true, commonThreatStillRelevant: true, blockers: [],
    });
    expect(diagnostics[0].candidate).toEqual(findStrategicUnionCandidate(input));
    const blocked = diagnoseStrategicUnionCandidates({
      ...input,
      teams: [strong, team("weak", 5, 40, "same-house", 1), threat],
    });
    expect(blocked[0].blockers).toContain("NOT_ADJACENT");
  });
});
