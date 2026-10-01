import { defineConfig } from "vite";
import React from "@vitejs/plugin-react";
import Pages from "vite-plugin-pages";
import { getViteBase } from "./src/Runtime/ViteBuildMode";

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
    Pages(),
    React(),
  ]
}));
