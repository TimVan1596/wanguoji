import {Typography} from "@mui/material";
import {formatWorldDate} from "../../../Simulation/WorldTime";
export function personLifeDates(bornMonth:number|undefined,deathMonth:number|undefined){
 return [`出生：${Number.isFinite(bornMonth)?formatWorldDate(bornMonth!):"未载"}`,...(Number.isFinite(deathMonth)?[`死亡：${formatWorldDate(deathMonth!)}`]:[])];
}
export default function PersonLifeDates({bornMonth,deathMonth}:{bornMonth?:number;deathMonth?:number}){
 return <Typography fontSize="0.76rem">{personLifeDates(bornMonth,deathMonth).join(" · ")}</Typography>;
}
