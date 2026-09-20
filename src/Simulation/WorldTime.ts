export const MONTHS_PER_YEAR = 12;

export function getWorldYear(worldMonth: number) {
  return Math.floor(worldMonth / MONTHS_PER_YEAR);
}

export function getWorldMonth(worldMonth: number) {
  return (worldMonth % MONTHS_PER_YEAR) + 1;
}

export function formatWorldDate(worldMonth: number) {
  return `${getWorldYear(worldMonth)}年${getWorldMonth(worldMonth)}月`;
}

export function yearsToMonths(years: number) {
  return years * MONTHS_PER_YEAR;
}

export function monthsToYears(months: number) {
  return months / MONTHS_PER_YEAR;
}

export function formatWorldDuration(months: number) {
  const safeMonths = Math.max(0, Math.floor(months));
  const years = Math.floor(safeMonths / MONTHS_PER_YEAR);
  const restMonths = safeMonths % MONTHS_PER_YEAR;
  if (years <= 0) {
    return `${restMonths}个月`;
  }
  return restMonths > 0 ? `${years}年${restMonths}个月` : `${years}年`;
}
