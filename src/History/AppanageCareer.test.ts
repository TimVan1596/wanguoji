import {it,expect} from 'vitest';
import {daliangAppanageFixture} from '../Simulation/testing/CityAppanageViewFixture';
import {cityAppanageHistory,prepareAppanageHistory} from './CityAppanageHistory';
import {appanageCareer,appanageEffectiveWindows} from './AppanageCareer';
import {appanageLatestPortrait,appanagePortrait} from '../UI/Components/CityDetails/AppanagePresentation';
function fixture(){
 const x=daliangAppanageFixture(),p=x.people[1],a=p.appanageHistory![0],command=p.appointments[0].commandId;
 const add=(id:string,type:string,month:number,metadata:any={},extra:any={})=>x.events.push({id,type,year:month,monthIndex:month,actorFactionId:a.factionId,factionIds:[a.factionId],metadata:{personId:p.personId,commandId:command,...metadata},...extra} as any);
 const office={office:'JIANGJUN' as const,eventId:'promote',month:1600,serviceMonths:100,captureEventIds:[]};p.appointments[0].officeHistory!.push(office);add('promote','military-office-granted',1600,{office:'JIANGJUN',previousOffice:'PIJIANG'});
 const formation:any={commandId:command,commanderPersonId:p.personId,factionId:a.factionId,status:'DISBANDED',createdMonth:1500,memberUnitIds:[],captures:[]};
 for(const [id,month] of [['valid',1601],['lost-period',1660],['restored-period',1670],['after-death',1680]] as const){add(id,'city-recovered',month,{commanderPersonId:p.personId,commanderPersonalName:p.personalName,commanderOffice:'JIANGJUN',wasCapital:0},{cityId:'other-city',cityName:'郢',targetFactionId:'enemy'});p.capturedEventIds.push(id);formation.captures.push({eventId:id,cityId:'other-city',month});}
 // Stable sort retains transaction order within a month.
 x.events.sort((a,b)=>(a.monthIndex??a.year)-(b.monthIndex??b.year));
 const index=prepareAppanageHistory(x.events),r=cityAppanageHistory(x.cityId,x.people,x.events,x.month,index).relations[1];return {x,p,a,index,r,formation};
}
it('includes verified promotion and other-city victories only in actual active intervals; death and lost intervals are excluded',()=>{
 const f=fixture(),before=JSON.stringify(f.x),career=appanageCareer(f.r,f.index,[f.formation],f.x.month);
 expect(career.windows.map(w=>[w.startMonth,w.endMonth])).toEqual([[1536,1656],[1667,1678]]);
 expect(career.entries.map(e=>e.eventId)).toEqual(['promote','valid','restored-period']);expect(career.entries.find(e=>e.eventId==='valid')?.text).toContain('郢');expect(JSON.stringify(f.x)).toBe(before);
});
it('keeps the initial identity and freezes last valid military office, age and flag despite later foreign accession',()=>{
 const f=fixture(),faction={color:0x222222,colorHistory:[{startMonth:0,endMonth:1677,color:0x111111,reason:'START'},{startMonth:1678,color:0x222222,reason:'CHANGE'}]};
 f.p.factionId='foreign';f.p.politicalRulerId='emperor';f.p.appointments.push({commandId:'foreign',factionId:'foreign',startMonth:1680,officeHistory:[{office:'SHANGJIANGJUN',eventId:'foreign-office',month:1680,serviceMonths:0,captureEventIds:[]}]});
 expect(appanagePortrait(f.p,f.a,faction,2000)).toMatchObject({role:'PIJIANG',nobleRank:'BO',age:30,deceased:false});
 const last=appanageLatestPortrait(f.r,faction,2000,f.index);expect(last).toMatchObject({role:'JIANGJUN',nobleRank:'BO',color:0x111111,month:1678,deceased:false});expect(appanageLatestPortrait(f.r,faction,3000,f.index)).toEqual(last);
});
it('uses source order for same-month loss and recovery and keeps uncommitted lifecycle projection accurate',()=>{
 const f=fixture();const loss=f.x.events.find(e=>e.id==='ying-loss')!,back=f.x.events.find(e=>e.id==='ying-back')!;back.year=back.monthIndex=loss.year;f.p.appanageHistory=f.p.appanageHistory!.slice(0,1);
 const es=f.x.events.filter(e=>e.type!=='military-appanage'||e.id===f.a.eventId).sort((a,b)=>(a.monthIndex??a.year)-(b.monthIndex??b.year));
 const index=prepareAppanageHistory(es),r=cityAppanageHistory(f.x.cityId,[f.p],es,1660,index).relations[0],windows=appanageEffectiveWindows(r,index,1660);
 expect(windows.map(w=>[w.startMonth,w.endMonth])).toEqual([[1536,1656],[1656,1660]]);expect(windows[0].endOrder).toBeLessThan(windows[1].startOrder);
});

it('special royal honors follow only valid estate windows and canonical same-month source order',async()=>{
 const {appanageRoyalHonor}=await import('../UI/Components/CityDetails/AppanagePresentation');const f=fixture(),royal:any={id:'royal',bornYear:f.p.bornMonth,accessionYear:1680,royalHonors:[]},house:any={houseEpochs:[{foundingRulerId:f.a.epochFounderId,startMonth:0,endMonth:1680}]};
 const grant=(id:string,month:number,rank:string)=>({eventId:id,month,rank,factionId:f.a.factionId,epochFounderId:f.a.epochFounderId,recipientRulerId:'royal',recipientName:f.p.personalName,countryName:f.a.countryName});
 royal.royalHonors=[grant('wuan',1600,'WUANJUN'),grant('future',1680,'ZHENGUOGONG')];f.x.events.push({id:'wuan',type:'royal-honor-granted',year:1600} as any,{id:'future',type:'royal-honor-granted',year:1680} as any);f.x.events.sort((a,b)=>(a.monthIndex??a.year)-(b.monthIndex??b.year));const index=prepareAppanageHistory(f.x.events);
 expect(appanageRoyalHonor(f.r,index,2000,royal,house,true)).toBeUndefined();expect(appanageRoyalHonor(f.r,index,2000,royal,house)?.primary).toContain('武安君');expect(appanageRoyalHonor(f.r,index,3000,royal,house)).toEqual(appanageRoyalHonor(f.r,index,2000,royal,house));
 const lossGrant=grant('loss-month-later',1656,'ZHENGUOGONG');royal.royalHonors.push(lossGrant);const loss=f.x.events.find(e=>e.id==='ying-loss')!,same=f.x.events.filter(e=>(e.monthIndex??e.year)<=1656);same.push({id:lossGrant.eventId,type:'royal-honor-granted',year:1656} as any);const lostIndex=prepareAppanageHistory(same),lost=cityAppanageHistory(f.x.cityId,f.x.people,same,1660,lostIndex).relations[1];expect(lost.last.cityId).toBe(loss.cityId);expect(appanageRoyalHonor(lost,lostIndex,1660,royal,house)?.primary).toContain('武安君');
});
