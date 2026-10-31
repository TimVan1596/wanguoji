import {it,expect} from 'vitest';
import {militaryCrisisSourceIds} from './MilitaryCrisisSources';
it('separates a global checkpoint from dated local causes and rejects other cities, owners, battles and future facts',()=>{
 const facts:any={worldMonth:350,underSiege:true,battleId:'battle',lastCapturedMonth:300};
 const e=(id:string,extra:any)=>({id,year:300,cityId:'xiacai',type:'city-captured',actorFactionId:'chu',...extra}) as any;
 const events=[e('local',{}),e('handan',{cityId:'handan'}),e('wrong-owner',{actorFactionId:'yan'}),e('future',{year:351}),e('siege',{year:340,type:'siege-started',targetFactionId:'chu',metadata:{battleId:'battle'}}),e('other-battle',{year:340,type:'siege-started',targetFactionId:'chu',metadata:{battleId:'other'}})];
 expect(militaryCrisisSourceIds(events,'xiacai','chu',facts)).toEqual(['local','siege']);
});
