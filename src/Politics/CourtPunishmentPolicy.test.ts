import {expect,it} from 'vitest';
import {courtFailureSeverity,militaryCourtText,militaryCourtLabels} from './MilitaryCourtStanding';
import random from '../Simulation/WorldRandom';
const record=(self=false,units=4,stability=70):any=>({participant:{unitCount:units,officeStanding:{office:'SHANGJIANGJUN'},disposition:{ambition:100,loyalty:0}},target:{basis:self?'SELF':'KINSHIP'},stability,crisisEventIds:['real-capital-a','real-capital-b']});
it('keeps limited dismissals, severe forfeiture and sourced lethal outcomes distinct without another draw',()=>{
 const rng=random.exportState();expect(courtFailureSeverity(record(false,2),'HIGH')).toBe('DISMISSAL');expect(courtFailureSeverity(record(),'BASELINE')).toBe('FORFEITURE');expect(courtFailureSeverity(record(),'LOW')).toBe('FORFEITURE');expect(courtFailureSeverity(record(),'MEDIUM')).toBe('EXECUTION');expect(courtFailureSeverity(record(true,3,60),'MEDIUM')).toBe('EXECUTION');expect(courtFailureSeverity(record(true,3,60),'LOW')).toBe('FORFEITURE');expect(random.exportState()).toEqual(rng);
});
it('ambition or a weak court alone cannot turn an ordinary failed supporter into an execution',()=>{
 expect(courtFailureSeverity(record(false,3),'MEDIUM')).toBe('FORFEITURE');expect(courtFailureSeverity(record(true,4,20),'HIGH')).toBe('FORFEITURE');expect(courtFailureSeverity({...record(),crisisEventIds:['one']},'MEDIUM')).toBe('FORFEITURE');expect(courtFailureSeverity({...record(),participant:{...record().participant,officeStanding:{office:'XIAOWEI'}}},'MEDIUM')).toBe('DISMISSAL');
});
it('public judgement distinguishes the death from a living ban and cannot imply a pardon',()=>{
 const act:any={kind:'COURT_BAN',severity:'EXECUTION',rulerTitle:'燕王',personalName:'陈晞',month:12,factionId:'yan'};expect(militaryCourtText(act)).toContain('判其伏诛');expect(militaryCourtLabels({politicalHistory:[act]} as any,'yan',12)).toEqual(['因谋逆伏诛']);expect(militaryCourtLabels({politicalHistory:[act]} as any,'yan',11)).toEqual([]);
});
