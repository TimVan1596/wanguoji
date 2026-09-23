export interface RemnantState {
  factionId: string;
  population: number;
  extinctYear: number;
}

class WorldRemnantStore {
  private remnants = new Map<string, RemnantState>();

  reset() {
    this.remnants.clear();
  }

  add(factionId: string, population: number, extinctYear: number) {
    if (population <= 0) {
      return;
    }
    const existing = this.remnants.get(factionId);
    this.remnants.set(factionId, {
      factionId,
      population: (existing?.population ?? 0) + population,
      extinctYear: existing?.extinctYear ?? extinctYear,
    });
  }

  get(factionId: string) {
    return this.remnants.get(factionId);
  }

  consume(factionId: string, count: number) {
    const existing = this.remnants.get(factionId);
    if (!existing || count <= 0) {
      return 0;
    }
    const consumed = Math.min(existing.population, count);
    const nextPopulation = existing.population - consumed;
    if (nextPopulation <= 0) {
      this.remnants.delete(factionId);
    } else {
      this.remnants.set(factionId, {
        ...existing,
        population: nextPopulation,
      });
    }
    return consumed;
  }

  setPopulation(factionId: string, population: number, extinctYear: number) {
    if (population <= 0) {
      this.remnants.delete(factionId);
      return;
    }
    const existing = this.remnants.get(factionId);
    this.remnants.set(factionId, {
      factionId,
      population,
      extinctYear: existing?.extinctYear ?? extinctYear,
    });
  }

  list() {
    return [...this.remnants.values()];
  }

  exportState() {
    return this.list().map((entry) => ({ ...entry, extinctMonth: entry.extinctYear }));
  }
}

const WorldRemnants = new WorldRemnantStore();

export default WorldRemnants;
