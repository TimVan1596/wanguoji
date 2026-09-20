export interface CitySelectionCore {
  selectCity(cityId: string): void;
}

export function selectCityFromList(core: CitySelectionCore | undefined, cityId: string) {
  core?.selectCity(cityId);
}
