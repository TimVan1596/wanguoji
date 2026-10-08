import FactionLifetimeRecords from "./FactionLifetimeRecord";
import type Block from "../Components/Block";
import DynastyRegistry from "../Politics/Dynasty";
import Diplomacy from "../Politics/Diplomacy";
import WorldHistory from "../History/WorldHistory";
import type { SubmissionCandidate } from "./PeacefulSubmissionSystem";

/** Administrative absorption, never a capture. Person archives stay in their own dynasty. */
export function executePeacefulSubmission(candidate:SubmissionCandidate,month:number) {
  const {submitted,receiving,evidence,path}=candidate;
  if(submitted.status !== "ACTIVE" || receiving.status !== "ACTIVE")return false;
  const ruler=DynastyRegistry.getCurrentRuler(submitted.name),receiverRuler=DynastyRegistry.getCurrentRuler(receiving.name);
  const title=(r:typeof ruler)=>r?`${r.houseName.replace(/氏$/,"")}${r.givenName}`:undefined;
  const rulerName=title(ruler),receiverName=title(receiverRuler);
  FactionLifetimeRecords.prepareTerminal(submitted,month);
  DynastyRegistry.markSubmitted(submitted,month);
  [...submitted.users].forEach(user=>{
    if(user.role === "RULER") { user.role="NORMAL";user.rulerId=undefined;user.player.setRole("NORMAL"); }
    user.setTeam(receiving,{cause:"FACTION_SUBMISSION",month,relatedFactionId:submitted.name,context:"peaceful administrative submission"});
  });
  [...submitted.cities].forEach(city=>city.administrativeMergeTransferTo(receiving,month,"SUBMITTED"));
  ([...submitted.blocks.children.entries] as Block[]).forEach(block=>block.claimForTeam(receiving));
  submitted.markSubmitted(month,receiving.name);
  Diplomacy.removeFaction(submitted.name);
  WorldHistory.addEvent({id:`faction-submitted-${submitted.name}-${receiving.name}-${month}`,year:month,monthIndex:month,category:"politics",type:"faction-submitted",title:`${submitted.displayName}纳土归附${receiving.displayName}`,description:`${submitted.displayName}结束独立建制，城市、疆域和人口行政归入${receiving.displayName}。`,actorFactionId:submitted.name,targetFactionId:receiving.name,factionIds:[submitted.name,receiving.name],relatedFactionIds:[submitted.name,receiving.name],importance:"major",metadata:{...evidence,month,path,bothFormal:Number(evidence.bothFormal),sameOrigin:Number(evidence.sameOrigin),adjacent:Number(evidence.adjacent),submittedRulerId:ruler?.id,submittedRulerName:rulerName,receivingRulerId:receiverRuler?.id,receivingRulerName:receiverName}});
  return true;
}
