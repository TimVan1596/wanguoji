import {useContext} from "react";
import {MentionContext,FactionMention} from "./HistoryFactionNavigation";
import DepositionSelectionDetails from "../DepositionSelectionDetails";
import { Box, Typography } from "@mui/material";
import type { WorldEvent } from "../../../History/WorldHistory";
import type { RootState } from "../../../store";
import { colorToString } from "../../../paid/theme";
import { getMergedEventPresentation } from "../../../History/MergedEventPresentation";
import { getSubmissionEventPresentation } from "../../../History/PeacefulSubmissionPresentation";
import { getDiplomacyEventDetails } from "../../../History/DiplomacyEventDetails";
import { getRevolutionEventDetails } from "../../../History/RevolutionEventDetails";
import { getMilitaryParticipationDetails } from "../../../Politics/MilitaryPoliticalInfluence";
export function EventDetails({
  event,
  teamByName,
  factionNames,
  cityNames,
}: {
  event: WorldEvent;
  teamByName: Map<string, RootState["root"]["teams"][number]>;
  factionNames: string[];
  cityNames: string[];
}) {
  const lines: string[] = [...getRevolutionEventDetails(event), ...(getSubmissionEventPresentation(event, teamByName)?.lines ?? []), ...(getMergedEventPresentation(event, teamByName)?.lines ?? [])];
  const metadata = event.metadata;
  if(["rebel-faction-founded","frontier-faction-founded","empire-split"].includes(event.type)){
    addMetadataLine(lines,metadata?.transferredPopulation,"真实居民转属");addMetadataLine(lines,metadata?.externalPopulation,"额外增员");
  }
  const kind = metadata?.historyNarrativeKind;
  const isCapitalTransition = kind === "CAPITAL_TRANSITION" ||
    (event.type === "capital-relocated" && typeof metadata?.previousCapitalName === "string");
  const isCollapse = kind === "FACTION_COLLAPSE" || Boolean(metadata?.groupedEventCount) ||
    event.type === "faction-extinct" || event.type === "faction-exiled" || event.type === "faction-dissolved";
  const isDiplomacySigning = event.type === "relation-renewed" || event.type === "truce-signed" || event.type === "non-aggression-signed" || event.type === "alliance-signed";
  if (isDiplomacySigning && metadata) {
    lines.push(...getDiplomacyEventDetails(event, teamByName));
  } else if (isCapitalTransition && metadata) {
    addMetadataTextLine(lines, metadata.previousCapitalName, "旧都");
    addMetadataTextLine(lines, metadata.newCapitalName ?? event.cityName, "新都");
    const cause = metadata.cause === "CAPITAL_DESTROYED" ? "旧都毁于长期战乱" :
      metadata.cause === "CAPITAL_FALL" ? "旧都失陷" : undefined;
    addMetadataTextLine(lines, cause, "原因");
    addFactionLine(lines, teamByName, metadata.conquerorFactionId, "攻陷者");
    addMetadataTextLine(lines, metadata.rulerName, "君主");
  } else if (isCollapse && metadata) {
    const finalCityName = metadata.finalCityName ?? (metadata.isFinalCityCapture === 1 ? metadata.cityName : undefined);
    if (metadata.isFinalCityCapture === 1 && typeof finalCityName === "string") {
      addMetadataTextLine(lines, finalCityName, "最后据点");
      addFactionLine(lines, teamByName, metadata.conquerorFactionId, "最后据点攻陷者");
    }
    addMetadataLine(lines, metadata.populationBefore, "灭亡前人口");
    addMetadataLine(lines, metadata.surrenderedPopulation, "投降人口");
    addMetadataLine(lines, metadata.disbandedPopulation, "解散人口");
    addMetadataLine(lines, metadata.remnantPopulation, "残部人口");
    addMetadataLine(lines, metadata.population, "事件时人口");
    addMetadataLine(lines, metadata.populationCapacity, "事件时承载");
    addMetadataPercentLine(lines, metadata.territoryPercent, "事件时领土");
    addMetadataLine(lines, metadata.cityCount, "事件时城市");
    addMetadataLine(lines, metadata.stability, "事件时稳定");
    addMetadataLine(lines, metadata.duration, "持续年数");
    addMetadataLine(lines, metadata.effectDuration, "继承影响年数");
    addMetadataMultiplierLine(
      lines,
      metadata.populationGrowthMultiplier,
      "人口自然增长"
    );
    addMetadataMultiplierLine(
      lines,
      metadata.loyaltyRecoveryMultiplier,
      "忠诚恢复"
    );
    addMetadataMultiplierLine(
      lines,
      metadata.rebellionRiskMultiplier,
      "叛乱风险"
    );
    addMetadataLine(lines, metadata.cityLoyaltyDelta, "城市忠诚变化");
    addMetadataLine(lines, metadata.immediatePopulation, "立即人口变化");
  } else if (metadata) {
    addMetadataLine(lines, metadata.populationBefore, "灭亡前人口");
    addMetadataLine(lines, metadata.surrenderedPopulation, "投降人口");
    addMetadataLine(lines, metadata.disbandedPopulation, "解散人口");
    addMetadataLine(lines, metadata.remnantPopulation, "残部人口");
  }
  return (
    <>
      <DepositionSelectionDetails event={event}/>
      {getMilitaryParticipationDetails(event).length>0 && <details onClick={e=>e.stopPropagation()} style={{overflowWrap:"anywhere",fontSize:"0.75rem"}}><summary>史料依据（军事参与）</summary>{getMilitaryParticipationDetails(event).map((line,i)=><Typography key={i} fontSize="0.75rem">{line}</Typography>)}</details>}
      {lines.map((line) => (
        <Typography key={line} fontSize="0.82rem" sx={{ opacity: 0.82 }}>
          <EventText
            text={line}
            teamByName={teamByName}
            factionNames={factionNames}
            cityNames={cityNames}
          />
        </Typography>
      ))}
    </>
  );
}

function addMetadataTextLine(lines: string[], value: unknown, label: string) {
  if (typeof value === "string" && value.length > 0) {
    lines.push(`${label}：${value}`);
  }
}

function addFactionLine(
  lines: string[],
  teamByName: Map<string, RootState["root"]["teams"][number]>,
  factionId: unknown,
  label: string
) {
  if (typeof factionId !== "string") return;
  lines.push(`${label}：${teamByName.get(factionId)?.displayName ?? factionId}`);
}

function addMetadataPercentLine(
  lines: string[],
  value: string | number | undefined,
  label: string
) {
  if (typeof value === "number") {
    lines.push(`${label}：${value.toFixed(1)}%`);
  }
}

function addMetadataMultiplierLine(
  lines: string[],
  value: string | number | undefined,
  label: string
) {
  if (typeof value === "number") {
    lines.push(`${label}：×${value.toFixed(2)}`);
  }
}

function addMetadataLine(
  lines: string[],
  value: string | number | undefined,
  label: string
) {
  if (value !== undefined) {
    lines.push(`${label}：${value}`);
  }
}

export function EventText({
  text,
  teamByName,
  factionNames,
  cityNames,
}: {
  text: string;
  teamByName: Map<string, RootState["root"]["teams"][number]>;
  factionNames: string[];
  cityNames: string[];
}) {
  const mentions=useContext(MentionContext);
  const names = [
    ...mentions.protectedNames,
    ...[...new Set(factionNames)].sort((a, b) => b.length - a.length),
    ...[...cityNames].sort((a, b) => b.length - a.length),
  ].filter(Boolean);
  if (names.length === 0) {
    return <>{text}</>;
  }
  const pattern = new RegExp(`(${[...new Set(names)].sort((a,b)=>b.length-a.length).map(escapeRegExp).join("|")})`, "g");
  return (
    <>
      {text.split(pattern).map((part, index) => {
        if(mentions.protectedNames.includes(part))return part;
        const team = teamByName.get(part);
        if (team) {
          return (
            <FactionToken
              key={`${part}-${index}`}
              name={part}
              color={team.color}
              id={mentions.ids.get(part)}
            />
          );
        }
        if (cityNames.includes(part)) {
          return <CityToken key={`${part}-${index}`} name={part} />;
        }
        return part;
      })}
    </>
  );
}

function FactionToken({name,color,id}:{name:string;color:number;id?:string}) {
 return <FactionMention name={name} color={colorToString(color)} id={id}/>;
}

function CityToken({ name }: { name: string }) {
  return (
    <Box
      component="span"
      sx={{ fontWeight: "bold", textDecoration: "underline" }}
    >
      {name}
    </Box>
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
