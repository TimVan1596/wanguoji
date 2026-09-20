import { defineConfig } from "vite";
import React from "@vitejs/plugin-react";
import Pages from "vite-plugin-pages";

export default defineConfig({
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
});
