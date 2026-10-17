import { getLocalUserId } from "../Live/LocalUserIdentity";

/** Presentation only. Never rename User/name snapshots or change identity hashes.
 * Generated population labels have no recorded personal name; do not invent one.
 * The original label remains available separately for provenance, also after death.
 */
export function isPopulationIdentityLabel(name: string) {
  return /^(?:Heaven|God|Rebel|Split|Restored|Restore)-.+-\d+(?:-\d+)?$/.test(name) ||
    /^.+-\d{3,}$/.test(name);
}

export function getMilitaryPersonDisplayName(person: { name: string; personId: string; sourceUserId?: number; personalName?: string }) {
  if (person.personalName?.trim()) return person.personalName;
  // An external person's genuine nickname can also contain '-123'. The local
  // ID range is necessary evidence; do not suppress a verified external name.
  const localIdentity = person.sourceUserId === undefined ||
    (person.sourceUserId >= 1000000000 && person.sourceUserId <= 1999999999);
  if (person.name.trim() && (!isPopulationIdentityLabel(person.name) || !localIdentity)) return person.name;
  // personId distinguishes unnamed people without suggesting a fictitious name.
  return `姓名未核验的指挥者〔${person.personId}〕`;
}

export function describeMilitaryNameEvidence(person: {name:string;sourceUserId:number;personalName?:string}) {
  if (person.personalName && person.personalName !== person.name) return "游戏世界生成姓名；首次任职时确立，与原User身份分别保存";
  return isPopulationIdentityLabel(person.name) && person.sourceUserId === getLocalUserId(person.name) ?
    "人口生成格式及本地User哈希吻合；未另存真实姓名" :
    isPopulationIdentityLabel(person.name) && person.sourceUserId>=1000000000 ?
      "人口格式标签；来源存在碰撞或缺口，姓名待核验" : "沿用原User记录的名称";
}

/** Old V15 events retain their raw text, but generated labels are not presented
 * as personal names. Only typed military events with a person reference qualify.
 * No registry/live User lookup: death, transfer and loading cannot change this.
 */
export function formatMilitaryHistoryIdentity(event: {type:string; title:string; metadata?:Record<string,unknown>}, text = event.title) {
  const personId=event.metadata?.personId;
  if(typeof personId!=="string") return text;
  let raw: string | undefined;
  if(event.type==="military-appointment") raw=event.title.match(/任命(.+)为军事指挥者$/)?.[1];
  if(event.type==="military-command-ended") raw=event.title.match(/^(.+)(?:年老退役|结束军事任职)$/)?.[1];
  if(event.type==="military-person-died") raw=event.title.match(/^(.+?)(?:自然去世|去世)$/)?.[1];
  const sourceUserId=typeof event.metadata?.sourceUserId==="number"?event.metadata.sourceUserId:undefined;
  return raw && isPopulationIdentityLabel(raw) ? text.split(raw).join(getMilitaryPersonDisplayName({name:raw,personId,sourceUserId})) : text;
}
