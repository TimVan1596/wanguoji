import type { Dynasty, Ruler } from "./Dynasty";
import { MAX_DYNASTIC_SUCCESSION_CANDIDATES } from "./DynasticCandidateRules";

export type FactionStatusLookup = (factionId: string) => string | undefined;

export function validateDynastyInvariants(
  dynasties: Dynasty[],
  getFactionStatus: FactionStatusLookup
) {
  const issues: string[] = [];
  dynasties.forEach((dynasty) => {
    if (getFactionStatus(dynasty.factionId) === "EXTINCT" && dynasty.currentRulerId) {
      issues.push(`EXTINCT faction has current ruler: ${dynasty.factionId}`);
    }
    if (dynasty.heirIds.length > MAX_DYNASTIC_SUCCESSION_CANDIDATES) {
      issues.push(`dynastic candidate cap exceeded: ${dynasty.factionId}`);
    }
    if (new Set(dynasty.heirIds).size !== dynasty.heirIds.length) {
      issues.push(`duplicate dynastic candidate id: ${dynasty.factionId}`);
    }
    if (dynasty.designatedHeirId !== undefined) {
      if (!dynasty.heirIds.includes(dynasty.designatedHeirId)) {
        issues.push(`designated heir is not a candidate: ${dynasty.factionId}/${dynasty.designatedHeirId}`);
      }
      if (dynasty.designatedSinceMonth === undefined || !Number.isFinite(dynasty.designatedSinceMonth) || dynasty.designatedSinceMonth < 0) {
        issues.push(`designated heir has invalid appointment month: ${dynasty.factionId}`);
      }
    } else if (dynasty.designatedSinceMonth !== undefined) {
      issues.push(`designated appointment month without heir: ${dynasty.factionId}`);
    }
    dynasty.heirIds.forEach((id) => {
      const candidate = dynasty.rulers.find((ruler) => ruler.id === id);
      if (!candidate || candidate.status !== "heir") {
        issues.push(`invalid dynastic candidate: ${dynasty.factionId}/${id}`);
      }
    });
    dynasty.rulers.forEach((ruler) => {
      issues.push(...validateRulerInvariant(dynasty.factionId, ruler));
    });
  });
  return issues;
}

export function validateRulerInvariant(factionId: string, ruler: Ruler) {
  const issues: string[] = [];
  const formallyEnthroned =
    ruler.reignOrdinal !== undefined ||
    ruler.accessionYear !== undefined ||
    ruler.chronicle !== undefined;

  if (ruler.status === "heir" && formallyEnthroned) {
    issues.push(`heir has ruler reign data: ${factionId}/${ruler.id}`);
  }
  if (ruler.reignOrdinal !== undefined && (ruler.accessionYear === undefined || !ruler.chronicle)) {
    issues.push(`ordinal ruler missing reign data: ${factionId}/${ruler.id}`);
  }
  if (ruler.chronicle && ruler.reignOrdinal === undefined) {
    issues.push(`non-ordinal ruler has chronicle: ${factionId}/${ruler.id}`);
  }
  if (
    ruler.endYear !== undefined &&
    ruler.accessionYear !== undefined &&
    ruler.endYear < ruler.accessionYear
  ) {
    issues.push(`ruler reign end before start: ${factionId}/${ruler.id}`);
  }
  return issues;
}
