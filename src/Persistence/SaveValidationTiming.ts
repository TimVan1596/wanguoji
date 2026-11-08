/** Optional synchronous diagnostics. No cached authority and no change to validation order. */
let observer:((phase:string,ms:number)=>void)|undefined;
export function observeSaveValidation(value:typeof observer){observer=value;}
export function measureSaveValidation<T>(phase:string,read:()=>T):T {
 if(!observer)return read();
 const started=performance.now();try{return read();}finally{observer(phase,performance.now()-started);}
}
