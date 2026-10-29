import {it,expect} from 'vitest';
import {createRoyalReadingProjection,type RoyalReadingInput} from './RoyalReadingProjection';
import {createRulerChronicle,getRulerHistoricalEvents,getRulerDiplomaticEvents} from '../../../Politics/RulerChronicle';
import {deriveRulerAssessment} from '../../../Politics/RulerHistoriography';
import random from '../../../Simulation/WorldRandom';
function fixture():RoyalReadingInput {
 const chronicle=createRulerChronicle({month:0,population:10,territoryShare:.1,cityCount:2,stability:70});chronicle.endSnapshot={month:24,population:12,territoryShare:.2,cityCount:3,stability:75};
 const ruler:any={id:'r',houseName:'姬氏',givenName:'敬宣',bornYear:-480,accessionYear:0,endYear:24,deathMonth:24,deathReason:'自然去世',status:'dead',reignOrdinal:1,chronicle};
 const events:any[]=[{id:'accession',type:'ruler-acceded',year:0,category:'politics',actorFactionId:'yan',factionIds:['yan'],rulerId:'r',title:'即位',importance:'normal'},{id:'death',type:'ruler-died',year:24,category:'politics',actorFactionId:'yan',factionIds:['yan'],rulerId:'r',title:'去世',importance:'normal'}];
 return {ruler,rulers:[ruler],team:{name:'yan'},worldMonth:120,events,allEvents:events,people:[],formations:[],factions:new Map()};
}
it('shares one complete chronicle projection while retaining exact old selected, complete, diplomatic and assessment results',()=>{
 const a=fixture(),before=JSON.stringify(a),rng=random.exportState(),c=createRoyalReadingProjection(),v=c.get(a);
 expect(v.evidence).toEqual(deriveRulerAssessment({ruler:a.ruler,dynasty:{rulers:a.rulers},faction:a.team,events:a.events,worldMonth:a.worldMonth}).evidence);
 expect(v.full).toEqual(getRulerHistoricalEvents(a.events,a.ruler,a.team.name,a.worldMonth,a.ruler.chronicle.notableEventIds,Infinity));expect(v.selected).toEqual(getRulerHistoricalEvents(a.events,a.ruler,a.team.name,a.worldMonth,[],8));expect(v.diplomacy).toEqual(getRulerDiplomaticEvents(a.events,a.ruler,a.team.name,a.worldMonth));
 const later:any={id:'future',year:121,type:'city-founded',actorFactionId:'foreign'};expect(c.get({...a,worldMonth:121,events:[...a.events,later],allEvents:[...a.allEvents,later]})).toBe(v);expect(c.diagnostics()).toEqual({builds:1,hits:1,entries:1});expect(JSON.stringify(a)).toBe(before);expect(random.exportState()).toEqual(rng);
});
it('invalidates for backdated facts, same-ID hydration, mutable ruler records, and earlier family deaths',()=>{
 const a=fixture(),c=createRoyalReadingProjection(),old=c.get(a),late:any={id:'backdated',type:'city-captured',year:12,actorFactionId:'yan',targetFactionId:'enemy',rulerId:'r',cityId:'c',metadata:{wasCapital:0},importance:'major'};
 a.events=[...a.events,late];a.allEvents=a.events;expect(c.get(a)).not.toBe(old);const v=c.get(a);a.ruler.chronicle.peakTerritoryShare=.5;expect(c.get(a)).not.toBe(v);const changed=c.get(a);a.rulers.push({id:'child',parentId:'r',bornYear:-200,deathMonth:12,deathReason:'自然去世',status:'dead'} as any);expect(c.get(a).evidence.predeceasedHeirCount).toBe(1);expect(c.get(a)).not.toBe(changed);
 const before=c.get(a),loaded=structuredClone(a);expect(c.get(loaded)).not.toBe(before);expect(c.get(loaded)).toEqual(before);
});
it('keeps cache ownership and live months distinct and bounds retained people without losing access',()=>{
 const a=fixture(),c=createRoyalReadingProjection();delete a.ruler.endYear;delete a.ruler.deathMonth;a.ruler.status='ruling';const v=c.get(a);expect(c.get({...a,worldMonth:121})).not.toBe(v);
 for(let i=0;i<30;i++){const x=fixture();x.ruler.id='r'+i;c.get(x);}expect(c.diagnostics().entries).toBe(24);const foreign=fixture();foreign.team.name='other';expect(c.get(foreign).evidence.factionId).toBe('other');
});
