import {expect,it} from 'vitest';
import {deriveMilitaryActivities} from './MilitaryExperience';
const p:any={personId:'p',bornMonth:-300,appointments:[{factionId:'a',commandId:'f',startMonth:0}]};
const f:any=[{commandId:'f',factionId:'a',commanderPersonId:'p'}];
const siege=(id:string,start=1,end=8,extra:any={})=>[
 {id:'start-'+id,type:'siege-started',year:start,cityId:'city',actorFactionId:'a',targetFactionId:'d',metadata:{battleId:id,commandId:'f',personId:'p',attackers:1}},
 {id:'end-'+id,type:'siege-ended',year:end,cityId:'city',actorFactionId:'a',targetFactionId:'d',metadata:{battleId:id,commandId:'f',personId:'p',attackers:1,reason:'CONTACT_ENDED',...extra}}
] as any[];
it('requires verified sustained contact and deduplicates the same appointment and city',()=>{
 expect(deriveMilitaryActivities(p,f,siege('short',1,2),100,[])).toEqual([]);
 const events=[...siege('one'),...siege('again',12,20)];expect(deriveMilitaryActivities(p,f,events,100,[])).toEqual([{eventId:'end-one',cityId:'city',commandId:'f',factionId:'a',worldMonth:8,kind:'SIEGE'}]);
 expect(deriveMilitaryActivities(p,f,[{id:'order',type:'military-order-issued',year:5,cityId:'city',actorFactionId:'a',metadata:{commandId:'f',personId:'p'}}] as any,100,[])).toEqual([]);
});
it.each(['personId','commandId','actorFactionId','cityId'])('rejects mismatched %s source instead of crediting nationwide warfare',field=>{
 const e=siege('wrong');if(field==='personId'||field==='commandId')e[1].metadata[field]='wrong';else e[1][field]='wrong';
 expect(deriveMilitaryActivities(p,f,e,100,[])).toEqual([]);
});
it('a defence requires a real matching repulse with local defenders and the right commanding identity',()=>{
 const e=siege('defence',1,8,{reason:'REPULSED',defenders:2});for(const x of e){x.actorFactionId='d';x.targetFactionId='a';}
 const d:any={id:'defended',type:'siege-defended',year:8,cityId:'city',actorFactionId:'a',targetFactionId:'d',metadata:{battleId:'defence',personId:'p',commandId:'f',defenders:2}};
 expect(deriveMilitaryActivities(p,f,[...e,d],100,[])).toEqual([{eventId:'defended',cityId:'city',commandId:'f',factionId:'a',worldMonth:8,kind:'DEFENSE'}]);e[1].metadata.reason='CONTACT_ENDED';expect(deriveMilitaryActivities(p,f,[...e,d],100,[])).toEqual([]);
});
