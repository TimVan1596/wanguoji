import {expect,it} from 'vitest';
import {getRulerHistoricalEvents,projectRulerHistoricalEvents} from './RulerChronicle';
import {rulerHonorEvidence} from './RulerHonorEvidence';
import {appanageReadingText} from './MilitaryAppanage';
import {formatRulerMilitaryEvent} from './MilitaryChronicle';
import {militaryReignRelation} from './RulerMilitaryBoundary';
const ruler={id:'issuer',accessionYear:0,endYear:100};
function grant(id='grant',month=30,rank='HOU'){
 const g={eventId:id,month,personId:'recipient',personalName:'熊昱',factionId:'chu',countryName:'楚',epochFounderId:'epoch',rulerId:'issuer',rulerTitle:'楚王熊启',rank,previousRank:'NONE'};
 return {id,type:'military-ennobled',year:month,actorFactionId:'chu',factionIds:['chu'],rulerId:'issuer',title:'真实授爵',importance:'major',metadata:{personId:'recipient',nobility:JSON.stringify(g)}} as any;
}
it('attributes a real grant to its issuer, never to its recipient or the next ruler',()=>{
 const e=grant();expect(getRulerHistoricalEvents([e],ruler,'chu',100,[],Infinity)).toEqual([e]);
 expect(getRulerHistoricalEvents([e],{id:'recipient',accessionYear:30},'chu',100,[],Infinity)).toEqual([]);
 expect(rulerHonorEvidence({...e,rulerId:'recipient'},'recipient','chu')).toBeUndefined();
 expect(getRulerHistoricalEvents([e],{...ruler,accessionYear:31},'chu',100,[],Infinity)).toEqual([]);
});
it('merges only cross-referenced same-month grant and estate in complete royal reading and retains both IDs',()=>{
 const e=grant(),g=JSON.parse(e.metadata.nobility),a={...g,kind:'GRANTED',eventId:'estate',grantEventId:'estate',nobleGrantEventId:e.id,cityId:'jiangling',cityName:'江陵'};
 const estate:any={id:'estate',type:'military-appanage',year:30,actorFactionId:'chu',factionIds:['chu'],rulerId:'issuer',cityId:'jiangling',metadata:{personId:'recipient',appanage:JSON.stringify(a)}};
 const before=JSON.stringify([e,estate]),rows=getRulerHistoricalEvents([e,estate],ruler,'chu',100,[],Infinity);
 expect(rows).toHaveLength(1);expect(rows[0].title).toContain('楚王熊启');expect(rows[0].title).toContain('江陵');expect(rows[0].metadata?.sourceEventIds).toBe('grant,estate');expect(JSON.stringify([e,estate])).toBe(before);
});
it('keeps honors bounded and cannot displace accession, capital loss, restoration or deposition',()=>{
 const anchors:any[]=[{id:'a',type:'ruler-acceded',year:0,rulerId:'issuer',actorFactionId:'chu',factionIds:['chu']},{id:'loss',type:'capital-fallen',year:35,actorFactionId:'enemy',targetFactionId:'chu',previousOwnerFactionId:'chu',factionIds:['chu'],importance:'major'},{id:'restore',type:'faction-restored',year:40,actorFactionId:'chu',factionIds:['chu'],importance:'major'},{id:'dep',type:'ruler-deposed',year:100,actorFactionId:'chu',factionIds:['chu'],metadata:{previousRulerId:'issuer',nextRulerId:'next'}}];
 const rows=getRulerHistoricalEvents([...anchors,...Array.from({length:30},(_,i)=>grant('g'+i,50+i))],ruler,'chu',100,[],8);
 expect(rows).toHaveLength(8);for(const a of anchors)expect(rows.some(e=>e.id===a.id)).toBe(true);
});
it('uses known canonical sequence for same-month accession, regardless of input sorting, and uses neutral text without it',()=>{
 const battle:any={id:'city-captured-12-chu-42',type:'city-captured',year:12,actorFactionId:'chu',targetFactionId:'qi',cityId:'quyang',cityName:'曲阳',metadata:{commanderPersonId:'p',commandId:'c',commanderPersonalName:'熊昱',commanderOffice:'JIANGJUN'}};
 const accession:any={id:'ruler-acceded-12-chu-熊昱-43',type:'ruler-acceded',year:12,actorFactionId:'chu',rulerId:'new'},r={id:'new',accessionYear:12};
 expect(militaryReignRelation(battle,r,'chu',[accession,battle])).toBe('BEFORE');
 expect(getRulerHistoricalEvents([battle,accession],r,'chu',100,[],Infinity).some(e=>e.id===battle.id)).toBe(false);
 expect(militaryReignRelation({...battle,id:'city-captured-12-chu-44'},r,'chu',[battle,accession])).toBe('DURING');
 const text=formatRulerMilitaryEvent({...battle,id:'unknown'},r,'chu',100,{events:[accession]});expect(text).toContain('与君位更替同月');expect(text).not.toContain('其治下');expect(text).not.toContain('亲征');
});
it('separates estate loss, restoration and each actual termination cause without declaring a revocation',()=>{
 const a:any={cityName:'江陵',personalName:'熊昱',countryName:'楚',rulerTitle:'楚王熊启'};
 expect(appanageReadingText({...a,kind:'LOST'})).toBe('江陵失于他国，食邑失效。');
 expect(appanageReadingText({...a,kind:'RESTORED'})).toContain('食邑恢复');
 expect(appanageReadingText({...a,kind:'ENDED',reason:'CITY_DESTROYED'})).toBe('江陵城废毁，食邑终止。');
 expect(appanageReadingText({...a,kind:'ENDED',reason:'DEATH'})).toBe('熊昱去世，江陵食邑终止。');
 expect(appanageReadingText({...a,kind:'ENDED',reason:'TRANSFER'})).not.toContain('夺爵');
});

it('prioritizes important peerages over an earlier merged barony, and only explicitly verified royal recipients get kin priority',()=>{
 const bo=grant('bo',10,'BO'),hou=grant('hou',30,'HOU');
 const g=JSON.parse(bo.metadata.nobility),estate:any={id:'estate',type:'military-appanage',year:10,actorFactionId:'chu',factionIds:['chu'],rulerId:'issuer',cityId:'jiangling',metadata:{personId:'recipient',appanage:JSON.stringify({...g,kind:'GRANTED',eventId:'estate',grantEventId:'estate',nobleGrantEventId:'bo',cityId:'jiangling',cityName:'江陵'})}};
 expect(getRulerHistoricalEvents([bo,estate,hou],ruler,'chu',100,[],1)[0].id).toBe('hou');
 const earlier=grant('earlier',20,'HOU'),royal=grant('royal',21,'HOU');royal.metadata.personId='verified-royal';const p=JSON.parse(royal.metadata.nobility);p.personId='verified-royal';royal.metadata.nobility=JSON.stringify(p);
 expect(projectRulerHistoricalEvents([earlier,royal],ruler,'chu',100,[],new Set(['verified-royal'])).select(1)[0].id).toBe('royal');
});
