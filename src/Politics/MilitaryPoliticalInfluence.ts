import type { MilitaryPerson, MilitaryFormation } from "./MilitaryCommandRegistry";
import type { WorldEvent } from "../History/WorldHistory";
import { deriveMilitaryCareer } from "./MilitaryCareerEvidence";
import { deriveMilitaryLifeSchedule } from "./MilitaryLifeRules";
import { formatWorldDate } from "../Simulation/WorldTime";
import { getMilitaryPersonDisplayName } from "./MilitaryPersonIdentity";

export interface MilitaryPoliticalUser {
  userId: number; name: string; bornMonth: number; factionId: string; personId?: string;
  unitId?: string; liveBindingVerified: boolean;
}
export interface MilitaryPoliticalParticipant {
  personId: string; sourceUserId: number; name: string; personalName?: string; bornMonth: number; factionId: string;
  commandId: string; commanderUnitId: string; memberUnitIds: string[]; unitCount: number;
  serviceMonths: number; capturedEventIds: string[]; strength: number;
}
export interface MilitaryPoliticalEvidence {
  candidates: MilitaryPoliticalParticipant[]; blocked: Array<{ personId: string; reason: string }>; identityBlocked: number;
}
export function militaryPoliticalStrength(serviceMonths: number, unitCount: number, victories: number) {
  return { eligible: serviceMonths >= 60 && unitCount >= 4 || serviceMonths >= 12 && victories > 0,
    strength: Math.min(3, Math.max(1, Math.floor(serviceMonths / 60) + Math.floor(unitCount / 4) + Math.min(2, victories))) };
}

/** Pure qualification. Runtime supplies verified User/player/logical-unit bindings, not UI state. */
export function deriveMilitaryPoliticalInfluence(input: {
  factionId: string; status: string; identityStage: string; worldMonth: number; people: MilitaryPerson[]; formations: MilitaryFormation[];
  users: MilitaryPoliticalUser[]; events: WorldEvent[];
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
    if (members.length < 2 || members.length > 12 || !members.includes(u.unitId)) { block(p.personId, "NO_VALID_MEMBERS"); continue; }
    const career = deriveMilitaryCareer(p, formations, events, worldMonth);
    const experience = militaryPoliticalStrength(career.serviceMonths, members.length, career.verifiedCaptures);
    if (!experience.eligible) { block(p.personId, "INSUFFICIENT_CAREER"); continue; }
    candidates.push({ personId: p.personId, sourceUserId: p.sourceUserId, name: p.name, personalName: p.personalName, bornMonth: p.bornMonth, factionId,
      commandId: f.commandId, commanderUnitId: u.unitId, memberUnitIds: members, unitCount: members.length,
      serviceMonths: career.serviceMonths, capturedEventIds: career.capturedEventIds.slice().sort(),
      strength: experience.strength });
  }
  candidates.sort((a, b) => b.strength - a.strength || b.capturedEventIds.length - a.capturedEventIds.length || b.serviceMonths - a.serviceMonths || a.personId.localeCompare(b.personId));
  return { candidates, blocked, identityBlocked: blocked.filter(b => b.reason.includes("IDENTITY")).length };
}

export interface MilitaryPoliticalParticipation {
  version: 1; kind: "DEPOSITION" | "REVOLUTION"; factionId: string; worldMonth: number;
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
    ? { militaryParticipation: JSON.stringify({ version: 1, kind, factionId, worldMonth, participant,
      crisisEventIds: [...new Set(crisisEventIds)].sort(), crisisFacts, baselineChance, finalChance, roll, politicalContext } satisfies MilitaryPoliticalParticipation) } : {};
}
export function readMilitaryParticipation(event: WorldEvent): MilitaryPoliticalParticipation | undefined {
  if (!["ruler-deposed", "dynasty-usurped"].includes(event.type) || typeof event.metadata?.militaryParticipation !== "string") return undefined;
  try {
    const p = JSON.parse(event.metadata.militaryParticipation);
    return p?.version === 1 && p.factionId === event.actorFactionId && p.worldMonth === (event.monthIndex ?? event.year) &&
      p.kind === (event.type === "ruler-deposed" ? "DEPOSITION" : "REVOLUTION") && p.participant && typeof p.participant.name === "string" &&
      typeof p.participant.personId === "string" && typeof p.participant.commandId === "string" && Array.isArray(p.participant.memberUnitIds) &&
      Number.isSafeInteger(p.participant.unitCount) && Array.isArray(p.participant.capturedEventIds) && Array.isArray(p.crisisFacts) && Array.isArray(p.crisisEventIds) && p.finalChance > p.baselineChance &&
      p.roll >= 0 && p.roll < p.finalChance ? p : undefined;
  } catch { return undefined; }
}
export function formatMilitaryParticipation(event: WorldEvent) {
  const p = readMilitaryParticipation(event);
  return p ? `${getMilitaryPersonDisplayName(p.participant)}统兵参与${p.kind === "DEPOSITION" ? "王室废立" : "继统政治压力"}（当时${p.participant.unitCount}人；军事参与者并非新君）` : undefined;
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
    `核验任职 ${p.participant.serviceMonths}个月；核验攻城 ${p.participant.capturedEventIds.length}次；活动成员 ${p.participant.memberUnitIds.join("、")}`,
    `危机证据：${p.crisisFacts.map(f => `${formatWorldDate(f.worldMonth)} ${f.title}（${f.eventId}）`).join("；") || "前君真实暴力死亡与继统政治脆弱性"}`,
    `同次单抽签风险 ${(p.baselineChance * 100).toFixed(2)}% → ${(p.finalChance * 100).toFixed(2)}%；${p.roll >= p.baselineChance ? "本次落在新增压力区间" : "军事压力已加入，原基线亦可命中"}`] : [];
}

export function describeMilitaryPoliticalBlock(reason?: string) {
  return ({ FOREIGN_IDENTITY: "非本国人物", NOT_FORMAL_ACTIVE_STATE: "非在国正式国家", DUPLICATE_IDENTITY: "人物身份重复",
    NOT_ACTIVE: "非现役或已有死亡记录", RETIREMENT_AGE: "已到退休年龄", USER_IDENTITY: "原User与逻辑单位绑定未核验",
    NO_ACTIVE_COMMAND: "无唯一合法活动编组", NO_VALID_MEMBERS: "有效成员不足或编组引用冲突",
    INSUFFICIENT_CAREER: "尚无足够实际任职、带兵或战果资历" } as Record<string, string>)[reason ?? ""] ?? "无本国实时军权";
}
