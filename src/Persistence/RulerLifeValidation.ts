import { RULER_DEATH_REASONS, RULER_STATUSES } from "../Politics/RulerLifeState";

/** V13 persisted person facts; never infer death from the scheduled lifespan. */
export function validateRulerLifeRecord(r: Record<string, any>, worldMonth: number): string[] {
  const errors: string[] = [];
  const bad = (message: string) => errors.push(`ruler ${String(r.rulerId)}: ${message}`);
  const pastMonth = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= worldMonth;
  if (!RULER_STATUSES.includes(r.status)) bad("invalid status");
  if (!Number.isSafeInteger(r.bornMonth) || r.bornMonth > worldMonth) bad("invalid bornMonth");
  for (const key of ["accessionMonth", "endMonth", "politicalStartMonth", "politicalEndMonth", "deathMonth"]) {
    if (r[key] !== undefined && !pastMonth(r[key])) bad(`invalid ${key}`);
  }
  if (r.accessionMonth !== undefined && r.accessionMonth < r.bornMonth) bad("accession precedes birth");
  if (r.politicalStartMonth !== undefined && r.politicalEndMonth !== undefined && r.politicalEndMonth < r.politicalStartMonth) bad("political end precedes political start");
  if (r.accessionMonth !== undefined && r.endMonth !== undefined && r.endMonth < r.accessionMonth) bad("end precedes accession");
  if (r.accessionMonth !== undefined && r.politicalEndMonth !== undefined && r.politicalEndMonth < r.accessionMonth) bad("political end precedes accession");
  if (r.accessionMonth !== undefined && r.endMonth !== undefined && r.politicalEndMonth !== r.endMonth) bad("political end must match reign end");
  const hasDeath = r.deathMonth !== undefined || r.deathReason !== undefined;
  if (hasDeath && (!pastMonth(r.deathMonth) || !RULER_DEATH_REASONS.includes(r.deathReason) || r.deathMonth < r.bornMonth)) bad("invalid actual death record");
  if (r.status === "dead" && !hasDeath) bad("dead requires an actual death record");
  if (hasDeath && r.status !== "dead") bad("actual death requires dead status");
  if (hasDeath && r.endMonth !== undefined && r.deathMonth < r.endMonth) bad("death precedes recorded end");
  if (["ruling", "exiled", "heir", "kin"].includes(r.status) && r.endMonth !== undefined) bad("active person has an ended record");
  if (["dead", "abdicated", "politically-ended"].includes(r.status) && r.endMonth === undefined) bad("ended person requires endMonth");
  if (["ruling", "exiled", "abdicated", "politically-ended"].includes(r.status) && r.accessionMonth === undefined) bad("political office requires accessionMonth");
  if (r.status === "abdicated" && !["合邦退位", "纳土退位"].includes(r.endReason)) bad("invalid abdication reason");
  if (r.status === "politically-ended" && r.endReason !== "政治终结") bad("invalid political termination reason");
  if (!hasDeath && (r.templeName || r.posthumousEpithet)) bad("posthumous title requires actual death");
  if (r.reignOrdinal !== undefined && (!Number.isSafeInteger(r.reignOrdinal) || r.reignOrdinal < 1)) bad("invalid reign ordinal");
  if (r.chronicle !== undefined && (!r.chronicle || typeof r.chronicle !== "object" || Array.isArray(r.chronicle))) bad("invalid chronicle");
  if (r.chronicle && typeof r.chronicle === "object" && !Array.isArray(r.chronicle)) {
    if (r.chronicle.accessionSnapshot?.month !== r.accessionMonth) bad("accession snapshot must match accession");
    for (const key of ["accessionSnapshot", "latestSnapshot", "endSnapshot"]) {
      const snapshot = r.chronicle[key];
      if (snapshot === undefined && key !== "accessionSnapshot") continue;
      if (!snapshot || !pastMonth(snapshot.month) || snapshot.month < r.accessionMonth ||
        (r.endMonth !== undefined && snapshot.month > r.endMonth) ||
        !Number.isSafeInteger(snapshot.population) || snapshot.population < 0 ||
        !Number.isSafeInteger(snapshot.cityCount) || snapshot.cityCount < 0 ||
        !Number.isFinite(snapshot.territoryShare) || snapshot.territoryShare < 0 || snapshot.territoryShare > 1 ||
        !Number.isFinite(snapshot.stability) || snapshot.stability < 0 || snapshot.stability > 100) bad(`invalid ${key}`);
    }
    if (r.endMonth === undefined && r.chronicle.endSnapshot !== undefined) bad("unended office has end snapshot");
    if (!Array.isArray(r.chronicle.notableEventIds) || r.chronicle.notableEventIds.some((id: unknown) => typeof id !== "string")) bad("invalid notable event ids");
    if (r.reignOrdinal === undefined || r.accessionMonth === undefined) bad("chronicle requires recorded accession and ordinal");
    if (r.endMonth !== undefined && r.chronicle.endSnapshot?.month !== r.endMonth) bad("end snapshot must match reign end");
    if (r.chronicle.deathCause !== undefined && (!hasDeath || r.chronicle.deathCause !== r.deathReason)) bad("chronicle death cause disagrees with actual death");
  }
  if (r.reignOrdinal !== undefined && (!r.chronicle || r.accessionMonth === undefined)) bad("ordinal ruler requires chronicle");
  return errors;
}
