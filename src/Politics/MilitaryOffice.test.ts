import {expect,it} from 'vitest';
import {getOfficePromotion,MILITARY_FORMATION_CAPACITY} from './MilitaryOffice';
const initial=()=>({commandId:'c',factionId:'a',startMonth:0,officeHistory:[{office:'XIAOWEI',month:0,captureEventIds:[]}]} as any);
const victory=(id:string,month=60,cityId=id)=>({eventId:id,cityId,worldMonth:month,commandId:'c',factionId:'a',victory:true} as any);
it('uses three-year actual activity or five-year legal service, never immediate appointment',()=>{
 expect(Object.values(MILITARY_FORMATION_CAPACITY)).toEqual([1,2,3,4]);const a=initial(),activity={...victory('activity',20),victory:false,activityKind:'SIEGE'};
 expect(getOfficePromotion(a,[activity],24)).toBeUndefined();expect(getOfficePromotion(a,[activity],36)).toMatchObject({office:'PIJIANG',promotionBasis:'ACTIVITY',activityEventIds:['activity'],captureEventIds:[]});
 expect(getOfficePromotion(a,[],59)).toBeUndefined();expect(getOfficePromotion(a,[],60)).toMatchObject({office:'PIJIANG',promotionBasis:'SERVICE',captureEventIds:[]});
});
it('keeps real war merits necessary for higher office and rejects spent or duplicate capture credit',()=>{
 const a=initial();a.officeHistory.push({...getOfficePromotion(a,[],60),eventId:'junior'});
 expect(getOfficePromotion(a,[],1200)).toBeUndefined();expect(getOfficePromotion(a,[victory('one')],72)).toBeUndefined();
 const g=getOfficePromotion(a,[victory('one')],84)!;expect(g).toMatchObject({office:'JIANGJUN',captureEventIds:['one']});a.officeHistory.push({...g,eventId:'general'});
 expect(getOfficePromotion(a,[victory('one'),victory('two',96),victory('two',96)],120)).toBeUndefined();
 expect(getOfficePromotion(a,[victory('one'),victory('two',96,'same'),victory('three',108,'same')],120)).toBeUndefined();
 expect(getOfficePromotion(a,[victory('one'),victory('two',96),victory('three',108)],120)).toMatchObject({office:'SHANGJIANGJUN',captureEventIds:['two','three']});
});
