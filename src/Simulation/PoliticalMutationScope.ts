/** Synchronous commit barrier only. No pending work survives the current call stack. */
let active:{cleanup:Array<()=>void>;effects:Array<()=>void>}|undefined;
export const politicalMutationActive=()=>!!active;
export function politicalCleanup(work:()=>void){if(active)active.cleanup.push(work);else work();}
export function politicalEffect(work:()=>void){if(active)active.effects.push(work);else work();}
export function beginPoliticalMutation(){
 if(active)throw Error('Nested political mutation owner');
 const scope={cleanup:[] as Array<()=>void>,effects:[] as Array<()=>void>};active=scope;
 return {commit(){active=undefined;scope.cleanup.forEach(f=>f());scope.effects.forEach(f=>f());},cancel(){active=undefined;},finishRollback(){active=undefined;scope.cleanup.forEach(f=>f());}};
}
