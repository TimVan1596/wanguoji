import {Box,Button,Typography} from '@mui/material';
import {useEffect,useState} from 'react';
import Game from '../../../Game/Game';
import WorldHistory from '../../../History/WorldHistory';
import CivilAdministration,{civilGovernorStatus,type CivilGovernorTerm} from '../../../Politics/CivilAdministration';
import Military from '../../../Politics/MilitaryCommandRegistry';
import {formatWorldDate,formatWorldDuration} from '../../../Simulation/WorldTime';
import {usePersonArchiveNavigation} from '../FactionDetails/PersonArchiveNavigation';

const active=(term:CivilGovernorTerm,month:number)=>term.startMonth<=month&&term.endMonth===undefined;
const sourceLabel=(term:CivilGovernorTerm)=>term.identitySource==='ORDINARY_RESIDENT'?'在籍居民':term.identitySource==='FAMILY'?'功臣世家':term.identitySource==='NOBLE'?'有爵人物':term.identitySource==='ROYAL'?'宗室':'退役军人';

function useHistoryRevision(){const [revision,setRevision]=useState(WorldHistory.getRevision());useEffect(()=>WorldHistory.subscribeRevision(setRevision),[]);return revision;}
function cityFor(term:CivilGovernorTerm){return Game.Core?.allCities.find(city=>city.id===term.cityId);}

export function CivilGovernorSummary({cityId,month}:{cityId:string;month:number}){
 useHistoryRevision();const term=CivilAdministration.getCurrentByCity(cityId,month),city=Game.Core?.allCities.find(city=>city.id===cityId);
 return <Box data-civil-governor-summary={cityId} sx={{borderTop:'1px solid var(--gg-border)',pt:.6}}>
  <Typography fontSize='.82rem' fontWeight='bold'>地方官</Typography>
  {term?<><Typography fontSize='.8rem'>现任郡守：{term.personalName}</Typography><Typography fontSize='.76rem'>任期：{formatWorldDate(term.startMonth)}—今 · {formatWorldDuration(month-term.startMonth)}</Typography><Typography fontSize='.76rem'>治理情况：{civilGovernorStatus(term,city,month)} · {sourceLabel(term)}</Typography></>:<Typography fontSize='.78rem'>暂无正式郡守</Typography>}
 </Box>;
}

function GovernorDetail({term,month}:{term:CivilGovernorTerm;month:number}){
 const navigation=usePersonArchiveNavigation(),person=Military.getPerson(term.personId),family=term.familyId?Military.getFamilies().find(f=>f.familyId===term.familyId):undefined;
 return <Box data-civil-governor-detail={term.assignmentId} sx={{border:'1px solid var(--gg-border)',borderRadius:'var(--gg-radius)',p:.75,display:'grid',gap:.35}}>
  <Typography fontWeight='bold' fontSize='.88rem'>{term.personalName} · {term.cityName}郡守</Typography>
  <Typography fontSize='.76rem'>身份：{sourceLabel(term)}{term.familyId?` · ${family?.surname??''}氏`:''}</Typography>
  <Typography fontSize='.76rem'>任命：{formatWorldDate(term.startMonth)} · {term.rulerTitle}</Typography>
  <Typography fontSize='.76rem'>任期：{formatWorldDate(term.startMonth)}—{term.endMonth===undefined?'今':formatWorldDate(term.endMonth)} · {formatWorldDuration((term.endMonth??month)-term.startMonth)}</Typography>
  <Typography fontSize='.76rem'>治理：{civilGovernorStatus(term,cityFor(term),month)} · 忠诚恢复{term.loyaltyRecovered} · 破坏恢复{term.devastationRecovered}</Typography>
  {term.endReason&&<Typography fontSize='.76rem'>离任原因：{term.endReason}</Typography>}
  {person&&<Button size='small' onClick={()=>navigation.open({kind:'MILITARY',factionId:term.factionId,id:person.personId})}>查看军政人物档案</Button>}
  {family&&<Button size='small' onClick={()=>navigation.open({kind:'FAMILY',factionId:term.factionId,id:family.familyId,memberId:term.familyMemberId})}>查看功臣世家与宗谱</Button>}
  {term.royalRulerId&&<Button size='small' onClick={()=>navigation.open({kind:'GENEALOGY',factionId:term.factionId,id:term.royalRulerId!})}>查看王室身份</Button>}
  {term.meritEventId&&<Typography fontSize='.76rem'>地方治绩：{formatWorldDate(term.meritMonth!)} · 因实际治理恢复获正式记录。</Typography>}
 </Box>;
}

export default function CivilGovernancePanel({factionId,month,initialPersonId}:{factionId:string;month:number;initialPersonId?:string}){
 useHistoryRevision();const [view,setView]=useState<'current'|'history'>('current'),[selected,setSelected]=useState<string|undefined>(initialPersonId);
 useEffect(()=>setSelected(initialPersonId),[initialPersonId]);
 const terms=CivilAdministration.getTerms(factionId),shown=terms.filter(term=>view==='current'?active(term,month):term.endMonth!==undefined&&term.endMonth<=month).sort((a,b)=>b.startMonth-a.startMonth||a.assignmentId.localeCompare(b.assignmentId)),selectedTerm=terms.find(term=>term.personId===selected&&term.endMonth===undefined)??terms.filter(term=>term.personId===selected).at(-1);
 return <Box data-civil-governance-panel={factionId}>
  <Box sx={{display:'flex',gap:.5,my:.5}}><Button size='small' variant={view==='current'?'contained':'outlined'} onClick={()=>setView('current')}>现任</Button><Button size='small' variant={view==='history'?'contained':'outlined'} onClick={()=>setView('history')}>历任</Button><Typography component='span' fontSize='.78rem' sx={{alignSelf:'center',color:'var(--gg-text-muted)'}}>文官与爵位、军职分列</Typography></Box>
  {selectedTerm&&<GovernorDetail term={selectedTerm} month={month}/>}
  {!shown.length&&<Typography fontSize='.8rem' color='var(--gg-text-muted)'>{view==='current'?'暂无正式郡守':'尚无已结束的郡守任期'}</Typography>}
  <Box sx={{display:'grid',gap:.45,maxHeight:'30rem',overflowY:'auto'}}>{shown.map(term=><button key={term.assignmentId} type='button' data-civil-governor={term.assignmentId} onClick={()=>setSelected(term.personId)} style={{textAlign:'left',border:'1px solid var(--gg-border)',borderRadius:6,background:'var(--gg-panel)',color:'inherit',padding:7,cursor:'pointer'}}><strong>{term.personalName}</strong> · {term.cityName}郡守<Typography component='span' fontSize='.75rem' sx={{display:'block',color:'var(--gg-text-muted)'}}>{formatWorldDate(term.startMonth)}—{term.endMonth===undefined?'今':formatWorldDate(term.endMonth)} · {sourceLabel(term)} · {civilGovernorStatus(term,cityFor(term),month)}</Typography></button>)}</Box>
 </Box>;
}

export function CivilServicePanel({personId,month,factionId}:{personId:string;month:number;factionId:string}){
 useHistoryRevision();const terms=CivilAdministration.getByPerson(personId).filter(term=>term.factionId===factionId&&term.startMonth<=month);
 if(!terms.length)return null;
 return <Box data-civil-service={personId} sx={{my:.6}}><Typography fontSize='.82rem' fontWeight='bold'>地方治绩</Typography>{terms.map(term=><Typography key={term.assignmentId} fontSize='.76rem'>{formatWorldDate(term.startMonth)}，{term.rulerTitle}任命其为{term.cityName}郡守；{term.endMonth===undefined?'现任':`${formatWorldDate(term.endMonth)}离任（${term.endReason}）`}。实际恢复忠诚{term.loyaltyRecovered}、破坏度{term.devastationRecovered}。</Typography>)}</Box>;
}
