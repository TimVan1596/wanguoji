import type { MilitaryPerson } from "../../../Politics/MilitaryCommandRegistry";

const STATUS_ORDER: Record<MilitaryPerson["status"], number> = {
  ACTIVE: 0,
  RETIRED: 1,
  DEAD: 2,
};

export function getMilitaryPersonRelevantMonth(person: MilitaryPerson) {
  return Math.max(
    person.deathMonth ?? -1,
    ...person.appointments.flatMap(appointment => [appointment.startMonth, appointment.endMonth ?? -1])
  );
}

export function sortMilitaryPeople(people: MilitaryPerson[]) {
  return [...people].sort((a, b) =>
    STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
    getMilitaryPersonRelevantMonth(b) - getMilitaryPersonRelevantMonth(a) ||
    a.personId.localeCompare(b.personId)
  );
}

export function describeMilitaryDeathCause(cause?: string) {
  switch (cause) {
    case "SIEGE_LOSS": return "围城战损";
    case "BATTLE_DEATH": return "战斗损失";
    default: return cause ?? "原因未记录";
  }
}
