import {expect,it} from 'vitest';
import {getOfficePromotion,MILITARY_FORMATION_CAPACITY} from './MilitaryOffice';
const victory=(id:string,month=60)=>({eventId:id,worldMonth:month,commandId:'c',factionId:'a',victory:true} as any);
it('permits four capacities including the commander and requires both service and actual victories',()=>{
 expect(Object.values(MILITARY_FORMATION_CAPACITY)).toEqual([1,2,3,4]);
 const a:any={commandId:'c',factionId:'a',startMonth:0,officeHistory:[{office:'XIAOWEI',month:0,captureEventIds:[]}]};
 expect(getOfficePromotion(a,[],1200)).toBeUndefined();expect(getOfficePromotion(a,[victory('one',10)],23)).toBeUndefined();
 expect(getOfficePromotion(a,[victory('one',10)],24)).toMatchObject({office:'PIJIANG',captureEventIds:['one']});
});
it('never consumes duplicate or already spent victory events as extra promotion merits',()=>{
 const a:any={commandId:'c',factionId:'a',startMonth:0,officeHistory:[{office:'XIAOWEI',month:0,captureEventIds:[]},{office:'PIJIANG',month:24,captureEventIds:['spent']}]};
 expect(getOfficePromotion(a,[victory('spent'),victory('two'),victory('two')],60)).toBeUndefined();
 expect(getOfficePromotion(a,[victory('spent'),victory('two'),victory('two'),victory('three')],60)).toMatchObject({office:'JIANGJUN',captureEventIds:['two','three']});
});
