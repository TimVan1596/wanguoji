export interface CitySelectionCore {
  selectCity(cityId: string, options?: { openDetails?: boolean }): void;
}

export function selectCityFromList(core: CitySelectionCore | undefined, cityId: string) {
  core?.selectCity(cityId);
}
