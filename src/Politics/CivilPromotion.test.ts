import {expect,it} from 'vitest';
import {civilPromotionEvidence} from './CivilPromotion';
import {personAbilities} from './PersonAbilities';
import {civilOfficeTitle,centralCivilOfficeAvailable} from './CivilOffice';
const source=Array.from({length:100},(_,i)=>i+1).find(id=>personAbilities({kind:'RESIDENT',sourceUserId:id,bornMonth:-240}).strategy>=80)!;
const term=(office='XIANLING')=>({office,assignmentId:'old',personId:'p',sourceUserId:source,bornMonth:-240,startMonth:0,factionId:'qin',receipts:Array.from({length:6},(_,i)=>({eventId:`effect-${i}`,month:(i+1)*12,loyalty:1,devastation:1}))} as any);
it('requires actual annual recovery receipts, tenure and political loyalty rather than ability alone',()=>{
 const t=term();expect(civilPromotionEvidence(t,36,70,2,[t])?.fromOffice).toBe('XIANLING');
 expect(civilPromotionEvidence({...t,receipts:[]},120,100,2,[])).toBeUndefined();expect(civilPromotionEvidence(t,24,100,2,[])).toBeUndefined();expect(civilPromotionEvidence(t,36,49,2,[])).toBeUndefined();expect(civilPromotionEvidence({...t,endMonth:24},36,100,2,[])).toBeUndefined();
});
it('separates central jurisdictions and preserves the existing total national capacity',()=>{
 const t=term('JUNSHOU');expect(civilOfficeTitle({office:'CHENGXIANG',cityName:'咸阳'})).toBe('丞相');expect(civilPromotionEvidence(t,72,100,4,[])).toBeUndefined();expect(civilPromotionEvidence(t,72,100,5,[])?.fromOffice).toBe('JUNSHOU');
 expect(centralCivilOfficeAvailable('YUSHI_DAFU',5,[{office:'YUSHI_DAFU',factionId:'qin'}],'qin')).toBe(false);expect(centralCivilOfficeAvailable('CHENGXIANG',8,[],'qin')).toBe(false);
});
