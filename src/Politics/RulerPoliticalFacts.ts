import type { RulerPoliticalFact } from "./RulerHistoriography";

/** One result per canonical group, city and participant perspective. Never mutate history. */
export function normalizeRulerPoliticalFacts(facts: readonly RulerPoliticalFact[]) {
  const rows = new Map<string, RulerPoliticalFact>();
  for (const fact of facts) {
    const capture = ["city-captured", "capital-fallen"].includes(fact.type);
    const key = `${capture ? "CAPTURE" : fact.terminalOutcome && fact.militaryRole === "ATTACKER" ? "TERMINAL" : fact.type}:${fact.historyGroupId ?? fact.eventId}:${capture ? fact.cityId ?? fact.cityName ?? fact.eventId : fact.affectedFactionId ?? ""}:${fact.militaryRole ?? ""}`;
    const previous = rows.get(key);
    if (!previous) rows.set(key, { ...fact });
    else {
      const preferred = fact.terminalOutcome === "EXTINCT" || (previous.terminalOutcome === "EXILED" && fact.terminalOutcome === "DISSOLVED") ? fact : previous;
      const direct = previous.role === "DIRECT_ACTOR" ? previous : fact.role === "DIRECT_ACTOR" ? fact : undefined;
      rows.set(key, { ...preferred, wasCapital: previous.wasCapital || fact.wasCapital,
        role: direct ? "DIRECT_ACTOR" : preferred.role,
        confidence: direct ? "DIRECT" : preferred.confidence,
        rulerId: direct?.rulerId ?? preferred.rulerId });
    }
  }
  return [...rows.values()];
}

export function summarizeRulerPoliticalFacts(facts: readonly RulerPoliticalFact[]) {
  const rows = normalizeRulerPoliticalFacts(facts);
  const count = (test: (fact: RulerPoliticalFact) => boolean) => rows.filter(test).length;
  const capture = (f: RulerPoliticalFact) => ["city-captured", "capital-fallen"].includes(f.type) && f.militaryRole === "ATTACKER";
  const own = (f: RulerPoliticalFact) => f.militaryRole !== "ATTACKER";
  return {
    nationalCityCaptures: count(f => capture(f) && !f.wasCapital),
    nationalCapitalCaptures: count(f => capture(f) && !!f.wasCapital),
    personalCityCaptures: count(f => capture(f) && f.role === "DIRECT_ACTOR"),
    personalCapitalCaptures: count(f => capture(f) && !!f.wasCapital && f.role === "DIRECT_ACTOR"),
    nationalExtinctions: count(f => f.terminalOutcome === "EXTINCT" && !own(f)),
    personalExtinctions: count(f => f.terminalOutcome === "EXTINCT" && !own(f) && f.role === "DIRECT_ACTOR"),
    stateLosses: count(f => f.type === "faction-exiled" && own(f)),
    restorations: count(f => f.type === "faction-restored"),
    forcedRelocations: count(f => f.type === "capital-relocated"),
    capitalLosses: count(f => ["capital-fallen", "city-captured"].includes(f.type) && !!f.wasCapital && own(f)),
    crisisEpisodes: new Set(rows.filter(f => own(f) && (["capital-fallen", "capital-relocated", "empire-split", "faction-exiled", "faction-extinct"].includes(f.type) || f.type === "city-captured" && f.wasCapital)).map(f => f.historyGroupId ?? f.eventId)).size,
    personalSignatures: count(f => f.role === "DIRECT_ACTOR" && ["truce-signed", "non-aggression-signed", "alliance-signed"].includes(f.type)),
    nationalDiplomacy: count(f => f.role === "IN_TENURE" && ["truce-signed", "non-aggression-signed", "alliance-signed"].includes(f.type)),
    renewals: count(f => f.type === "relation-renewed"),
  };
}
