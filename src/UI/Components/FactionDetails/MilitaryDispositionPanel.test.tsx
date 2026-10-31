import type React from 'react';
import {expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
vi.mock('react/jsx-dev-runtime',async()=>{const r=await vi.importActual<typeof import('react')>('react');return {jsxDEV:(type:React.ElementType,props:Record<string,unknown>,key?:string)=>r.createElement(type,{...props,key}),Fragment:r.Fragment};});
import MilitaryDispositionPanel from './MilitaryDispositionPanel';
it('renders verified present political information and keeps retired personality separate from current command',()=>{
 const active=renderToStaticMarkup(<MilitaryDispositionPanel personId="person" bornMonth={-300} loyalty={90} unitCount={3} prestige={2.12}/>);
 expect(active).toContain('政治取向：');expect(active).toContain('忠诚较高');expect(active).toContain('统兵3人');expect(active).toContain('军权威望 2.12');
 const retired=renderToStaticMarkup(<MilitaryDispositionPanel personId="person" bornMonth={-300} unitCount={0}/>);
 expect(retired).not.toContain('当前无已核验军权');expect(retired).not.toContain('<details open');expect(retired.split('<details')[0]).not.toContain('威望依据');expect(retired).not.toContain('忠诚较高');expect(retired).not.toMatch(/篡逆|图谋|背叛|亲征/);
});
