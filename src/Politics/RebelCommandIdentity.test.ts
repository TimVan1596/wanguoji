import {expect,it} from 'vitest';
import {rebelFounderCommand} from './RebelCommandIdentity';
it('derives political command from a real founding, preserves it across formal statehood and invents no military office',()=>{
 const r:any={id:'r',accessionYear:12},f={name:'rebel',origin:{foundingRulerId:'r',type:'REBEL'},stateFoundedMonth:24},e:any={id:'source',year:12,type:'rebel-faction-founded',actorFactionId:'rebel',rulerId:'r'};
 expect(rebelFounderCommand(r,f,[e],12)).toEqual({label:'起义首领／义军统帅',eventId:'source'});
 expect(rebelFounderCommand(r,f,[e],30)?.label).toContain('建势时');
 expect(rebelFounderCommand(r,f,[],30)).toBeUndefined();expect(rebelFounderCommand({...r,id:'other'},f,[e],30)).toBeUndefined();expect(rebelFounderCommand(r,f,[e],11)).toBeUndefined();
});
