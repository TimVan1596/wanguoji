import {cityCivilTerms} from '../../../History/CityCivilTerms';
import {useEffect,useMemo,useState} from 'react';
import {Box,Button,Typography} from '@mui/material';
import {useDispatch} from 'react-redux';
import Civil from '../../../Politics/CivilAdministration';
import type {CivilGovernorTerm} from '../../../Politics/CivilAdministrationSchema';
import {civilOfficeTitle} from '../../../Politics/CivilOffice';
import {familyDisplayEligible} from '../../../Politics/FamilyDisplayEligibility';
import Military from '../../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../../Politics/Dynasty';
import History from '../../../History/WorldHistory';
import {formatWorldDate} from '../../../Simulation/WorldTime';
import {setPersonArchiveRequest,setRightPanelTab} from '../../../store/rootSlice';
import MilitaryArchiveWindow from '../FactionDetails/MilitaryArchiveWindow';
import PersonPortrait from '../FactionDetails/PersonPortrait';
import type {PersonArchiveTarget} from '../FactionDetails/PersonArchiveTarget';
import {civilEndReasonLabel} from '../CivilAdministration/CivilGovernancePanel';

export default function CityCivilOffices({cityId,month}:{cityId:string;month:number}){
 const [open,setOpen]=useState(false),[revision,setRevision]=useState(History.getRevision());
 useEffect(()=>History.subscribeRevision(setRevision),[]);
 const terms=useMemo(()=>cityCivilTerms(Civil.getByCity(cityId),cityId,month),[cityId,month,revision]);
 const byId=new Map(terms.map(term=>[term.assignmentId,term]));
 return <section data-city-civil-offices={cityId}>
  <Button size="small" aria-expanded={open} onClick={()=>setOpen(!open)}>历任地方官 · {terms.length}任 · {new Set(terms.map(t=>t.personId)).size}人</Button>
  {!terms.length&&<Typography fontSize=".78rem">尚无正式地方官任命记录。</Typography>}
  {open&&<MilitaryArchiveWindow ids={[...byId.keys()]} estimateHeight={108} maxRows={24}>{id=><OfficeCard term={byId.get(id)!} month={month}/>}</MilitaryArchiveWindow>}
 </section>;
}

function OfficeCard({term,month}:{term:CivilGovernorTerm;month:number}){
 const dispatch=useDispatch(),[open,setOpen]=useState(false),person=Military.getPerson(term.personId);
 const end=term.endMonth!==undefined&&term.endMonth<=month?term.endMonth:undefined;
 const dynasties=Dynasty.getAll();
 const membership=Military.getFamilyMember(term.sourceUserId,term.bornMonth);
 const family=membership&&familyDisplayEligible(membership.family,month,Military.getPeople(),dynasties)?membership:undefined;
 const sources=useMemo(()=>open?History.getEventsForCity(term.cityId!).filter(e=>e.metadata?.assignmentId===term.assignmentId&&(e.monthIndex??e.year)<=month):[],[open,term,month]);
 const receipts=(term.receipts??[]).filter(r=>r.month<=month);
 const navigate=(target:PersonArchiveTarget)=>{dispatch(setPersonArchiveRequest(target));dispatch(setRightPanelTab('faction'));};
 const openPerson=()=>{
  for(const house of dynasties){
   const ruler=house.rulers.find(r=>r.reignOrdinal!==undefined&&r.accessionYear!==undefined&&r.accessionYear<=month&&(r.id===person?.politicalRulerId||r.residentIdentity?.personId===term.personId||r.militaryIdentity?.personId===term.personId));
   if(ruler){navigate({kind:'RULER',factionId:house.factionId,id:ruler.id});return;}
  }
  navigate({kind:'CIVIL',factionId:term.factionId,id:term.personId});
 };
 return <Box component="article" data-civil-assignment={term.assignmentId} sx={{p:.75,my:.5,border:'1px solid var(--gg-border)',borderRadius:1,overflowWrap:'anywhere'}}>
  <Box sx={{display:'flex',alignItems:'flex-start',gap:.5}}>
   <PersonPortrait personId={term.royalRulerId??term.personId} role={term.office??'JUNSHOU'} age={Math.floor(((end??month)-term.bornMonth)/12)} deceased={person?.deathMonth!==undefined&&person.deathMonth<=month} size={34}/>
   <Box>
    <Button size="small" onClick={openPerson} sx={{p:0,textAlign:'left'}}>{term.personalName} · {civilOfficeTitle(term)}</Button>
    <Typography fontSize=".76rem">{term.countryName} · 任命君主 {term.rulerTitle}</Typography>
    <Typography fontSize=".76rem">{formatWorldDate(term.startMonth)}—{end===undefined?'今 · 现任':formatWorldDate(end)+(term.endReason?' · '+civilEndReasonLabel(term.endReason):'')}</Typography>
    <Typography fontSize=".74rem">忠诚恢复{receipts.reduce((n,r)=>n+r.loyalty,0)} · 破坏恢复{receipts.reduce((n,r)=>n+r.devastation,0)} · 守成考课{term.stewardshipAssessments?.filter(a=>a.month<=month).length??0}次</Typography>
   </Box>
  </Box>
  <Button size="small" aria-expanded={open} onClick={()=>setOpen(!open)}>任期史事</Button>
  {family&&<Button size="small" onClick={()=>navigate({kind:'FAMILY',factionId:family.family.factionId,id:family.family.familyId,memberId:family.member.memberId})}>功臣宗谱</Button>}
  {open&&sources.map(e=><Typography key={e.id} fontSize=".75rem">{formatWorldDate(e.monthIndex??e.year)} · {e.title}</Typography>)}
 </Box>;
}
