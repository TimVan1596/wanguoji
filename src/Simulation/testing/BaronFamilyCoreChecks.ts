import Military from '../../Politics/MilitaryCommandRegistry';
import Dynasty from '../../Politics/Dynasty';
import {exportWorldSave} from '../../Persistence/WorldSaveExporter';
import {hydrateWorldSave} from '../../Persistence/WorldSaveHydrator';
import {validateWorldSave} from '../../Persistence/WorldSaveValidator';
import {diffCanonicalWorldSave} from '../../Persistence/WorldSaveSchema';
import {checkPoliticalPeerageInheritance} from './PoliticalPeerageCoreChecks';
/** Rong Mengheng is a user report, not a provided save. These are independently controlled production cases. */
export function checkBaronFamilies(core:any,base:ReturnType<typeof exportWorldSave>,factionId:string,check:(v:unknown,s:string)=>void){
 const clock=(m:number)=>core.simulator.clock.importState({worldMonth:m,elapsedMs:0,running:false});
 try{
  hydrateWorldSave(core,structuredClone(base));Military.setFamilyFoundationPolicyForSimulation('BARON');clock(216);Military.updateNobility(216,core.teams,Dynasty.getAll());
  const person=Military.getPeople().find(p=>p.factionId===factionId&&p.nobilityHistory?.some(g=>g.rank==='BO'))!,population=core.teams.reduce((n:number,t:any)=>n+t.users.size,0),people=Military.getPeople().length;
  Military.updateFamilies(216,core.teams,Dynasty.getAll());const family=Military.getFamilies().find(f=>f.founderPersonId===person.personId)!;check(family&&family.sourceEventId===person.nobilityHistory![0].eventId,'a personal military BO alone creates one real family charter with the actual original grant');
  check(population===core.teams.reduce((n:number,t:any)=>n+t.users.size,0)&&Military.getPeople().length===people,'baron charter creates neither population nor additional military people');
  const saved=exportWorldSave(core);Military.updateFamilies(216,core.teams,Dynasty.getAll());check(diffCanonicalWorldSave(saved,exportWorldSave(core)).matched,'repeated personal BO evaluation cannot found a duplicate family');
  clock(228);const t=core.teams.find((t:any)=>t.name===factionId),u=t.getUserById(person.sourceUserId);Military.endPersonCommands(person.personId,228,'DISMISSED');
  check(u.destroyUser(false,{cause:'BATTLE_DEATH',month:228}),'a controlled real BO founder life ends through User cleanup');Military.updateFamilyTitles(228,core.teams,Dynasty.getAll());check(Military.getFamilies().find(f=>f.familyId===family.familyId)?.nobleSuccession?.at(-1)?.reason==='NO_HEIR','a military BO without a registered child ends its title instead of inventing an heir');check(validateWorldSave(exportWorldSave(core)).valid,'military BO no-heir history remains strictly valid');
  hydrateWorldSave(core,structuredClone(saved));checkPoliticalPeerageInheritance(core,factionId,person.personId,check,240);
  hydrateWorldSave(core,structuredClone(saved));clock(228);Military.updateNobility(228,core.teams,Dynasty.getAll());Military.updateFamilies(228,core.teams,Dynasty.getAll());const p=Military.getPerson(person.personId)!;
  check(p.nobilityHistory?.at(-1)?.rank==='HOU'&&Military.getFamilies().filter(f=>f.founderPersonId===p.personId).length===1,'a BO founder genuinely promoted to HOU keeps the same family and both original grant dates');
  const owner=core.teams.find((t:any)=>t.name===factionId);owner.getUserById(p.sourceUserId).destroyUser(false,{cause:'BATTLE_DEATH',month:228});Military.updateFamilyTitles(228,core.teams,Dynasty.getAll());const act=Military.getFamilies().find(f=>f.familyId===family.familyId)?.nobleSuccession?.at(-1);check(act?.previousRank==='HOU'&&act.sourceGrantEventId===p.nobilityHistory?.at(-1)?.eventId,'death-time root uses the actual later HOU grant, without backdating it into the earlier BO charter');
  check(validateWorldSave(exportWorldSave(core)).valid,'BO charter followed by HOU root and real death replays exactly');
 }finally{hydrateWorldSave(core,structuredClone(base));}
}
