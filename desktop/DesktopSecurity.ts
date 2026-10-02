import path from "node:path";

export const DESKTOP_PRODUCTION_CSP = [
  "default-src 'self' file:",
  "script-src 'self' file:",
  "style-src 'self' 'unsafe-inline' file:",
  "img-src 'self' file: data: blob: https:",
  "font-src 'self' file: data:",
  "connect-src 'self' file: https: wss:",
  "worker-src 'self' blob:",
  "media-src 'self' file: data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export function injectDesktopCsp(html: string) {
  if (html.includes('http-equiv="Content-Security-Policy"')) return html;
  const meta = `<meta http-equiv="Content-Security-Policy" content="${DESKTOP_PRODUCTION_CSP}">`;
  return html.replace("</head>", `  ${meta}\n</head>`);
}

export function isAllowedDesktopNavigation(destination: string, appUrl: string, devServerUrl?: string) {
  try {
    const target = new URL(destination);
    const app = new URL(appUrl);
    if (target.protocol === "file:") {
      return app.protocol === "file:" && target.pathname === app.pathname;
    }
    if (!devServerUrl) return false;
    const dev = new URL(devServerUrl);
    return target.origin === dev.origin && target.pathname === dev.pathname;
  } catch {
    return false;
  }
}

export function getStableUserDataPath(appDataPath: string) {
  return path.join(appDataPath, "Wanguoji");
}
