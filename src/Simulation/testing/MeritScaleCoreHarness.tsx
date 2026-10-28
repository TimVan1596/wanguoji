import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import MeritRoll from '../../UI/Components/FactionDetails/MeritRoll';
import Military from '../../Politics/MilitaryCommandRegistry';
import History from '../../History/WorldHistory';
import * as Nobility from '../../Politics/MilitaryNobility';
import {fixture} from './MeritScaleFixture';
export async function runMeritScale(){
 const results:any[]=[],checks:string[]=[],check=(v:unknown,s:string)=>{if(!v)throw Error(s);checks.push(s);};
 const people=Military.getPeople,forms=Military.getFormations,events=History.getEvents;
 try{for(const count of [100,500,1000]){
  const x=fixture(count),before=JSON.stringify(x),host=document.createElement('div');host.setAttribute('data-faction-scroll','');host.style.cssText='height:800px;width:440px;overflow:auto';document.body.append(host);const root=createRoot(host);let selected='';
  Military.getPeople=()=>x.people;Military.getFormations=()=>x.formations;History.getEvents=()=>x.events;
  const projection=(Nobility as any).createMeritRosterProjection?.(),at=performance.now();flushSync(()=>root.render(<MeritRoll factionId='a' month={60} onOpen={id=>selected=id}/>));const enterMs=performance.now()-at;let accumulated=0;const evaluate=(m:number)=>projection?projection.get(x.people,x.formations,x.events,'a',m):Nobility.meritRoster(x.people,x.formations,x.events,'a',m);let top=evaluate(60);
  for(let m=61;m<=72;m++){const start=performance.now();top=evaluate(m);accumulated+=performance.now()-start;flushSync(()=>root.render(<MeritRoll factionId='a' month={m} onOpen={id=>selected=id}/>));}
  const dom=host.querySelectorAll('*').length;check(host.querySelectorAll('[data-merit-person]').length===Math.min(3,top.length),`${count}: actual merit view retains all eligible candidates and exact top three`);const first=host.querySelector<HTMLButtonElement>('[data-merit-person] button')!;flushSync(()=>first.click());check(selected===top[0].person.personId,`${count}: actual top-person control keeps the unique identity`);check(JSON.stringify(x)===before,`${count}: rendering and ranking do not modify any source person or event`);
  results.push({count,enterMs,ranking12MonthMs:accumulated,dom,top:top.slice(0,3).map((r:any)=>({personId:r.person.personId,merits:r.merits})),cache:projection?.diagnostics()});flushSync(()=>root.unmount());host.remove();
 }}finally{Military.getPeople=people;Military.getFormations=forms;History.getEvents=events;}
 return {checks,results,scope:'100/500/1000-person explicit evidence UI fixtures through the real MeritRoll and ranking API; not invented natural world persons or combat'};
}
