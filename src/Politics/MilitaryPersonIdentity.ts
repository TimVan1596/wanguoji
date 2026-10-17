/** Presentation only. Never rename User/name snapshots or change identity hashes.
 * Generated population labels have no recorded personal name; do not invent one.
 * The original label remains available separately for provenance, also after death.
 */
export function isPopulationIdentityLabel(name: string) {
  return /^(?:Heaven|God|Rebel|Split|Restored|Restore)-.+-\d+(?:-\d+)?$/.test(name) ||
    /^.+-\d{3,}$/.test(name);
}

export function getMilitaryPersonDisplayName(person: { name: string; personId: string; sourceUserId?: number }) {
  if (person.name.trim() && !isPopulationIdentityLabel(person.name)) return person.name;
  // personId distinguishes unnamed people without suggesting a fictitious name.
  return `姓名未核验的指挥者〔${person.personId}〕`;
}

/** Old V15 events retain their raw text, but generated labels are not presented
 * as personal names. Only typed military events with a person reference qualify.
 * No registry/live User lookup: death, transfer and loading cannot change this.
 */
export function formatMilitaryHistoryIdentity(event: {type:string; title:string; metadata?:Record<string,unknown>}) {
  const personId=event.metadata?.personId;
  if(typeof personId!=="string") return event.title;
  let raw: string | undefined;
  if(event.type==="military-appointment") raw=event.title.match(/任命(.+)为军事指挥者$/)?.[1];
  if(event.type==="military-command-ended") raw=event.title.match(/^(.+)(?:年老退役|结束军事任职)$/)?.[1];
  if(event.type==="military-person-died") raw=event.title.match(/^(.+?)(?:自然去世|去世)$/)?.[1];
  return raw && isPopulationIdentityLabel(raw) ? event.title.replace(raw,getMilitaryPersonDisplayName({name:raw,personId})) : event.title;
}
