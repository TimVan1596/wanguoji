/** Numeric prose for commentary only; never applied to names or finished text. */
export function historianNumber(value: number): string {
  const n = Math.max(0, Math.floor(value));
  if (n < 10) return "零一二三四五六七八九"[n];
  if (n < 100) return `${n < 20 ? "" : historianNumber(Math.floor(n / 10))}十${n % 10 ? historianNumber(n % 10) : ""}`;
  if (n < 1000) return `${historianNumber(Math.floor(n / 100))}百${n % 100 ? `${n % 100 < 10 ? "零" : ""}${historianNumber(n % 100)}` : ""}`;
  if (n < 10000) return `${historianNumber(Math.floor(n / 1000))}千${n % 1000 ? `${n % 1000 < 100 ? "零" : ""}${historianNumber(n % 1000)}` : ""}`;
  return "数以万计";
}
export function historianSpan(months: number): string {
  if (months <= 0) return "同月";
  if (months < 12) return "未及一年";
  if (months < 120) return "未及十载";
  const decades = Math.floor(months / 120) * 10;
  return `${historianNumber(decades)}${months === decades * 12 ? "" : "余"}载`;
}
/** Fraction (0..1). Coarse wording is separate from the exact factual percentage. */
export function historianTerritory(share: number): string {
  if (share >= 1) return "天下全境";
  if (share >= .6) {
    const tenths = Math.floor(share * 10);
    return `天下${historianNumber(tenths)}成${Math.abs(share - tenths / 10) < 1e-9 ? "" : "有余"}`;
  }
  if (share > .5) return "天下过半之地";
  if (share === .5) return "天下半数之地";
  return "一方疆土";
}
