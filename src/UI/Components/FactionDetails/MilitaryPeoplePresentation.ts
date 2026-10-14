import type { MilitaryPerson } from "../../../Politics/MilitaryCommandRegistry";

const STATUS_ORDER: Record<MilitaryPerson["status"], number> = {
  ACTIVE: 0,
  RETIRED: 1,
  DEAD: 2,
};

export function getMilitaryPersonRelevantMonth(person: MilitaryPerson) {
  return person.appointments.reduce((latest, appointment) =>
    Math.max(latest, appointment.startMonth, appointment.endMonth ?? -1), person.deathMonth ?? -1);
}

export function sortMilitaryPeople(people: MilitaryPerson[]) {
  return people.map(person => ({ person, relevantMonth: getMilitaryPersonRelevantMonth(person) }))
    .sort((a, b) => STATUS_ORDER[a.person.status] - STATUS_ORDER[b.person.status] ||
      b.relevantMonth - a.relevantMonth || a.person.personId.localeCompare(b.person.personId))
    .map(row => row.person);
}

export function describeMilitaryDeathCause(cause?: string) {
  switch (cause) {
    case "SIEGE_LOSS": return "围城战损（SIEGE_LOSS）";
    case "BATTLE_DEATH": return "战斗损失（BATTLE_DEATH）";
    default: return cause ?? "原因未记录";
  }
}
