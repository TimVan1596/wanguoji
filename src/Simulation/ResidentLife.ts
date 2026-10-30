/** V33 ordinary life plan. Uses persisted identity only; transfers, hydration and RNG cannot change it. */
export function residentNaturalDeathMonth(userId:number,bornMonth:number){
 let h=2166136261;for(const c of `resident-life-v1\u0000${userId}\u0000${bornMonth}`)h=Math.imul(h^c.charCodeAt(0),16777619);
 return bornMonth+75*12+(h>>>0)%(20*12+1);
}
export function ordinaryLifeEligible(u:{role:string;rulerId?:string;militaryPersonId?:string;historicalPersonId?:string;isDestroyed?:boolean;player?:{role:string;rulerId?:string}}){
 return !u.isDestroyed&&u.role==='NORMAL'&&!u.rulerId&&!u.militaryPersonId&&!u.historicalPersonId&&u.player?.role==='NORMAL'&&!u.player.rulerId;
}
/** Soft world pressure on natural recovery only; no deletion or global population cap. */
export function worldRecoveryMultiplier(population:number){
 return Math.min(1,(1+Math.exp(-15/8))/(1+Math.exp((population-135)/8)));
}
