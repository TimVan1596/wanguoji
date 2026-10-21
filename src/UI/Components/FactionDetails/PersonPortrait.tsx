/** No simulation RNG, image assets, gender inference, or runtime resources. */
export function portraitTraits(personId: string, age?: number) {
  let hash=2166136261;
  for(let i=0;i<personId.length;i++) hash=Math.imul(hash^personId.charCodeAt(i),16777619);
  const seed=hash>>>0;
  return {seed,stage:age===undefined?"unknown":age<16?"young":age<45?"adult":age<65?"mature":"elder",
    robe:["#48686b","#765947","#5c5775","#556748"][seed%4],skin:["#e7c29d","#cfa780","#b98c66"][seed%3],face:15+seed%3};
}
/** Place inside the existing archive button: clicking the portrait opens that same person's details. */
export default function PersonPortrait({personId,age}:{personId:string;age?:number}){
  const t=portraitTraits(personId,age),elder=t.stage==="elder",mature=t.stage==="mature",young=t.stage==="young";
  return <svg aria-hidden="true" focusable="false" width="44" height="52" viewBox="0 0 64 76"
    data-person-id={personId} data-age-stage={t.stage}
    style={{float:"left",marginRight:8,borderRadius:8,flexShrink:0,background:"#ece4d6"}}>
    <path d="M5 76 Q8 54 25 53 L39 53 Q56 54 59 76" fill={t.robe}/>
    <path d="M23 53 L32 66 L41 53 M32 66 L32 76" fill="none" stroke="#e8ddc9" strokeWidth="3"/>
    <ellipse cx="32" cy="31" rx={young?t.face-2:t.face} ry={young?19:22} fill={t.skin}/>
    <path d="M15 30 Q11 6 32 7 Q53 6 49 30 L43 18 Q32 22 21 18 Z" fill={elder?"#c5c0b5":mature?"#797571":"#393b39"}/>
    <path d={young?"M27 8 Q27 2 35 3 L37 9":"M26 9 L25 3 Q32 -1 39 3 L38 10"} fill={elder?"#aaa69f":"#393b39"}/>
    <path d={`M23 ${28+t.seed%2}h5 M36 ${28+t.seed%2}h5`} stroke="#44413b" strokeWidth="1.5"/>
    <circle cx="26" cy="33" r="1.3" fill="#373b39"/><circle cx="38" cy="33" r="1.3" fill="#373b39"/>
    <path d="M32 34l-2 7h4 M27 46q5 3 10 0" fill="none" stroke="#936b56" strokeWidth="1.1"/>
    {(mature||elder)&&<path d="M19 35l3 2 M42 37l3-2 M23 43l-1 4 M42 43l1 4" stroke="#ad856b" fill="none"/>}
  </svg>;
}
