import {expect,it} from 'vitest';
import {royalHonorHeading} from './RoyalHonorPresentation';
import {deriveGenealogyNodePresentations} from '../UI/Components/FactionDetails/GenealogyNodePresentation';
import {militaryMilestones,selectMilitaryMilestones} from './MilitaryChroniclePresentation';
import {courtServiceReadings} from './CourtServicePresentation';
import {militaryCourtLabels} from './MilitaryCourtStanding';
import {maySucceed} from './RoyalSuccessionStanding';
import random from '../Simulation/WorldRandom';
const event=(id:string,type:string,month:number,metadata:any={})=>({id,type,year:month,monthIndex:month,actorFactionId:'楚',factionIds:['楚'],rulerId:'king',title:id,metadata,category:'politics',importance:'major'}) as any;
function fixture(){const son:any={id:'son',houseName:'熊氏',givenName:'旭',bornYear:-300,status:'kin',parentId:'king',royalHonors:[{eventId:'w',rank:'WUANJUN',month:12,recipientRulerId:'son',recipientName:'熊旭',epochFounderId:'king',factionId:'楚',countryName:'楚'}],successionHistory:[{eventId:'ban',kind:'DISQUALIFIED',month:24}]};const king:any={id:'king',houseName:'熊氏',givenName:'湛',bornYear:-600,accessionYear:0,status:'ruling',reignOrdinal:1};const dy:any={factionId:'楚',rulers:[king,son],currentRulerId:'king',heirIds:['son'],designatedHeirId:'son',houseEpochs:[{foundingRulerId:'king',startMonth:0}],houseName:'熊氏'};return {son,king,dy};}
it('formal disability overrides stale heir emphasis without deleting kin, military pardons or punishing children',()=>{
 const {son,dy}=fixture(),child={...son,id:'grandchild',givenName:'孙',parentId:'son',royalHonors:[],successionHistory:[]};dy.rulers.push(child);dy.heirIds.push(child.id);
 const before=JSON.stringify(dy),rng=random.exportState();const map=deriveGenealogyNodePresentations(dy,{name:'楚',status:'ACTIVE',color:1},[],36);
 expect(map.get('son')!.roles).not.toContain('储君');expect(map.get('son')!.details).not.toContain('宗室候选');expect(map.get('son')!.labels).toContain('承统资格已废');expect(map.get('son')!.theme).toBe('disqualified');expect(map.get(child.id)!.details).toContain('宗室候选');expect(maySucceed(child,36)).toBe(true);
 expect(royalHonorHeading(son,dy,36)?.primary).toBeUndefined();expect(royalHonorHeading(son,dy,36)?.secondary).toContain('旧荣衔');expect(royalHonorHeading(son,dy,23)?.primary).toContain('武安君');
 const p:any={politicalHistory:[{kind:'COURT_BAN',eventId:'b',month:24,factionId:'楚'},{kind:'COURT_PARDONED',banEventId:'b',month:30,factionId:'楚'}]};expect(militaryCourtLabels(p,'楚',36)[0]).toContain('已获赦免');expect(maySucceed(son,36)).toBe(false);
 expect(JSON.stringify(dy)).toBe(before);expect(random.exportState()).toEqual(rng);
 son.successionHistory.push({eventId:'restore',kind:'RESTORED',month:48,restoresEventId:'ban'});expect(royalHonorHeading(son,dy,47)?.primary).toBeUndefined();expect(royalHonorHeading(son,dy,48)?.primary).toContain('武安君');expect(deriveGenealogyNodePresentations(dy,{name:'楚',status:'ACTIVE',color:1},[],48).get('son')!.labels).toContain('承统资格已恢复');
});
it('a military peerage revocation alone never fabricates formal Wuan honor forfeiture',()=>{
 const {son,dy}=fixture();son.successionHistory=[];const p:any={appointments:[],honorHistory:[{kind:'REVOKED',factionId:'楚',epochFounderId:'king',month:24}]};expect(royalHonorHeading(son,dy,36,{person:p})?.primary).toContain('武安君');expect(son.royalHonors).toHaveLength(1);
});
it('posthumous labels require a recorded death at the reading month and keep temple/epithet separate',()=>{
 const {king,dy}=fixture();king.templeName='高宗';king.posthumousEpithet='文';
 const read=(m:number)=>deriveGenealogyNodePresentations(dy,{name:'楚',status:'ACTIVE',color:1},[],m).get('king')!;
 expect(read(36).posthumousLabels).toEqual([]);king.status='dead';king.deathMonth=48;king.deathReason='自然去世';expect(read(47).posthumousLabels).toEqual([]);expect(read(48).posthumousLabels).toEqual(['庙号：高宗','谥号：文']);
});
it('eight highlights retain a late coup, pardon, first appointment, representative victory and death',()=>{
 const es=[event('first','military-office-granted',0),...Array.from({length:15},(_,i)=>event(`rank${i}`,'military-office-granted',i+1)),event('win','city-captured',70,{wasCapital:1}),event('coup','court-coup-attempt',100),event('pardon','military-court-sanction',140),event('death','military-person-died',200)];
 const entries=es.map(e=>({eventId:e.id,worldMonth:e.year,factionId:'楚',text:e.title,source:e.type+' · '+e.id,victory:e.id==='win'}));const p:any={personId:'p',name:'黄子绍',personalName:'黄子绍',appointments:[]};const before=JSON.stringify(es),rows=militaryMilestones(p,entries,es),selected=selectMilitaryMilestones(rows,es);
 expect(selected).toHaveLength(8);expect(selected.map(e=>e.eventId)).toEqual(expect.arrayContaining(['first','win','coup','pardon','death']));expect(selected.map(e=>e.worldMonth)).toEqual(selected.map(e=>e.worldMonth).sort((a,b)=>a-b));expect(JSON.stringify(es)).toBe(before);
});
it('court service displays only source-bound actual awards and never a later unrelated promotion',()=>{
 const attempt=event('a','court-coup-attempt',24),result=event('r','court-coup-result',24,{outcome:'SUCCESS',courtCoupEventId:'a',personId:'p'}),service=event('s','court-service-granted',24,{personId:'p',courtResultEventId:'r',courtCoupEventId:'a',loyaltyBefore:65,loyaltyAfter:73});
 const es=[attempt,result,service,event('later','military-office-granted',36,{personId:'p'})];const row=courtServiceReadings({personId:'p'},es,36)[0];expect(row.text).toContain('未获新的正式军功爵赏');expect(row.text).toContain('增加8');expect(courtServiceReadings({personId:'other'},es,36)).toEqual([]);
 const grant=event('g','military-ennobled',24,{personId:'p',courtServiceEventId:'s'}),reward=event('reward','court-reward-granted',24,{personId:'p',courtServiceEventId:'s',nobleGrantEventId:'g'});reward.title='正式封伯';expect(courtServiceReadings({personId:'p'},[...es,grant,reward],36)[0].text).toContain('正式封伯');expect(courtServiceReadings({personId:'p'},es,23)).toEqual([]);
 result.metadata.outcome='FAILED';expect(courtServiceReadings({personId:'p'},es,36)).toEqual([]);
});
