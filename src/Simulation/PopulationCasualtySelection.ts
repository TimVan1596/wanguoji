export interface CasualtyIdentity {
  userId: number;
  name: string;
  bornMonth: number;
  logicalUnitId?: string;
  militaryPersonId?: string;
}

export interface CasualtySelectionContext {
  factionId: string;
  worldMonth: number;
  damageSource: string;
  triggerCityId?: string;
}

function hashStable(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function identityKey(identity: CasualtyIdentity) {
  if (!Number.isSafeInteger(identity.userId) || typeof identity.name !== "string" ||
      !Number.isSafeInteger(identity.bornMonth) ||
      (identity.logicalUnitId !== undefined && (typeof identity.logicalUnitId !== "string" || !identity.logicalUnitId)) ||
      (identity.militaryPersonId !== undefined && (typeof identity.militaryPersonId !== "string" || !identity.militaryPersonId))) {
    return undefined;
  }
  // User IDs may be reused after removal, so include the live unit identity and
  // permanent military-person identity when available, plus immutable user facts.
  return JSON.stringify([
    identity.logicalUnitId ?? "",
    identity.militaryPersonId ?? "",
    identity.userId,
    identity.bornMonth,
    identity.name,
  ]);
}

/**
 * Deterministically orders a current faction's casualty candidates. It consumes no
 * WorldRandom state and fails closed when identities are missing or ambiguous.
 */
export function orderCasualtyCandidates<T extends { identity: CasualtyIdentity }>(
  candidates: T[],
  context: CasualtySelectionContext,
): T[] | undefined {
  if (!Number.isSafeInteger(context.worldMonth) || !context.factionId || !context.damageSource) return undefined;
  const keyed = candidates.map((candidate) => ({ candidate, key: identityKey(candidate.identity) }));
  if (keyed.some((entry) => entry.key === undefined)) return undefined;
  const identities = keyed.map((entry) => entry.key!);
  if (new Set(identities).size !== identities.length) return undefined;

  const contextKey = JSON.stringify([
    context.factionId,
    context.worldMonth,
    context.damageSource,
    context.triggerCityId ?? "",
  ]);
  return keyed
    .map((entry) => ({ ...entry, rank: hashStable(`${contextKey}|${entry.key}`) }))
    .sort((a, b) => a.rank - b.rank || a.key!.localeCompare(b.key!))
    .map((entry) => entry.candidate);
}
