import {Typography} from "@mui/material";
import type {MilitaryPerson} from "../../../Politics/MilitaryCommandRegistry";
import {getMilitaryPersonDisplayName} from "../../../Politics/MilitaryPersonIdentity";
import {describeMilitaryStatus} from "./MilitaryPeoplePresentation";

export default function MilitaryPersonIdentityHeader({person,country,politicalLabel}:{person:MilitaryPerson;country:string;politicalLabel?:string}){
  return <>
    <Typography fontWeight="bold" fontSize="0.9rem">{getMilitaryPersonDisplayName(person)} · {country}{' · '+(politicalLabel??describeMilitaryStatus(person))}</Typography>

  </>;
}
