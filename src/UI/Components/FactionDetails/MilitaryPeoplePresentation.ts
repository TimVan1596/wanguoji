import type { MilitaryPerson } from "../../../Politics/MilitaryCommandRegistry";


export function getMilitaryPersonRelevantMonth(person: MilitaryPerson) {
  return person.appointments.reduce((latest, appointment) =>
    Math.max(latest, appointment.startMonth, appointment.endMonth ?? -1), person.deathMonth ?? -1);
}

export function sortMilitaryPeople(people: MilitaryPerson[],factionId?:string) {
  const first=(p:MilitaryPerson)=>Math.min(...p.appointments.filter(a=>!factionId||a.factionId===factionId).map(a=>a.startMonth));
  return [...people].sort((a,b)=>first(a)-first(b)||a.personId.localeCompare(b.personId));
}

export function describeMilitaryDeathCause(cause?: string) {
  switch (cause) {
    case "NATURAL_DEATH": return "自然去世（NATURAL_DEATH）";
    case "SIEGE_LOSS": return "围城战损（SIEGE_LOSS）";
    case "BATTLE_DEATH": return "战斗损失（BATTLE_DEATH）";
    default: return cause ?? "原因未记录";
  }
}


export function describeMilitaryStatus(person: MilitaryPerson) {
  return person.status === "ACTIVE" ? "现役指挥官" : person.status === "DEAD" ? "已故" :
    person.appointments.at(-1)?.endReason === "AGE_RETIREMENT" ? "已退役（年老）" : "已离任";
}
export function describeMilitaryAppointmentEnd(reason?: string) {
  return ({ AGE_RETIREMENT: "年老退役", DISMISSED: "解除任职", TRANSFERRED: "转属离任", FACTION_ENDED: "国家失去在国指挥资格", DEATH: "实际死亡" } as Record<string, string>)[reason ?? ""] ?? "任职中";
}


export function describeMilitaryAge(person: MilitaryPerson, worldMonth: number, verifiedLive: boolean) {
  const age = Math.floor(Math.max(0, (person.deathMonth ?? worldMonth) - person.bornMonth) / 12);
  return person.status === "DEAD" ? `享年 ${age} 岁` : verifiedLive ? `年龄 ${age} 岁` : `生死未载`;
}
