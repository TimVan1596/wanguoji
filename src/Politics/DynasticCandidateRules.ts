import type { Ruler, RulerRelationType } from "./Dynasty";

export const MAX_DYNASTIC_SUCCESSION_CANDIDATES = 6;
export const MAX_CANDIDATE_CHILDREN_PER_PARENT = 3;
export const MIN_MONTHS_BETWEEN_CANDIDATE_CHILDREN = 48;
export const MAX_KIN_ANCESTOR_DEPTH = 4;

export type RecordedKinRelation = Extract<
  RulerRelationType,
  "DIRECT_CHILD" | "GRANDCHILD" | "SIBLING" | "NEPHEW" | "UNCLE" | "COUSIN" | "COLLATERAL_KIN"
>;

export function getDynasticCandidateCap(identityStage: string, sovereigntyRank: string) {
  if (identityStage === "PROVISIONAL") return 2;
  return sovereigntyRank === "EMPEROR" ? 6 : 4;
}

function getAncestorDepths(ruler: Ruler, rulersById: Map<string, Ruler>) {
  const depths = new Map<string, number>();
  let parentId = ruler.parentId;
  let depth = 1;
  while (parentId && depth <= MAX_KIN_ANCESTOR_DEPTH) {
    if (depths.has(parentId)) break;
    depths.set(parentId, depth);
    parentId = rulersById.get(parentId)?.parentId;
    depth += 1;
  }
  return depths;
}

export function getRecordedKinRelation(
  candidate: Ruler,
  predecessor: Ruler,
  rulers: Ruler[]
): RecordedKinRelation | undefined {
  const rulersById = new Map(rulers.map((ruler) => [ruler.id, ruler]));
  if (candidate.parentId === predecessor.id) return "DIRECT_CHILD";

  const candidateParent = candidate.parentId ? rulersById.get(candidate.parentId) : undefined;
  if (candidateParent?.parentId === predecessor.id) return "GRANDCHILD";

  if (predecessor.parentId && candidate.parentId === predecessor.parentId) return "SIBLING";

  const predecessorParent = predecessor.parentId ? rulersById.get(predecessor.parentId) : undefined;
  if (
    candidateParent && predecessorParent &&
    candidateParent.id !== predecessor.id &&
    candidateParent.parentId !== undefined &&
    candidateParent.parentId === predecessor.parentId
  ) return "NEPHEW";
  if (
    predecessorParent && candidateParent &&
    predecessorParent.id !== candidateParent.id &&
    predecessorParent.parentId !== undefined &&
    predecessorParent.parentId === candidateParent.parentId
  ) return "COUSIN";
  if (
    predecessorParent?.parentId &&
    candidate.parentId === predecessorParent.parentId &&
    candidate.id !== predecessorParent.id
  ) return "UNCLE";

  const predecessorAncestors = getAncestorDepths(predecessor, rulersById);
  const candidateAncestors = getAncestorDepths(candidate, rulersById);
  const sharesRecordedAncestor = [...candidateAncestors.keys()].some((ancestorId) =>
    predecessorAncestors.has(ancestorId)
  );
  const isDirectLine =
    predecessorAncestors.has(candidate.id) || candidateAncestors.has(predecessor.id);
  return sharesRecordedAncestor && !isDirectLine ? "COLLATERAL_KIN" : undefined;
}

const relationPriority: Record<RecordedKinRelation, number> = {
  DIRECT_CHILD: 0,
  GRANDCHILD: 1,
  SIBLING: 2,
  NEPHEW: 3,
  UNCLE: 4,
  COUSIN: 5,
  COLLATERAL_KIN: 6,
};

export function selectActiveDynasticCandidateIds({
  currentRuler,
  rulers,
  month,
  cap,
  isAlive,
  pickIndex,
  preferredIds = [],
}: {
  currentRuler: Ruler | undefined;
  rulers: Ruler[];
  month: number;
  cap: number;
  isAlive: (ruler: Ruler, month: number) => boolean;
  pickIndex: (length: number) => number;
  preferredIds?: string[];
}): string[] {
  if (!currentRuler || cap <= 0) return [];
  const ranked = rulers.flatMap((ruler) => {
    if (ruler.id === currentRuler.id || (ruler.status !== "heir" && ruler.status !== "kin") || ruler.houseName !== currentRuler.houseName || !isAlive(ruler, month)) return [];
    const relation = getRecordedKinRelation(ruler, currentRuler, rulers);
    return relation ? [{ ruler, priority: relationPriority[relation] }] : [];
  }).sort((a, b) => a.priority - b.priority || a.ruler.bornYear - b.ruler.bornYear || a.ruler.id.localeCompare(b.ruler.id));
  const selected: string[] = [];
  let cursor = 0;
  while (cursor < ranked.length && selected.length < cap) {
    const item = ranked[cursor];
    const tied = ranked.slice(cursor).filter((candidate) => candidate.priority === item.priority && candidate.ruler.bornYear === item.ruler.bornYear);
    const tieIds = new Set(tied.map(({ ruler }) => ruler.id));
    const tiePool = ranked.filter(({ ruler }) => tieIds.has(ruler.id));
    while (tiePool.length && selected.length < cap) {
      const preferredIndex = tiePool.findIndex(({ ruler }) => preferredIds.includes(ruler.id));
      const index = preferredIndex >= 0 ? preferredIndex : tiePool.length === 1 ? 0 : pickIndex(tiePool.length);
      selected.push(tiePool.splice(index, 1)[0].ruler.id);
    }
    cursor = ranked.findIndex((candidate, index) => index >= cursor && !tieIds.has(candidate.ruler.id));
    if (cursor < 0) break;
  }
  return selected;
}

export function selectRecordedDynasticSuccessor({
  predecessor,
  candidates,
  rulers,
  houseName,
  month,
  isAlive,
  pickIndex,
  preferredCandidateId,
}: {
  predecessor: Ruler;
  candidates: Ruler[];
  rulers: Ruler[];
  houseName: string;
  month: number;
  isAlive: (candidate: Ruler, month: number) => boolean;
  pickIndex: (length: number) => number;
  preferredCandidateId?: string;
}): { ruler: Ruler; relationType: RecordedKinRelation } | undefined {
  const eligible = candidates.flatMap((candidate) => {
    if (
      candidate.status !== "heir" ||
      candidate.houseName !== houseName ||
      !isAlive(candidate, month)
    ) return [];
    const relationType = getRecordedKinRelation(candidate, predecessor, rulers);
    return relationType ? [{ ruler: candidate, relationType }] : [];
  });
  if (!eligible.length) return undefined;

  const priority = Math.min(...eligible.map(({ relationType }) => relationPriority[relationType]));
  const closestKin = eligible
    .filter(({ relationType }) => relationPriority[relationType] === priority)
    .sort((a, b) => a.ruler.bornYear - b.ruler.bornYear);
  const oldestBornMonth = closestKin[0].ruler.bornYear;
  const sameAge = closestKin.filter(({ ruler }) => ruler.bornYear === oldestBornMonth);
  const preferred = sameAge.find(({ ruler }) => ruler.id === preferredCandidateId);
  if (preferred) return preferred;
  return sameAge[sameAge.length === 1 ? 0 : pickIndex(sameAge.length)];
}

export function formatRecordedKinship(candidate: Ruler, currentRuler: Ruler, rulers: Ruler[]) {
  const relation = getRecordedKinRelation(candidate, currentRuler, rulers);
  if (relation === "DIRECT_CHILD") return "当今君主之子";
  if (relation === "GRANDCHILD") return "当今君主之孙";
  if (relation === "SIBLING") {
    if (candidate.bornYear < currentRuler.bornYear) return "当今君主之兄";
    if (candidate.bornYear > currentRuler.bornYear) return "当今君主之弟";
    return "当今君主之兄弟";
  }
  if (relation === "NEPHEW") return "当今君主之侄";
  if (relation === "UNCLE") {
    const parent = currentRuler.parentId ? rulers.find((ruler) => ruler.id === currentRuler.parentId) : undefined;
    if (parent && candidate.bornYear < parent.bornYear) return "当今君主之伯父";
    if (parent && candidate.bornYear > parent.bornYear) return "当今君主之叔父";
    return "当今君主之伯叔";
  }
  if (relation === "COUSIN") {
    return candidate.bornYear < currentRuler.bornYear ? "当今君主之堂兄" : candidate.bornYear > currentRuler.bornYear ? "当今君主之堂弟" : "当今君主之堂兄弟";
  }
  return relation === "COLLATERAL_KIN" ? "宗室旁支" : "关系未记录";
}

export function getSuccessionBackground(ruler: Ruler, rulers: Ruler[]) {
  const predecessor = ruler.predecessorId
    ? rulers.find((candidate) => candidate.id === ruler.predecessorId)
    : undefined;
  if (!predecessor) return ruler.relationType === "FOUNDER" ? "开国君主" : "继位背景未记录";
  const kinship = formatRecordedSuccessionKinship(ruler, predecessor, rulers);
  if (ruler.relationType === "DIRECT_CHILD") return `${kinship}承统`;
  if (ruler.relationType === "GRANDCHILD") {
    const directChildren = rulers.filter((candidate) => candidate.parentId === predecessor.id);
    const predeceasedChild = directChildren.some((candidate) =>
      candidate.endYear !== undefined && ruler.accessionYear !== undefined && candidate.endYear <= ruler.accessionYear
    );
    return predeceasedChild ? "直系子嗣早逝，由孙辈承统" : "前君之孙承统";
  }
  if (ruler.relationType === "SIBLING") return `前君无可继的直系候选，由${kinship}承统`;
  if (ruler.relationType === "NEPHEW") return `前君直系与同辈候选无可继者，由${kinship}承统`;
  if (ruler.relationType === "UNCLE") return `前君直系候选无可继者，由${kinship}承统`;
  if (ruler.relationType === "COUSIN") return `前君近支无可继者，由${kinship}承统`;
  if (ruler.relationType === "COLLATERAL_KIN") return "近支候选无可继者，由宗室旁支承统";
  if (ruler.relationType === "NEW_HOUSE") return "记录中的宗室候选已无可继者，遂易姓续统";
  if (ruler.relationType === "LEADER_SUCCESSOR") return "非世袭首领继任";
  return "继位背景未记录";
}

export function formatRecordedSuccessionKinship(ruler: Ruler, predecessor: Ruler, rulers: Ruler[]) {
  const relation = getRecordedKinRelation(ruler, predecessor, rulers);
  if (relation) return formatRecordedKinship(ruler, predecessor, rulers).replace("当今君主", "前君");
  if (ruler.relationType === "COLLATERAL_KIN") return "宗室旁支";
  if (ruler.relationType === "NEW_HOUSE") return "新家族";
  return "继承人";
}

export interface PoliticalGenealogyNode {
  ruler: Ruler;
  children: PoliticalGenealogyNode[];
}

export interface PoliticalGenealogyEdge {
  fromId: string;
  toId: string;
  type: "KINSHIP" | "SUCCESSION";
  crossBranch?: boolean;
}

export function buildPoliticalGenealogyEdges(rulers: Ruler[], includedIds?: Set<string>): PoliticalGenealogyEdge[] {
  const included = includedIds ?? new Set(rulers.map((ruler) => ruler.id));
  const edges: PoliticalGenealogyEdge[] = [];
  for (const ruler of rulers) {
    if (!included.has(ruler.id)) continue;
    if (ruler.parentId && included.has(ruler.parentId)) edges.push({ fromId: ruler.parentId, toId: ruler.id, type: "KINSHIP" });
    if (ruler.predecessorId && included.has(ruler.predecessorId)) {
      edges.push({ fromId: ruler.predecessorId, toId: ruler.id, type: "SUCCESSION", crossBranch: ruler.parentId !== ruler.predecessorId });
    }
  }
  return edges;
}

/** Build only the political dynasty graph, adding ancestors solely as links for recorded descendants. */
export function buildPoliticalGenealogy(
  rulers: Ruler[],
  currentRulerId: string | null | undefined,
  designatedHeirId: string | undefined,
  candidateIds: string[]
): PoliticalGenealogyNode[] {
  const byId = new Map(rulers.map((ruler) => [ruler.id, ruler]));
  const included = new Set(rulers
    .filter((ruler) => ruler.reignOrdinal !== undefined || ruler.id === currentRulerId || ruler.id === designatedHeirId || candidateIds.includes(ruler.id) || ruler.status === "kin")
    .map((ruler) => ruler.id));
  for (const id of [...included]) {
    let parentId = byId.get(id)?.parentId;
    const seen = new Set<string>([id]);
    while (parentId && byId.has(parentId) && !seen.has(parentId)) {
      included.add(parentId);
      seen.add(parentId);
      parentId = byId.get(parentId)?.parentId;
    }
  }

  const includedRulers = rulers.filter((ruler) => included.has(ruler.id));
  const childrenByParent = new Map<string, Ruler[]>();
  includedRulers.forEach((ruler) => {
    if (ruler.parentId && included.has(ruler.parentId) && ruler.parentId !== ruler.id) {
      const children = childrenByParent.get(ruler.parentId) ?? [];
      children.push(ruler);
      childrenByParent.set(ruler.parentId, children);
    }
  });
  const sortChronologically = (a: Ruler, b: Ruler) => a.bornYear - b.bornYear || a.id.localeCompare(b.id);
  childrenByParent.forEach((children) => children.sort(sortChronologically));
  const visited = new Set<string>();
  const build = (ruler: Ruler, path: Set<string>): PoliticalGenealogyNode => {
    visited.add(ruler.id);
    const nextPath = new Set(path).add(ruler.id);
    const children = (childrenByParent.get(ruler.id) ?? [])
      .filter((child) => !nextPath.has(child.id))
      .map((child) => build(child, nextPath));
    return { ruler, children };
  };
  const roots = includedRulers
    .filter((ruler) => !ruler.parentId || !included.has(ruler.parentId) || ruler.parentId === ruler.id)
    .sort(sortChronologically)
    .map((ruler) => build(ruler, new Set()));
  // Malformed cyclic components should remain visible instead of disappearing.
  includedRulers.sort(sortChronologically).forEach((ruler) => {
    if (!visited.has(ruler.id)) roots.push(build(ruler, new Set()));
  });
  return roots;
}

/**
 * Chooses a bounded set of living dynastic candidates eligible to have a
 * politically relevant child recorded. This is not a population/family
 * simulator: only the current ruler and already-recorded claimants are examined.
 */
export function getCandidateParentsToReplenish({
  currentRuler,
  rulers,
  candidateIds,
  month,
  minimumParentAgeMonths,
  candidateCap = MAX_DYNASTIC_SUCCESSION_CANDIDATES,
}: {
  currentRuler: Ruler | undefined;
  rulers: Ruler[];
  candidateIds: string[];
  month: number;
  minimumParentAgeMonths: number;
  candidateCap?: number;
}): Ruler[] {
  const openSlots = candidateCap - candidateIds.length;
  if (openSlots <= 0) return [];

  const rulersById = new Map(rulers.map((ruler) => [ruler.id, ruler]));
  const candidateParents = [
    currentRuler,
    ...candidateIds.map((id) => rulersById.get(id)),
  ].filter((ruler): ruler is Ruler => Boolean(ruler));
  const seen = new Set<string>();
  const eligible: Ruler[] = [];

  for (const parent of candidateParents) {
    if (
      seen.has(parent.id) ||
      parent.status === "dead" ||
      month - parent.bornYear < minimumParentAgeMonths
    ) continue;
    seen.add(parent.id);

    // Keep the descendant depth bounded: a recorded grandchild may succeed,
    // but we do not recursively simulate an unlimited aristocratic family tree.
    if (currentRuler && parent.id !== currentRuler.id) {
      const relationToCurrent = getRecordedKinRelation(parent, currentRuler, rulers);
      if (relationToCurrent === "GRANDCHILD") continue;
    }

    const children = rulers.filter((ruler) => ruler.parentId === parent.id);
    if (children.length >= MAX_CANDIDATE_CHILDREN_PER_PARENT) continue;
    const latestChildStart = children.reduce(
      (latest, child) => Math.max(latest, child.politicalStartYear ?? child.bornYear),
      Number.NEGATIVE_INFINITY
    );
    if (
      children.length > 0 &&
      month - latestChildStart < MIN_MONTHS_BETWEEN_CANDIDATE_CHILDREN
    ) continue;

    eligible.push(parent);
    if (eligible.length >= openSlots) break;
  }

  return eligible;
}
