import {Fragment,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
/** Variable-height window in the existing sidebar scroll area; no nested scrollbar or lost archive rows. */
export default function MilitaryArchiveWindow({ids,targetId,children}:{ids:string[];targetId?:string;children:(id:string,index:number)=>ReactNode}){
 const container=useRef<HTMLDivElement>(null),heights=useRef(new Map<string,number>()),[range,setRange]=useState([0,12]),[epoch,redraw]=useState(0);
 const offsets=[0];for(const id of ids)offsets.push(offsets.at(-1)!+(heights.current.get(id)??155));
 useLayoutEffect(()=>{
  const element=container.current!,scroller=element.closest<HTMLElement>('[data-faction-scroll]')??element.parentElement!;
  let frame=0;
  const update=()=>{frame=0;const top=scroller.getBoundingClientRect().top-element.getBoundingClientRect().top;let first=0;while(first<ids.length&&offsets[first+1]<top-500)first++;let end=first;while(end<ids.length&&offsets[end]<top+Math.max(scroller.clientHeight,800)+500)end++;
   const next=[first,Math.min(ids.length,Math.max(end,first+8))];setRange(old=>old[0]===next[0]&&old[1]===next[1]?old:next);};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};scroller.addEventListener('scroll',schedule,{passive:true});const observer=new ResizeObserver(schedule);observer.observe(scroller);update();
  return ()=>{scroller.removeEventListener('scroll',schedule);observer.disconnect();cancelAnimationFrame(frame);};
 },[ids.join('|'),epoch]);
 useLayoutEffect(()=>{const i=targetId?ids.indexOf(targetId):-1;if(i<0)return;const el=container.current!,scroll=el.closest<HTMLElement>('[data-faction-scroll]')??el.parentElement!;scroll.scrollTop+=el.getBoundingClientRect().top-scroll.getBoundingClientRect().top+offsets[i];setRange([Math.max(0,i-3),Math.min(ids.length,i+8)]);},[targetId]);
 const indexes=Array.from({length:Math.max(0,range[1]-range[0])},(_,i)=>i+range[0]).filter(i=>i<ids.length);let end=0;
 return <div ref={container} data-military-window data-total-people={ids.length}>{indexes.map(i=>{const gap=offsets[i]-offsets[end];end=i+1;return <Fragment key={ids[i]}>{gap>0&&<div aria-hidden style={{height:gap}}/>}<MeasuredRow id={ids[i]} onHeight={height=>{if(Math.abs((heights.current.get(ids[i])??155)-height)>.5){heights.current.set(ids[i],height);redraw(x=>x+1);}}}>{children(ids[i],i)}</MeasuredRow></Fragment>;})}<div aria-hidden style={{height:Math.max(0,offsets.at(-1)!-offsets[end])}}/></div>;
}
function MeasuredRow({id,onHeight,children}:{id:string;onHeight:(n:number)=>void;children:ReactNode}){
 const ref=useRef<HTMLDivElement>(null),callback=useRef(onHeight);callback.current=onHeight;
 useLayoutEffect(()=>{const el=ref.current!,measure=()=>callback.current(el.getBoundingClientRect().height);const observer=new ResizeObserver(measure);observer.observe(el);measure();return ()=>observer.disconnect();},[]);
 return <div ref={ref} data-military-person={id}>{children}</div>;
}
