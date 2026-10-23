/** City-owned canonical battle facts; no Phaser objects or additional RNG. */
export interface SiegeBattle {
 id:string;attackerId:string;defenderId:string;startMonth:number;lastMonth:number;
 attackers:number;defenders:number;commandId?:string;personId?:string;
}
export function siegeWallPressure(attackers:number,defenders:number){
 return attackers<2||attackers<=defenders?0:Math.min(1.5,attackers/2)/(1+defenders/2);
}
