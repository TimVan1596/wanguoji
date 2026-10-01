export type AvatarRendererMode = "circle-mask" | "plain";

export function getAvatarRendererMode(search?: string): AvatarRendererMode {
  const currentSearch = search ?? (typeof window === "undefined" ? "" : window.location.search);
  const params = new URLSearchParams(currentSearch);
  return params.get("debug") === "1" && params.get("avatarRenderer") === "plain"
    ? "plain"
    : "circle-mask";
}
