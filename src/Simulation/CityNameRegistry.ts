import { createCityName } from "./CityNameGenerator";
import { resetCityNamingTelemetry } from "./CityNamingTelemetry";

export interface ReservedCityName {
  name: string;
  normalizedName: string;
  cityId?: string;
  createdMonth?: number;
}

class CityNameRegistryStore {
  private reserved = new Map<string, ReservedCityName>();
  private recentDynamicNames: string[] = [];
  private readonly recentLimit = 15;

  reset() {
    this.reserved.clear();
    this.recentDynamicNames = [];
    resetCityNamingTelemetry();
  }

  normalize(name: string) {
    return name.trim().replace(/\s+/g, "");
  }

  reserve(name: string, cityId?: string, createdMonth?: number) {
    const normalizedName = this.normalize(name);
    const existing = this.reserved.get(normalizedName);
    if (existing) {
      return existing.cityId === cityId;
    }
    this.reserved.set(normalizedName, {
      name: normalizedName,
      normalizedName,
      cityId,
      createdMonth,
    });
    return true;
  }

  reserveForCity(name: string, cityId: string, createdMonth?: number) {
    if (this.reserve(name, cityId, createdMonth)) return;
    const existing = this.reserved.get(this.normalize(name));
    throw new Error(`City name uniqueness invariant violated: "${this.normalize(name)}" is already reserved by ${existing?.cityId ?? "unknown city"}; cannot assign to ${cityId}`);
  }

  getReservation(name: string) {
    const reservation = this.reserved.get(this.normalize(name));
    return reservation ? { ...reservation } : undefined;
  }

  isAvailable(name: string) {
    return !this.reserved.has(this.normalize(name));
  }

  allocateCityName(preferredName?: string, cityId?: string, createdMonth?: number) {
    if (preferredName && this.reserve(preferredName, cityId, createdMonth)) {
      return this.normalize(preferredName);
    }
    const name = createCityName(this.names(), this.recentDynamicNames);
    this.reserve(name, cityId, createdMonth);
    this.recentDynamicNames.unshift(name);
    this.recentDynamicNames = this.recentDynamicNames.slice(0, this.recentLimit);
    return name;
  }

  names() {
    return [...this.reserved.values()].map((entry) => entry.name);
  }

  entries() {
    return [...this.reserved.values()];
  }

  exportState() {
    return {
      reserved: this.entries().map((entry) => ({ ...entry, createdMonth: entry.createdMonth })),
      recentDynamicNames: [...this.recentDynamicNames],
    };
  }

  importState(state: { reserved: ReservedCityName[]; recentDynamicNames: string[] }) {
    this.reserved = new Map(state.reserved.map((entry) => [entry.normalizedName, { ...entry }]));
    this.recentDynamicNames = [...state.recentDynamicNames].slice(0, this.recentLimit);
  }
}

const CityNameRegistry = new CityNameRegistryStore();

export default CityNameRegistry;
