import {describe,it,expect} from 'vitest';
import {maySucceed} from './RoyalSuccessionStanding';
import {selectActiveDynasticCandidateIds,selectRecordedDynasticSuccessor} from './DynasticCandidateRules';
import {selectDepositionCandidates} from './InReignDeposition';
import {courtCoupText} from '../History/CourtCoupReading';
const king:any={id:'king',houseName:'潘氏',givenName:'刚',bornYear:-600,status:'ruling'};
const child:any={id:'son',houseName:'潘氏',givenName:'彦修',bornYear:-240,parentId:'king',status:'heir'};
const ban:any={eventId:'ban',kind:'DISQUALIFIED',month:12,rulerId:'son'};
describe('formal succession disability, separate from military service',()=>{
 it('only a royal act excludes normal selection, designation and crisis targets',()=>{
  expect(maySucceed({...child,politicalHistory:[{kind:'COURT_BAN'}]},24)).toBe(true);
  const son={...child,successionHistory:[ban]},other={...child,id:'other',bornYear:-200},rulers=[king,son,other];
  expect(selectActiveDynasticCandidateIds({currentRuler:king,rulers,month:24,cap:4,isAlive:()=>true,pickIndex:()=>0})).toEqual(['other']);
  expect(selectRecordedDynasticSuccessor({predecessor:king,candidates:[son,other],rulers,houseName:'潘氏',month:24,isAlive:()=>true,pickIndex:()=>0})?.ruler.id).toBe('other');
  expect(selectDepositionCandidates({currentRuler:king,rulers,houseName:'潘氏',worldMonth:24}).map(c=>c.ruler.id)).toEqual(['other']);
 });
 it('never invents an heir when every recorded candidate is barred',()=>{
  const son={...child,successionHistory:[ban]};expect(selectRecordedDynasticSuccessor({predecessor:king,candidates:[son],rulers:[king,son],houseName:'潘氏',month:24,isAlive:()=>true,pickIndex:()=>{throw Error('unnecessary RNG');}})).toBeUndefined();
 });
 it('explicit source-bound restoration applies only at its actual month',()=>{
  const son={...child,successionHistory:[ban,{...ban,eventId:'restore',kind:'RESTORED',month:84,restoresEventId:'ban'}]};expect(maySucceed(son,83)).toBe(false);expect(maySucceed(son,84)).toBe(true);expect(maySucceed({...son,successionHistory:[ban,{...son.successionHistory[1],restoresEventId:'unrelated'}]},84)).toBe(false);
 });
 it.each(['SUCCESS','FAILED'])('SELF %s uses the verified identity and never endorses itself',outcome=>{
  const r:any={actorRulerId:'son',targetRulerId:'son',target:{basis:'SELF',relation:'DIRECT_CHILD',name:'潘彦修'},participant:{personalName:'潘彦修',officeStanding:{office:'JIANGJUN'}},crisisFacts:[],previousRulerTitle:'虎王潘刚',countryLabel:'虎国',outcome};
  const text=courtCoupText(r);expect(text).toContain('图自立为王');expect(text).toContain(outcome==='SUCCESS'?'夺位得位':'夺位未遂');expect(text).not.toContain('欲拥立');r.actorRulerId='other';expect(courtCoupText(r)).toContain('拥立');
 });
});
