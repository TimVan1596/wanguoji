import {describe,expect,it} from 'vitest';
import {formatTerminalConflict,readTerminalConflict} from './TerminalConflictReading';
import type {WorldEvent} from './WorldHistory';

const capture:WorldEvent={id:'capture',year:41,title:'大梁易手',category:'war',importance:'major',type:'city-captured',actorFactionId:'qin',targetFactionId:'wei',cityId:'daliang',cityName:'大梁',historyGroupId:'same-operation',metadata:{attackerNameAtEvent:'秦',defenderNameAtEvent:'魏',commanderPersonId:'officer-1',commanderPersonalName:'蒙承',commanderOffice:'SHANGJIANGJUN'}};
const end:WorldEvent={id:'end',year:41,title:'魏亡',category:'politics',importance:'major',type:'faction-extinct',targetFactionId:'wei',conquerorFactionId:'qin',historyGroupId:'same-operation',metadata:{cityId:'daliang',terminalCaptureEventId:'capture',isFinalCityCapture:1,defeatedIdentityStage:'STATE',defeatedSovereigntyRank:'KING',victorRulerId:'qin-king',victorRulerTitle:'秦王嬴启',defeatedRulerId:'wei-king',defeatedRulerTitle:'魏王曹睿'}};

describe('one verified terminal action supports several readings',()=>{
 it('uses stable participants and historical names without implying that either ruler died or personally fought',()=>{
  const fact=readTerminalConflict(end,capture,41)!;
  expect(fact.kind).toBe('KINGDOM');
  expect(fact).toMatchObject({commanderId:'officer-1',defeatedRulerId:'wei-king',victorRulerId:'qin-king'});
  expect(formatTerminalConflict(fact,'WORLD')).toBe('秦上将军蒙承所部攻取魏最后城邑大梁，魏遂亡。时秦王嬴启、魏王曹睿执政。');
  expect(formatTerminalConflict(fact,'VICTOR')).toContain('其治下');
  expect(formatTerminalConflict(fact,'DEFEATED')).not.toMatch(/处死|殉国/);
  expect(formatTerminalConflict(fact,'CITY')).toContain('大梁由魏入秦');
  expect(formatTerminalConflict(fact,'COMMANDER')).toContain('蒙承所部');
  expect(readTerminalConflict(end,capture,40)).toBeUndefined();
 });
 it.each([
  {...end,type:'faction-exiled'},{...end,type:'faction-submitted'},{...end,year:53},
  {...end,historyGroupId:'another-war'},{...end,metadata:{...end.metadata,isFinalCityCapture:0}},
 ] as WorldEvent[])('rejects an unrelated or nonterminal result',candidate=>{
  expect(readTerminalConflict(candidate,capture)).toBeUndefined();
 });
 it('distinguishes provisional defeat, empire termination and a verified ruler-led unit',()=>{
  const raid={...end,type:'faction-dissolved' as const,metadata:{...end.metadata,defeatedIdentityStage:'PROVISIONAL',defeatedPeakCityCount:3}};
  expect(readTerminalConflict(raid,capture)?.kind).toBe('REGIONAL_UPRISING');
  const empire={...end,metadata:{...end.metadata,defeatedSovereigntyRank:'EMPEROR'}};
  expect(readTerminalConflict(empire,capture)?.kind).toBe('EMPIRE');
  const field={...capture,rulerId:'qin-king',metadata:{...capture.metadata,leaderCommandRulerId:'qin-king',leaderCommandName:'嬴启'}};
  expect(formatTerminalConflict(readTerminalConflict(end,field)!,'VICTOR')).toContain('秦王嬴启亲率');
 });
});

it('keeps attributed exile separate from permanent extinction in the world and both national histories',async()=>{
 const {groupHistoryNarratives}=await import('./HistoryNarrativeGrouper');
 const exile={...end,type:'faction-exiled' as const};
 const row=groupHistoryNarratives([capture,exile]).find(event=>event.type==='faction-exiled')!;
 expect(row.title).toContain('王室流亡，复国权源尚存');
 expect(row.title).not.toMatch(/遂亡|彻底灭亡/);
 expect(row.metadata?.terminalConflictReading).toBe(1);
});
