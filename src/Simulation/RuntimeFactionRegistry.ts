export interface RuntimeFactionEntry {
  name: string;
}

export class RuntimeFactionRegistry<T extends RuntimeFactionEntry> {
  private entries: T[] = [];
  private byName = new Map<string, T>();

  reset(initialEntries: readonly T[] = []) {
    this.entries = [];
    this.byName.clear();
    initialEntries.forEach((entry) => {
      this.register(entry);
    });
  }

  register(entry: T) {
    if (this.byName.has(entry.name)) {
      return false;
    }
    this.entries.push(entry);
    this.byName.set(entry.name, entry);
    return true;
  }

  get(name: string) {
    return this.byName.get(name);
  }

  has(name: string) {
    return this.byName.has(name);
  }

  list() {
    return [...this.entries];
  }

  get size() {
    return this.entries.length;
  }
}
