import type { FactionIdentityStage } from "../Simulation/FactionIdentity";

export function getUnrelatedSuccessorRelation(identityStage: FactionIdentityStage) {
  return identityStage === "PROVISIONAL" ? "LEADER_SUCCESSOR" as const : "NEW_HOUSE" as const;
}
