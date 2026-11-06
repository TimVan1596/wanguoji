import type {Ruler} from './Dynasty';
import type {MilitaryFamily} from './MilitaryFamily';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
import {rulerFamilyOrigin} from './RulerFamilyOrigin';
import {NOBLE_NAMES,NOBLE_RANKS} from './MilitaryNobility';
/** Only ancestry and grants verifiable before the real founding; no new history event. */
export function rulerFamilyBackground(r:Ruler,families:readonly MilitaryFamily[],people:readonly MilitaryPerson[],events:readonly WorldEvent[]){
 const month=r.residentIdentity?.foundedMonth;if(month===undefined)return;
 const origin=rulerFamilyOrigin(r,families,people,month);if(!origin)return;
 const {family,member}=origin,byId=new Map(family.members.map(m=>[m.memberId,m])),order=new Map(events.map((e,i)=>[e.id,i])),boundary=events.findIndex(e=>e.type==='ruler-acceded'&&e.rulerId===r.id);
 if(boundary<0)return;const past=(id:string)=>order.has(id)&&order.get(id)!<boundary;
 const seen=new Set([member.memberId]);let current=member,distance=0,ancestor:typeof member|undefined;
 while(current.parentMemberId){const parent=byId.get(current.parentMemberId);if(!parent||seen.has(parent.memberId)||parent.enteredMonth>month||parent.source!=='FOUNDER'&&!past(`${parent.memberId}-entered`))return;seen.add(parent.memberId);current=parent;distance++;ancestor=parent;}
 if(!ancestor||ancestor.memberId!==family.members[0].memberId)return;
 const founder=people.find(p=>p.personId===ancestor!.militaryPersonId&&p.sourceUserId===ancestor!.sourceUserId&&p.bornMonth===ancestor!.bornMonth),grant=founder?.nobilityHistory?.filter(g=>g.month<=month&&past(g.eventId)&&events.some(e=>e.id===g.eventId&&e.metadata?.nobility===JSON.stringify(g))).sort((a,b)=>NOBLE_RANKS.indexOf(b.rank)-NOBLE_RANKS.indexOf(a.rank))[0];
 if(!grant)return;const relation=['','父亲','祖父','曾祖','高祖'][distance]??`上溯${distance}代的先人`,oldEnded=family.nobleSuccession?.filter(a=>a.month<=month&&past(a.eventId)).at(-1)?.kind==='ENDED';
 return `${member.name}出自${family.surname}氏，其${relation}${ancestor.name}曾受${grant.countryName}${NOBLE_NAMES[grant.rank]}${oldEnded?'，该期旧爵在起事前已断袭':''}。`;
}
