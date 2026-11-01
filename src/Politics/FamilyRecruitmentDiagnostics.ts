export function emptyFamilyRecruitmentDiagnostics(){return {opportunities:0,qualifiedPersonChecks:0,poolDraws:0,selected:0,appointments:0,rolledBackSelections:0,executionFailures:0,expectedAppointments:0,baselineExpectedAppointments:0,conditionalExpectedSelections:0,weightSum:0,distinctCandidateIds:[] as string[],recent:[] as Array<{month:number;factionId:string;familyPeople:number;poolSize:number;familyWeight:number;totalWeight:number;expected:number}>};}
export type FamilyRecruitmentDiagnostics=ReturnType<typeof emptyFamilyRecruitmentDiagnostics>;
/** One shared national chance; descendants do not each receive a separate appointment roll. */
export function familyRecruitmentExposure(rows:readonly {id:string;weight:number;family:boolean}[],royals:number,chance:number){
 const family=rows.filter(r=>r.family),familyWeight=family.reduce((n,r)=>n+r.weight,0),totalWeight=rows.reduce((n,r)=>n+r.weight,0)+royals,ordinaryWeight=totalWeight-familyWeight;
 return {familyPeople:family.length,familyWeight,totalWeight,poolSize:rows.length+royals,conditional:totalWeight? familyWeight/totalWeight:0,expected:totalWeight?chance*familyWeight/totalWeight:0,baselineExpected:ordinaryWeight+family.length?chance*family.length/(ordinaryWeight+family.length):0};
}
