import {civilOfficeTitle,civilOfficeDuties,CIVIL_OFFICE_NAMES} from '../../../Politics/CivilOffice';
import {currentNobleGrant} from '../../../Politics/MilitaryNobility';
import Dynasty from '../../../Politics/Dynasty';
import {MilitaryServicePanel} from '../FactionDetails/PersonServicePanel';
import PersonChronicleLayout from '../FactionDetails/PersonChronicleLayout';
import PersonAbilityPanel,{PersonAbilityEvidence} from '../FactionDetails/PersonAbilityPanel';
import MilitaryDispositionPanel from '../FactionDetails/MilitaryDispositionPanel';
import {type PersonCareerIndex,personCareerMilestones} from '../FactionDetails/PersonCareerTimeline';
import {personAbilities,militaryAbilities,personAmbition,rulerAbilities} from '../../../Politics/PersonAbilities';
import {getFactionColorAtMonth} from '../../../Simulation/FactionColorHistory';
import {Box,Button,Typography} from '@mui/material';
import {useEffect,useState} from 'react';
import {store} from '../../../store';
import {setPersonArchiveRequest,setSelectedFactionName,setRightPanelTab} from '../../../store/rootSlice';
import Game from '../../../Game/Game';
import WorldHistory from '../../../History/WorldHistory';
import CivilAdministration,{civilGovernorStatus,type CivilGovernorTerm} from '../../../Politics/CivilAdministration';
import Military from '../../../Politics/MilitaryCommandRegistry';
import {formatWorldDate,formatWorldDuration} from '../../../Simulation/WorldTime';
import {FamilyTitleBadge} from '../FactionDetails/FamilyNoblePanel';
import FamilyPersonSources from '../FactionDetails/FamilyPersonSources';
import {NobleHistory} from '../FactionDetails/NobleHistory';
import PersonCareerIdentity from '../FactionDetails/PersonCareerIdentity';
import {usePersonArchiveNavigation} from '../FactionDetails/PersonArchiveNavigation';

const endReasonLabel=(reason:NonNullable<CivilGovernorTerm['endReason']>)=>({DEATH:'去世',CITY_LOST:'城池失守',FACTION_ENDED:'政权终结',REGIME_ENDED:'王统结束',POLITICAL_SANCTION:'政治禁仕',MILITARY_OFFICE:'转任武职',REPLACED:'职务更替',PROMOTED:'晋升',TRANSFERRED:'调任',IDENTITY_ENDED:'身份或在籍关系结束'})[reason];
const sourceLabel=(term:CivilGovernorTerm)=>term.identitySource==='ORDINARY_RESIDENT'?'居民出身':term.identitySource==='FAMILY'?'功臣世家':term.identitySource==='NOBLE'?'有爵人物':term.identitySource==='ROYAL'?'宗室':'退役军人';

function useHistoryRevision(){const [revision,setRevision]=useState(WorldHistory.getRevision());useEffect(()=>WorldHistory.subscribeRevision(setRevision),[]);return revision;}
function cityFor(term:CivilGovernorTerm){return Game.Core?.allCities.find(city=>city.id===term.cityId);}

export function CivilGovernorSummary({cityId,month}:{cityId:string;month:number}){
 useHistoryRevision();const term=CivilAdministration.getCurrentByCity(cityId,month),city=Game.Core?.allCities.find(city=>city.id===cityId);
 return <Box data-civil-governor-summary={cityId} sx={{borderTop:'1px solid var(--gg-border)',pt:.6}}>
  <Typography fontSize='.82rem' fontWeight='bold'>地方官</Typography>
  {term?<><Typography fontSize='.8rem'>现任{CIVIL_OFFICE_NAMES[term.office??'JUNSHOU']}：<Button size="small" sx={{p:0,minWidth:0}} onClick={()=>{store.dispatch(setSelectedFactionName(term.factionId));store.dispatch(setRightPanelTab('faction'));store.dispatch(setPersonArchiveRequest({kind:"CIVIL",factionId:term.factionId,id:term.personId}));}}>{term.personalName}</Button></Typography><Typography fontSize='.76rem'>任期：{formatWorldDate(term.startMonth)}—今 · {formatWorldDuration(month-term.startMonth)}</Typography><Typography fontSize='.76rem'>治理情况：{civilGovernorStatus(term,city,month)} · {sourceLabel(term)}</Typography></>:<Typography fontSize='.78rem'>暂无正式地方官</Typography>}
 </Box>;
}

export function governorProfile(term:CivilGovernorTerm,month:number){
 const person=Military.getPerson(term.personId),familyLink=Military.getFamilyMember(term.sourceUserId,term.bornMonth),family=familyLink?.family??(term.familyId?Military.getFamilies().find(f=>f.familyId===term.familyId):undefined),memberId=familyLink?.member.memberId??term.familyMemberId;
 const user=Game.Core?.teams.flatMap(t=>[...t.users]).find(u=>u.id===term.sourceUserId&&u.bornMonth===term.bornMonth);
 const terms=CivilAdministration.getByPerson(term.personId),linkedHouse=Dynasty.getAll().find(d=>d.rulers.some(r=>r.id===term.royalRulerId||r.id===person?.politicalRulerId||r.residentIdentity?.sourceUserId===term.sourceUserId&&r.bornYear===term.bornMonth)),linkedRuler=linkedHouse?.rulers.find(r=>r.id===term.royalRulerId||r.id===person?.politicalRulerId||r.residentIdentity?.sourceUserId===term.sourceUserId&&r.bornYear===term.bornMonth);
 const deathMonth=person?.deathMonth??linkedRuler?.deathMonth??familyLink?.member.deathMonth??terms.find(t=>t.endReason==='DEATH')?.endMonth;

 const portraitMonth=Math.min(month,deathMonth??month,term.endMonth===undefined?month:Math.max(term.startMonth,term.endMonth-1));
 const team=Game.Core?.teams.find(t=>t.name===term.factionId);
 const abilities=linkedRuler?rulerAbilities(linkedRuler,Military.getPeople()):person?militaryAbilities(person):personAbilities(term.royalRulerId?{kind:'ROYAL',rulerId:term.royalRulerId,bornMonth:term.bornMonth}:{kind:'RESIDENT',sourceUserId:term.sourceUserId,bornMonth:term.bornMonth});
 const loyalty=user&&user.role!=='RULER'?{value:user.loyalty,factionName:Game.Core?.teams.find(t=>t.users.has(user))?.displayName??term.countryName,month}:undefined;
 return {person,family,memberId,user,linkedRuler,linkedHouse,deathMonth,portraitMonth,abilities,loyalty,portrait:{personId:term.royalRulerId??term.personId,age:Math.max(0,Math.floor((portraitMonth-term.bornMonth)/12)),color:team?getFactionColorAtMonth(team,portraitMonth):undefined,deceased:deathMonth!==undefined&&deathMonth<=month,royalKin:!!term.royalRulerId,role:term.office??'JUNSHOU',nobleRank:person?currentNobleGrant(person,term.factionId,portraitMonth,term.epochFounderId)?.rank:undefined}};
}
export function GovernorDetail({term,month,careerIndex}:{term:CivilGovernorTerm;month:number;careerIndex?:PersonCareerIndex}){
 const navigation=usePersonArchiveNavigation(),{person,family,memberId,user,linkedRuler,linkedHouse,deathMonth,portraitMonth,abilities,loyalty}=governorProfile(term,month);
 const milestones=personCareerMilestones(careerIndex?.events??WorldHistory.getRecordedEvents(),term.personId,month,[],careerIndex);
 const ageMonth=deathMonth??(user?month:term.endMonth??month);
 return <Box data-civil-governor-detail={term.assignmentId}>
 <PersonChronicleLayout personKey={term.personId}
  title={<Typography fontWeight="bold">{term.personalName} · {term.countryName} · {civilOfficeTitle(term)}{term.endMonth!==undefined?'（已离任）':''}</Typography>}
  identity={<><PersonCareerIdentity personId={term.personId} name={term.personalName} bornMonth={term.bornMonth} deathMonth={deathMonth}/><Typography fontSize=".76rem">{deathMonth!==undefined?`享年${Math.floor((deathMonth-term.bornMonth)/12)}岁`:user?`年龄${Math.floor((month-term.bornMonth)/12)}岁`:`任职末期${Math.floor((ageMonth-term.bornMonth)/12)}岁 · 此后生死未载`} · {sourceLabel(term)}</Typography></>}
  preBiography={<>{person?<MilitaryDispositionPanel person={person} personId={person.personId} bornMonth={person.bornMonth} loyalty={loyalty?.value} loyaltyContext={loyalty}/>:<PersonAbilityPanel abilities={abilities} ambition={personAmbition(abilities.source)} loyalty={loyalty}/>}
  {linkedRuler&&linkedHouse&&<Button size="small" onClick={()=>navigation.open({kind:'RULER',factionId:linkedHouse.factionId,id:linkedRuler.id})}>查看君主本纪</Button>}
  {person?.appointments.length?<MilitaryServicePanel personId={term.personId} month={month} timelineOwnsPolitics/>:null}<CivilServicePanel personId={term.personId} month={month} factionId={term.factionId}/>
  {person&&<NobleHistory person={person} month={month}/>}
  {person&&family&&<FamilyTitleBadge personId={person.personId} factionId={family.factionId} month={month}/>}
  {family&&!person&&memberId&&<FamilyPersonSources family={family} memberId={memberId} month={month}/>}
  {family&&<Button size="small" onClick={()=>navigation.open({kind:'FAMILY',factionId:family.factionId,id:family.familyId,memberId})}>查看功臣世家与宗谱</Button>}
  {term.royalRulerId&&<Button size="small" onClick={()=>navigation.open({kind:'GENEALOGY',factionId:term.factionId,id:term.royalRulerId!})}>查看王室身份</Button>}
  </>}
  biographyTitle="生平纪事" biography={CivilAdministration.getByPerson(term.personId).filter(t=>t.startMonth<=month).flatMap(t=>[`${formatWorldDate(t.startMonth)}，${t.rulerTitle}${t.transfer?"调任":t.promotion?"擢任":"任命"}其为${civilOfficeTitle(t)}。`,...(t.endMonth!==undefined&&t.endMonth<=month?[`${formatWorldDate(t.endMonth)}离任：${endReasonLabel(t.endReason!)}。`]:[])])}
  milestoneTitle="生平时间轴" milestones={milestones.slice(-8)} milestoneTotal={milestones.length} allMilestones={()=>milestones}
  governance={<Box><Typography fontSize='.8rem'>{civilOfficeDuties[term.office??'JUNSHOU']}</Typography><Typography fontSize=".8rem">任期：{formatWorldDate(term.startMonth)}—{term.endMonth===undefined?'今':formatWorldDate(term.endMonth)} · {formatWorldDuration((term.endMonth??month)-term.startMonth)}</Typography><Typography fontSize=".8rem">治理：{term.endMonth===undefined&&(term.office==='YUSHI_DAFU'||term.office==='CHENGXIANG')?'中央在任':civilGovernorStatus(term,cityFor(term),month)} · 忠诚恢复{term.loyaltyRecovered} · 破坏恢复{term.devastationRecovered}</Typography>{term.meritEventId&&<Typography fontSize=".76rem">地方治绩：{formatWorldDate(term.meritMonth!)} · 因实际治理恢复获正式记录。</Typography>}</Box>}
  assessment={[]} evidence={()=><><PersonAbilityEvidence abilities={abilities}/><PersonPoliticalCareer personId={term.personId} month={month}/><Typography fontSize=".74rem">人物：{term.personId} / User {term.sourceUserId}。肖像取实际任职时点 {formatWorldDate(portraitMonth)}；身份、城市及任命君主使用原始记录。</Typography></>}/>
 </Box>;
}

export function CivilServicePanel({personId,month,factionId}:{personId:string;month:number;factionId:string}){
 const navigation=usePersonArchiveNavigation();useHistoryRevision();const terms=CivilAdministration.getByPerson(personId).filter(term=>term.startMonth<=month);
 if(!terms.length)return null;
 return <Box data-civil-service={personId} data-faction-context={factionId} sx={{my:.6}}><Typography fontSize='.82rem' fontWeight='bold'>仕宦经历</Typography>{terms.map(term=><Typography key={term.assignmentId} fontSize='.76rem'>{formatWorldDate(term.startMonth)}，{term.rulerTitle}任命其为{civilOfficeTitle(term)}；{term.endMonth===undefined?'现任':`${formatWorldDate(term.endMonth)}离任（${endReasonLabel(term.endReason!)}）`}。实际恢复忠诚{term.loyaltyRecovered}、破坏度{term.devastationRecovered}。<Button size="small" onClick={()=>navigation.open({kind:"RULER",factionId:term.factionId,id:term.rulerId})}>任命君主</Button></Typography>)}</Box>;
}

/** Personal events require their actual principal-person reference, never faction association. */
export function PersonPoliticalCareer({personId,month}:{personId:string;month:number}){
 useHistoryRevision();
 const events=WorldHistory.getRecordedEvents().filter(e=>e.metadata?.personId===personId&&(e.monthIndex??e.year)<=month);
 const career=events.filter(e=>e.type==='civil-governor-appointed'&&typeof e.metadata?.crossCareerEvidence==='string').flatMap(e=>{try{const proof=JSON.parse(String(e.metadata!.crossCareerEvidence));return proof.multiplier>1?[<Typography key={e.id} fontSize=".76rem">{formatWorldDate(e.monthIndex??e.year)}晋升竞争：经原任命与离任史事核验的既往军旅资历，相对权重增加5%；不替代文治功绩或晋升资格。来源：{proof.militaryEventIds.join('、')}</Typography>]:[];}catch{return [];}});
 const groups=[['政治经历',events.filter(e=>/court|punishment|pardon/.test(e.type))]] as const;
 return <>{career}{groups.filter(([,rows])=>rows.length).map(([title,rows])=><Box key={title}><Typography fontSize=".82rem" fontWeight="bold">{title}</Typography>{rows.map(e=><Typography key={e.id} fontSize=".76rem">{formatWorldDate(e.monthIndex??e.year)}，{e.title}</Typography>)}</Box>)}</>;
}
