export function getViteBase(mode: string) {
  return mode === "desktop" || mode === "desktop-debug" ? "./" : "/";
}

export function isDesktopBuildMode(mode: string) {
  return mode === "desktop" || mode === "desktop-debug";
}
