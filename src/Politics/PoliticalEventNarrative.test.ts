import {expect,it} from 'vitest';
import {capturePoliticalCrisis,formatPoliticalEvent} from './PoliticalEventNarrative';
import {chooseDepositionClaimant,type DepositionEvaluation} from './InReignDeposition';
import {formatFoundingIdentity} from '../History/FoundingIdentityNarrative';
import random from '../Simulation/WorldRandom';

function event():any{
 const loss:any={id:'loss',year:100,monthIndex:100,type:'city-captured',cityId:'old-city',cityName:'临淄',historyGroupId:'battle-1',metadata:{wasCapital:1}};
 const other={...loss,id:'capital-view',type:'capital-fallen'};
 const politicalCrisis=capturePoliticalCrisis({kind:'DEPOSITION',factionId:'qi',countryName:'齐',worldMonth:108,cityCount:2,stability:93,successorBornMonth:-240,capitalCityId:'seat',capitalCityName:'即墨'},['loss','capital-view'],[loss,other]);
 return {id:'deposition',year:108,type:'ruler-deposed',actorFactionId:'qi',rulerId:'next',metadata:{politicalCrisis:JSON.stringify(politicalCrisis),previousRulerName:'田平',nextRulerName:'田启',nextRulerId:'next',relation:'SIBLING'}};
}
it('uses dated original city and political snapshots, collapses two views of one capture, and invents no endorsement',()=>{
 const e=event(),before=JSON.stringify(e),rng=random.exportState(),text=formatPoliticalEvent(e)!;
 expect(text.match(/临淄失都/g)).toHaveLength(1);expect(text).toContain('国有2城');expect(text).toContain('民心尚稳');expect(text).toContain('其兄弟田启继位，时年29岁');expect(text).toContain('国都仍在即墨');
 expect(text).not.toMatch(/军心|推戴|统兵支持|条件|权重|系统|概率/);
 expect(JSON.stringify(e)).toBe(before);expect(random.exportState()).toEqual(rng);
 const round=JSON.parse(JSON.stringify(e));expect(formatPoliticalEvent(round)).toBe(text);
});
it('separates a real supporter from the winner, including an unsuccessful endorsement',()=>{
 const e=event();e.metadata.militaryParticipation=JSON.stringify({participant:{personId:'officer',personalName:'程远',officeStanding:{office:'JIANGJUN'}}});
 e.metadata.depositionSelection=JSON.stringify({support:{personId:'officer',name:'程远',rulerName:'田昭',rulerId:'loser'}});
 const text=formatPoliticalEvent(e)!;expect(text).toContain('将军程远统兵支持田昭');expect(text).toContain('终由另一宗室获位');expect(text).not.toContain('程远继位');
 delete e.metadata.depositionSelection;expect(formatPoliticalEvent(e)).toContain('统兵参与废立');expect(formatPoliticalEvent(e)).not.toContain('统兵支持');
});
it('allows the lower weighted real adult claimant to accede without changing the original draw or claiming support',()=>{
 const a:any={id:'a',houseName:'田氏',givenName:'长',bornYear:-400},b:any={id:'b',houseName:'田氏',givenName:'少',bornYear:-120};
 const evaluation:DepositionEvaluation={eligible:true,blockers:[],candidates:[{ruler:a,relation:'DIRECT_CHILD'},{ruler:b,relation:'NEPHEW'}],evidence:[],probability:.01,vulnerability:true};
 const rng=random.exportState(),choice=chooseDepositionClaimant(evaluation,108,.00999)!;
 expect(choice.claimant.ruler.id).toBe('b');expect(choice.evidence.candidates.find(c=>c.rulerId==='b')!.weight).toBeLessThan(choice.evidence.candidates.find(c=>c.rulerId==='a')!.weight);
 expect(choice.evidence.support).toBeUndefined();expect(random.exportState()).toEqual(rng);
});
it('records a cautious actual secessionist from frozen siege/follower evidence without backdating confiscation or motives',()=>{
 const e:any={type:'empire-split',year:456,targetFactionId:'yan',metadata:{foundingRulerName:'齐允清',leaderSourceCityName:'新郑',leaderOriginalFactionName:'燕',leaderPersonId:'officer',foundingIdentityStage:'PROVISIONAL',splitSource:'MILITARY',militarySplitEvidence:JSON.stringify({personId:'officer',personalName:'齐允清',office:'SHANGJIANGJUN',participants:[{},{}],disposition:{ambition:20,loyalty:30},localCrisis:{reason:'MILITARY_SIEGE_CRISIS',supporterKind:'COMMAND_FOLLOWER',facts:{underSiege:true,lastSiegeDamageMonth:455}}})}};
 const text=formatFoundingIdentity(e,'新郑义军')!;
 expect(text).toContain('新郑正遭围攻');expect(text).toContain('燕上将军齐允清');expect(text).toContain('率1名旧部');expect(text).toContain('谨慎、忠诚较低');expect(text).toContain('当地响应者即随行旧部');expect(text).toContain('旧任随起事终止');
 expect(text).not.toMatch(/野心勃勃|被迫|愤恨|夺爵.*起事|食邑.*起事|绝不会/);
 expect(formatFoundingIdentity(e,'新郑义军','yan')).toContain('举兵叛离');
});
