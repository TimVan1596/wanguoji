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
  endReason?: "DISMISSED" | "TRANSFERRED" | "FACTION_ENDED" | "DEATH";
  commandId: string;
}

export interface MilitaryPerson {
  personId: string;
  sourceUserId: number;
  name: string;
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
  private eventWriter?: (event: Omit<WorldEvent, "id"> & { id: string }) => string;
  private diagnostics = { candidates: 0, eligible: 0, appointments: 0, capBlocked: 0, unitBlocked: 0, orders: 0, captures: 0, deaths: 0 };

  reset() {
    this.people.clear(); this.formations.clear(); this.personSequence = 1; this.commandSequence = 1;
    this.lastEvaluationMonth = -1;
    this.diagnostics = { candidates: 0, eligible: 0, appointments: 0, capBlocked: 0, unitBlocked: 0, orders: 0, captures: 0, deaths: 0 };
  }

  setEventWriter(writer: (event: Omit<WorldEvent, "id"> & { id: string }) => string) { this.eventWriter = writer; }

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
    this.diagnostics = { candidates: 0, eligible: 0, appointments: 0, capBlocked: 0, unitBlocked: 0, orders: 0, captures: 0, deaths: 0 };
  }

  getPeople() { return [...this.people.values()]; }
  getFormations() { return [...this.formations.values()]; }
  getDiagnostics() { return { ...this.diagnostics, activeCommanders: [...this.people.values()].filter(p => p.status === "ACTIVE").length,
    activeFormations: [...this.formations.values()].filter(f => f.status === "ACTIVE").length }; }

  update(worldMonth: number, teams: Team[], cities: City[]) {
    this.reconcile(worldMonth, teams);
    this.refreshOrders(worldMonth, cities);
    if (worldMonth % 12 !== 0 || worldMonth === this.lastEvaluationMonth) return;
    this.lastEvaluationMonth = worldMonth;
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
      const candidate = candidates[worldRandom.pickIndex(candidates.length)];
      const members = [candidate, ...availableUnits.filter(user => user !== candidate)].slice(0, MAX_FORMATION_UNITS);
      if (members.length < 2 || !candidate.player.logicalUnitId) { this.diagnostics.unitBlocked++; continue; }
      this.appoint(candidate, team.name, worldMonth, members.map(user => user.player.logicalUnitId!));
      this.diagnostics.appointments++;
      this.refreshOrders(worldMonth, cities);
    }
  }

  private isEligible(user: User, worldMonth: number) {
    return user.role === "NORMAL" && user.team.status === "ACTIVE" && user.bornMonth <= worldMonth - MIN_COMMANDER_AGE_MONTHS &&
      Boolean(user.player.active && user.player.logicalUnitId) && !this.isUnitAssigned(user.player.logicalUnitId!) &&
      (!user.militaryPersonId || this.people.get(user.militaryPersonId)?.status !== "ACTIVE");
  }

  private appoint(user: User, factionId: string, worldMonth: number, memberUnitIds: string[]) {
    let person = user.militaryPersonId ? this.people.get(user.militaryPersonId) : undefined;
    if (person?.status === "DEAD") return false;
    const personId = person?.personId ?? `military-person-${this.personSequence++}`;
    const commandId = `military-command-${this.commandSequence++}`;
    if (!person) {
      person = { personId, sourceUserId: user.id, name: user.name, bornMonth: user.bornMonth, factionId,
        status: "ACTIVE", appointments: [], capturedEventIds: [] };
      this.people.set(personId, person);
      user.militaryPersonId = personId;
    }
    person.factionId = factionId; person.status = "ACTIVE";
    person.appointments.push({ factionId, startMonth: worldMonth, commandId });
    this.formations.set(commandId, { commandId, factionId, commanderPersonId: personId,
      memberUnitIds: [...new Set(memberUnitIds)], createdMonth: worldMonth, status: "ACTIVE", captures: [] });
    this.eventWriter?.({ id: `military-appointment-${commandId}`, year: worldMonth, monthIndex: worldMonth,
      category: "politics", type: "military-appointment", title: `${factionId}任命${person.name}为军事指挥者`,
      description: `${person.name}由既有人口任职，指挥${memberUnitIds.length}个现存单位。`, factionIds: [factionId], actorFactionId: factionId,
      metadata: { personId, commandId, unitCount: memberUnitIds.length }, importance: "normal" });
    return true;
  }

  private isUnitAssigned(unitId: string) { return [...this.formations.values()].some(f => f.status === "ACTIVE" && f.memberUnitIds.includes(unitId)); }

  private reconcile(worldMonth: number, teams: Team[]) {
    const teamById = new Map(teams.map(team => [team.name, team]));
    for (const formation of this.formations.values()) {
      if (formation.status !== "ACTIVE") continue;
      const team = teamById.get(formation.factionId);
      const person = this.people.get(formation.commanderPersonId);
      const commander = team && person ? [...team.users].find(user => user.id === person.sourceUserId && user.militaryPersonId === person.personId && user.role === "NORMAL") : undefined;
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
    formation.status = "DISBANDED"; formation.targetCityId = undefined; formation.orderStartMonth = undefined;
    const person = this.people.get(formation.commanderPersonId);
    const appointment = person?.appointments.find(item => item.commandId === formation.commandId && item.endMonth === undefined);
    if (appointment) { appointment.endMonth = worldMonth; appointment.endReason = reason; }
    if (person && person.status !== "DEAD") person.status = "RETIRED";
    if (person) this.eventWriter?.({ id: `military-command-ended-${formation.commandId}`, year: worldMonth, monthIndex: worldMonth,
      category: "politics", type: "military-command-ended", title: `${person.name}结束军事任职`, factionIds: [formation.factionId],
      actorFactionId: formation.factionId, metadata: { personId: person.personId, commandId: formation.commandId, endReason: reason }, importance: "normal" });
  }

  private refreshOrders(worldMonth: number, cities: City[]) {
    for (const formation of this.formations.values()) {
      if (formation.status !== "ACTIVE") continue;
      const current = cities.find(city => city.id === formation.targetCityId);
      if (current && current.ownerFactionId !== formation.factionId && Diplomacy.canAttack(formation.factionId, current.ownerFactionId, worldMonth)) continue;
      const options = cities.filter(city => city.ownerFactionId !== formation.factionId && city.ownerTeam?.status === "ACTIVE" &&
        Diplomacy.canAttack(formation.factionId, city.ownerFactionId, worldMonth))
        .sort((a, b) => a.id.localeCompare(b.id));
      const next = options[0];
      if (next) {
        formation.targetCityId = next.id;
        formation.orderStartMonth = worldMonth;
        this.diagnostics.orders++;
      } else { formation.targetCityId = undefined; formation.orderStartMonth = undefined; }
    }
  }

  steerActiveUnits(worldMonth: number, core: import("../Game/Core").default) {
    if (core.logicalGameplayAuthority) return;
    const cityById = new Map(core.allCities.map(city => [city.id, city]));
    for (const formation of this.formations.values()) {
      if (formation.status !== "ACTIVE" || !formation.targetCityId) continue;
      const target = cityById.get(formation.targetCityId);
      if (!target || target.ownerFactionId === formation.factionId || !Diplomacy.canAttack(formation.factionId, target.ownerFactionId, worldMonth)) continue;
      for (const unitId of formation.memberUnitIds) {
        const entry = core.logicalUnitRegistry.getEntry(unitId);
        const player = entry?.player;
        if (!player?.active || entry?.state.factionId !== formation.factionId) continue;
        const dx = target.block.x - player.x; const dy = target.block.y - player.y; const length = Math.hypot(dx, dy);
        if (length < 1) continue;
        const body = player.Body;
        const desiredX = dx / length * player.speed; const desiredY = dy / length * player.speed;
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
      if (!target || target.ownerFactionId === formation.factionId || !Diplomacy.canAttack(formation.factionId, target.ownerFactionId, worldMonth)) continue;
      for (const unitId of formation.memberUnitIds) {
        const unit = unitById.get(unitId);
        if (!unit?.alive || unit.factionId !== formation.factionId) continue;
        const dx = target.block.x - unit.logicalX; const dy = target.block.y - unit.logicalY; const length = Math.hypot(dx, dy);
        if (length < 1) continue;
        const desiredX = dx / length * unit.speed; const desiredY = dy / length * unit.speed;
        const vx = unit.logicalVX * 0.92 + desiredX * 0.08; const vy = unit.logicalVY * 0.92 + desiredY * 0.08;
        const velocityLength = Math.hypot(vx, vy) || 1;
        unit.logicalVX = vx / velocityLength * unit.speed; unit.logicalVY = vy / velocityLength * unit.speed;
      }
    }
  }

  getCommandForUnit(unitId: string) { return [...this.formations.values()].find(f => f.status === "ACTIVE" && f.memberUnitIds.includes(unitId)); }
  getPerson(personId: string) { return this.people.get(personId); }

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
    const person = user.militaryPersonId ? this.people.get(user.militaryPersonId) : undefined;
    const death = cause === "SIEGE_LOSS" || cause === "BATTLE_DEATH";
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
      this.eventWriter?.({ id: `military-person-death-${person.personId}-${worldMonth}`, year: worldMonth, monthIndex: worldMonth,
        category: "politics", type: "military-person-died", title: `${person.name}去世`, factionIds: [person.factionId], actorFactionId: person.factionId,
        metadata: { personId: person.personId, deathCause: cause }, importance: "normal" });
    } else if (person.status === "ACTIVE") person.status = "RETIRED";
  }

  recordCapture(commandId: string | undefined, eventId: string, cityId: string, worldMonth: number) {
    if (!commandId) return;
    const formation = this.formations.get(commandId);
    const person = formation ? this.people.get(formation.commanderPersonId) : undefined;
    if (!formation || formation.status !== "ACTIVE" || !person) return;
    formation.captures.push({ eventId, cityId, month: worldMonth });
    person.capturedEventIds.push(eventId); this.diagnostics.captures++;
  }

  reconcileFactionEnd(factionId: string, worldMonth: number) {
    for (const formation of this.formations.values()) if (formation.factionId === factionId && formation.status === "ACTIVE") this.endFormation(formation, worldMonth, "FACTION_ENDED");
  }
}

const MilitaryCommandRegistry = new MilitaryCommandRegistryStore();
export default MilitaryCommandRegistry;
