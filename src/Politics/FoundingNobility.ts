import type {MilitaryPerson,MilitaryFormation} from './MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
import type {Dynasty} from './Dynasty';
import {currentNobleGrant,deriveNobleMerits,nobleEpochForRuler,type NobleGrant} from './MilitaryNobility';
import {unresolvedCourtBans} from './MilitaryCourtStanding';
import {formatRulerTitleAtMonth} from './RulerTitleRules';
import {getHistoricalFactionIdentity} from '../History/HistoricalFactionIdentity';
const at=(e:WorldEvent)=>e.monthIndex??e.year;
/** First annual reward window within twelve months; two actual pre-state captures, including an enemy capital.
 * One deterministic award per real state foundation, no lottery and no restoration award. */
export function selectFoundingNobleGrant(people:readonly MilitaryPerson[],formations:readonly MilitaryFormation[],events:readonly WorldEvent[],month:number,team:any,dy:Dynasty):NobleGrant|undefined{
 if(month%12!==0||team.status!=='ACTIVE'||team.identityStage!=='STATE'||team.stateFoundedMonth===undefined||team.origin?.type==='INITIAL')return;
 const r=dy.rulers.find(r=>r.id===dy.currentRulerId),epoch=nobleEpochForRuler(dy,dy.currentRulerId),foundation=events.find(e=>e.type==='state-founded'&&e.actorFactionId===team.name&&at(e)===team.stateFoundedMonth);
 if(!r||r.status!=='ruling'||r.endYear!==undefined||r.deathMonth!==undefined||(r.naturalDeathYear??Infinity)<=month||!epoch||!foundation||foundation.rulerId!==r.id||at(foundation)>month||month-at(foundation)>=12||events.some(e=>e.type==='founding-peerage-granted'&&e.metadata?.foundingEventId===foundation.id))return;
 const prior=events.slice(0,events.indexOf(foundation)),start=Math.max(team.origin?.foundedMonth??0,at(foundation)-120);
 const candidates=people.flatMap(p=>{
  if(p.status!=='ACTIVE'||p.factionId!==team.name||p.deathMonth!==undefined||p.royalIdentity||p.politicalRulerId||currentNobleGrant(p,team.name,month,epoch.foundingRulerId)||unresolvedCourtBans(p,team.name,month,epoch.foundingRulerId).length||(p.nobilityHistory??[]).some(g=>g.month===month||g.foundingEventId===foundation.id))return [];
  const a=p.appointments.find(a=>a.factionId===team.name&&a.endMonth===undefined&&a.startMonth<=at(foundation)),command=a&&formations.find(f=>!f.leaderDuty&&f.commandId===a.commandId&&f.commanderPersonId===p.personId&&f.factionId===team.name&&f.status==='ACTIVE'&&f.memberUnitIds.length>0),office=a?.officeHistory?.filter(o=>o.month<=month).at(-1)?.office;
  if(!a||!command||!office)return [];
  const merits=deriveNobleMerits(p,formations as MilitaryFormation[],prior as WorldEvent[],team.name,at(foundation)),ids=new Set(merits.captureEventIds),wins=prior.filter(e=>ids.has(e.id)&&at(e)>=start&&['city-captured','city-recovered','capital-fallen'].includes(e.type)),cities=new Set(wins.map(e=>e.cityId)),capitals=wins.filter(e=>e.metadata?.wasCapital===1);
  if(cities.size<2||!capitals.length)return [];
  const grant:NobleGrant={basis:'FOUNDING',foundingEventId:foundation.id,foundingMeritEventIds:wins.map(e=>e.id),eventId:`${foundation.id}-peerage`,personId:p.personId,sourceUserId:p.sourceUserId,bornMonth:p.bornMonth,personalName:p.personalName,factionId:team.name,countryName:getHistoricalFactionIdentity(team,month).name,epochFounderId:epoch.foundingRulerId,rulerId:r.id,rulerTitle:formatRulerTitleAtMonth(team,`${r.houseName.replace(/氏$/,'')}${r.givenName}`,month),month,previousRank:'NONE',rank:'BO',commandId:a.commandId,office,serviceMonths:0,captureEventIds:[],cityIds:[],importantCityIds:[],importantEventIds:[]};
  return [{grant,capitals:capitals.length,cities:cities.size}];
 });
 return candidates.sort((a,b)=>b.capitals-a.capitals||b.cities-a.cities||a.grant.personId.localeCompare(b.grant.personId))[0]?.grant;
}
