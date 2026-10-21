import {createContext,useContext} from "react";
export type PersonArchiveTarget={kind:"RULER"|"MILITARY";factionId:string;id:string};
export const PersonArchiveNavigation=createContext<{
 open:(target:PersonArchiveTarget)=>void;
 militaryTarget?:PersonArchiveTarget&{serial:number};
 consume:()=>void;
}>({open:()=>{},consume:()=>{}});
export const usePersonArchiveNavigation=()=>useContext(PersonArchiveNavigation);
