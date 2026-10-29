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
