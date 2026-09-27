/** City defense is authoritative for active city cells; standalone/home blocks retain their own HP. */
export function canonicalBlockHitPoints(blockHp: number, cityDefense?: number) {
  return cityDefense ?? blockHp;
}
