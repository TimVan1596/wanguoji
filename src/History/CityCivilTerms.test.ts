import {expect,it} from 'vitest';
import type {CivilGovernorTerm} from '../Politics/CivilAdministrationSchema';
import {cityCivilTerms} from './CityCivilTerms';

it('retains separate historical appointments and countries by city and identity, including archived cities',()=>{
 const make=(id:string,startMonth:number,factionId:string,office:CivilGovernorTerm['office'],cityId='lost',personId='same-person')=>({
  assignmentId:id,cityId,startMonth,factionId,office,personId,personalName:'同名',
 }) as CivilGovernorTerm;
 const terms=[make('first',1,'old','XIANLING'),make('promotion',3,'old','JUNSHOU'),make('new-country',5,'new','JUNSHOU'),make('central',6,'new','CHENGXIANG'),make('same-name',7,'new','XIANLING','lost','other-person'),make('other-city',8,'new','JUNSHOU','another'),make('future',9,'new','JUNSHOU')];
 const rows=cityCivilTerms(terms,'lost',8);
 expect(rows.map(t=>t.assignmentId)).toEqual(['same-name','new-country','promotion','first']);
 expect(new Set(rows.map(t=>t.personId)).size).toBe(2);
 expect(cityCivilTerms(terms,'unappointed',8)).toEqual([]);
 expect(cityCivilTerms(Array.from({length:1100},(_,i)=>make(String(i),i,'old','XIANLING')),'lost',1200)).toHaveLength(1100);
});
