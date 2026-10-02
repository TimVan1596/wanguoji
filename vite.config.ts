import { defineConfig } from "vite";
import React from "@vitejs/plugin-react";
import Pages from "vite-plugin-pages";
import { getViteBase } from "./src/Runtime/ViteBuildMode";
import { injectDesktopCsp } from "./desktop/DesktopSecurity";

export default defineConfig(({ mode }) => ({
  base: getViteBase(mode),
  preview: {
    host: "0.0.0.0",
  },
  server: {
    host: "0.0.0.0",
    hmr: false,
  },
  plugins: [
    ...(mode === "desktop" ? [{
      name: "wanguoji-desktop-production-csp",
      transformIndexHtml: {
        order: "post" as const,
        handler(html: string) { return injectDesktopCsp(html); },
      },
    }] : []),
    Pages(),
    React(),
  ]
}));
