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
it('shows the same identity-derived abilities separately from dynamic loyalty and actual troops',async()=>{const {militaryAbilities}=await import('../../../Politics/PersonAbilities'),person:any={personId:'actual',sourceUserId:24,bornMonth:-300},a=militaryAbilities(person),markup=renderToStaticMarkup(<MilitaryDispositionPanel person={person} personId={person.personId} bornMonth={person.bornMonth} loyalty={91} unitCount={2} prestige={1}/>);expect(markup).toContain(`统御 ${a.command}`);expect(markup).toContain(`谋略 ${a.strategy}`);expect(markup).toContain('当前忠诚 91');expect(markup).toContain('稳定野心');expect(markup).toContain('统兵2人');expect(markup).toContain('不替代军职、兵员或经历');});
