import {expect,it} from 'vitest';
import {personRankTheme} from './PersonRankTheme';
import {familyMemberDisplayRank} from '../../../Politics/FamilyMemberHeading';
it('historical dignities retain all five distinct purple grades and the actual former rank reaches the shared theme',()=>{
 const ranks=['NAN','ZI','BO','HOU','GONG'] as const;expect(new Set(ranks.map(r=>personRankTheme('HISTORICAL',r).backgroundColor)).size).toBe(5);
 for(const r of ranks){expect(personRankTheme('PERSONAL',r)).toEqual(personRankTheme('INHERITED',r));expect(personRankTheme('HISTORICAL',r).borderStyle).toBe('dashed');expect(familyMemberDisplayRank({personalHistory:[],inheritedHistory:[{rank:r}]} as any)).toBe(r);}
 expect(personRankTheme('REVOKED','GONG').backgroundColor).not.toBe(personRankTheme('PERSONAL','GONG').backgroundColor);
 expect(personRankTheme('ROYAL').backgroundColor).not.toBe(personRankTheme('MILITARY').backgroundColor);
});

it('a later legitimate lower grant supplies the same actual rank used by the history heading',()=>{const row:any={personalHistory:[{rank:'GONG',month:60,factionId:'qi',epochFounderId:'king'},{rank:'BO',month:120,factionId:'qi',epochFounderId:'king'}],inheritedHistory:[],person:{honorHistory:[{kind:'REVOKED',month:90,factionId:'qi',epochFounderId:'king'}]}};expect(familyMemberDisplayRank(row,180)).toBe('BO');});
