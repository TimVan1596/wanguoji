export function isRuntimeDebugEnabled(search = typeof window === "undefined" ? "" : window.location.search) {
  return new URLSearchParams(search).get("debug") === "1";
}
