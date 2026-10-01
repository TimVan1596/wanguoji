export function getViteBase(mode: string) {
  return mode === "desktop" ? "./" : "/";
}
