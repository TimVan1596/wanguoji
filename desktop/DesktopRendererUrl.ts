export function getDesktopRendererUrl(
  baseUrl: string,
  options: { debug?: boolean; avatarRenderer?: "plain" } = {}
) {
  const url = new URL(baseUrl);
  if (options.debug) {
    url.searchParams.set("debug", "1");
    if (options.avatarRenderer === "plain") url.searchParams.set("avatarRenderer", "plain");
  }
  if (url.protocol === "file:") url.hash = "/";
  return url.toString();
}
