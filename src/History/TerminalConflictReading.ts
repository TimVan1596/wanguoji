import type {WorldEvent} from './WorldHistory';

const captures=new Set(['city-captured','city-recovered','capital-fallen']);
const monthOf=(event:WorldEvent)=>event.monthIndex??event.year;
const value=(event:WorldEvent,key:string)=>typeof event.metadata?.[key]==='string'?String(event.metadata[key]):undefined;

export function terminalCaptureKind(event:WorldEvent,capture:WorldEvent){
 if(!event.historyGroupId||event.historyGroupId!==capture.historyGroupId||!captures.has(capture.type)||
  event.metadata?.terminalCaptureEventId!==capture.id||event.metadata.isFinalCityCapture!==1||
  !capture.actorFactionId||!capture.targetFactionId||!capture.cityId||
  event.targetFactionId!==capture.targetFactionId||event.conquerorFactionId!==capture.actorFactionId||
  event.metadata.cityId!==capture.cityId||monthOf(event)!==monthOf(capture))return;
 const stage=event.metadata.defeatedIdentityStage,rank=event.metadata.defeatedSovereigntyRank;
 if(event.type==='faction-dissolved'&&stage==='PROVISIONAL')return Number(event.metadata.defeatedPeakCityCount)>=3?'REGIONAL_UPRISING':'UPRISING';
 if(event.type==='faction-extinct'&&stage==='STATE')return rank==='EMPEROR'?'EMPIRE':rank==='KING'?'KINGDOM':undefined;
 return undefined;
}

export function readTerminalConflict(event:WorldEvent,capture:WorldEvent,worldMonth=Infinity){
 const kind=terminalCaptureKind(event,capture);
 if(!kind||monthOf(event)>worldMonth)return;
 return {
  kind,event,capture,city:capture.cityName??event.cityName??'最后城邑',
  victor:capture.actorFactionId!,defeated:capture.targetFactionId!,
  victorName:value(capture,'attackerNameAtEvent')??capture.actorFactionId!,
  defeatedName:value(capture,'defenderNameAtEvent')??capture.targetFactionId!,
  victorRulerId:value(event,'victorRulerId'),defeatedRulerId:value(event,'defeatedRulerId'),
  victorTitle:value(event,'victorRulerTitle'),defeatedTitle:value(event,'defeatedRulerTitle'),
  commanderId:value(capture,'commanderPersonId'),
 };
}

export function formatTerminalConflict(fact:NonNullable<ReturnType<typeof readTerminalConflict>>,view:'WORLD'|'VICTOR'|'DEFEATED'|'CITY'|'COMMANDER',commander?:string){
 const army=commander?`${commander}所部`:`${fact.victorName}军`;
 const outcome=fact.kind==='UPRISING'||fact.kind==='REGIONAL_UPRISING'?`${fact.defeatedName}遂告覆灭`:`${fact.defeatedName}遂亡`;
 const capture=`${army}攻取${fact.defeatedName}最后城邑${fact.city}，${outcome}。`;
 if(view==='CITY')return `${fact.city}由${fact.defeatedName}入${fact.victorName}，此役直接导致${outcome.replace('遂','')}。`;
 if(view==='VICTOR')return `其治下${capture}`;
 if(view==='DEFEATED')return `${capture}其个人结局另见纪年。`;
 if(view==='COMMANDER')return capture;
 const titles=[fact.victorTitle,fact.defeatedTitle].filter(Boolean);
 return capture+(titles.length?`时${titles.join('、')}执政。`:'');
}
