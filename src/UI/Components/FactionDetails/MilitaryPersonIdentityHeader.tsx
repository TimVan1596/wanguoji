import {Typography} from "@mui/material";
import type {MilitaryPerson} from "../../../Politics/MilitaryCommandRegistry";
import {getMilitaryPersonDisplayName} from "../../../Politics/MilitaryPersonIdentity";
import {describeMilitaryStatus} from "./MilitaryPeoplePresentation";

export default function MilitaryPersonIdentityHeader({person,country,politicalLabel,honor}:{person:MilitaryPerson;country:string;politicalLabel?:string;honor?:ReturnType<typeof import('../../../Politics/RoyalHonorPresentation').royalHonorHeading>}){
  const fullName=getMilitaryPersonDisplayName(person),heading=honor?.primary?.includes(fullName)?honor.primary:`${fullName} · ${country}`;
  return <>
    <Typography fontWeight="bold" fontSize="0.9rem"><span data-person-full-name={fullName} style={{whiteSpace:'nowrap'}}>{heading}</span>{' · '+(politicalLabel??describeMilitaryStatus(person))}</Typography>
    {honor?.secondary&&<Typography fontSize='.76rem'>{honor.secondary}</Typography>}
  </>;
}
