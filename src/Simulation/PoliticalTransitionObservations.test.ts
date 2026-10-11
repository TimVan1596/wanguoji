import { describe,expect,it } from "vitest";
import { PoliticalTransitionObservations } from "./PoliticalTransitionObservations";
import { getSubmissionBlockers,submissionCounterfactuals,type SubmissionEvidence } from "./PeacefulSubmissionSystem";
import worldRandom from "./WorldRandom";
const row=(blockers:string[]=[])=>({pair:['a','b'],blockers,preliminary:true});
const evidence:SubmissionEvidence={submittedFactionId:'a',receivingFactionId:'b',relationStatus:'ALLIANCE',continuousRelationMonths:60,
  renewalCount:0,bilateralWarFreeMonths:60,sameOrigin:false,adjacent:true,bothFormal:true,submittedTerritoryShare:3,
  receivingTerritoryShare:30,submittedCityCount:1,receivingCityCount:3,submittedStability:40};
describe('runtime political transition funnels',()=>{
  it('separates repeated checks, unique pairs, selected attempts, failures and successes',()=>{
    const o=new PoliticalTransitionObservations();o.reset(120);
    for(let m=121;m<=240;m++) {o.observeMonth(m);if(m%12===0)o.evaluation(m,[row()]);}
    o.attempt(240,()=>false,()=> 'FACTION_NOT_ACTIVE');o.attempt(240,()=>true,()=> 'unused');
    const s=o.snapshot(240).sessionCumulative;
    expect(s).toMatchObject({observedWorldMonths:120,evaluationTicks:10,pairChecks:10,fullyEligibleChecks:10,
      uniqueEligiblePairs:1,selectedAttempts:2,executionFailures:1,successfulTransitions:1,failureCounts:{FACTION_NOT_ACTIVE:1},successfulTransitionsPer100ObservedYears:10});
  });
  it('counts simultaneous blockers separately from sole blockers and does not infer attempts',()=>{
    const o=new PoliticalTransitionObservations();o.evaluation(12,[row(['X','Y']),row(['X']),row(['Y','Y'])]);
    expect(o.snapshot(12).sessionCumulative).toMatchObject({pairChecks:3,selectedAttempts:0,blockerCounts:{X:2,Y:2},soleBlockerCounts:{X:1,Y:1}});
  });
  it('handles no candidates and disabled observations without NaN or RNG draws',()=>{
    const rng=worldRandom.exportState();
    for(const enabled of [true,false]){
      const o=new PoliticalTransitionObservations(enabled);o.evaluation(12,[]);
      expect(o.attempt(12,()=>false,()=> 'FALSE')).toBe(false);
      expect(o.snapshot(12).sessionCumulative.eligibilityRate).toBe(0);
      expect(o.snapshot(12).sessionCumulative.successfulTransitionsPer100ObservedYears).toBe(0);
    }
    expect(worldRandom.exportState()).toEqual(rng);
  });
  it('records thrown execution failures but preserves the exception',()=>{
    const o=new PoliticalTransitionObservations();
    expect(()=>o.attempt(12,()=>{throw new TypeError('broken')},()=> '')).toThrow('broken');
    expect(o.snapshot(12).sessionCumulative.failureCounts).toEqual({'EXECUTION_THROW:TypeError':1});
  });
  it('bounds unique pair tracking and exposes a lower-bound flag',()=>{
    const o=new PoliticalTransitionObservations();
    o.evaluation(12,Array.from({length:4200},(_,i)=>({ ...row(),pair:['a',String(i)]})));
    expect(o.snapshot(12).sessionCumulative).toMatchObject({fullyEligibleChecks:4200,uniqueEligiblePairs:4096,uniquePairCountIsLowerBound:true});
    expect(o.snapshot(12).recentCandidates).toHaveLength(10);
  });
  it('retains precisely 100 annual buckets including the boundary month, resets after loading',()=>{
    const o=new PoliticalTransitionObservations();
    for(let m=1;m<=1212;m++){o.observeMonth(m);if(m%12===0)o.evaluation(m,[row()]);
      if(m===1200)expect(o.snapshot(m).recent100Years.evaluationTicks).toBe(100);
    }
    expect(o.snapshot(1212).recent100Years).toMatchObject({observedWorldMonths:1200,evaluationTicks:100,uniqueEligiblePairs:1});
    o.reset(24000);expect(o.snapshot(24000)).toMatchObject({sessionStartMonth:24000,observationEndMonth:24000,
      sessionCumulative:{observedWorldMonths:0,evaluationTicks:0,uniqueEligiblePairs:0}});
  });
  it('does not fill unobserved historical months or duplicate an observed month',()=>{
    const o=new PoliticalTransitionObservations();o.reset(24000);o.observeMonth(24001);o.observeMonth(24001);o.observeMonth(24010);
    expect(o.snapshot(24010).sessionCumulative.observedWorldMonths).toBe(2);
  });
  it('returns copies, keeps annual pair orientation irrelevant',()=>{
    const o=new PoliticalTransitionObservations();o.evaluation(12,[row()]);o.evaluation(24,[{...row(),pair:['b','a']}]);
    const snapshot=o.snapshot(24);snapshot.sessionCumulative.blockerCounts.X=99;
    expect(o.snapshot(24).sessionCumulative.uniqueEligiblePairs).toBe(1);
    expect(o.snapshot(24).sessionCumulative.blockerCounts.X).toBeUndefined();
  });
  it('counterfactual one-city relaxation passes only if every other true gate passes',()=>{
    const e={...evidence,submittedCityCount:2};const original=JSON.stringify(e);
    expect(submissionCounterfactuals(e).withoutOneCityAdditionalChecks).toBe(1);
    expect(submissionCounterfactuals({...e,submittedTerritoryShare:10}).withoutOneCityAdditionalChecks).toBe(0);
    expect(submissionCounterfactuals({...e,adjacent:false}).withoutOneCityAdditionalChecks).toBe(0);
    expect(getSubmissionBlockers(e)).toEqual(['WEAKER_TOO_LARGE']);expect(JSON.stringify(e)).toBe(original);
  });
  it('territorial counterfactual explicitly keeps city, peace, relation and stability gates',()=>{
    const e={...evidence,receivingTerritoryShare:20,submittedTerritoryShare:8};
    expect(submissionCounterfactuals(e).relaxedTerritoryAdditionalChecks).toBe(1);
    for(const change of [{submittedCityCount:2},{submittedStability:56},{relationStatus:undefined},{bilateralWarFreeMonths:59}])
      expect(submissionCounterfactuals({...e,...change}).relaxedTerritoryAdditionalChecks).toBe(0);
    expect(submissionCounterfactuals({...evidence,submittedTerritoryShare:12,receivingTerritoryShare:30}).relaxedTerritoryAdditionalChecks).toBe(1);
  });
});
