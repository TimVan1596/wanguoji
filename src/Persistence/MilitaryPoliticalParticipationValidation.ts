import type { WorldSaveV1 } from "./WorldSaveSchema";
import type { WorldEvent } from "../History/WorldHistory";
import { deriveMilitaryCareer } from "../Politics/MilitaryCareerEvidence";
import { deriveMilitaryLifeSchedule } from "../Politics/MilitaryLifeRules";
import { militaryPoliticalStrength, readMilitaryParticipation } from "../Politics/MilitaryPoliticalInfluence";
import { getRecentDepositionEvidence } from "../Politics/InReignDeposition";
import { derivePoliticalSuccessionShocks } from "../Politics/PoliticalSuccessionCrisis";
import { getDynasticRevolutionChance, getRevolutionEligibility } from "../Politics/DynasticRevolution";
import { importRulerSave } from "./RulerSaveProjection";

/** Called after ordinary V15 validation. Historical bindings are checked at event month,
 * not against today's roster: real participants may subsequently retire, transfer or die. */
export function validateMilitaryPoliticalParticipation(save: WorldSaveV1): string[] {
  const errors: string[] = [], state = save.registries.militaryCommandRegistry;
  // WorldHistory DTO intentionally stores monthIndex, not the legacy runtime year alias.
  const events = (save.worldHistory.events as WorldEvent[]).map(e => ({ ...e, year: e.monthIndex ?? e.year }));
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-12;
  for (const [index, event] of events.entries()) {
    if (event.metadata?.militaryParticipation === undefined) continue;
    const fail = () => { errors.push(`invalid military political participation: ${event.id}`); };
    try {
      const record = readMilitaryParticipation(event);
      if (!record) { fail(); continue; }
      const s = record.participant, at = record.worldMonth, political = record.politicalContext;
      const person = state.people.find(p => p.personId === s.personId), formation = state.formations.find(f => f.commandId === s.commandId);
      const appointment = person?.appointments.find(a => a.commandId === s.commandId && a.factionId === record.factionId && a.startMonth <= at && (a.endMonth === undefined || a.endMonth >= at));
      if (!person || !formation || !appointment || formation.commanderPersonId !== person.personId || formation.factionId !== record.factionId ||
          person.sourceUserId !== s.sourceUserId || person.name !== s.name || person.bornMonth !== s.bornMonth || s.factionId !== record.factionId ||
          person.deathMonth !== undefined && person.deathMonth <= at || at >= deriveMilitaryLifeSchedule(person).retirementMonth ||
          !Number.isSafeInteger(s.unitCount) || s.unitCount < 2 || s.unitCount > 12 || s.memberUnitIds.length !== s.unitCount ||
          new Set(s.memberUnitIds).size !== s.unitCount || !s.memberUnitIds.every(id => typeof id === "string" && id.length > 0) || !s.memberUnitIds.includes(s.commanderUnitId) ||
          !political || !Number.isFinite(political.stability) || political.stability < 0 || political.stability > 100 || !Number.isSafeInteger(political.cityCount) || political.cityCount < 1 ||
          !Array.isArray(s.capturedEventIds) || record.crisisEventIds.some(id => typeof id !== "string") || new Set(record.crisisEventIds).size !== record.crisisEventIds.length ||
          !Number.isFinite(record.baselineChance) || !Number.isFinite(record.finalChance) || !Number.isFinite(record.roll) || record.baselineChance <= 0) { fail(); continue; }
      const before = events.slice(0, index);
      const career = deriveMilitaryCareer(person, state.formations, before, at);
      const strength = militaryPoliticalStrength(career.serviceMonths, s.unitCount, career.verifiedCaptures);
      if (!strength.eligible || s.strength !== strength.strength || s.serviceMonths !== career.serviceMonths ||
          JSON.stringify([...s.capturedEventIds].sort()) !== JSON.stringify([...career.capturedEventIds].sort())) { fail(); continue; }
      const dynasty = save.dynasties.find(d => d.factionId === record.factionId)!;
      const rulers = (dynasty.rulers as Parameters<typeof importRulerSave>[0][]).map(importRulerSave);
      const previous = rulers.find(r => r.id === event.metadata?.previousRulerId)!;
      if (!previous) { fail(); continue; }
      if (record.kind === "DEPOSITION") {
        const evidence = getRecentDepositionEvidence(record.factionId, before.filter(e => record.crisisEventIds.includes(e.id)), at);
        const baseline = Math.min(.015, .005 + Math.max(0, evidence.length - 1) * .005);
        const strong = evidence.length >= 2 || evidence.some(e => e.type === "capital-fallen" || e.type === "empire-split") && political.stability <= 30;
        const chance = Math.min(.03, baseline + Math.min(.01, strength.strength * .0025 + (evidence.length >= 3 ? .0025 : 0)));
        if (at % 12 !== 0 || !strong || !(political.stability <= 40 || political.cityCount <= 2) || evidence.length !== record.crisisEventIds.length ||
            previous.endReason !== "被废" || previous.endYear !== at || previous.deathMonth !== undefined && previous.deathMonth <= at ||
            !close(record.baselineChance, baseline) || !close(record.finalChance, chance)) fail();
      } else {
        const successor = rulers.find(r => r.id === event.metadata?.displacedSuccessorId);
        const reason = event.metadata?.successionReason;
        if (!successor || !["natural", "combat", "captured"].includes(String(reason)) || previous.deathMonth !== at) { fail(); continue; }
        const context = { worldMonth: at, factionId: record.factionId, predecessor: previous, successor, identityStage: "STATE", status: "ACTIVE",
          stability: political.stability, cityCount: political.cityCount, successionReason: reason as "natural" | "combat" | "captured",
          previousSuccessionMonths: rulers.filter(r => r.predecessorId && r.accessionYear !== undefined && r.accessionYear <= at &&
            (r.accessionYear < at || (r.reignOrdinal ?? 0) <= (previous.reignOrdinal ?? 0))).map(r => r.accessionYear!),
          politicalShocks: derivePoliticalSuccessionShocks(record.factionId, previous, at, before) };
        const eligibility = getRevolutionEligibility(context);
        if (JSON.stringify([...record.crisisEventIds].sort()) !== JSON.stringify(eligibility.observedPoliticalShocks.map(s => s.eventId).sort()) ||
            political.riskTier !== eligibility.riskTier || !close(record.baselineChance, getDynasticRevolutionChance(context)) ||
            !close(record.finalChance, getDynasticRevolutionChance({ ...context, military: { candidates: [s], blocked: [], identityBlocked: 0 } }))) fail();
      }
    } catch { fail(); }
  }
  return errors;
}
