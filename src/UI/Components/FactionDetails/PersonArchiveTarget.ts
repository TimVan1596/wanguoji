export type PersonArchiveTarget={kind:"RULER"|"MILITARY"|"GENEALOGY"|"FAMILY";factionId:string;id:string;memberId?:string};
/** Historical factions are valid destinations; names/status are never identity keys. */
export function resolvePersonArchiveTarget(target:PersonArchiveTarget,factions:readonly {name:string}[],dynasties:readonly {factionId:string;rulers:readonly {id:string;reignOrdinal?:number;militaryIdentity?:unknown}[]}[],people:readonly {personId:string;appointments:readonly {factionId:string}[]}[],families:readonly {familyId:string;factionId:string;members:readonly {memberId:string;militaryPersonId?:string}[]}[]=[]){
 if(!factions.some(f=>f.name===target.factionId))return undefined;
 if(target.kind==='FAMILY'){const f=families.find(f=>f.familyId===target.id);return f&&(f.factionId===target.factionId||f.members.some(m=>people.some(p=>p.personId===m.militaryPersonId&&p.appointments.some(a=>a.factionId===target.factionId))))&&(!target.memberId||f.members.some(m=>m.memberId===target.memberId))?{...target,tab:'military' as const}:undefined;}
 const valid=target.kind!=="MILITARY"?dynasties.find(d=>d.factionId===target.factionId)?.rulers.some(r=>r.id===target.id&&(target.kind==="GENEALOGY"||r.reignOrdinal!==undefined||r.militaryIdentity!==undefined)):people.find(p=>p.personId===target.id)?.appointments.some(a=>a.factionId===target.factionId);
 return valid?{...target,tab:target.kind!=="MILITARY"?"house" as const:"military" as const}:undefined;
}
