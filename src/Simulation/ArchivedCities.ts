import City, { CityHistoryEvent } from "../Components/City";

export interface ArchivedCity {
  id: string;
  name: string;
  founderFactionId: string;
  lastOwnerFactionId: string;
  foundedMonth: number;
  destroyedMonth: number;
  captureCount: number;
  historicalOwners: string[];
  history: CityHistoryEvent[];
}

class ArchivedCityStore {
  private cities: ArchivedCity[] = [];

  reset() {
    this.cities = [];
  }

  archive(city: City, destroyedMonth: number) {
    const historicalOwners = new Set<string>([
      city.founderFactionId,
      city.ownerFactionId,
      ...city.history.flatMap((event) => [
        event.previousOwnerFactionId,
        event.newOwnerFactionId,
      ]),
    ].filter(Boolean) as string[]);
    const archived: ArchivedCity = {
      id: city.id,
      name: city.name,
      founderFactionId: city.founderFactionId,
      lastOwnerFactionId: city.ownerFactionId,
      foundedMonth: city.foundedYear,
      destroyedMonth,
      captureCount: city.captureCount,
      historicalOwners: [...historicalOwners],
      history: [...city.history],
    };
    this.cities.push(archived);
    return archived;
  }

  list() {
    return [...this.cities];
  }

  importState(cities: ArchivedCity[]) {
    this.cities = cities.map((city) => ({ ...city, historicalOwners: [...city.historicalOwners], history: city.history.map((event) => ({ ...event })) }));
  }

  get(id: string) {
    return this.cities.find((city) => city.id === id);
  }

  names() {
    return this.cities.map((city) => city.name);
  }
}

const ArchivedCities = new ArchivedCityStore();

export default ArchivedCities;
