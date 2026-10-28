import {memo} from 'react';
import type {PortraitRole} from "./PortraitPresentation";
/** Immutable identity controls face only; office, flag and age never re-roll it. */
export function portraitTraits(personId:string,age?:number){
 let hash=2166136261;for(let i=0;i<personId.length;i++)hash=Math.imul(hash^personId.charCodeAt(i),16777619);
 const seed=hash>>>0;
 return {seed,stage:age===undefined?"unknown":age<16?"young":age<45?"adult":age<65?"mature":"elder",
  robe:["#48686b","#765947","#5c5775","#556748"][seed%4],skin:["#e7c29d","#cfa780","#b98c66"][seed%3],
  face:13+seed%6,jaw:(seed>>>4)%4,hair:(seed>>>7)%3,eyes:8+(seed>>>10)%5,brow:(seed>>>13)%3,nose:2+(seed>>>16)%3,mouth:(seed>>>19)%3,mole:(seed>>>22)%4===0};
}
/** Decorative SVG lives inside the existing accessible archive control, never a second dialog. */
function PersonPortrait({personId,age,role="UNKNOWN",color,deceased=false,size=48,nobleRank,royalKin=false}:{personId:string;age?:number;role?:PortraitRole;color?:number;deceased?:boolean;size?:number;nobleRank?:"BO"|"HOU"|"GONG";royalKin?:boolean}){
 const t=portraitTraits(personId,age),elder=t.stage==="elder",mature=t.stage==="mature",young=t.stage==="young";
 const military=["XIAOWEI","PIJIANG","JIANGJUN","SHANGJIANGJUN"].includes(role),imperial=role==="EMPEROR",royal=imperial||role==="KING";
 const flag=color===undefined?"#9a9181":`#${(color>>>0).toString(16).padStart(6,"0").slice(-6)}`;
 const robe=imperial?"#6e421b":role==="KING"?"#56383d":military?"#43565c":role==="LEADER"?"#766951":t.robe;
 const hair=elder?"#c7c3ba":mature?"#797571":"#303633",rx=young?t.face-1:t.face,eye=t.eyes/2;
 const face=`M${32-rx} 27 Q${30-rx} 13 32 12 Q${34+rx} 13 ${32+rx} 27 L${32+rx-t.jaw} 42 Q${41-t.jaw} ${55-t.jaw} 32 ${55-t.jaw} Q${23+t.jaw} ${55-t.jaw} ${32-rx+t.jaw} 42 Z`;
 return <svg aria-hidden="true" focusable="false" width={size} height={size*1.25} viewBox="0 0 64 80" data-person-id={personId} data-age-stage={t.stage} data-portrait-role={role} data-deceased={deceased||undefined} data-noble-rank={!royal?nobleRank:undefined}
  style={{float:"left",marginRight:8,borderRadius:8,flexShrink:0,background:"#e9e1d2"}}>
  <rect width="64" height="80" fill={flag}/><rect width="64" height="80" fill="#f7efde" opacity=".78"/>
  <path d="M0 10L64 74M-12 10L52 74M12 10L76 74" stroke={flag} strokeWidth="4" opacity=".28"/>
  <path d="M5 80Q7 56 24 54H40Q57 56 59 80" fill={robe}/>
  {(royal||role==="SHANGJIANGJUN")&&<path d="M20 55L10 80H3Q7 60 20 55M44 55L54 80H61Q57 60 44 55" fill={imperial?"#b49345":role==="KING"?"#9d7756":"#7a3e37"}/>}
  {military&&<><path d="M20 56L32 66L44 56L47 80H17Z" fill="#727e7a" stroke="#263c40"/><path d="M20 68H44M19 73H45M24 63V80M32 66V80M40 63V80" stroke="#c4c7b4" strokeWidth="1"/></>}
  <path d="M24 54L32 66L40 54M32 66V80" fill="none" stroke={royal?"#d9bc70":"#d6cbb9"} strokeWidth={royal?3:2}/>
  {role==="JIANGJUN"&&<path d="M15 59L10 69L22 66M49 59L54 69L42 66" fill="#485e6c" stroke="#d2b986"/>}
  {role==="SHANGJIANGJUN"&&<path d="M12 59L8 71L24 65M52 59L56 71L40 65M29 71L32 68L35 71L32 75Z" fill="#c5ac6d" stroke="#6d542f"/>}
  {imperial&&<path d="M25 71L29 74L25 78M39 71L35 74L39 78" stroke="#d9b760" fill="none"/>}
  {!royal&&nobleRank&&<g data-noble-insignia={nobleRank}><path d="M13 58L25 80" stroke={nobleRank==='GONG'?'#b07e29':nobleRank==='HOU'?'#927343':'#79705b'} strokeWidth={nobleRank==='BO'?2:4}/>{Array.from({length:nobleRank==='GONG'?3:nobleRank==='HOU'?2:1},(_,i)=><circle key={i} cx={42-i*5} cy="73" r="1.8" fill="#d0af5d" stroke="#70542d"/>)}</g>}
  {!royal&&royalKin&&<path data-royal-kin="true" d="M47 58l3 3l-3 3l-3-3Z" fill="#94839c" stroke="#e4d6b7"/>}
  <path data-face="true" d={face} fill={t.skin}/>
  <path d={t.hair===0?`M${31-rx} 29Q12 9 32 9Q52 9 ${33+rx} 29L42 19Q32 24 22 19Z`:t.hair===1?`M${31-rx} 30Q12 9 32 9Q52 10 ${33+rx} 30L43 19L28 23L22 17Z`:`M${31-rx} 30Q12 8 32 9Q52 8 ${33+rx} 30L43 17Q32 19 21 17Z`} fill={hair}/>
  {!royal&&<path d={t.hair===1?"M25 12Q21 2 33 4L39 12":"M26 12L26 6Q32 1 38 6L38 12"} fill={hair}/>}
  {role==="LEADER"&&<path d="M18 20Q32 13 46 20L45 24Q32 18 19 24ZM43 22L51 31L45 30Z" fill="#8e7c58"/>}
  {role==="KING"&&<><path d="M23 17L24 7H40L41 17Z" fill="#443d32" stroke="#bd9b55"/><path d="M24 10H40M28 7V15M36 7V15" stroke="#c9ad68"/></>}
  {imperial&&<><path d="M23 17V9H41V17" fill="#393632"/><path d="M17 7H47V12H17Z" fill="#343a37" stroke="#d6b15b"/>{[20,26,32,38,44].map(x=><path key={x} d={`M${x} 12V${19+(x%3)}m-1 0h2`} stroke="#d4bc7a" strokeWidth="1.3"/>)}</>}
  <path d={`M${28-eye} ${30+t.brow}l6 ${-t.brow}M${36+eye} ${30+t.brow}l-6 ${-t.brow}`} stroke="#48433b" strokeWidth="1.7"/>
  <path d={`M${30-eye} 35q1.5 ${((t.seed>>>26)%3)-1} 3 0M${31+eye} 35q1.5 ${((t.seed>>>26)%3)-1} 3 0`} fill="none" stroke="#343b38" strokeWidth={t.brow===2?2:1.4}/>
  <path d={`M32 35l-${t.nose} 7h${t.nose+2}M27 47q5 ${((t.seed>>>28)%5)-2} 10 0`} fill="none" stroke="#916b56" strokeWidth="1.1"/>
  {t.mole&&<circle cx="41" cy="43" r=".8" fill="#805e49"/>}
  {(mature||elder)&&<path d="M19 36l4 2M41 38l4-2M23 44l-1 4M42 44l1 4" stroke="#ab826b" fill="none"/>}
  {deceased&&<path d="M0 1H64M0 79H64" stroke="#706e68" strokeWidth="3"/>}
 </svg>;
}

// Stable primitive identity/age/office props keep historical SVGs out of monthly redraw work.
export default memo(PersonPortrait);
