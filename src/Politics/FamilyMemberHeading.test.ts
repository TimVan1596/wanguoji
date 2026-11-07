import {expect,it} from 'vitest';
import {familyMemberHeading,familyMemberTitleKind} from './FamilyMemberHeading';
const country=(_id:string,month:number)=>month<100?'齐国':'大齐';
const row=(extra:any={})=>({member:{name:'栾允平'},personalHistory:[],inheritedHistory:[],...extra}) as any;
it('puts an effective inherited title first without inventing an office or merging personal sources',()=>{
 const r=row({inherited:{rank:'ZI',factionId:'qi',month:60}}),before=structuredClone(r);expect(familyMemberHeading(r,80,country)).toBe('齐国 · 袭子爵 · 栾允平');expect(familyMemberTitleKind(r)).toBe('INHERITED');expect(r).toEqual(before);
});
it('uses the higher effective rank for one main title and preserves both real sources',()=>{
 const r=row({effectivePersonal:{rank:'BO',factionId:'qi'},inherited:{rank:'HOU',factionId:'qi'}});expect(familyMemberTitleKind(r)).toBe('INHERITED');expect(familyMemberHeading(r,80,country)).toContain('袭侯爵');r.effectivePersonal.rank='GONG';expect(familyMemberTitleKind(r)).toBe('PERSONAL');expect(familyMemberHeading(r,80,country)).toBe('齐国 · 公爵 · 栾允平');
});
it('keeps former inherited dignity and the country at that actual grant, not today’s renamed state',()=>{
 const r=row({inheritedHistory:[{rank:'NAN',factionId:'qi',month:60}]});expect(familyMemberHeading(r,150,country)).toBe('曾袭齐国男爵 · 栾允平');
});
it('keeps historical personal country frozen and only marks an actually recorded forfeiture',()=>{
 const r=row({personalHistory:[{rank:'BO',month:60,factionId:'qi',epochFounderId:'king',countryName:'齐'}],person:{honorHistory:[{kind:'REVOKED',month:120,factionId:'qi',epochFounderId:'king'}]}});expect(familyMemberHeading(r,80,country)).toBe('曾封齐伯爵 · 栾允平');expect(familyMemberHeading(r,150,country)).toBe('旧爵已追夺 · 栾允平');
});
it('keeps a live unrevoked peerage separate from court disqualification and a civilian bridge neutral',()=>{
 const r=row({inherited:{rank:'BO',factionId:'qi'}});expect(familyMemberHeading(r,80,country,['谋逆罢官 · 禁仕'])).toContain('袭伯爵');expect(familyMemberHeading(row(),80,country,['谋逆罢官 · 禁仕'])).toBe('栾允平 · 谋逆禁仕');expect(familyMemberHeading(row(),80,country)).toBe('栾允平');
});

it('a later independent legal grant is not obscured by an older forfeited high title',()=>{const r=row({personalHistory:[{rank:'GONG',month:60,factionId:'qi',epochFounderId:'king',countryName:'齐'},{rank:'BO',month:120,factionId:'qi',epochFounderId:'king',countryName:'齐'}],person:{honorHistory:[{kind:'REVOKED',month:90,factionId:'qi',epochFounderId:'king'}]}});expect(familyMemberHeading(r,180,country)).toBe('曾封齐伯爵 · 栾允平');});
