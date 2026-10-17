import { deriveMilitaryLifeSchedule } from "../Politics/MilitaryLifeRules";
import { MAX_COMMANDERS_PER_FACTION, MAX_FORMATION_UNITS, type MilitaryCommandState } from "../Politics/MilitaryCommandRegistry";

const plain = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const month = (value: unknown) => Number.isSafeInteger(value);

export function validateMilitaryCommandState(state: unknown, users: any[], units: any[], cities: any[], factions: Set<string>, worldMonth: number, history: any) {
  const errors: string[] = [];
  if (!plain(state) || !Array.isArray(state.people) || !Array.isArray(state.formations) ||
      !Number.isSafeInteger(state.personSequence) || Number(state.personSequence) < 1 ||
      !Number.isSafeInteger(state.commandSequence) || Number(state.commandSequence) < 1 ||
      !Number.isSafeInteger(state.lastEvaluationMonth) || Number(state.lastEvaluationMonth) < -1 || Number(state.lastEvaluationMonth) > worldMonth) {
    return ["militaryCommandRegistry has invalid state shape"];
  }
  const registry = state as unknown as MilitaryCommandState;
  const historyById = new Map<string, any>((Array.isArray(history?.events) ? history.events : [])
    .filter((e: unknown) => plain(e) && typeof e.id === "string").map((e: any) => [e.id, e]));
  const naturalEvents = new Map<string, any[]>(), retirementEvents = new Map<string, any[]>();
  for (const event of Array.isArray(history?.events) ? history.events : []) {
    if (!plain(event) || !plain(event.metadata)) continue;
    const natural = event.type === "military-person-died" && event.metadata.deathCause === "NATURAL_DEATH";
    const retirement = event.type === "military-command-ended" && event.metadata.endReason === "AGE_RETIREMENT";
    if (!natural && !retirement) continue;
    const key = natural ? event.metadata.personId : event.metadata.commandId;
    if (typeof key !== "string") { errors.push("military lifecycle event lacks identity"); continue; }
    const target = natural ? naturalEvents : retirementEvents;
    const rows = target.get(key) ?? []; rows.push(event); target.set(key, rows);
  }
  const liveMilitaryIds = new Set(users.map(user => user.militaryPersonId));
  const ageCommandOwners = new Map<string, string>();
  const people = new Map<string, any>();
  const formations = new Map<string, any>();
  const userById = new Map(users.map(user => [String(user.userId), user]));
  const unitById = new Map(units.map(unit => [String(unit.unitId), unit]));
  const factionRefs = new Set<string>();
  const commandRefs = new Set<string>();
  const appointmentCommandRefs = new Set<string>();
  let maxPersonSequence = 0;
  let maxCommandSequence = 0;
  for (const person of registry.people) {
    if (!plain(person) || typeof person.personId !== "string" || !person.personId || people.has(person.personId) ||
        !Number.isSafeInteger(person.sourceUserId) || typeof person.personalName !== "string" || !person.personalName.trim() || person.personalName.length > 32 || typeof person.name !== "string" || !person.name.trim() ||
        !month(person.bornMonth) || person.bornMonth > worldMonth || !factions.has(person.factionId) ||
        !["ACTIVE", "RETIRED", "DEAD"].includes(person.status) || !Array.isArray(person.appointments) || !Array.isArray(person.capturedEventIds)) {
      errors.push("military person identity or lifecycle is invalid"); continue;
    }
    people.set(person.personId, person);
    const personSequenceMatch = /^military-person-(\d+)$/.exec(person.personId);
    if (!personSequenceMatch) errors.push(`military person id is invalid: ${person.personId}`);
    else maxPersonSequence = Math.max(maxPersonSequence, Number(personSequenceMatch[1]));
    factionRefs.add(person.factionId);
    if (person.status === "DEAD") {
      if (!month(person.deathMonth) || Number(person.deathMonth) < person.bornMonth || Number(person.deathMonth) > worldMonth || typeof person.deathCause !== "string" || !person.deathCause) errors.push(`military dead person lacks actual death: ${person.personId}`);
    } else if (person.deathMonth !== undefined || person.deathCause !== undefined) errors.push(`living military person has death data: ${person.personId}`);
    const life = deriveMilitaryLifeSchedule(person);
    if (person.deathCause === "NATURAL_DEATH" && (person.status !== "DEAD" || Number(person.deathMonth) < life.naturalDeathMonth)) errors.push(`military natural death precedes derived lifespan: ${person.personId}`);
    if (person.deathCause === "NATURAL_DEATH") {
      const rows = naturalEvents.get(person.personId) ?? [];
      if (rows.length !== 1 || (rows[0].monthIndex ?? rows[0].year) !== person.deathMonth || rows[0].actorFactionId !== person.factionId) errors.push(`military natural death lacks unique matching history: ${person.personId}`);
    }
    if (person.status === "DEAD" && liveMilitaryIds.has(person.personId)) errors.push(`dead military person retains a live User: ${person.personId}`);
    const open = person.appointments.filter((item: any) => plain(item) && item.endMonth === undefined);
    if ((person.status === "ACTIVE") !== (open.length === 1) || (person.status !== "ACTIVE" && open.length !== 0)) errors.push(`military appointment state disagrees with person status: ${person.personId}`);
    let priorEnd = Number.NEGATIVE_INFINITY;
    for (const appointment of person.appointments) {
      if (!plain(appointment)) { errors.push(`military appointment interval is invalid: ${person.personId}`); continue; }
      if (!factions.has(appointment.factionId) || !month(appointment.startMonth) || appointment.startMonth < person.bornMonth || appointment.startMonth > worldMonth || typeof appointment.commandId !== "string" || !appointment.commandId ||
          (appointment.endMonth !== undefined && (!month(appointment.endMonth) || Number(appointment.endMonth) < appointment.startMonth || Number(appointment.endMonth) > worldMonth || !["DISMISSED", "TRANSFERRED", "FACTION_ENDED", "DEATH", "AGE_RETIREMENT"].includes(String(appointment.endReason)))) ||
          (appointment.endMonth === undefined && appointment.endReason !== undefined) || appointment.startMonth < priorEnd) errors.push(`military appointment interval is invalid: ${person.personId}`);
      if (appointment.endReason === "AGE_RETIREMENT" && Number(appointment.endMonth) < life.retirementMonth) errors.push(`military age retirement precedes retirement age: ${person.personId}`);
      if (appointment.endReason === "AGE_RETIREMENT") {
        ageCommandOwners.set(appointment.commandId, person.personId);
        const rows = retirementEvents.get(appointment.commandId) ?? [];
        if (rows.length !== 1 || rows[0].metadata.personId !== person.personId || rows[0].actorFactionId !== appointment.factionId || (rows[0].monthIndex ?? rows[0].year) !== appointment.endMonth) errors.push(`military age retirement lacks unique matching history: ${person.personId}`);
      }
      if (appointment.endMonth !== undefined) priorEnd = appointment.endMonth;
      if (appointmentCommandRefs.has(appointment.commandId)) errors.push(`duplicate military appointment command reference: ${appointment.commandId}`);
      appointmentCommandRefs.add(appointment.commandId);
      commandRefs.add(appointment.commandId);
      if (person.status === "ACTIVE" && appointment.endMonth === undefined && appointment.factionId !== person.factionId) errors.push(`active military faction mismatch: ${person.personId}`);
    }
    if (person.status === "ACTIVE") {
      const user = userById.get(String(person.sourceUserId));
      if (!user || String(user.militaryPersonId) !== person.personId || user.name !== person.name || user.bornMonth !== person.bornMonth || user.factionId !== person.factionId || user.role !== "NORMAL") errors.push(`active military person has no matching live User: ${person.personId}`);
    }
    for (const eventId of person.capturedEventIds) if (typeof eventId !== "string" || !historyById.has(eventId)) errors.push(`military person references missing capture event: ${person.personId}`);
  }
  for (const personId of naturalEvents.keys()) if (people.get(personId)?.deathCause !== "NATURAL_DEATH") errors.push(`natural death event references no actual military death: ${personId}`);
  for (const [commandId, rows] of retirementEvents) if (ageCommandOwners.get(commandId) !== rows[0].metadata.personId) errors.push(`retirement event references no actual appointment: ${commandId}`);
  const activeUnits = new Set<string>();
  const activeCommanders = new Map<string, number>();
  const activeFormations = new Map<string, number>();
  for (const formation of registry.formations) {
    if (!plain(formation) || typeof formation.commandId !== "string" || !formation.commandId || formations.has(formation.commandId) ||
        !factions.has(formation.factionId) || typeof formation.commanderPersonId !== "string" || !Array.isArray(formation.memberUnitIds) ||
        !month(formation.createdMonth) || formation.createdMonth > worldMonth || !["ACTIVE", "DISBANDED"].includes(formation.status) || !Array.isArray(formation.captures)) {
      errors.push("military formation identity or lifecycle is invalid"); continue;
    }
    formations.set(formation.commandId, formation);
    const commandSequenceMatch = /^military-command-(\d+)$/.exec(formation.commandId);
    if (!commandSequenceMatch) errors.push(`military command id is invalid: ${formation.commandId}`);
    else maxCommandSequence = Math.max(maxCommandSequence, Number(commandSequenceMatch[1]));
    const person = people.get(formation.commanderPersonId);
    if (!person) errors.push(`military formation references missing commander: ${formation.commandId}`);
    for (const capture of formation.captures) {
      const event = plain(capture) ? historyById.get(capture.eventId) : undefined;
      if (!plain(capture) || !event || !["city-captured", "capital-fallen", "city-recovered"].includes(event.type) || !month(capture.month) || capture.month > worldMonth || (person?.deathMonth !== undefined && capture.month > person.deathMonth) ||
          !Number.isSafeInteger(capture.cityId) && typeof capture.cityId !== "string" ||
          !person?.capturedEventIds.includes(capture.eventId) || event.cityId !== capture.cityId || (event.monthIndex ?? event.year) !== capture.month ||
          event.metadata?.commandId !== formation.commandId || event.metadata?.commanderPersonId !== formation.commanderPersonId) {
        errors.push(`military formation has invalid capture evidence: ${formation.commandId}`);
      }
      if (event && (event.actorFactionId !== formation.factionId || !event.targetFactionId || event.targetFactionId === formation.factionId ||
          !person?.appointments.some((a: any) => a.commandId === formation.commandId && a.factionId === formation.factionId &&
            capture.month >= a.startMonth && capture.month <= (a.endMonth ?? worldMonth)))) errors.push(`military capture outside actual service: ${formation.commandId}`);
    }
    if (new Set(formation.captures.map((c: any) => c?.eventId)).size !== formation.captures.length) errors.push(`duplicate military capture: ${formation.commandId}`);
    if (formation.status !== "ACTIVE") {
      if (formation.targetCityId !== undefined || formation.orderStartMonth !== undefined) errors.push(`disbanded formation retains active order: ${formation.commandId}`);
      continue;
    }
    activeFormations.set(formation.factionId, (activeFormations.get(formation.factionId) ?? 0) + 1);
    activeCommanders.set(formation.factionId, (activeCommanders.get(formation.factionId) ?? 0) + 1);
    if (formation.memberUnitIds.length < 2 || formation.memberUnitIds.length > MAX_FORMATION_UNITS || new Set(formation.memberUnitIds).size !== formation.memberUnitIds.length) errors.push(`active formation size is invalid: ${formation.commandId}`);
    const appointment = person?.appointments.find((item: any) => item.commandId === formation.commandId && item.endMonth === undefined);
    if (!person || person.status !== "ACTIVE" || person.factionId !== formation.factionId || !appointment || appointment.factionId !== formation.factionId) errors.push(`active formation has no matching appointment: ${formation.commandId}`);
    const commanderUser = person && userById.get(String(person.sourceUserId));
    for (const unitId of formation.memberUnitIds) {
      const key = String(unitId); const unit = unitById.get(key);
      if (activeUnits.has(key)) errors.push(`unit belongs to multiple active formations: ${key}`);
      activeUnits.add(key);
      if (!unit || unit.alive !== true || unit.role !== "NORMAL" || unit.factionId !== formation.factionId || unit.userId === undefined ||
          !userById.has(String(unit.userId)) || String(userById.get(String(unit.userId))?.playerUnitId) !== key) errors.push(`active formation references invalid member unit: ${key}`);
    }
    if (!commanderUser || commanderUser.role !== "NORMAL" || commanderUser.factionId !== formation.factionId || !formation.memberUnitIds.includes(commanderUser.playerUnitId)) errors.push(`active commander is not a formation member: ${formation.commandId}`);
    if (formation.targetCityId !== undefined && (!cities.some(city => city.cityId === formation.targetCityId && city.ownerFactionId !== formation.factionId) || !month(formation.orderStartMonth) || Number(formation.orderStartMonth) > worldMonth)) errors.push(`active formation has invalid target order: ${formation.commandId}`);
  }
  for (const appointmentCommandId of commandRefs) if (!formations.has(appointmentCommandId)) errors.push(`military appointment references missing formation: ${appointmentCommandId}`);
  for (const event of Array.isArray(history.events) ? history.events : []) {
    if (!plain(event) || event.type !== "military-order-issued") continue;
    const m = event.metadata ?? {}, formation = formations.get(m.commandId), person = people.get(m.personId);
    const at = event.monthIndex ?? event.year;
    if (!formation || !person || formation.commanderPersonId !== person.personId || formation.factionId !== event.actorFactionId ||
        !person.appointments.some((a: any) => a.commandId === formation.commandId && at >= a.startMonth && at <= (a.endMonth ?? worldMonth)) ||
        !event.cityId || !event.targetFactionId || event.targetFactionId === event.actorFactionId || ![0, 1].includes(m.meritInfluenced) || ![0, 1].includes(m.targetWasCapital) ||
        typeof m.nearestCityId !== "string" ||
        (m.meritInfluenced === 1 && (m.targetWasCapital !== 1 || m.nearestCityId === event.cityId || !Number.isFinite(m.nearestDistance) || !Number.isFinite(m.targetDistance) ||
          m.nearestDistance < 0 || m.targetDistance < m.nearestDistance || m.targetDistance > m.nearestDistance * 1.15 || m.targetDistance - m.nearestDistance > 32))) errors.push("invalid military order provenance");
    // Capture identities and service intervals are validated above. Reuse their index
    // rather than rebuilding the whole history projection for every historical order.
    if (!errors.length && m.meritInfluenced === 1 && !person.capturedEventIds.some((id: string) => {
      const e = historyById.get(id);
      return e && ["city-captured", "capital-fallen", "city-recovered"].includes(e.type) && e.metadata?.commanderPersonId === person.personId && (e.monthIndex ?? e.year) <= at;
    }))
      errors.push("military order merit has no verified victory");
  }
  for (const event of historyById.values()) {
    const m = event.metadata ?? {};
    if (m.personalName !== undefined) {
      const person = people.get(m.personId), formation = formations.get(m.commandId);
      if (!person || m.personalName !== person.personalName ||
          m.sourceUserId !== undefined && m.sourceUserId !== person.sourceUserId ||
          m.commandId !== undefined && (!formation || formation.commanderPersonId !== person.personId))
        errors.push(`military name snapshot has invalid identity: ${event.id}`);
    }
    if (m.commanderPersonalName !== undefined) {
      const person = people.get(m.commanderPersonId), formation = formations.get(m.commandId), at = event.monthIndex ?? event.year;
      if (!person || !formation || person.personalName !== m.commanderPersonalName || formation.commanderPersonId !== person.personId ||
          formation.factionId !== event.actorFactionId || !person.appointments.some((a: any) => a.commandId === formation.commandId &&
            a.factionId === event.actorFactionId && a.startMonth <= at && at <= (a.endMonth ?? worldMonth)) ||
          person.deathMonth !== undefined && at > person.deathMonth ||
          !["city-captured", "city-recovered", "capital-fallen"].includes(event.type) || !event.cityId ||
          !formation.captures.some((c: any) => c.eventId === event.id || c.cityId === event.cityId && c.month === at &&
            (event.historyGroupId && historyById.get(c.eventId)?.historyGroupId === event.historyGroupId ||
              event.type === "capital-fallen" && historyById.get(c.eventId)?.type === "city-recovered" &&
              historyById.get(c.eventId)?.actorFactionId === event.actorFactionId && historyById.get(c.eventId)?.targetFactionId === event.targetFactionId &&
              historyById.get(c.eventId)?.metadata?.wasCapital === 1)))
        errors.push(`military victory name snapshot has invalid evidence: ${event.id}`);
    }
  }
  if (registry.personSequence <= maxPersonSequence) errors.push("military person sequence would reuse an existing id");
  if (registry.commandSequence <= maxCommandSequence) errors.push("military command sequence would reuse an existing id");
  for (const person of people.values()) {
    if (new Set(person.capturedEventIds).size !== person.capturedEventIds.length || person.capturedEventIds.some((id: string) =>
      ![...formations.values()].some(f => f.commanderPersonId === person.personId && f.captures.some((c: any) => c?.eventId === id)))) errors.push(`military person capture identity mismatch: ${person.personId}`);
    if (person.status === "ACTIVE") {
      const activeAppointment = person.appointments.find((appointment: any) => appointment.endMonth === undefined);
      if (!activeAppointment || formations.get(activeAppointment.commandId)?.status !== "ACTIVE") errors.push(`active military person has no active formation: ${person.personId}`);
    }
  }
  for (const [factionId, count] of activeCommanders) if (count > MAX_COMMANDERS_PER_FACTION) errors.push(`military commander cap exceeded: ${factionId}`);
  for (const [factionId, count] of activeFormations) if (count > MAX_COMMANDERS_PER_FACTION) errors.push(`military formation cap exceeded: ${factionId}`);
  for (const user of users) if (user.militaryPersonId !== undefined && !people.has(String(user.militaryPersonId))) errors.push(`User references missing military person: ${String(user.militaryPersonId)}`);
  return errors;
}
