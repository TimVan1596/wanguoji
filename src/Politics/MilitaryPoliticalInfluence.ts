import {depositionSelectionLines} from "./DepositionSelectionPresentation";
import {militaryDisposition, willingCourtParticipant, type MilitaryDisposition} from "./MilitaryPoliticalDisposition";
import {localMilitaryCareer} from "../Simulation/MilitaryLocalRules";
import {MILITARY_OFFICE_NAMES,MILITARY_FORMATION_CAPACITY,type MilitaryOffice} from './MilitaryOffice';
import {deriveMilitaryActivities} from './MilitaryExperience';
import {currentNobleGrant,NOBLE_RANKS,type NobleRank,NOBLE_NAMES} from "./MilitaryNobility";
import type { MilitaryPerson, MilitaryFormation } from "./MilitaryCommandRegistry";
import type { WorldEvent } from "../History/WorldHistory";
import { deriveMilitaryCareer } from "./MilitaryCareerEvidence";
import { deriveMilitaryLifeSchedule } from "./MilitaryLifeRules";
import { formatWorldDate } from "../Simulation/WorldTime";
import { getMilitaryPersonDisplayName } from "./MilitaryPersonIdentity";

export interface MilitaryPoliticalUser {
  userId: number; name: string; bornMonth: number; factionId: string; personId?: string;
  loyalty?: number; unitId?: string; liveBindingVerified: boolean;
}
export const ENABLE_NOBILITY_POLITICAL_WEIGHT = true;
export interface MilitaryPoliticalParticipant {
  disposition?: MilitaryDisposition; politicalSelectionWeight?: number;
  officeStanding?:{office:MilitaryOffice;eventId:string;appointmentEventId:string};
  nobility?:{eventId:string;rank:NobleRank;countryName:string};basePoliticalWeight?:number;finalPoliticalWeight?:number;
  nobleSelection?:{scopeFounderId:string;candidates:Array<Omit<MilitaryPoliticalParticipant,"nobleSelection">>};
  personId: string; sourceUserId: number; name: string; personalName?: string; bornMonth: number; factionId: string;
  commandId: string; commanderUnitId: string; memberUnitIds: string[]; unitCount: number;
  serviceMonths: number; capturedEventIds: string[]; defenseEventIds?:string[]; strength: number;
}
export interface MilitaryPoliticalEvidence {
  candidates: MilitaryPoliticalParticipant[]; blocked: Array<{ personId: string; reason: string }>; identityBlocked: number;
}
export function militaryPoliticalStrength(serviceMonths: number, unitCount: number, victories: number,defenses=0,localServiceMonths=serviceMonths) {
  return { eligible: serviceMonths >= 60 && unitCount >= 4 || serviceMonths >= 12 && victories > 0 || localServiceMonths>=96&&unitCount>=2&&defenses>0,
    strength: Math.min(3, Math.max(1, Math.floor(serviceMonths / 60) + Math.floor(unitCount / 4) + Math.min(2, victories))) };
}

export const MILITARY_OFFICE_POLITICAL_BONUS:Record<MilitaryOffice,number>={XIAOWEI:0,PIJIANG:.03,JIANGJUN:.06,SHANGJIANGJUN:.10};
/** Appointment and office must both precede the political transaction in the same real command. */
export function verifiedPoliticalOffice(p:MilitaryPerson,commandId:string,factionId:string,month:number,events:readonly WorldEvent[]){
 const a=p.appointments.find(a=>a.commandId===commandId&&a.factionId===factionId&&a.startMonth<=month&&month<=(a.endMonth??month));
 const byId=new Map(events.map(e=>[e.id,e])),g=a?.officeHistory?.filter(g=>g.month<=month&&byId.has(g.eventId)).at(-1),e=g&&byId.get(g.eventId);
 const initial=a&&events.find(e=>e.type==='military-appointment'&&e.actorFactionId===factionId&&(e.monthIndex??e.year)===a.startMonth&&e.metadata?.personId===p.personId&&e.metadata?.commandId===commandId);
 if(!a||!g||!e||!initial||!(g.office in MILITARY_OFFICE_POLITICAL_BONUS)||e.type!=='military-office-granted'||e.actorFactionId!==factionId||e.metadata?.personId!==p.personId||e.metadata?.commandId!==commandId||e.metadata?.office!==g.office||(e.monthIndex??e.year)!==g.month)return;
 return {office:g.office,eventId:g.eventId,appointmentEventId:initial.id};
}

/** Only same-country defense with an actual repulse and bound command; orders and failed sieges do not qualify. */
export function militaryPoliticalDefense(p:MilitaryPerson,formations:MilitaryFormation[],events:WorldEvent[],month:number,factionId:string){
 const local={...p,appointments:p.appointments.filter(a=>a.factionId===factionId)};
 const spans=local.appointments.map(a=>[a.startMonth,Math.min(a.endMonth??month,p.deathMonth??month,month)]).filter(([a,b])=>a<=b).sort((a,b)=>a[0]-b[0]);let service=0,end=-Infinity;
 for(const [a,b]of spans){service+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}
 return {localServiceMonths:service,eventIds:deriveMilitaryActivities(local,formations,events,month,[],true).filter(a=>a.kind==='DEFENSE').map(a=>a.eventId).sort()};
}
/** Pure qualification. Runtime supplies verified User/player/logical-unit bindings, not UI state. */
export function deriveMilitaryPoliticalInfluence(input: {
  royalClaims?:boolean; localSecession?:boolean; factionId: string; status: string; identityStage: string; worldMonth: number; people: MilitaryPerson[]; formations: MilitaryFormation[];
  users: MilitaryPoliticalUser[]; events: WorldEvent[];nobleEpochFounderId?:string;
}): MilitaryPoliticalEvidence {
  const { factionId, worldMonth, people, formations, users, events } = input;
  const candidates: MilitaryPoliticalParticipant[] = [], blocked: MilitaryPoliticalEvidence["blocked"] = [];
  const block = (personId: string, reason: string) => { blocked.push({ personId, reason }); };
  for (const p of people) {
    if (p.factionId !== factionId && !users.some(u => u.personId === p.personId)) continue;
    if (p.factionId !== factionId) { block(p.personId, "FOREIGN_IDENTITY"); continue; }
    if (input.status !== "ACTIVE" || input.identityStage !== "STATE") { block(p.personId, "NOT_FORMAL_ACTIVE_STATE"); continue; }
    if (people.filter(other => other.personId === p.personId || other.sourceUserId === p.sourceUserId && other.status === "ACTIVE").length !== 1) { block(p.personId, "DUPLICATE_IDENTITY"); continue; }
    if (p.status !== "ACTIVE" || p.deathMonth !== undefined || p.deathCause !== undefined) { block(p.personId, "NOT_ACTIVE"); continue; }
    if (worldMonth >= deriveMilitaryLifeSchedule(p).retirementMonth) { block(p.personId, "RETIREMENT_AGE"); continue; }
    const matches = users.filter(u => u.personId === p.personId || u.userId === p.sourceUserId);
    const u = matches.length === 1 ? matches[0] : undefined;
    if (!u || !u.liveBindingVerified || u.personId !== p.personId || u.userId !== p.sourceUserId || u.name !== p.name ||
        u.bornMonth !== p.bornMonth || u.factionId !== factionId || !u.unitId) { block(p.personId, "USER_IDENTITY"); continue; }
    const commands = formations.filter(f => f.status === "ACTIVE" && f.commanderPersonId === p.personId);
    const f = commands.length === 1 ? commands[0] : undefined;
    if (!f || f.factionId !== factionId || !p.appointments.some(a => a.commandId === f.commandId && a.factionId === factionId && a.startMonth <= worldMonth && a.endMonth === undefined)) { block(p.personId, "NO_ACTIVE_COMMAND"); continue; }
    const members = [...new Set(f.memberUnitIds)].filter(id => users.filter(member => member.unitId === id && member.liveBindingVerified && member.factionId === factionId).length === 1 &&
      formations.filter(other => other.status === "ACTIVE" && other.memberUnitIds.includes(id)).length === 1).sort();
    if (members.length < 1 || members.length > 4 || !members.includes(u.unitId)) { block(p.personId, "NO_VALID_MEMBERS"); continue; }
    const career = deriveMilitaryCareer(p, formations, events, worldMonth);
    const defense=militaryPoliticalDefense(p,formations,events,worldMonth,factionId);
    const experience = militaryPoliticalStrength(career.serviceMonths, members.length, career.verifiedCaptures,defense.eventIds.length,defense.localServiceMonths);
    const appointment=p.appointments.find(a=>a.commandId===f.commandId&&a.endMonth===undefined)!;
    const eligible=input.localSecession?localMilitaryCareer(worldMonth-appointment.startMonth,members.length,career.activities.filter(a=>a.factionId===factionId).length,career.verifiedCaptures,defense.eventIds.length):experience.eligible;
    if (!eligible) { block(p.personId, "INSUFFICIENT_CAREER"); continue; }
    candidates.push({ personId: p.personId, sourceUserId: p.sourceUserId, name: p.name, personalName: p.personalName, bornMonth: p.bornMonth, factionId,
      commandId: f.commandId, commanderUnitId: u.unitId, memberUnitIds: members, unitCount: members.length,
      serviceMonths: career.serviceMonths, capturedEventIds: career.capturedEventIds.slice().sort(),
      ...(defense.eventIds.length?{defenseEventIds:defense.eventIds}:{}),strength: experience.strength });
  }
  // Real User loyalty is read once. No synthetic loyalty field or world RNG is introduced.
  const applyDisposition=(c:MilitaryPoliticalParticipant)=>{
    const loyalty=users.find(u=>u.userId===c.sourceUserId&&u.personId===c.personId)?.loyalty;
    if(loyalty!==undefined&&Number.isFinite(loyalty)&&loyalty>=0&&loyalty<=100){
      c.disposition=militaryDisposition(c.personId,c.bornMonth,loyalty,c.finalPoliticalWeight??c.strength);
      c.politicalSelectionWeight=(c.finalPoliticalWeight??c.strength)*c.disposition.contestWeight;
    }
  };
  const filterContinuity=()=>{if(!input.localSecession&&!input.royalClaims)for(let i=candidates.length-1;i>=0;i--){const c=candidates[i];if(c.disposition&&!willingCourtParticipant(c.disposition)){block(c.personId,'SUPPORTS_CONTINUITY');candidates.splice(i,1);}}};
  if(input.nobleEpochFounderId){
    for(const c of candidates){const p=people.find(p=>p.personId===c.personId)!,office=verifiedPoliticalOffice(p,c.commandId,factionId,worldMonth,events);
      if(office&&c.unitCount<=MILITARY_FORMATION_CAPACITY[office.office])c.officeStanding=office;
      const g=ENABLE_NOBILITY_POLITICAL_WEIGHT?currentNobleGrant(p,factionId,worldMonth,input.nobleEpochFounderId):undefined;
      if(g&&events.some(e=>e.id===g.eventId&&e.type==='military-ennobled'&&e.metadata?.nobility===JSON.stringify(g)))c.nobility={eventId:g.eventId,rank:g.rank,countryName:g.countryName};
    }
    if(candidates.some(c=>c.nobility||c.officeStanding)){
      for(const c of candidates){const office=c.officeStanding?MILITARY_OFFICE_POLITICAL_BONUS[c.officeStanding.office]:0,noble=c.nobility?(NOBLE_RANKS.indexOf(c.nobility.rank)+1)*.05:0;c.basePoliticalWeight=c.strength*(1+office);c.finalPoliticalWeight=c.strength*(1+office+noble);}
      candidates.forEach(applyDisposition);filterContinuity();
      candidates.sort(compareMilitaryStanding);
      const snapshot=structuredClone(candidates);for(const c of candidates)c.nobleSelection={scopeFounderId:input.nobleEpochFounderId,candidates:snapshot};
      return {candidates,blocked,identityBlocked:blocked.filter(b=>b.reason.includes('IDENTITY')).length};
    }
  }
  candidates.forEach(applyDisposition);filterContinuity();
  candidates.sort(compareMilitaryStanding);
  return { candidates, blocked, identityBlocked: blocked.filter(b => b.reason.includes("IDENTITY")).length };
}

export function compareMilitaryStanding(a:MilitaryPoliticalParticipant,b:MilitaryPoliticalParticipant){return (b.politicalSelectionWeight??b.finalPoliticalWeight??b.strength)-(a.politicalSelectionWeight??a.finalPoliticalWeight??a.strength)||b.capturedEventIds.length-a.capturedEventIds.length||b.serviceMonths-a.serviceMonths||a.personId.localeCompare(b.personId);}

export interface MilitaryPoliticalParticipation {
  version: 1|2|3; kind: "DEPOSITION" | "REVOLUTION"; factionId: string; worldMonth: number;
  participant: MilitaryPoliticalParticipant; crisisEventIds: string[]; baselineChance: number; finalChance: number; roll: number;
  politicalContext: { stability: number; cityCount: number; riskTier?: string };
  crisisFacts: Array<{ eventId: string; worldMonth: number; title: string }>;
}
export function militaryParticipationMetadata(kind: MilitaryPoliticalParticipation["kind"], factionId: string, worldMonth: number,
  participant: MilitaryPoliticalParticipant | undefined, crisisEventIds: string[], baselineChance: number, finalChance: number, roll: number | undefined,
  politicalContext: MilitaryPoliticalParticipation["politicalContext"], events: readonly WorldEvent[]) {
  const crisisFacts = [...new Set(crisisEventIds)].sort().flatMap(id => {
    const event = events.find(e => e.id === id);
    return event ? [{ eventId: id, worldMonth: event.monthIndex ?? event.year, title: event.title }] : [];
  });
  return participant && finalChance > baselineChance && roll !== undefined
    ? { militaryParticipation: JSON.stringify({ version: participant.disposition?3:participant.nobleSelection?.candidates.some(c=>c.officeStanding)?2:1, kind, factionId, worldMonth, participant,
      crisisEventIds: [...new Set(crisisEventIds)].sort(), crisisFacts, baselineChance, finalChance, roll, politicalContext } satisfies MilitaryPoliticalParticipation) } : {};
}
export function readMilitaryParticipation(event: WorldEvent): MilitaryPoliticalParticipation | undefined {
  if (!["ruler-deposed", "dynasty-usurped"].includes(event.type) || typeof event.metadata?.militaryParticipation !== "string") return undefined;
  try {
    const p = JSON.parse(event.metadata.militaryParticipation);
    return [1,2,3].includes(p?.version) && p.factionId === event.actorFactionId && p.worldMonth === (event.monthIndex ?? event.year) &&
      p.kind === (event.type === "ruler-deposed" ? "DEPOSITION" : "REVOLUTION") && p.participant && typeof p.participant.name === "string" &&
      typeof p.participant.personId === "string" && typeof p.participant.commandId === "string" && Array.isArray(p.participant.memberUnitIds) &&
      Number.isSafeInteger(p.participant.unitCount) && Array.isArray(p.participant.capturedEventIds) && Array.isArray(p.crisisFacts) && Array.isArray(p.crisisEventIds) && p.finalChance > p.baselineChance &&
      p.roll >= 0 && p.roll < p.finalChance ? p : undefined;
  } catch { return undefined; }
}
export function formatMilitaryParticipation(event: WorldEvent) {
  const p = readMilitaryParticipation(event);
  const support=depositionSelectionLines(event).find(line=>line.includes('以实际军权支持'));
  return p ? `${getMilitaryPersonDisplayName(p.participant)}${p.participant.officeStanding?`以${MILITARY_OFFICE_NAMES[p.participant.officeStanding.office]}身份`:""}统兵参与${p.kind === "DEPOSITION" ? "王室废立" : "继统政治压力"}（当时${p.participant.unitCount}人；${event.metadata?.militaryUsurperPersonId===p.participant.personId?"本人建立新王统":"军事参与者并非新君"}）${support?`；${support}`:""}` : undefined;
}
export function getMilitaryPoliticalEvents(events: WorldEvent[], personId: string) {
  return events.filter(e => readMilitaryParticipation(e)?.participant.personId === personId)
    .sort((a, b) => (a.monthIndex ?? a.year) - (b.monthIndex ?? b.year) || a.id.localeCompare(b.id));
}

export function getMilitaryParticipationDetails(event: WorldEvent) {
  const p = readMilitaryParticipation(event);
  return p ? [formatMilitaryParticipation(event)!, `人物 ${p.participant.personId} / User ${p.participant.sourceUserId} / 国家 ${p.factionId}`,
    `前君：${event.metadata?.previousRulerName ?? event.metadata?.predecessorRulerName ?? event.metadata?.previousRulerTitle ?? "未记录"}；新君：${event.metadata?.nextRulerName ?? event.metadata?.newRulerName ?? "未记录"}`,
    p.kind === "DEPOSITION" ? "此事是同王统宗室废立，原君主当时仍存活，王统、国号与旗色未变；后续生死另据本人记录。" : `此事是异姓易代，前君${event.metadata?.successionReason === "combat" ? "战死" : event.metadata?.successionReason === "captured" ? "被俘处死" : "去世"}；${event.metadata?.oldHouseName ?? "旧王统"} → ${event.metadata?.newHouseName ?? "新王统"}；国号${event.metadata?.oldStateName ?? "未记录"} → ${event.metadata?.newStateName ?? "未记录"}；${event.metadata?.oldColor === event.metadata?.newColor ? "旗色未变" : "旗色改变"}。`,
    ...(p.participant.nobleSelection?[`参与者选择：${p.participant.nobleSelection.candidates.length}名合格军政人物；军职、爵位与政治取向影响参与者选择；不增加成功抽签。`,...p.participant.nobleSelection.candidates.map(c=>`${c.personalName??c.name}：军权权重 ${(c.basePoliticalWeight?.toFixed(2)??'未载')} → ${(c.finalPoliticalWeight?.toFixed(2)??'未载')}${c.nobility?`（${c.nobility.countryName}${NOBLE_NAMES[c.nobility.rank]}）`:""}`)]:[]),
    ...(p.participant.nobleSelection?.candidates.filter(c=>c.officeStanding).map(c=>`${c.personalName??c.name}：授职依据 ${c.officeStanding!.eventId} / 初任 ${c.officeStanding!.appointmentEventId}；军职选择加成${(MILITARY_OFFICE_POLITICAL_BONUS[c.officeStanding!.office]*100).toFixed(0)}%，与爵位加成相加，合计最多25%；不改变成功概率。`)??[]),
    ...(p.participant.disposition?[`当时政治取向：忠诚${p.participant.disposition.loyalty.toFixed(0)}，野心${p.participant.disposition.ambition}，军权威望${p.participant.disposition.prestige.toFixed(2)}；均为事件发生时的记录，不据此推断其他政治活动。`]:[]),
    `核验任职 ${p.participant.serviceMonths}个月；核验攻城 ${p.participant.capturedEventIds.length}次；活动成员 ${p.participant.memberUnitIds.join("、")}`,
    `危机证据：${p.crisisFacts.map(f => `${formatWorldDate(f.worldMonth)} ${f.title}（${f.eventId}）`).join("；") || "前君真实暴力死亡与继统政治脆弱性"}`,
    `同次单抽签风险 ${(p.baselineChance * 100).toFixed(2)}% → ${(p.finalChance * 100).toFixed(2)}%（军事压力增加${((p.finalChance-p.baselineChance)*100).toFixed(2)}个百分点）；${p.roll >= p.baselineChance ? "本次落在新增压力区间" : "军事压力已加入，原基线亦可命中"}`] : [];
}

export function describeMilitaryPoliticalBlock(reason?: string) {
  return ({ FOREIGN_IDENTITY: "非本国人物", NOT_FORMAL_ACTIVE_STATE: "非在国正式国家", DUPLICATE_IDENTITY: "人物身份重复",
    SUPPORTS_CONTINUITY: "倾向维持原王统，未参与本次政治施压", NOT_ACTIVE: "非现役或已有死亡记录", RETIREMENT_AGE: "已到退休年龄", USER_IDENTITY: "原User与逻辑单位绑定未核验",
    NO_ACTIVE_COMMAND: "无唯一合法活动编组", NO_VALID_MEMBERS: "有效成员不足或编组引用冲突",
    INSUFFICIENT_CAREER: "尚无足够实际任职、带兵或战果资历" } as Record<string, string>)[reason ?? ""] ?? "无本国实时军权";
}
