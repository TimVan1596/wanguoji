import { describe, expect, it } from "vitest";
import { shouldCloseGenealogyDialog } from "./genealogyDialogClose";

describe("genealogy dialog close contract", () => {
  it("allows explicit close and Escape", () => {
    expect(shouldCloseGenealogyDialog("explicit")).toBe(true);
    expect(shouldCloseGenealogyDialog("escapeKeyDown")).toBe(true);
  });

  it("allows only a genuine backdrop click whose target is the backdrop", () => {
    expect(shouldCloseGenealogyDialog("backdropClick", true)).toBe(true);
    expect(shouldCloseGenealogyDialog("backdropClick", false)).toBe(false);
  });

  it.each(["contentClick", "emptyCanvasClick", "nodeClick", "toolbarClick"] as const)(
    "keeps the dialog open for %s",
    (reason) => expect(shouldCloseGenealogyDialog(reason)).toBe(false)
  );
});
