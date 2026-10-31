import React from 'react';
import {it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {daliangAppanageFixture} from '../../../Simulation/testing/CityAppanageViewFixture';
import {Provider} from 'react-redux';
const mock=vi.hoisted(()=>({month:500,people:[] as any[],history:vi.fn(()=>{throw Error('closed city must not read complete history');})}));
vi.mock('../../../History/WorldHistory',()=>({default:{getRevision:()=>1,getEventCount:()=>1,getRecordedEvents:mock.history}}));
vi.mock('../../../Politics/MilitaryCommandRegistry',()=>({default:{getPeople:()=>mock.people,getFormations:()=>[]}}));
vi.mock('../../../Politics/Dynasty',()=>({default:{getAll:()=>[]}}));
vi.mock('react/jsx-dev-runtime',async()=>{const r=await vi.importActual<typeof import('react')>('react');return {jsxDEV:(type:React.ElementType,props:Record<string,unknown>,key?:string)=>r.createElement(type,{...props,key}),Fragment:r.Fragment};});
import {CityAppanageSection} from './CityAppanages';
const store:any={getState:()=>({root:{worldMonth:mock.month,teams:[]}}),subscribe:()=>()=>{},dispatch:()=>{}};
it('a long city starts with a compact closed summary and mounts neither history index nor portraits/cards',()=>{
 mock.history.mockClear();mock.people=Array.from({length:300},(_,i)=>({personId:`p${i}`,appanageHistory:[{cityId:'city',personId:`p${i}`,kind:'GRANTED',month:10,eventId:`g${i}`,grantEventId:`g${i}`}]}));
 const html=renderToStaticMarkup(<Provider store={store}><CityAppanageSection cityId='city'/></Provider>);
 expect(html).toContain('历代封邑');expect(html).toContain('授邑300次');expect(html).toContain('aria-expanded="false"');expect(html).not.toContain('data-appanage-grant');expect(mock.history).not.toHaveBeenCalled();
 expect(renderToStaticMarkup(<Provider store={store}><CityAppanageSection cityId='empty'/></Provider>)).toBe('');
});

it('one to five verified estate relations mount their cards automatically while keeping each long history closed',()=>{
 const x=daliangAppanageFixture();mock.people=x.people;mock.month=x.month;mock.history.mockImplementation(()=>x.events as never);
 const html=renderToStaticMarkup(<Provider store={store}><CityAppanageSection cityId={x.cityId}/></Provider>);
 expect(html).toContain('aria-expanded="true"');expect(html.match(/data-appanage-grant=/g)).toHaveLength(2);expect(html).not.toContain('data-appanage-event');
});
