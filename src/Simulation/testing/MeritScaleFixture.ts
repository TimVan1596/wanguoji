import type {MilitaryPerson,MilitaryFormation} from './MilitaryCommandRegistry';
import type {WorldEvent} from '../History/WorldHistory';
/** UI load fixtures with explicit event evidence, not natural world residents. */
export function fixture(n=12){
 const people:MilitaryPerson[]=[],formations:MilitaryFormation[]=[],events:WorldEvent[]=[];
 const add=(e:any)=>events.push(e);
 for(let i=0;i<n;i++){
  const personId=`p-${i}`,commandId=`c-${i}`,factionId=i%4===0?'b':'a',p:MilitaryPerson={personId,sourceUserId:i,name:'label-'+i,personalName:'同名',bornMonth:-300,factionId,status:i%3?'DEAD':'ACTIVE',deathMonth:i%3?40:undefined,appointments:[{factionId,commandId,startMonth:0,endMonth:i%3?40:undefined}],capturedEventIds:[]},f:MilitaryFormation={commandId,commanderPersonId:personId,factionId,status:p.status==='ACTIVE'?'ACTIVE':'DISBANDED',memberUnitIds:['u-'+i],createdMonth:0,captures:[]};
  people.push(p);formations.push(f);add({id:'appt-'+i,type:'military-appointment',year:0,actorFactionId:factionId,metadata:{personId,commandId,unitCount:1}});
  if(i%3===1){for(let j=0;j<2;j++){const id=`capture-${i}-${j}`,cityId='town-'+i;add({id,type:'city-captured',year:12+j,cityId,actorFactionId:factionId,targetFactionId:'enemy',metadata:{commanderPersonId:personId,commandId,wasCapital:1}});p.capturedEventIds.push(id);f.captures.push({eventId:id,cityId,month:12+j});}}
  if(i%3===2){const battleId='battle-'+i,cityId='fort-'+i;add({id:'start-'+i,type:'siege-started',year:12,cityId,actorFactionId:'enemy',targetFactionId:factionId,metadata:{battleId}});add({id:'end-'+i,type:'siege-ended',year:18,cityId,actorFactionId:'enemy',targetFactionId:factionId,metadata:{battleId,reason:'REPULSED',defenders:2}});add({id:'defense-'+i,type:'siege-defended',year:18,cityId,actorFactionId:factionId,targetFactionId:'enemy',metadata:{battleId,personId,commandId,defenders:2}});}
 }
 return {people,formations,events};
}
