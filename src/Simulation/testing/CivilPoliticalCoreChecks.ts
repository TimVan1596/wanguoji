import {SIMULATION_FIXED_STEP_MS} from '../SimulationDriver';
import Civil,{civilGovernorCandidates} from '../../Politics/CivilAdministration';
import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import {personAmbition,personAbilities} from '../../Politics/PersonAbilities';
import random from '../WorldRandom';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
/** Controlled source fixture; every capture, appointment, merit and accession uses actual production transactions. */
export function checkCivilPoliticalCore(core:any,input:ReturnType<typeof exportWorldSave>,factionId:string,personId:string,check:(v:unknown,s:string)=>void){
 const clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false});
 try{
  hydrateWorldSave(core,structuredClone(input));const team=core.teams.find((t:any)=>t.name===factionId),enemy=core.teams.find((t:any)=>t!==team&&t.status==='ACTIVE'),person=Military.getPerson(personId)!;
  const town=team.cities.find((c:any)=>c!==team.capitalCity&&!Civil.getCurrentByCity(c.id,input.world.worldMonth));check(town,'actual non-capital city is available for a controlled civil political resource fixture');
  const base=input.world.worldMonth,command=person.appointments.find(a=>a.endMonth===undefined)!;
  town.capture(enemy,base);town.capture(team,base,undefined,command.commandId,personId);
  const start=base+24;clock(start);const dynasty=Dynasty.get(factionId)!,epoch=dynasty.houseEpochs!.at(-1)!.foundingRulerId;
  const candidates=civilGovernorCandidates(start,team,Military.getPeople(),Civil.getTerms(),epoch,(id,born)=>Military.getFamilyMember(id,born),Military.getFormations());
  const candidate=candidates.find(c=>!c.royalRulerId&&c.strategy>=60&&personAmbition(personAbilities({kind:'RESIDENT',sourceUserId:c.sourceUserId,bornMonth:c.bornMonth}).source)>0);
  check(candidate,'real unused living resident qualifies for governance without inventing population');
  const governor=team.getUserById(candidate!.sourceUserId);governor.loyalty=0;
  const term=Civil.appoint(start,team,town,candidate!,dynasty);town.loyalty=20;town.devastation=40;
  for(let n=1;n<=10;n++){clock(start+n*12);(Civil as any).applyGovernance(start+n*12,core.teams);}
  const at=start+120;for(const c of team.cities)c.loyalty=20;
  const matured=Civil.getByPerson(term.personId).find(t=>t.assignmentId===term.assignmentId)!;check(matured.meritEventId&&at-matured.startMonth===120,'governor has ten actual years and a production governance-merit receipt before political participation');
  const prepared=exportWorldSave(core);check(validateWorldSave(prepared).valid,'controlled civil political resource setup is a strict native save before accession');
  const next=random.next;random.next=()=>{next.call(random);return 0;};try{Dynasty.resolveCapturedRuler(team,enemy,at);}finally{random.next=next;}
  const king=Dynasty.getCurrentRuler(factionId)!,proof=king.militaryUsurperIdentity;
  check(proof?.personId===personId&&proof.civilSources.some(s=>s.assignmentId===term.assignmentId&&s.sourceUserId===governor.id&&s.loyalty===0),'actual accession freezes a living governor identity and its real loyalty object/time');
  check(proof?.contest.find(r=>r.personId===personId)?.civilSupport.some(s=>s.assignmentId===term.assignmentId&&s.bonus>0&&s.bonus<=4),'actual governor term, merit and linked city capture contribute a bounded political resource to the real commander');
  check(governor.role==='NORMAL'&&!governor.militaryPersonId&&!Military.getFormations().some(f=>f.status==='ACTIVE'&&f.commanderPersonId===term.personId),'political civil participation creates neither a command, a second identity nor an army');
  Civil.update(at,core.teams,Dynasty.getAll());const ended=Civil.getByPerson(term.personId).find(t=>t.assignmentId===term.assignmentId)!;
  check(ended.endMonth===at&&ended.endReason==='REGIME_ENDED','old dynasty civil appointment ends through its lawful regime boundary');
  const saved=exportWorldSave(core),valid=validateWorldSave(saved);check(valid.valid,`civil political source strictly replays after old appointment closes: ${valid.errors.slice(0,2).join(';')}`);
  hydrateWorldSave(core,structuredClone(saved));check(diffCanonicalWorldSave(saved,exportWorldSave(core)).matched,'civil political participation and accession read again with identical people, history and RNG');
  for(const edit of ['meritEventId','captureEventId','bonus']){const bad=structuredClone(saved),r=bad.dynasties.flatMap(d=>d.rulers as any[]).find(r=>r.rulerId===king.id)!,row=r.militaryUsurperIdentity.contest.find((x:any)=>x.personId===personId).civilSupport[0];row[edit]=edit==='bonus'?99:'forged';const event=(bad.worldHistory.events as any[]).find(e=>e.type==='dynasty-usurped'&&e.rulerId===king.id)!;event.metadata.militaryUsurperIdentity=JSON.stringify(r.militaryUsurperIdentity);check(!validateWorldSave(bad).valid,`strict replay rejects forged actual civil political ${edit}`);}
  const resume=()=>{hydrateWorldSave(core,structuredClone(saved));core.setWorldRunning(true);for(let m=0;m<12;m++){for(let n=0;n<30;n++)core.advanceLogicalStep(SIMULATION_FIXED_STEP_MS);core.scene.sys.events.emit('postupdate');}core.setWorldRunning(false);return exportWorldSave(core);};
  const left=resume(),right=resume();check(diffCanonicalWorldSave(left,right).matched,'civil-supported accession resumes twelve actual months deterministically');hydrateWorldSave(core,structuredClone(left));check(diffCanonicalWorldSave(left,exportWorldSave(core)).matched,'continued civil political evidence reads again after later appointments and loyalty changes');
 }finally{hydrateWorldSave(core,structuredClone(input));}
}
