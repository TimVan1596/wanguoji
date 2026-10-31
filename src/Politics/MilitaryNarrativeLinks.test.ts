import {it,expect} from 'vitest';
import {militaryMilestones} from './MilitaryChroniclePresentation';
import {militaryNarrativeLinks} from './MilitaryNarrativeLinks';
import {appendMilitaryPoliticalLife} from './MilitaryPoliticalLife';
const person:any={personId:'p',personalName:'范弼',name:'resident',politicalRulerId:'king',appointments:[{commandId:'cmd',factionId:'wei',startMonth:0,endMonth:20,endReason:'DEATH'}]};
const event=(id:string,type:string,metadata:any={},extra:any={}):any=>({id,type,year:20,actorFactionId:'wei',cityId:'city',cityName:'南郑',metadata,...extra});
const entries=(events:any[])=>events.map(e=>({eventId:e.id,worldMonth:e.year,factionId:'wei',commandId:e.metadata.commandId,text:e.id,source:`${e.type} · ${e.id}`,victory:['city-recovered','city-captured'].includes(e.type)}));
it('shows one real capture and retains its exact siege source, without hiding another battle',()=>{
 const end=event('end','siege-ended',{personId:'p',commandId:'cmd',battleId:'b',reason:'CAPTURED'},{targetFactionId:'qi'}),cap=event('cap','city-recovered',{commanderPersonId:'p',commanderPersonalName:'范弼',commanderOffice:'PIJIANG',commandId:'cmd',battleId:'b',siegeEndedEventId:'end'},{targetFactionId:'qi'});
 const second=event('second','siege-ended',{personId:'p',commandId:'cmd',battleId:'other',reason:'CAPTURED'},{targetFactionId:'qi'}),otherCap=event('other-cap','city-captured',{...cap.metadata,battleId:'other',siegeEndedEventId:'second'},{targetFactionId:'qi',cityId:'different'});
 const all=[end,cap,second,otherCap],before=JSON.stringify(all),view=militaryMilestones(person,entries(all),all);
 expect(view.map(e=>e.eventId)).toEqual(['cap','second','other-cap']);expect(view[0].sourceEventIds).toContain('end');expect(view[0].text).toContain('裨将范弼所部参战');expect(JSON.stringify(all)).toBe(before);
});
it('merges real founding, old command end and first chief identity by permanent IDs',()=>{
 const end=event('leave','military-command-ended',{personId:'p',commandId:'cmd',endReason:'TRANSFERRED'}),split=event('split','empire-split',{militaryPersonId:'p',foundingRulerId:'king',militarySplitEvidence:JSON.stringify({personId:'p',commandId:'cmd',worldMonth:20,cityId:'city',sourceFactionId:'wei'}),leaderPersonId:'p',leaderOriginalFactionName:'魏',leaderSourceCityName:'南郑',foundingRulerName:'范弼',splitSource:'MILITARY'},{actorFactionId:'new',targetFactionId:'wei'});
 const projected=militaryMilestones(person,entries([end,split]),[end,split]);expect(projected.map(e=>e.eventId)).toEqual(['split']);
 const life:any={rulerId:'king',factionId:'new',foundingEventId:'split',entry:{...entries([split])[0],eventId:'accession',text:'first chief'}};
 const combined=appendMilitaryPoliticalLife(projected,life);expect(combined).toHaveLength(1);expect(combined[0].sourceEventIds).toEqual(['split','leave','accession']);expect(combined[0].text).not.toContain('first chief');
 split.metadata.foundingRulerId='another';expect(militaryNarrativeLinks(person,[end,split]).hidden.has('leave')).toBe(false);
});
it('keeps death/posthumous as the visible event and hides only causally linked cleanup',()=>{
 const death=event('death','military-person-died',{personId:'p',deathCause:'BATTLE_DEATH'}),end=event('leave','military-command-ended',{personId:'p',commandId:'cmd',endReason:'DEATH'}),withdraw=event('withdraw','siege-ended',{personId:'p',commandId:'cmd',reason:'COMMAND_ENDED',commandEndEventId:'leave'}),independent=event('repulse','siege-ended',{personId:'p',commandId:'cmd',reason:'REPULSED',attackers:2}),estate=event('estate','military-appanage',{personId:'p',appanage:JSON.stringify({personId:'p',eventId:'estate',kind:'ENDED',reason:'DEATH',sourceEventId:'death',month:20})});
 const view=militaryMilestones({...person,status:'DEAD',deathCause:'BATTLE_DEATH'},entries([end,death,withdraw,independent,estate]),[end,death,withdraw,independent,estate]);
 expect(view.map(e=>e.eventId)).toEqual(['death','repulse']);expect(view[0].text).toContain('范弼战死');expect(view[0].sourceEventIds).toContain('estate');
});
