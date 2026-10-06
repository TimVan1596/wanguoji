/** Derived runtime cache only. Read the array slot on every lookup so record replacement
 * remains visible. Succession, candidate order and the complete archive are unchanged. */
export class CurrentRulerLookup {
  private positions = new WeakMap<object, { id: string; index: number }>();
  get<T extends { id: string }>(dynasty: { currentRulerId?: string | null; rulers: T[] } | undefined): T | undefined {
    if (!dynasty?.currentRulerId) return undefined;
    const cached = this.positions.get(dynasty.rulers);
    if (cached?.id === dynasty.currentRulerId && dynasty.rulers[cached.index]?.id === cached.id) return dynasty.rulers[cached.index];
    const index = dynasty.rulers.findIndex((ruler) => ruler.id === dynasty.currentRulerId);
    if (index < 0) return undefined;
    this.positions.set(dynasty.rulers, { id: dynasty.currentRulerId, index });
    return dynasty.rulers[index];
  }
  reset() { this.positions = new WeakMap(); }
}
