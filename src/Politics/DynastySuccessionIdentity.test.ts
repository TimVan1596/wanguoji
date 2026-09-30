import { describe, expect, it } from "vitest";
import { getUnrelatedSuccessorRelation } from "./DynastySuccessionIdentity";

describe("unrelated successor political relationship", () => {
  it("keeps provisional leader turnover distinct from a formal-state new house", () => {
    expect(getUnrelatedSuccessorRelation("PROVISIONAL")).toBe("LEADER_SUCCESSOR");
    expect(getUnrelatedSuccessorRelation("STATE")).toBe("NEW_HOUSE");
  });
});
