import {it,expect} from 'vitest';
import {mergePoliticalReading} from './PoliticalReadingProjection';
import {projectRulerHistoricalEvents} from '../Politics/RulerChronicle';
const e=(id:string,type:string,m:any={},extra:any={}):any=>({id,type,year:120,actorFactionId:'rebel',factionIds:['rebel'],importance:'major',metadata:m,...extra});
function founding(military=false){return [e('accession','ruler-acceded',{accessionIdentityStage:'PROVISIONAL',residentPersonId:'p',foundingCityId:'city',nextRulerId:'r',provisionalSeatCityId:'city'},{rulerId:'r'}),e('found','empire-split',{foundingIdentityStage:'PROVISIONAL',leaderPersonId:'p',foundingRulerId:'r',leaderSourceCityId:'city',splitSource:military?'MILITARY':'RESIDENT'},{targetFactionId:'old'})];}
it.each([false,true])('merges the original first founder identity (%s) in both world and royal reading, retaining exact source IDs',military=>{
 const events=founding(military),before=JSON.stringify(events),rows=mergePoliticalReading(events);
 expect(rows.map(x=>x.id)).toEqual(['found']);expect(rows[0].metadata!.sourceEventIds).toBe('found,accession');
 expect(projectRulerHistoricalEvents(events,{id:'r',accessionYear:120},'rebel',130,[]).all.map(x=>x.id)).toEqual(['found']);expect(JSON.stringify(events)).toBe(before);
});
it.each(['successor','state','restoration','wrong-person','wrong-seat'])('does not mistake %s for the first provisional founder',kind=>{
 const events=founding();if(kind==='successor'){events[0].type='ruler-succession';events[0].metadata.previousRulerId='prior';}if(kind==='state')events[0].metadata.accessionIdentityStage='STATE';if(kind==='restoration')events[1].type='faction-restored';if(kind==='wrong-person')events[0].rulerId='other';if(kind==='wrong-seat')events[0].metadata.provisionalSeatCityId='elsewhere';expect(mergePoliticalReading(events)).toHaveLength(2);
});
it('merges final-city dissolution and its observer confirmation but keeps a multi-year exile, a restoration or another transaction',()=>{
 const d=e('d','faction-dissolved',{isFinalCityCapture:1,cityId:'city'},{actorFactionId:undefined,targetFactionId:'rebel',historyGroupId:'capture'}),x=e('x','faction-extinct',undefined,{metadata:undefined,actorFactionId:undefined,targetFactionId:'rebel'});
 expect(mergePoliticalReading([d,x])[0].metadata!.politicalReadingKind).toBe('FINAL_END');expect(mergePoliticalReading([d,x])).toHaveLength(1);
 expect(mergePoliticalReading([d,{...x,year:348}])).toHaveLength(2);expect(mergePoliticalReading([d,{...x,historyGroupId:'different'}])).toHaveLength(2);
 expect(mergePoliticalReading([d,e('restored','faction-restored'),x])).toHaveLength(3);
 expect(mergePoliticalReading([{...d,type:'faction-exiled'},x])).toHaveLength(2);
});

it('recognizes the real final-city and world-observer records in reverse display order without changing either original',async()=>{
 const {WorldHistoryStore}=await import('./WorldHistory');const {groupHistoryNarratives}=await import('./HistoryNarrativeGrouper');
 const {formatHistoryEventTitle}=await import('./HistoryRenderRules');const history=new WorldHistoryStore();
 history.addFactionDissolved(1268,'天水义军',{isFinalCityCapture:1,cityId:'last',cityName:'天水'},'last-city');history.addFactionExtinct(1268,'天水义军');
 const before=JSON.stringify(history.exportState()),rows=groupHistoryNarratives(history.getEvents());expect(rows).toHaveLength(1);
 expect(formatHistoryEventTitle(rows[0],new Map())).toContain('失去最后据点，王统随之断绝，政权终结');
 expect(rows[0].metadata?.sourceEventIds?.toString().split(',')).toHaveLength(2);expect(JSON.stringify(history.exportState())).toBe(before);
});
