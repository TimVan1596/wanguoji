import {personNoblePresentation} from './PersonNoblePresentation';
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

it('a pardon does not restore a formally forfeited inherited title, while a later real grant can supply a new historical color',()=>{const family:any={factionId:'qi',epochFounderId:'old',members:[{memberId:'m'}],nobleSuccession:[{kind:'SUCCEEDED',holderMemberId:'m',rank:'BO',month:50,period:1},{kind:'ENDED',reason:'FORFEITED',previousMemberId:'m',month:100,period:1}]};const p:any={nobilityHistory:[],honorHistory:[],politicalHistory:[{kind:'COURT_PARDONED',month:150}]};expect(personNoblePresentation(p,family,'m','qi',undefined,180)?.kind).toBe('REVOKED');family.nobleSuccession.push({kind:'SUCCEEDED',holderMemberId:'m',rank:'NAN',month:200,period:2});expect(personNoblePresentation(p,family,'m','qi',undefined,240)).toMatchObject({kind:'HISTORICAL',rank:'NAN'});});

it('uses one identity priority and keeps former offices colored without calling deposition treason',async()=>{
 const {resolvePersonTheme}=await import('./PersonRankTheme');
 expect(resolvePersonTheme({monarch:true}).backgroundColor).not.toBe(resolvePersonTheme({}).backgroundColor);
 expect(resolvePersonTheme({officeKind:'武官',historical:true}).backgroundColor).not.toBe(resolvePersonTheme({}).backgroundColor);
 expect(resolvePersonTheme({officeKind:'文官',historical:true}).backgroundColor).not.toBe(resolvePersonTheme({}).backgroundColor);
 expect(resolvePersonTheme({deposed:true}).backgroundColor).not.toBe(resolvePersonTheme({sanction:true}).backgroundColor);
 expect(resolvePersonTheme({current:true,noble:{kind:'PERSONAL',rank:'GONG'}})).toEqual(resolvePersonTheme({current:true}));
 expect(resolvePersonTheme({noble:{kind:'PERSONAL',rank:'BO'},officeKind:'武官'})).toEqual(resolvePersonTheme({noble:{kind:'PERSONAL',rank:'BO'}}));
});
