import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect,it,vi} from 'vitest';
import PersonAbilityPanel,{PersonAbilityEvidence} from './PersonAbilityPanel';
vi.mock('react/jsx-dev-runtime',async()=>{const r=await vi.importActual<typeof React>('react');return {jsxDEV:(type:React.ElementType,props:Record<string,unknown>,key?:string)=>r.createElement(type,{...props,key}),Fragment:r.Fragment};});
it('keeps public attributes brief while retaining the actual source in the separately mounted technical evidence',()=>{
 const abilities={version:1 as const,source:{kind:'RESIDENT' as const,sourceUserId:77,bornMonth:100},command:39,strategy:75};
 const publicHtml=renderToStaticMarkup(<PersonAbilityPanel abilities={abilities}/>),text=publicHtml.replace(/<[^>]*>/g,'');
 expect(text).toContain('统御：39 · 谋略：75');expect(text).not.toContain('来源');expect(text).not.toContain('随机');
 const evidence=renderToStaticMarkup(<PersonAbilityEvidence abilities={abilities}/>);expect(evidence).toContain('sourceUserId');expect(evidence).toContain('77');expect(evidence).toContain('bornMonth');expect(evidence).toContain('100');
});
