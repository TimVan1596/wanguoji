/** Presentation only. Never rename User/name snapshots or change identity hashes.
 * Generated population labels have no recorded personal name; do not invent one.
 * The original label remains available separately for provenance, also after death.
 */
export function isPopulationIdentityLabel(name: string) {
  return /^(?:Heaven|God|Rebel|Split|Restored|Restore)-.+-\d+(?:-\d+)?$/.test(name) ||
    /^.+-\d{3,}$/.test(name);
}

export function getMilitaryPersonDisplayName(person: { name: string; personId: string }) {
  if (person.name.trim() && !isPopulationIdentityLabel(person.name)) return person.name;
  // personId distinguishes unnamed people without suggesting a fictitious name.
  return `姓名未记录的指挥者〔${person.personId}〕`;
}
