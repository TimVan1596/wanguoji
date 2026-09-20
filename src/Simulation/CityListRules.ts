export type CityListFilter = "all" | "capital" | "siege" | "abnormal";

export interface CityListEntry {
  id: string;
  name: string;
  ownerFactionId: string;
  isCapital: boolean;
  defense: number;
  maxDefense: number;
  loyalty: number;
  devastation: number;
  underSiege: boolean;
  destroyed?: boolean;
}

export function getVisibleCities<T extends CityListEntry>(
  cities: T[],
  filter: CityListFilter
) {
  return cities
    .filter((city) => !city.destroyed)
    .filter((city) => {
      if (filter === "capital") {
        return city.isCapital;
      }
      if (filter === "siege") {
        return city.underSiege;
      }
      if (filter === "abnormal") {
        return city.loyalty < 40 || city.devastation >= 50;
      }
      return true;
    })
    .sort((a, b) => {
      if (a.isCapital !== b.isCapital) {
        return a.isCapital ? -1 : 1;
      }
      if (a.ownerFactionId !== b.ownerFactionId) {
        return a.ownerFactionId.localeCompare(b.ownerFactionId);
      }
      return b.devastation - a.devastation || a.name.localeCompare(b.name);
    });
}
