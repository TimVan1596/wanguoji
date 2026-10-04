import type { Ruler, RulerRelationType } from "./Dynasty";

export const MAX_DYNASTIC_SUCCESSION_CANDIDATES = 6;
export const MAX_CANDIDATE_CHILDREN_PER_PARENT = 3;
export const MIN_MONTHS_BETWEEN_CANDIDATE_CHILDREN = 48;
export const MAX_KIN_ANCESTOR_DEPTH = 4;

export type RecordedKinRelation = Extract<
  RulerRelationType,
  "DIRECT_CHILD" | "GRANDCHILD" | "SIBLING" | "COLLATERAL_KIN"
>;

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
  COLLATERAL_KIN: 3,
};

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
  const closestKin = eligible.filter(({ relationType }) => relationPriority[relationType] === priority);
  const preferred = closestKin.find(({ ruler }) => ruler.id === preferredCandidateId);
  if (preferred) return preferred;
  return closestKin[pickIndex(closestKin.length)];
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
  return relation === "COLLATERAL_KIN" ? "宗室旁支" : "关系未记录";
}

export function getSuccessionBackground(ruler: Ruler, rulers: Ruler[]) {
  const predecessor = ruler.predecessorId
    ? rulers.find((candidate) => candidate.id === ruler.predecessorId)
    : undefined;
  if (!predecessor) return ruler.relationType === "FOUNDER" ? "开国君主" : "继位背景未记录";
  if (ruler.relationType === "DIRECT_CHILD") return "前君之子嗣承统";
  if (ruler.relationType === "GRANDCHILD") {
    const directChildren = rulers.filter((candidate) => candidate.parentId === predecessor.id);
    const predeceasedChild = directChildren.some((candidate) =>
      candidate.endYear !== undefined && ruler.accessionYear !== undefined && candidate.endYear <= ruler.accessionYear
    );
    return predeceasedChild ? "直系子嗣早逝，由孙辈承统" : "前君之孙承统";
  }
  if (ruler.relationType === "SIBLING") return "前君无可继的直系候选，由其兄弟承统";
  if (ruler.relationType === "COLLATERAL_KIN") return "近支候选无可继者，由宗室旁支承统";
  if (ruler.relationType === "NEW_HOUSE") return "记录中的宗室候选已无可继者，遂易姓续统";
  if (ruler.relationType === "LEADER_SUCCESSOR") return "非世袭首领继任";
  return "继位背景未记录";
}

export interface PoliticalGenealogyNode {
  ruler: Ruler;
  children: PoliticalGenealogyNode[];
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
    .filter((ruler) => ruler.reignOrdinal !== undefined || ruler.id === currentRulerId || ruler.id === designatedHeirId || candidateIds.includes(ruler.id))
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
}: {
  currentRuler: Ruler | undefined;
  rulers: Ruler[];
  candidateIds: string[];
  month: number;
  minimumParentAgeMonths: number;
}): Ruler[] {
  const openSlots = MAX_DYNASTIC_SUCCESSION_CANDIDATES - candidateIds.length;
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
