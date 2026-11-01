import {it,expect} from 'vitest';
import {chronicleReadingText,formatChronicleDate} from './ChronicleReading';
import random from '../Simulation/WorldRandom';
it('writes a sourced succession as a chronicle, retaining the actual capital and no invented kinship',()=>{
 const prior:any={id:'prior',type:'state-founded',year:100,actorFactionId:'yan',metadata:{capitalCityId:'ji'}},e:any={id:'succession',type:'ruler-succession',year:1131,actorFactionId:'yan',metadata:{nextRulerName:'姬珩',accessionCapitalVersion:1,accessionCapitalState:'CAPITAL',capitalControlled:1,capitalCityId:'ji',capitalCityName:'蓟',accessionFactionId:'yan',accessionMonth:1131}};
 const base='燕王姬敬宣薨，姬珩继位 · 继位时国都：蓟',before=JSON.stringify([e,prior]),rng=random.exportState();
 expect(chronicleReadingText(e,base,[prior,e])).toBe('燕王姬敬宣薨，姬珩嗣位，仍都蓟。');expect(chronicleReadingText(e,base,[e])).toBe('燕王姬敬宣薨，姬珩嗣位，都蓟。');
 const loss:any={id:'loss',type:'capital-fallen',year:1100,targetFactionId:'yan'};expect(chronicleReadingText(e,base,[prior,loss,e])).not.toContain('仍都');expect(chronicleReadingText(e,base,[e])).not.toMatch(/其子|弟|亲命|大捷/);expect(JSON.stringify([e,prior])).toBe(before);expect(random.exportState()).toEqual(rng);
});
it('uses historical month names across the era boundary without changing month indexes',()=>{expect(formatChronicleDate(1128)).toBe('94年正月');expect(formatChronicleDate(1131)).toBe('94年四月');expect(formatChronicleDate(0)).toBe('0年正月');expect(formatChronicleDate(-1)).not.toMatch(/0月|-\d+月|undefined/);});
it('does not infer a capital for missing, exiled or provisional accession evidence',()=>{const e:any={type:'ruler-succession',year:1,actorFactionId:'yan',metadata:{nextRulerName:'甲'}};expect(chronicleReadingText(e,'甲继位 · 继位时国都：未记录',[])).toBe('甲嗣位，国都未载。');e.metadata.accessionCapitalState='EXILED';expect(chronicleReadingText(e,'甲继位',[])).toContain('时无实际国都');});

it.each(['dynasty-usurped','ruler-deposed'])('retains the structured political capital exactly once in %s instead of appending it twice',async type=>{
 const {formatPoliticalEvent}=await import('../Politics/PoliticalEventNarrative');const {formatHistoryEventTitle}=await import('./HistoryRenderRules');
 const m:any={previousRulerName:'旧君',nextRulerName:'新君',predecessorRulerName:'旧君',displacedSuccessorName:'继嗣',oldHouseName:'熊氏',newHouseName:'欧阳氏',oldStateName:'楚',newStateName:'州',newRulerName:'欧阳珣',relation:'DIRECT_CHILD',successionReason:'natural',accessionCapitalVersion:1,accessionCapitalState:'CAPITAL',capitalControlled:1,capitalCityId:'wenzhou',capitalCityName:'温州',accessionFactionId:'chu',accessionMonth:2902};
 const e:any={id:'change',type,year:2902,actorFactionId:'chu',metadata:m};m.politicalCrisis=JSON.stringify({version:1,kind:type==='ruler-deposed'?'DEPOSITION':'REVOLUTION',factionId:'chu',worldMonth:2902,countryName:'楚',cityCount:2,stability:50,capitalCityId:'wenzhou',capitalCityName:'温州',successorBornMonth:2400,facts:[]});
 const base=formatHistoryEventTitle(e,new Map()),raw=JSON.stringify(e);expect(base).toBe(formatPoliticalEvent(e));const text=chronicleReadingText(e,base,[e]);expect(text.split('温州')).toHaveLength(2);expect(text).not.toContain('仍都温州');
 const migration:any={id:'move',type:'capital-relocated',year:2902,actorFactionId:'chu',metadata:{oldCapitalId:'wenzhou',newCapitalId:'new',newCapitalName:'新都'}};expect(chronicleReadingText(e,base,[e,migration])).toBe(text);expect(migration.metadata.newCapitalName).toBe('新都');expect(JSON.stringify(e)).toBe(raw);
 m.accessionCapitalState='EXILED';delete m.capitalCityId;delete m.capitalCityName;const s=JSON.parse(m.politicalCrisis);delete s.capitalCityId;delete s.capitalCityName;m.politicalCrisis=JSON.stringify(s);expect(chronicleReadingText(e,formatHistoryEventTitle(e,new Map()),[e])).toContain('时无实际国都');
});
