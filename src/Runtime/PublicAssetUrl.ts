/** Resolve public assets for both web roots and Electron file:// builds. */
export function resolvePublicAssetUrl(url: string, baseUrl = import.meta.env.BASE_URL) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)) return url;
  if (url.startsWith("./")) return url;
  return `${baseUrl}${url.replace(/^\/+/, "")}`;
}
