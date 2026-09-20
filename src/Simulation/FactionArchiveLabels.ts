export interface ArchiveLabelFactionLike {
  name: string;
  displayName?: string;
  stateFoundedMonth?: number;
  identityStage?: string;
  nameHistory?: Array<{
    name: string;
    startMonth: number;
    endMonth?: number;
  }>;
}

export function createFactionArchiveLabelMap(factions: ArchiveLabelFactionLike[]) {
  const formal = factions.filter(
    (faction) => faction.identityStage === "STATE" && faction.stateFoundedMonth !== undefined
  );
  const groups = new Map<string, ArchiveLabelFactionLike[]>();
  formal.forEach((faction) => {
    const stateName = getFormalStateName(faction);
    const group = groups.get(stateName) ?? [];
    group.push(faction);
    groups.set(stateName, group);
  });

  const labels = new Map<string, string>();
  groups.forEach((group, stateName) => {
    const sorted = [...group].sort(
      (a, b) => (a.stateFoundedMonth ?? 0) - (b.stateFoundedMonth ?? 0)
    );
    if (sorted.length === 1) {
      labels.set(sorted[0].name, stateName);
      return;
    }
    sorted.forEach((faction, index) => {
      labels.set(faction.name, `${getChronologyPrefix(index)}${stateName}`);
    });
  });
  factions.forEach((faction) => {
    if (!labels.has(faction.name)) {
      labels.set(faction.name, faction.displayName ?? faction.name);
    }
  });
  return labels;
}

function getFormalStateName(faction: ArchiveLabelFactionLike) {
  const stateEntry = faction.nameHistory?.find(
    (entry) => faction.stateFoundedMonth !== undefined && entry.startMonth === faction.stateFoundedMonth
  );
  return stateEntry?.name ?? faction.displayName ?? faction.name;
}

function getChronologyPrefix(index: number) {
  if (index === 0) {
    return "前";
  }
  if (index === 1) {
    return "后";
  }
  if (index === 2) {
    return "新";
  }
  return `再${"后".repeat(Math.min(index - 2, 3))}`;
}
