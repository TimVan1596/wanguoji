import { deriveMilitaryChronicle } from "./MilitaryChronicle";
import { deriveMilitaryLifeSchedule } from "./MilitaryLifeRules";
import { deriveNameCulture, generateMilitaryPersonalName } from "./NameCulture";
import { isPopulationIdentityLabel, getMilitaryPersonDisplayName } from "./MilitaryPersonIdentity";
import WorldHistory from "../History/WorldHistory";
import { deriveMilitaryCareer, selectMilitaryCandidate } from "./MilitaryCareerEvidence";
import { deriveMilitaryPoliticalInfluence, getMilitaryPoliticalEvents } from "./MilitaryPoliticalInfluence";
import type User from "../Components/User";
import type Team from "../Components/Team";
import type City from "../Components/City";
import type { LogicalUnitState } from "../Simulation/LogicalUnitState";
import Diplomacy from "./Diplomacy";
import worldRandom from "../Simulation/WorldRandom";
import type { WorldEvent } from "../History/WorldHistory";

export const MAX_COMMANDERS_PER_FACTION = 2;
export const MAX_FORMATIONS_PER_FACTION = 2;
export const MAX_FORMATION_UNITS = 12;
export const MIN_COMMANDER_AGE_MONTHS = 18 * 12;
export const ANNUAL_APPOINTMENT_CHANCE = 0.05;

export interface MilitaryAppointment {
  factionId: string;
  startMonth: number;
  endMonth?: number;
  endReason?: "DISMISSED" | "TRANSFERRED" | "FACTION_ENDED" | "DEATH" | "AGE_RETIREMENT";
  commandId: string;
}

export interface MilitaryPerson {
  personId: string;
  sourceUserId: number;
  name: string;
  /** Authoritative personal identity; name above remains the original User label. */
  personalName: string;
  bornMonth: number;
  factionId: string;
  status: "ACTIVE" | "RETIRED" | "DEAD";
  appointments: MilitaryAppointment[];
  deathMonth?: number;
  deathCause?: string;
  capturedEventIds: string[];
}

export interface MilitaryFormation {
  commandId: string;
  factionId: string;
  commanderPersonId: string;
  memberUnitIds: string[];
  createdMonth: number;
  status: "ACTIVE" | "DISBANDED";
  targetCityId?: string;
  orderStartMonth?: number;
  captures: Array<{ eventId: string; cityId: string; month: number }>;
}

export interface MilitaryCommandState {
  people: MilitaryPerson[];
  formations: MilitaryFormation[];
  personSequence: number;
  commandSequence: number;
  lastEvaluationMonth: number;
}

const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** Deterministic adult birth date assigned when a simulated person first enters the world. */
export function deriveUserBornMonth(userId: number, name: string, factionId: string, spawnMonth: number) {
  const hash = stableHash(`${worldRandom.exportState().seed}\u0000${factionId}\u0000${userId}\u0000${name}\u0000${spawnMonth}`);
  const ageMonths = 18 * 12 + (hash % (43 * 12));
  const birthMonthOffset = (hash >>> 8) % 12;
  return spawnMonth - ageMonths - birthMonthOffset;
}

export class MilitaryCommandRegistryStore {
  private people = new Map<string, MilitaryPerson>();
  private formations = new Map<string, MilitaryFormation>();
  private personSequence = 1;
  private commandSequence = 1;
  private lastEvaluationMonth = -1;
  private lastArrivalTargetByCommand = new Map<string, string>();
  private longRangeOrderSamples = new Map<string, number>();
  private eventWriter?: (event: Omit<WorldEvent, "id"> & { id: string }) => string;
  private eventReader: (factionId: string) => WorldEvent[] = factionId => WorldHistory.getEventsForFaction(factionId);
  private diagnostics = { candidates: 0, eligible: 0, appointments: 0, capBlocked: 0, unitBlocked: 0, orders: 0, captures: 0, deaths: 0,
    unitsSteered: 0, commandedSiegeContacts: 0, targetCityArrivals: 0, invalidatedTargets: 0, staleOrderChecks: 0, ageRetirements: 0, naturalDeaths: 0, releasedFormations: 0, reappointments: 0, ageBlocked: 0, identityFailures: 0 };

  reset() {
    this.people.clear(); this.formations.clear(); this.personSequence = 1; this.commandSequence = 1;
    this.lastEvaluationMonth = -1;
    this.lastArrivalTargetByCommand.clear();
    this.longRangeOrderSamples.clear();
    this.diagnostics = { candidates: 0, eligible: 0, appointments: 0, capBlocked: 0, unitBlocked: 0, orders: 0, captures: 0, deaths: 0,
      unitsSteered: 0, commandedSiegeContacts: 0, targetCityArrivals: 0, invalidatedTargets: 0, staleOrderChecks: 0, ageRetirements: 0, naturalDeaths: 0, releasedFormations: 0, reappointments: 0, ageBlocked: 0, identityFailures: 0 };
  }

  setEventWriter(writer: (event: Omit<WorldEvent, "id"> & { id: string }) => string,
    reader: (factionId: string) => WorldEvent[] = factionId => WorldHistory.getEventsForFaction(factionId)) {
    this.eventWriter = writer; this.eventReader = reader;
  }

  exportState(): MilitaryCommandState {
    return { people: [...this.people.values()].map(person => structuredClone(person)),
      formations: [...this.formations.values()].map(formation => structuredClone(formation)),
      personSequence: this.personSequence, commandSequence: this.commandSequence, lastEvaluationMonth: this.lastEvaluationMonth };
  }

  importState(state: MilitaryCommandState) {
    this.people = new Map(state.people.map(person => [person.personId, structuredClone(person)]));
    this.formations = new Map(state.formations.map(formation => [formation.commandId, structuredClone(formation)]));
    this.personSequence = state.personSequence; this.commandSequence = state.commandSequence;
    this.lastEvaluationMonth = state.lastEvaluationMonth;
    this.lastArrivalTargetByCommand.clear();
    this.longRangeOrderSamples.clear();
    this.diagnostics = { candidates: 0, eligible: 0, appointments: 0, capBlocked: 0, unitBlocked: 0, orders: 0, captures: 0, deaths: 0,
      unitsSteered: 0, commandedSiegeContacts: 0, targetCityArrivals: 0, invalidatedTargets: 0, staleOrderChecks: 0, ageRetirements: 0, naturalDeaths: 0, releasedFormations: 0, reappointments: 0, ageBlocked: 0, identityFailures: 0 };
  }

  getCareer(person: MilitaryPerson, worldMonth: number) {
    const events = [...new Map([...new Set(person.appointments.map(a => a.factionId))].flatMap(id => this.eventReader(id)).map(e => [e.id, e])).values()];
    return deriveMilitaryCareer(person, this.getFormations(), events, worldMonth);
  }

  getChronicle(person: MilitaryPerson, worldMonth: number, factionId?: string) {
    const events = [...new Map([...new Set(person.appointments.map(a => a.factionId).concat(person.factionId))]
      .flatMap(id => this.eventReader(id)).map(e => [e.id, e])).values()];
    return deriveMilitaryChronicle(person, this.getFormations(), events, worldMonth, factionId);
  }

  getPoliticalInfluence(team: Team, worldMonth: number, logicalRegistry?: Pick<import("../Simulation/LogicalUnitRegistry").default, "getEntry">) {
    const people = this.getPeople();
    const users = [...(team.users ?? [])].filter(user => user.role === "NORMAL" && user.team === team).map(user => {
      const unitId = user.player.logicalUnitId;
      const entry = unitId ? logicalRegistry?.getEntry(unitId) : undefined;
      const person = user.militaryPersonId ? this.people.get(user.militaryPersonId) : undefined;
      const liveBindingVerified = !user.isDestroyed && user.role === "NORMAL" && user.team === team && user.player.active &&
        user.player.user === user && user.player.team === team && user.player.role === "NORMAL" && !user.rulerId && !user.player.rulerId &&
        entry?.player === user.player && entry.state.alive && entry.state.userId === user.id && entry.state.factionId === team.name &&
        entry.state.unitId === unitId && entry.state.role === "NORMAL" && (!person || Boolean(user.matchesMilitaryLife?.(person)));
      return { userId: user.id, name: user.name, bornMonth: user.bornMonth, factionId: user.team.name,
        personId: user.militaryPersonId, unitId, liveBindingVerified: Boolean(liveBindingVerified) };
    });
    const relevantFactions = [...new Set(people.filter(p => p.factionId === team.name && p.status === "ACTIVE").flatMap(p => p.appointments.map(a => a.factionId)))];
    return deriveMilitaryPoliticalInfluence({ factionId: team.name, status: team.status, identityStage: team.identityStage, worldMonth, people, formations: this.getFormations(), users,
      events: [...new Map(relevantFactions.flatMap(id => this.eventReader(id)).map(e => [e.id, e])).values()] });
  }

  getPoliticalEvents(person: MilitaryPerson) {
    return getMilitaryPoliticalEvents([...new Map([...new Set(person.appointments.map(a => a.factionId))]
      .flatMap(id => this.eventReader(id)).map(e => [e.id, e])).values()], person.personId);
  }

  getOrderEvidence(formation: MilitaryFormation) {
    return this.eventReader(formation.factionId).find(e => e.type === "military-order-issued" &&
      e.metadata?.commandId === formation.commandId && e.cityId === formation.targetCityId && (e.monthIndex ?? e.year) === formation.orderStartMonth);
  }

  getPeople() { return [...this.people.values()]; }
  getFormations() { return [...this.formations.values()]; }
  getDiagnostics() { return { ...this.diagnostics, activeCommanders: [...this.people.values()].filter(p => p.status === "ACTIVE").length,
    activeFormations: [...this.formations.values()].filter(f => f.status === "ACTIVE").length }; }

  update(worldMonth: number, teams: Team[], cities: City[]) {
    const annual = worldMonth % 12 === 0 && worldMonth > this.lastEvaluationMonth;
    if (annual) {
      this.lastEvaluationMonth = worldMonth;
      this.advanceLifecycles(worldMonth, teams);
    }
    this.reconcile(worldMonth, teams);
    this.refreshOrders(worldMonth, teams, cities);
    this.observeLongRangeOrders(worldMonth, teams, cities);
    if (!annual) return;
    for (const team of teams) {
      if (team.status !== "ACTIVE" || team.users.size < 2) continue;
      const activeCount = [...this.people.values()].filter(p => p.status === "ACTIVE" && p.factionId === team.name).length;
      const activeFormations = [...this.formations.values()].filter(f => f.status === "ACTIVE" && f.factionId === team.name).length;
      if (activeCount >= MAX_COMMANDERS_PER_FACTION || activeFormations >= MAX_FORMATIONS_PER_FACTION) { this.diagnostics.capBlocked++; continue; }
      const candidates = [...team.users].filter(user => this.isEligible(user, worldMonth)).sort((a, b) => a.id - b.id || a.name.localeCompare(b.name));
      this.diagnostics.candidates += candidates.length;
      if (!candidates.length) continue;
      const availableUnits = [...team.users].filter(user => user.player.logicalUnitId && user.role === "NORMAL" &&
        !this.isUnitAssigned(user.player.logicalUnitId) && user.team === team).sort((a, b) => a.id - b.id || a.name.localeCompare(b.name));
      if (availableUnits.length < 2) { this.diagnostics.unitBlocked++; continue; }
      this.diagnostics.eligible += candidates.length;
      if (worldRandom.next() >= ANNUAL_APPOINTMENT_CHANCE) continue;
      const weights = candidates.map(user => {
        const person = user.militaryPersonId ? this.people.get(user.militaryPersonId) : undefined;
        return person ? this.getCareer(person, worldMonth).appointmentWeight : 1;
      });
      const candidate = selectMilitaryCandidate(candidates, weights, worldRandom.next());
      const members = [candidate, ...availableUnits.filter(user => user !== candidate)].slice(0, MAX_FORMATION_UNITS);
      if (members.length < 2 || !candidate.player.logicalUnitId) { this.diagnostics.unitBlocked++; continue; }
      if (this.appoint(candidate, team.name, worldMonth, members.map(user => user.player.logicalUnitId!))) this.diagnostics.appointments++;
      this.refreshOrders(worldMonth, teams, cities);
    }
  }

  private advanceLifecycles(worldMonth: number, teams: Team[]) {
    const bound = new Map<string, User[]>();
    for (const team of teams) for (const user of team.users) if (user.militaryPersonId) {
      const rows = bound.get(user.militaryPersonId) ?? []; rows.push(user); bound.set(user.militaryPersonId, rows);
    }
    for (const person of this.people.values()) {
      if (person.status === "DEAD") continue;
      const life = deriveMilitaryLifeSchedule(person);
      if (worldMonth < life.retirementMonth) continue;
      // Retired records without a verifiable original User are historical unknowns.
      const matches = bound.get(person.personId) ?? [];
      const user = matches.length === 1 ? matches[0] : undefined;
      if (!user || !user.matchesMilitaryLife?.(person)) { this.diagnostics.identityFailures++; continue; }
      if (worldMonth >= life.naturalDeathMonth) {
        // destroyUser ends the appointment before removing population and runtime units.
        if (!user.destroyUser(false, { cause: "NATURAL_DEATH", month: worldMonth, context: "MILITARY_NATURAL_LIFESPAN", damageSource: "MILITARY_LIFESPAN" })) this.diagnostics.identityFailures++;
      } else if (person.status === "ACTIVE") {
        for (const formation of this.formations.values()) if (formation.commanderPersonId === person.personId && formation.status === "ACTIVE")
          this.endFormation(formation, worldMonth, "AGE_RETIREMENT");
      }
    }
  }

  private isEligible(user: User, worldMonth: number) {
    const person = user.militaryPersonId ? this.people.get(user.militaryPersonId) : undefined;
    if (user.isDestroyed || person?.status === "DEAD" || (user.militaryPersonId && (!person || person.sourceUserId !== user.id || person.bornMonth !== user.bornMonth || person.name !== user.name || person.factionId !== user.team.name))) return false;
    if (worldMonth >= deriveMilitaryLifeSchedule(person ?? { personId: `military-person-${this.personSequence}`, bornMonth: user.bornMonth }).retirementMonth) {
      this.diagnostics.ageBlocked++; return false;
    }
    return user.role === "NORMAL" && user.team.status === "ACTIVE" && user.bornMonth <= worldMonth - MIN_COMMANDER_AGE_MONTHS &&
      Boolean(user.player.active && user.player.logicalUnitId) && !this.isUnitAssigned(user.player.logicalUnitId!) &&
      (!user.militaryPersonId || this.people.get(user.militaryPersonId)?.status !== "ACTIVE");
  }

  private appoint(user: User, factionId: string, worldMonth: number, memberUnitIds: string[]) {
    let person = user.militaryPersonId ? this.people.get(user.militaryPersonId) : undefined;
    if (person?.status === "DEAD" || !this.isEligible(user, worldMonth)) return false;
    if (person?.status === "RETIRED") this.diagnostics.reappointments++;
    const personId = person?.personId ?? `military-person-${this.personSequence++}`;
    const commandId = `military-command-${this.commandSequence++}`;
    if (!person) {
      person = { personId, sourceUserId: user.id, name: user.name, personalName: isPopulationIdentityLabel(user.name) && user.id >= 1000000000 && user.id <= 1999999999
          ? generateMilitaryPersonalName({ seed: worldRandom.exportState().seed, personId, sourceUserId: user.id,
              bornMonth: user.bornMonth, originalName: user.name, culture: deriveNameCulture(user.team.houseName) })
          : user.name, bornMonth: user.bornMonth, factionId,
        status: "ACTIVE", appointments: [], capturedEventIds: [] };
      this.people.set(personId, person);
      user.militaryPersonId = personId;
    }
    person.factionId = factionId; person.status = "ACTIVE";
    person.appointments.push({ factionId, startMonth: worldMonth, commandId });
    this.formations.set(commandId, { commandId, factionId, commanderPersonId: personId,
      memberUnitIds: [...new Set(memberUnitIds)], createdMonth: worldMonth, status: "ACTIVE", captures: [] });
    this.eventWriter?.({ id: `military-appointment-${commandId}`, year: worldMonth, monthIndex: worldMonth,
      category: "politics", type: "military-appointment", title: `${factionId}任命${getMilitaryPersonDisplayName(person)}为军事指挥者`,
      description: `${getMilitaryPersonDisplayName(person)}由既有人口任职，指挥${memberUnitIds.length}个现存单位。`, factionIds: [factionId], actorFactionId: factionId,
      metadata: { personId, sourceUserId: person.sourceUserId, personalName: person.personalName, commandId, unitCount: memberUnitIds.length }, importance: "normal" });
    return true;
  }

  private isUnitAssigned(unitId: string) { return [...this.formations.values()].some(f => f.status === "ACTIVE" && f.memberUnitIds.includes(unitId)); }

  private reconcile(worldMonth: number, teams: Team[]) {
    const teamById = new Map(teams.map(team => [team.name, team]));
    for (const formation of this.formations.values()) {
      if (formation.status !== "ACTIVE") continue;
      const team = teamById.get(formation.factionId);
      const person = this.people.get(formation.commanderPersonId);
      const commander = team && person ? [...team.users].find(user => user.id === person.sourceUserId && user.bornMonth === person.bornMonth && user.name === person.name && !user.isDestroyed && user.militaryPersonId === person.personId && user.role === "NORMAL") : undefined;
      if (!team || team.status !== "ACTIVE" || !commander || !commander.player.logicalUnitId || person?.status !== "ACTIVE") {
        this.endFormation(formation, worldMonth, team?.status === "ACTIVE" ? "DISMISSED" : "FACTION_ENDED");
        continue;
      }
      formation.memberUnitIds = formation.memberUnitIds.filter(unitId => {
        const user = [...team.users].find(candidate => candidate.player.logicalUnitId === unitId && candidate.role === "NORMAL");
        return Boolean(user && user.player.active);
      });
      if (!formation.memberUnitIds.includes(commander.player.logicalUnitId)) formation.memberUnitIds.unshift(commander.player.logicalUnitId);
      if (formation.memberUnitIds.length < 2) this.endFormation(formation, worldMonth, "DISMISSED");
    }
  }

  private endFormation(formation: MilitaryFormation, worldMonth: number, reason: MilitaryAppointment["endReason"]) {
    if (formation.status !== "ACTIVE") return;
    this.diagnostics.releasedFormations++;
    if (reason === "AGE_RETIREMENT") this.diagnostics.ageRetirements++;
    formation.status = "DISBANDED"; formation.targetCityId = undefined; formation.orderStartMonth = undefined;
    const person = this.people.get(formation.commanderPersonId);
    const appointment = person?.appointments.find(item => item.commandId === formation.commandId && item.endMonth === undefined);
    if (appointment) { appointment.endMonth = worldMonth; appointment.endReason = reason; }
    if (person && person.status !== "DEAD") person.status = "RETIRED";
    if (person) this.eventWriter?.({ id: `military-command-ended-${formation.commandId}`, year: worldMonth, monthIndex: worldMonth,
      category: "politics", type: "military-command-ended", title: reason === "AGE_RETIREMENT" ? `${getMilitaryPersonDisplayName(person)}年老退役` : `${getMilitaryPersonDisplayName(person)}结束军事任职`, factionIds: [formation.factionId],
      actorFactionId: formation.factionId, metadata: { personId: person.personId, sourceUserId: person.sourceUserId, personalName: person.personalName, commandId: formation.commandId, endReason: reason }, importance: "normal" });
  }

  private refreshOrders(worldMonth: number, teams: Team[], cities: City[]) {
    for (const formation of this.formations.values()) {
      if (formation.status !== "ACTIVE") continue;
      const current = cities.find(city => city.id === formation.targetCityId);
      if (current && !current.destroyed && current.ownerFactionId !== formation.factionId && current.ownerTeam?.status === "ACTIVE" &&
        Diplomacy.canAttack(formation.factionId, current.ownerFactionId, worldMonth)) continue;
      if (formation.targetCityId) {
        this.diagnostics.invalidatedTargets++;
        this.lastArrivalTargetByCommand.delete(formation.commandId);
        this.longRangeOrderSamples.delete(formation.commandId);
      }
      const team = teams.find(candidate => candidate.name === formation.factionId);
      const members = team ? [...team.users].filter(user => formation.memberUnitIds.includes(user.player.logicalUnitId ?? "") && user.player.active) : [];
      const center = members.length ? members.reduce((sum, user) => ({ x: sum.x + user.player.x / members.length, y: sum.y + user.player.y / members.length }), { x: 0, y: 0 }) : undefined;
      const options = cities.filter(city => !city.destroyed && city.ownerFactionId !== formation.factionId && city.ownerTeam?.status === "ACTIVE" &&
        Diplomacy.canAttack(formation.factionId, city.ownerFactionId, worldMonth))
        .sort((a, b) => {
          if (!center) return a.id.localeCompare(b.id);
          const distance = (city: City) => Math.hypot(city.block.x - center.x, city.block.y - center.y);
          return distance(a) - distance(b) || a.id.localeCompare(b.id);
        });
      const nearest = options[0];
      const person = this.people.get(formation.commanderPersonId);
      const distance = (city: City) => center ? Math.hypot(city.block.x - center.x, city.block.y - center.y) : Infinity;
      const nearbyCapital = center && nearest ? options.find(city => city.isCapital && city.ownerTeam?.capitalCity === city &&
        distance(city) <= distance(nearest) * 1.15 && distance(city) - distance(nearest) <= 32) : undefined;
      const next = nearbyCapital && nearbyCapital !== nearest && person && this.getCareer(person, worldMonth).verifiedCaptures > 0 ? nearbyCapital : nearest;
      if (next) {
        if (formation.targetCityId !== next.id) {
          this.lastArrivalTargetByCommand.delete(formation.commandId);
          this.longRangeOrderSamples.delete(formation.commandId);
        }
        formation.targetCityId = next.id;
        formation.orderStartMonth = worldMonth;
        this.diagnostics.orders++;
        this.eventWriter?.({ id: `military-order-${formation.commandId}-${worldMonth}-${next.id}`, year: worldMonth, monthIndex: worldMonth,
          type: "military-order-issued", category: "war", title: "军事编组确定目标", importance: "normal",
          factionIds: [formation.factionId, next.ownerFactionId], actorFactionId: formation.factionId, targetFactionId: next.ownerFactionId,
          cityId: next.id, cityName: next.name, metadata: { commandId: formation.commandId, personId: formation.commanderPersonId, personalName: person?.personalName,
            meritInfluenced: next !== nearest ? 1 : 0, nearestCityId: nearest?.id, nearestDistance: center && nearest ? distance(nearest) : undefined,
            targetWasCapital: next.isCapital && next.ownerTeam?.capitalCity === next ? 1 : 0,
            targetDistance: center ? distance(next) : undefined } });
      } else { formation.targetCityId = undefined; formation.orderStartMonth = undefined; }
    }
  }

  private observeLongRangeOrders(worldMonth: number, teams: Team[], cities: City[]) {
    const activeCommandIds = new Set([...this.formations.values()].filter(formation => formation.status === "ACTIVE").map(formation => formation.commandId));
    for (const commandId of this.longRangeOrderSamples.keys()) if (!activeCommandIds.has(commandId)) this.longRangeOrderSamples.delete(commandId);
    for (const commandId of this.lastArrivalTargetByCommand.keys()) if (!activeCommandIds.has(commandId)) this.lastArrivalTargetByCommand.delete(commandId);
    const cityById = new Map(cities.map(city => [city.id, city]));
    for (const formation of this.formations.values()) {
      if (formation.status !== "ACTIVE" || !formation.targetCityId || formation.orderStartMonth === undefined) continue;
      const age = worldMonth - formation.orderStartMonth;
      if (age < 120 || age % 120 !== 0) continue;
      const target = cityById.get(formation.targetCityId);
      const team = teams.find(candidate => candidate.name === formation.factionId);
      const members = team ? [...team.users].filter(user => formation.memberUnitIds.includes(user.player.logicalUnitId ?? "") && user.player.active) : [];
      if (!target || !members.length) continue;
      const nearestMemberDistance = Math.min(...members.map(user => Math.hypot(target.block.x - user.player.x, target.block.y - user.player.y)));
      const previousDistance = this.longRangeOrderSamples.get(formation.commandId);
      if (nearestMemberDistance > 8 * 32 && previousDistance !== undefined && previousDistance - nearestMemberDistance < 32) {
        this.diagnostics.staleOrderChecks++;
      }
      this.longRangeOrderSamples.set(formation.commandId, nearestMemberDistance);
    }
  }

  steerActiveUnits(worldMonth: number, core: import("../Game/Core").default) {
    if (core.logicalGameplayAuthority) return;
    const cityById = new Map(core.allCities.map(city => [city.id, city]));
    for (const formation of this.formations.values()) {
      if (formation.status !== "ACTIVE" || !formation.targetCityId) continue;
      const target = cityById.get(formation.targetCityId);
      if (!target || target.destroyed || target.ownerFactionId === formation.factionId || !Diplomacy.canAttack(formation.factionId, target.ownerFactionId, worldMonth)) continue;
      for (const unitId of formation.memberUnitIds) {
        const entry = core.logicalUnitRegistry.getEntry(unitId);
        const player = entry?.player;
        if (!player?.active || entry?.state.factionId !== formation.factionId) continue;
        const dx = target.block.x - player.x; const dy = target.block.y - player.y; const length = Math.hypot(dx, dy);
        if (length < 1) continue;
        const body = player.Body;
        const desiredX = dx / length * player.speed; const desiredY = dy / length * player.speed;
        if (Math.abs(body.velocity.x - desiredX) + Math.abs(body.velocity.y - desiredY) > 0.5) this.diagnostics.unitsSteered++;
        const vx = body.velocity.x * 0.92 + desiredX * 0.08; const vy = body.velocity.y * 0.92 + desiredY * 0.08;
        const velocityLength = Math.hypot(vx, vy) || 1;
        body.setVelocity(vx / velocityLength * player.speed, vy / velocityLength * player.speed);
      }
    }
  }

  steerLogicalUnits(worldMonth: number, units: LogicalUnitState[], cities: City[]) {
    const unitById = new Map(units.map(unit => [unit.unitId, unit]));
    const cityById = new Map(cities.map(city => [city.id, city]));
    for (const formation of this.formations.values()) {
      if (formation.status !== "ACTIVE" || !formation.targetCityId) continue;
      const target = cityById.get(formation.targetCityId);
      if (!target || target.destroyed || target.ownerFactionId === formation.factionId || !Diplomacy.canAttack(formation.factionId, target.ownerFactionId, worldMonth)) continue;
      for (const unitId of formation.memberUnitIds) {
        const unit = unitById.get(unitId);
        if (!unit?.alive || unit.factionId !== formation.factionId) continue;
        const dx = target.block.x - unit.logicalX; const dy = target.block.y - unit.logicalY; const length = Math.hypot(dx, dy);
        if (length < 1) continue;
        const desiredX = dx / length * unit.speed; const desiredY = dy / length * unit.speed;
        if (Math.abs(unit.logicalVX - desiredX) + Math.abs(unit.logicalVY - desiredY) > 0.5) this.diagnostics.unitsSteered++;
        const vx = unit.logicalVX * 0.92 + desiredX * 0.08; const vy = unit.logicalVY * 0.92 + desiredY * 0.08;
        const velocityLength = Math.hypot(vx, vy) || 1;
        unit.logicalVX = vx / velocityLength * unit.speed; unit.logicalVY = vy / velocityLength * unit.speed;
      }
    }
  }

  getCommandForUnit(unitId: string) { return [...this.formations.values()].find(f => f.status === "ACTIVE" && f.memberUnitIds.includes(unitId)); }
  getPerson(personId: string) { return this.people.get(personId); }

  recordCommandSiegeContact(commandId?: string, commanderPersonId?: string, cityId?: string) {
    if (!commandId || !commanderPersonId) return;
    const formation = this.formations.get(commandId);
    if (formation?.status === "ACTIVE" && formation.commanderPersonId === commanderPersonId) {
      this.diagnostics.commandedSiegeContacts++;
      if (formation.targetCityId && formation.targetCityId === cityId && this.lastArrivalTargetByCommand.get(commandId) !== formation.targetCityId) {
        this.lastArrivalTargetByCommand.set(commandId, formation.targetCityId);
        this.diagnostics.targetCityArrivals++;
      }
    }
  }

  onUserTransfer(user: User, nextFactionId: string, worldMonth: number) {
    const person = user.militaryPersonId ? this.people.get(user.militaryPersonId) : undefined;
    const unitId = user.player.logicalUnitId;
    if (unitId) for (const formation of this.formations.values()) {
      if (formation.status !== "ACTIVE" || !formation.memberUnitIds.includes(unitId)) continue;
      if (person && formation.commanderPersonId === person.personId) this.endFormation(formation, worldMonth, "TRANSFERRED");
      else {
        formation.memberUnitIds = formation.memberUnitIds.filter(id => id !== unitId);
        if (formation.memberUnitIds.length < 2) this.endFormation(formation, worldMonth, "DISMISSED");
      }
    }
    if (person && person.status !== "DEAD") person.factionId = nextFactionId;
  }

  onUserDestroyed(user: User, worldMonth: number, cause: string) {
    const record = user.militaryPersonId ? this.people.get(user.militaryPersonId) : undefined;
    const person = record?.sourceUserId === user.id && record.bornMonth === user.bornMonth && record.name === user.name && record.factionId === user.team.name ? record : undefined;
    if (cause === "NATURAL_DEATH" && (!person || worldMonth % 12 !== 0 || worldMonth < deriveMilitaryLifeSchedule(person).naturalDeathMonth)) return;
    const death = cause === "SIEGE_LOSS" || cause === "BATTLE_DEATH" || cause === "NATURAL_DEATH";
    const unitId = user.player.logicalUnitId;
    if (unitId) for (const formation of this.formations.values()) if (formation.status === "ACTIVE" && formation.memberUnitIds.includes(unitId)) {
      if (person && formation.commanderPersonId === person.personId) this.endFormation(formation, worldMonth, death ? "DEATH" : "DISMISSED");
      else {
        formation.memberUnitIds = formation.memberUnitIds.filter(id => id !== unitId);
        if (formation.memberUnitIds.length < 2) this.endFormation(formation, worldMonth, "DISMISSED");
      }
    }
    if (!person || person.status === "DEAD") return;
    if (death) {
      person.status = "DEAD"; person.deathMonth = worldMonth; person.deathCause = cause; this.diagnostics.deaths++;
      if (cause === "NATURAL_DEATH") this.diagnostics.naturalDeaths++;
      this.eventWriter?.({ id: `military-person-death-${person.personId}-${worldMonth}`, year: worldMonth, monthIndex: worldMonth,
        category: "politics", type: "military-person-died", title: cause === "NATURAL_DEATH" ? `${getMilitaryPersonDisplayName(person)}自然去世` : `${getMilitaryPersonDisplayName(person)}去世`, factionIds: [person.factionId], actorFactionId: person.factionId,
        metadata: { personId: person.personId, sourceUserId: person.sourceUserId, personalName: person.personalName, deathCause: cause }, importance: "normal" });
    } else if (person.status === "ACTIVE") person.status = "RETIRED";
  }

  getCaptureIdentity(commandId: string | undefined, personId: string | undefined, factionId: string, worldMonth: number) {
    const formation = commandId ? this.formations.get(commandId) : undefined;
    const person = personId ? this.people.get(personId) : undefined;
    return formation?.status === "ACTIVE" && person?.status === "ACTIVE" && formation.commanderPersonId === person.personId &&
      formation.factionId === factionId && person.factionId === factionId && person.deathMonth === undefined &&
      person.appointments.some(a => a.commandId === commandId && a.factionId === factionId && a.startMonth <= worldMonth && a.endMonth === undefined)
      ? person.personalName : undefined;
  }

  recordCapture(commandId: string | undefined, eventId: string, cityId: string, worldMonth: number) {
    if (!commandId) return;
    const formation = this.formations.get(commandId);
    const person = formation ? this.people.get(formation.commanderPersonId) : undefined;
    if (!formation || formation.status !== "ACTIVE" || !person || person.status !== "ACTIVE" || (person.deathMonth !== undefined && worldMonth > person.deathMonth) || person.capturedEventIds.includes(eventId)) return;
    formation.captures.push({ eventId, cityId, month: worldMonth });
    person.capturedEventIds.push(eventId); this.diagnostics.captures++;
  }

  reconcileFactionEnd(factionId: string, worldMonth: number) {
    for (const formation of this.formations.values()) if (formation.factionId === factionId && formation.status === "ACTIVE") this.endFormation(formation, worldMonth, "FACTION_ENDED");
  }
}

const MilitaryCommandRegistry = new MilitaryCommandRegistryStore();
export default MilitaryCommandRegistry;
