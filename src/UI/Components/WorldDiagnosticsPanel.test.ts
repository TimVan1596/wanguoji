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
  it("all diagnostic details default collapsed, with refresh hooks outside the lazy expanded subtree",()=>{
    const text=readFileSync(new URL("./WorldDiagnosticsPanel.tsx",import.meta.url),"utf8");
    const source=ts.createSourceFile("panel.tsx",text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
    let details=0,polls=0;
    const walk=(node:ts.Node)=>{
      if(ts.isJsxOpeningElement(node) && node.tagName.getText(source)==="details"){
        details++;expect(node.attributes.properties.some(a=>ts.isJsxAttribute(a)&&a.name.getText(source)==="open")).toBe(false);
      }
      if(ts.isCallExpression(node)&&node.expression.getText(source)==="window.setInterval"){
        polls++;let parent:ts.Node|undefined=node;
        while(parent){if(ts.isVariableDeclaration(parent))expect(parent.name.getText(source)).not.toBe("renderExpanded");parent=parent.parent;}
      }
      ts.forEachChild(node,walk);
    };
    walk(source);expect(details).toBeGreaterThan(10);expect(polls).toBe(2);
    expect(text).toContain("<DiagnosticsOverlayFrame");expect(text).toContain("{renderExpanded}");
    expect(text).not.toContain("localStorage");
  });

});
