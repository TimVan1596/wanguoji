import type {MilitaryFamily} from './MilitaryFamily';
/** Period boundaries are sourced acts. Replacement never rewrites a previous act. */
export function familyNoblePeriods(f:MilitaryFamily,month:number){
 const acts=(f.nobleSuccession??[]).filter(a=>a.month<=month),starts=acts.filter(a=>a.kind==='STARTED');
 const independent=starts.some(act=>act.period===1);
 return (independent?starts:[undefined,...starts]).map((start,i)=>{
  const number=start?.period??1,rows=acts.filter(a=>(a.period??1)===number),end=rows.find(a=>a.kind==='ENDED'),replacement=independent?undefined:starts[i];
  return {number,start,factionId:start?.factionId??f.factionId,epochFounderId:start?.epochFounderId??f.epochFounderId,sourceGrantEventId:start?.sourceGrantEventId??acts.find(a=>!a.period)?.sourceGrantEventId,holderMemberId:end?undefined:rows.at(-1)?.holderMemberId??start?.holderMemberId??f.members[0]?.memberId,acts:rows,successions:rows.filter(a=>a.kind==='SUCCEEDED').length,endMonth:end?.month??replacement?.month,endReason:end?.reason??(replacement?'SUPERSEDED':undefined)};
 });
}
