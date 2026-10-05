import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Source-level render-path audit; no headless GUI or simulated visual acceptance.
describe("diagnostics report render isolation", () => {
  it("keeps report serialization in lazy builders and calls those only through copy handlers", () => {
    const source = ts.createSourceFile("panel.tsx", readFileSync(new URL("./WorldDiagnosticsPanel.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const builders = new Set(["buildCoreReport", "buildFullReport", "buildHydrationReport"]);
    const found = new Set<string>();
    let copyHandlers = 0;
    const walk = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text;
        if (name === "formatCoreDiagnostics" || name === "formatFullDiagnostics") {
          let parent: ts.Node | undefined = node.parent;
          while (parent && !ts.isArrowFunction(parent)) parent = parent.parent;
          expect(parent && ts.isVariableDeclaration(parent.parent) && builders.has(parent.parent.name.getText(source))).toBe(true);
          if (parent && ts.isVariableDeclaration(parent.parent)) found.add(parent.parent.name.getText(source));
        }
        // A builder invoked from render would reintroduce eager reports.
        expect(builders.has(name)).toBe(false);
        if (name === "copyReport") {
          let parent: ts.Node | undefined = node.parent;
          while (parent && !ts.isJsxAttribute(parent)) parent = parent.parent;
          expect(parent?.name.getText(source)).toBe("onClick");
          expect(builders.has(node.arguments[0].getText(source))).toBe(true);
          copyHandlers += 1;
        }
      }
      ts.forEachChild(node, walk);
    };
    walk(source);
    expect(found).toEqual(builders);
    expect(copyHandlers).toBe(3);
  });
});
