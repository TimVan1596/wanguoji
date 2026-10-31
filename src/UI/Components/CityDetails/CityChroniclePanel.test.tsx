import React from 'react';
import {it,expect,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const mock:{events:any[];query:ReturnType<typeof vi.fn>}=vi.hoisted(()=>({events:[] as any[],query:vi.fn((id:string)=>mock.events.filter((e:any)=>e.cityId===id))}));
vi.mock('../../../History/WorldHistory',()=>({default:{getEventCount:()=>mock.events.length,getEventsForCity:mock.query,getEvents:()=>{throw Error('no global history scan');}}}));
vi.mock('react/jsx-dev-runtime',async()=>{const r=await vi.importActual<typeof import('react')>('react');return {jsxDEV:(type:React.ElementType,props:Record<string,unknown>,key?:string)=>r.createElement(type,{...props,key}),Fragment:r.Fragment};});
import CityChroniclePanel from './CityChroniclePanel';
it.each([100,300])('long city with %s events uses its city index and keeps initial DOM bounded',count=>{mock.query.mockClear();mock.events=Array.from({length:count},(_,i)=>({id:`e-${i}`,type:'city-captured',year:i,cityId:'city',title:'易手',actorFactionId:'chu',targetFactionId:'qin',metadata:{},category:'war',importance:'major'}));const html=renderToStaticMarkup(<CityChroniclePanel cityId='city' month={500} factions={new Map()} revision={1}/>);expect(mock.query).toHaveBeenCalledTimes(1);expect(mock.query).toHaveBeenCalledWith('city');expect((html.match(/data-city-chronicle-event=/g)??[]).length).toBeLessThanOrEqual(12);expect(html).toContain(`完整记录（${count}）`);});
