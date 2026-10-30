import type React from 'react';
import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('react/jsx-dev-runtime',async()=>{const r=await vi.importActual<typeof import('react')>('react');return {jsxDEV:(type:React.ElementType,props:Record<string,unknown>,key?:string)=>r.createElement(type,{...props,key}),Fragment:r.Fragment};});
import PoliticalCrisisDetails from './PoliticalCrisisDetails';
import {capturePoliticalCrisis} from '../../Politics/PoliticalEventNarrative';
it('keeps raw numerical context and event provenance in native expandable evidence',()=>{
 const snapshot=capturePoliticalCrisis({kind:'DEPOSITION',worldMonth:120,factionId:'qi',countryName:'齐',cityCount:2,stability:93,successorBornMonth:-240},['loss'],[{id:'loss',year:108,type:'capital-fallen',cityName:'临淄'} as any]);
 const html=renderToStaticMarkup(<PoliticalCrisisDetails event={{type:'ruler-deposed',year:120,actorFactionId:'qi',metadata:{politicalCrisis:JSON.stringify(snapshot)}} as any}/>);
 expect(html).toContain('<details');expect(html).not.toContain('<details open');expect(html).toContain('事变当时');expect(html).toContain('稳定度93');expect(html).toContain('原事件 loss');expect(html).toContain('临淄');
 expect(renderToStaticMarkup(<PoliticalCrisisDetails event={{type:'ruler-deposed',year:120} as any}/>)).toBe('');
});
