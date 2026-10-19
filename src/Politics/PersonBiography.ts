import type {RulerHistoricalEvidence} from "./RulerHistoriography";
import {summarizeRulerPoliticalFacts} from "./RulerPoliticalFacts";
import type {MilitaryPerson} from "./MilitaryCommandRegistry";
import type {MilitaryChronicleEntry} from "./MilitaryChronicle";
import {getMilitaryPersonDisplayName} from "./MilitaryPersonIdentity";
import {formatWorldDate,formatWorldDuration} from "../Simulation/WorldTime";

/** Read-only narrative projections. No titles, new historical facts or RNG. */
export function composeRulerBiography(e:RulerHistoricalEvidence,name:string,accessionMonth:number){
  const stats=summarizeRulerPoliticalFacts(e.politicalFacts);
  const life=[`${name}于${formatWorldDate(accessionMonth)}${e.tenure.exiledAtAccession?"承接流亡王统":"即位"}。`];
  if(e.tenure.activeRuleMonths===0&&e.tenure.exileMonths>0)life.push(`承统${formatWorldDuration(e.reignMonths)}，未有在国治理时期。`);
  else life.push(`${e.isFinalized?"其任期":"截至目前"}${formatWorldDuration(e.reignMonths)}${e.tenure.exileMonths>0?`，其中在国${formatWorldDuration(e.tenure.activeRuleMonths)}、流亡${formatWorldDuration(e.tenure.exileMonths)}`:""}。`);
  if(e.restorationCount>0)life.push(`任内经历国家复国${e.restorationCount}次。`);
  if(e.hasRecordedDeath&&e.deathMonth!==undefined)life.push(`${formatWorldDate(e.deathMonth)}${e.deathReason??"去世"}${e.finalAge!==undefined?`，享年${e.finalAge}岁`:""}。`);
  else if(e.endReason)life.push(`君主任期以${e.endReason}告终；生命结局另依死亡记录。`);
  const assessment:string[]=[];
  if(e.tenure.activeRuleMonths===0&&e.tenure.exileMonths>0)assessment.push("其世以流亡承统为主，未有在国施政之实。");
  else if(e.trajectory.expandedThenRetreated)assessment.push(`任内疆域曾经扩张，随后回落；论其世，当兼察前后兴衰与${e.isFinalized?"任期终局":"目前国势"}。`);
  else if(e.trajectory.inheritedDecline)assessment.push("承统时疆域已居高位，任内国势回落，前代积累与后来的变化应分别看待。");
  else if(e.territoryDelta>0&&e.cityDelta>=0)assessment.push("任内领土有所拓展，城邑规模亦未缩减；国势有所进益。");
  else if(e.territoryDelta<0)assessment.push("任内领土收缩；城邑亦屡经争夺。");
  if(stats.crisisEpisodes>0)assessment.push("其世曾历失都、迁都或分裂等政治危机；国势多有波折。");
  if(stats.personalCityCaptures>0)assessment.push("亲征取城，亦见于其生平。");
  if(e.predeceasedHeirCount>0)assessment.push("任内有继承候选先逝的记录，继统经历亦有波折。");
  if(!assessment.length)assessment.push("其世事迹所载尚简。");
  let voice:string|undefined;
  if(e.hasRecordedDeath&&e.tenure.activeRuleMonths>0){
    if(e.restorationCount>0)voice="城土复得，是其承统经历的重要转折；复国与其后的治理，仍当分别衡量。";
    else if(e.trajectory.expandedThenRetreated)voice="论其世，既不可独举一时之盛，亦不宜只据终局抹去此前经历。";
    else if(stats.crisisEpisodes>0&&e.reignMonths>=60)voice="身逢多事之世，其世兴衰，不可独以一役论。";
  }
  return {life,assessment:assessment.slice(0,3),voice,stats};
}

export function composeMilitaryBiography(person:MilitaryPerson,entries:MilitaryChronicleEntry[],factionId:string){
  const name=getMilitaryPersonDisplayName(person),appointments=person.appointments.filter(a=>a.factionId===factionId);
  const life:string[]=[];
  if(appointments.length)life.push(`${name}于${formatWorldDate(appointments[0].startMonth)}始任本国军职。`);
  const factions=[...new Set(person.appointments.map(a=>a.factionId))];
  if(factions.length>1)life.push(`生涯曾在${factions.join("、")}任职。`);
  const victories=entries.filter(e=>e.victory);
  const ending=person.status==="DEAD"&&person.deathMonth!==undefined
    ? `${formatWorldDate(person.deathMonth)}${person.deathCause==="NATURAL_DEATH"?"自然去世":person.deathCause==="SIEGE_LOSS"?"在战乱中去世":person.deathCause==="BATTLE_DEATH"?"因战伤亡":"去世"}。`
    : person.status!=="ACTIVE"&&person.appointments.at(-1)?.endReason==="AGE_RETIREMENT"?"年老退职。":undefined;
  const assessment=victories.length?"其所部曾参与攻取城邑，军旅功业见于任内战事。"
    : entries.some(e=>e.source.startsWith("military-order-issued"))?"曾受命出征，尚未见所部攻城之功。":"军旅事迹所载尚少。";
  return {life,ending,assessment,victories,voice:person.status==="DEAD"&&victories.length>=2?"其名留于军旅，所部之功见于城邑得失。":undefined};
}
