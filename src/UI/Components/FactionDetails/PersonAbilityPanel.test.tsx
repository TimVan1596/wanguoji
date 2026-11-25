import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import PersonAbilityPanel,{PersonAbilityEvidence} from './PersonAbilityPanel';
vi.mock('react/jsx-dev-runtime',async()=>{const r=await vi.importActual<typeof React>('react');return {jsxDEV:(type:React.ElementType,props:Record<string,unknown>,key?:string)=>r.createElement(type,{...props,key}),Fragment:r.Fragment};});
it('keeps public attributes brief while retaining the actual source in the separately mounted technical evidence',()=>{
 const abilities={version:1 as const,source:{kind:'RESIDENT' as const,sourceUserId:77,bornMonth:100},command:39,strategy:75};
 const publicHtml=renderToStaticMarkup(<PersonAbilityPanel abilities={abilities} month={220}/>),text=publicHtml.replace(/<[^>]*>/g,'');
 expect(publicHtml).toContain('aria-label="武力"');expect(publicHtml).toContain('aria-valuenow="39"');expect(publicHtml).toContain('aria-valuenow="75"');expect(text).toContain('39/100');expect(text).toContain('75/100');expect(text).not.toContain('来源');expect(text).not.toContain('随机');
 const evidence=renderToStaticMarkup(<PersonAbilityEvidence abilities={abilities}/>);expect(evidence).toContain('sourceUserId');expect(evidence).toContain('77');expect(evidence).toContain('bornMonth');expect(evidence).toContain('100');
});

it('requires an actual loyalty target and time and never fabricates missing political values',()=>{const none=renderToStaticMarkup(<PersonAbilityPanel/>);expect(none).not.toContain('role="progressbar"');const known=renderToStaticMarkup(<PersonAbilityPanel ambition={49} loyalty={{value:91,factionName:'秦国',month:120}}/>);expect(known).toContain('aria-valuenow="49"');expect(known).toContain('91/100');expect(known).toContain('秦国');expect(known).toContain('10年1月');const sovereign=renderToStaticMarkup(<PersonAbilityPanel royal loyalty={{value:91,factionName:'本国',month:120}}/>);expect(sovereign).not.toContain('data-person-attribute="loyalty"');});
