export function getDesktopDebugLaunchOptions(argv: string[]) {
  const avatarRenderer = argv.includes("--wanguoji-avatar-renderer=plain") ? "plain" as const : undefined;
  return {
    debug: argv.includes("--wanguoji-debug") || avatarRenderer === "plain",
    avatarRenderer,
    devServerUrl: argv.find((argument) => argument.startsWith("--wanguoji-dev-server="))
      ?.slice("--wanguoji-dev-server=".length),
  };
}

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
