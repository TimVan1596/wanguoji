export type PersonArchiveTarget={kind:"RULER"|"MILITARY";factionId:string;id:string};
/** Historical factions are valid destinations; names/status are never identity keys. */
export function resolvePersonArchiveTarget(target:PersonArchiveTarget,factions:readonly {name:string}[],dynasties:readonly {factionId:string;rulers:readonly {id:string;reignOrdinal?:number;militaryIdentity?:unknown}[]}[],people:readonly {personId:string;appointments:readonly {factionId:string}[]}[]){
 if(!factions.some(f=>f.name===target.factionId))return undefined;
 const valid=target.kind==="RULER"?dynasties.find(d=>d.factionId===target.factionId)?.rulers.some(r=>r.id===target.id&&(r.reignOrdinal!==undefined||r.militaryIdentity!==undefined)):people.find(p=>p.personId===target.id)?.appointments.some(a=>a.factionId===target.factionId);
 return valid?{...target,tab:target.kind==="RULER"?"house" as const:"military" as const}:undefined;
}
