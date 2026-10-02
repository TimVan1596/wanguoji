export function getDesktopDebugLaunchOptions(argv: string[]) {
  const avatarRenderer = argv.includes("--wanguoji-avatar-renderer=plain") ? "plain" as const : undefined;
  const textureProbe = argv.includes("--wanguoji-texture-probe=png") ? "png" as const : undefined;
  return {
    debug: argv.includes("--wanguoji-debug") || avatarRenderer === "plain" || textureProbe === "png",
    avatarRenderer,
    textureProbe,
    devServerUrl: argv.find((argument) => argument.startsWith("--wanguoji-dev-server="))
      ?.slice("--wanguoji-dev-server=".length),
  };
}

export function getDesktopRendererUrl(
  baseUrl: string,
  options: { debug?: boolean; avatarRenderer?: "plain"; textureProbe?: "png" } = {}
) {
  const url = new URL(baseUrl);
  if (options.debug) {
    url.searchParams.set("debug", "1");
    if (options.avatarRenderer === "plain") url.searchParams.set("avatarRenderer", "plain");
    if (options.textureProbe === "png") url.searchParams.set("textureProbe", "png");
  }
  if (url.protocol === "file:") url.hash = "/";
  return url.toString();
}
