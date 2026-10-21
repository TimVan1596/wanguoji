import {createContext,useContext} from "react";
import type {PersonArchiveTarget} from "./PersonArchiveTarget";
export type {PersonArchiveTarget} from "./PersonArchiveTarget";
export const PersonArchiveNavigation=createContext<{
 open:(target:PersonArchiveTarget)=>void;
 consumeGenealogy:()=>void;
 genealogyTarget?:PersonArchiveTarget&{serial:number};
 militaryTarget?:PersonArchiveTarget&{serial:number};
 consume:()=>void;
}>({open:()=>{},consume:()=>{},consumeGenealogy:()=>{}});
export const usePersonArchiveNavigation=()=>useContext(PersonArchiveNavigation);
