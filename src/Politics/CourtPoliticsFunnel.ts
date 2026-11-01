import type {DepositionEvaluation} from './InReignDeposition';
import type {MilitaryPoliticalEvidence} from './MilitaryPoliticalInfluence';
import {willingCourtParticipant} from './MilitaryPoliticalDisposition';
/** Session observations only. Stages count country opportunities, blockers count candidate checks. */
export class CourtPoliticsFunnel {
 annual=0;crisis=0;legalTarget=0;command=0;willing=0;qualified=0;originalEligible=0;transactionFailures=0;
 blockers:Record<string,number>={};armyBlockers:Record<string,number>={};
 reset(){this.annual=this.crisis=this.legalTarget=this.command=this.willing=this.qualified=this.originalEligible=this.transactionFailures=0;this.blockers={};this.armyBlockers={};}
 observe(e:DepositionEvaluation,army:MilitaryPoliticalEvidence|undefined,qualified:boolean,active:boolean){
  if(!active)return;this.annual++;if(e.evidence.length)this.crisis++;if(e.evidence.length&&e.candidates.length)this.legalTarget++;
  if(army?.candidates.length)this.command++;if(army?.candidates.some(c=>c.disposition&&willingCourtParticipant(c.disposition)))this.willing++;
  if(qualified)this.qualified++;if(e.eligible)this.originalEligible++;
  for(const b of e.blockers)this.blockers[b]=(this.blockers[b]??0)+1;
  for(const b of army?.blocked??[])this.armyBlockers[b.reason]=(this.armyBlockers[b.reason]??0)+1;
 }
 snapshot(){return structuredClone({...this,scope:'SESSION_SINCE_LOAD',denominator:'annual formal country opportunities; army blockers count person checks within eligible structural opportunities'});}
}
