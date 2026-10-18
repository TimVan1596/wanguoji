import {Box,Typography} from "@mui/material";
import type {MilitaryPerson} from "../../../Politics/MilitaryCommandRegistry";
import {describeMilitaryNameEvidence,getMilitaryPersonDisplayName} from "../../../Politics/MilitaryPersonIdentity";
import {describeMilitaryStatus} from "./MilitaryPeoplePresentation";

export default function MilitaryPersonIdentityHeader({person,country}:{person:MilitaryPerson;country:string}){
  return <>
    <Typography fontWeight="bold" fontSize="0.9rem">{getMilitaryPersonDisplayName(person)} · {country}{describeMilitaryStatus(person)}</Typography>
    <Box component="details" sx={{minWidth:0,overflowWrap:"anywhere"}}>
      <summary>身份与史料依据</summary>
      <Typography fontSize="0.75rem">{person.personId} / User {person.sourceUserId} / 原始名称或人口标签：{person.name}（不是另一个人物）</Typography>
      <Typography fontSize="0.75rem" color="var(--gg-text-muted)">{describeMilitaryNameEvidence(person)}</Typography>
    </Box>
  </>;
}
