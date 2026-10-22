import {expect,it} from 'vitest';
import {militaryPoliticalLife} from './MilitaryPoliticalLife';
import {selectMilitaryMilestones} from './MilitaryChroniclePresentation';
function fixture(){
 const r:any={id:'son',bornYear:-240,naturalDeathYear:800,accessionYear:100,reignOrdinal:2,militaryIdentity:{personId:'p',sourceUserId:1,sourceUserLabel:'原名',enteredMonth:0}};
 const p:any={personId:'p',sourceUserId:1,name:'原名',personalName:'秦继',bornMonth:-240,politicalRulerId:'son',status:'RETIRED',royalIdentity:{rulerId:'son',factionId:'qin',naturalDeathMonth:800},appointments:[{commandId:'c',factionId:'qin',startMonth:0,endMonth:100,endReason:'DISMISSED'}]};
 const d:any={factionId:'qin',rulers:[r]},events:any[]=[{id:'a',type:'military-appointment',year:0,actorFactionId:'qin',metadata:{personId:'p',royalRulerId:'son',sourceUserId:1,commandId:'c'}},{id:'s',type:'ruler-succession',year:100,actorFactionId:'qin',metadata:{nextRulerId:'son',rulerPoliticalTitle:'王'}}];
 const factions:any=new Map([['qin',{name:'qin',displayName:'后国号',identityStage:'STATE',stateFoundedMonth:0,sovereigntyRank:'EMPEROR',nameHistory:[{name:'秦',startMonth:0,endMonth:200},{name:'后国号',startMonth:200}],sovereigntyHistory:[{rank:'KING',startMonth:0,endMonth:200},{rank:'EMPEROR',startMonth:200}]}]]);return {r,p,d,events,factions};
}
it.each(['ruler-succession','ruler-deposed','ruler-acceded'])('projects the same permanent person and real %s event using the historical title',type=>{
 const {r,p,d,events,factions}=fixture();events[1].type=type;if(type==='ruler-acceded')events[1].rulerId=r.id;
 const before=JSON.stringify({r,p,d,events}),result=militaryPoliticalLife(p,[d],events,factions,300)!;
 expect(result.entry.worldMonth).toBe(100);expect(result.entry.text).toBe('秦继继位为秦王。');expect(result.entry.victory).toBe(false);expect(result.rulerId).toBe('son');expect(JSON.stringify({r,p,d,events})).toBe(before);
 expect(selectMilitaryMilestones([result.entry],events)).toEqual([result.entry]);
});
it.each(['birth','source','military-id','event-id','event-month','foreign','missing-event','political-id','future'])('does not invent a political transition from %s',mode=>{
 const {p,d,r,events,factions}=fixture();if(mode==='birth')r.bornYear--;if(mode==='source')p.sourceUserId++;if(mode==='military-id')r.militaryIdentity.personId='copied';if(mode==='event-id')events[1].metadata.nextRulerId='other';if(mode==='event-month')events[1].year++;if(mode==='foreign')events[1].actorFactionId='wei';if(mode==='missing-event')events.pop();if(mode==='political-id')p.politicalRulerId='ordinary-general';
 expect(militaryPoliticalLife(p,[d],events,factions,mode==='future'?99:300)).toBeUndefined();
});
it('uses recorded historical rank when a source event has no explicit title',()=>{
 const {p,d,events,factions}=fixture();delete events[1].metadata.rulerPoliticalTitle;
 expect(militaryPoliticalLife(p,[d],events,factions,300)?.entry.text).toContain('秦王');
});
it('does not backdate later accession into an earlier dismissal',()=>{
 const {p,d,events,factions}=fixture();p.appointments[0].endMonth=40;const result=militaryPoliticalLife(p,[d],events,factions,300)!;
 expect(result.entry.worldMonth).toBe(100);expect(result.entry.text).not.toContain('结束');
});
