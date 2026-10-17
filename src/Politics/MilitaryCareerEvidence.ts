import type { MilitaryPerson, MilitaryFormation } from "./MilitaryCommandRegistry";
import type { WorldEvent } from "../History/WorldHistory";
import { deriveMilitaryLifeSchedule } from "./MilitaryLifeRules";

/** Pure projection: no diagnostic totals, inferred battles or random draws. */
export function deriveMilitaryCareer(person: MilitaryPerson, formations: MilitaryFormation[], events: WorldEvent[], worldMonth: number) {
  const appointments = person.appointments.filter(a => a.startMonth <= worldMonth);
  const intervals = appointments.map(a => [a.startMonth, Math.min(a.endMonth ?? worldMonth, person.deathMonth ?? worldMonth, worldMonth)])
    .filter(([start, end]) => end >= start).sort((a, b) => a[0] - b[0]);
  let serviceMonths = 0, end = -Infinity;
  for (const [start, stop] of intervals) { serviceMonths += Math.max(0, stop - Math.max(start, end)); end = Math.max(end, stop); }
  const commands = formations.filter(f => f.commanderPersonId === person.personId && appointments.some(a => a.commandId === f.commandId && a.factionId === f.factionId));
  const byId = new Map(events.map(e => [e.id, e]));
  const captures = [...new Set(person.capturedEventIds)].flatMap(id => {
    const e = byId.get(id), month = e?.monthIndex ?? e?.year ?? Infinity;
    const f = commands.find(f => f.commandId === e?.metadata?.commandId);
    const a = appointments.find(a => a.commandId === f?.commandId);
    return e && f && a && ["city-captured", "capital-fallen"].includes(e.type) &&
      e.metadata?.commanderPersonId === person.personId && e.actorFactionId === f.factionId &&
      e.targetFactionId !== f.factionId && Boolean(e.targetFactionId) && e.cityId &&
      month >= a.startMonth && month <= Math.min(a.endMonth ?? worldMonth, worldMonth) &&
      f.captures.some(c => c.eventId === id && c.cityId === e.cityId && c.month === month) ? [e] : [];
  });
  const capitalCaptures = captures.filter(e => e.metadata?.wasCapital === 1).length;
  const initialSizes = events.filter(e => e.type === "military-appointment" && e.metadata?.personId === person.personId &&
    appointments.some(a => a.commandId === e.metadata?.commandId && a.factionId === e.actorFactionId && a.startMonth === (e.monthIndex ?? e.year)))
    .map(e => Number(e.metadata?.unitCount)).filter(n => Number.isSafeInteger(n) && n >= 2 && n <= 12);
  const recordedCommandSize = Math.max(0, ...initialSizes);
  const active = person.status === "ACTIVE" && worldMonth < deriveMilitaryLifeSchedule(person).retirementMonth
    ? commands.filter(f => f.status === "ACTIVE" && f.factionId === person.factionId && appointments.some(a => a.commandId === f.commandId && a.endMonth === undefined)) : [];
  const currentUnitCount = new Set(active.flatMap(f => f.memberUnitIds)).size;
  // Time alone contributes at most .35; combined appointment advantage is capped at 2x.
  const weight = 1 + Math.min(.35, serviceMonths / 240 * .35) + Math.min(.5, captures.length * .1 + capitalCaptures * .05) + Math.min(.15, recordedCommandSize / 12 * .15);
  return { serviceMonths, appointmentCount: appointments.length, reappointments: Math.max(0, appointments.length - 1),
    ordinaryCaptures: captures.length - capitalCaptures, capitalCaptures, verifiedCaptures: captures.length,
    capturedEventIds: captures.map(e => e.id), recordedCommandSize, currentUnitCount, hasActiveFormation: active.length > 0,
    ageRetired: person.status !== "ACTIVE" && appointments.at(-1)?.endReason === "AGE_RETIREMENT", dead: person.status === "DEAD",
    appointmentWeight: Math.min(2, weight), level: weight >= 1.7 ? "资深" : weight >= 1.2 ? "有经验" : "初历" };
}

/** Uses the existing selection draw. Caller supplies deterministically sorted candidates. */
export function selectMilitaryCandidate<T>(candidates: T[], weights: number[], draw: number): T {
  let ticket = draw * weights.reduce((sum, weight) => sum + weight, 0);
  for (let index = 0; index < candidates.length; index++) { ticket -= weights[index]; if (ticket < 0) return candidates[index]; }
  return candidates[candidates.length - 1];
}
