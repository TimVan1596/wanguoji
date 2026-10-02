export type TextureProbeSource = "SVG" | "PNG";

export function getTextureProbeSource(search?: string): TextureProbeSource {
  const currentSearch = search ?? (typeof window === "undefined" ? "" : window.location.search);
  const params = new URLSearchParams(currentSearch);
  return params.get("debug") === "1" && params.get("textureProbe") === "png" ? "PNG" : "SVG";
}
