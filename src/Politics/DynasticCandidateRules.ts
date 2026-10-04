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
}: {
  predecessor: Ruler;
  candidates: Ruler[];
  rulers: Ruler[];
  houseName: string;
  month: number;
  isAlive: (candidate: Ruler, month: number) => boolean;
  pickIndex: (length: number) => number;
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
  return closestKin[pickIndex(closestKin.length)];
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
