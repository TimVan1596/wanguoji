import {expect,it} from 'vitest';
import {personRankTheme} from './PersonRankTheme';
import {familyMemberDisplayRank} from '../../../Politics/FamilyMemberHeading';
it('historical dignities retain all five distinct purple grades and the actual former rank reaches the shared theme',()=>{
 const ranks=['NAN','ZI','BO','HOU','GONG'] as const;expect(new Set(ranks.map(r=>personRankTheme('HISTORICAL',r).backgroundColor)).size).toBe(5);
 for(const r of ranks){expect(personRankTheme('PERSONAL',r)).toEqual(personRankTheme('INHERITED',r));expect(personRankTheme('HISTORICAL',r).borderStyle).toBe('dashed');expect(familyMemberDisplayRank({personalHistory:[],inheritedHistory:[{rank:r}]} as any)).toBe(r);}
 expect(personRankTheme('REVOKED','GONG').backgroundColor).not.toBe(personRankTheme('PERSONAL','GONG').backgroundColor);
 expect(personRankTheme('ROYAL').backgroundColor).not.toBe(personRankTheme('MILITARY').backgroundColor);
});
