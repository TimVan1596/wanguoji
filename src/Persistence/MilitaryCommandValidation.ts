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
        !Number.isSafeInteger(person.sourceUserId) || typeof person.name !== "string" || !person.name.trim() ||
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
    const open = person.appointments.filter((item: any) => plain(item) && item.endMonth === undefined);
    if ((person.status === "ACTIVE") !== (open.length === 1) || (person.status !== "ACTIVE" && open.length !== 0)) errors.push(`military appointment state disagrees with person status: ${person.personId}`);
    let priorEnd = Number.NEGATIVE_INFINITY;
    for (const appointment of person.appointments) {
      if (!plain(appointment)) { errors.push(`military appointment interval is invalid: ${person.personId}`); continue; }
      if (!factions.has(appointment.factionId) || !month(appointment.startMonth) || appointment.startMonth < person.bornMonth || appointment.startMonth > worldMonth || typeof appointment.commandId !== "string" || !appointment.commandId ||
          (appointment.endMonth !== undefined && (!month(appointment.endMonth) || Number(appointment.endMonth) < appointment.startMonth || Number(appointment.endMonth) > worldMonth || !["DISMISSED", "TRANSFERRED", "FACTION_ENDED", "DEATH"].includes(String(appointment.endReason)))) ||
          (appointment.endMonth === undefined && appointment.endReason !== undefined) || appointment.startMonth < priorEnd) errors.push(`military appointment interval is invalid: ${person.personId}`);
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
    for (const eventId of person.capturedEventIds) if (typeof eventId !== "string" || !Array.isArray(history.events) || !history.events.some((event: any) => event.id === eventId)) errors.push(`military person references missing capture event: ${person.personId}`);
  }
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
      const event = plain(capture) && Array.isArray(history.events) ? history.events.find((candidate: any) => candidate.id === capture.eventId) : undefined;
      if (!plain(capture) || !event || !["city-captured", "capital-fallen", "city-recovered"].includes(event.type) || !month(capture.month) || capture.month > worldMonth ||
          !Number.isSafeInteger(capture.cityId) && typeof capture.cityId !== "string" ||
          !person?.capturedEventIds.includes(capture.eventId) || event.cityId !== capture.cityId || (event.monthIndex ?? event.year) !== capture.month ||
          event.metadata?.commandId !== formation.commandId || event.metadata?.commanderPersonId !== formation.commanderPersonId) {
        errors.push(`military formation has invalid capture evidence: ${formation.commandId}`);
      }
    }
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
  if (registry.personSequence <= maxPersonSequence) errors.push("military person sequence would reuse an existing id");
  if (registry.commandSequence <= maxCommandSequence) errors.push("military command sequence would reuse an existing id");
  for (const person of people.values()) {
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
