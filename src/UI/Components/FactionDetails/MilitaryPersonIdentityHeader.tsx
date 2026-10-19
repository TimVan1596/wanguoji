import {Typography} from "@mui/material";
import type {MilitaryPerson} from "../../../Politics/MilitaryCommandRegistry";
import {getMilitaryPersonDisplayName} from "../../../Politics/MilitaryPersonIdentity";
import {describeMilitaryStatus} from "./MilitaryPeoplePresentation";

export default function MilitaryPersonIdentityHeader({person,country}:{person:MilitaryPerson;country:string}){
  return <>
    <Typography fontWeight="bold" fontSize="0.9rem">{getMilitaryPersonDisplayName(person)} · {country}{describeMilitaryStatus(person)}</Typography>

  </>;
}
