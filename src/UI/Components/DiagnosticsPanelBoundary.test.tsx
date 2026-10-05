import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DiagnosticsPanelBoundary from "./DiagnosticsPanelBoundary";

// The repository can run Vitest with NODE_ENV=production, whose jsx-dev-runtime
// omits jsxDEV even though Vite's test transform emits it.
vi.mock("react/jsx-dev-runtime", async () => {
  const react = await vi.importActual<typeof import("react")>("react");
  return {
    jsxDEV: (type: React.ElementType, props: Record<string, unknown>, key?: string) => react.createElement(type, { ...props, key }),
    Fragment: react.Fragment,
  };
});

describe("local diagnostics panel boundary", () => {
  it("renders children normally, logs failure, offers fallback and can reset", () => {
    const boundary = new DiagnosticsPanelBoundary({ children: <span>diagnostics</span> });
    expect(renderToStaticMarkup(<>{boundary.render()}</>)).toContain("diagnostics");
    boundary.state = DiagnosticsPanelBoundary.getDerivedStateFromError();
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      boundary.componentDidCatch(new Error("panel failed"), { componentStack: "panel" });
      expect(log).toHaveBeenCalledOnce();
      const fallback = boundary.render() as React.ReactElement;
      expect(renderToStaticMarkup(fallback)).toContain("诊断面板异常，世界仍在运行");
      boundary.setState = (update) => {
        boundary.state = { ...boundary.state, ...(update as { failed: boolean }) };
      };
      fallback.props.children[1].props.onClick();
      expect(boundary.state.failed).toBe(false);
      expect(renderToStaticMarkup(<>{boundary.render()}</>)).toContain("diagnostics");
    } finally { log.mockRestore(); }
  });
});
