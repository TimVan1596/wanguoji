import type {WorldEvent} from '../History/WorldHistory';
import type {MilitaryPerson} from './MilitaryCommandRegistry';
/** Frozen committed award sources only; later military promotions are not court rewards. */
export function courtServiceReadings(person:Pick<MilitaryPerson,'personId'>,events:readonly WorldEvent[],month:number){
 const byId=new Map(events.filter(e=>(e.monthIndex??e.year)<=month).map(e=>[e.id,e]));
 return [...byId.values()].filter(e=>e.type==='court-service-granted'&&e.metadata?.personId===person.personId).flatMap(service=>{
  const m=service.metadata!,result=byId.get(String(m.courtResultEventId)),attempt=byId.get(String(m.courtCoupEventId));
  if(!attempt||attempt.type!=='court-coup-attempt'||!result||result.type!=='court-coup-result'||result.metadata?.outcome!=='SUCCESS'||result.metadata?.courtCoupEventId!==attempt.id||result.metadata?.personId!==person.personId||result.rulerId!==service.rulerId||result.actorFactionId!==service.actorFactionId)return [];
  const reward=[...byId.values()].find(e=>e.type==='court-reward-granted'&&e.actorFactionId===service.actorFactionId&&e.rulerId===service.rulerId&&e.metadata?.personId===person.personId&&e.metadata?.courtServiceEventId===service.id);
  const grant=reward&&byId.get(String(reward.metadata?.nobleGrantEventId));
  const peerage=grant?.type==='military-ennobled'&&grant.actorFactionId===service.actorFactionId&&grant.rulerId===service.rulerId&&grant.metadata?.personId===person.personId&&grant.metadata?.courtServiceEventId===service.id?grant:undefined;
  const before=Number(m.loyaltyBefore),after=Number(m.loyaltyAfter),delta=Number.isFinite(before)&&Number.isFinite(after)?after-before:0;
  return [{eventId:service.id,month:service.monthIndex??service.year,rulerId:service.rulerId,text:`${service.title}${peerage?reward!.title:'当次未获新的正式军功爵赏；从龙功绩与本人军功分别记载。'}${delta>0?`君臣关系改善（忠诚增加${delta}）。`:''}`,sourceEventIds:[attempt.id,result.id,service.id,...(peerage?[reward!.id,peerage.id]:[])]}];
 });
}
