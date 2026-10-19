import type { MilitaryPerson,MilitaryFormation } from "../../../Politics/MilitaryCommandRegistry";


export function getMilitaryPersonRelevantMonth(person: MilitaryPerson) {
  return person.appointments.reduce((latest, appointment) =>
    Math.max(latest, appointment.startMonth, appointment.endMonth ?? -1), person.deathMonth ?? -1);
}

/** Dates belong to this country's appointment history; later foreign service/death is irrelevant. */
export function sortMilitaryPeople(people:MilitaryPerson[],factionId?:string){
  const dates=(p:MilitaryPerson)=>{
    const local=p.appointments.filter(a=>!factionId||a.factionId===factionId);
    return {end:Math.max(-1,...local.flatMap(a=>a.endMonth===undefined?[]:[a.endMonth])),start:Math.max(-1,...local.map(a=>a.startMonth))};
  };
  const rows=people.filter(p=>!factionId||p.appointments.some(a=>a.factionId===factionId)).map(person=>({person,...dates(person)}));
  return rows.sort((a,b)=>b.end-a.end||b.start-a.start||a.person.personId.localeCompare(b.person.personId)).map(r=>r.person);
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


/** All current and historical rows are available without navigation or a second click. */
export function getMilitaryArchive(people:MilitaryPerson[],factionId:string,formations:MilitaryFormation[],liveIds:Set<string>){
  const ordered=sortMilitaryPeople(people,factionId);
  const currentPeople=ordered.filter(p=>p.factionId===factionId&&p.status==="ACTIVE"&&liveIds.has(p.personId)&&formations.some(f=>f.status==="ACTIVE"&&f.commanderPersonId===p.personId&&f.factionId===factionId));
  const historicalPeople=ordered.filter(p=>!currentPeople.includes(p));
  return {currentPeople,historicalPeople,visiblePeople:[...currentPeople,...historicalPeople]};
}
