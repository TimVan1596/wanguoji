/** Validate JSON battle facts independently of Phaser collision callbacks. */
export function validateSiegeBattles(save:any){
 const errors:string[]=[],factions=new Set((save.factions??[]).map((f:any)=>f.factionId)),commands=new Map((save.registries?.militaryCommandRegistry?.formations??[]).map((f:any)=>[f.commandId,f])),month=save.world?.worldMonth;
 for(const c of save.cities??[]){
  const b=c.siegeBattle;
  if(b!==undefined){
   if(!b||typeof b!=='object'||typeof b.id!=='string'||!factions.has(b.attackerId)||b.defenderId!==c.ownerFactionId||b.attackerId===b.defenderId||![b.startMonth,b.lastMonth,b.attackers,b.defenders].every(Number.isSafeInteger)||b.startMonth<0||b.lastMonth<b.startMonth||b.lastMonth>month||b.attackers<1||b.defenders<0||c.attackingFactionId!==b.attackerId||!c.underSiege)errors.push('invalid canonical siege battle: '+c.cityId);
   if(b.commandId){const f:any=commands.get(b.commandId);if(!f||f.commanderPersonId!==b.personId||f.factionId!==b.attackerId)errors.push('invalid siege command evidence: '+c.cityId);}
  }
  if(c.siegeRetryAfter!==undefined&&(!c.siegeRetryAfter||typeof c.siegeRetryAfter!=='object'||Array.isArray(c.siegeRetryAfter)||Object.entries(c.siegeRetryAfter).some(([id,m])=>!factions.has(id)||!Number.isSafeInteger(m)||Number(m)<0)))errors.push('invalid siege retry state: '+c.cityId);
 }
 return errors;
}
