import {expect,it} from 'vitest';
import {militaryAmbition,militaryDisposition,validMilitaryDisposition,willingCourtParticipant} from './MilitaryPoliticalDisposition';
import {deriveMilitaryPoliticalInfluence} from './MilitaryPoliticalInfluence';
import {evaluateDepositionOpportunity,chooseDepositionClaimant} from './InReignDeposition';
import {validDepositionSelection} from '../Persistence/DepositionSelectionValidation';
import {validMilitaryClaimSupport} from './MilitaryClaimSupport';
import random from '../Simulation/WorldRandom';
const personId=Array.from({length:100},(_,i)=>`political-person-${i}`).find(id=>militaryAmbition(id,-300)<=33)!;
function input(loyalty:number):Parameters<typeof deriveMilitaryPoliticalInfluence>[0]{
 return {factionId:'qin',status:'ACTIVE',identityStage:'STATE',worldMonth:72,events:[],people:[{personId,sourceUserId:1,name:'军人',personalName:'李承远',bornMonth:-300,factionId:'qin',status:'ACTIVE',appointments:[{factionId:'qin',startMonth:0,commandId:'command'}],capturedEventIds:[]}],formations:[{commandId:'command',commanderPersonId:personId,factionId:'qin',createdMonth:0,status:'ACTIVE',captures:[],memberUnitIds:['u1','u2','u3','u4']}],users:[1,2,3,4].map(id=>({userId:id,name:id===1?'军人':`兵${id}`,bornMonth:-300,factionId:'qin',personId:id===1?personId:undefined,unitId:`u${id}`,loyalty,liveBindingVerified:true}))};
}
it('keeps one personality across transfer, accession and JSON hydration without consuming RNG',()=>{
 const before=random.exportState(),i=input(35),p=i.people[0];
 const initial=militaryAmbition(p.personId,p.bornMonth);
 expect(new Set(Array.from({length:50},(_,i)=>militaryAmbition(`p${i}`,-300))).size).toBeGreaterThan(20);
 const transferred={...structuredClone(p),factionId:'new',politicalRulerId:'founder'};
 expect(militaryAmbition(transferred.personId,transferred.bornMonth)).toBe(initial);
 expect(militaryAmbition(JSON.parse(JSON.stringify(p)).personId,p.bornMonth)).toBe(initial);
 expect(random.exportState()).toEqual(before);
});
it('uses real loyalty to decline court pressure; a willing officer still needs an army and crisis',()=>{
 const loyal=deriveMilitaryPoliticalInfluence(input(95)),willing=deriveMilitaryPoliticalInfluence(input(20));
 expect(loyal.candidates).toHaveLength(0);expect(loyal.blocked[0].reason).toBe('SUPPORTS_CONTINUITY');
 expect(willing.candidates).toHaveLength(1);
 const old=input(20);old.people[0].status='RETIRED';expect(deriveMilitaryPoliticalInfluence(old).candidates).toHaveLength(0);
 const empty=input(20);empty.formations[0].memberUnitIds=[];expect(deriveMilitaryPoliticalInfluence(empty).candidates).toHaveLength(0);
 const d=militaryDisposition(personId,-300,95,2);expect(willingCourtParticipant(d)).toBe(false);
 expect(d.responseThreshold).toBeLessThan(75); // cautious, loyal commander cannot respond merely because followers do
 expect(validMilitaryDisposition({...d,ambition:100},personId,-300,2)).toBe(false);
 expect(validMilitaryDisposition({...d,loyalty:NaN},personId,-300,2)).toBe(false);
});
it('changes actual legal claimant weights within one successful draw and records support even if it loses',()=>{
 const rulers:any[]=[{id:'root',houseName:'秦氏',givenName:'祖',bornYear:-700,status:'dead',deathMonth:0},
  {id:'king',parentId:'root',houseName:'秦氏',givenName:'平',bornYear:-500,status:'ruling',accessionYear:0,naturalDeathYear:1000},
  {id:'son',parentId:'king',houseName:'秦氏',givenName:'继',bornYear:-180,status:'heir',naturalDeathYear:1000},
  {id:'brother',parentId:'root',houseName:'秦氏',givenName:'长',bornYear:-450,status:'kin',naturalDeathYear:1000}];
 const events:any[]=['one','two'].map(id=>({id,year:70,type:'city-captured',title:'失城',category:'war',targetFactionId:'qin'}));
 const military=deriveMilitaryPoliticalInfluence(input(20));
 const e=evaluateDepositionOpportunity({factionId:'qin',status:'ACTIVE',identityStage:'STATE',cityCount:1,stability:20,currentRuler:rulers[1],rulers,houseName:'秦氏',worldMonth:72,events,military});
 expect(e.eligible).toBe(true);const before=random.exportState();
 const continuous=structuredClone(e),assertive=structuredClone(e);
 continuous.militaryParticipant!.disposition=militaryDisposition(personId,-300,60,2);
 const ambitiousId=Array.from({length:100},(_,i)=>`ambitious-${i}`).find(id=>militaryAmbition(id,-300)>67)!;
 assertive.militaryParticipant!.personId=ambitiousId;assertive.militaryParticipant!.disposition=militaryDisposition(ambitiousId,-300,10,2);
 const a=chooseDepositionClaimant(continuous,72,e.probability*.5)!,b=chooseDepositionClaimant(assertive,72,e.probability*.5)!;
 expect(a.evidence.support).toMatchObject({rulerId:'son',basis:'KINSHIP'});expect(b.evidence.support).toMatchObject({rulerId:'brother',basis:'SENIORITY'});
 expect(a.evidence.candidates).not.toEqual(b.evidence.candidates);
 let different=0,lost=false;
 for(let n=0;n<100;n++){
  const x=chooseDepositionClaimant(continuous,72,e.probability*n/100)!,y=chooseDepositionClaimant(assertive,72,e.probability*n/100)!;
  if(x.claimant.ruler.id!==y.claimant.ruler.id)different++;
  if(x.claimant.ruler.id!==x.evidence.support!.rulerId)lost=true;
  expect(validDepositionSelection(JSON.stringify(x.evidence),rulers,'king',x.claimant.ruler.id,72)).toBe(true);
 }
 expect(different).toBeGreaterThan(0);expect(lost).toBe(true);
 expect(validMilitaryClaimSupport({...a.evidence.support!,rulerId:'dead-or-foreign'},a.evidence.candidates,-300)).toBe(false);
 expect(chooseDepositionClaimant({...e,evidence:[],eligible:false},72,0)).toBeUndefined();
 expect(chooseDepositionClaimant(e,72,e.probability)).toBeUndefined();expect(random.exportState()).toEqual(before);
});
