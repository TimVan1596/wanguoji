import type {WorldSaveV1} from "./WorldSaveSchema";

/** Validate DTO references only, never read or initialize the live registries. */
export function validateRoyalMilitaryIdentities(save: WorldSaveV1): string[] {
  const errors: string[] = [];
  const records = save.dynasties.flatMap(d => Array.isArray(d?.rulers) ? d.rulers.map(r => ({d,r})) : []);
  const people = save.registries?.militaryCommandRegistry?.people;
  if (!Array.isArray(people)) return errors;
  const linked = new Set<string>(), sources = new Set<number>();
  for (const {d,r} of records) {
    const i = r?.militaryIdentity;
    if (i === undefined) continue;
    const p = people.find(p => p?.personId === i?.personId);
    if (!i || !p || linked.has(i.personId) || sources.has(i.sourceUserId) || r.residentIdentity ||
      !Number.isSafeInteger(i.sourceUserId) || typeof i.sourceUserLabel !== "string" || !i.sourceUserLabel ||
      !Number.isSafeInteger(i.enteredMonth) || i.enteredMonth > Number(save.world?.worldMonth) || i.enteredMonth < r.bornMonth + 216 ||
      !r.parentId || !(d.rulers as any[]).some(parent => parent?.rulerId === r.parentId) ||
      p.sourceUserId !== i.sourceUserId || p.name !== i.sourceUserLabel || p.personalName !== (typeof r.houseName === "string" ? r.houseName.replace(/氏$/,"") : "") + r.givenName ||
      p.bornMonth !== r.bornMonth || !p.royalIdentity || p.royalIdentity.rulerId !== r.rulerId || p.royalIdentity.factionId !== d.factionId ||
      !Number.isSafeInteger(r.naturalDeathMonth) || p.royalIdentity.naturalDeathMonth !== r.naturalDeathMonth || r.naturalDeathMonth! <= i.enteredMonth ||
      p.appointments?.[0]?.factionId !== d.factionId || p.appointments?.[0]?.startMonth !== i.enteredMonth ||
      r.deathMonth !== p.deathMonth || (r.status === "dead") !== (p.status === "DEAD") ||
      (r.reignOrdinal !== undefined && (p.status === "ACTIVE" || p.politicalRulerId !== r.rulerId)) ||
      (r.reignOrdinal === undefined && p.politicalRulerId !== undefined)) {
      errors.push("royal military identity, kinship, service or unique life mismatch"); continue;
    }
    linked.add(i.personId); sources.add(i.sourceUserId);
    const bindings = save.users.filter(u => u && (u.historicalPersonId === i.personId || u.militaryPersonId === i.personId || u.userId === i.sourceUserId));
    if (bindings.length > 1) errors.push("royal military person has duplicate live bodies");
    for (const u of bindings) if (r.deathMonth !== undefined || u.historicalPersonId !== i.personId || u.militaryPersonId !== i.personId ||
      u.userId !== i.sourceUserId || u.name !== i.sourceUserLabel || u.bornMonth !== r.bornMonth ||
      (u.role === "RULER" && (u.rulerId !== r.rulerId || u.factionId !== d.factionId || d.currentRulerId !== r.rulerId || r.status !== "ruling")))
      errors.push("royal military life/entity mismatch");
    if (!(save.worldHistory.events as any[]).some((e:any) => e?.type === "military-appointment" && e.metadata?.personId === i.personId && e.metadata?.sourceUserId === i.sourceUserId && e.actorFactionId === d.factionId && (e.monthIndex??e.year) === i.enteredMonth))
      errors.push("royal military person lacks first service evidence");
  }
  for (const p of people) if (p?.royalIdentity !== undefined && !linked.has(p.personId)) errors.push("military royal link has no unique royal owner");
  return errors;
}
