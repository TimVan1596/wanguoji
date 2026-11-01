import type {DepositionEvaluation} from './InReignDeposition';
import type {MilitaryPoliticalEvidence} from './MilitaryPoliticalInfluence';
import {willingCourtParticipant} from './MilitaryPoliticalDisposition';
/** Country opportunities, candidate-person checks and unique crisis facts have separate denominators. */
export class CourtPoliticsFunnel {
 draws=0;noAttempt=0;attempts=0;successes=0;failures=0;
 expectedAttempts=0;expectedUnconditionalSuccesses=0;expectedConditionalSuccesses=0;
 annual=0;crisis=0;legalTarget=0;command=0;willing=0;qualified=0;originalEligible=0;transactionFailures=0;
 sessionStartMonth=0;lastMonth=0;
 blockers:Record<string,number>={};armyBlockers:Record<string,number>={};private crisisIds=new Set<string>();
 reset(month=0){Object.assign(this,new CourtPoliticsFunnel());this.sessionStartMonth=month;this.lastMonth=month;}
 recordDraw(outcome:'SUCCESS'|'FAILED'|undefined,chance=0,conditional=0){this.draws++;this.expectedAttempts+=chance;this.expectedUnconditionalSuccesses+=chance*conditional;if(!outcome){this.noAttempt++;return;}this.expectedConditionalSuccesses+=conditional;this.attempts++;if(outcome==='SUCCESS')this.successes++;else this.failures++;}
 observe(e:DepositionEvaluation,army:MilitaryPoliticalEvidence|undefined,qualified:boolean,active:boolean,month=0){
  this.lastMonth=Math.max(this.lastMonth,month);if(!active)return;this.annual++;if(e.evidence.length)this.crisis++;for(const fact of e.evidence)this.crisisIds.add(fact.groupId);
  if(e.evidence.length&&e.candidates.length)this.legalTarget++;
  if(army?.candidates.length)this.command++;if(army?.candidates.some(c=>c.disposition&&willingCourtParticipant(c.disposition)))this.willing++;
  if(qualified)this.qualified++;if(e.eligible)this.originalEligible++;
  for(const b of e.blockers)this.blockers[b]=(this.blockers[b]??0)+1;
  for(const b of army?.blocked??[])this.armyBlockers[b.reason]=(this.armyBlockers[b.reason]??0)+1;
  for(const c of army?.candidates??[]){const reason=!c.officeStanding?'NO_CURRENT_OFFICE':c.unitCount<2?'INSUFFICIENT_FOLLOWERS':c.serviceMonths<12?'INSUFFICIENT_SERVICE':!c.disposition?'NO_REAL_DISPOSITION':!willingCourtParticipant(c.disposition)?'SUPPORTS_CONTINUITY':undefined;if(reason)this.armyBlockers[reason]=(this.armyBlockers[reason]??0)+1;}
 }
 snapshot(worldMonth=this.lastMonth){const {crisisIds,...state}=this,years=Math.max(0,worldMonth-this.sessionStartMonth)/12;return structuredClone({...state,independentCrisisFacts:crisisIds.size,elapsedWorldYears:years,attemptsPer100WorldYears:years?this.attempts*100/years:0,scope:'SESSION_SINCE_LOAD',denominator:'annual formal country opportunities; army blockers are person-checks, crisis facts deduplicate source groups'});}
}
