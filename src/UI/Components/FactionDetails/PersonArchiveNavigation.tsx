import {createContext,useContext} from "react";
import type {PersonArchiveTarget} from "./PersonArchiveTarget";
export type {PersonArchiveTarget} from "./PersonArchiveTarget";
export const PersonArchiveNavigation=createContext<{
 open:(target:PersonArchiveTarget)=>void;
 militaryTarget?:PersonArchiveTarget&{serial:number};
 consume:()=>void;
}>({open:()=>{},consume:()=>{}});
export const usePersonArchiveNavigation=()=>useContext(PersonArchiveNavigation);
