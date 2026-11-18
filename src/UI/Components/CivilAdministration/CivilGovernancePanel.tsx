import PortraitSummary from '../FactionDetails/PortraitSummary';
import PersonArchiveCard from '../FactionDetails/PersonArchiveCard';
import PersonChronicleLayout from '../FactionDetails/PersonChronicleLayout';
import PersonAbilityPanel,{PersonAbilityEvidence} from '../FactionDetails/PersonAbilityPanel';
import MilitaryDispositionPanel from '../FactionDetails/MilitaryDispositionPanel';
import {personCareerMilestones} from '../FactionDetails/PersonCareerTimeline';
import {personAbilities,militaryAbilities} from '../../../Politics/PersonAbilities';
import {getFactionColorAtMonth} from '../../../Simulation/FactionColorHistory';
import MilitaryArchiveWindow from '../FactionDetails/MilitaryArchiveWindow';
import {Box,Button,Typography,TextField} from '@mui/material';
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

const active=(term:CivilGovernorTerm,month:number)=>term.startMonth<=month&&term.endMonth===undefined;
const endReasonLabel=(reason:NonNullable<CivilGovernorTerm['endReason']>)=>({DEATH:'去世',CITY_LOST:'城池失守',FACTION_ENDED:'政权终结',REGIME_ENDED:'王统结束',POLITICAL_SANCTION:'政治禁仕',MILITARY_OFFICE:'转任武职',REPLACED:'职务更替',IDENTITY_ENDED:'身份或在籍关系结束'})[reason];
const sourceLabel=(term:CivilGovernorTerm)=>term.identitySource==='ORDINARY_RESIDENT'?'在籍居民':term.identitySource==='FAMILY'?'功臣世家':term.identitySource==='NOBLE'?'有爵人物':term.identitySource==='ROYAL'?'宗室':'退役军人';

function useHistoryRevision(){const [revision,setRevision]=useState(WorldHistory.getRevision());useEffect(()=>WorldHistory.subscribeRevision(setRevision),[]);return revision;}
function cityFor(term:CivilGovernorTerm){return Game.Core?.allCities.find(city=>city.id===term.cityId);}

export function CivilGovernorSummary({cityId,month}:{cityId:string;month:number}){
 useHistoryRevision();const term=CivilAdministration.getCurrentByCity(cityId,month),city=Game.Core?.allCities.find(city=>city.id===cityId);
 return <Box data-civil-governor-summary={cityId} sx={{borderTop:'1px solid var(--gg-border)',pt:.6}}>
  <Typography fontSize='.82rem' fontWeight='bold'>地方官</Typography>
  {term?<><Typography fontSize='.8rem'>现任郡守：<Button size="small" sx={{p:0,minWidth:0}} onClick={()=>{store.dispatch(setSelectedFactionName(term.factionId));store.dispatch(setRightPanelTab('faction'));store.dispatch(setPersonArchiveRequest({kind:"CIVIL",factionId:term.factionId,id:term.personId}));}}>{term.personalName}</Button></Typography><Typography fontSize='.76rem'>任期：{formatWorldDate(term.startMonth)}—今 · {formatWorldDuration(month-term.startMonth)}</Typography><Typography fontSize='.76rem'>治理情况：{civilGovernorStatus(term,city,month)} · {sourceLabel(term)}</Typography></>:<Typography fontSize='.78rem'>暂无正式郡守</Typography>}
 </Box>;
}

function governorProfile(term:CivilGovernorTerm,month:number){
 const person=Military.getPerson(term.personId),family=term.familyId?Military.getFamilies().find(f=>f.familyId===term.familyId):undefined;
 const user=Game.Core?.teams.flatMap(t=>[...t.users]).find(u=>u.id===term.sourceUserId&&u.bornMonth===term.bornMonth);
 const terms=CivilAdministration.getByPerson(term.personId),deathMonth=person?.deathMonth??terms.find(t=>t.endReason==='DEATH')?.endMonth;
 const portraitMonth=Math.min(month,deathMonth??month,term.endMonth===undefined?month:Math.max(term.startMonth,term.endMonth-1));
 const team=Game.Core?.teams.find(t=>t.name===term.factionId);
 const abilities=person?militaryAbilities(person):personAbilities({kind:'RESIDENT',sourceUserId:term.sourceUserId,bornMonth:term.bornMonth});
 const loyalty=user?{value:user.loyalty,factionName:Game.Core?.teams.find(t=>t.users.has(user))?.displayName??term.countryName,month}:undefined;
 return {person,family,user,deathMonth,portraitMonth,abilities,loyalty,portrait:{personId:term.personId,age:Math.max(0,Math.floor((portraitMonth-term.bornMonth)/12)),color:team?getFactionColorAtMonth(team,portraitMonth):undefined,deceased:deathMonth!==undefined&&deathMonth<=month,royalKin:!!term.royalRulerId}};
}
function GovernorDetail({term,month}:{term:CivilGovernorTerm;month:number}){
 const navigation=usePersonArchiveNavigation(),{person,family,user,deathMonth,portraitMonth,abilities,loyalty}=governorProfile(term,month);
 const milestones=personCareerMilestones(WorldHistory.getRecordedEvents(),term.personId,month);
 const ageMonth=deathMonth??(user?month:term.endMonth??month);
 return <Box data-civil-governor-detail={term.assignmentId}>
 <PersonChronicleLayout personKey={term.personId}
  title={<Typography fontWeight="bold">{term.personalName} · {term.countryName} · {term.cityName}郡守{term.endMonth!==undefined?'（已离任）':''}</Typography>}
  identity={<><PersonCareerIdentity personId={term.personId} name={term.personalName} bornMonth={term.bornMonth} deathMonth={deathMonth}/><Typography fontSize=".76rem">{deathMonth!==undefined?`享年${Math.floor((deathMonth-term.bornMonth)/12)}岁`:user?`年龄${Math.floor((month-term.bornMonth)/12)}岁`:`任职末期${Math.floor((ageMonth-term.bornMonth)/12)}岁 · 此后生死未载`} · {sourceLabel(term)}</Typography></>}
  preBiography={<>{person?<MilitaryDispositionPanel person={person} personId={person.personId} bornMonth={person.bornMonth} loyalty={loyalty?.value} loyaltyContext={loyalty}/>:<PersonAbilityPanel abilities={abilities} loyalty={loyalty}/>}
  <CivilServicePanel personId={term.personId} month={month} factionId={term.factionId}/>
  {person&&<NobleHistory person={person} month={month}/>}
  {person&&family&&<FamilyTitleBadge personId={person.personId} factionId={family.factionId} month={month}/>}
  {family&&!person&&term.familyMemberId&&<FamilyPersonSources family={family} memberId={term.familyMemberId} month={month}/>}
  {family&&<Button size="small" onClick={()=>navigation.open({kind:'FAMILY',factionId:family.factionId,id:family.familyId,memberId:term.familyMemberId})}>查看功臣世家与宗谱</Button>}
  {term.royalRulerId&&<Button size="small" onClick={()=>navigation.open({kind:'GENEALOGY',factionId:term.factionId,id:term.royalRulerId!})}>查看王室身份</Button>}
  <PersonPoliticalCareer personId={term.personId} month={month}/></>}
  biographyTitle="生平纪事" biography={[`${formatWorldDate(term.startMonth)}，${term.rulerTitle}任命其为${term.cityName}郡守。`,...(term.endReason?[`${formatWorldDate(term.endMonth!)}离任：${endReasonLabel(term.endReason)}。`]:[])]}
  milestoneTitle="生平时间轴" milestones={milestones.slice(-8)} milestoneTotal={milestones.length} allMilestones={()=>milestones}
  governance={<Box><Typography fontSize=".8rem">任期：{formatWorldDate(term.startMonth)}—{term.endMonth===undefined?'今':formatWorldDate(term.endMonth)} · {formatWorldDuration((term.endMonth??month)-term.startMonth)}</Typography><Typography fontSize=".8rem">治理：{civilGovernorStatus(term,cityFor(term),month)} · 忠诚恢复{term.loyaltyRecovered} · 破坏恢复{term.devastationRecovered}</Typography>{term.meritEventId&&<Typography fontSize=".76rem">地方治绩：{formatWorldDate(term.meritMonth!)} · 因实际治理恢复获正式记录。</Typography>}</Box>}
  assessment={[]} evidence={()=><><PersonAbilityEvidence abilities={abilities}/><Typography fontSize=".74rem">人物：{term.personId} / User {term.sourceUserId}。肖像取实际任职时点 {formatWorldDate(portraitMonth)}；身份、城市及任命君主使用原始记录。</Typography></>}/>
 </Box>;
}

export default function CivilGovernancePanel({factionId,month,initialPersonId}:{factionId:string;month:number;initialPersonId?:string}){
 const navigation=usePersonArchiveNavigation();
 useHistoryRevision();const [view,setView]=useState<'current'|'history'>('current'),[selected,setSelected]=useState<string|undefined>(initialPersonId);
 const [search,setSearch]=useState('');
 useEffect(()=>{setSelected(initialPersonId);setSearch('');setView('current');},[initialPersonId,factionId]);
 const terms=CivilAdministration.getTerms(factionId),shown=terms.filter(term=>term.personalName.includes(search)).filter(term=>view==='current'?active(term,month):term.endMonth!==undefined&&term.endMonth<=month).sort((a,b)=>b.startMonth-a.startMonth||a.assignmentId.localeCompare(b.assignmentId)),selectedTerm=terms.find(term=>term.personId===selected&&term.endMonth===undefined)??terms.filter(term=>term.personId===selected).at(-1);
 return <Box data-civil-governance-panel={factionId}>
  <Box sx={{display:'flex',gap:.5,my:.5}}><Button size='small' variant={view==='current'?'contained':'outlined'} onClick={()=>setView('current')}>现任</Button><Button size='small' variant={view==='history'?'contained':'outlined'} onClick={()=>setView('history')}>历任</Button><Typography component='span' fontSize='.78rem' sx={{alignSelf:'center',color:'var(--gg-text-muted)'}}>文官与爵位、军职分列</Typography></Box>
  <TextField size="small" label="姓名搜索" value={search} onChange={e=>setSearch(e.target.value)} sx={{my:.5}}/>

  {!shown.length&&<Typography fontSize='.8rem' color='var(--gg-text-muted)'>{view==='current'?'暂无正式郡守':'尚无已结束的郡守任期'}</Typography>}
  <MilitaryArchiveWindow key={factionId} ids={[...new Set([...(selectedTerm?[selectedTerm.personId]:[]),...shown.map(t=>t.personId)])]} targetId={selectedTerm?.personId}>{(id,index)=>{
   const term=shown.find(t=>t.personId===id)??selectedTerm!;const profile=governorProfile(term,month),expanded=selected===id;
   const open=()=>{if(profile.person?.appointments.some(a=>a.factionId===term.factionId))navigation.open({kind:'MILITARY',factionId:term.factionId,id});else setSelected(expanded?undefined:id);};
   return <Box data-civil-governor={term.assignmentId}><PersonArchiveCard index={index} expanded={expanded} active={active(term,month)} onSelect={open}
    portrait={<PortraitSummary portrait={profile.portrait} name={term.personalName} lines={[`${term.countryName} · ${term.cityName}郡守`,formatWorldDate(term.bornMonth)+'出生',`${formatWorldDate(term.startMonth)}—${term.endMonth===undefined?'今':formatWorldDate(term.endMonth)}`]} onFull={()=>setSelected(id)}/>}
    heading={<><Typography fontWeight="bold" fontSize=".86rem">{term.personalName} · {term.cityName}郡守</Typography><Typography fontSize=".75rem">{formatWorldDate(term.startMonth)}—{term.endMonth===undefined?'今':formatWorldDate(term.endMonth)} · {sourceLabel(term)}</Typography></>}>
    <GovernorDetail term={term} month={month}/>
   </PersonArchiveCard></Box>;
  }}</MilitaryArchiveWindow>
 </Box>;
}

export function CivilServicePanel({personId,month,factionId}:{personId:string;month:number;factionId:string}){
 const navigation=usePersonArchiveNavigation();useHistoryRevision();const terms=CivilAdministration.getByPerson(personId).filter(term=>term.startMonth<=month);
 if(!terms.length)return null;
 return <Box data-civil-service={personId} data-faction-context={factionId} sx={{my:.6}}><Typography fontSize='.82rem' fontWeight='bold'>仕宦经历</Typography>{terms.map(term=><Typography key={term.assignmentId} fontSize='.76rem'>{formatWorldDate(term.startMonth)}，{term.rulerTitle}任命其为{term.cityName}郡守；{term.endMonth===undefined?'现任':`${formatWorldDate(term.endMonth)}离任（${endReasonLabel(term.endReason!)}）`}。实际恢复忠诚{term.loyaltyRecovered}、破坏度{term.devastationRecovered}。<Button size="small" onClick={()=>navigation.open({kind:"RULER",factionId:term.factionId,id:term.rulerId})}>任命君主</Button></Typography>)}</Box>;
}

/** Personal events require their actual principal-person reference, never faction association. */
export function PersonPoliticalCareer({personId,month}:{personId:string;month:number}){
 useHistoryRevision();
 const events=WorldHistory.getRecordedEvents().filter(e=>e.metadata?.personId===personId&&(e.monthIndex??e.year)<=month);
 const groups=[['政治经历',events.filter(e=>/court|punishment|pardon/.test(e.type))]] as const;
 return <>{groups.filter(([,rows])=>rows.length).map(([title,rows])=><Box key={title}><Typography fontSize=".82rem" fontWeight="bold">{title}</Typography>{rows.map(e=><Typography key={e.id} fontSize=".76rem">{formatWorldDate(e.monthIndex??e.year)}，{e.title}</Typography>)}</Box>)}</>;
}
