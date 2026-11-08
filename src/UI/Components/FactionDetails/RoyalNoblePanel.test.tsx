import type React from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Provider} from 'react-redux';
import {store} from '../../../store';
import History from '../../../History/WorldHistory';
import RoyalNoblePanel from './RoyalNoblePanel';
vi.mock('react/jsx-dev-runtime',async()=>{const r=await vi.importActual<typeof import('react')>('react');return {jsxDEV:(type:React.ElementType,props:Record<string,unknown>,key?:string)=>r.createElement(type,{...props,key}),Fragment:r.Fragment};});
afterEach(()=>{vi.restoreAllMocks();});
it.each([['NAN','男爵'],['ZI','子爵']] as const)('reads the real %s source rather than falling back to BO in a royal military archive',(rank,label)=>{
 const ruler:any={id:'r',houseName:'嬴氏',givenName:'安',bornYear:-240,militaryIdentity:{personId:'p',sourceUserId:1}},grant={eventId:'grant',personId:'p',sourceUserId:1,bornMonth:-240,factionId:'qin',epochFounderId:'king',personalName:'嬴安',rank,month:12,rulerTitle:'秦王嬴康',countryName:'秦'};
 const dynasty:any={factionId:'qin',rulers:[ruler],royalNobility:[{eventId:'royal-act',chainId:'chain',kind:'GRANTED',holderRulerId:'r',previousRulerId:'r',sourceGrantEventId:'grant',factionId:'qin',countryName:'秦',rank,month:12,sourceEventIds:['grant']}]};
 vi.spyOn(History,'getRecordedEvents').mockReturnValue([{id:'grant',year:12,type:'military-ennobled',category:'politics',importance:'major',title:'正式授爵',metadata:{nobility:JSON.stringify(grant)}}]);
 const html=renderToStaticMarkup(<Provider store={store}><RoyalNoblePanel ruler={ruler} dynasty={dynasty} month={24}/></Provider>);
 expect(html).toContain(`以本人军功封${label}`);expect(html).not.toContain('以本人军功封伯爵');
});
