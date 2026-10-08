import type { Dynasty } from "../../Politics/Dynasty";
import { Box, Typography } from "@mui/material";
import type { HistoricalFaction } from "../../Historiography/FactionHistoriography";
import { getFactionAssessment } from "../../Historiography/FactionAssessmentArchive";
import type { WorldEvent } from "../../History/WorldHistory";

export function FactionAssessmentPanel({ faction, factions, dynasty }: { faction: HistoricalFaction; factions: ReadonlyMap<string, HistoricalFaction>; dynasty?: Dynasty }) {
  const assessment = getFactionAssessment(faction, factions, dynasty);
  if (!assessment) return null;
  return <Box component="details" sx={{ border: "1px solid var(--gg-border)", borderRadius: "var(--gg-radius)", p: 1, overflowWrap: "anywhere" }}>
    <summary>{assessment.title}</summary>
    <Typography fontWeight="bold">{assessment.evidence.name} · {assessment.title}</Typography>
    {assessment.facts.map(line => <Typography key={line} fontSize="0.84rem">{line}</Typography>)}
    <Typography sx={{ mt: 1 }} fontWeight="bold">史评</Typography>
    {assessment.lines.map(line => <Typography key={line} fontSize="0.84rem">{line}</Typography>)}
    <Typography sx={{ mt: 1 }} fontWeight="bold">史家曰</Typography>
    <Typography fontSize="0.84rem">{assessment.voice}</Typography>
  </Box>;
}
export function FactionTerminalRetrospective({ event, factions, dynasties }: { event: WorldEvent; factions: ReadonlyMap<string, HistoricalFaction>; dynasties: ReadonlyMap<string, Dynasty> }) {
  const id = event.type === "faction-submitted" ? event.metadata?.submittedFactionId ?? event.actorFactionId
    : event.type === "faction-merged" ? event.metadata?.absorbedFactionId
    : event.type === "faction-extinct" ? event.targetFactionId : undefined;
  const faction = typeof id === "string" ? factions.get(id) : undefined;
  const assessment = faction ? getFactionAssessment(faction, factions, dynasties.get(faction.name)) : undefined;
  if (!assessment || assessment.evidence.endMonth !== (event.monthIndex ?? event.year)) return null;
  return <Typography fontSize="0.84rem" sx={{ mt: 0.75, overflowWrap: "anywhere" }}>【{assessment.evidence.formal ? "国祚回顾" : "势力回顾"}】{assessment.summary}</Typography>;
}
