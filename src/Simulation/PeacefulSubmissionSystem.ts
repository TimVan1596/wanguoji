import type Team from "../Components/Team";
import type { WorldEvent } from "../History/WorldHistory";
import type { DiplomaticRelation } from "../Politics/Diplomacy";
import { evaluateCommonThreatCredibility, type ThreatCredibility } from "../Politics/DiplomaticRules";
import { areSameOriginFactions, areFactionsTerritoriallyAdjacent } from "../Politics/StrategicUnionRules";
import { calculateTerritoryMetrics, getFactionTerritoryMetric } from "./TerritoryMetrics";

export type SubmissionBlocker = "NOT_FORMAL_STATE" | "SAME_ORIGIN_USES_STRATEGIC_UNION" | "NO_DURABLE_RELATION" | "RELATION_TOO_SHORT" | "NOT_ADJACENT" | "RECENT_BILATERAL_WAR" | "STRONGER_TOO_WEAK" | "WEAKER_TOO_LARGE" | "POWER_GAP_TOO_SMALL" | "STABILITY_TOO_HIGH" | "NO_PRESSURE_PATH";
export interface SubmissionEvidence {
  submittedFactionId: string; receivingFactionId: string;
  relationStatus?: DiplomaticRelation["status"];
  continuousRelationMonths: number; renewalCount: number;
  bilateralWarFreeMonths: number; sameOrigin: boolean; adjacent: boolean; bothFormal: boolean;
  submittedTerritoryShare: number; receivingTerritoryShare: number;
  submittedCityCount: number; receivingCityCount: number; submittedStability: number;
  commonThreatFactionId?: string; threatCredibility?: ThreatCredibility;
}
export function getSubmissionBlockers(e: SubmissionEvidence): SubmissionBlocker[] {
  const blockers: SubmissionBlocker[] = [];
  if (!e.bothFormal) blockers.push("NOT_FORMAL_STATE");
  if (e.sameOrigin) blockers.push("SAME_ORIGIN_USES_STRATEGIC_UNION");
  if (e.relationStatus !== "ALLIANCE" && e.relationStatus !== "NON_AGGRESSION") blockers.push("NO_DURABLE_RELATION");
  else if (e.continuousRelationMonths < (e.relationStatus === "ALLIANCE" ? 60 : 96)) blockers.push("RELATION_TOO_SHORT");
  if (!e.adjacent) blockers.push("NOT_ADJACENT");
  if (e.bilateralWarFreeMonths < 60) blockers.push("RECENT_BILATERAL_WAR");
  if (e.receivingTerritoryShare < 25) blockers.push("STRONGER_TOO_WEAK");
  if (e.submittedCityCount !== 1 || e.submittedTerritoryShare > 8) blockers.push("WEAKER_TOO_LARGE");
  if (e.submittedTerritoryShare > e.receivingTerritoryShare * 0.25) blockers.push("POWER_GAP_TOO_SMALL");
  if (e.submittedStability > 55) blockers.push("STABILITY_TOO_HIGH");
  return blockers;
}
export type SubmissionPath = "ALLIANCE_PROTECTION" | "ASYMMETRIC_PEACEFUL_RELATION";
export interface SubmissionCandidate { submitted: Team; receiving: Team; evidence: SubmissionEvidence; path: SubmissionPath }
export interface SubmissionInput { teams: Team[]; relations: DiplomaticRelation[]; totalCells: number; worldMonth: number; recentEvents: WorldEvent[]; blockSize: number }
export function rankSubmissionCandidates(a: SubmissionCandidate,b: SubmissionCandidate) {
  const x=a.evidence,y=b.evidence;
  const id=(u:string,v:string)=>u<v?-1:u>v?1:0;
  return Number(y.relationStatus === "ALLIANCE")-Number(x.relationStatus === "ALLIANCE") ||
    y.continuousRelationMonths-x.continuousRelationMonths ||
    (y.receivingTerritoryShare-y.submittedTerritoryShare)-(x.receivingTerritoryShare-x.submittedTerritoryShare) ||
    x.submittedStability-y.submittedStability || id(x.submittedFactionId,y.submittedFactionId) || id(x.receivingFactionId,y.receivingFactionId);
}
export function evaluateSubmissionCandidates(input: SubmissionInput) {
  const teams=input.teams.filter(t=>t.status === "ACTIVE").slice().sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
  const metrics=calculateTerritoryMetrics(input.teams,input.totalCells);
  const share=(t:Team)=>getFactionTerritoryMetric(metrics,t.name).controlledTerritoryShare;
  const relations=new Map(input.relations.filter(r=>r.expiresMonth>input.worldMonth).map(r=>[[r.factionAId,r.factionBId].sort().join("\0"),r]));
  const contact=(a:string,b:string,window:number)=>input.recentEvents.filter(e=>
    (e.type === "city-captured" || e.type === "capital-fallen") && (e.monthIndex??e.year)>=input.worldMonth-window && (e.monthIndex??e.year)<=input.worldMonth &&
    ((e.actorFactionId === a && e.targetFactionId === b)||(e.actorFactionId === b && e.targetFactionId === a)));
  const results: Array<{evidence:SubmissionEvidence;blockers:SubmissionBlocker[];candidate?:SubmissionCandidate}>=[];
  for(let i=0;i<teams.length;i++) for(let j=i+1;j<teams.length;j++) {
    const a=teams[i],b=teams[j],submitted=share(a)<=share(b)?a:b,receiving=submitted===a?b:a;
    const relation=relations.get([a.name,b.name].sort().join("\0"));
    const wars=contact(a.name,b.name,60),lastWar=wars.reduce((n,e)=>Math.max(n,e.monthIndex??e.year),-1);
    const threat=teams.find(t=>t.name === relation?.commonThreatFactionId && t!==a && t!==b);
    let credibility:ThreatCredibility|undefined;
    if(threat) {
      const ca=contact(a.name,threat.name,36),cb=contact(b.name,threat.name,36);
      credibility=evaluateCommonThreatCredibility({territoryShareA:share(a),territoryShareB:share(b),threatTerritoryShare:share(threat),directA:areFactionsTerritoriallyAdjacent(a,threat,input.blockSize)||ca.length>0,directB:areFactionsTerritoriallyAdjacent(b,threat,input.blockSize)||cb.length>0,adjacentPair:areFactionsTerritoriallyAdjacent(a,b,input.blockSize),priorRelationMonths:relation?input.worldMonth-relation.originalStartedMonth:0,capturedA:ca.some(e=>e.type === "city-captured"&&e.actorFactionId===threat.name),capturedB:cb.some(e=>e.type === "city-captured"&&e.actorFactionId===threat.name),capitalFall:[...ca,...cb].some(e=>e.type === "capital-fallen"&&e.actorFactionId===threat.name)});
    }
    const evidence:SubmissionEvidence={submittedFactionId:submitted.name,receivingFactionId:receiving.name,relationStatus:relation?.status,continuousRelationMonths:relation?input.worldMonth-relation.originalStartedMonth:0,renewalCount:relation?.renewalCount??0,bilateralWarFreeMonths:lastWar<0?60:input.worldMonth-lastWar,sameOrigin:areSameOriginFactions(a,b),adjacent:areFactionsTerritoriallyAdjacent(a,b,input.blockSize),bothFormal:[a,b].every(t=>t.identityStage === "STATE"&&t.cities.length>0&&!t.isDie),submittedTerritoryShare:share(submitted),receivingTerritoryShare:share(receiving),submittedCityCount:submitted.cities.length,receivingCityCount:receiving.cities.length,submittedStability:submitted.cities.length?submitted.cities.reduce((n,c)=>n+c.loyalty,0)/submitted.cities.length:0,commonThreatFactionId:credibility === "CREDIBLE"||credibility === "SEVERE"?threat?.name:undefined,threatCredibility:credibility};
    const blockers=getSubmissionBlockers(evidence);
    // Both paths retain ALL extreme-weakness gates; third-party pressure is never invented.
    const path:SubmissionPath=relation?.status === "ALLIANCE"&&evidence.commonThreatFactionId?"ALLIANCE_PROTECTION":"ASYMMETRIC_PEACEFUL_RELATION";
    results.push({evidence,blockers,candidate:blockers.length?undefined:{submitted,receiving,evidence,path}});
  }
  return results;
}
const blockerTypes: SubmissionBlocker[] = ["NOT_FORMAL_STATE","SAME_ORIGIN_USES_STRATEGIC_UNION","NO_DURABLE_RELATION","RELATION_TOO_SHORT","NOT_ADJACENT","RECENT_BILATERAL_WAR","STRONGER_TOO_WEAK","WEAKER_TOO_LARGE","POWER_GAP_TOO_SMALL","STABILITY_TOO_HIGH","NO_PRESSURE_PATH"];
const emptyCounts=()=>({candidateChecks:0,eligibleCount:0,submissionCount:0,blockerCounts:Object.fromEntries(blockerTypes.map(b=>[b,0])) as Record<SubmissionBlocker,number>});
export class PeacefulSubmissionSystem {
  private lastEvaluationMonth=-1;
  private cumulative=emptyCounts();
  private yearly=new Map<number,ReturnType<typeof emptyCounts>>();
  private recentCandidates: Array<SubmissionEvidence & {worldMonth:number;blockers:SubmissionBlocker[]}> = [];
  reset() { this.lastEvaluationMonth=-1;this.cumulative=emptyCounts();this.yearly.clear();this.recentCandidates=[]; }
  constructor(private readonly debug=false) {}
  update(input:SubmissionInput, submit:(candidate:SubmissionCandidate,month:number)=>boolean) {
    if(input.worldMonth<=0 || input.worldMonth%12!==0 || this.lastEvaluationMonth===input.worldMonth)return;
    this.lastEvaluationMonth=input.worldMonth;
    const results=evaluateSubmissionCandidates(input);
    const candidates=results.flatMap(r=>r.candidate?[r.candidate]:[]).sort(rankSubmissionCandidates);
    const submitted=!!candidates[0]&&submit(candidates[0],input.worldMonth);
    if(!this.debug)return;
    const counts=emptyCounts();counts.candidateChecks=results.length;counts.eligibleCount=candidates.length;counts.submissionCount=Number(submitted);
    for(const r of results)for(const b of r.blockers) counts.blockerCounts[b]=(counts.blockerCounts[b]??0)+1;
    for(const key of ["candidateChecks","eligibleCount","submissionCount"] as const)this.cumulative[key]+=counts[key];
    for(const [b,n] of Object.entries(counts.blockerCounts))this.cumulative.blockerCounts[b as SubmissionBlocker]=(this.cumulative.blockerCounts[b as SubmissionBlocker]??0)+n!;
    this.yearly.set(input.worldMonth,counts);
    for(const m of this.yearly.keys())if(m<input.worldMonth-1200)this.yearly.delete(m);
    this.recentCandidates=results.slice().sort((a,b)=>a.blockers.length-b.blockers.length || b.evidence.continuousRelationMonths-a.evidence.continuousRelationMonths).slice(0,10).map(r=>({...r.evidence,worldMonth:input.worldMonth,blockers:r.blockers}));
  }
  getDiagnostics(month:number) {
    const recent=emptyCounts();
    for(const [m,c] of this.yearly)if(m>=month-1200) {
      for(const key of ["candidateChecks","eligibleCount","submissionCount"] as const)recent[key]+=c[key];
      for(const [b,n] of Object.entries(c.blockerCounts))recent.blockerCounts[b as SubmissionBlocker]=(recent.blockerCounts[b as SubmissionBlocker]??0)+n!;
    }
    return {sessionCumulative:{...this.cumulative,blockerCounts:{...this.cumulative.blockerCounts}},recent100Years:recent,recentCandidates:this.recentCandidates.map(r=>({...r,blockers:r.blockers.slice()}))};
  }
}
