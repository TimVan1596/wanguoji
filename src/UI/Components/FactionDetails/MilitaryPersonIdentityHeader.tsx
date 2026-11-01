import {Typography} from "@mui/material";
import type {MilitaryPerson} from "../../../Politics/MilitaryCommandRegistry";
import {getMilitaryPersonDisplayName} from "../../../Politics/MilitaryPersonIdentity";
import {describeMilitaryStatus} from "./MilitaryPeoplePresentation";

export default function MilitaryPersonIdentityHeader({person,country,politicalLabel,honor}:{person:MilitaryPerson;country:string;politicalLabel?:string;honor?:ReturnType<typeof import('../../../Politics/RoyalHonorPresentation').royalHonorHeading>}){
  return <>
    <Typography fontWeight="bold" fontSize="0.9rem">{honor?.primary??`${getMilitaryPersonDisplayName(person)} · ${country}`}{' · '+(politicalLabel??describeMilitaryStatus(person))}</Typography>
    {honor?.secondary&&<Typography fontSize='.76rem'>{honor.secondary}</Typography>}
  </>;
}
